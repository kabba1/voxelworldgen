import type { BlockEditor } from "../input/BlockEditor";
import { ACTIVE_SOLID_BLOCKS, BLOCK_DEFINITIONS, type SolidBlockId } from "../world/blocks";

type BlockPaletteOverlayOptions = {
  editor: BlockEditor;
};

const blockColor = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

export class BlockPaletteOverlay {
  readonly element: HTMLElement;

  private readonly currentSwatch: HTMLSpanElement;
  private readonly currentKey: HTMLSpanElement;
  private readonly buttons = new Map<SolidBlockId, HTMLButtonElement>();
  private lastHeldBlock: SolidBlockId | null | undefined;

  constructor(private readonly options: BlockPaletteOverlayOptions) {
    this.element = document.createElement("section");
    this.element.className = "block-palette";
    this.element.setAttribute("aria-label", "Dev block palette");

    const header = document.createElement("div");
    header.className = "block-palette__header";

    const title = document.createElement("strong");
    title.textContent = "Block Palette";

    const current = document.createElement("div");
    current.className = "block-palette__current";
    this.currentSwatch = document.createElement("span");
    this.currentSwatch.className = "block-palette__current-swatch";
    this.currentKey = document.createElement("span");
    current.append(this.currentSwatch, this.currentKey);

    header.append(title, current);

    const list = document.createElement("div");
    list.className = "block-palette__list";

    for (const definition of ACTIVE_SOLID_BLOCKS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "block-palette__option";
      button.setAttribute("aria-label", `Hold ${definition.name}`);
      button.title = definition.name;

      const swatch = document.createElement("span");
      swatch.className = "block-palette__swatch";
      swatch.style.backgroundColor = blockColor(definition.color);
      swatch.style.backgroundImage = `url("${definition.texturePath}")`;

      const label = document.createElement("span");
      label.className = "block-palette__label";
      label.textContent = definition.key;

      button.append(swatch, label);
      button.addEventListener("click", () => {
        this.options.editor.setHeldBlock(definition.id);
        this.update();
      });

      this.buttons.set(definition.id, button);
      list.appendChild(button);
    }

    this.element.append(header, list);
    document.body.appendChild(this.element);
    this.update();
  }

  update() {
    const heldBlock = this.options.editor.getState().heldBlock;
    if (heldBlock === this.lastHeldBlock) return;

    this.lastHeldBlock = heldBlock;
    for (const [blockId, button] of this.buttons) {
      button.classList.toggle("is-active", blockId === heldBlock);
      button.setAttribute("aria-pressed", String(blockId === heldBlock));
      if (blockId === heldBlock) button.scrollIntoView({ block: "nearest" });
    }

    if (heldBlock === null) {
      this.currentSwatch.style.backgroundColor = "transparent";
      this.currentSwatch.style.backgroundImage = "";
      this.currentKey.textContent = "none";
      return;
    }

    const definition = BLOCK_DEFINITIONS[heldBlock];
    this.currentSwatch.style.backgroundColor = blockColor(definition.color);
    this.currentSwatch.style.backgroundImage = `url("${definition.texturePath}")`;
    this.currentKey.textContent = definition.key;
  }

  dispose() {
    this.element.remove();
  }
}
