import * as THREE from "three";
import { colorForBlock, type SolidBlockId } from "../world/blocks";
import { FlatWorld, type FlatWorldStats } from "../world/flatWorld";

type Face = {
  normal: [number, number, number];
  corners: Array<[number, number, number]>;
};

const FACES: Face[] = [
  {
    normal: [1, 0, 0],
    corners: [
      [1, 1, 0],
      [1, 1, 1],
      [1, 0, 1],
      [1, 0, 0]
    ]
  },
  {
    normal: [-1, 0, 0],
    corners: [
      [0, 1, 1],
      [0, 1, 0],
      [0, 0, 0],
      [0, 0, 1]
    ]
  },
  {
    normal: [0, 1, 0],
    corners: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0]
    ]
  },
  {
    normal: [0, -1, 0],
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1]
    ]
  },
  {
    normal: [0, 0, 1],
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1]
    ]
  },
  {
    normal: [0, 0, -1],
    corners: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0]
    ]
  }
];

const shadeForNormal = ([x, y, z]: [number, number, number]) => {
  if (y > 0) return 1;
  if (y < 0) return 0.5;
  if (x !== 0) return 0.78;
  if (z > 0) return 0.68;
  return 0.58;
};

const pushFace = (
  positions: number[],
  normals: number[],
  colors: number[],
  indices: number[],
  world: FlatWorld,
  blockId: SolidBlockId,
  blockX: number,
  blockY: number,
  blockZ: number,
  face: Face
) => {
  const size = world.blockSize;
  const originX = (blockX - world.width / 2) * size;
  const originY = blockY * size;
  const originZ = (blockZ - world.depth / 2) * size;
  const start = positions.length / 3;
  const color = new THREE.Color(colorForBlock(blockId));
  const shade = shadeForNormal(face.normal);
  color.multiplyScalar(shade);

  for (const [x, y, z] of face.corners) {
    positions.push(originX + x * size, originY + y * size, originZ + z * size);
    normals.push(face.normal[0], face.normal[1], face.normal[2]);
    colors.push(color.r, color.g, color.b);
  }

  indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
};

export type TerrainBuildResult = {
  group: THREE.Group;
  stats: FlatWorldStats;
};

export const buildFlatTerrain = (world: FlatWorld): TerrainBuildResult => {
  const group = new THREE.Group();
  group.name = "flatworld-terrain";

  const material = new THREE.MeshLambertMaterial({
    vertexColors: true
  });

  let exposedFaces = 0;
  const chunksX = Math.ceil(world.width / world.chunkSize);
  const chunksZ = Math.ceil(world.depth / world.chunkSize);

  for (let chunkZ = 0; chunkZ < chunksZ; chunkZ += 1) {
    for (let chunkX = 0; chunkX < chunksX; chunkX += 1) {
      const positions: number[] = [];
      const normals: number[] = [];
      const colors: number[] = [];
      const indices: number[] = [];
      const minX = chunkX * world.chunkSize;
      const minZ = chunkZ * world.chunkSize;
      const maxX = Math.min(minX + world.chunkSize, world.width);
      const maxZ = Math.min(minZ + world.chunkSize, world.depth);

      for (let z = minZ; z < maxZ; z += 1) {
        for (let x = minX; x < maxX; x += 1) {
          for (let y = 0; y < world.height; y += 1) {
            const blockId = world.solidBlockAt(x, y, z);
            if (!blockId) continue;

            for (const face of FACES) {
              const nx = x + face.normal[0];
              const ny = y + face.normal[1];
              const nz = z + face.normal[2];
              if (world.isSolid(nx, ny, nz)) continue;
              pushFace(positions, normals, colors, indices, world, blockId, x, y, z, face);
              exposedFaces += 1;
            }
          }
        }
      }

      if (positions.length === 0) continue;

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      geometry.setIndex(indices);
      geometry.computeBoundingSphere();

      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `terrain-chunk-${chunkX}-${chunkZ}`;
      mesh.frustumCulled = true;
      group.add(mesh);
    }
  }

  return {
    group,
    stats: {
      width: world.width,
      depth: world.depth,
      height: world.height,
      totalBlocks: world.width * world.depth * world.height,
      blockSize: world.blockSize,
      chunkSize: world.chunkSize,
      chunkColumns: world.chunkColumns,
      generatedChunks: group.children.length,
      exposedFaces,
      triangles: exposedFaces * 2
    }
  };
};
