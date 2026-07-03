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

export type PlotPathRect = {
  x: number;
  z: number;
  width: number;
  depth: number;
};

export type PlotLayoutConfig = {
  marginBlocks: number;
  separatorBlocks: number;
  sideLengthOptions: readonly number[];
  districtSideLengthOptions: readonly number[];
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
  pathRects: PlotPathRect[];
  config: PlotLayoutConfig;
  stats: PlotLayoutStats;
};

type Span = {
  start: number;
  size: number;
};

export const DEFAULT_PLOT_LAYOUT_CONFIG: PlotLayoutConfig = {
  marginBlocks: 5,
  separatorBlocks: 5,
  sideLengthOptions: [20, 30, 40, 50],
  districtSideLengthOptions: [220, 250, 280, 310, 340, 370, 400],
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

const average = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

const findSpanCount = (total: number, config: PlotLayoutConfig) => {
  const minSize = Math.min(...config.sideLengthOptions);
  const maxSize = Math.max(...config.sideLengthOptions);
  const targetAverage = average(config.sideLengthOptions);
  const usable = total - config.marginBlocks * 2;
  const targetCount = Math.max(1, Math.round((usable + config.separatorBlocks) / (targetAverage + config.separatorBlocks)));
  const maxCount = Math.floor((usable + config.separatorBlocks) / (minSize + config.separatorBlocks));
  let bestCount = 1;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let count = 1; count <= maxCount; count += 1) {
    const targetSizeSum = usable - config.separatorBlocks * (count - 1);
    const canFill =
      targetSizeSum >= count * minSize &&
      targetSizeSum <= count * maxSize &&
      targetSizeSum % 10 === 0;

    if (!canFill) continue;

    const distance = Math.abs(count - targetCount);
    if (distance < bestDistance) {
      bestCount = count;
      bestDistance = distance;
    }
  }

  return bestCount;
};

const buildSpans = (total: number, config: PlotLayoutConfig, random: () => number): Span[] => {
  const spans: Span[] = [];
  const count = findSpanCount(total, config);
  const minSize = Math.min(...config.sideLengthOptions);
  const maxSize = Math.max(...config.sideLengthOptions);
  let remainingSizeSum = total - config.marginBlocks * 2 - config.separatorBlocks * (count - 1);
  let cursor = config.marginBlocks;

  for (let index = 0; index < count; index += 1) {
    const remainingSlots = count - index - 1;
    const candidates = config.sideLengthOptions.filter((size) => {
      const nextRemaining = remainingSizeSum - size;
      return nextRemaining >= remainingSlots * minSize && nextRemaining <= remainingSlots * maxSize;
    });
    const size = candidates[Math.floor(random() * candidates.length)] ?? minSize;
    spans.push({ start: cursor, size });
    cursor += size;
    remainingSizeSum -= size;
    if (index < count - 1) cursor += config.separatorBlocks;
  }

  return spans;
};

const classifyPlot = (area: number): PlotSizeClass => {
  if (area <= 400) return "small";
  if (area <= 1500) return "medium";
  return "large";
};

