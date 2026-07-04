import * as THREE from "three";
import "./styles.css";
import { StatsOverlay } from "./diagnostics/StatsOverlay";
import { BlockEditor } from "./input/BlockEditor";
import { PlayerCameraController } from "./input/PlayerCameraController";
import { EditableBlockRenderer } from "./render/editableBlocks";
import { GoodVibesSky } from "./render/skybox";
import { buildFlatTerrain } from "./render/terrainMesh";
import { loadTerrainMaterials } from "./render/terrainMaterials";
import { BLOCKS } from "./world/blocks";
import { EditableWorld } from "./world/editableWorld";
import { FlatWorld } from "./world/flatWorld";
import { generatePlotLayout } from "./world/plots";
import { buildSurfaceBlockMap } from "./world/surfaceBlocks";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing #app root.");

const seedWorld = new FlatWorld();
const plotLayout = generatePlotLayout(seedWorld);
const world = new FlatWorld({
  width: Math.max(1, plotLayout.bounds.maxX),
  depth: Math.max(1, plotLayout.bounds.maxZ),
  blockSize: seedWorld.blockSize,
  stoneDepth: seedWorld.stoneDepth,
  dirtDepth: seedWorld.dirtDepth,
  grassDepth: seedWorld.grassDepth
});

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

const hemisphereLight = new THREE.HemisphereLight(0xdff5ff, 0x6d5a46, 1.85);
scene.add(hemisphereLight);

const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.position.set(260, 520, 180);
scene.add(sun);

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

let controller: PlayerCameraController | null = null;
let stats: StatsOverlay | null = null;
let sky: GoodVibesSky | null = null;
let editor: BlockEditor | null = null;
let editableRenderer: EditableBlockRenderer | null = null;
let lastTime = performance.now();

const dispose = () => {
  controller?.dispose();
  editor?.dispose();
  editableRenderer?.dispose();
  stats?.dispose();
  sky?.dispose();
  window.removeEventListener("resize", onResize);
  renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
  renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);
  renderer.dispose();
};

const start = () => {
  sky = new GoodVibesSky();
  scene.add(sky.group);

  const materials = loadTerrainMaterials();
  const surfaceBlocks = buildSurfaceBlockMap(world, plotLayout);
  const editableWorld = new EditableWorld(world, surfaceBlocks.blockAt);
  const { group: terrain, stats: worldStats, setHiddenTopColumns } = buildFlatTerrain(world, materials, surfaceBlocks.rects);
  scene.add(terrain);
  const plotStats = { ...plotLayout.stats, outlineTriangles: surfaceBlocks.rects.filter((rect) => rect.blockId === BLOCKS.path).length };

  editableRenderer = new EditableBlockRenderer(world, materials);
  scene.add(editableRenderer.group);

  camera.position.set(-34, world.worldHeight() + 1.7, 54);
  const target = new THREE.Vector3(camera.position.x + 5, world.worldHeight(), camera.position.z - 5);
  controller = new PlayerCameraController(camera, renderer.domElement, world.worldHeight());
  controller.lookAt(target);

  editor = new BlockEditor({
    camera,
    domElement: renderer.domElement,
    baseWorld: world,
    editableWorld,
    editableRenderer,
    terrainGroup: terrain,
    setHiddenTopColumns
  });

  stats = new StatsOverlay(
    renderer,
    camera,
    controller,
    worldStats,
    plotStats,
    () => sky?.getState() ?? null,
    () => editor?.getState() ?? null
  );

  renderer.setAnimationLoop((time) => {
    const deltaSeconds = Math.min(0.05, (time - lastTime) / 1000);
    lastTime = time;

    controller?.update(deltaSeconds);
    const skyState = sky?.update(camera, deltaSeconds);
    if (skyState) {
      if (scene.background instanceof THREE.Color) scene.background.copy(skyState.skyColor);
      scene.fog?.color.copy(skyState.fogColor);
      sun.position.copy(skyState.sunDirection).multiplyScalar(780);
      sun.color.copy(skyState.sunColor);
      sun.intensity = skyState.sunIntensity;
      hemisphereLight.intensity = skyState.hemisphereIntensity;
      hemisphereLight.groundColor.copy(skyState.groundColor);
    }
    renderer.render(scene, camera);
    stats?.update(deltaSeconds);
  });
};

start();
window.addEventListener("beforeunload", dispose);
