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
  ownerAgentId: string | null;
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

type ComposableLengths = {
  all: ReadonlySet<number>;
  district: readonly number[];
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
const DISTRICT_MIN_SPAN = 180;
const DISTRICT_MAX_SPAN = 430;
const DISTRICT_SPAN_STEP = 10;
const MAX_BSP_DEPTH = 36;

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
  if (items.length === 0) return undefined;
  const totalWeight = items.reduce((sum, item) => sum + Math.max(0, weightFor(item)), 0);
  if (totalWeight <= 0) return items[Math.floor(random() * items.length)];

  let cursor = random() * totalWeight;
  for (const item of items) {
    cursor -= Math.max(0, weightFor(item));
    if (cursor <= 0) return item;
  }

  return items[items.length - 1];
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

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
  return Math.max(0.04, config.targetGroupRatios[group] + deficit * 4.2);
};

const exactShapeFor = (width: number, depth: number) =>
  PLOT_SHAPES.find((shape) => shape.width === width && shape.depth === depth) ?? null;

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
    sizeClass: sizeClassForGroup(shape.group),
    ownerAgentId: null
  };
};

const pushPathRect = (pathRects: PlotPathRect[], x: number, z: number, width: number, depth: number) => {
  if (width <= 0 || depth <= 0) return;
  pathRects.push({ x, z, width, depth });
};

const buildComposableLengths = (config: PlotLayoutConfig): ComposableLengths => {
  const all = new Set<number>(config.sideLengthOptions);
  let changed = true;

  while (changed) {
    changed = false;
    const current = [...all];
    for (const a of current) {
      for (const b of current) {
        const combined = a + config.pathWidthBlocks + b;
        if (combined > DISTRICT_MAX_SPAN || all.has(combined)) continue;
        all.add(combined);
        changed = true;
      }
    }
  }

  return {
    all,
    district: [...all].filter((length) => length >= DISTRICT_MIN_SPAN).sort((a, b) => a - b)
  };
};

const splitCandidatesForLength = (length: number, lengths: ComposableLengths, pathWidth: number) => {
  const candidates: Array<{ before: number; after: number }> = [];
  for (const before of lengths.all) {
    const after = length - before - pathWidth;
    if (after > 0 && lengths.all.has(after)) candidates.push({ before, after });
  }
  return candidates;
};

const childScore = (
  rect: Pick<Rect, "width" | "depth">,
  lengths: ComposableLengths,
  counts: PlotGroupCounts,
  config: PlotLayoutConfig
) => {
  const exact = exactShapeFor(rect.width, rect.depth);
  if (exact) return 2.8 + groupWeight(counts, exact.group, config);

  const canSplitX = splitCandidatesForLength(rect.width, lengths, config.pathWidthBlocks).length > 0;
  const canSplitZ = splitCandidatesForLength(rect.depth, lengths, config.pathWidthBlocks).length > 0;
  const aspect = Math.max(rect.width / rect.depth, rect.depth / rect.width);
  const aspectScore = Math.max(0.25, 1.4 - Math.abs(aspect - 1.55) * 0.3);

  return (canSplitX || canSplitZ ? 1 : 0.02) * aspectScore;
};

