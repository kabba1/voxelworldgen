import * as THREE from "three";
import "./styles.css";
import { installBlueprintDevTools } from "./dev/blueprintDevTools";
import { StatsOverlay } from "./diagnostics/StatsOverlay";
import { BlockEditor } from "./input/BlockEditor";
import { PlayerCameraController } from "./input/PlayerCameraController";
import { PlotInspector } from "./input/PlotInspector";
import { EditableBlockRenderer } from "./render/editableBlocks";
import { StructureRenderer } from "./render/structureRenderer";
import { GoodVibesSky } from "./render/skybox";
import { buildFlatTerrain } from "./render/terrainMesh";
import { loadTerrainMaterials } from "./render/terrainMaterials";
import { BLOCKS } from "./world/blocks";
import { EditableWorld } from "./world/editableWorld";
import { FlatWorld } from "./world/flatWorld";
import { PlotWorld } from "./world/plotWorld";
import { generatePlotLayout } from "./world/plots";
import {
  createStartingStructureInstances,
  rotatedFootprint,
  STRUCTURE_DEFINITIONS_BY_ID
} from "./world/structures";
import { buildSurfaceBlockMap } from "./world/surfaceBlocks";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing #app root.");

const VIEWER_AGENT_ID = "local-player";
const PLAYER_EYE_HEIGHT_BLOCKS = 1.62;
const IS_DEV = ((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV ?? false);
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
const startingStructures = createStartingStructureInstances(world);
const structuresByPlotId = new Map<string, typeof startingStructures>();
for (const instance of startingStructures) {
  const plotStructures = structuresByPlotId.get(instance.plotId) ?? [];
  plotStructures.push(instance);
  structuresByPlotId.set(instance.plotId, plotStructures);
}
const starterTownCenter = (() => {
  let totalX = 0;
  let totalZ = 0;
  let count = 0;

  for (const instance of startingStructures) {
    const definition = STRUCTURE_DEFINITIONS_BY_ID[instance.definitionId];
    if (!definition) continue;
    const footprint = rotatedFootprint(definition, instance.rotation);
    totalX += instance.x + footprint.width / 2;
    totalZ += instance.z + footprint.depth / 2;
    count += 1;
  }

  return count > 0
    ? { x: totalX / count, z: totalZ / count }
    : { x: world.width / 2, z: world.depth / 2 };
})();
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
let structureRenderer: StructureRenderer | null = null;
let plotInspector: PlotInspector | null = null;
let disposeBlueprintDevTools: (() => void) | null = null;
let blockPalette: { update: () => void; dispose: () => void } | null = null;
let disposed = false;
let lastTime = performance.now();

const dispose = () => {
  disposed = true;
  controller?.dispose();
  editor?.dispose();
  plotInspector?.dispose();
  structureRenderer?.dispose();
  editableRenderer?.dispose();
  disposeBlueprintDevTools?.();
  blockPalette?.dispose();
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
  const surfaceBlocks = buildSurfaceBlockMap(world);
  const editableWorld = new EditableWorld(world, surfaceBlocks.blockAt);
  const { group: terrain, stats: worldStats, setHiddenTopColumns } = buildFlatTerrain(world, materials, surfaceBlocks.rects);
  scene.add(terrain);
  const plotStats = { ...plotLayout.stats, outlineTriangles: surfaceBlocks.rects.filter((rect) => rect.blockId === BLOCKS.path).length };

  editableRenderer = new EditableBlockRenderer(world, materials);
  scene.add(editableRenderer.group);
  structureRenderer = new StructureRenderer(world, STRUCTURE_DEFINITIONS_BY_ID);
  structureRenderer.setInstances(startingStructures);
  scene.add(structureRenderer.group);
  plotInspector = new PlotInspector({
    camera,
    domElement: renderer.domElement,
    terrainGroup: terrain,
    world,
    viewerAgentId: VIEWER_AGENT_ID,
    structureNameForPlot: (plotId) => {
      const instances = structuresByPlotId.get(plotId) ?? [];
      const names = instances.flatMap((instance) => {
        const definitionName = STRUCTURE_DEFINITIONS_BY_ID[instance.definitionId]?.name;
        return definitionName ? [definitionName] : [];
      });
      return names.length > 0 ? names.join(", ") : null;
    }
  });
  scene.add(plotInspector.group);

  camera.position.set(
    worldBlockX(starterTownCenter.x - 18),
    world.worldHeight() + playerEyeHeight,
    worldBlockZ(starterTownCenter.z + 24)
  );
  const target = new THREE.Vector3(
    worldBlockX(starterTownCenter.x),
    world.worldHeight() + 0.8,
    worldBlockZ(starterTownCenter.z)
  );
  controller = new PlayerCameraController(camera, renderer.domElement, world.worldHeight(), playerEyeHeight);
  controller.lookAt(target);

  editor = new BlockEditor({
    camera,
    domElement: renderer.domElement,
    baseWorld: world,
    editableWorld,
    editableRenderer,
    terrainGroup: terrain,
    setHiddenTopColumns,
    inspectTerrainColumn: (x, z) => plotInspector?.inspectColumn(x, z) ?? false,
    canEditColumn: (x, z) => world.canBuild(VIEWER_AGENT_ID, x, z)
  });
  scene.add(editor.group);
  disposeBlueprintDevTools = installBlueprintDevTools({ editableWorld });
  if (IS_DEV) {
    void import("./dev/blockPaletteOverlay").then(({ BlockPaletteOverlay }) => {
      if (disposed || !editor) return;
      blockPalette = new BlockPaletteOverlay({ editor });
    });
  }

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
    editor?.update();
    blockPalette?.update();
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
