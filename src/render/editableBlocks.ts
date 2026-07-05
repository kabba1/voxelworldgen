import * as THREE from "three";
import { BLOCKS, blockOccludesNeighbor, blockRenderModel, type SolidBlockId } from "../world/blocks";
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

const DEFAULT_UVS: Array<[u: number, v: number]> = [
  [0, 1],
  [1, 1],
  [1, 0],
  [0, 0]
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
  pushQuad(buffers, world, block, blockId, face.normal, face.corners);
};

const pushQuad = (
  buffers: MeshBuffers,
  world: FlatWorld,
  block: BlockPosition,
  blockId: SolidBlockId,
  normal: BlockPosition,
  corners: Face["corners"],
  uvs = DEFAULT_UVS
) => {
  const start = buffers.positions.length / 3;

  for (let index = 0; index < corners.length; index += 1) {
    const [dx, dy, dz] = corners[index];
    const [u, v] = uvs[index];
    buffers.positions.push(worldX(world, block.x + dx), worldY(world, block.y + dy), worldZ(world, block.z + dz));
    buffers.normals.push(normal.x, normal.y, normal.z);
    buffers.uvs.push(u, v);
  }

  buffers.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  buffers.targets.push({ block, normal, blockId });
};

type Bounds = {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
};

type HorizontalConnections = {
  north: boolean;
  south: boolean;
  east: boolean;
  west: boolean;
};

type BedBuffers = {
  frame: MeshBuffers;
  mattress: MeshBuffers;
  pillow: MeshBuffers;
  blanket: MeshBuffers;
};

const pushCuboid = (
  buffers: MeshBuffers,
  world: FlatWorld,
  block: BlockPosition,
  blockId: SolidBlockId,
  bounds: Bounds
) => {
  const { minX, minY, minZ, maxX, maxY, maxZ } = bounds;
  const faces: Face[] = [
    { normal: { x: 0, y: 1, z: 0 }, corners: [[minX, maxY, maxZ], [maxX, maxY, maxZ], [maxX, maxY, minZ], [minX, maxY, minZ]] },
    { normal: { x: 0, y: -1, z: 0 }, corners: [[minX, minY, minZ], [maxX, minY, minZ], [maxX, minY, maxZ], [minX, minY, maxZ]] },
    { normal: { x: 1, y: 0, z: 0 }, corners: [[maxX, maxY, minZ], [maxX, maxY, maxZ], [maxX, minY, maxZ], [maxX, minY, minZ]] },
    { normal: { x: -1, y: 0, z: 0 }, corners: [[minX, maxY, maxZ], [minX, maxY, minZ], [minX, minY, minZ], [minX, minY, maxZ]] },
    { normal: { x: 0, y: 0, z: 1 }, corners: [[maxX, maxY, maxZ], [minX, maxY, maxZ], [minX, minY, maxZ], [maxX, minY, maxZ]] },
    { normal: { x: 0, y: 0, z: -1 }, corners: [[minX, maxY, minZ], [maxX, maxY, minZ], [maxX, minY, minZ], [minX, minY, minZ]] }
  ];

  for (const face of faces) pushFace(buffers, world, block, blockId, face);
};

const pushVerticalPlane = (
  buffers: MeshBuffers,
  world: FlatWorld,
  block: BlockPosition,
  blockId: SolidBlockId,
  axis: "x" | "z",
  minAlong: number,
  maxAlong: number,
  minY: number,
  maxY: number
) => {
  if (axis === "z") {
    pushQuad(
      buffers,
      world,
      block,
      blockId,
      { x: 0, y: 0, z: 1 },
      [[minAlong, maxY, 0.5], [maxAlong, maxY, 0.5], [maxAlong, minY, 0.5], [minAlong, minY, 0.5]]
    );
    return;
  }

  pushQuad(
    buffers,
    world,
    block,
    blockId,
    { x: 1, y: 0, z: 0 },
    [[0.5, maxY, maxAlong], [0.5, maxY, minAlong], [0.5, minY, minAlong], [0.5, minY, maxAlong]]
  );
};

const pushCrossPlanes = (
  buffers: MeshBuffers,
  world: FlatWorld,
  block: BlockPosition,
  blockId: SolidBlockId,
  minAlong: number,
  maxAlong: number,
  minY: number,
  maxY: number
) => {
  pushVerticalPlane(buffers, world, block, blockId, "z", minAlong, maxAlong, minY, maxY);
  pushVerticalPlane(buffers, world, block, blockId, "x", minAlong, maxAlong, minY, maxY);
};

const paneConnectsTo = (
  editableWorld: EditableWorld,
  block: BlockPosition,
  blockId: SolidBlockId,
  dx: number,
  dz: number
) => {
  const neighborBlockId = editableWorld.solidBlockAt(block.x + dx, block.y, block.z + dz);
  if (!neighborBlockId) return false;

  const neighborModel = blockRenderModel(neighborBlockId);
  return neighborBlockId === blockId || neighborModel === "connected_pane" || neighborModel === "cube";
};

