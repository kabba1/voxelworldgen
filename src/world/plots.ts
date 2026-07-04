import type { FlatWorld } from "./flatWorld";

export type PlotSizeClass = "small" | "medium" | "large";
export type DistrictSubdivisionStyle = "dense-small-lots" | "medium-mixed-lots" | "sparse-large-lots" | "civic-open-block";

export type Plot = {
  id: string;
  districtId: string;
  districtStyle: DistrictSubdivisionStyle;
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

export type PublicOpenSpace = {
  id: string;
  districtId: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  area: number;
};

export type PlotLayoutBounds = {
  x: number;
  z: number;
  width: number;
  depth: number;
  maxX: number;
  maxZ: number;
};

export type DistrictBlock = {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  style: DistrictSubdivisionStyle;
};

export type PlotLayoutConfig = {
  marginBlocks: number;
  separatorBlocks: number;
  sideLengthOptions: readonly number[];
  districtSideLengthOptions: readonly number[];
  seed: number;
};

export type PlotLayoutStats = {
  districtCount: number;
  denseDistricts: number;
  mediumDistricts: number;
  sparseDistricts: number;
  civicDistricts: number;
  publicOpenSpaceCount: number;
  publicOpenSpaceArea: number;
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
  bounds: PlotLayoutBounds;
  districts: DistrictBlock[];
  plots: Plot[];
  pathRects: PlotPathRect[];
  publicOpenSpaces: PublicOpenSpace[];
  config: PlotLayoutConfig;
  stats: PlotLayoutStats;
};

type Span = {
  start: number;
  size: number;
};

type WeightedSize = {
  size: number;
  weight: number;
};

type SpanPlan = {
  count: number;
  sizeSum: number;
  leadingSlack: number;
};

export const DEFAULT_PLOT_LAYOUT_CONFIG: PlotLayoutConfig = {
  marginBlocks: 5,
  separatorBlocks: 5,
  sideLengthOptions: [20, 30, 40, 50],
  districtSideLengthOptions: [220, 250, 280, 310, 340, 370, 400],
  seed: 0xaced2026
};

const DISTRICT_STYLE_WEIGHTS: Array<{ style: DistrictSubdivisionStyle; weight: number }> = [
  { style: "dense-small-lots", weight: 48 },
  { style: "medium-mixed-lots", weight: 30 },
  { style: "sparse-large-lots", weight: 14 },
  { style: "civic-open-block", weight: 8 }
];

const STYLE_SIZE_WEIGHTS: Record<DistrictSubdivisionStyle, WeightedSize[]> = {
  "dense-small-lots": [
    { size: 20, weight: 9 },
    { size: 30, weight: 4 },
    { size: 40, weight: 1 },
    { size: 50, weight: 0.35 }
  ],
  "medium-mixed-lots": [
    { size: 20, weight: 5 },
    { size: 30, weight: 5 },
    { size: 40, weight: 2 },
    { size: 50, weight: 1 }
  ],
  "sparse-large-lots": [
    { size: 20, weight: 1 },
    { size: 30, weight: 2 },
    { size: 40, weight: 4 },
    { size: 50, weight: 5 }
  ],
  "civic-open-block": [
    { size: 20, weight: 0.25 },
    { size: 30, weight: 1 },
    { size: 40, weight: 4 },
    { size: 50, weight: 7 }
  ]
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

const asWeightedSizes = (values: readonly number[]): WeightedSize[] => values.map((size) => ({ size, weight: 1 }));

const weightedAverage = (values: readonly WeightedSize[]) => {
  const totalWeight = values.reduce((sum, value) => sum + Math.max(0, value.weight), 0);
  if (totalWeight <= 0) return values.reduce((sum, value) => sum + value.size, 0) / values.length;
  return values.reduce((sum, value) => sum + value.size * Math.max(0, value.weight), 0) / totalWeight;
};

const pickWeightedSize = (values: readonly WeightedSize[], random: () => number) => {
  const totalWeight = values.reduce((sum, value) => sum + Math.max(0, value.weight), 0);
  if (totalWeight <= 0) return values[Math.floor(random() * values.length)]?.size;

  let cursor = random() * totalWeight;
  for (const value of values) {
    cursor -= Math.max(0, value.weight);
    if (cursor <= 0) return value.size;
  }

  return values[values.length - 1]?.size;
};

const snapDown = (value: number, step = 10) => Math.max(step, Math.floor(value / step) * step);

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const chooseDistrictStyle = (random: () => number): DistrictSubdivisionStyle => {
  let cursor = random() * DISTRICT_STYLE_WEIGHTS.reduce((sum, entry) => sum + entry.weight, 0);
  for (const entry of DISTRICT_STYLE_WEIGHTS) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.style;
  }
  return "medium-mixed-lots";
};

const findSpanPlan = (total: number, config: PlotLayoutConfig, weightedSizes: readonly WeightedSize[]): SpanPlan => {
  const sizes = weightedSizes.map((entry) => entry.size);
  const minSize = Math.min(...sizes);
  const maxSize = Math.max(...sizes);
  const targetAverage = weightedAverage(weightedSizes);
  const usable = total - config.marginBlocks * 2;
  const targetCount = Math.max(1, Math.round((usable + config.separatorBlocks) / (targetAverage + config.separatorBlocks)));
  const maxCount = Math.floor((usable + config.separatorBlocks) / (minSize + config.separatorBlocks));
  const maxEdgeSlack = config.separatorBlocks * 2;
  let bestPlan: SpanPlan | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let count = 1; count <= maxCount; count += 1) {
    const spaceBeforeEdgeSlack = usable - config.separatorBlocks * (count - 1);

    for (let edgeSlack = 0; edgeSlack <= maxEdgeSlack; edgeSlack += config.separatorBlocks) {
      const sizeSum = spaceBeforeEdgeSlack - edgeSlack;
      const canFill =
        sizeSum >= count * minSize &&
        sizeSum <= count * maxSize &&
        sizeSum % 10 === 0;

      if (!canFill) continue;

      const countDistance = Math.abs(count - targetCount);
      const leadingSlack = Math.floor(edgeSlack / 2 / config.separatorBlocks) * config.separatorBlocks;
      const score = countDistance * 100 + edgeSlack;
      if (score < bestScore) {
        bestPlan = { count, sizeSum, leadingSlack };
        bestScore = score;
      }
    }
  }

  return bestPlan ?? { count: 1, sizeSum: Math.min(maxSize, snapDown(usable)), leadingSlack: 0 };
};

