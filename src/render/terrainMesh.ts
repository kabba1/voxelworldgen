import * as THREE from "three";
import { BLOCKS, colorForBlock, type SolidBlockId } from "../world/blocks";
import { HeightmapWorld, type HeightmapWorldStats } from "../world/heightmapWorld";

export type TerrainBuildResult = {
  group: THREE.Group;
  stats: HeightmapWorldStats;
};

export type TerrainMeshOptions = {
  meshStep?: number;
  meshMode?: string;
};

type MeshBuffers = {
  positions: number[];
  colors: number[];
  indices: number[];
};

const color = new THREE.Color();
export const DEFAULT_MESH_SAMPLE_STEP = 8;
const ALLOWED_MESH_SAMPLE_STEPS = new Set([1, 2, 4, 8]);

const worldX = (world: HeightmapWorld, x: number) => (x - world.width / 2) * world.blockSize;
const worldY = (world: HeightmapWorld, y: number) => y * world.blockSize;
const worldZ = (world: HeightmapWorld, z: number) => (z - world.depth / 2) * world.blockSize;

const clampColumnX = (world: HeightmapWorld, x: number) => Math.max(0, Math.min(world.width - 1, x));
const clampColumnZ = (world: HeightmapWorld, z: number) => Math.max(0, Math.min(world.depth - 1, z));

const pushVertex = (buffers: MeshBuffers, world: HeightmapWorld, x: number, y: number, z: number, blockId: SolidBlockId) => {
  buffers.positions.push(worldX(world, x), worldY(world, y), worldZ(world, z));
  color.set(colorForBlock(blockId));
  buffers.colors.push(color.r, color.g, color.b);
};

const createTerrainMesh = (name: string, buffers: MeshBuffers, material: THREE.Material) => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(buffers.positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(buffers.colors, 3));
  geometry.setIndex(buffers.indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.frustumCulled = true;
  return mesh;
};

const materialBandsForColumn = (world: HeightmapWorld, x: number, z: number) => {
  const height = world.heightAt(x, z);
  if (height <= 0) return [];

  const surfaceStart = Math.max(0, height - 1);
  const dirtStart = Math.max(0, height - world.dirtDepth);
  const bands: Array<{ from: number; to: number; blockId: SolidBlockId }> = [];

  if (dirtStart > 0) bands.push({ from: 0, to: dirtStart, blockId: BLOCKS.stone });
  if (surfaceStart > dirtStart) bands.push({ from: dirtStart, to: surfaceStart, blockId: BLOCKS.dirt });
  bands.push({ from: surfaceStart, to: height, blockId: world.surfaceBlockAt(x, z) });

  return bands;
};

const materialBandsForRange = (world: HeightmapWorld, x: number, z: number, from: number, to: number) =>
  materialBandsForColumn(world, x, z)
    .map((band) => ({
      from: Math.max(from, band.from),
      to: Math.min(to, band.to),
      blockId: band.blockId
    }))
    .filter((band) => band.to > band.from);

const pushQuad = (buffers: MeshBuffers, world: HeightmapWorld, corners: Array<[number, number, number]>, blockId: SolidBlockId) => {
  const start = buffers.positions.length / 3;
  for (const [x, y, z] of corners) {
    pushVertex(buffers, world, x, y, z, blockId);
  }
  buffers.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
};

const sampledHeightAt = (world: HeightmapWorld, x: number, z: number) => {
  if (x < 0 || x >= world.width || z < 0 || z >= world.depth) return 0;
  return world.heightAt(clampColumnX(world, x), clampColumnZ(world, z));
};

const pushTopFace = (
  buffers: MeshBuffers,
  world: HeightmapWorld,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  height: number,
  blockId: SolidBlockId
) => {
  if (height <= 0) return 0;

  pushQuad(
    buffers,
    world,
    [
      [x0, height, z1],
      [x1, height, z1],
      [x1, height, z0],
      [x0, height, z0]
    ],
    blockId
  );

  return 2;
};

type SideDirection = "east" | "west" | "south" | "north";

const pushSideFace = (
  buffers: MeshBuffers,
  world: HeightmapWorld,
  direction: SideDirection,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  from: number,
  to: number,
  blockId: SolidBlockId
) => {
  switch (direction) {
    case "east":
      pushQuad(buffers, world, [[x1, to, z0], [x1, to, z1], [x1, from, z1], [x1, from, z0]], blockId);
      break;
    case "west":
      pushQuad(buffers, world, [[x0, to, z1], [x0, to, z0], [x0, from, z0], [x0, from, z1]], blockId);
      break;
    case "south":
      pushQuad(buffers, world, [[x0, from, z1], [x1, from, z1], [x1, to, z1], [x0, to, z1]], blockId);
      break;
    case "north":
      pushQuad(buffers, world, [[x1, from, z0], [x0, from, z0], [x0, to, z0], [x1, to, z0]], blockId);
      break;
  }
};

