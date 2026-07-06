import * as THREE from "three";
import { pickAgentModelForSeed } from "../agents/agentModels";
import { BLUEPRINT_BY_ID } from "../sim/blueprints";
import type { Agent, CityState, ResourceId, WorldPosition } from "../sim/types";
import type { PlotWorld } from "../world/plotWorld";
import { AgentModelLoader, type LoadedAgentModel } from "./agentModelLoader";

type SimEntityRendererOptions = {
  world: PlotWorld;
};

type AgentVisual = {
  root: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  clips: THREE.AnimationClip[];
  modelId: string;
  currentClipName: string | null;
};

const RESOURCE_COLORS: Record<Extract<ResourceId, "food" | "wood" | "stone">, number> = {
  food: 0x62b246,
  wood: 0x8b5a2b,
  stone: 0x9a9a9a
};

const PROJECT_COLORS = {
  proposed: 0xf1c84b,
  resource_blocked: 0xdb7c3c,
  active: 0x8ee06c
} as const;

const TARGET_AGENT_HEIGHT_BLOCKS = 2.35;

const worldBlockX = (world: PlotWorld, x: number) => (x - world.width / 2) * world.blockSize;
const worldBlockY = (world: PlotWorld, y: number) => y * world.blockSize;
const worldBlockZ = (world: PlotWorld, z: number) => (z - world.depth / 2) * world.blockSize;

const disposeObject = (object: THREE.Object3D) => {
  object.traverse((entry) => {
    const mesh = entry as THREE.Mesh;
    mesh.geometry?.dispose?.();
    const material = mesh.material;
    if (Array.isArray(material)) {
      material.forEach((item) => item.dispose());
    } else {
      material?.dispose?.();
    }
  });
};

const setBlockPosition = (object: THREE.Object3D, world: PlotWorld, position: WorldPosition, yBlocks = world.height + 0.5) => {
  object.position.set(worldBlockX(world, position.x), worldBlockY(world, yBlocks), worldBlockZ(world, position.z));
};

const modelIdForAgent = (agent: Agent) => agent.modelId ?? pickAgentModelForSeed(agent.id).id;

const clipNameForAgent = (agent: Agent) => {
  if (agent.movementState === "walking") return "Walk";
  if (agent.movementState === "working") {
    if (agent.currentAction?.type === "gather_resource") return "PickUp";
    return "Punch";
  }
  return "Idle";
};

const findClip = (clips: readonly THREE.AnimationClip[], preferredName: string) =>
  clips.find((clip) => clip.name === preferredName) ??
  clips.find((clip) => clip.name.toLowerCase().includes(preferredName.toLowerCase())) ??
  clips.find((clip) => clip.name === "Idle") ??
  clips[0] ??
  null;

export class SimEntityRenderer {
  readonly group = new THREE.Group();

  private readonly resourceGroup = new THREE.Group();
  private readonly projectGroup = new THREE.Group();
  private readonly selectedGroup = new THREE.Group();
  private readonly agentGroup = new THREE.Group();
  private readonly agentModelLoader = new AgentModelLoader();
  private readonly agentVisuals = new Map<string, AgentVisual>();
  private readonly loadingAgentIds = new Set<string>();

  private latestState: CityState | null = null;
  private selectedPlotId: string | null = null;
  private loadVersion = 0;

  constructor(private readonly options: SimEntityRendererOptions) {
    this.group.name = "sim-entities";
    this.resourceGroup.name = "resource-nodes";
    this.projectGroup.name = "project-frames";
    this.selectedGroup.name = "selected-plot";
    this.agentGroup.name = "agents";
    this.group.add(this.selectedGroup, this.resourceGroup, this.projectGroup, this.agentGroup);
  }

  setState(state: CityState, selectedPlotId: string | null = null) {
    this.latestState = state;
    this.selectedPlotId = selectedPlotId;
    this.clearGroup(this.selectedGroup);
    this.clearGroup(this.resourceGroup);
    this.clearGroup(this.projectGroup);
    this.addSelectedPlot(state, selectedPlotId);
    this.addResourceNodes(state);
    this.addProjectFrames(state);
    this.syncAgents(state);
  }