const buildSpans = (
  total: number,
  config: PlotLayoutConfig,
  random: () => number,
  weightedSizes: readonly WeightedSize[] = asWeightedSizes(config.sideLengthOptions)
): Span[] => {
  const spans: Span[] = [];
  const sizes = weightedSizes.map((entry) => entry.size);
  const minSize = Math.min(...sizes);
  const maxSize = Math.max(...sizes);
  if (total - config.marginBlocks * 2 < minSize) return spans;

  const plan = findSpanPlan(total, config, weightedSizes);
  let remainingSizeSum = plan.sizeSum;
  let cursor = config.marginBlocks + plan.leadingSlack;

  for (let index = 0; index < plan.count; index += 1) {
    const remainingSlots = plan.count - index - 1;
    const candidates = weightedSizes.filter(({ size }) => {
      const nextRemaining = remainingSizeSum - size;
      return nextRemaining >= remainingSlots * minSize && nextRemaining <= remainingSlots * maxSize;
    });
    const size = pickWeightedSize(candidates, random) ?? minSize;
    spans.push({ start: cursor, size });
    cursor += size;
    remainingSizeSum -= size;
    if (index < plan.count - 1) cursor += config.separatorBlocks;
  }

  return spans;
};

const classifyPlot = (area: number): PlotSizeClass => {
  if (area <= 400) return "small";
  if (area <= 1500) return "medium";
  return "large";
};

