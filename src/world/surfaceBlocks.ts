import { BLOCKS, type SolidBlockId } from "./blocks";
import type { FlatWorld } from "./flatWorld";
import type { PlotLayout, PlotPathRect } from "./plots";

export type SurfaceBlockRect = {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  blockId: SolidBlockId;
};

export type SurfaceBlockMap = {
  rects: SurfaceBlockRect[];
  blockAt: (x: number, z: number) => SolidBlockId;
};

const SURFACE_CELL_SIZE = 5;
const GRASS_CELL = 0;
const PATH_CELL = 1;

type PathLayers = {
  horizontal: Uint8Array;
  vertical: Uint8Array;
  columns: number;
  rows: number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const blockForCell = (cell: number): SolidBlockId => (cell === PATH_CELL ? BLOCKS.path : BLOCKS.grass);

const markHorizontal = (layers: PathLayers, x0: number, x1: number, z: number) => {
  const row = clamp(Math.floor(z / SURFACE_CELL_SIZE), 0, layers.rows - 1);
  const start = clamp(Math.floor(x0 / SURFACE_CELL_SIZE), 0, layers.columns);
  const end = clamp(Math.ceil(x1 / SURFACE_CELL_SIZE), 0, layers.columns);
  const rowOffset = row * layers.columns;

  for (let x = start; x < end; x += 1) {
    layers.horizontal[rowOffset + x] = PATH_CELL;
  }
};

const markVertical = (layers: PathLayers, x: number, z0: number, z1: number) => {
  const column = clamp(Math.floor(x / SURFACE_CELL_SIZE), 0, layers.columns - 1);
  const start = clamp(Math.floor(z0 / SURFACE_CELL_SIZE), 0, layers.rows);
  const end = clamp(Math.ceil(z1 / SURFACE_CELL_SIZE), 0, layers.rows);

  for (let z = start; z < end; z += 1) {
    layers.vertical[z * layers.columns + column] = PATH_CELL;
  }
};

const markPathRect = (layers: PathLayers, rect: PlotPathRect) => {
  if (rect.width >= rect.depth) {
    markHorizontal(layers, rect.x, rect.x + rect.width, rect.z + rect.depth / 2);
    return;
  }

  markVertical(layers, rect.x + rect.width / 2, rect.z, rect.z + rect.depth);
};

const removeAdjacentParallelLines = (layers: PathLayers) => {
  for (let z = 1; z < layers.rows; z += 1) {
    const currentOffset = z * layers.columns;
    const previousOffset = (z - 1) * layers.columns;
    for (let x = 0; x < layers.columns; x += 1) {
      if (layers.horizontal[currentOffset + x] && layers.horizontal[previousOffset + x]) {
        layers.horizontal[currentOffset + x] = GRASS_CELL;
      }
    }
  }

  for (let x = 1; x < layers.columns; x += 1) {
    for (let z = 0; z < layers.rows; z += 1) {
      const index = z * layers.columns + x;
      const previousIndex = index - 1;
      if (layers.vertical[index] && layers.vertical[previousIndex]) {
        layers.vertical[index] = GRASS_CELL;
      }
    }
  }
};

const buildPathGrid = (layers: PathLayers) => {
  removeAdjacentParallelLines(layers);

  const grid = new Uint8Array(layers.columns * layers.rows);
  for (let index = 0; index < grid.length; index += 1) {
    if (layers.horizontal[index] || layers.vertical[index]) grid[index] = PATH_CELL;
  }

  return grid;
};

const buildMergedRects = (grid: Uint8Array, world: FlatWorld, columns: number, rows: number) => {
  const completed: SurfaceBlockRect[] = [];
  let active = new Map<string, SurfaceBlockRect>();

  for (let z = 0; z < rows; z += 1) {
    const next = new Map<string, SurfaceBlockRect>();
    let x = 0;

    while (x < columns) {
      const cell = grid[z * columns + x];
      const runStart = x;
      while (x < columns && grid[z * columns + x] === cell) x += 1;

      const x0 = runStart * SURFACE_CELL_SIZE;
      const x1 = Math.min(world.width, x * SURFACE_CELL_SIZE);
      const z0 = z * SURFACE_CELL_SIZE;
      const z1 = Math.min(world.depth, (z + 1) * SURFACE_CELL_SIZE);
      const blockId = blockForCell(cell);
      const key = `${x0}:${x1}:${blockId}`;
      const prior = active.get(key);

      if (prior && prior.z1 === z0) {
        prior.z1 = z1;
        next.set(key, prior);
      } else {
        next.set(key, { x0, z0, x1, z1, blockId });
      }
    }

    for (const [key, rect] of active) {
      if (!next.has(key)) completed.push(rect);
    }

    active = next;
  }

  completed.push(...active.values());
  return completed;
};

export const buildSurfaceBlockMap = (world: FlatWorld, layout: PlotLayout): SurfaceBlockMap => {
  const columns = Math.ceil(world.width / SURFACE_CELL_SIZE);
  const rows = Math.ceil(world.depth / SURFACE_CELL_SIZE);
  const layers: PathLayers = {
    horizontal: new Uint8Array(columns * rows),
    vertical: new Uint8Array(columns * rows),
    columns,
    rows
  };

  for (const rect of layout.pathRects) {
    markPathRect(layers, rect);
  }

  const grid = buildPathGrid(layers);
  const rects = buildMergedRects(grid, world, columns, rows);

  return {
    rects,
    blockAt: (x, z) => {
      if (!world.containsColumn(x, z)) return BLOCKS.grass;
      const column = clamp(Math.floor(x / SURFACE_CELL_SIZE), 0, columns - 1);
      const row = clamp(Math.floor(z / SURFACE_CELL_SIZE), 0, rows - 1);
      return blockForCell(grid[row * columns + column]);
    }
  };
};
