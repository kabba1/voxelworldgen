import * as THREE from "three";
import { BLOCKS, type SolidBlockId } from "../world/blocks";
import { FlatWorld, type FlatWorldStats } from "../world/flatWorld";
import type { SurfaceBlockRect } from "../world/surfaceBlocks";
import type { TerrainMaterials } from "./terrainMaterials";

export type TerrainBuildResult = {
  group: THREE.Group;
  stats: FlatWorldStats;
  setHiddenTopColumns: (hiddenColumns: ReadonlySet<string>) => void;
};

type MeshBuffers = {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
};

type Normal = [number, number, number];
type Vertex = [x: number, y: number, z: number, u: number, v: number];

const SURFACE_CELL_BLOCKS = 64;
const FOOTPRINT_CELL_BLOCKS = 1;

const worldX = (world: FlatWorld, x: number) => (x - world.width / 2) * world.blockSize;
const worldY = (world: FlatWorld, y: number) => y * world.blockSize;
const worldZ = (world: FlatWorld, z: number) => (z - world.depth / 2) * world.blockSize;

const createBuffers = (): MeshBuffers => ({
  positions: [],
  normals: [],
  uvs: [],
  indices: []
});

const pushVertex = (buffers: MeshBuffers, world: FlatWorld, vertex: Vertex, normal: Normal) => {
  const [x, y, z, u, v] = vertex;
  buffers.positions.push(worldX(world, x), worldY(world, y), worldZ(world, z));
  buffers.normals.push(normal[0], normal[1], normal[2]);
  buffers.uvs.push(u, v);
};

const pushQuad = (buffers: MeshBuffers, world: FlatWorld, corners: Vertex[], normal: Normal) => {
  const start = buffers.positions.length / 3;
  for (const corner of corners) pushVertex(buffers, world, corner, normal);
  buffers.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
};

const createTerrainMesh = (name: string, buffers: MeshBuffers, material: THREE.Material) => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(buffers.positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(buffers.normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(buffers.uvs, 2));
  geometry.setIndex(buffers.indices);
  geometry.computeBoundingSphere();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.frustumCulled = false;
  return mesh;
};

