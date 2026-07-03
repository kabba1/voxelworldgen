import * as THREE from "three";
import { colorForBlock, type SolidBlockId } from "../world/blocks";
import { HeightmapWorld, type HeightmapWorldStats } from "../world/heightmapWorld";

export type TerrainBuildResult = {
  group: THREE.Group;
  stats: HeightmapWorldStats;
};

type MeshBuffers = {
  positions: number[];
  colors: number[];
  indices: number[];
};

const color = new THREE.Color();
const SURFACE_SAMPLE_STEP = 8;

const worldX = (world: HeightmapWorld, x: number) => (x - world.width / 2) * world.blockSize;
const worldY = (world: HeightmapWorld, y: number) => y * world.blockSize;
const worldZ = (world: HeightmapWorld, z: number) => (z - world.depth / 2) * world.blockSize;

const clampColumnX = (world: HeightmapWorld, x: number) => Math.max(0, Math.min(world.width - 1, x));
const clampColumnZ = (world: HeightmapWorld, z: number) => Math.max(0, Math.min(world.depth - 1, z));

const sampleRange = (min: number, max: number, step: number) => {
  const samples: number[] = [];

  for (let value = min; value < max; value += step) {
    samples.push(value);
  }

  if (samples.length === 0 || samples[samples.length - 1] !== max) {
    samples.push(max);
  }

  return samples;
};

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

const pushTopSurfaceChunk = (
  group: THREE.Group,
  material: THREE.Material,
  world: HeightmapWorld,
  chunkX: number,
  chunkZ: number
) => {
  const minX = chunkX * world.chunkSize;
  const minZ = chunkZ * world.chunkSize;
  const maxX = Math.min(minX + world.chunkSize, world.width);
  const maxZ = Math.min(minZ + world.chunkSize, world.depth);
  const xSamples = sampleRange(minX, maxX, SURFACE_SAMPLE_STEP);
  const zSamples = sampleRange(minZ, maxZ, SURFACE_SAMPLE_STEP);
  const vertexWidth = xSamples.length;
  const buffers: MeshBuffers = {
    positions: [],
    colors: [],
    indices: []
  };

  for (const z of zSamples) {
    for (const x of xSamples) {
      const sampleX = clampColumnX(world, x);
      const sampleZ = clampColumnZ(world, z);
      pushVertex(buffers, world, x, world.heightAt(sampleX, sampleZ), z, world.surfaceBlockAt(sampleX, sampleZ));
    }
  }

  for (let sampleZ = 0; sampleZ < zSamples.length - 1; sampleZ += 1) {
    for (let sampleX = 0; sampleX < xSamples.length - 1; sampleX += 1) {
      const a = sampleZ * vertexWidth + sampleX;
      const b = a + 1;
      const d = a + vertexWidth;
      const c = d + 1;

      buffers.indices.push(d, c, b, d, b, a);
    }
  }

  group.add(createTerrainMesh(`heightmap-surface-${chunkX}-${chunkZ}`, buffers, material));
  return (xSamples.length - 1) * (zSamples.length - 1) * 2;
};

const materialBandsForColumn = (world: HeightmapWorld, x: number, z: number) => {
  const height = world.heightAt(x, z);
  if (height <= 0) return [];

  const surfaceStart = Math.max(0, height - 1);
  const dirtStart = Math.max(0, height - world.dirtDepth);
  const bands: Array<{ from: number; to: number; blockId: SolidBlockId }> = [];

  if (dirtStart > 0) bands.push({ from: 0, to: dirtStart, blockId: 1 });
  if (surfaceStart > dirtStart) bands.push({ from: dirtStart, to: surfaceStart, blockId: 2 });
  bands.push({ from: surfaceStart, to: height, blockId: world.surfaceBlockAt(x, z) });

  return bands;
};

const pushQuad = (buffers: MeshBuffers, world: HeightmapWorld, corners: Array<[number, number, number]>, blockId: SolidBlockId) => {
  const start = buffers.positions.length / 3;
  for (const [x, y, z] of corners) {
    pushVertex(buffers, world, x, y, z, blockId);
  }
  buffers.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
};

const pushBoundaryWalls = (group: THREE.Group, material: THREE.Material, world: HeightmapWorld) => {
  const buffers: MeshBuffers = {
    positions: [],
    colors: [],
    indices: []
  };

  for (let z = 0; z < world.depth; z += 1) {
    for (const band of materialBandsForColumn(world, 0, z)) {
      pushQuad(
        buffers,
        world,
        [
          [0, band.to, z + 1],
          [0, band.to, z],
          [0, band.from, z],
          [0, band.from, z + 1]
        ],
        band.blockId
      );
    }

    for (const band of materialBandsForColumn(world, world.width - 1, z)) {
      pushQuad(
        buffers,
        world,
        [
          [world.width, band.to, z],
          [world.width, band.to, z + 1],
          [world.width, band.from, z + 1],
          [world.width, band.from, z]
        ],
        band.blockId
      );
    }
  }

  for (let x = 0; x < world.width; x += 1) {
    for (const band of materialBandsForColumn(world, x, 0)) {
      pushQuad(
        buffers,
        world,
        [
          [x + 1, band.from, 0],
          [x, band.from, 0],
          [x, band.to, 0],
          [x + 1, band.to, 0]
        ],
        band.blockId
      );
    }

    for (const band of materialBandsForColumn(world, x, world.depth - 1)) {
      pushQuad(
        buffers,
        world,
        [
          [x, band.from, world.depth],
          [x + 1, band.from, world.depth],
          [x + 1, band.to, world.depth],
          [x, band.to, world.depth]
        ],
        band.blockId
      );
    }
  }

  group.add(createTerrainMesh("heightmap-boundary-walls", buffers, material));
};

export const buildHeightmapTerrain = (world: HeightmapWorld): TerrainBuildResult => {
  const group = new THREE.Group();
  group.name = "heightmap-terrain";

  const material = new THREE.MeshLambertMaterial({
    flatShading: true,
    vertexColors: true
  });

  const chunksX = Math.ceil(world.width / world.chunkSize);
  const chunksZ = Math.ceil(world.depth / world.chunkSize);
  let surfaceTriangles = 0;

  for (let chunkZ = 0; chunkZ < chunksZ; chunkZ += 1) {
    for (let chunkX = 0; chunkX < chunksX; chunkX += 1) {
      surfaceTriangles += pushTopSurfaceChunk(group, material, world, chunkX, chunkZ);
    }
  }

  pushBoundaryWalls(group, material, world);

  const boundaryTriangles = group.children.length > 0 ? ((group.children.at(-1) as THREE.Mesh).geometry.index?.count ?? 0) / 3 : 0;

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
      meshStep: SURFACE_SAMPLE_STEP,
      generatedChunks: world.chunkColumns,
      triangles: surfaceTriangles + boundaryTriangles,
      borderMin: world.borderMin,
      borderMax: world.borderMax
    }
  };
};
