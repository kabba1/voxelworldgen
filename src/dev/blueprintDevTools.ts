import {
  blueprintToJson,
  createBlueprintFromOverrides,
  DEV_TEST_SHACK_BLUEPRINT,
  stringifyBlueprint,
  type BlueprintExportOptions,
  type StructureBlueprint,
  type StructureBlueprintJson,
  type StructureBlueprintOrigin
} from "../world/blueprints";
import type { EditableWorld } from "../world/editableWorld";

type BlueprintDevToolsOptions = {
  editableWorld: EditableWorld;
};

type AgencyBlueprintDevTools = {
  devTestShack: StructureBlueprint;
  exportFromOverrides: (origin: StructureBlueprintOrigin, options: BlueprintExportOptions) => StructureBlueprintJson;
  jsonFromOverrides: (origin: StructureBlueprintOrigin, options: BlueprintExportOptions) => string;
  copyFromOverrides: (origin: StructureBlueprintOrigin, options: BlueprintExportOptions) => Promise<StructureBlueprintJson>;
  downloadFromOverrides: (
    origin: StructureBlueprintOrigin,
    options: BlueprintExportOptions,
    fileName?: string
  ) => StructureBlueprintJson;
};

declare global {
  interface Window {
    agencyBlueprintDev?: AgencyBlueprintDevTools;
  }
}

const downloadText = (text: string, fileName: string) => {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const safeBlueprintFileName = (blueprint: Pick<StructureBlueprint, "id">) =>
  `${blueprint.id.replace(/[^a-z0-9_-]+/gi, "_")}.json`;

export const installBlueprintDevTools = ({ editableWorld }: BlueprintDevToolsOptions) => {
  window.agencyBlueprintDev = {
    devTestShack: DEV_TEST_SHACK_BLUEPRINT,
    exportFromOverrides: (origin, options) => blueprintToJson(createBlueprintFromOverrides(editableWorld, origin, options)),
    jsonFromOverrides: (origin, options) => stringifyBlueprint(createBlueprintFromOverrides(editableWorld, origin, options)),
    copyFromOverrides: async (origin, options) => {
      const blueprint = createBlueprintFromOverrides(editableWorld, origin, options);
      const blueprintJson = blueprintToJson(blueprint);
      await navigator.clipboard.writeText(stringifyBlueprint(blueprint));
      return blueprintJson;
    },
    downloadFromOverrides: (origin, options, fileName) => {
      const blueprint = createBlueprintFromOverrides(editableWorld, origin, options);
      const blueprintJson = blueprintToJson(blueprint);
      downloadText(stringifyBlueprint(blueprint), fileName ?? safeBlueprintFileName(blueprint));
      return blueprintJson;
    }
  };

  return () => {
    if (window.agencyBlueprintDev?.devTestShack.id === DEV_TEST_SHACK_BLUEPRINT.id) {
      delete window.agencyBlueprintDev;
    }
  };
};
