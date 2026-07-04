import { BLOCKS, type BlockId, type SolidBlockId } from "./blocks";
import { FlatWorld, type FlatWorldConfig } from "./flatWorld";
import type { Plot, PlotLayout, PlotPathRect } from "./plots";

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

const SURFACE_CELL_SIZE = 1;
const EMPTY_CELL = 0;
const PLOT_CELL = 1;
const PATH_CELL = 2;
const NO_PLOT = -1;

type SurfaceCell = typeof EMPTY_CELL | typeof PLOT_CELL | typeof PATH_CELL;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const blockForCell = (cell: SurfaceCell): SolidBlockId | null => {
  if (cell === EMPTY_CELL) return null;
  if (cell === PLOT_CELL) return BLOCKS.grass;
  return BLOCKS.path;
};

const rectToCellBounds = (
  rect: { x: number; z: number; width: number; depth: number },
  columns: number,
  rows: number
) => ({
  x0: clamp(Math.floor(rect.x / SURFACE_CELL_SIZE), 0, columns),
  z0: clamp(Math.floor(rect.z / SURFACE_CELL_SIZE), 0, rows),
  x1: clamp(Math.ceil((rect.x + rect.width) / SURFACE_CELL_SIZE), 0, columns),
  z1: clamp(Math.ceil((rect.z + rect.depth) / SURFACE_CELL_SIZE), 0, rows)
});

const markCells = (
  cells: Uint8Array,
  plotIndices: Int32Array,
  columns: number,
  rows: number,
  rect: { x: number; z: number; width: number; depth: number },
  cell: SurfaceCell,
  plotIndex = NO_PLOT
) => {
  const bounds = rectToCellBounds(rect, columns, rows);

  for (let z = bounds.z0; z < bounds.z1; z += 1) {
    const rowOffset = z * columns;
    for (let x = bounds.x0; x < bounds.x1; x += 1) {
      const index = rowOffset + x;
      cells[index] = cell;
      plotIndices[index] = plotIndex;
    }
  }
};

const markPathRect = (
  cells: Uint8Array,
  plotIndices: Int32Array,
  columns: number,
  rows: number,
  rect: PlotPathRect
) => {
  markCells(cells, plotIndices, columns, rows, rect, PATH_CELL, NO_PLOT);
};

const buildSurfaceRects = (cells: Uint8Array, world: FlatWorld, columns: number, rows: number) => {
  const completed: SurfaceBlockRect[] = [];
  let active = new Map<string, SurfaceBlockRect>();

  for (let z = 0; z < rows; z += 1) {
    const next = new Map<string, SurfaceBlockRect>();
    let x = 0;

    while (x < columns) {
      const cell = cells[z * columns + x] as SurfaceCell;
      const runStart = x;
      while (x < columns && cells[z * columns + x] === cell) x += 1;

      const x0 = runStart * SURFACE_CELL_SIZE;
      const x1 = Math.min(world.width, x * SURFACE_CELL_SIZE);
      const z0 = z * SURFACE_CELL_SIZE;
      const z1 = Math.min(world.depth, (z + 1) * SURFACE_CELL_SIZE);
      const blockId = blockForCell(cell);
      if (blockId === null) continue;
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

export class PlotWorld extends FlatWorld {
  readonly layout: PlotLayout;
  readonly surfaceCellSize = SURFACE_CELL_SIZE;

  private readonly columns: number;
  private readonly rows: number;
  private readonly surfaceCells: Uint8Array;
  private readonly plotCellIndices: Int32Array;
  private readonly surfaceRectCache: SurfaceBlockRect[];

  constructor(layout: PlotLayout, config: FlatWorldConfig) {
    super(config);
    this.layout = layout;
    this.columns = Math.ceil(this.width / SURFACE_CELL_SIZE);
    this.rows = Math.ceil(this.depth / SURFACE_CELL_SIZE);
    this.surfaceCells = new Uint8Array(this.columns * this.rows);
    this.plotCellIndices = new Int32Array(this.columns * this.rows);
    this.plotCellIndices.fill(NO_PLOT);

    this.markPlots(layout.plots);
    this.markPaths(layout.pathRects);
    this.surfaceRectCache = buildSurfaceRects(this.surfaceCells, this, this.columns, this.rows);
  }

  override heightAt(x: number, z: number) {
    return this.containsColumn(x, z) ? this.height : 0;
  }

  override containsColumn(x: number, z: number) {
    const index = this.cellIndexAt(x, z);
    return index !== null && this.surfaceCells[index] !== EMPTY_CELL;
  }

  plotAt(x: number, z: number): Plot | null {
    const index = this.cellIndexAt(x, z);
    if (index === null || this.surfaceCells[index] !== PLOT_CELL) return null;
    const plotIndex = this.plotCellIndices[index];
    return plotIndex >= 0 ? this.layout.plots[plotIndex] ?? null : null;
  }

  override surfaceBlockAt(x: number, z: number): SolidBlockId {
    const index = this.cellIndexAt(x, z);
    if (index === null) return BLOCKS.grass;
    return blockForCell(this.surfaceCells[index] as SurfaceCell) ?? BLOCKS.grass;
  }

  override blockAt(x: number, y: number, z: number): BlockId {
    if (!this.containsColumn(x, z) || y < 0 || y >= this.height) return BLOCKS.air;
    if (y === this.height - 1) return this.surfaceBlockAt(x, z);
    return super.blockAt(x, y, z);
  }

  isBuildable(x: number, z: number) {
    return this.plotAt(x, z) !== null;
  }

  canBuild(agentId: string, x: number, z: number) {
    const plot = this.plotAt(x, z);
    if (!plot) return false;
    return plot.ownerAgentId === null || plot.ownerAgentId === agentId;
  }

  surfaceRects() {
    return this.surfaceRectCache;
  }

  surfaceBlockMap(): SurfaceBlockMap {
    return {
      rects: this.surfaceRects(),
      blockAt: (x, z) => this.surfaceBlockAt(x, z)
    };
  }

  private markPlots(plots: Plot[]) {
    plots.forEach((plot, index) => {
      markCells(this.surfaceCells, this.plotCellIndices, this.columns, this.rows, plot, PLOT_CELL, index);
    });
  }

  private markPaths(pathRects: PlotPathRect[]) {
    for (const pathRect of pathRects) {
      markPathRect(this.surfaceCells, this.plotCellIndices, this.columns, this.rows, pathRect);
    }
  }

  private cellIndexAt(x: number, z: number) {
    if (!this.isInsideBounds(x, z)) return null;
    const column = clamp(Math.floor(x / SURFACE_CELL_SIZE), 0, this.columns - 1);
    const row = clamp(Math.floor(z / SURFACE_CELL_SIZE), 0, this.rows - 1);
    return row * this.columns + column;
  }

  private isInsideBounds(x: number, z: number) {
    return x >= 0 && x < this.width && z >= 0 && z < this.depth;
  }
}

export const buildSurfaceBlockMap = (world: PlotWorld): SurfaceBlockMap => world.surfaceBlockMap();
