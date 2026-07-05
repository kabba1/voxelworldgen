import type { ConcreteBlockId } from "./blocks";

export type ConcreteDoorSide = "north" | "south" | "east" | "west";

export type ConcreteDoorway = {
  side: ConcreteDoorSide;
  offset?: number;
  width?: number;
  height?: number;
};

export type ConcreteBoxDimensions = {
  length: number;
  width: number;
  height: number;
};

export type ConcreteBoxSpec = ConcreteBoxDimensions & {
  blockId: ConcreteBlockId;
  x: number;
  z: number;
  y?: number;
  doorway?: ConcreteDoorway;
};

export type ConcreteBoxInstance = ConcreteBoxSpec & {
  id: number;
  y: number;
};

export type ConcreteBlockCell = {
  x: number;
  y: number;
  z: number;
};

const doorwaySpan = (box: ConcreteBoxInstance, side: ConcreteDoorSide) =>
  side === "north" || side === "south" ? box.width : box.length;

const defaultDoorOffset = (span: number, width: number) => Math.max(0, Math.floor((span - width) / 2));

const isDoorwayCell = (box: ConcreteBoxInstance, localX: number, localY: number, localZ: number) => {
  if (!box.doorway) return false;

  const side = box.doorway.side;
  const span = doorwaySpan(box, side);
  const width = Math.min(span, Math.max(1, box.doorway.width ?? 2));
  const height = Math.min(box.height, Math.max(1, box.doorway.height ?? 3));
  const offset = Math.min(span - width, Math.max(0, box.doorway.offset ?? defaultDoorOffset(span, width)));
  if (localY >= height) return false;

  switch (side) {
    case "north":
      return localZ === 0 && localX >= offset && localX < offset + width;
    case "south":
      return localZ === box.length - 1 && localX >= offset && localX < offset + width;
    case "east":
      return localX === box.width - 1 && localZ >= offset && localZ < offset + width;
    case "west":
      return localX === 0 && localZ >= offset && localZ < offset + width;
  }
};

export const shellCellsForConcreteBox = (box: ConcreteBoxInstance) => {
  const cells: ConcreteBlockCell[] = [];
  for (let y = 0; y < box.height; y += 1) {
    for (let z = 0; z < box.length; z += 1) {
      for (let x = 0; x < box.width; x += 1) {
        const onWall = x === 0 || x === box.width - 1 || z === 0 || z === box.length - 1;
        const onRoof = y === box.height - 1;
        const onShell = onWall || onRoof;
        if (onShell && !isDoorwayCell(box, x, y, z)) cells.push({ x: box.x + x, y: box.y + y, z: box.z + z });
      }
    }
  }
  return cells;
};
