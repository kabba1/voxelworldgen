import { BLOCKS, type SolidBlockId } from "./blocks";
import type { FlatWorld } from "./flatWorld";
import type { PlotLayout } from "./plots";

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

export const buildSurfaceBlockMap = (world: FlatWorld, layout: PlotLayout): SurfaceBlockMap => {
  const pathRects = layout.pathRects.map((rect): SurfaceBlockRect => ({
    x0: rect.x,
    z0: rect.z,
    x1: rect.x + rect.width,
    z1: rect.z + rect.depth,
    blockId: BLOCKS.path
  }));
  const plotRects = layout.plots.map((plot): SurfaceBlockRect => ({
    x0: plot.x,
    z0: plot.z,
    x1: plot.x + plot.width,
    z1: plot.z + plot.depth,
    blockId: BLOCKS.grass
  }));
  const rects = [...pathRects, ...plotRects];

  return {
    rects,
    blockAt: (x, z) => {
      if (!world.containsColumn(x, z)) return BLOCKS.grass;
      const rect = rects.find((candidate) => x >= candidate.x0 && x < candidate.x1 && z >= candidate.z0 && z < candidate.z1);
      return rect?.blockId ?? BLOCKS.path;
    }
  };
};
