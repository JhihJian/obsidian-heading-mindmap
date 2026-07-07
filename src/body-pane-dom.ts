import { ButtonComponent, setTooltip } from "obsidian";
import { toggleBodyPaneMode, type BodyPaneMode } from "./body-pane-mode";

export interface BodyPaneShellOptions {
  title: string;
  meta: string;
  mode: BodyPaneMode;
  minimized: boolean;
  readonly: boolean;
  onToggleMinimized: () => void;
  onSetMode: (mode: BodyPaneMode) => void;
}

export interface BodyPaneResizerOptions {
  updateAria: (resizer: HTMLElement) => void;
  onPointerDown: (event: PointerEvent, resizer: HTMLElement) => void;
  onKeydown: (event: KeyboardEvent, resizer: HTMLElement) => void;
}

export function renderBodyPaneShell(container: HTMLElement, options: BodyPaneShellOptions): HTMLElement {
  const pane = container.createDiv({
    cls: `heading-mindmap-body-pane${options.minimized ? " is-minimized" : ""}`
  });
  const header = pane.createDiv({ cls: "heading-mindmap-body-header" });
  const heading = header.createDiv({ cls: "heading-mindmap-body-heading" });
  heading.createDiv({ text: options.title, cls: "heading-mindmap-body-title" });
  heading.createDiv({ text: options.meta, cls: "heading-mindmap-body-meta" });

  const actions = header.createDiv({ cls: "heading-mindmap-body-actions" });
  const minimizeButton = new ButtonComponent(actions)
    .setIcon(options.minimized ? "panel-bottom-open" : "panel-bottom-close")
    .setTooltip(options.minimized ? "展开正文区域" : "最小化正文区域")
    .onClick(() => {
      minimizeButton.buttonEl.blur();
      options.onToggleMinimized();
    });
  minimizeButton.buttonEl.addClass("heading-mindmap-body-minimize-button");

  if (!options.readonly && !options.minimized) {
    const modeButton = new ButtonComponent(actions)
      .setIcon(options.mode === "preview" ? "pencil" : "book-open")
      .setTooltip(options.mode === "preview" ? "切换到编辑视图" : "切换到阅读视图")
      .onClick(() => {
        modeButton.buttonEl.blur();
        options.onSetMode(toggleBodyPaneMode(options.mode, false));
      });
    modeButton.buttonEl.addClass("heading-mindmap-body-mode-button");
  }

  return pane;
}

export function renderBodyPaneResizerElement(container: HTMLElement, options: BodyPaneResizerOptions): HTMLElement {
  const resizer = container.createDiv({ cls: "heading-mindmap-body-resizer" });
  resizer.tabIndex = 0;
  resizer.setAttr("role", "separator");
  resizer.setAttr("aria-orientation", "horizontal");
  resizer.setAttr("aria-label", "调整正文区域高度");
  setTooltip(resizer, "拖拽调整正文区域高度");
  options.updateAria(resizer);

  resizer.onpointerdown = (event) => {
    options.onPointerDown(event, resizer);
  };
  resizer.onkeydown = (event) => {
    options.onKeydown(event, resizer);
  };
  return resizer;
}
