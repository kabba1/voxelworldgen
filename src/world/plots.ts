import type { FlatWorld } from "./flatWorld";

export type PlotSizeClass = "small" | "medium" | "large";

export type Plot = {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  area: number;
  centerX: number;
  centerZ: number;
  sizeClass: PlotSizeClass;
};

export type PlotLayoutConfig = {
  marginBlocks: number;
  separatorBlocks: number;
  minSpanBlocks: number;
  maxSpanBlocks: number;
  mergeChance: number;
  seed: number;
};

export type PlotLayoutStats = {
  plotCount: number;
  smallPlots: number;
  mediumPlots: number;
  largePlots: number;
  averageArea: number;
  totalPlotArea: number;
  coverageRatio: number;
  separatorBlocks: number;
  outlineTriangles: number;
};

export type PlotLayout = {
  plots: Plot[];
  config: PlotLayoutConfig;
  stats: PlotLayoutStats;
};

type Span = {
  start: number;
  size: number;
};

export const DEFAULT_PLOT_LAYOUT_CONFIG: PlotLayoutConfig = {
  marginBlocks: 90,
  separatorBlocks: 12,
  minSpanBlocks: 96,
  maxSpanBlocks: 220,
  mergeChance: 0.22,
  seed: 0xaced2026
};

const mulberry32 = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const randomInt = (random: () => number, min: number, max: number) => {
  return min + Math.floor(random() * (max - min + 1));
};

const buildSpans = (total: number, config: PlotLayoutConfig, random: () => number): Span[] => {
  const spans: Span[] = [];
  let cursor = config.marginBlocks;
  const end = total - config.marginBlocks;

  while (cursor + config.minSpanBlocks <= end) {
    const remaining = end - cursor;
    const nextMin = config.separatorBlocks + config.minSpanBlocks;
    const size =
      remaining <= config.maxSpanBlocks || remaining - config.maxSpanBlocks < nextMin
        ? remaining
        : randomInt(random, config.minSpanBlocks, config.maxSpanBlocks);

    spans.push({ start: cursor, size });
    cursor += size + config.separatorBlocks;
  }

  return spans;
};

const classifyPlot = (area: number): PlotSizeClass => {
  if (area < 18_000) return "small";
  if (area < 48_000) return "medium";
  return "large";
};

const makePlot = (id: string, columns: Span[], rows: Span[], column: number, row: number, columnSpan: number, rowSpan: number): Plot => {
  const firstColumn = columns[column];
  const lastColumn = columns[column + columnSpan - 1];
  const firstRow = rows[row];
  const lastRow = rows[row + rowSpan - 1];
  const x = firstColumn.start;
  const z = firstRow.start;
  const width = lastColumn.start + lastColumn.size - x;
  const depth = lastRow.start + lastRow.size - z;
  const area = width * depth;

  return {
    id,
    x,
    z,
    width,
    depth,
    area,
    centerX: x + width / 2,
    centerZ: z + depth / 2,
    sizeClass: classifyPlot(area)
  };
};

export const generatePlotLayout = (
  world: FlatWorld,
  config: PlotLayoutConfig = DEFAULT_PLOT_LAYOUT_CONFIG
): PlotLayout => {
  const random = mulberry32(config.seed);
  const columns = buildSpans(world.width, config, random);
  const rows = buildSpans(world.depth, config, random);
  const occupied = rows.map(() => columns.map(() => false));
  const plots: Plot[] = [];

  for (let row = 0; row < rows.length; row += 1) {
    for (let column = 0; column < columns.length; column += 1) {
      if (occupied[row][column]) continue;

      const canMergeColumn = column + 1 < columns.length && !occupied[row][column + 1];
      const columnSpan = canMergeColumn && random() < config.mergeChance ? 2 : 1;
      const canMergeRow =
        row + 1 < rows.length &&
        columns.slice(column, column + columnSpan).every((_span, offset) => !occupied[row + 1][column + offset]);
      const rowSpan = canMergeRow && random() < config.mergeChance ? 2 : 1;

      for (let z = row; z < row + rowSpan; z += 1) {
        for (let x = column; x < column + columnSpan; x += 1) {
          occupied[z][x] = true;
        }
      }

      plots.push(makePlot(`plot-${plots.length + 1}`, columns, rows, column, row, columnSpan, rowSpan));
    }
  }

  const totalPlotArea = plots.reduce((sum, plot) => sum + plot.area, 0);
  const averageArea = plots.length > 0 ? totalPlotArea / plots.length : 0;
  const smallPlots = plots.filter((plot) => plot.sizeClass === "small").length;
  const mediumPlots = plots.filter((plot) => plot.sizeClass === "medium").length;
  const largePlots = plots.filter((plot) => plot.sizeClass === "large").length;

  return {
    plots,
    config,
    stats: {
      plotCount: plots.length,
      smallPlots,
      mediumPlots,
      largePlots,
      averageArea,
      totalPlotArea,
      coverageRatio: totalPlotArea / (world.width * world.depth),
      separatorBlocks: config.separatorBlocks,
      outlineTriangles: 0
    }
  };
};
