import * as THREE from "three";
import type { FlatWorld } from "../world/flatWorld";
import type { Plot, PlotLayout } from "../world/plots";

export type PlotPathBuildResult = {
  group: THREE.Group;
  triangles: number;
};

type MeshBuffers = {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
};

const SURFACE_EPSILON = 0.003;

const worldX = (world: FlatWorld, x: number) => (x - world.width / 2) * world.blockSize;
const worldZ = (world: FlatWorld, z: number) => (z - world.depth / 2) * world.blockSize;

const uniqueSorted = (values: number[]) => {
  return [...new Set(values)].sort((a, b) => a - b);
};

const isInsidePlot = (x: number, z: number, plots: Plot[]) => {
  return plots.some((plot) => x >= plot.x && x <= plot.x + plot.width && z >= plot.z && z <= plot.z + plot.depth);
};

const pushQuad = (
  buffers: MeshBuffers,
  world: FlatWorld,
  y: number,
  corners: Array<[x: number, z: number]>
) => {
  const start = buffers.positions.length / 3;

  for (const [x, z] of corners) {
    buffers.positions.push(worldX(world, x), y, worldZ(world, z));
    buffers.normals.push(0, 1, 0);
    buffers.uvs.push(x, z);
  }

  buffers.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
};

const pushRect = (buffers: MeshBuffers, world: FlatWorld, y: number, x0: number, z0: number, x1: number, z1: number) => {
  if (x1 <= x0 || z1 <= z0) return;
  pushQuad(buffers, world, y, [
    [x0, z1],
    [x1, z1],
    [x1, z0],
    [x0, z0]
  ]);
};

const buildPathSurfaceBuffers = (world: FlatWorld, layout: PlotLayout) => {
  const buffers: MeshBuffers = {
    positions: [],
    normals: [],
    uvs: [],
    indices: []
  };
  const xEdges = uniqueSorted([
    0,
    world.width,
    ...layout.plots.flatMap((plot) => [plot.x, plot.x + plot.width])
  ]);
  const zEdges = uniqueSorted([
    0,
    world.depth,
    ...layout.plots.flatMap((plot) => [plot.z, plot.z + plot.depth])
  ]);
  const y = world.worldHeight() + SURFACE_EPSILON;

  for (let zi = 0; zi < zEdges.length - 1; zi += 1) {
    const z0 = zEdges[zi];
    const z1 = zEdges[zi + 1];

    for (let xi = 0; xi < xEdges.length - 1; xi += 1) {
      const x0 = xEdges[xi];
      const x1 = xEdges[xi + 1];
      const centerX = (x0 + x1) / 2;
      const centerZ = (z0 + z1) / 2;

      if (!isInsidePlot(centerX, centerZ, layout.plots)) {
        pushRect(buffers, world, y, x0, z0, x1, z1);
      }
    }
  }

  return buffers;
};

const createPathMesh = (buffers: MeshBuffers, material: THREE.Material) => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(buffers.positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(buffers.normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(buffers.uvs, 2));
  geometry.setIndex(buffers.indices);
  geometry.computeBoundingSphere();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "plot-path-surface";
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  return mesh;
};

export const buildPlotPaths = (world: FlatWorld, layout: PlotLayout, material: THREE.Material): PlotPathBuildResult => {
  const group = new THREE.Group();
  group.name = "plot-paths";

  const buffers = buildPathSurfaceBuffers(world, layout);
  group.add(createPathMesh(buffers, material));

  return {
    group,
    triangles: buffers.indices.length / 3
  };
};
