import * as THREE from "three";
import { BLOCKS, type SolidBlockId } from "../world/blocks";
import { blockKey, type BlockPosition, EditableWorld } from "../world/editableWorld";
import type { FlatWorld } from "../world/flatWorld";
import type { TerrainMaterials } from "./terrainMaterials";

export type EditFaceTarget = {
  block: BlockPosition;
  normal: BlockPosition;
  blockId: SolidBlockId;
};

type MeshBuffers = {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
  targets: EditFaceTarget[];
};

type Face = {
  normal: BlockPosition;
  corners: Array<[x: number, y: number, z: number]>;
};

const FACES: Face[] = [
  { normal: { x: 0, y: 1, z: 0 }, corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { normal: { x: 0, y: -1, z: 0 }, corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { normal: { x: 1, y: 0, z: 0 }, corners: [[1, 1, 0], [1, 1, 1], [1, 0, 1], [1, 0, 0]] },
  { normal: { x: -1, y: 0, z: 0 }, corners: [[0, 1, 1], [0, 1, 0], [0, 0, 0], [0, 0, 1]] },
  { normal: { x: 0, y: 0, z: 1 }, corners: [[1, 1, 1], [0, 1, 1], [0, 0, 1], [1, 0, 1]] },
  { normal: { x: 0, y: 0, z: -1 }, corners: [[0, 1, 0], [1, 1, 0], [1, 0, 0], [0, 0, 0]] }
];

const createBuffers = (): MeshBuffers => ({
  positions: [],
  normals: [],
  uvs: [],
  indices: [],
  targets: []
});

const worldX = (world: FlatWorld, x: number) => (x - world.width / 2) * world.blockSize;
const worldY = (world: FlatWorld, y: number) => y * world.blockSize;
const worldZ = (world: FlatWorld, z: number) => (z - world.depth / 2) * world.blockSize;

const addCandidate = (candidates: Set<string>, world: EditableWorld, x: number, y: number, z: number) => {
  if (world.solidBlockAt(x, y, z)) candidates.add(blockKey(x, y, z));
};

const buildCandidateBlocks = (baseWorld: FlatWorld, world: EditableWorld) => {
  const candidates = new Set<string>();

  for (const override of world.overridesList()) {
    if (override.block !== BLOCKS.air) {
      candidates.add(blockKey(override.x, override.y, override.z));
      continue;
    }

    for (let y = override.y - 1; y >= 0; y -= 1) {
      if (world.solidBlockAt(override.x, y, override.z)) {
        candidates.add(blockKey(override.x, y, override.z));
        break;
      }
    }

    addCandidate(candidates, world, override.x + 1, override.y, override.z);
    addCandidate(candidates, world, override.x - 1, override.y, override.z);
    addCandidate(candidates, world, override.x, override.y, override.z + 1);
    addCandidate(candidates, world, override.x, override.y, override.z - 1);
  }

  return [...candidates].map((key) => {
    const [x, y, z] = key.split(",").map(Number);
    return { x, y, z, isOverride: world.hasOverride(x, y, z), isBaseTop: y === baseWorld.height - 1 };
  });
};

const pushFace = (
  buffers: MeshBuffers,
  world: FlatWorld,
  block: BlockPosition,
  blockId: SolidBlockId,
  face: Face
) => {
  const start = buffers.positions.length / 3;
  const uvs: Array<[u: number, v: number]> = [
    [0, 1],
    [1, 1],
    [1, 0],
    [0, 0]
  ];

  for (let index = 0; index < face.corners.length; index += 1) {
    const [dx, dy, dz] = face.corners[index];
    const [u, v] = uvs[index];
    buffers.positions.push(worldX(world, block.x + dx), worldY(world, block.y + dy), worldZ(world, block.z + dz));
    buffers.normals.push(face.normal.x, face.normal.y, face.normal.z);
    buffers.uvs.push(u, v);
  }

  buffers.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  buffers.targets.push({ block, normal: face.normal, blockId });
};

const createMesh = (name: string, buffers: MeshBuffers, material: THREE.Material) => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(buffers.positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(buffers.normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(buffers.uvs, 2));
  geometry.setIndex(buffers.indices);
  geometry.computeBoundingSphere();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.frustumCulled = false;
  mesh.userData.faceTargets = buffers.targets;
  return mesh;
};

export class EditableBlockRenderer {
  readonly group = new THREE.Group();

  constructor(
    private readonly baseWorld: FlatWorld,
    private readonly materials: TerrainMaterials
  ) {
    this.group.name = "editable-blocks";
  }

  rebuild(world: EditableWorld) {
    this.disposeMeshes();

    const buffersByBlock = new Map<SolidBlockId, MeshBuffers>();
    const bufferFor = (blockId: SolidBlockId) => {
      let buffers = buffersByBlock.get(blockId);
      if (!buffers) {
        buffers = createBuffers();
        buffersByBlock.set(blockId, buffers);
      }
      return buffers;
    };

    for (const candidate of buildCandidateBlocks(this.baseWorld, world)) {
      const blockId = world.solidBlockAt(candidate.x, candidate.y, candidate.z);
      if (!blockId) continue;

      for (const face of FACES) {
        const nx = candidate.x + face.normal.x;
        const ny = candidate.y + face.normal.y;
        const nz = candidate.z + face.normal.z;
        if (world.isSolid(nx, ny, nz)) continue;
        if (!candidate.isOverride && candidate.isBaseTop && face.normal.y === 1) continue;
        pushFace(bufferFor(blockId), this.baseWorld, candidate, blockId, face);
      }
    }

    for (const [blockId, buffers] of buffersByBlock) {
      if (buffers.indices.length > 0) this.group.add(createMesh(`editable-${blockId}`, buffers, this.materials[blockId]));
    }
  }

  dispose() {
    this.disposeMeshes();
  }

  private disposeMeshes() {
    for (const child of this.group.children) {
      if (child instanceof THREE.Mesh) child.geometry.dispose();
    }
    this.group.clear();
  }
}
