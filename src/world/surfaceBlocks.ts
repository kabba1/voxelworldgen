import type { FlatWorld } from "./flatWorld";
import { PlotWorld, type SurfaceBlockMap } from "./plotWorld";
import type { PlotLayout } from "./plots";
import { BLOCKS } from "./blocks";

export type { SurfaceBlockMap, SurfaceBlockRect } from "./plotWorld";

const isPlotWorld = (world: FlatWorld | PlotWorld): world is PlotWorld =>
  typeof (world as PlotWorld).surfaceBlockMap === "function";

export const buildSurfaceBlockMap = (world: FlatWorld | PlotWorld, layout?: PlotLayout): SurfaceBlockMap => {
  if (isPlotWorld(world)) return world.surfaceBlockMap();

  if (layout) {
    return new PlotWorld(layout, {
      width: world.width,
      depth: world.depth,
      blockSize: world.blockSize,
      stoneDepth: world.stoneDepth,
      dirtDepth: world.dirtDepth,
      grassDepth: world.grassDepth
    }).surfaceBlockMap();
  }

  return {
    rects: [{ x0: 0, z0: 0, x1: world.width, z1: world.depth, blockId: BLOCKS.grass }],
    blockAt: (x, z) => world.surfaceBlockAt(x, z)
  };
};
