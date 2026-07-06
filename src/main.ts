import * as THREE from "three";
import "./styles.css";
import { isAgentSpawnModelId, pickAgentModelForSeed } from "./agents/agentModels";
import { SimulationDebugOverlay } from "./debug/simulationDebugOverlay";
import { PlayerCameraController } from "./input/PlayerCameraController";
import { cityBuildingsToConcreteBoxes } from "./render/cityBuildingBoxes";
import { ConcreteBoxRenderer } from "./render/concreteBoxRenderer";
import { SimEntityRenderer } from "./render/simEntityRenderer";
import { buildFlatTerrain } from "./render/terrainMesh";
import { loadTerrainMaterials } from "./render/terrainMaterials";
import { createInitialCityState } from "./sim/createInitialCityState";
import { clearSavedCityState, loadCityState, saveCityState } from "./sim/persistence";
import { tickCityState } from "./sim/tick";
import type { CityState } from "./sim/types";
import { FlatWorld } from "./world/flatWorld";
import { PlotWorld } from "./world/plotWorld";
import { generatePlotLayout } from "./world/plots";
import { buildSurfaceBlockMap } from "./world/surfaceBlocks";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing #app root.");

const PLAYER_EYE_HEIGHT_BLOCKS = 1.62;
const seedWorld = new FlatWorld();
const plotLayout = generatePlotLayout(seedWorld);
const world = new PlotWorld(plotLayout, {
  width: Math.max(1, plotLayout.bounds.maxX),
  depth: Math.max(1, plotLayout.bounds.maxZ),
  blockSize: seedWorld.blockSize,
  stoneDepth: seedWorld.stoneDepth,
  dirtDepth: seedWorld.dirtDepth,
  grassDepth: seedWorld.grassDepth
});

const centerPlot = [...plotLayout.plots].sort((a, b) => {
  const centerX = plotLayout.bounds.width / 2;
  const centerZ = plotLayout.bounds.depth / 2;
  const da = Math.hypot(a.centerX - centerX, a.centerZ - centerZ);
  const db = Math.hypot(b.centerX - centerX, b.centerZ - centerZ);
  return da - db;
})[0];

const createFreshCityState = () =>
  createInitialCityState({
    plots: plotLayout.plots,
    charterPlotId: centerPlot?.id ?? null,
    pathRects: plotLayout.pathRects
  });

const hydrateCityState = (state: CityState): CityState => ({
  ...state,
  schemaVersion: state.schemaVersion ?? 2,
  pathRects: state.pathRects?.length > 0 ? state.pathRects : plotLayout.pathRects,
  agents: state.agents.map((agent) => ({
    ...agent,
    route: agent.route ?? [],
    modelId: agent.modelId && isAgentSpawnModelId(agent.modelId) ? agent.modelId : pickAgentModelForSeed(agent.id).id
  }))
});

const savedState = loadCityState();
let cityState: CityState = savedState && savedState.plotStates?.length > 0 ? hydrateCityState(savedState) : createFreshCityState();
let paused = false;
let simSpeed = 4;
let selectedPlotId: string | null = null;

const simDebugOverlay = new SimulationDebugOverlay(app);
const updateOverlay = () =>
  simDebugOverlay.update(cityState, {
    paused,
    speed: simSpeed,
    selectedPlotId,
    onTogglePause: () => {
      paused = !paused;
      updateOverlay();
    },
    onSpeedChange: (speed) => {
      simSpeed = speed;
      paused = false;
      updateOverlay();
    },
    onSave: () => {
      saveCityState(cityState);
      updateOverlay();
    },
    onLoad: () => {
      const loadedState = loadCityState();
      cityState = loadedState ? hydrateCityState(loadedState) : cityState;
      renderSimState();
    },
    onReset: () => {
      clearSavedCityState();
      cityState = createFreshCityState();
      renderSimState();
    }
  });

console.info("Initial agency founding loop", {
  agents: cityState.agents.length,
  buildings: cityState.buildings.length,
  plots: cityState.plotStates.length,
  resourceNodes: cityState.resourceNodes.length,
  stockpileFood: cityState.publicStockpile.food
});

const playerEyeHeight = world.blockSize * PLAYER_EYE_HEIGHT_BLOCKS;
const worldBlockX = (x: number) => (x - world.width / 2) * world.blockSize;
const worldBlockZ = (z: number) => (z - world.depth / 2) * world.blockSize;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x93cdea);
scene.fog = new THREE.Fog(0x93cdea, 900, 1800);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.05, 2600);

