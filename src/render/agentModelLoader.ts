import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  getAgentModelDefinition,
  type AgentModelDefinition
} from "../agents/agentModels";

export type LoadedAgentModel = {
  definition: AgentModelDefinition;
  root: THREE.Group;
  animations: THREE.AnimationClip[];
};

export class AgentModelLoader {
  private readonly loader = new GLTFLoader();
  private readonly cache = new Map<string, Promise<GLTF>>();

  async load(modelId: string) {
    const definition = getAgentModelDefinition(modelId);
    if (!definition) {
      throw new Error(`Unknown agent model id: ${modelId}`);
    }

    return this.loadDefinition(definition);
  }

  async loadDefinition(definition: AgentModelDefinition): Promise<LoadedAgentModel> {
    const gltf = await this.loadGltf(definition);
    const root = cloneSkeleton(gltf.scene) as THREE.Group;
    root.name = `agent-model:${definition.id}`;
    root.traverse((object) => {
      object.frustumCulled = true;
      if (object instanceof THREE.Mesh) {
        object.castShadow = false;
        object.receiveShadow = false;
      }
    });

    return {
      definition,
      root,
      animations: gltf.animations
    };
  }

  preload(definitions: readonly AgentModelDefinition[]) {
    return Promise.all(definitions.map((definition) => this.loadGltf(definition)));
  }

  private loadGltf(definition: AgentModelDefinition) {
    let promise = this.cache.get(definition.id);
    if (!promise) {
      promise = this.loader.loadAsync(definition.url);
      this.cache.set(definition.id, promise);
    }
    return promise;
  }
}
