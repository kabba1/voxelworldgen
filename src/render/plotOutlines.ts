import * as THREE from "three";
import type { FlatWorld } from "../world/flatWorld";
import type { PlotLayout } from "../world/plots";

export type PlotOutlineBuildResult = {
  group: THREE.Group;
  triangles: number;
};

type MeshBuffers = {
  positions: number[];
  normals: number[];
  indices: number[];
};

const OUTLINE_WIDTH_BLOCKS = 2;
const SURFACE_LIFT = 0.025;

const worldX = (world: FlatWorld, x: number) => (x - world.width / 2) * world.blockSize;
const worldZ = (world: FlatWorld, z: number) => (z - world.depth / 2) * world.blockSize;

const pushQuad = (
  buffers: MeshBuffers,
  world: FlatWorld,
  y: number,
  corners: Array<[number, number]>
) => {
  const start = buffers.positions.length / 3;

  for (const [x, z] of corners) {
    buffers.positions.push(worldX(world, x), y, worldZ(world, z));
    buffers.normals.push(0, 1, 0);
  }

  buffers.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
};

const pushRect = (
  buffers: MeshBuffers,
  world: FlatWorld,
  y: number,
  x0: number,
  z0: number,
  x1: number,
  z1: number
) => {
  pushQuad(buffers, world, y, [
    [x0, z1],
    [x1, z1],
    [x1, z0],
    [x0, z0]
  ]);
};

const pushPlotOutline = (buffers: MeshBuffers, world: FlatWorld, y: number, x: number, z: number, width: number, depth: number) => {
  const left = x;
  const right = x + width;
  const top = z;
  const bottom = z + depth;
  const lineWidth = Math.min(OUTLINE_WIDTH_BLOCKS, width / 3, depth / 3);

  pushRect(buffers, world, y, left, top, right, top + lineWidth);
  pushRect(buffers, world, y, left, bottom - lineWidth, right, bottom);
  pushRect(buffers, world, y, left, top + lineWidth, left + lineWidth, bottom - lineWidth);
  pushRect(buffers, world, y, right - lineWidth, top + lineWidth, right, bottom - lineWidth);
};

const createOutlineMesh = (buffers: MeshBuffers) => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(buffers.positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(buffers.normals, 3));
  geometry.setIndex(buffers.indices);
  geometry.computeBoundingSphere();

  const material = new THREE.MeshBasicMaterial({
    color: 0x263c2d,
    depthWrite: false
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "plot-outline-strips";
  mesh.frustumCulled = false;
  return mesh;
};

export const buildPlotOutlines = (world: FlatWorld, layout: PlotLayout): PlotOutlineBuildResult => {
  const group = new THREE.Group();
  group.name = "plot-outlines";

  const buffers: MeshBuffers = {
    positions: [],
    normals: [],
    indices: []
  };
  const y = world.worldHeight() + SURFACE_LIFT;

  for (const plot of layout.plots) {
    pushPlotOutline(buffers, world, y, plot.x, plot.z, plot.width, plot.depth);
  }

  group.add(createOutlineMesh(buffers));

  return {
    group,
    triangles: buffers.indices.length / 3
  };
};
