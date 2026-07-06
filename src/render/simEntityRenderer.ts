import * as THREE from "three";
import { BLUEPRINT_BY_ID } from "../sim/blueprints";
import type { CityState, ResourceId, WorldPosition } from "../sim/types";
import type { PlotWorld } from "../world/plotWorld";

type SimEntityRendererOptions = {
  world: PlotWorld;
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

export class SimEntityRenderer {
  readonly group = new THREE.Group();

  constructor(private readonly options: SimEntityRendererOptions) {
    this.group.name = "sim-entities";
  }

  setState(state: CityState, selectedPlotId: string | null = null) {
    for (const child of this.group.children) disposeObject(child);
    this.group.clear();
    this.addSelectedPlot(state, selectedPlotId);
    this.addResourceNodes(state);
    this.addProjectFrames(state);
    this.addAgents(state);
  }

  dispose() {
    for (const child of this.group.children) disposeObject(child);
    this.group.clear();
  }

  private addAgents(state: CityState) {
    const bodyGeometry = new THREE.CylinderGeometry(0.16, 0.18, 0.58, 8);
    const headGeometry = new THREE.SphereGeometry(0.18, 8, 8);

    state.agents.forEach((agent, index) => {
      const group = new THREE.Group();
      group.name = `${agent.id}-${agent.movementState}`;
      const hue = (index * 0.19 + 0.58) % 1;
      const color = new THREE.Color().setHSL(hue, 0.68, agent.movementState === "working" ? 0.62 : 0.52);
      const body = new THREE.Mesh(bodyGeometry.clone(), new THREE.MeshLambertMaterial({ color }));
      body.position.y = 0.22;
      const head = new THREE.Mesh(headGeometry.clone(), new THREE.MeshLambertMaterial({ color: 0xf3d7b0 }));
      head.position.y = 0.6;
      group.add(body, head);

      if (agent.movementState === "working") {
        const pulse = new THREE.Mesh(
          new THREE.RingGeometry(0.22, 0.32, 12),
          new THREE.MeshBasicMaterial({ color: 0xffdf6e, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
        );
        pulse.rotation.x = -Math.PI / 2;
        pulse.position.y = 0.02;
        group.add(pulse);
      }

      setBlockPosition(group, this.options.world, agent.position, this.options.world.height + 0.45);
      this.group.add(group);
    });
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
      this.group.add(mesh);
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
      this.group.add(frame);
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
    this.group.add(highlight);
  }
}
