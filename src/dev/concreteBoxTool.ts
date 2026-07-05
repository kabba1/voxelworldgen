import * as THREE from "three";
import type { TerrainMaterials } from "../render/terrainMaterials";
import { BLOCK_DEFINITIONS, CONCRETE_BLOCKS, type ConcreteBlockId } from "../world/blocks";
import type { PlotWorld } from "../world/plotWorld";

type BoxDimensions = {
  length: number;
  width: number;
  height: number;
};

type PlacedConcreteBox = BoxDimensions & {
  id: number;
  blockId: ConcreteBlockId;
  x: number;
  y: number;
  z: number;
};

type BlockCell = {
  x: number;
  y: number;
  z: number;
};

type ConcreteBoxToolOptions = {
  camera: THREE.PerspectiveCamera;
  domElement: HTMLCanvasElement;
  world: PlotWorld;
  materials: TerrainMaterials;
};

const MIN_DIMENSION = 1;
const MAX_DIMENSION = 96;

const worldBlockX = (world: PlotWorld, x: number) => (x - world.width / 2) * world.blockSize;
const worldBlockY = (world: PlotWorld, y: number) => y * world.blockSize;
const worldBlockZ = (world: PlotWorld, z: number) => (z - world.depth / 2) * world.blockSize;

const clampDimension = (value: number) =>
  Math.max(MIN_DIMENSION, Math.min(MAX_DIMENSION, Number.isFinite(value) ? Math.round(value) : MIN_DIMENSION));

const shellCells = (box: Pick<PlacedConcreteBox, "width" | "length" | "height" | "x" | "y" | "z">) => {
  const cells: BlockCell[] = [];
  for (let y = 0; y < box.height; y += 1) {
    for (let z = 0; z < box.length; z += 1) {
      for (let x = 0; x < box.width; x += 1) {
        const onShell =
          x === 0 || x === box.width - 1 || z === 0 || z === box.length - 1 || y === 0 || y === box.height - 1;
        if (onShell) cells.push({ x: box.x + x, y: box.y + y, z: box.z + z });
      }
    }
  }
  return cells;
};