const renderer = new THREE.WebGLRenderer({
  antialias: false,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute("aria-label", "Generated plot world viewport");
renderer.domElement.addEventListener("click", () => renderer.domElement.focus());
app.appendChild(renderer.domElement);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -world.worldHeight());
const groundHit = new THREE.Vector3();

const hemisphereLight = new THREE.HemisphereLight(0xdff5ff, 0x6d5a46, 1.85);
scene.add(hemisphereLight);

const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.position.set(260, 520, 180);
scene.add(sun);

const materials = loadTerrainMaterials();
const surfaceBlocks = buildSurfaceBlockMap(world);
const { group: terrain } = buildFlatTerrain(world, materials, surfaceBlocks.rects);
scene.add(terrain);
const cityBuildingBoxes = cityBuildingsToConcreteBoxes(cityState.buildings, plotLayout);

const concreteBoxes = new ConcreteBoxRenderer({
  world,
  materials,
  boxes: cityBuildingBoxes
});
scene.add(concreteBoxes.group);

const simEntities = new SimEntityRenderer({ world });
scene.add(simEntities.group);

const renderSimState = () => {
  updateOverlay();
  concreteBoxes.setBoxes(cityBuildingsToConcreteBoxes(cityState.buildings, plotLayout));
  simEntities.setState(cityState, selectedPlotId);
};

renderSimState();

const agencyWindow = window as typeof window & {
  __AGENCY_GET_STATE__?: () => CityState;
  __AGENCY_TICK__?: (ticks: number) => CityState;
};
agencyWindow.__AGENCY_GET_STATE__ = () => cityState;
agencyWindow.__AGENCY_TICK__ = (ticks: number) => {
  const count = Math.max(0, Math.floor(ticks));
  for (let i = 0; i < count; i += 1) cityState = tickCityState(cityState);
  renderSimState();
  return cityState;
};

camera.position.set(
  worldBlockX(world.width / 2 - 30),
  world.worldHeight() + playerEyeHeight,
  worldBlockZ(world.depth / 2 + 40)
);

const controller = new PlayerCameraController(camera, renderer.domElement, world.worldHeight(), playerEyeHeight);
controller.lookAt(new THREE.Vector3(worldBlockX(world.width / 2), world.worldHeight() + 0.8, worldBlockZ(world.depth / 2)));

let lastTime = performance.now();
let disposed = false;
let simAccumulator = 0;
let autosaveAccumulator = 0;

const onResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
};

const onContextLost = (event: Event) => {
  event.preventDefault();
  console.warn("WebGL context lost.");
};

const onContextRestored = () => {
  console.info("WebGL context restored.");
};

const onPointerDown = (event: PointerEvent) => {
  if (event.button !== 0) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  raycaster.setFromCamera(pointer, camera);
  if (!raycaster.ray.intersectPlane(groundPlane, groundHit)) return;

  const blockX = Math.floor(groundHit.x / world.blockSize + world.width / 2);
  const blockZ = Math.floor(groundHit.z / world.blockSize + world.depth / 2);
  selectedPlotId = world.plotAt(blockX, blockZ)?.id ?? null;
  renderSimState();
};

const dispose = () => {
  if (disposed) return;
  disposed = true;
  controller.dispose();
  concreteBoxes.dispose();
  simEntities.dispose();
  simDebugOverlay.dispose();
  window.removeEventListener("resize", onResize);
  renderer.domElement.removeEventListener("pointerdown", onPointerDown);
  renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
  renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);
  renderer.dispose();
};

window.addEventListener("resize", onResize);
renderer.domElement.addEventListener("pointerdown", onPointerDown);
renderer.domElement.addEventListener("webglcontextlost", onContextLost);
renderer.domElement.addEventListener("webglcontextrestored", onContextRestored);
window.addEventListener("beforeunload", dispose);

renderer.setAnimationLoop((time) => {
  const deltaSeconds = Math.min(0.05, (time - lastTime) / 1000);
  lastTime = time;

  controller.update(deltaSeconds);

  if (!paused) {
    simAccumulator += deltaSeconds * simSpeed;
    autosaveAccumulator += deltaSeconds;
    let changed = false;
    while (simAccumulator >= 1) {
      cityState = tickCityState(cityState);
      simAccumulator -= 1;
      changed = true;
    }

    if (changed) renderSimState();
    if (autosaveAccumulator > 10) {
      saveCityState(cityState);
      autosaveAccumulator = 0;
    }
  }

  simEntities.update(deltaSeconds);
  renderer.render(scene, camera);
});
