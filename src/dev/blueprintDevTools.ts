import {
  createBlueprintFromOverrides,
  DEV_TEST_SHACK_BLUEPRINT,
  stringifyBlueprint,
  type BlueprintExportOptions,
  type StructureBlueprint,
  type StructureBlueprintOrigin
} from "../world/blueprints";
import type { EditableWorld } from "../world/editableWorld";

type BlueprintDevToolsOptions = {
  editableWorld: EditableWorld;
};

type AgencyBlueprintDevTools = {
  devTestShack: StructureBlueprint;
  exportFromOverrides: (origin: StructureBlueprintOrigin, options: BlueprintExportOptions) => StructureBlueprint;
  jsonFromOverrides: (origin: StructureBlueprintOrigin, options: BlueprintExportOptions) => string;
  copyFromOverrides: (origin: StructureBlueprintOrigin, options: BlueprintExportOptions) => Promise<StructureBlueprint>;
  downloadFromOverrides: (
    origin: StructureBlueprintOrigin,
    options: BlueprintExportOptions,
    fileName?: string
  ) => StructureBlueprint;
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

const safeBlueprintFileName = (blueprint: StructureBlueprint) => `${blueprint.id.replace(/[^a-z0-9_-]+/gi, "_")}.json`;

export const installBlueprintDevTools = ({ editableWorld }: BlueprintDevToolsOptions) => {
  window.agencyBlueprintDev = {
    devTestShack: DEV_TEST_SHACK_BLUEPRINT,
    exportFromOverrides: (origin, options) => createBlueprintFromOverrides(editableWorld, origin, options),
    jsonFromOverrides: (origin, options) => stringifyBlueprint(createBlueprintFromOverrides(editableWorld, origin, options)),
    copyFromOverrides: async (origin, options) => {
      const blueprint = createBlueprintFromOverrides(editableWorld, origin, options);
      await navigator.clipboard.writeText(stringifyBlueprint(blueprint));
      return blueprint;
    },
    downloadFromOverrides: (origin, options, fileName) => {
      const blueprint = createBlueprintFromOverrides(editableWorld, origin, options);
      downloadText(stringifyBlueprint(blueprint), fileName ?? safeBlueprintFileName(blueprint));
      return blueprint;
    }
  };

  return () => {
    if (window.agencyBlueprintDev?.devTestShack.id === DEV_TEST_SHACK_BLUEPRINT.id) {
      delete window.agencyBlueprintDev;
    }
  };
};