export class ConcreteBoxTool {
  readonly group = new THREE.Group();

  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2(0, 0);
  private readonly groundPlane: THREE.Plane;
  private readonly hitPoint = new THREE.Vector3();
  private readonly boxLayer = new THREE.Group();
  private readonly previewGroup = new THREE.Group();
  private readonly previewMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.24,
    depthWrite: false
  });
  private readonly previewLineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
  private readonly cubeGeometry: THREE.BoxGeometry;
  private readonly matrixDummy = new THREE.Object3D();
  private readonly placedBoxes: PlacedConcreteBox[] = [];
  private readonly panel = document.createElement("div");
  private readonly swatch = document.createElement("span");
  private readonly colorName = document.createElement("strong");
  private readonly placedCount = document.createElement("span");
  private readonly lockState = document.createElement("span");
  private readonly dimensionSummary = document.createElement("span");
  private readonly inputs: Record<keyof BoxDimensions, HTMLInputElement>;

  private selectedIndex = 0;
  private nextBoxId = 1;
  private dimensions: BoxDimensions = { length: 12, width: 8, height: 6 };
  private previewOrigin: { x: number; z: number } | null = null;
  private previewValid = false;
  private lastPreviewKey = "";

  constructor(private readonly options: ConcreteBoxToolOptions) {
    this.group.name = "concrete-box-tool";
    this.boxLayer.name = "placed-concrete-boxes";
    this.previewGroup.name = "concrete-box-preview";
    this.group.add(this.boxLayer, this.previewGroup);
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -options.world.worldHeight());
    this.cubeGeometry = new THREE.BoxGeometry(options.world.blockSize, options.world.blockSize, options.world.blockSize);

    this.inputs = {
      length: this.createDimensionInput("length"),
      width: this.createDimensionInput("width"),
      height: this.createDimensionInput("height")
    };

    this.buildPanel();
    document.body.appendChild(this.panel);
    this.updatePanel();

    options.domElement.addEventListener("mousedown", this.onMouseDown);
    options.domElement.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("pointerlockchange", this.onPointerLockChange);
  }

  update() {
    this.updatePreviewTarget();
    this.renderPreview();
  }

  dispose() {
    this.options.domElement.removeEventListener("mousedown", this.onMouseDown);
    this.options.domElement.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("pointerlockchange", this.onPointerLockChange);
    this.panel.remove();
    this.previewMaterial.dispose();
    this.previewLineMaterial.dispose();
    this.cubeGeometry.dispose();
    this.disposePreview();
    this.group.clear();
  }

  private buildPanel() {
    this.panel.className = "concrete-box-tool";

    const header = document.createElement("div");
    header.className = "concrete-box-tool__header";
    const title = document.createElement("div");
    title.textContent = "Concrete Box";
    this.placedCount.className = "concrete-box-tool__count";
    header.append(title, this.placedCount);

    const selected = document.createElement("div");
    selected.className = "concrete-box-tool__selected";
    this.swatch.className = "concrete-box-tool__swatch";
    selected.append(this.swatch, this.colorName);

    const dimensions = document.createElement("div");
    dimensions.className = "concrete-box-tool__size";
    const dimensionsHeader = document.createElement("div");
    dimensionsHeader.className = "concrete-box-tool__size-header";
    const dimensionsTitle = document.createElement("span");
    dimensionsTitle.textContent = "Box Size";
    this.dimensionSummary.className = "concrete-box-tool__dimension-summary";
    dimensionsHeader.append(dimensionsTitle, this.dimensionSummary);

    const dimensionFields = document.createElement("div");
    dimensionFields.className = "concrete-box-tool__dimensions";
    dimensionFields.append(
      this.createField("Length", this.inputs.length),
      this.createField("Width", this.inputs.width),
      this.createField("Height", this.inputs.height)
    );
    dimensions.append(dimensionsHeader, dimensionFields);

    this.lockState.className = "concrete-box-tool__hint";
    this.panel.append(header, selected, dimensions, this.lockState);
  }

  private createField(labelText: string, input: HTMLInputElement) {
    const label = document.createElement("label");
    label.className = "concrete-box-tool__field";
    const labelSpan = document.createElement("span");
    labelSpan.textContent = labelText;
    label.append(labelSpan, input);
    return label;
  }

  private createDimensionInput(key: keyof BoxDimensions) {
    const input = document.createElement("input");
    input.type = "number";
    input.min = String(MIN_DIMENSION);
    input.max = String(MAX_DIMENSION);
    input.step = "1";
    input.value = String(this.dimensions[key]);
    input.addEventListener("change", () => {
      this.dimensions = {
        ...this.dimensions,
        [key]: clampDimension(Number(input.value))
      };
      input.value = String(this.dimensions[key]);
      this.renderPreview();
    });
    return input;
  }

  private onPointerLockChange = () => {
    this.updatePanel();
  };

  private onWheel = (event: WheelEvent) => {
    if (document.pointerLockElement !== this.options.domElement) return;
    event.preventDefault();
    this.selectedIndex =
      (this.selectedIndex + (event.deltaY > 0 ? 1 : -1) + CONCRETE_BLOCKS.length) % CONCRETE_BLOCKS.length;
    this.updatePanel();
    this.renderPreview();
  };

  private onMouseDown = (event: MouseEvent) => {
    if (event.button !== 0 || document.pointerLockElement !== this.options.domElement) return;
    event.preventDefault();
    this.placePreviewBox();
  };

  private updatePanel() {
    const selected = this.selectedBlock();
    this.swatch.style.backgroundColor = `#${selected.color.toString(16).padStart(6, "0")}`;
    this.swatch.style.backgroundImage = `url(${selected.texturePath})`;
    this.colorName.textContent = selected.key;
    this.placedCount.textContent = `${this.placedBoxes.length} placed`;
    this.dimensionSummary.textContent = `${this.dimensions.length} x ${this.dimensions.width} x ${this.dimensions.height}`;

    const locked = document.pointerLockElement === this.options.domElement;
    for (const input of Object.values(this.inputs)) input.disabled = locked;
    this.lockState.textContent = locked
      ? "Scroll changes color. Click places box. Esc edits LWH."
      : "Edit LWH here, then click world to lock.";
  }

  private selectedBlock() {
    return CONCRETE_BLOCKS[this.selectedIndex] as (typeof CONCRETE_BLOCKS)[number] & { id: ConcreteBlockId };
  }

  private updatePreviewTarget() {
    this.raycaster.setFromCamera(this.pointer, this.options.camera);
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, this.hitPoint)) {
      this.previewOrigin = null;
      this.previewValid = false;
      return;
    }

    const hitX = Math.floor(this.hitPoint.x / this.options.world.blockSize + this.options.world.width / 2);
    const hitZ = Math.floor(this.hitPoint.z / this.options.world.blockSize + this.options.world.depth / 2);
    const originX = Math.floor(hitX - this.dimensions.width / 2);
    const originZ = Math.floor(hitZ - this.dimensions.length / 2);
    this.previewOrigin = { x: originX, z: originZ };
    this.previewValid = this.footprintIsInWorld(originX, originZ);
  }

  private footprintIsInWorld(originX: number, originZ: number) {
    for (let z = originZ; z < originZ + this.dimensions.length; z += 1) {
      for (let x = originX; x < originX + this.dimensions.width; x += 1) {
        if (!this.options.world.containsColumn(x, z)) return false;
      }
    }
    return true;
  }

  private placePreviewBox() {
    if (!this.previewOrigin || !this.previewValid) return;
    this.placedBoxes.push({
      id: this.nextBoxId,
      blockId: this.selectedBlock().id,
      x: this.previewOrigin.x,
      y: this.options.world.height,
      z: this.previewOrigin.z,
      ...this.dimensions
    });
    this.nextBoxId += 1;
    this.rebuildPlacedBoxes();
    this.updatePanel();
  }

  private rebuildPlacedBoxes() {
    this.boxLayer.clear();
    const cellsByBlock = new Map<ConcreteBlockId, BlockCell[]>();

    for (const box of this.placedBoxes) {
      const cells = cellsByBlock.get(box.blockId) ?? [];
      cells.push(...shellCells(box));
      cellsByBlock.set(box.blockId, cells);
    }

    for (const [blockId, cells] of cellsByBlock) {
      const material = this.options.materials[blockId];
      const mesh = new THREE.InstancedMesh(this.cubeGeometry, material, cells.length);
      mesh.name = `${BLOCK_DEFINITIONS[blockId].key}-boxes`;
      mesh.frustumCulled = false;

      cells.forEach((cell, index) => {
        this.matrixDummy.position.set(
          worldBlockX(this.options.world, cell.x + 0.5),
          worldBlockY(this.options.world, cell.y + 0.5),
          worldBlockZ(this.options.world, cell.z + 0.5)
        );
        this.matrixDummy.updateMatrix();
        mesh.setMatrixAt(index, this.matrixDummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      this.boxLayer.add(mesh);
    }
  }

  private renderPreview() {
    const previewKey = this.previewOrigin
      ? [
          this.previewOrigin.x,
          this.previewOrigin.z,
          this.dimensions.length,
          this.dimensions.width,
          this.dimensions.height,
          this.selectedIndex,
          this.previewValid
        ].join(":")
      : "none";
    if (previewKey === this.lastPreviewKey) return;
    this.lastPreviewKey = previewKey;
    this.disposePreview();
    this.previewGroup.clear();
    if (!this.previewOrigin) return;

    const color = this.previewValid ? this.selectedBlock().color : 0xff3333;
    this.previewMaterial.color.setHex(color);
    this.previewLineMaterial.color.setHex(color);

    const blockSize = this.options.world.blockSize;
    const width = this.dimensions.width * blockSize;
    const height = this.dimensions.height * blockSize;
    const depth = this.dimensions.length * blockSize;
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const preview = new THREE.Mesh(geometry, this.previewMaterial);
    preview.position.set(
      worldBlockX(this.options.world, this.previewOrigin.x + this.dimensions.width / 2),
      this.options.world.worldHeight() + height / 2,
      worldBlockZ(this.options.world, this.previewOrigin.z + this.dimensions.length / 2)
    );

    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), this.previewLineMaterial);
    edges.position.copy(preview.position);
    this.previewGroup.add(preview, edges);
  }

  private disposePreview() {
    this.previewGroup.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
        object.geometry.dispose();
      }
    });
  }
}