const paneConnections = (
  editableWorld: EditableWorld,
  block: BlockPosition,
  blockId: SolidBlockId
): HorizontalConnections => ({
  north: paneConnectsTo(editableWorld, block, blockId, 0, -1),
  south: paneConnectsTo(editableWorld, block, blockId, 0, 1),
  east: paneConnectsTo(editableWorld, block, blockId, 1, 0),
  west: paneConnectsTo(editableWorld, block, blockId, -1, 0)
});

const pushConnectedPane = (
  buffers: MeshBuffers,
  world: FlatWorld,
  editableWorld: EditableWorld,
  block: BlockPosition,
  blockId: SolidBlockId
) => {
  const thickness = blockId === BLOCKS.ironBars ? 0.12 : 0.08;
  const min = 0.5 - thickness / 2;
  const max = 0.5 + thickness / 2;
  const connections = paneConnections(editableWorld, block, blockId);

  pushCuboid(buffers, world, block, blockId, { minX: min, minY: 0, minZ: min, maxX: max, maxY: 1, maxZ: max });

  if (!connections.north && !connections.south && !connections.east && !connections.west) {
    pushCuboid(buffers, world, block, blockId, { minX: min, minY: 0, minZ: 0.25, maxX: max, maxY: 1, maxZ: 0.75 });
    pushCuboid(buffers, world, block, blockId, { minX: 0.25, minY: 0, minZ: min, maxX: 0.75, maxY: 1, maxZ: max });
    return;
  }

  if (connections.north) {
    pushCuboid(buffers, world, block, blockId, { minX: min, minY: 0, minZ: 0, maxX: max, maxY: 1, maxZ: 0.5 });
  }
  if (connections.south) {
    pushCuboid(buffers, world, block, blockId, { minX: min, minY: 0, minZ: 0.5, maxX: max, maxY: 1, maxZ: 1 });
  }
  if (connections.east) {
    pushCuboid(buffers, world, block, blockId, { minX: 0.5, minY: 0, minZ: min, maxX: 1, maxY: 1, maxZ: max });
  }
  if (connections.west) {
    pushCuboid(buffers, world, block, blockId, { minX: 0, minY: 0, minZ: min, maxX: 0.5, maxY: 1, maxZ: max });
  }
};

const pushBed = (buffers: BedBuffers, world: FlatWorld, block: BlockPosition, blockId: SolidBlockId) => {
  pushCuboid(buffers.frame, world, block, blockId, { minX: 0.08, minY: 0.12, minZ: 0.08, maxX: 0.92, maxY: 0.24, maxZ: 0.92 });
  pushCuboid(buffers.mattress, world, block, blockId, { minX: 0.11, minY: 0.24, minZ: 0.1, maxX: 0.89, maxY: 0.43, maxZ: 0.9 });
  pushCuboid(buffers.pillow, world, block, blockId, { minX: 0.14, minY: 0.43, minZ: 0.11, maxX: 0.86, maxY: 0.55, maxZ: 0.32 });
  pushCuboid(buffers.blanket, world, block, blockId, { minX: 0.11, minY: 0.43, minZ: 0.32, maxX: 0.89, maxY: 0.52, maxZ: 0.9 });

  const legY = { minY: 0, maxY: 0.125 };
  const westLeg = { minX: 0.14, maxX: 0.28 };
  const eastLeg = { minX: 0.72, maxX: 0.86 };
  const northLeg = { minZ: 0.14, maxZ: 0.28 };
  const southLeg = { minZ: 0.72, maxZ: 0.86 };

  pushCuboid(buffers.frame, world, block, blockId, { ...westLeg, ...legY, ...northLeg });
  pushCuboid(buffers.frame, world, block, blockId, { ...eastLeg, ...legY, ...northLeg });
  pushCuboid(buffers.frame, world, block, blockId, { ...westLeg, ...legY, ...southLeg });
  pushCuboid(buffers.frame, world, block, blockId, { ...eastLeg, ...legY, ...southLeg });
};