const splitWeight = (
  rect: Rect,
  split: SplitCandidate,
  lengths: ComposableLengths,
  counts: PlotGroupCounts,
  config: PlotLayoutConfig
) => {
  const childA = split.axis === "x"
    ? { width: split.before, depth: rect.depth }
    : { width: rect.width, depth: split.before };
  const childB = split.axis === "x"
    ? { width: split.after, depth: rect.depth }
    : { width: rect.width, depth: split.after };

  const balance = Math.min(split.before, split.after) / Math.max(split.before, split.after);
  const orientationBias =
    (rect.width > rect.depth * 1.25 && split.axis === "x") ||
    (rect.depth > rect.width * 1.25 && split.axis === "z")
      ? 1.3
      : 1;

  return (
    (childScore(childA, lengths, counts, config) + childScore(childB, lengths, counts, config)) *
    (0.35 + balance) *
    orientationBias
  );
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

const orderedSplitCandidates = (
  rect: Rect,
  lengths: ComposableLengths,
  counts: PlotGroupCounts,
  config: PlotLayoutConfig,
  random: () => number
) => {
  const pathWidth = config.pathWidthBlocks;
  const candidates: SplitCandidate[] = [
    ...splitCandidatesForLength(rect.width, lengths, pathWidth).map((split) => ({
      axis: "x" as const,
      before: split.before,
      after: split.after
    })),
    ...splitCandidatesForLength(rect.depth, lengths, pathWidth).map((split) => ({
      axis: "z" as const,
      before: split.before,
      after: split.after
    }))
  ];

  return candidates
    .map((candidate) => ({
      candidate,
      score: splitWeight(rect, candidate, lengths, counts, config) * (0.75 + random() * 0.5)
    }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.candidate);
};

const subdivideExact = (
  rect: Rect,
  districtId: string,
  depth: number,
  lengths: ComposableLengths,
  counts: PlotGroupCounts,
  config: PlotLayoutConfig,
  random: () => number,
  plots: Plot[],
  pathRects: PlotPathRect[]
): boolean => {
  const exact = exactShapeFor(rect.width, rect.depth);
  if (exact) {
    plots.push(makePlot(`plot-${plots.length + 1}`, districtId, rect, exact));
    counts[exact.group] += 1;
    return true;
  }

  if (depth >= MAX_BSP_DEPTH) return false;

  for (const split of orderedSplitCandidates(rect, lengths, counts, config, random)) {
    const localPlots: Plot[] = [];
    const localPaths: PlotPathRect[] = [];
    const localCounts: PlotGroupCounts = { ...counts };
    const children = splitRect(rect, split, config.pathWidthBlocks, localPaths);
    const first = random() < 0.5 ? children[0] : children[1];
    const second = first === children[0] ? children[1] : children[0];

    if (
      subdivideExact(first, districtId, depth + 1, lengths, localCounts, config, random, localPlots, localPaths) &&
      subdivideExact(second, districtId, depth + 1, lengths, localCounts, config, random, localPlots, localPaths)
    ) {
      Object.assign(counts, localCounts);
      plots.push(...localPlots);
      pathRects.push(...localPaths);
      return true;
    }
  }

  return false;
};

const chooseDistrictLength = (remaining: number, lengths: ComposableLengths, random: () => number) => {
  const candidates = lengths.district.filter((length) => length <= remaining);
  if (candidates.length === 0) return null;

  return pickWeighted(
    candidates,
    (length) => Math.max(0.1, 1.1 - Math.abs(length - 300) / 260),
    random
  ) ?? candidates[candidates.length - 1];
};

const makeRaggedRows = (world: FlatWorld, config: PlotLayoutConfig, lengths: ComposableLengths, random: () => number) => {
  const rows: Array<{ z: number; depth: number; left: number; right: number }> = [];
  const centerZ = world.depth / 2;
  let z = config.marginBlocks + randomSnapped(0, 80, random);
  const maxZ = world.depth - config.marginBlocks;

  while (z + DISTRICT_MIN_SPAN <= maxZ) {
    const depth = chooseDistrictLength(maxZ - z, lengths, random);
    if (depth === null) break;

    const rowCenter = z + depth / 2;
    const normalizedZ = Math.abs(rowCenter - centerZ) / (world.depth / 2);
    const edgeInset = Math.floor(Math.max(0, normalizedZ - 0.32) * 430);
    const left = config.marginBlocks + edgeInset + randomSnapped(0, 150, random);
    const right = world.width - config.marginBlocks - edgeInset - randomSnapped(0, 160, random);
    if (right - left >= DISTRICT_MIN_SPAN) rows.push({ z, depth, left, right });
    z += depth + config.pathWidthBlocks;
  }

  return rows;
};

const makeDistricts = (world: FlatWorld, config: PlotLayoutConfig, lengths: ComposableLengths, random: () => number) => {
  const districts: DistrictBlock[] = [];
  const rows = makeRaggedRows(world, config, lengths, random);
  const centerX = world.width / 2;
  const centerZ = world.depth / 2;

  for (const row of rows) {
    let x = row.left + randomSnapped(0, 70, random);

    while (x + DISTRICT_MIN_SPAN <= row.right) {
      const width = chooseDistrictLength(row.right - x, lengths, random);
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
  const lengths = buildComposableLengths(config);
  const counts: PlotGroupCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const candidateDistricts = makeDistricts(world, config, lengths, random);
  const districts: DistrictBlock[] = [];
  const plots: Plot[] = [];
  const pathRects: PlotPathRect[] = [];
  const publicOpenSpaces: PublicOpenSpace[] = [];

  for (const district of candidateDistricts) {
    const districtPlots: Plot[] = [];
    const districtPaths: PlotPathRect[] = [];
    const nextCounts: PlotGroupCounts = { ...counts };

    if (!subdivideExact(district, district.id, 0, lengths, nextCounts, config, random, districtPlots, districtPaths)) {
      continue;
    }

    Object.assign(counts, nextCounts);
    districts.push(district);
    plots.push(...districtPlots);
    pathRects.push(...districtPaths);
    addDistrictPerimeterPath(district, pathRects, config, world);
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
