import * as THREE from "three";
import "./styles.css";
import { StatsOverlay } from "./diagnostics/StatsOverlay";
import { FlyCameraController } from "./input/FlyCameraController";
import { buildHeightmapTerrain } from "./render/terrainMesh";
import { loadHeightmapData } from "./world/heightmapLoader";
import { HEIGHTMAP_WORLD_CONFIG, HeightmapWorld } from "./world/heightmapWorld";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing #app root.");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x93cdea);
scene.fog = new THREE.Fog(0x93cdea, 450, 1500);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.05, 1800);

const renderer = new THREE.WebGLRenderer({
  antialias: false,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute("aria-label", "Agency voxel world viewport");
renderer.domElement.addEventListener("click", () => renderer.domElement.focus());
app.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xdff5ff, 0x6d5a46, 1.85));

const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.position.set(260, 520, 180);
scene.add(sun);

const hint = document.createElement("div");
hint.className = "hint";
hint.textContent = "Loading heightmap terrain...";
document.body.appendChild(hint);

const crosshair = document.createElement("div");
crosshair.className = "crosshair";
document.body.appendChild(crosshair);

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

window.addEventListener("resize", onResize);
renderer.domElement.addEventListener("webglcontextlost", onContextLost);
renderer.domElement.addEventListener("webglcontextrestored", onContextRestored);

let controller: FlyCameraController | null = null;
let stats: StatsOverlay | null = null;
let lastTime = performance.now();

const dispose = () => {
  controller?.dispose();
  stats?.dispose();
  window.removeEventListener("resize", onResize);
  renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
  renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);
  renderer.dispose();
};

const start = async () => {
  const heightmap = await loadHeightmapData({
    targetWidth: HEIGHTMAP_WORLD_CONFIG.width,
    targetDepth: HEIGHTMAP_WORLD_CONFIG.depth,
    maxTerrainHeight: HEIGHTMAP_WORLD_CONFIG.maxTerrainHeight
  });
  const world = new HeightmapWorld(heightmap);
  const { group: terrain, stats: worldStats } = buildHeightmapTerrain(world);

  scene.add(terrain);

  camera.position.set(-180, world.worldHeight() + 78, 260);
  controller = new FlyCameraController(camera, renderer.domElement);
  controller.moveSpeed = 78;

  stats = new StatsOverlay(renderer, camera, controller, worldStats);
  hint.textContent = "Click to look. WASD moves, Space rises, C/Ctrl lowers, Shift sprints. Heightmap terrain from public/heightmap.png.";

  renderer.setAnimationLoop((time) => {
    const deltaSeconds = Math.min(0.05, (time - lastTime) / 1000);
    lastTime = time;

    controller?.update(deltaSeconds);
    renderer.render(scene, camera);
    stats?.update(deltaSeconds);
  });
};

start().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown heightmap error.";
  hint.textContent = `Could not load heightmap terrain: ${message}`;
  console.error(error);
});

window.addEventListener("beforeunload", dispose);