const replaceMeshGeometry = (mesh: THREE.Mesh, buffers: MeshBuffers) => {
  mesh.geometry.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(buffers.positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(buffers.normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(buffers.uvs, 2));
  geometry.setIndex(buffers.indices);
  geometry.computeBoundingSphere();
  mesh.geometry = geometry;
};

const cellKey = (x: number, z: number) => `${x},${z}`;

const hasHiddenColumnInRect = (hiddenColumns: ReadonlySet<string>, x0: number, z0: number, x1: number, z1: number) => {
  if (hiddenColumns.size === 0) return false;
  for (const key of hiddenColumns) {
    const [xRaw, zRaw] = key.split(",");
    const x = Number(xRaw);
    const z = Number(zRaw);
    if (x >= x0 && x < x1 && z >= z0 && z < z1) return true;
  }
  return false;
};

const pushTopRect = (
  buffers: MeshBuffers,
  world: FlatWorld,
  x0: number,
  z0: number,
  x1: number,
  z1: number
) => {
  const y = world.height;

  pushQuad(
    buffers,
    world,
    [
      [x0, y, z1, x0, z1],
      [x1, y, z1, x1, z1],
      [x1, y, z0, x1, z0],
      [x0, y, z0, x0, z0]
    ],
    [0, 1, 0]
  );
};

const pushSurfaceCell = (
  buffers: MeshBuffers,
  world: FlatWorld,
  hiddenColumns: ReadonlySet<string>,
  x0: number,
  z0: number,
  x1: number,
  z1: number
) => {
  if (!hasHiddenColumnInRect(hiddenColumns, x0, z0, x1, z1)) {
    pushTopRect(buffers, world, x0, z0, x1, z1);
    return;
  }

  for (let blockZ = z0; blockZ < z1; blockZ += 1) {
    for (let blockX = x0; blockX < x1; blockX += 1) {
      if (!hiddenColumns.has(cellKey(blockX, blockZ))) pushTopRect(buffers, world, blockX, blockZ, blockX + 1, blockZ + 1);
    }
  }
};

const pushSurfaceRect = (
  buffers: MeshBuffers,
  world: FlatWorld,
  hiddenColumns: ReadonlySet<string>,
  rect: SurfaceBlockRect
) => {
  for (let z = rect.z0; z < rect.z1; z += SURFACE_CELL_BLOCKS) {
    const z1 = Math.min(rect.z1, z + SURFACE_CELL_BLOCKS);
    for (let x = rect.x0; x < rect.x1; x += SURFACE_CELL_BLOCKS) {
      const x1 = Math.min(rect.x1, x + SURFACE_CELL_BLOCKS);
      pushSurfaceCell(buffers, world, hiddenColumns, x, z, x1, z1);
    }
  }
};

const pushWorldTop = (
  buffersByBlock: Map<SolidBlockId, MeshBuffers>,
  world: FlatWorld,
  hiddenColumns: ReadonlySet<string>,
  surfaceRects: SurfaceBlockRect[]
) => {
  for (const rect of surfaceRects) {
    const buffers = buffersByBlock.get(rect.blockId);
    if (buffers) pushSurfaceRect(buffers, world, hiddenColumns, rect);
  }
};

const pushLayeredSide = (
  buffers: MeshBuffers,
  world: FlatWorld,
  side: "east" | "west" | "south" | "north",
  from: number,
  to: number
) => {
  switch (side) {
    case "east":
      pushQuad(
        buffers,
        world,
        [
          [world.width, to, 0, 0, to],
          [world.width, to, world.depth, world.depth, to],
          [world.width, from, world.depth, world.depth, from],
          [world.width, from, 0, 0, from]
        ],
        [1, 0, 0]
      );
      break;
    case "west":
      pushQuad(
        buffers,
        world,
        [
          [0, to, world.depth, world.depth, to],
          [0, to, 0, 0, to],
          [0, from, 0, 0, from],
          [0, from, world.depth, world.depth, from]
        ],
        [-1, 0, 0]
      );
      break;
    case "south":
      pushQuad(
        buffers,
        world,
        [
          [0, from, world.depth, 0, from],
          [world.width, from, world.depth, world.width, from],
          [world.width, to, world.depth, world.width, to],
          [0, to, world.depth, 0, to]
        ],
        [0, 0, 1]
      );
      break;
    case "north":
      pushQuad(
        buffers,
        world,
        [
          [world.width, from, 0, world.width, from],
          [0, from, 0, 0, from],
          [0, to, 0, 0, to],
          [world.width, to, 0, world.width, to]
        ],
        [0, 0, -1]
      );
      break;
  }
};

const pushVerticalSide = (
  buffers: MeshBuffers,
  world: FlatWorld,
  normal: Normal,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  from: number,
  to: number
) => {
  if (normal[0] > 0) {
    pushQuad(
      buffers,
      world,
      [
        [x0, to, z0, z0, to],
        [x0, to, z1, z1, to],
        [x0, from, z1, z1, from],
        [x0, from, z0, z0, from]
      ],
      normal
    );
    return;
  }

  if (normal[0] < 0) {
    pushQuad(
      buffers,
      world,
      [
        [x0, to, z1, z1, to],
        [x0, to, z0, z0, to],
        [x0, from, z0, z0, from],
        [x0, from, z1, z1, from]
      ],
      normal
    );
    return;
  }

  if (normal[2] > 0) {
    pushQuad(
      buffers,
      world,
      [
        [x0, from, z0, x0, from],
        [x1, from, z0, x1, from],
        [x1, to, z0, x1, to],
        [x0, to, z0, x0, to]
      ],
      normal
    );
    return;
  }

  pushQuad(
    buffers,
    world,
    [
      [x1, from, z0, x1, from],
      [x0, from, z0, x0, from],
      [x0, to, z0, x0, to],
      [x1, to, z0, x1, to]
    ],
    normal
  );
};

type FootprintGrid = {
  columns: number;
  rows: number;
  occupied: Uint8Array;
};

const buildFootprintGrid = (world: FlatWorld, surfaceRects: SurfaceBlockRect[]): FootprintGrid => {
  const columns = Math.ceil(world.width / FOOTPRINT_CELL_BLOCKS);
  const rows = Math.ceil(world.depth / FOOTPRINT_CELL_BLOCKS);
  const occupied = new Uint8Array(columns * rows);

  for (const rect of surfaceRects) {
    const x0 = Math.max(0, Math.floor(rect.x0 / FOOTPRINT_CELL_BLOCKS));
    const z0 = Math.max(0, Math.floor(rect.z0 / FOOTPRINT_CELL_BLOCKS));
    const x1 = Math.min(columns, Math.ceil(rect.x1 / FOOTPRINT_CELL_BLOCKS));
    const z1 = Math.min(rows, Math.ceil(rect.z1 / FOOTPRINT_CELL_BLOCKS));

    for (let z = z0; z < z1; z += 1) {
      const rowOffset = z * columns;
      for (let x = x0; x < x1; x += 1) {
        occupied[rowOffset + x] = 1;
      }
    }
  }

  return { columns, rows, occupied };
};

const footprintOccupied = (grid: FootprintGrid, x: number, z: number) =>
  x >= 0 && x < grid.columns && z >= 0 && z < grid.rows && grid.occupied[z * grid.columns + x] === 1;

const pushVerticalBoundaryRuns = (
  buffers: MeshBuffers,
  world: FlatWorld,
  grid: FootprintGrid,
  from: number,
  to: number
) => {
  for (let x = 0; x <= grid.columns; x += 1) {
    let runStart: number | null = null;
    let runNormal: Normal | null = null;

    const flush = (z: number) => {
      if (runStart === null || runNormal === null) return;
      const xBlock = Math.min(world.width, x * FOOTPRINT_CELL_BLOCKS);
      const z0 = Math.min(world.depth, runStart * FOOTPRINT_CELL_BLOCKS);
      const z1 = Math.min(world.depth, z * FOOTPRINT_CELL_BLOCKS);
      pushVerticalSide(buffers, world, runNormal, xBlock, z0, xBlock, z1, from, to);
      runStart = null;
      runNormal = null;
    };

    for (let z = 0; z < grid.rows; z += 1) {
      const left = footprintOccupied(grid, x - 1, z);
      const right = footprintOccupied(grid, x, z);
      const normal: Normal | null = right && !left ? [-1, 0, 0] : left && !right ? [1, 0, 0] : null;

      if (!normal) {
        flush(z);
        continue;
      }

      if (runNormal && runNormal[0] === normal[0] && runStart !== null) continue;

      flush(z);
      runStart = z;
      runNormal = normal;
    }

    flush(grid.rows);
  }
};

const pushHorizontalBoundaryRuns = (
  buffers: MeshBuffers,
  world: FlatWorld,
  grid: FootprintGrid,
  from: number,
  to: number
) => {
  for (let z = 0; z <= grid.rows; z += 1) {
    let runStart: number | null = null;
    let runNormal: Normal | null = null;

    const flush = (x: number) => {
      if (runStart === null || runNormal === null) return;
      const x0 = Math.min(world.width, runStart * FOOTPRINT_CELL_BLOCKS);
      const x1 = Math.min(world.width, x * FOOTPRINT_CELL_BLOCKS);
      const zBlock = Math.min(world.depth, z * FOOTPRINT_CELL_BLOCKS);
      pushVerticalSide(buffers, world, runNormal, x0, zBlock, x1, zBlock, from, to);
      runStart = null;
      runNormal = null;
    };

    for (let x = 0; x < grid.columns; x += 1) {
      const north = footprintOccupied(grid, x, z - 1);
      const south = footprintOccupied(grid, x, z);
      const normal: Normal | null = south && !north ? [0, 0, -1] : north && !south ? [0, 0, 1] : null;

      if (!normal) {
        flush(x);
        continue;
      }

      if (runNormal && runNormal[2] === normal[2] && runStart !== null) continue;

      flush(x);
      runStart = x;
      runNormal = normal;
    }

    flush(grid.columns);
  }
};

const pushFootprintSideLayer = (
  buffers: MeshBuffers,
  world: FlatWorld,
  surfaceRects: SurfaceBlockRect[],
  from: number,
  to: number
) => {
  if (surfaceRects.length === 0) {
    for (const side of ["east", "west", "south", "north"] as const) {
      pushLayeredSide(buffers, world, side, from, to);
    }
    return;
  }

  const grid = buildFootprintGrid(world, surfaceRects);
  pushVerticalBoundaryRuns(buffers, world, grid, from, to);
  pushHorizontalBoundaryRuns(buffers, world, grid, from, to);
};

const makeDefaultSurfaceRects = (world: FlatWorld): SurfaceBlockRect[] => [
  { x0: 0, z0: 0, x1: world.width, z1: world.depth, blockId: BLOCKS.grass }
];

export const buildFlatTerrain = (
  world: FlatWorld,
  materials: TerrainMaterials,
  surfaceRects: SurfaceBlockRect[] = makeDefaultSurfaceRects(world)
): TerrainBuildResult => {
  const group = new THREE.Group();
  group.name = "flatworld-terrain";

  const topBuffers = new Map<SolidBlockId, MeshBuffers>([
    [BLOCKS.grass, createBuffers()],
    [BLOCKS.path, createBuffers()]
  ]);
  const dirtSides = createBuffers();
  const stoneSides = createBuffers();

  pushWorldTop(topBuffers, world, new Set(), surfaceRects);
  pushFootprintSideLayer(stoneSides, world, surfaceRects, 0, world.stoneDepth);
  pushFootprintSideLayer(dirtSides, world, surfaceRects, world.stoneDepth, world.height);

  const grassTop = topBuffers.get(BLOCKS.grass) ?? createBuffers();
  const pathTop = topBuffers.get(BLOCKS.path) ?? createBuffers();
  const grassMesh = createTerrainMesh("grass-top", grassTop, materials[BLOCKS.grass]);
  const pathMesh = createTerrainMesh("path-top", pathTop, materials[BLOCKS.path]);
  group.add(grassMesh);
  group.add(pathMesh);
  group.add(createTerrainMesh("dirt-side-layer", dirtSides, materials[BLOCKS.dirt]));
  group.add(createTerrainMesh("stone-side-layer", stoneSides, materials[BLOCKS.stone]));

  const triangles = (grassTop.indices.length + pathTop.indices.length + dirtSides.indices.length + stoneSides.indices.length) / 3;

  return {
    group,
    setHiddenTopColumns: (hiddenColumns) => {
      const replacements = new Map<SolidBlockId, MeshBuffers>([
        [BLOCKS.grass, createBuffers()],
        [BLOCKS.path, createBuffers()]
      ]);
      pushWorldTop(replacements, world, hiddenColumns, surfaceRects);
      replaceMeshGeometry(grassMesh, replacements.get(BLOCKS.grass) ?? createBuffers());
      replaceMeshGeometry(pathMesh, replacements.get(BLOCKS.path) ?? createBuffers());
    },
    stats: {
      width: world.width,
      depth: world.depth,
      blockSize: world.blockSize,
      stoneDepth: world.stoneDepth,
      dirtDepth: world.dirtDepth,
      grassDepth: world.grassDepth,
      height: world.height,
      borderMin: world.borderMin,
      borderMax: world.borderMax,
      meshMode: "flat textured",
      generatedChunks: group.children.length,
      chunkColumns: 1,
      triangles
    }
  };
};
