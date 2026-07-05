import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { rotatedFootprint, type StructureDefinition, type StructureInstance } from "../world/structures";
import type { PlotWorld } from "../world/plotWorld";

type StructureDefinitionMap = Record<string, StructureDefinition>;

type StructureSlot = {
  instance: StructureInstance;
  definition: StructureDefinition;
  node: THREE.Object3D;
};

const STRUCTURE_LIFT = 0.025;

const worldX = (world: PlotWorld, x: number) => (x - world.width / 2) * world.blockSize;
const worldZ = (world: PlotWorld, z: number) => (z - world.depth / 2) * world.blockSize;

const assetExtension = (assetPath: string) => assetPath.split("?")[0].split(".").pop()?.toLowerCase() ?? "";

const STRUCTURE_MATERIAL_COLORS: Record<string, { body: number; accent: number }> = {
  starter_house: { body: 0xb68b5d, accent: 0x6c4732 },
  abandoned_house: { body: 0x756f5d, accent: 0x4b473c },
  general_store: { body: 0xb59a62, accent: 0x6f4b2f },
  clinic: { body: 0x98aeb3, accent: 0x5f747a },
  civic_archive: { body: 0x888b86, accent: 0x555955 }
};

const createStructureMaterial = (definition: StructureDefinition, meshName: string, texture?: THREE.Texture) => {
  const palette = STRUCTURE_MATERIAL_COLORS[definition.id] ?? { body: 0x8d8067, accent: 0x5d5246 };
  const name = meshName.toLowerCase();
  const color =
    name.includes("roof") || name.includes("door") || name.includes("trim") || name.includes("window")
      ? palette.accent
      : palette.body;
  const material = new THREE.MeshLambertMaterial({
    color: texture ? 0xffffff : color,
    map: texture,
    side: THREE.DoubleSide,
    flatShading: true,
    wireframe: false
  });
  material.userData.structureRendererOwned = true;
  return material;
};

const disposeMaterial = (material: THREE.Material | THREE.Material[]) => {
  const materials = Array.isArray(material) ? material : [material];
  for (const entry of materials) entry.dispose();
};

const disposeRemovedObject = (object: THREE.Object3D) => {
  if ("geometry" in object && object.geometry instanceof THREE.BufferGeometry) object.geometry.dispose();
  if ("material" in object && object.material) disposeMaterial(object.material as THREE.Material | THREE.Material[]);
};

const applyReadableMaterials = (root: THREE.Object3D, definition: StructureDefinition, texture?: THREE.Texture) => {
  const removeAfterTraversal: THREE.Object3D[] = [];

  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const textureForMesh = child.geometry.attributes.uv ? texture : undefined;
      child.material = createStructureMaterial(definition, child.name, textureForMesh);
      child.frustumCulled = false;
      child.castShadow = false;
      child.receiveShadow = true;
      if (!child.geometry.attributes.normal) child.geometry.computeVertexNormals();
      return;
    }

    if (child instanceof THREE.Line || child instanceof THREE.Points) {
      removeAfterTraversal.push(child);
    }
  });

  for (const child of removeAfterTraversal) {
    child.removeFromParent();
    disposeRemovedObject(child);
  }
};

const normalizeLoadedAsset = (root: THREE.Object3D) => {
  const wrapper = new THREE.Group();
  wrapper.add(root);

  const box = new THREE.Box3().setFromObject(root);
  if (!box.isEmpty()) {
    const center = new THREE.Vector3();
    box.getCenter(center);
    root.position.x -= center.x;
    root.position.y -= box.min.y;
    root.position.z -= center.z;
  }

  wrapper.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.frustumCulled = false;
      child.castShadow = false;
      child.receiveShadow = true;
    }
  });

  return wrapper;
};

const disposeStructureNode = (root: THREE.Object3D) => {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    if (child.userData.structurePlaceholder === true) child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (child.userData.structurePlaceholder === true || material.userData.structureRendererOwned === true) {
        material.dispose();
      }
    }
  });
};