const pushDoor = (buffers: MeshBuffers, world: FlatWorld, block: BlockPosition, blockId: SolidBlockId) => {
  const frameZ = { minZ: 0.39, maxZ: 0.61 };
  const panelZ = { minZ: 0.43, maxZ: 0.57 };

  pushCuboid(buffers, world, block, blockId, { minX: 0, minY: 0, maxX: 0.16, maxY: 2, ...frameZ });
  pushCuboid(buffers, world, block, blockId, { minX: 0.84, minY: 0, maxX: 1, maxY: 2, ...frameZ });
  pushCuboid(buffers, world, block, blockId, { minX: 0.16, minY: 0, maxX: 0.84, maxY: 0.18, ...frameZ });
  pushCuboid(buffers, world, block, blockId, { minX: 0.16, minY: 0.92, maxX: 0.84, maxY: 1.08, ...frameZ });
  pushCuboid(buffers, world, block, blockId, { minX: 0.16, minY: 1.82, maxX: 0.84, maxY: 2, ...frameZ });
  pushCuboid(buffers, world, block, blockId, { minX: 0.16, minY: 0.18, maxX: 0.84, maxY: 0.92, ...panelZ });
  pushCuboid(buffers, world, block, blockId, { minX: 0.16, minY: 1.08, maxX: 0.84, maxY: 1.82, ...panelZ });
};

const pushBlockModel = (
  buffers: MeshBuffers,
  world: FlatWorld,
  editableWorld: EditableWorld,
  block: BlockPosition,
  blockId: SolidBlockId
) => {
  switch (blockRenderModel(blockId)) {
    case "cross":
      pushCrossPlanes(buffers, world, block, blockId, 0, 1, 0, 1);
      return;
    case "connected_pane":
      pushConnectedPane(buffers, world, editableWorld, block, blockId);
      return;
    case "torch":
      pushCrossPlanes(buffers, world, block, blockId, 0.32, 0.68, 0, 0.78);
      return;
    case "door":
      pushDoor(buffers, world, block, blockId);
      return;
    case "cube":
      for (const face of FACES) pushFace(buffers, world, block, blockId, face);
      return;
  }
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

  private readonly specialMaterials = {
    bedFrame: new THREE.MeshLambertMaterial({ color: 0x6c5436 }),
    bedMattress: new THREE.MeshLambertMaterial({ color: 0xd2c5a8 }),
    bedPillow: new THREE.MeshLambertMaterial({ color: 0xf2ead6 }),
    bedBlanket: new THREE.MeshLambertMaterial({ color: 0xb7473c })
  };

  constructor(
    private readonly baseWorld: FlatWorld,
    private readonly materials: TerrainMaterials
  ) {
    this.group.name = "editable-blocks";
  }

  rebuild(world: EditableWorld) {
    this.disposeMeshes();

    const buffersByMaterial = new Map<string, { buffers: MeshBuffers; material: THREE.Material }>();
    const bufferFor = (blockId: SolidBlockId) => {
      const key = `block:${blockId}`;
      let entry = buffersByMaterial.get(key);
      if (!entry) {
        entry = { buffers: createBuffers(), material: this.materials[blockId] };
        buffersByMaterial.set(key, entry);
      }
      return entry.buffers;
    };
    const bufferForSpecial = (key: string, material: THREE.Material) => {
      let entry = buffersByMaterial.get(key);
      if (!entry) {
        entry = { buffers: createBuffers(), material };
        buffersByMaterial.set(key, entry);
      }
      return entry.buffers;
    };

    for (const candidate of buildCandidateBlocks(this.baseWorld, world)) {
      const blockId = world.solidBlockAt(candidate.x, candidate.y, candidate.z);
      if (!blockId) continue;

      if (blockRenderModel(blockId) === "bed") {
        pushBed(
          {
            frame: bufferForSpecial("bed:frame", this.specialMaterials.bedFrame),
            mattress: bufferForSpecial("bed:mattress", this.specialMaterials.bedMattress),
            pillow: bufferForSpecial("bed:pillow", this.specialMaterials.bedPillow),
            blanket: bufferForSpecial("bed:blanket", this.specialMaterials.bedBlanket)
          },
          this.baseWorld,
          candidate,
          blockId
        );
        continue;
      }

      if (blockRenderModel(blockId) !== "cube") {
        pushBlockModel(bufferFor(blockId), this.baseWorld, world, candidate, blockId);
        continue;
      }

      for (const face of FACES) {
        const nx = candidate.x + face.normal.x;
        const ny = candidate.y + face.normal.y;
        const nz = candidate.z + face.normal.z;
        const neighborBlockId = world.solidBlockAt(nx, ny, nz);
        if (neighborBlockId && blockOccludesNeighbor(neighborBlockId)) continue;
        if (!candidate.isOverride && candidate.isBaseTop && face.normal.y === 1) continue;
        pushFace(bufferFor(blockId), this.baseWorld, candidate, blockId, face);
      }
    }

    for (const [key, { buffers, material }] of buffersByMaterial) {
      if (buffers.indices.length > 0) this.group.add(createMesh(`editable-${key}`, buffers, material));
    }
  }

  dispose() {
    this.disposeMeshes();
    for (const material of Object.values(this.specialMaterials)) material.dispose();
  }

  private disposeMeshes() {
    for (const child of this.group.children) {
      if (child instanceof THREE.Mesh) child.geometry.dispose();
    }
    this.group.clear();
  }
}
