import * as THREE from "three";
import "./styles.css";
import { StatsOverlay } from "./diagnostics/StatsOverlay";
import { FlyCameraController } from "./input/FlyCameraController";
import { buildFlatTerrain } from "./render/terrainMesh";
import { FlatWorld } from "./world/flatWorld";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing #app root.");

const world = new FlatWorld();

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
renderer.domElement.setAttribute("aria-label", "Agency voxel world viewport");
renderer.domElement.addEventListener("click", () => renderer.domElement.focus());
app.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xdff5ff, 0x6d5a46, 1.85));

const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.position.set(260, 520, 180);
scene.add(sun);

const hint = document.createElement("div");
hint.className = "hint";
hint.textContent = "Loading flatworld...";
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

const start = () => {
  const { group: terrain, stats: worldStats } = buildFlatTerrain(world);
  scene.add(terrain);

  const target = new THREE.Vector3(0, world.worldHeight(), 0);
  camera.position.set(-120, world.worldHeight() + 96, 180);
  controller = new FlyCameraController(camera, renderer.domElement);
  controller.moveSpeed = 96;
  controller.lookAt(target);

  stats = new StatsOverlay(renderer, camera, controller, worldStats);
  hint.textContent =
    "Click to look. WASD moves, Space rises, C/Ctrl lowers, Shift sprints. 4000x4000 flatworld: 50 stone, 10 dirt, 1 grass.";

  renderer.setAnimationLoop((time) => {
    const deltaSeconds = Math.min(0.05, (time - lastTime) / 1000);
    lastTime = time;

    controller?.update(deltaSeconds);
    renderer.render(scene, camera);
    stats?.update(deltaSeconds);
  });
};

start();
window.addEventListener("beforeunload", dispose);
