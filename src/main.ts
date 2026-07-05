import * as THREE from "three";
import "./styles.css";
import { ConcreteBoxTool } from "./dev/concreteBoxTool";
import { PlayerCameraController } from "./input/PlayerCameraController";
import { buildFlatTerrain } from "./render/terrainMesh";
import { loadTerrainMaterials } from "./render/terrainMaterials";
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

const hemisphereLight = new THREE.HemisphereLight(0xdff5ff, 0x6d5a46, 1.85);
scene.add(hemisphereLight);

const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.position.set(260, 520, 180);
scene.add(sun);

const materials = loadTerrainMaterials();
const surfaceBlocks = buildSurfaceBlockMap(world);
const { group: terrain } = buildFlatTerrain(world, materials, surfaceBlocks.rects);
scene.add(terrain);

const concreteBoxTool = new ConcreteBoxTool({
  camera,
  domElement: renderer.domElement,
  world,
  materials
});
scene.add(concreteBoxTool.group);

camera.position.set(
  worldBlockX(world.width / 2 - 30),
  world.worldHeight() + playerEyeHeight,
  worldBlockZ(world.depth / 2 + 40)
);

const controller = new PlayerCameraController(camera, renderer.domElement, world.worldHeight(), playerEyeHeight);
controller.lookAt(new THREE.Vector3(worldBlockX(world.width / 2), world.worldHeight() + 0.8, worldBlockZ(world.depth / 2)));

let lastTime = performance.now();
let disposed = false;

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

const dispose = () => {
  if (disposed) return;
  disposed = true;
  controller.dispose();
  concreteBoxTool.dispose();
  window.removeEventListener("resize", onResize);
  renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
  renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);
  renderer.dispose();
};

window.addEventListener("resize", onResize);
renderer.domElement.addEventListener("webglcontextlost", onContextLost);
renderer.domElement.addEventListener("webglcontextrestored", onContextRestored);
window.addEventListener("beforeunload", dispose);

renderer.setAnimationLoop((time) => {
  const deltaSeconds = Math.min(0.05, (time - lastTime) / 1000);
  lastTime = time;

  controller.update(deltaSeconds);
  concreteBoxTool.update();
  renderer.render(scene, camera);
});
