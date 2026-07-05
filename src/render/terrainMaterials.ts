import * as THREE from "three";
import { ACTIVE_SOLID_BLOCKS, type SolidBlockDefinition, type SolidBlockId } from "../world/blocks";

export type TerrainMaterials = Record<SolidBlockId, THREE.MeshLambertMaterial>;

const loader = new THREE.TextureLoader();

const loadCrispTexture = (path: string) => {
  const texture = loader.load(path);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapNearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

const makeMaterial = (definition: SolidBlockDefinition) => {
  if (!definition.texturePath) {
    throw new Error(`Missing texture path for active solid block: ${definition.name}`);
  }

  return new THREE.MeshLambertMaterial({
    map: loadCrispTexture(definition.texturePath),
    side: THREE.FrontSide
  });
};

export const loadTerrainMaterials = (): TerrainMaterials => {
  const entries = ACTIVE_SOLID_BLOCKS.map((definition) => [definition.id, makeMaterial(definition)] as const);
  const materials = Object.fromEntries(entries) as TerrainMaterials;

  for (const definition of ACTIVE_SOLID_BLOCKS) {
    if (!materials[definition.id]) {
      throw new Error(`Missing material for active solid block: ${definition.name}`);
    }
  }

  return materials;
};