const makePlot = (id: string, column: Span, row: Span): Plot => {
  const x = column.start;
  const z = row.start;
  const width = column.size;
  const depth = row.size;
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

const makePathRect = (x: number, z: number, width: number, depth: number): PlotPathRect | null => {
  if (width <= 0 || depth <= 0) return null;
  return { x, z, width, depth };
};

const pushPathRect = (pathRects: PlotPathRect[], x: number, z: number, width: number, depth: number) => {
  const rect = makePathRect(x, z, width, depth);
  if (rect) pathRects.push(rect);
};

const addPathRectsAroundSpans = (
  pathRects: PlotPathRect[],
  spans: Span[],
  fixedStart: number,
  fixedSize: number,
  variableStart: number,
  variableSize: number,
  axis: "x" | "z"
) => {
  const push = (start: number, size: number) => {
    if (axis === "x") {
      pushPathRect(pathRects, start, fixedStart, size, fixedSize);
      return;
    }
    pushPathRect(pathRects, fixedStart, start, fixedSize, size);
  };

  if (spans.length === 0) {
    push(variableStart, variableSize);
    return;
  }

  push(variableStart, spans[0].start);
  for (let index = 0; index < spans.length - 1; index += 1) {
    const start = variableStart + spans[index].start + spans[index].size;
    const end = variableStart + spans[index + 1].start;
    push(start, end - start);
  }
  const last = spans[spans.length - 1];
  const lastEnd = last.start + last.size;
  push(variableStart + lastEnd, variableSize - lastEnd);
};

export const generatePlotLayout = (
  world: FlatWorld,
  config: PlotLayoutConfig = DEFAULT_PLOT_LAYOUT_CONFIG
): PlotLayout => {
  const random = mulberry32(config.seed);
  const districtConfig: PlotLayoutConfig = {
    ...config,
    sideLengthOptions: config.districtSideLengthOptions
  };
  const plotConfig: PlotLayoutConfig = {
    ...config,
    marginBlocks: 0
  };
  const districtColumns = buildSpans(world.width, districtConfig, random);
  const districtRows = buildSpans(world.depth, districtConfig, random);
  const plots: Plot[] = [];
  const pathRects: PlotPathRect[] = [];

  addPathRectsAroundSpans(pathRects, districtRows, 0, world.width, 0, world.depth, "z");
  for (const districtRow of districtRows) {
    addPathRectsAroundSpans(pathRects, districtColumns, districtRow.start, districtRow.size, 0, world.width, "x");
  }

  for (const districtRow of districtRows) {
    for (const districtColumn of districtColumns) {
      const splitRowsFirst = random() < 0.5;

      if (splitRowsFirst) {
        const localRows = buildSpans(districtRow.size, plotConfig, random);
        addPathRectsAroundSpans(
          pathRects,
          localRows,
          districtColumn.start,
          districtColumn.size,
          districtRow.start,
          districtRow.size,
          "z"
        );

        for (const localRow of localRows) {
          const localColumns = buildSpans(districtColumn.size, plotConfig, random);
          addPathRectsAroundSpans(
            pathRects,
            localColumns,
            districtRow.start + localRow.start,
            localRow.size,
            districtColumn.start,
            districtColumn.size,
            "x"
          );

          for (const localColumn of localColumns) {
            plots.push(
              makePlot(
                `plot-${plots.length + 1}`,
                { start: districtColumn.start + localColumn.start, size: localColumn.size },
                { start: districtRow.start + localRow.start, size: localRow.size }
              )
            );
          }
        }
      } else {
        const localColumns = buildSpans(districtColumn.size, plotConfig, random);
        addPathRectsAroundSpans(
          pathRects,
          localColumns,
          districtRow.start,
          districtRow.size,
          districtColumn.start,
          districtColumn.size,
          "x"
        );

        for (const localColumn of localColumns) {
          const localRows = buildSpans(districtRow.size, plotConfig, random);
          addPathRectsAroundSpans(
            pathRects,
            localRows,
            districtColumn.start + localColumn.start,
            localColumn.size,
            districtRow.start,
            districtRow.size,
            "z"
          );

          for (const localRow of localRows) {
            plots.push(
              makePlot(
                `plot-${plots.length + 1}`,
                { start: districtColumn.start + localColumn.start, size: localColumn.size },
                { start: districtRow.start + localRow.start, size: localRow.size }
              )
            );
          }
        }
      }
    }
  }

  const totalPlotArea = plots.reduce((sum, plot) => sum + plot.area, 0);
  const averageArea = plots.length > 0 ? totalPlotArea / plots.length : 0;
  const smallPlots = plots.filter((plot) => plot.sizeClass === "small").length;
  const mediumPlots = plots.filter((plot) => plot.sizeClass === "medium").length;
  const largePlots = plots.filter((plot) => plot.sizeClass === "large").length;

  return {
    plots,
    pathRects,
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
