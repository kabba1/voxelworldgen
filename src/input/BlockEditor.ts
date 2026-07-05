import * as THREE from "three";
import { ACTIVE_SOLID_BLOCKS, BLOCK_DEFINITIONS, blockRenderModel, type SolidBlockId } from "../world/blocks";
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
const OUTLINE_PADDING = 0.012;

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

type LocalBounds = {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
};

const defaultBounds = (): LocalBounds => ({ minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: 1, maxZ: 1 });

const outlineBoundsForBlock = (blockId: SolidBlockId): LocalBounds => {
  switch (blockRenderModel(blockId)) {
    case "bed":
      return { minX: 0.08, minY: 0, minZ: 0.08, maxX: 0.92, maxY: 0.55, maxZ: 0.92 };
    case "door":
      return { minX: 0, minY: 0, minZ: 0.39, maxX: 1, maxY: 2, maxZ: 0.61 };
    case "torch":
      return { minX: 0.32, minY: 0, minZ: 0.32, maxX: 0.68, maxY: 0.78, maxZ: 0.68 };
    case "connected_pane":
    case "cross":
    case "cube":
      return defaultBounds();
  }
};

const createOutlineGeometry = () => {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const edges = new THREE.EdgesGeometry(box);
  box.dispose();
  return edges;
};

export class BlockEditor {
  readonly group = new THREE.Group();

  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2(0, 0);
  private readonly crosshair: HTMLDivElement;
  private readonly heldBlockPreview: HTMLDivElement;
  private readonly heldBlockPreviewFaces: HTMLDivElement[];
  private readonly outlineGeometry = createOutlineGeometry();
  private readonly outlineMaterial = new THREE.LineBasicMaterial({
    color: 0xf8f2c4,
    transparent: true,
    opacity: 0.95,
    depthTest: false,
    depthWrite: false
  });
  private readonly outline = new THREE.LineSegments(this.outlineGeometry, this.outlineMaterial);
  private hoveredTarget: Target | null = null;
  private readonly state: BlockEditorState = {
    heldBlock: null,
    heldBlockName: "None",
    edits: 0,
    lastAction: "Middle click a block to hold it"
  };

  constructor(private readonly options: BlockEditorOptions) {
    this.group.name = "block-editor-outline";
    this.outline.name = "look-target-outline";
    this.outline.visible = false;
    this.outline.renderOrder = 1000;
    this.group.add(this.outline);

    this.raycaster.far = MAX_REACH;
    this.crosshair = document.createElement("div");
    this.crosshair.className = "crosshair";
    document.body.appendChild(this.crosshair);

    this.heldBlockPreview = document.createElement("div");
    this.heldBlockPreview.className = "held-block-preview is-empty";
    this.heldBlockPreview.setAttribute("aria-hidden", "true");
    const cube = document.createElement("div");
    cube.className = "held-block-preview__cube";
    this.heldBlockPreviewFaces = ["front", "right", "top"].map((side) => {
      const face = document.createElement("div");
      face.className = `held-block-preview__face held-block-preview__face--${side}`;
      cube.appendChild(face);
      return face;
    });
    const hand = document.createElement("div");
    hand.className = "held-block-preview__hand";
    this.heldBlockPreview.append(cube, hand);
    document.body.appendChild(this.heldBlockPreview);

    options.domElement.addEventListener("mousedown", this.onMouseDown);
    options.domElement.addEventListener("contextmenu", this.onContextMenu);
    options.domElement.addEventListener("wheel", this.onWheel, { passive: false });
    this.refresh();
  }

  dispose() {
    this.options.domElement.removeEventListener("mousedown", this.onMouseDown);
    this.options.domElement.removeEventListener("contextmenu", this.onContextMenu);
    this.options.domElement.removeEventListener("wheel", this.onWheel);
    this.crosshair.remove();
    this.heldBlockPreview.remove();
    this.group.removeFromParent();
    this.outlineGeometry.dispose();
    this.outlineMaterial.dispose();
  }

