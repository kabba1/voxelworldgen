import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { FlatWorld } from "../world/flatWorld";

type CharacterWalkerOptions = {
  assetPath: string;
  centerX: number;
  centerZ: number;
  radiusBlocks?: number;
  speedBlocksPerSecond?: number;
  targetHeightBlocks?: number;
};

const worldX = (world: FlatWorld, x: number) => (x - world.width / 2) * world.blockSize;
const worldZ = (world: FlatWorld, z: number) => (z - world.depth / 2) * world.blockSize;

export class CharacterWalker {
  readonly group = new THREE.Group();

  private readonly loader = new GLTFLoader();
  private mixer: THREE.AnimationMixer | null = null;
  private phase = -Math.PI / 2;
  private loadToken = 0;

  constructor(
    private readonly world: FlatWorld,
    private readonly options: CharacterWalkerOptions
  ) {
    this.group.name = "walking-character";
    this.group.position.y = this.world.worldHeight();
    this.positionOnRoute();
  }

  async load() {
    const token = (this.loadToken += 1);
    const gltf = await this.loader.loadAsync(this.options.assetPath);
    if (token !== this.loadToken) return;

    this.group.clear();
    const model = gltf.scene;
    model.name = "character-model";
    this.scaleToWorld(model);
    this.group.add(model);

    this.mixer = new THREE.AnimationMixer(model);
    const clip = THREE.AnimationClip.findByName(gltf.animations, "Walk") ?? gltf.animations[0];
    if (clip) {
      const action = this.mixer.clipAction(clip);
      action.reset();
      action.play();
    }
  }

  update(deltaSeconds: number) {
    this.mixer?.update(deltaSeconds);

    const radiusBlocks = this.options.radiusBlocks ?? 18;
    const speedBlocksPerSecond = this.options.speedBlocksPerSecond ?? 3.4;
    this.phase += (speedBlocksPerSecond / Math.max(1, radiusBlocks)) * deltaSeconds;
    this.positionOnRoute();
  }

  dispose() {
    this.loadToken += 1;
    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.dispose();
    });
    this.group.clear();
    this.mixer = null;
  }

  private positionOnRoute() {
    const radiusBlocks = this.options.radiusBlocks ?? 18;
    const x = this.options.centerX + Math.cos(this.phase) * radiusBlocks;
    const z = this.options.centerZ + Math.sin(this.phase) * radiusBlocks;
    this.group.position.set(worldX(this.world, x), this.world.worldHeight(), worldZ(this.world, z));

    const nextPhase = this.phase + 0.01;
    const nextX = this.options.centerX + Math.cos(nextPhase) * radiusBlocks;
    const nextZ = this.options.centerZ + Math.sin(nextPhase) * radiusBlocks;
    const dx = worldX(this.world, nextX) - this.group.position.x;
    const dz = worldZ(this.world, nextZ) - this.group.position.z;
    this.group.rotation.y = Math.atan2(dx, dz);
  }

  private scaleToWorld(model: THREE.Object3D) {
    const bounds = new THREE.Box3().setFromObject(model);
    const height = bounds.max.y - bounds.min.y;
    const targetHeight = (this.options.targetHeightBlocks ?? 2.35) * this.world.blockSize;
    const scale = height > 0 ? targetHeight / height : 1;
    model.scale.setScalar(scale);

    const scaledBounds = new THREE.Box3().setFromObject(model);
    model.position.y -= scaledBounds.min.y;
  }
}
