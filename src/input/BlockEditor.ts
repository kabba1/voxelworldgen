import * as THREE from "three";
import { BLOCK_DEFINITIONS, type SolidBlockId } from "../world/blocks";
import { EditableWorld, type BlockPosition } from "../world/editableWorld";
import type { FlatWorld } from "../world/flatWorld";
import type { EditableBlockRenderer, EditFaceTarget } from "../render/editableBlocks";

type BlockEditorOptions = {
  camera: THREE.PerspectiveCamera;
  domElement: HTMLCanvasElement;
  baseWorld: FlatWorld;
  editableWorld: EditableWorld;
  editableRenderer: EditableBlockRenderer;
  terrainGroup: THREE.Group;
  setHiddenTopColumns: (hiddenColumns: ReadonlySet<string>) => void;
  inspectTerrainColumn?: (x: number, z: number) => boolean;
  canEditColumn?: (x: number, z: number) => boolean;
};

export type BlockEditorState = {
  heldBlock: SolidBlockId | null;
  heldBlockName: string;
  edits: number;
  lastAction: string;
};

type Target = {
  block: BlockPosition;
  normal: BlockPosition;
  blockId: SolidBlockId;
  source: "edit" | "terrain";
};

const MAX_REACH = 10;
const EPSILON = 0.01;

const floorBlock = (world: FlatWorld, point: THREE.Vector3): BlockPosition => ({
  x: Math.floor(point.x / world.blockSize + world.width / 2),
  y: Math.floor(point.y / world.blockSize),
  z: Math.floor(point.z / world.blockSize + world.depth / 2)
});

const normalFromHit = (hit: THREE.Intersection) => {
  const normal = hit.face?.normal ?? new THREE.Vector3(0, 1, 0);
  return {
    x: Math.round(normal.x),
    y: Math.round(normal.y),
    z: Math.round(normal.z)
  };
};

const blockName = (block: SolidBlockId | null) => (block === null ? "None" : BLOCK_DEFINITIONS[block].name);

export class BlockEditor {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2(0, 0);
  private readonly crosshair: HTMLDivElement;
  private readonly state: BlockEditorState = {
    heldBlock: null,
    heldBlockName: "None",
    edits: 0,
    lastAction: "Middle click a block to hold it"
  };

  constructor(private readonly options: BlockEditorOptions) {
    this.raycaster.far = MAX_REACH;
    this.crosshair = document.createElement("div");
    this.crosshair.className = "crosshair";
    document.body.appendChild(this.crosshair);

    options.domElement.addEventListener("mousedown", this.onMouseDown);
    options.domElement.addEventListener("contextmenu", this.onContextMenu);
    this.refresh();
  }

  dispose() {
    this.options.domElement.removeEventListener("mousedown", this.onMouseDown);
    this.options.domElement.removeEventListener("contextmenu", this.onContextMenu);
    this.crosshair.remove();
  }

  getState() {
    return this.state;
  }

  private onContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };

  private onMouseDown = (event: MouseEvent) => {
    if (document.pointerLockElement !== this.options.domElement) return;
    if (event.button !== 0 && event.button !== 1 && event.button !== 2) return;
    event.preventDefault();

    const target = this.pickTarget();
    if (!target) {
      this.state.lastAction = "No block in reach";
      return;
    }

    if (event.button === 1) {
      this.pickBlock(target);
      return;
    }

    if (event.button === 0) {
      if (
        target.source === "terrain" &&
        target.normal.y > 0 &&
        this.options.inspectTerrainColumn?.(target.block.x, target.block.z)
      ) {
        this.state.lastAction = "Selected plot";
        return;
      }

      this.breakBlock(target);
      return;
    }

    if (event.button === 2) {
      this.placeBlock(target);
    }
  };

  private pickBlock(target: Target) {
    this.state.heldBlock = target.blockId;
    this.state.heldBlockName = blockName(target.blockId);
    this.state.lastAction = `Holding ${this.state.heldBlockName}`;
  }

  private breakBlock(target: Target) {
    if (!this.canEditColumn(target.block.x, target.block.z)) {
      this.state.lastAction = "Cannot edit this column";
      return;
    }

    if (this.options.editableWorld.breakBlock(target.block.x, target.block.y, target.block.z)) {
      this.state.lastAction = `Broke ${blockName(target.blockId)}`;
      this.refresh();
    }
  }

  private placeBlock(target: Target) {
    if (this.state.heldBlock === null) {
      this.state.lastAction = "Middle click a block first";
      return;
    }

    const placeAt = {
      x: target.block.x + target.normal.x,
      y: target.block.y + target.normal.y,
      z: target.block.z + target.normal.z
    };

    if (!this.canEditColumn(placeAt.x, placeAt.z)) {
      this.state.lastAction = "Cannot build here";
      return;
    }

    if (this.options.editableWorld.placeBlock(placeAt.x, placeAt.y, placeAt.z, this.state.heldBlock)) {
      this.state.lastAction = `Placed ${this.state.heldBlockName}`;
      this.refresh();
      return;
    }

    this.state.lastAction = "Blocked";
  }

  private canEditColumn(x: number, z: number) {
    return this.options.canEditColumn?.(x, z) ?? false;
  }

  private refresh() {
    this.options.setHiddenTopColumns(this.options.editableWorld.topOverrideColumns());
    this.options.editableRenderer.rebuild(this.options.editableWorld);
    this.state.edits = this.options.editableWorld.overrideCount();
  }

  private pickTarget(): Target | null {
    this.raycaster.setFromCamera(this.pointer, this.options.camera);

    const editHit = this.firstHit(this.options.editableRenderer.group.children);
    if (editHit) {
      const targets = editHit.object.userData.faceTargets as EditFaceTarget[] | undefined;
      const faceTarget = targets?.[Math.floor((editHit.faceIndex ?? 0) / 2)];
      if (faceTarget) return { ...faceTarget, source: "edit" };
    }

    const terrainHit = this.firstHit(this.options.terrainGroup.children);
    if (!terrainHit) return null;

    const normal = normalFromHit(terrainHit);
    const inside = terrainHit.point.clone().add(new THREE.Vector3(normal.x, normal.y, normal.z).multiplyScalar(-EPSILON));
    const block = floorBlock(this.options.baseWorld, inside);

    const blockId = this.options.editableWorld.solidBlockAt(block.x, block.y, block.z);
    if (!blockId) return null;
    return { block, normal, blockId, source: "terrain" };
  }

  private firstHit(objects: THREE.Object3D[]) {
    const hits = this.raycaster.intersectObjects(objects, true);
    return hits[0] ?? null;
  }
}
