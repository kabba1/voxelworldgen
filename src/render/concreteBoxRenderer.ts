import * as THREE from "three";
import type { TerrainMaterials } from "./terrainMaterials";
import { BLOCK_DEFINITIONS, type ConcreteBlockId } from "../world/blocks";
import {
  shellCellsForConcreteBox,
  type ConcreteBlockCell,
  type ConcreteBoxInstance,
  type ConcreteBoxSpec
} from "../world/concreteBoxes";
import type { PlotWorld } from "../world/plotWorld";

type ConcreteBoxRendererOptions = {
  world: PlotWorld;
  materials: TerrainMaterials;
  boxes: readonly ConcreteBoxSpec[];
};

const worldBlockX = (world: PlotWorld, x: number) => (x - world.width / 2) * world.blockSize;
const worldBlockY = (world: PlotWorld, y: number) => y * world.blockSize;
const worldBlockZ = (world: PlotWorld, z: number) => (z - world.depth / 2) * world.blockSize;

export class ConcreteBoxRenderer {
  readonly group = new THREE.Group();

  private readonly cubeGeometry: THREE.BoxGeometry;
  private readonly matrixDummy = new THREE.Object3D();
  private boxes: ConcreteBoxSpec[];

  constructor(private readonly options: ConcreteBoxRendererOptions) {
    this.group.name = "concrete-boxes";
    this.cubeGeometry = new THREE.BoxGeometry(options.world.blockSize, options.world.blockSize, options.world.blockSize);
    this.boxes = [...options.boxes];
    this.rebuild();
  }

  setBoxes(boxes: readonly ConcreteBoxSpec[]) {
    this.boxes = [...boxes];
    this.rebuild();
  }

  dispose() {
    this.cubeGeometry.dispose();
    this.group.clear();
  }

  private rebuild() {
    this.group.clear();
    const cellsByBlock = new Map<ConcreteBlockId, ConcreteBlockCell[]>();

    this.boxes.forEach((box, index) => {
      const instance: ConcreteBoxInstance = {
        ...box,
        id: index + 1,
        y: box.y ?? this.options.world.height
      };
      const cells = cellsByBlock.get(box.blockId) ?? [];
      cells.push(...shellCellsForConcreteBox(instance));
      cellsByBlock.set(box.blockId, cells);
    });

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
      this.group.add(mesh);
    }
  }
}
