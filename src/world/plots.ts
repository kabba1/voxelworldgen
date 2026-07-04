import type { FlatWorld } from "./flatWorld";

export type PlotGroup = 1 | 2 | 3 | 4;
export type PlotSizeClass = "group-1" | "group-2" | "group-3" | "group-4";
export type PlotDimension = 20 | 30 | 40 | 50;
export type PlotRegionStyle = "bsp-district";

export type Plot = {
  id: string;
  group: PlotGroup;
  districtId: string;
  districtStyle: PlotRegionStyle;
  x: number;
  z: number;
  width: PlotDimension;
  depth: PlotDimension;
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
  style: PlotRegionStyle;
};

export type PlotLayoutConfig = {
  marginBlocks: number;
  pathWidthBlocks: number;
  sideLengthOptions: readonly PlotDimension[];
  seed: number;
  targetGroupRatios: Record<PlotGroup, number>;
};

export type PlotLayoutStats = {
  districtCount: number;
  group1Plots: number;
  group2Plots: number;
  group3Plots: number;
  group4Plots: number;
  group1Ratio: number;
  group2Ratio: number;
  group3Ratio: number;
  group4Ratio: number;
  publicOpenSpaceCount: number;
  publicOpenSpaceArea: number;
  plotCount: number;
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

type Rect = {
  x: number;
  z: number;
  width: number;
  depth: number;
};

type PlotShape = {
  width: PlotDimension;
  depth: PlotDimension;
  group: PlotGroup;
};

type PlotGroupCounts = Record<PlotGroup, number>;

type SplitCandidate = {
  axis: "x" | "z";
  before: number;
  after: number;
};

export const DEFAULT_PLOT_LAYOUT_CONFIG: PlotLayoutConfig = {
  marginBlocks: 42,
  pathWidthBlocks: 2,
  sideLengthOptions: [20, 30, 40, 50],
  seed: 0xaced2026,
  targetGroupRatios: {
    1: 0.4,
    2: 0.3,
    3: 0.2,
    4: 0.1
  }
};

const BASE_PLOT_SHAPES: readonly PlotShape[] = [
  { width: 20, depth: 20, group: 1 },
  { width: 20, depth: 30, group: 1 },
  { width: 20, depth: 40, group: 2 },
  { width: 30, depth: 30, group: 2 },
  { width: 20, depth: 50, group: 2 },
  { width: 30, depth: 40, group: 3 },
  { width: 30, depth: 50, group: 3 },
  { width: 40, depth: 40, group: 3 },
  { width: 40, depth: 50, group: 4 },
  { width: 50, depth: 50, group: 4 }
];

const PLOT_SHAPES: readonly PlotShape[] = BASE_PLOT_SHAPES.flatMap((shape) =>
  shape.width === shape.depth ? [shape] : [shape, { width: shape.depth, depth: shape.width, group: shape.group }]
);

const GROUPS: readonly PlotGroup[] = [1, 2, 3, 4];
const MIN_PLOT_SIDE = 20;
const MAX_PLOT_SIDE = 50;
const MAX_LEAF_SIDE = 58;
const MAX_BSP_DEPTH = 18;
const DISTRICT_MIN_SPAN = 180;
const DISTRICT_MAX_SPAN = 430;
const DISTRICT_SPAN_STEP = 10;

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

const pickWeighted = <T>(items: readonly T[], weightFor: (item: T) => number, random: () => number) => {
  const totalWeight = items.reduce((sum, item) => sum + Math.max(0, weightFor(item)), 0);
  if (items.length === 0) return undefined;
  if (totalWeight <= 0) return items[Math.floor(random() * items.length)];

  let cursor = random() * totalWeight;
  for (const item of items) {
    cursor -= Math.max(0, weightFor(item));
    if (cursor <= 0) return item;
  }

  return items[items.length - 1];
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const snapDown = (value: number, step = DISTRICT_SPAN_STEP) => Math.floor(value / step) * step;

const randomInt = (min: number, max: number, random: () => number) =>
  Math.floor(random() * (max - min + 1)) + min;

const randomSnapped = (min: number, max: number, random: () => number) => {
  const low = Math.ceil(min / DISTRICT_SPAN_STEP);
  const high = Math.floor(max / DISTRICT_SPAN_STEP);
  return randomInt(low, high, random) * DISTRICT_SPAN_STEP;
};

const sizeClassForGroup = (group: PlotGroup): PlotSizeClass => `group-${group}` as PlotSizeClass;

const groupWeight = (counts: PlotGroupCounts, group: PlotGroup, config: PlotLayoutConfig) => {
  const total = GROUPS.reduce((sum, entry) => sum + counts[entry], 0);
  const currentRatio = total > 0 ? counts[group] / total : 0;
  const deficit = config.targetGroupRatios[group] - currentRatio;
  return Math.max(0.05, config.targetGroupRatios[group] + deficit * 4.8);
};

const exactShapeFor = (width: number, depth: number) =>
  PLOT_SHAPES.find((shape) => shape.width === width && shape.depth === depth) ?? null;

const fittingShapesFor = (rect: Pick<Rect, "width" | "depth">) =>
  PLOT_SHAPES.filter((shape) => shape.width <= rect.width && shape.depth <= rect.depth);

const makePlot = (id: string, districtId: string, rect: Rect, shape: PlotShape): Plot => {
  const area = shape.width * shape.depth;
  return {
    id,
    group: shape.group,
    districtId,
    districtStyle: "bsp-district",
    x: rect.x,
    z: rect.z,
    width: shape.width,
    depth: shape.depth,
    area,
    centerX: rect.x + shape.width / 2,
    centerZ: rect.z + shape.depth / 2,
    sizeClass: sizeClassForGroup(shape.group)
  };
};

const pushPathRect = (pathRects: PlotPathRect[], x: number, z: number, width: number, depth: number) => {
  if (width <= 0 || depth <= 0) return;
  pathRects.push({ x, z, width, depth });
};

const pushPublicSpace = (publicOpenSpaces: PublicOpenSpace[], districtId: string, rect: Rect) => {
  if (rect.width <= 0 || rect.depth <= 0) return;
  publicOpenSpaces.push({
    id: `open-${publicOpenSpaces.length + 1}`,
    districtId,
    x: rect.x,
    z: rect.z,
    width: rect.width,
    depth: rect.depth,
    area: rect.width * rect.depth
  });
};

const addPublicRemainderAroundPlot = (
  publicOpenSpaces: PublicOpenSpace[],
  districtId: string,
  rect: Rect,
  plotRect: Rect
) => {
  const rightWidth = rect.x + rect.width - (plotRect.x + plotRect.width);
  const bottomDepth = rect.z + rect.depth - (plotRect.z + plotRect.depth);

  pushPublicSpace(publicOpenSpaces, districtId, {
    x: plotRect.x + plotRect.width,
    z: rect.z,
    width: rightWidth,
    depth: rect.depth
  });
  pushPublicSpace(publicOpenSpaces, districtId, {
    x: rect.x,
    z: plotRect.z + plotRect.depth,
    width: plotRect.width,
    depth: bottomDepth
  });
};

const fitPlotOrPublic = (
  rect: Rect,
  districtId: string,
  counts: PlotGroupCounts,
  config: PlotLayoutConfig,
  random: () => number,
  plots: Plot[],
  publicOpenSpaces: PublicOpenSpace[]
) => {
  const fittingShapes = fittingShapesFor(rect);
  if (fittingShapes.length === 0) {
    pushPublicSpace(publicOpenSpaces, districtId, rect);
    return;
  }

  const exact = exactShapeFor(rect.width, rect.depth);
  const shape =
    exact ??
    pickWeighted(
      fittingShapes,
      (candidate) => {
        const groupBias = groupWeight(counts, candidate.group, config);
        const fillRatio = (candidate.width * candidate.depth) / Math.max(1, rect.width * rect.depth);
        const edgeFit =
          (candidate.width === rect.width ? 0.55 : 0) +
          (candidate.depth === rect.depth ? 0.55 : 0);
        return groupBias * (0.55 + fillRatio + edgeFit);
      },
      random
    ) ??
    fittingShapes[0];

  const plotRect: Rect = {
    x: rect.x,
    z: rect.z,
    width: shape.width,
    depth: shape.depth
  };

  plots.push(makePlot(`plot-${plots.length + 1}`, districtId, plotRect, shape));
  counts[shape.group] += 1;
  addPublicRemainderAroundPlot(publicOpenSpaces, districtId, rect, plotRect);
};

const splitCandidatesForAxis = (length: number, pathWidth: number) => {
  const candidates: Array<{ before: number; after: number }> = [];
  const minBefore = MIN_PLOT_SIDE;
  const maxBefore = length - pathWidth - MIN_PLOT_SIDE;
  if (maxBefore < minBefore) return candidates;

  const preferredStops = new Set<number>();
  for (const side of [20, 30, 40, 50, 62, 72, 82, 92, 112, 132, 152] as const) {
    preferredStops.add(side);
    preferredStops.add(length - pathWidth - side);
  }

  const balancedStart = snapDown(length * 0.28);
  const balancedEnd = snapDown(length * 0.72);
  for (let before = balancedStart; before <= balancedEnd; before += DISTRICT_SPAN_STEP) {
    preferredStops.add(before);
  }

  for (const before of preferredStops) {
    const snapped = snapDown(before);
    const after = length - snapped - pathWidth;
    if (snapped >= minBefore && after >= MIN_PLOT_SIDE) candidates.push({ before: snapped, after });
  }

  return [...new Map(candidates.map((candidate) => [`${candidate.before}:${candidate.after}`, candidate])).values()];
};

const childPotential = (rect: Pick<Rect, "width" | "depth">, counts: PlotGroupCounts, config: PlotLayoutConfig) => {
  const fitting = fittingShapesFor(rect);
  if (fitting.length === 0) return 0.01;

  const exact = exactShapeFor(rect.width, rect.depth);
  const groupScore = fitting.reduce((sum, shape) => sum + groupWeight(counts, shape.group, config), 0) / fitting.length;
  const sideScore =
    Math.max(0, 1 - Math.abs(rect.width - MAX_PLOT_SIDE) / MAX_LEAF_SIDE) +
    Math.max(0, 1 - Math.abs(rect.depth - MAX_PLOT_SIDE) / MAX_LEAF_SIDE);
  return groupScore + sideScore * 0.45 + (exact ? 1.4 : 0);
};

const splitWeight = (rect: Rect, split: SplitCandidate, counts: PlotGroupCounts, config: PlotLayoutConfig) => {
  const childA = split.axis === "x"
    ? { width: split.before, depth: rect.depth }
    : { width: rect.width, depth: split.before };
  const childB = split.axis === "x"
    ? { width: split.after, depth: rect.depth }
    : { width: rect.width, depth: split.after };

  const balance = Math.min(split.before, split.after) / Math.max(split.before, split.after);
  const orientationBias =
    (rect.width > rect.depth * 1.22 && split.axis === "x") || (rect.depth > rect.width * 1.22 && split.axis === "z")
      ? 1.35
      : 1;
  return (
    (childPotential(childA, counts, config) + childPotential(childB, counts, config)) *
    (0.42 + balance) *
    orientationBias
  );
};

const chooseSplit = (
  rect: Rect,
  counts: PlotGroupCounts,
  config: PlotLayoutConfig,
  random: () => number
): SplitCandidate | null => {
  const pathWidth = config.pathWidthBlocks;
  const candidates: SplitCandidate[] = [
    ...splitCandidatesForAxis(rect.width, pathWidth).map((split) => ({
      axis: "x" as const,
      before: split.before,
      after: split.after
    })),
    ...splitCandidatesForAxis(rect.depth, pathWidth).map((split) => ({
      axis: "z" as const,
      before: split.before,
      after: split.after
    }))
  ];

  if (candidates.length === 0) return null;
  return pickWeighted(candidates, (candidate) => splitWeight(rect, candidate, counts, config), random) ?? candidates[0];
};

const splitRect = (rect: Rect, split: SplitCandidate, pathWidth: number, pathRects: PlotPathRect[]) => {
  if (split.axis === "x") {
    pushPathRect(pathRects, rect.x + split.before, rect.z, pathWidth, rect.depth);
    return [
      { x: rect.x, z: rect.z, width: split.before, depth: rect.depth },
      { x: rect.x + split.before + pathWidth, z: rect.z, width: split.after, depth: rect.depth }
    ] satisfies [Rect, Rect];
  }

  pushPathRect(pathRects, rect.x, rect.z + split.before, rect.width, pathWidth);
  return [
    { x: rect.x, z: rect.z, width: rect.width, depth: split.before },
    { x: rect.x, z: rect.z + split.before + pathWidth, width: rect.width, depth: split.after }
  ] satisfies [Rect, Rect];
};

const shouldStopAtLeaf = (rect: Rect, depth: number, random: () => number) => {
  if (depth >= MAX_BSP_DEPTH) return true;
  if (rect.width <= MAX_LEAF_SIDE && rect.depth <= MAX_LEAF_SIDE) return true;

  const area = rect.width * rect.depth;
  if (area <= 3000 && rect.width <= 68 && rect.depth <= 68) return random() < 0.16;
  return false;
};

const subdivideDistrict = (
  rect: Rect,
  districtId: string,
  depth: number,
  counts: PlotGroupCounts,
  config: PlotLayoutConfig,
  random: () => number,
  plots: Plot[],
  pathRects: PlotPathRect[],
  publicOpenSpaces: PublicOpenSpace[]
) => {
  const exact = exactShapeFor(rect.width, rect.depth);
  if (exact) {
    plots.push(makePlot(`plot-${plots.length + 1}`, districtId, rect, exact));
    counts[exact.group] += 1;
    return;
  }

  const chosenSplit = shouldStopAtLeaf(rect, depth, random)
    ? null
    : chooseSplit(rect, counts, config, random);

  if (!chosenSplit) {
    fitPlotOrPublic(rect, districtId, counts, config, random, plots, publicOpenSpaces);
    return;
  }

  const children = splitRect(rect, chosenSplit, config.pathWidthBlocks, pathRects);
  const first = random() < 0.5 ? children[0] : children[1];
  const second = first === children[0] ? children[1] : children[0];

  subdivideDistrict(first, districtId, depth + 1, counts, config, random, plots, pathRects, publicOpenSpaces);
  subdivideDistrict(second, districtId, depth + 1, counts, config, random, plots, pathRects, publicOpenSpaces);
};

const makeDistrictSpan = (remaining: number, random: () => number) => {
  const max = Math.min(DISTRICT_MAX_SPAN, remaining);
  if (max < DISTRICT_MIN_SPAN) return null;
  return randomSnapped(DISTRICT_MIN_SPAN, max, random);
};

const makeRaggedRows = (world: FlatWorld, config: PlotLayoutConfig, random: () => number) => {
  const rows: Array<{ z: number; depth: number; left: number; right: number }> = [];
  const centerZ = world.depth / 2;
  let z = config.marginBlocks + randomSnapped(0, 80, random);
  const maxZ = world.depth - config.marginBlocks;

  while (z + DISTRICT_MIN_SPAN <= maxZ) {
    const remaining = maxZ - z;
    const depth = makeDistrictSpan(remaining, random);
    if (depth === null) break;

    const rowCenter = z + depth / 2;
    const normalizedZ = Math.abs(rowCenter - centerZ) / (world.depth / 2);
    const edgeInset = Math.floor(Math.max(0, normalizedZ - 0.32) * 420);
    const wobble = randomSnapped(0, 150, random);
    const left = config.marginBlocks + edgeInset + wobble;
    const right = world.width - config.marginBlocks - edgeInset - randomSnapped(0, 160, random);
    if (right - left >= DISTRICT_MIN_SPAN) rows.push({ z, depth, left, right });
    z += depth + config.pathWidthBlocks;
  }

  return rows;
};

const makeDistricts = (world: FlatWorld, config: PlotLayoutConfig, random: () => number) => {
  const districts: DistrictBlock[] = [];
  const rows = makeRaggedRows(world, config, random);
  const centerX = world.width / 2;
  const centerZ = world.depth / 2;

  for (const row of rows) {
    let x = row.left + randomSnapped(0, 70, random);

    while (x + DISTRICT_MIN_SPAN <= row.right) {
      const remaining = row.right - x;
      const width = makeDistrictSpan(remaining, random);
      if (width === null) break;

      const district: DistrictBlock = {
        id: `district-${districts.length + 1}`,
        x,
        z: row.z,
        width,
        depth: row.depth,
        style: "bsp-district"
      };

      const dx = (district.x + district.width / 2 - centerX) / (world.width / 2);
      const dz = (district.z + district.depth / 2 - centerZ) / (world.depth / 2);
      const edgeScore = dx * dx * 0.9 + dz * dz * 1.1;
      const keep = edgeScore < 0.54 || edgeScore < 0.97 - random() * 0.22;
      if (keep) districts.push(district);

      x += width + config.pathWidthBlocks;
    }
  }

  return districts;
};

const addDistrictPerimeterPath = (
  district: DistrictBlock,
  pathRects: PlotPathRect[],
  config: PlotLayoutConfig,
  world: FlatWorld
) => {
  const pathWidth = config.pathWidthBlocks;
  const pushClipped = (x: number, z: number, width: number, depth: number) => {
    const x0 = clamp(x, 0, world.width);
    const z0 = clamp(z, 0, world.depth);
    const x1 = clamp(x + width, 0, world.width);
    const z1 = clamp(z + depth, 0, world.depth);
    pushPathRect(pathRects, x0, z0, x1 - x0, z1 - z0);
  };

  pushClipped(district.x - pathWidth, district.z - pathWidth, district.width + pathWidth * 2, pathWidth);
  pushClipped(district.x - pathWidth, district.z + district.depth, district.width + pathWidth * 2, pathWidth);
  pushClipped(district.x - pathWidth, district.z, pathWidth, district.depth);
  pushClipped(district.x + district.width, district.z, pathWidth, district.depth);
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

const normalizeLayoutToOrigin = (
  districts: DistrictBlock[],
  plots: Plot[],
  pathRects: PlotPathRect[],
  publicOpenSpaces: PublicOpenSpace[]
) => {
  const bounds = calculateLayoutBounds(plots, pathRects, publicOpenSpaces);
  const offsetX = bounds.x;
  const offsetZ = bounds.z;

  for (const district of districts) {
    district.x -= offsetX;
    district.z -= offsetZ;
  }

  for (const plot of plots) {
    plot.x -= offsetX;
    plot.z -= offsetZ;
    plot.centerX -= offsetX;
    plot.centerZ -= offsetZ;
  }

  for (const pathRect of pathRects) {
    pathRect.x -= offsetX;
    pathRect.z -= offsetZ;
  }

  for (const openSpace of publicOpenSpaces) {
    openSpace.x -= offsetX;
    openSpace.z -= offsetZ;
  }

  return calculateLayoutBounds(plots, pathRects, publicOpenSpaces);
};

const makeStats = (
  bounds: PlotLayoutBounds,
  plots: Plot[],
  pathRects: PlotPathRect[],
  publicOpenSpaces: PublicOpenSpace[],
  districts: DistrictBlock[],
  config: PlotLayoutConfig
): PlotLayoutStats => {
  const totalPlotArea = plots.reduce((sum, plot) => sum + plot.area, 0);
  const plotCount = plots.length;
  const averageArea = plotCount > 0 ? totalPlotArea / plotCount : 0;
  const layoutArea = Math.max(1, bounds.width * bounds.depth);
  const groupCounts: PlotGroupCounts = {
    1: plots.filter((plot) => plot.group === 1).length,
    2: plots.filter((plot) => plot.group === 2).length,
    3: plots.filter((plot) => plot.group === 3).length,
    4: plots.filter((plot) => plot.group === 4).length
  };
  const publicOpenSpaceArea = publicOpenSpaces.reduce((sum, openSpace) => sum + openSpace.area, 0);

  return {
    districtCount: districts.length,
    group1Plots: groupCounts[1],
    group2Plots: groupCounts[2],
    group3Plots: groupCounts[3],
    group4Plots: groupCounts[4],
    group1Ratio: plotCount > 0 ? groupCounts[1] / plotCount : 0,
    group2Ratio: plotCount > 0 ? groupCounts[2] / plotCount : 0,
    group3Ratio: plotCount > 0 ? groupCounts[3] / plotCount : 0,
    group4Ratio: plotCount > 0 ? groupCounts[4] / plotCount : 0,
    publicOpenSpaceCount: publicOpenSpaces.length,
    publicOpenSpaceArea,
    plotCount,
    averageArea,
    totalPlotArea,
    coverageRatio: totalPlotArea / layoutArea,
    separatorBlocks: config.pathWidthBlocks,
    outlineTriangles: pathRects.length
  };
};

export const generatePlotLayout = (
  world: FlatWorld,
  config: PlotLayoutConfig = DEFAULT_PLOT_LAYOUT_CONFIG
): PlotLayout => {
  const random = mulberry32(config.seed);
  const counts: PlotGroupCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const districts = makeDistricts(world, config, random);
  const plots: Plot[] = [];
  const pathRects: PlotPathRect[] = [];
  const publicOpenSpaces: PublicOpenSpace[] = [];

  for (const district of districts) {
    const firstPlotCount = plots.length;
    subdivideDistrict(district, district.id, 0, counts, config, random, plots, pathRects, publicOpenSpaces);

    if (plots.length > firstPlotCount) {
      addDistrictPerimeterPath(district, pathRects, config, world);
    }
  }

  const bounds = normalizeLayoutToOrigin(districts, plots, pathRects, publicOpenSpaces);

  return {
    bounds,
    districts,
    plots,
    pathRects,
    publicOpenSpaces,
    config,
    stats: makeStats(bounds, plots, pathRects, publicOpenSpaces, districts, config)
  };
};