  getState() {
    return this.state;
  }

  update() {
    this.hoveredTarget = this.pickTarget();
    this.syncTargetOutline();
  }

  setHeldBlock(block: SolidBlockId) {
    this.state.heldBlock = block;
    this.state.heldBlockName = blockName(block);
    this.state.lastAction = `Holding ${this.state.heldBlockName}`;
    this.syncHeldBlockPreview();
  }

  private onContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };

  private onWheel = (event: WheelEvent) => {
    if (event.deltaY === 0) return;
    event.preventDefault();
    this.cycleHeldBlock(event.deltaY > 0 ? 1 : -1);
  };

  private onMouseDown = (event: MouseEvent) => {
    if (document.pointerLockElement !== this.options.domElement) return;
    if (event.button !== 0 && event.button !== 1 && event.button !== 2) return;
    event.preventDefault();

    const target = this.hoveredTarget ?? this.pickTarget();
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
    this.setHeldBlock(target.blockId);
  }

  private cycleHeldBlock(direction: 1 | -1) {
    const availableBlocks = ACTIVE_SOLID_BLOCKS;
    if (availableBlocks.length === 0) return;

    const currentIndex =
      this.state.heldBlock === null ? -1 : availableBlocks.findIndex((definition) => definition.id === this.state.heldBlock);
    const fallbackIndex = direction > 0 ? 0 : availableBlocks.length - 1;
    const nextIndex =
      currentIndex === -1 ? fallbackIndex : (currentIndex + direction + availableBlocks.length) % availableBlocks.length;

    this.setHeldBlock(availableBlocks[nextIndex].id);
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

  private syncHeldBlockPreview() {
    if (this.state.heldBlock === null) {
      this.heldBlockPreview.classList.add("is-empty");
      return;
    }

    const definition = BLOCK_DEFINITIONS[this.state.heldBlock];
    this.heldBlockPreview.classList.remove("is-empty");
    this.heldBlockPreview.style.setProperty("--held-block-color", `#${definition.color.toString(16).padStart(6, "0")}`);
    for (const face of this.heldBlockPreviewFaces) {
      face.style.backgroundColor = `#${definition.color.toString(16).padStart(6, "0")}`;
      face.style.backgroundImage = `url("${definition.texturePath}")`;
    }
  }

  private canEditColumn(x: number, z: number) {
    return this.options.canEditColumn?.(x, z) ?? false;
  }

  private refresh() {
    this.options.setHiddenTopColumns(this.options.editableWorld.topOverrideColumns());
    this.options.editableRenderer.rebuild(this.options.editableWorld);
    this.state.edits = this.options.editableWorld.overrideCount();
    this.hoveredTarget = this.pickTarget();
    this.syncTargetOutline();
  }

  private syncTargetOutline() {
    const target = this.hoveredTarget;
    if (!target) {
      this.outline.visible = false;
      return;
    }

    const bounds = outlineBoundsForBlock(target.blockId);
    const size = this.options.baseWorld.blockSize;
    const minX = (target.block.x + bounds.minX - this.options.baseWorld.width / 2) * size - OUTLINE_PADDING;
    const minY = (target.block.y + bounds.minY) * size - OUTLINE_PADDING;
    const minZ = (target.block.z + bounds.minZ - this.options.baseWorld.depth / 2) * size - OUTLINE_PADDING;
    const maxX = (target.block.x + bounds.maxX - this.options.baseWorld.width / 2) * size + OUTLINE_PADDING;
    const maxY = (target.block.y + bounds.maxY) * size + OUTLINE_PADDING;
    const maxZ = (target.block.z + bounds.maxZ - this.options.baseWorld.depth / 2) * size + OUTLINE_PADDING;

    this.outline.position.set((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
    this.outline.scale.set(maxX - minX, maxY - minY, maxZ - minZ);
    this.outline.visible = true;
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