const pushColumnSide = (
  buffers: MeshBuffers,
  world: HeightmapWorld,
  direction: SideDirection,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  columnX: number,
  columnZ: number,
  neighborHeight: number,
  columnHeight: number
) => {
  if (columnHeight <= neighborHeight) return 0;

  let triangles = 0;
  for (const band of materialBandsForRange(world, columnX, columnZ, neighborHeight, columnHeight)) {
    pushSideFace(buffers, world, direction, x0, x1, z0, z1, band.from, band.to, band.blockId);
    triangles += 2;
  }

  return triangles;
};

const pushHeightmapChunk = (
  group: THREE.Group,
  material: THREE.Material,
  world: HeightmapWorld,
  chunkX: number,
  chunkZ: number,
  meshStep: number
) => {
  const minX = chunkX * world.chunkSize;
  const minZ = chunkZ * world.chunkSize;
  const maxX = Math.min(minX + world.chunkSize, world.width);
  const maxZ = Math.min(minZ + world.chunkSize, world.depth);
  const buffers: MeshBuffers = {
    positions: [],
    colors: [],
    indices: []
  };
  let triangles = 0;

  for (let z = minZ; z < maxZ; z += meshStep) {
    for (let x = minX; x < maxX; x += meshStep) {
      const x1 = Math.min(x + meshStep, world.width);
      const z1 = Math.min(z + meshStep, world.depth);
      const columnX = clampColumnX(world, x);
      const columnZ = clampColumnZ(world, z);
      const columnHeight = world.heightAt(columnX, columnZ);

      triangles += pushTopFace(buffers, world, x, x1, z, z1, columnHeight, world.surfaceBlockAt(columnX, columnZ));
      triangles += pushColumnSide(buffers, world, "east", x, x1, z, z1, columnX, columnZ, sampledHeightAt(world, x1, z), columnHeight);
      triangles += pushColumnSide(buffers, world, "west", x, x1, z, z1, columnX, columnZ, sampledHeightAt(world, x - meshStep, z), columnHeight);
      triangles += pushColumnSide(buffers, world, "south", x, x1, z, z1, columnX, columnZ, sampledHeightAt(world, x, z1), columnHeight);
      triangles += pushColumnSide(buffers, world, "north", x, x1, z, z1, columnX, columnZ, sampledHeightAt(world, x, z - meshStep), columnHeight);
    }
  }

  if (buffers.positions.length > 0) {
    group.add(createTerrainMesh(`heightmap-chunk-${chunkX}-${chunkZ}`, buffers, material));
  }

  return triangles;
};

const sanitizeMeshStep = (meshStep = DEFAULT_MESH_SAMPLE_STEP) => {
  if (ALLOWED_MESH_SAMPLE_STEPS.has(meshStep)) return meshStep;
  console.warn(`Unsupported terrain mesh step "${meshStep}". Falling back to ${DEFAULT_MESH_SAMPLE_STEP}.`);
  return DEFAULT_MESH_SAMPLE_STEP;
};

export const buildHeightmapTerrain = (world: HeightmapWorld, options: TerrainMeshOptions = {}): TerrainBuildResult => {
  const group = new THREE.Group();
  group.name = "heightmap-terrain";
  const meshStep = sanitizeMeshStep(options.meshStep);

  const material = new THREE.MeshLambertMaterial({
    flatShading: true,
    vertexColors: true
  });

  const chunksX = Math.ceil(world.width / world.chunkSize);
  const chunksZ = Math.ceil(world.depth / world.chunkSize);
  let terrainTriangles = 0;

  for (let chunkZ = 0; chunkZ < chunksZ; chunkZ += 1) {
    for (let chunkX = 0; chunkX < chunksX; chunkX += 1) {
      terrainTriangles += pushHeightmapChunk(group, material, world, chunkX, chunkZ, meshStep);
    }
  }

  return {
    group,
    stats: {
      heightmapSourceWidth: world.heightmapSourceWidth,
      heightmapSourceHeight: world.heightmapSourceHeight,
      heightmapWidth: world.width,
      heightmapDepth: world.depth,
      loadedFrom: world.loadedFrom,
      usedFallback: world.usedFallback,
      width: world.width,
      depth: world.depth,
      maxTerrainHeight: world.maxTerrainHeight,
      blockSize: world.blockSize,
      chunkSize: world.chunkSize,
      chunkColumns: world.chunkColumns,
      meshStep,
      meshMode: options.meshMode ?? "preview",
      generatedChunks: group.children.length,
      triangles: terrainTriangles,
      borderMin: world.borderMin,
      borderMax: world.borderMax
    }
  };
};