const createRoofGeometry = (width: number, depth: number, height: number) => {
  const roofHeight = Math.max(0.4, height * 0.28);
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const positions = [
    -halfWidth, 0, -halfDepth,
    halfWidth, 0, -halfDepth,
    halfWidth, 0, halfDepth,
    -halfWidth, 0, halfDepth,
    0, roofHeight, 0
  ];
  const indices = [
    0, 1, 4,
    1, 2, 4,
    2, 3, 4,
    3, 0, 4,
    0, 3, 2,
    0, 2, 1
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
};

export class StructureRenderer {
  readonly group = new THREE.Group();

  private readonly gltfLoader = new GLTFLoader();
  private readonly textureLoader = new THREE.TextureLoader();
  private readonly assetCache = new Map<string, Promise<THREE.Object3D>>();
  private readonly textureCache = new Map<string, Promise<THREE.Texture>>();
  private readonly slots = new Map<string, StructureSlot>();
  private generation = 0;

  constructor(
    private readonly world: PlotWorld,
    private readonly definitions: StructureDefinitionMap
  ) {
    this.group.name = "asset-backed-structures";
  }

  setInstances(instances: readonly StructureInstance[]) {
    this.generation += 1;
    const generation = this.generation;
    this.clearSlots();

    for (const instance of instances) {
      const definition = this.definitions[instance.definitionId];
      if (!definition) continue;

      const placeholder = this.createPlaceholder(definition, instance);
      this.group.add(placeholder);
      this.slots.set(instance.id, { instance, definition, node: placeholder });

      if (definition.assetPath) {
        void Promise.all([
          this.loadAsset(definition.assetPath),
          definition.texturePath ? this.loadTexture(definition.texturePath).catch(() => undefined) : Promise.resolve(undefined)
        ])
          .then(([asset, texture]) => {
            if (generation !== this.generation) return;
            this.replaceSlot(instance.id, asset.clone(true), texture);
          })
          .catch(() => {
            // Keep the placeholder visible if this asset cannot load.
          });
      }
    }
  }

  dispose() {
    this.generation += 1;
    this.clearSlots();
    for (const texturePromise of this.textureCache.values()) {
      void texturePromise.then((texture) => texture.dispose()).catch(() => undefined);
    }
    this.textureCache.clear();
    this.group.removeFromParent();
  }

  private loadAsset(assetPath: string) {
    let cached = this.assetCache.get(assetPath);
    if (!cached) {
      cached = this.loadUncachedAsset(assetPath);
      this.assetCache.set(assetPath, cached);
    }
    return cached;
  }

  private loadTexture(texturePath: string) {
    let cached = this.textureCache.get(texturePath);
    if (!cached) {
      cached = this.loadUncachedTexture(texturePath);
      this.textureCache.set(texturePath, cached);
    }
    return cached;
  }

  private async loadUncachedTexture(texturePath: string) {
    const texture = await this.textureLoader.loadAsync(texturePath);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestMipmapNearestFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
  }

  private async loadUncachedAsset(assetPath: string) {
    const extension = assetExtension(assetPath);

    if (extension === "glb" || extension === "gltf") {
      const gltf = await this.gltfLoader.loadAsync(assetPath);
      return normalizeLoadedAsset(gltf.scene);
    }

    if (extension === "obj") {
      const loader = new OBJLoader();
      return normalizeLoadedAsset(await loader.loadAsync(assetPath));
    }

    throw new Error(`Unsupported structure asset type: ${assetPath}`);
  }

  private replaceSlot(instanceId: string, model: THREE.Object3D, texture?: THREE.Texture) {
    const slot = this.slots.get(instanceId);
    if (!slot) return;

    this.group.remove(slot.node);
    disposeStructureNode(slot.node);
    if (slot.definition.assetPath && assetExtension(slot.definition.assetPath) === "obj") {
      applyReadableMaterials(model, slot.definition, texture);
    }
    this.placeNode(model, slot.definition, slot.instance);
    this.group.add(model);
    slot.node = model;
  }

  private createPlaceholder(definition: StructureDefinition, instance: StructureInstance) {
    const footprint = rotatedFootprint(definition, instance.rotation);
    const width = footprint.width * this.world.blockSize;
    const depth = footprint.depth * this.world.blockSize;
    const height = definition.height * this.world.blockSize;
    const group = new THREE.Group();
    group.name = `structure-placeholder-${instance.id}`;

    const bodyHeight = Math.max(0.6, height * 0.72);
    const bodyGeometry = new THREE.BoxGeometry(width * 0.78, bodyHeight, depth * 0.72);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x8d8067 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = bodyHeight / 2;
    body.userData.structurePlaceholder = true;
    group.add(body);

    const roofGeometry = createRoofGeometry(width * 0.86, depth * 0.82, height);
    const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x6f3f34 });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = bodyHeight;
    roof.userData.structurePlaceholder = true;
    group.add(roof);

    this.placeNode(group, definition, instance, false);
    return group;
  }

  private placeNode(
    node: THREE.Object3D,
    definition: StructureDefinition,
    instance: StructureInstance,
    applyDefinitionScale = true
  ) {
    const footprint = rotatedFootprint(definition, instance.rotation);
    const centerX = instance.x + footprint.width / 2;
    const centerZ = instance.z + footprint.depth / 2;

    node.name = `structure-${instance.id}`;
    node.userData.structureInstanceId = instance.id;
    node.userData.structureDefinitionId = definition.id;
    node.position.set(
      worldX(this.world, centerX),
      this.world.worldHeight() + STRUCTURE_LIFT,
      worldZ(this.world, centerZ)
    );
    node.rotation.y = THREE.MathUtils.degToRad(instance.rotation);
    node.scale.setScalar(applyDefinitionScale ? definition.scale ?? 1 : 1);
  }

  private clearSlots() {
    for (const slot of this.slots.values()) {
      this.group.remove(slot.node);
      disposeStructureNode(slot.node);
    }
    this.slots.clear();
  }
}
