import * as THREE from "three";
import type { Plot } from "../world/plots";
import type { PlotWorld } from "../world/plotWorld";

type PlotInspectorOptions = {
  camera: THREE.PerspectiveCamera;
  domElement: HTMLCanvasElement;
  terrainGroup: THREE.Group;
  world: PlotWorld;
  viewerAgentId?: string;
  structureNameForPlot?: (plotId: string) => string | null;
  inspectableGroups?: THREE.Object3D[];
  describeColumn?: (x: number, z: number, plot: Plot | null, canBuild: boolean) => InspectionInfo | null;
};

const INSPECTION_REACH = 1800;
const HIGHLIGHT_LIFT = 0.035;

export type InspectionInfo = {
  title: string;
  rows: Array<[string, string]>;
  plot?: Plot | null;
};

const columnFromPoint = (world: PlotWorld, point: THREE.Vector3) => ({
  x: Math.floor(point.x / world.blockSize + world.width / 2),
  z: Math.floor(point.z / world.blockSize + world.depth / 2)
});

const worldX = (world: PlotWorld, x: number) => (x - world.width / 2) * world.blockSize;
const worldZ = (world: PlotWorld, z: number) => (z - world.depth / 2) * world.blockSize;

const setText = (element: HTMLElement, text: string) => {
  element.textContent = text;
};

export class PlotInspector {
  readonly group = new THREE.Group();

  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly panel: HTMLDivElement;
  private readonly fillMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd166,
    depthWrite: false,
    transparent: true,
    opacity: 0.26
  });
  private readonly borderMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff,
    depthWrite: false,
    transparent: true,
    opacity: 0.95
  });

  private selectedPlot: Plot | null = null;

  constructor(private readonly options: PlotInspectorOptions) {
    this.group.name = "plot-inspector-highlight";
    this.raycaster.far = INSPECTION_REACH;

    this.panel = document.createElement("div");
    this.panel.className = "plot-inspector plot-inspector--empty";
    document.body.appendChild(this.panel);

    this.renderPanel(null);
    options.domElement.addEventListener("mousedown", this.onMouseDown);
  }

  dispose() {
    this.options.domElement.removeEventListener("mousedown", this.onMouseDown);
    this.clearHighlight();
    this.fillMaterial.dispose();
    this.borderMaterial.dispose();
    this.panel.remove();
  }

  inspectColumn(x: number, z: number) {
    const plot = this.options.world.plotAt(x, z);
    const canBuild = plot ? this.options.world.canBuild(this.viewerAgentId(), x, z) : false;
    const info = this.options.describeColumn?.(x, z, plot, canBuild) ?? this.plotInspectionInfo(plot, canBuild);
    this.renderInspection(info);
    return true;
  }

  private onMouseDown = (event: MouseEvent) => {
    if (document.pointerLockElement === this.options.domElement) return;
    if (event.button !== 0) return;

    const rect = this.options.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    this.raycaster.setFromCamera(this.pointer, this.options.camera);

    const objectHit = this.options.inspectableGroups
      ?.flatMap((group) => this.raycaster.intersectObjects(group.children, true))
      .sort((a, b) => a.distance - b.distance)[0];
    const objectInfo = objectHit ? this.inspectableInfoFor(objectHit.object) : null;
    if (objectInfo) {
      event.preventDefault();
      this.renderInspection(objectInfo);
      return;
    }

    const hit = this.raycaster.intersectObjects(this.options.terrainGroup.children, true)[0];
    if (!hit) return;

    event.preventDefault();
    const column = columnFromPoint(this.options.world, hit.point);
    this.inspectColumn(column.x, column.z);
  };

  private inspectableInfoFor(object: THREE.Object3D): InspectionInfo | null {
    let current: THREE.Object3D | null = object;
    while (current) {
      const inspectInfo = current.userData.inspectInfo;
      if (typeof inspectInfo === "function") return inspectInfo() as InspectionInfo;
      current = current.parent;
    }
    return null;
  }

  private viewerAgentId() {
    return this.options.viewerAgentId ?? "local-player";
  }

  private renderHighlight(plot: Plot | null) {
    this.clearHighlight();
    if (!plot) return;

    const x0 = worldX(this.options.world, plot.x);
    const x1 = worldX(this.options.world, plot.x + plot.width);
    const z0 = worldZ(this.options.world, plot.z);
    const z1 = worldZ(this.options.world, plot.z + plot.depth);
    const y = this.options.world.worldHeight() + HIGHLIGHT_LIFT;

    const fillGeometry = new THREE.BufferGeometry();
    fillGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          x0, y, z1,
          x1, y, z1,
          x1, y, z0,
          x0, y, z0
        ],
        3
      )
    );
    fillGeometry.setIndex([0, 1, 2, 0, 2, 3]);
    fillGeometry.computeBoundingSphere();

    const fill = new THREE.Mesh(fillGeometry, this.fillMaterial);
    fill.name = "selected-plot-fill";
    fill.frustumCulled = false;
    this.group.add(fill);

    const borderGeometry = new THREE.BufferGeometry();
    borderGeometry.setFromPoints([
      new THREE.Vector3(x0, y + 0.004, z0),
      new THREE.Vector3(x1, y + 0.004, z0),
      new THREE.Vector3(x1, y + 0.004, z1),
      new THREE.Vector3(x0, y + 0.004, z1),
      new THREE.Vector3(x0, y + 0.004, z0)
    ]);

    const border = new THREE.Line(borderGeometry, this.borderMaterial);
    border.name = "selected-plot-border";
    border.frustumCulled = false;
    this.group.add(border);
  }

  private clearHighlight() {
    for (const child of this.group.children) {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) child.geometry.dispose();
    }
    this.group.clear();
  }

  private renderInspection(info: InspectionInfo | null) {
    this.selectedPlot = info?.plot ?? null;
    this.renderHighlight(this.selectedPlot);
    this.renderPanel(info);
  }

  private plotInspectionInfo(plot: Plot | null, canBuild: boolean): InspectionInfo | null {
    if (!plot) return null;

    const ownerAgentId = plot.ownerAgentId ?? null;
    const structureName = this.options.structureNameForPlot?.(plot.id) ?? null;
    return {
      title: "Plot",
      plot,
      rows: [
        ["id", plot.id],
        ["land", "claimable plot"],
        ["structure", structureName ?? "none"],
        ["group", String(plot.group)],
        ["width x depth", `${plot.width} x ${plot.depth}`],
        ["area", String(plot.area)],
        ["claimed", ownerAgentId ? "claimed" : "unclaimed"],
        ["ownerAgentId", ownerAgentId ?? "none"],
        ["canBuild", canBuild ? "yes" : "no"]
      ]
    };
  }

  private renderPanel(info: InspectionInfo | null) {
    this.panel.classList.toggle("plot-inspector--empty", info === null);
    this.panel.replaceChildren();

    const title = document.createElement("div");
    title.className = "plot-inspector__title";
    setText(title, info?.title ?? "World");
    this.panel.appendChild(title);

    if (!info) {
      const empty = document.createElement("div");
      empty.className = "plot-inspector__empty";
      setText(empty, "No object selected");
      this.panel.appendChild(empty);
      return;
    }

    for (const [label, value] of info.rows) {
      const row = document.createElement("div");
      row.className = "plot-inspector__row";

      const labelElement = document.createElement("span");
      labelElement.className = "plot-inspector__label";
      setText(labelElement, label);

      const valueElement = document.createElement("span");
      valueElement.className = "plot-inspector__value";
      setText(valueElement, value);

      row.append(labelElement, valueElement);
      this.panel.appendChild(row);
    }
  }
}