const makePlot = (id: string, district: DistrictBlock, column: Span, row: Span): Plot => {
  const x = column.start;
  const z = row.start;
  const width = column.size;
  const depth = row.size;
  const area = width * depth;

  return {
    id,
    districtId: district.id,
    districtStyle: district.style,
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

const makeDistrict = (id: string, column: Span, row: Span, style: DistrictSubdivisionStyle): DistrictBlock => ({
  id,
  x: column.start,
  z: row.start,
  width: column.size,
  depth: row.size,
  style
});

const makePublicOpenSpace = (id: string, district: DistrictBlock, x: number, z: number, width: number, depth: number): PublicOpenSpace => ({
  id,
  districtId: district.id,
  x,
  z,
  width,
  depth,
  area: width * depth
});

const shouldSplitRowsFirst = (style: DistrictSubdivisionStyle, random: () => number) => {
  switch (style) {
    case "dense-small-lots":
      return random() < 0.55;
    case "medium-mixed-lots":
      return random() < 0.5;
    case "sparse-large-lots":
      return random() < 0.42;
    case "civic-open-block":
      return random() < 0.25;
  }
};

const makePathRect = (x: number, z: number, width: number, depth: number): PlotPathRect | null => {
  if (width <= 0 || depth <= 0) return null;
  return { x, z, width, depth };
};

const pushPathRect = (pathRects: PlotPathRect[], x: number, z: number, width: number, depth: number) => {
  const rect = makePathRect(x, z, width, depth);
  if (rect) pathRects.push(rect);
};

const addOpenSpace = (
  publicOpenSpaces: PublicOpenSpace[],
  district: DistrictBlock,
  x: number,
  z: number,
  width: number,
  depth: number
) => {
  if (width <= 0 || depth <= 0) return;
  publicOpenSpaces.push(makePublicOpenSpace(`open-${publicOpenSpaces.length + 1}`, district, x, z, width, depth));
};

const addPlotsInRect = (
  rect: PlotPathRect,
  district: DistrictBlock,
  plotConfig: PlotLayoutConfig,
  weightedSizes: readonly WeightedSize[],
  random: () => number,
  plots: Plot[],
  pathRects: PlotPathRect[],
  publicOpenSpaces: PublicOpenSpace[]
) => {
  const localRows = buildSpans(rect.depth, plotConfig, random, weightedSizes);
  if (localRows.length === 0) {
    addOpenSpace(publicOpenSpaces, district, rect.x, rect.z, rect.width, rect.depth);
    return;
  }

  addPathRectsAroundSpans(pathRects, localRows, rect.x, rect.width, rect.z, rect.depth, "z");

  for (const localRow of localRows) {
    const localColumns = buildSpans(rect.width, plotConfig, random, weightedSizes);
    if (localColumns.length === 0) {
      addOpenSpace(publicOpenSpaces, district, rect.x, rect.z + localRow.start, rect.width, localRow.size);
      continue;
    }

    addPathRectsAroundSpans(pathRects, localColumns, rect.z + localRow.start, localRow.size, rect.x, rect.width, "x");

    for (const localColumn of localColumns) {
      plots.push(
        makePlot(
          `plot-${plots.length + 1}`,
          district,
          { start: rect.x + localColumn.start, size: localColumn.size },
          { start: rect.z + localRow.start, size: localRow.size }
        )
      );
    }
  }
};

const addCivicOpenDistrict = (
  district: DistrictBlock,
  plotConfig: PlotLayoutConfig,
  random: () => number,
  plots: Plot[],
  pathRects: PlotPathRect[],
  publicOpenSpaces: PublicOpenSpace[]
) => {
  const ring = plotConfig.separatorBlocks;
  const edgeDepth = pickWeightedSize([{ size: 40, weight: 1 }, { size: 50, weight: 2 }], random) ?? 50;
  const maxOpenWidth = Math.max(60, district.width - edgeDepth * 2 - ring * 2);
  const maxOpenDepth = Math.max(60, district.depth - edgeDepth * 2 - ring * 2);
  const openWidth = snapDown(clamp(district.width * (0.5 + random() * 0.18), 80, maxOpenWidth));
  const openDepth = snapDown(clamp(district.depth * (0.5 + random() * 0.18), 80, maxOpenDepth));
  const openX = district.x + snapDown((district.width - openWidth) / 2, 5);
  const openZ = district.z + snapDown((district.depth - openDepth) / 2, 5);

  publicOpenSpaces.push(makePublicOpenSpace(`open-${publicOpenSpaces.length + 1}`, district, openX, openZ, openWidth, openDepth));

  pushPathRect(pathRects, openX - ring, openZ - ring, openWidth + ring * 2, ring);
  pushPathRect(pathRects, openX - ring, openZ + openDepth, openWidth + ring * 2, ring);
  pushPathRect(pathRects, openX - ring, openZ, ring, openDepth);
  pushPathRect(pathRects, openX + openWidth, openZ, ring, openDepth);

  const bands: PlotPathRect[] = [
    { x: district.x, z: district.z, width: district.width, depth: openZ - ring - district.z },
    {
      x: district.x,
      z: openZ + openDepth + ring,
      width: district.width,
      depth: district.z + district.depth - (openZ + openDepth + ring)
    },
    { x: district.x, z: openZ - ring, width: openX - ring - district.x, depth: openDepth + ring * 2 },
    {
      x: openX + openWidth + ring,
      z: openZ - ring,
      width: district.x + district.width - (openX + openWidth + ring),
      depth: openDepth + ring * 2
    }
  ].filter((band) => band.width > 0 && band.depth > 0);

  for (const band of bands) {
    addPlotsInRect(band, district, plotConfig, STYLE_SIZE_WEIGHTS["civic-open-block"], random, plots, pathRects, publicOpenSpaces);
  }
};

const addPathRectsAroundSpans = (
  pathRects: PlotPathRect[],
  spans: Span[],
  fixedStart: number,
  fixedSize: number,
  variableStart: number,
  variableSize: number,
  axis: "x" | "z",
  openSpaceContext?: {
    district: DistrictBlock;
    publicOpenSpaces: PublicOpenSpace[];
  }
) => {
  const maxPathSize = DEFAULT_PLOT_LAYOUT_CONFIG.separatorBlocks;
  const push = (start: number, size: number) => {
    if (axis === "x") {
      pushPathRect(pathRects, start, fixedStart, size, fixedSize);
      return;
    }
    pushPathRect(pathRects, fixedStart, start, fixedSize, size);
  };
  const pushOpen = (start: number, size: number) => {
    if (!openSpaceContext || size <= 0) return;
    if (axis === "x") {
      addOpenSpace(openSpaceContext.publicOpenSpaces, openSpaceContext.district, start, fixedStart, size, fixedSize);
      return;
    }
    addOpenSpace(openSpaceContext.publicOpenSpaces, openSpaceContext.district, fixedStart, start, fixedSize, size);
  };
  const pushEdge = (start: number, size: number) => {
    if (size <= 0) return;
    const pathSize = Math.min(size, maxPathSize);
    push(start, pathSize);
    pushOpen(start + pathSize, size - pathSize);
  };

  if (spans.length === 0) {
    pushOpen(variableStart, variableSize);
    return;
  }

  pushEdge(variableStart, spans[0].start);
  for (let index = 0; index < spans.length - 1; index += 1) {
    const start = variableStart + spans[index].start + spans[index].size;
    const end = variableStart + spans[index + 1].start;
    pushEdge(start, end - start);
  }
  const last = spans[spans.length - 1];
  const lastEnd = last.start + last.size;
  pushEdge(variableStart + lastEnd, variableSize - lastEnd);
};

const calculateLayoutBounds = (
  plots: Plot[],
  pathRects: PlotPathRect[],
  publicOpenSpaces: PublicOpenSpace[]
): PlotLayoutBounds => {
  const rects = [
    ...plots.map((plot) => ({ x: plot.x, z: plot.z, width: plot.width, depth: plot.depth })),
    ...pathRects,
    ...publicOpenSpaces.map((openSpace) => ({ x: openSpace.x, z: openSpace.z, width: openSpace.width, depth: openSpace.depth }))
  ].filter((rect) => rect.width > 0 && rect.depth > 0);

  if (rects.length === 0) {
    return { x: 0, z: 0, width: 0, depth: 0, maxX: 0, maxZ: 0 };
  }

  const x = Math.min(...rects.map((rect) => rect.x));
  const z = Math.min(...rects.map((rect) => rect.z));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.width));
  const maxZ = Math.max(...rects.map((rect) => rect.z + rect.depth));

  return { x, z, width: maxX - x, depth: maxZ - z, maxX, maxZ };
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
  const districts: DistrictBlock[] = [];
  const plots: Plot[] = [];
  const pathRects: PlotPathRect[] = [];
  const publicOpenSpaces: PublicOpenSpace[] = [];

  addPathRectsAroundSpans(pathRects, districtRows, 0, world.width, 0, world.depth, "z");
  for (const districtRow of districtRows) {
    addPathRectsAroundSpans(pathRects, districtColumns, districtRow.start, districtRow.size, 0, world.width, "x");
  }

  for (const districtRow of districtRows) {
    for (const districtColumn of districtColumns) {
      const district = makeDistrict(`district-${districts.length + 1}`, districtColumn, districtRow, chooseDistrictStyle(random));
      const localWeightedSizes = STYLE_SIZE_WEIGHTS[district.style];
      const splitRowsFirst = shouldSplitRowsFirst(district.style, random);
      districts.push(district);

      if (district.style === "civic-open-block") {
        addCivicOpenDistrict(district, plotConfig, random, plots, pathRects, publicOpenSpaces);
        continue;
      }

      if (splitRowsFirst) {
        const localRows = buildSpans(district.depth, plotConfig, random, localWeightedSizes);
        addPathRectsAroundSpans(
          pathRects,
          localRows,
          district.x,
          district.width,
          district.z,
          district.depth,
          "z"
        );

        for (const localRow of localRows) {
          const localColumns = buildSpans(district.width, plotConfig, random, localWeightedSizes);
          addPathRectsAroundSpans(
            pathRects,
            localColumns,
            district.z + localRow.start,
            localRow.size,
            district.x,
            district.width,
            "x"
          );

          for (const localColumn of localColumns) {
            plots.push(
              makePlot(
                `plot-${plots.length + 1}`,
                district,
                { start: district.x + localColumn.start, size: localColumn.size },
                { start: district.z + localRow.start, size: localRow.size }
              )
            );
          }
        }
      } else {
        const localColumns = buildSpans(district.width, plotConfig, random, localWeightedSizes);
        addPathRectsAroundSpans(
          pathRects,
          localColumns,
          district.z,
          district.depth,
          district.x,
          district.width,
          "x"
        );

        for (const localColumn of localColumns) {
          const localRows = buildSpans(district.depth, plotConfig, random, localWeightedSizes);
          addPathRectsAroundSpans(
            pathRects,
            localRows,
            district.x + localColumn.start,
            localColumn.size,
            district.z,
            district.depth,
            "z"
          );

          for (const localRow of localRows) {
            plots.push(
              makePlot(
                `plot-${plots.length + 1}`,
                district,
                { start: district.x + localColumn.start, size: localColumn.size },
                { start: district.z + localRow.start, size: localRow.size }
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
  const denseDistricts = districts.filter((district) => district.style === "dense-small-lots").length;
  const mediumDistricts = districts.filter((district) => district.style === "medium-mixed-lots").length;
  const sparseDistricts = districts.filter((district) => district.style === "sparse-large-lots").length;
  const civicDistricts = districts.filter((district) => district.style === "civic-open-block").length;
  const publicOpenSpaceArea = publicOpenSpaces.reduce((sum, openSpace) => sum + openSpace.area, 0);
  const bounds = calculateLayoutBounds(plots, pathRects, publicOpenSpaces);
  const layoutArea = Math.max(1, bounds.width * bounds.depth);

  return {
    bounds,
    districts,
    plots,
    pathRects,
    publicOpenSpaces,
    config,
    stats: {
      districtCount: districts.length,
      denseDistricts,
      mediumDistricts,
      sparseDistricts,
      civicDistricts,
      publicOpenSpaceCount: publicOpenSpaces.length,
      publicOpenSpaceArea,
      plotCount: plots.length,
      smallPlots,
      mediumPlots,
      largePlots,
      averageArea,
      totalPlotArea,
      coverageRatio: totalPlotArea / layoutArea,
      separatorBlocks: config.separatorBlocks,
      outlineTriangles: 0
    }
  };
};