  update(deltaSeconds: number) {
    for (const visual of this.agentVisuals.values()) {
      visual.mixer?.update(deltaSeconds);
    }
  }

  dispose() {
    this.clearGroup(this.selectedGroup);
    this.clearGroup(this.resourceGroup);
    this.clearGroup(this.projectGroup);
    this.agentGroup.clear();
    this.agentVisuals.clear();
    this.loadingAgentIds.clear();
    this.group.clear();
  }

  private clearGroup(group: THREE.Group) {
    for (const child of group.children) disposeObject(child);
    group.clear();
  }

  private syncAgents(state: CityState) {
    const liveAgentIds = new Set(state.agents.map((agent) => agent.id));
    for (const [agentId, visual] of this.agentVisuals) {
      if (!liveAgentIds.has(agentId)) {
        this.agentGroup.remove(visual.root);
        visual.mixer?.stopAllAction();
        this.agentVisuals.delete(agentId);
      }
    }

    for (const agent of state.agents) {
      const modelId = modelIdForAgent(agent);
      const visual = this.agentVisuals.get(agent.id);
      if (visual && visual.modelId === modelId) {
        this.updateAgentVisual(agent, visual);
        continue;
      }

      if (!this.loadingAgentIds.has(agent.id)) {
        this.loadAgentVisual(agent, modelId, this.loadVersion);
      }
    }
  }

  private async loadAgentVisual(agent: Agent, modelId: string, version: number) {
    this.loadingAgentIds.add(agent.id);
    try {
      const loaded = await this.agentModelLoader.load(modelId);
      if (version !== this.loadVersion || this.latestState === null) return;
      const latestAgent = this.latestState.agents.find((entry) => entry.id === agent.id);
      if (!latestAgent) return;

      const oldVisual = this.agentVisuals.get(agent.id);
      if (oldVisual) {
        this.agentGroup.remove(oldVisual.root);
        oldVisual.mixer?.stopAllAction();
      }

      const visual = this.createAgentVisual(loaded, modelId);
      this.agentVisuals.set(agent.id, visual);
      this.agentGroup.add(visual.root);
      this.updateAgentVisual(latestAgent, visual);
    } catch (error) {
      console.warn(`Failed to load agent model ${modelId}.`, error);
      this.addFallbackAgent(agent);
    } finally {
      this.loadingAgentIds.delete(agent.id);
    }
  }

  private createAgentVisual(loaded: LoadedAgentModel, modelId: string): AgentVisual {
    const root = new THREE.Group();
    root.name = `agent:${modelId}`;
    const model = loaded.root;
    model.rotation.y = Math.PI;
    this.normalizeAgentModel(model);
    root.add(model);

    return {
      root,
      mixer: loaded.animations.length > 0 ? new THREE.AnimationMixer(model) : null,
      clips: loaded.animations,
      modelId,
      currentClipName: null
    };
  }

  private normalizeAgentModel(model: THREE.Group) {
    model.updateMatrixWorld(true);
    const sourceBox = new THREE.Box3().setFromObject(model);
    const sourceHeight = sourceBox.max.y - sourceBox.min.y;
    if (sourceHeight <= 0) return;

    const targetHeight = TARGET_AGENT_HEIGHT_BLOCKS * this.options.world.blockSize;
    const scale = targetHeight / sourceHeight;
    model.scale.setScalar(scale);
    model.updateMatrixWorld(true);

    const scaledBox = new THREE.Box3().setFromObject(model);
    model.position.set(
      -((scaledBox.min.x + scaledBox.max.x) / 2),
      -scaledBox.min.y,
      -((scaledBox.min.z + scaledBox.max.z) / 2)
    );
  }

  private updateAgentVisual(agent: Agent, visual: AgentVisual) {
    setBlockPosition(visual.root, this.options.world, agent.position, this.options.world.height);
    this.faceDestination(agent, visual.root);
    this.playAgentClip(agent, visual);
  }

  private faceDestination(agent: Agent, root: THREE.Group) {
    const destination = agent.destination ?? agent.currentAction?.destination ?? null;
    if (!destination) return;
    const dx = destination.x - agent.position.x;
    const dz = destination.z - agent.position.z;
    if (Math.abs(dx) + Math.abs(dz) < 0.01) return;
    root.rotation.y = Math.atan2(dx, dz);
  }

