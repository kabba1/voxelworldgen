import * as THREE from "three";
import { BLOCKS, colorForBlock, type SolidBlockId } from "../world/blocks";
import { FlatWorld, type FlatWorldStats } from "../world/flatWorld";

export type TerrainBuildResult = {
  group: THREE.Group;
  stats: FlatWorldStats;
};

type MeshBuffers = {
  positions: number[];
  normals: number[];
  colors: number[];
  indices: number[];
};

type Normal = [number, number, number];

const color = new THREE.Color();

const worldX = (world: FlatWorld, x: number) => (x - world.width / 2) * world.blockSize;
const worldY = (world: FlatWorld, y: number) => y * world.blockSize;
const worldZ = (world: FlatWorld, z: number) => (z - world.depth / 2) * world.blockSize;

const pushVertex = (
  buffers: MeshBuffers,
  world: FlatWorld,
  x: number,
  y: number,
  z: number,
  blockId: SolidBlockId,
  normal: Normal
) => {
  buffers.positions.push(worldX(world, x), worldY(world, y), worldZ(world, z));
  buffers.normals.push(normal[0], normal[1], normal[2]);
  color.set(colorForBlock(blockId));
  buffers.colors.push(color.r, color.g, color.b);
};

const pushQuad = (
  buffers: MeshBuffers,
  world: FlatWorld,
  corners: Array<[number, number, number]>,
  blockId: SolidBlockId,
  normal: Normal
) => {
  const start = buffers.positions.length / 3;
  for (const [x, y, z] of corners) {
    pushVertex(buffers, world, x, y, z, blockId, normal);
  }
  buffers.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
};

const pushWorldTop = (buffers: MeshBuffers, world: FlatWorld) => {
  const y = world.height;
  pushQuad(
    buffers,
    world,
    [
      [0, y, world.depth],
      [world.width, y, world.depth],
      [world.width, y, 0],
      [0, y, 0]
    ],
    BLOCKS.grass,
    [0, 1, 0]
  );
};

const pushLayeredSide = (
  buffers: MeshBuffers,
  world: FlatWorld,
  side: "east" | "west" | "south" | "north",
  from: number,
  to: number,
  blockId: SolidBlockId
) => {
  switch (side) {
    case "east":
      pushQuad(
        buffers,
        world,
        [
          [world.width, to, 0],
          [world.width, to, world.depth],
          [world.width, from, world.depth],
          [world.width, from, 0]
        ],
        blockId,
        [1, 0, 0]
      );
      break;
    case "west":
      pushQuad(
        buffers,
        world,
        [
          [0, to, world.depth],
          [0, to, 0],
          [0, from, 0],
          [0, from, world.depth]
        ],
        blockId,
        [-1, 0, 0]
      );
      break;
    case "south":
      pushQuad(
        buffers,
        world,
        [
          [0, from, world.depth],
          [world.width, from, world.depth],
          [world.width, to, world.depth],
          [0, to, world.depth]
        ],
        blockId,
        [0, 0, 1]
      );
      break;
    case "north":
      pushQuad(
        buffers,
        world,
        [
          [world.width, from, 0],
          [0, from, 0],
          [0, to, 0],
          [world.width, to, 0]
        ],
        blockId,
        [0, 0, -1]
      );
      break;
  }
};

const pushWorldSides = (buffers: MeshBuffers, world: FlatWorld) => {
  const layers: Array<{ from: number; to: number; blockId: SolidBlockId }> = [
    { from: 0, to: world.stoneDepth, blockId: BLOCKS.stone },
    { from: world.stoneDepth, to: world.stoneDepth + world.dirtDepth, blockId: BLOCKS.dirt },
    { from: world.stoneDepth + world.dirtDepth, to: world.height, blockId: BLOCKS.grass }
  ];

  for (const side of ["east", "west", "south", "north"] as const) {
    for (const layer of layers) {
      pushLayeredSide(buffers, world, side, layer.from, layer.to, layer.blockId);
    }
  }
};

const createTerrainMesh = (buffers: MeshBuffers, material: THREE.Material) => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(buffers.positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(buffers.normals, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(buffers.colors, 3));
  geometry.setIndex(buffers.indices);
  geometry.computeBoundingSphere();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "flatworld-terrain";
  mesh.frustumCulled = false;
  return mesh;
};

export const buildFlatTerrain = (world: FlatWorld): TerrainBuildResult => {
  const group = new THREE.Group();
  group.name = "flatworld-terrain";

  const material = new THREE.MeshLambertMaterial({
    flatShading: true,
    vertexColors: true
  });
  const buffers: MeshBuffers = {
    positions: [],
    normals: [],
    colors: [],
    indices: []
  };

  pushWorldTop(buffers, world);
  pushWorldSides(buffers, world);
  group.add(createTerrainMesh(buffers, material));

  return {
    group,
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
      meshMode: "flat optimized",
      generatedChunks: group.children.length,
      chunkColumns: 1,
      triangles: buffers.indices.length / 3
    }
  };
};
