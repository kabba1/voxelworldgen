import * as THREE from "three";
import { BLOCKS, type SolidBlockId } from "../world/blocks";

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

const makeMaterial = (texturePath: string) => {
  return new THREE.MeshLambertMaterial({
    map: loadCrispTexture(texturePath)
  });
};

export const loadTerrainMaterials = (): TerrainMaterials => {
  return {
    [BLOCKS.grass]: makeMaterial("/textures/grass.png"),
    [BLOCKS.dirt]: makeMaterial("/textures/dirt.png"),
    [BLOCKS.stone]: makeMaterial("/textures/stone.png"),
    [BLOCKS.path]: makeMaterial("/textures/path.png")
  };
};