  private playAgentClip(agent: Agent, visual: AgentVisual) {
    if (!visual.mixer) return;
    const preferredName = clipNameForAgent(agent);
    if (visual.currentClipName === preferredName) return;
    const clip = findClip(visual.clips, preferredName);
    if (!clip) return;

    visual.mixer.stopAllAction();
    const action = visual.mixer.clipAction(clip);
    action.reset();
    action.fadeIn(0.12);
    action.play();
    visual.currentClipName = preferredName;
  }

  private addFallbackAgent(agent: Agent) {
    if (this.agentVisuals.has(agent.id)) return;
    const root = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.18, 0.58, 8),
      new THREE.MeshLambertMaterial({ color: 0x4f8dff })
    );
    body.position.y = 0.22;
    root.add(body);
    setBlockPosition(root, this.options.world, agent.position, this.options.world.height + 0.45);
    this.agentVisuals.set(agent.id, {
      root,
      mixer: null,
      clips: [],
      modelId: "fallback",
      currentClipName: null
    });
    this.agentGroup.add(root);
  }

  private addResourceNodes(state: CityState) {
    for (const node of state.resourceNodes) {
      if (node.amountRemaining <= 0) continue;
      const scale = Math.max(0.35, Math.min(0.9, node.amountRemaining / 35));
      const geometry =
        node.resourceId === "wood"
          ? new THREE.ConeGeometry(0.36 * scale, 0.95 * scale, 6)
          : new THREE.BoxGeometry(0.56 * scale, 0.42 * scale, 0.56 * scale);
      const material = new THREE.MeshLambertMaterial({ color: RESOURCE_COLORS[node.resourceId] });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = node.id;
      setBlockPosition(mesh, this.options.world, node.position, this.options.world.height + 0.45);
      this.resourceGroup.add(mesh);
    }
  }

  private addProjectFrames(state: CityState) {
    const plotsById = new Map(state.plotStates.map((plot) => [plot.plotId, plot]));
    for (const project of state.projects) {
      if (project.status !== "proposed" && project.status !== "resource_blocked" && project.status !== "active") continue;
      if (project.blueprintId === null || project.targetPlotId === null) continue;
      const blueprint = BLUEPRINT_BY_ID[project.blueprintId];
      const plot = plotsById.get(project.targetPlotId);
      if (!plot) continue;

      const width = Math.min(plot.width - 4, blueprint.buildWidth) * this.options.world.blockSize;
      const depth = Math.min(plot.depth - 4, blueprint.buildLength) * this.options.world.blockSize;
      const height = Math.max(2, blueprint.buildHeight) * this.options.world.blockSize;
      const geometry = new THREE.BoxGeometry(width, height, depth);
      const edges = new THREE.EdgesGeometry(geometry);
      const material = new THREE.LineBasicMaterial({
        color: PROJECT_COLORS[project.status],
        transparent: true,
        opacity: project.status === "active" ? 0.95 : 0.65
      });
      const frame = new THREE.LineSegments(edges, material);
      frame.name = project.id;
      setBlockPosition(frame, this.options.world, plot.center, this.options.world.height + blueprint.buildHeight / 2);
      this.projectGroup.add(frame);
    }
  }

  private addSelectedPlot(state: CityState, selectedPlotId: string | null) {
    if (selectedPlotId === null) return;
    const plot = state.plotStates.find((entry) => entry.plotId === selectedPlotId);
    if (!plot) return;

    const geometry = new THREE.PlaneGeometry(plot.width * this.options.world.blockSize, plot.depth * this.options.world.blockSize);
    const material = new THREE.MeshBasicMaterial({
      color: 0xf6f0a6,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const highlight = new THREE.Mesh(geometry, material);
    highlight.name = `selected-${plot.plotId}`;
    highlight.rotation.x = -Math.PI / 2;
    setBlockPosition(highlight, this.options.world, plot.center, this.options.world.height + 0.035);
    this.selectedGroup.add(highlight);
  }
}
