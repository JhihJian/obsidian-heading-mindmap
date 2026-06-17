import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { spawn, execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const port = Number(process.env.OBSIDIAN_E2E_PORT ?? 9240);
const root = join(tmpdir(), `obsidian-mindmap-e2e-${port}`);
const vault = join(root, "vault");
const userData = join(root, "user-data");
const obsidianExe = process.env.OBSIDIAN_EXE ?? "C:\\Program Files\\Obsidian\\Obsidian.exe";
const pluginDir = join(vault, ".obsidian", "plugins", "heading-mindmap");

function ps(script) {
  return execFileSync("powershell", ["-NoProfile", "-Command", script], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function stopTempObsidian() {
  const escaped = userData.replaceAll("'", "''");
  ps(`Get-CimInstance Win32_Process -Filter "name = 'Obsidian.exe'" |
    Where-Object { $_.CommandLine -like "*${escaped}*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`);
}

function setupVault() {
  stopTempObsidian();
  rmSync(root, { recursive: true, force: true });
  mkdirSync(pluginDir, { recursive: true });
  mkdirSync(userData, { recursive: true });
  copyFileSync("main.js", join(pluginDir, "main.js"));
  copyFileSync("manifest.json", join(pluginDir, "manifest.json"));
  copyFileSync("styles.css", join(pluginDir, "styles.css"));
  writeFileSync(join(vault, ".obsidian", "app.json"), "{}", "utf8");
  writeFileSync(join(vault, ".obsidian", "appearance.json"), "{}", "utf8");
  writeFileSync(join(vault, ".obsidian", "community-plugins.json"), "[\"heading-mindmap\"]", "utf8");
  writeFileSync(
    join(userData, "obsidian.json"),
    JSON.stringify({
      vaults: {
        "heading-mindmap-e2e": {
          path: vault,
          ts: Date.now(),
          open: true
        }
      }
    }),
    "utf8"
  );
  writeFileSync(
    join(vault, "产品路线图.md"),
    [
      "# 产品路线图",
      "",
      "根节点正文 **加粗**，包含 [[目标文件]] 链接和列表。",
      "",
      "- 待办一",
      "- [ ] 待办二",
      "",
      "## 目标",
      "",
      "目标正文第一段。",
      "",
      "### 子目标",
      "",
      "子目标正文。",
      "",
      "## [[目标文件|目标文件]]",
      "",
      "文件节点备注。",
      "",
      "## 风险",
      "",
      "> 风险引用块。",
      "",
      "```ts",
      "const demo = \"代码块\";",
      "```",
      ""
    ].join("\n"),
    "utf8"
  );
  writeFileSync(
    join(vault, "目标文件.md"),
    ["# 目标文件", "", "目标文件正文。", "", "## 外部章节", "", "外部章节正文。", ""].join("\n"),
    "utf8"
  );
}

async function waitForDebugPort() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return;
    } catch {
      // Retry until Obsidian exposes CDP.
    }
    await sleep(500);
  }
  throw new Error(`Obsidian debug port ${port} not ready`);
}

async function getPage() {
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
  const page = targets.find((target) => target.type === "page");
  if (!page) throw new Error("No Obsidian page target");
  return page;
}

async function cdp(method, params = {}, timeoutMs = 5000) {
  const page = await getPage();
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  return await new Promise((resolve) => {
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      try {
        ws.close();
      } catch {
        // Ignore close races.
      }
      resolve({ pageTitle: page.title, method, ...value });
    };
    ws.addEventListener("open", () => ws.send(JSON.stringify({ id: 1, method, params })));
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id === 1) finish({ message });
    });
    ws.addEventListener("error", (event) => finish({ error: String(event.message || event.type) }));
    setTimeout(() => finish({ timeout: true }), timeoutMs);
  });
}

async function evaluate(expression, timeoutMs = 5000) {
  const result = await cdp(
    "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise: true },
    timeoutMs
  );
  const exception = result.message?.result?.exceptionDetails;
  if (result.timeout || result.error || result.message?.error || exception) {
    throw new Error(JSON.stringify({
      pageTitle: result.pageTitle,
      timeout: result.timeout,
      error: result.error || result.message?.error,
      exception
    }, null, 2));
  }
  return result.message.result.result.value;
}

async function waitForApp() {
  for (let i = 0; i < 60; i += 1) {
    const ready = await cdp(
      "Runtime.evaluate",
      { expression: "Boolean(window.app && app.workspace && app.vault)", returnByValue: true },
      2000
    );
    if (ready.message?.result?.result?.value === true) return;
    await sleep(500);
  }
  throw new Error("window.app not ready");
}

function assert(condition, message, details) {
  if (!condition) {
    const suffix = details === undefined ? "" : `\n${JSON.stringify(details, null, 2)}`;
    throw new Error(`${message}${suffix}`);
  }
}

async function main() {
  setupVault();
  const child = spawn(obsidianExe, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userData}`,
    vault
  ], {
    detached: false,
    stdio: "ignore",
    windowsHide: true
  });

  try {
    await waitForDebugPort();
    await waitForApp();
    const report = await evaluate(`
      (async () => {
        await app.plugins.setEnable(true);
        await app.plugins.loadManifests();
        await app.plugins.enablePluginAndSave('heading-mindmap');
        for (let i = 0; i < 20; i += 1) {
          if (app.commands.commands['heading-mindmap:open']) break;
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        for (const leaf of app.workspace.getLeavesOfType('heading-mindmap-view')) {
          leaf.detach();
        }
        await new Promise((resolve) => setTimeout(resolve, 300));

        let product = null;
        const fence = String.fromCharCode(96).repeat(3);
        for (const file of app.vault.getMarkdownFiles()) {
          const text = await app.vault.read(file);
          if (text.includes('**') && text.includes(fence)) product = file;
        }
        const markdownLeaf = app.workspace.getLeaf(false);
        await markdownLeaf.openFile(product);
        app.workspace.setActiveLeaf(markdownLeaf, { focus: true });
        app.workspace.revealLeaf(markdownLeaf);
        await new Promise((resolve) => setTimeout(resolve, 700));

        await app.commands.executeCommandById('heading-mindmap:open');
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const visibleView = () => Array.from(document.querySelectorAll('.heading-mindmap-view')).find((view) => {
          const rect = view.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
        const pageState = () => ({
          title: document.title,
          activeType: app.workspace.activeLeaf?.view?.getViewType?.() || null,
          activeFile: app.workspace.getActiveFile()?.path || null,
          pluginLoaded: Boolean(app.plugins.plugins['heading-mindmap']),
          pluginEnabled: app.plugins.enabledPlugins?.has?.('heading-mindmap') ?? null,
          commands: Object.keys(app.commands.commands).filter((id) => id.includes('heading-mindmap')).sort(),
          mindmapLeaves: app.workspace.getLeavesOfType('heading-mindmap-view').length,
          totalMindmapViews: document.querySelectorAll('.heading-mindmap-view').length,
          leafTypes: Array.from(document.querySelectorAll('.workspace-leaf-content')).map((leaf) => leaf.getAttribute('data-type'))
        });
        const labels = (root) => Array.from(root.querySelectorAll('.heading-mindmap-node')).map((node) => (
          (node.querySelector('.heading-mindmap-node-badge')?.textContent || '') + ':' +
          (node.querySelector('.heading-mindmap-node-title')?.textContent || '')
        ));
        const findByBadge = (root, badge) => Array.from(root.querySelectorAll('.heading-mindmap-node')).find(
          (node) => node.querySelector('.heading-mindmap-node-badge')?.textContent === badge
        );
        const findByLabel = (root, prefix) => Array.from(root.querySelectorAll('.heading-mindmap-node')).find(
          (node) => ((node.querySelector('.heading-mindmap-node-badge')?.textContent || '') + ':' +
            (node.querySelector('.heading-mindmap-node-title')?.textContent || '')).startsWith(prefix)
        );
        const findExactLabel = (root, label) => Array.from(root.querySelectorAll('.heading-mindmap-node')).find(
          (node) => ((node.querySelector('.heading-mindmap-node-badge')?.textContent || '') + ':' +
            (node.querySelector('.heading-mindmap-node-title')?.textContent || '')) === label
        );
        const selected = (root) => ({
          title: root.querySelector('.heading-mindmap-node.is-selected .heading-mindmap-node-title')?.textContent || '',
          badge: root.querySelector('.heading-mindmap-node.is-selected .heading-mindmap-node-badge')?.textContent || ''
        });
        const waitForTitleInput = async () => {
          for (let i = 0; i < 20; i += 1) {
            const viewRoot = visibleView();
            const input = viewRoot?.querySelector('.heading-mindmap-node-title-input');
            if (input) return { root: viewRoot, input };
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          return { root: visibleView(), input: null };
        };
        const getCtrlEnterFocusState = (viewRoot) => {
          const view = app.workspace.getLeavesOfType('heading-mindmap-view')[0]?.view;
          return {
            selected: selected(viewRoot),
            internalSelected: view?.getSelectedNode?.()?.title || null,
            bodyPaneMode: view?.bodyPaneMode || null,
            hasBodyEditor: Boolean(view?.bodyEditorView),
            bodyTitle: viewRoot?.querySelector('.heading-mindmap-body-title')?.textContent || null,
            modeButtonCount: viewRoot?.querySelectorAll('.heading-mindmap-body-mode-button').length ?? 0,
            sourceView: viewRoot?.querySelectorAll('.markdown-source-view.mod-cm6.cm-s-obsidian').length ?? 0,
            focusedEditor: Boolean(document.activeElement?.closest?.('.cm-editor')),
            cmFocused: viewRoot?.querySelectorAll('.heading-mindmap-body-pane .cm-editor.cm-focused').length ?? 0
          };
        };
        const waitForFocusedBodySource = async () => {
          let state = getCtrlEnterFocusState(visibleView());
          for (let i = 0; i < 40; i += 1) {
            if (state.sourceView === 1 && (state.focusedEditor || state.cmFocused === 1)) {
              return { root: visibleView(), state };
            }
            await new Promise((resolve) => setTimeout(resolve, 50));
            state = getCtrlEnterFocusState(visibleView());
          }
          return { root: visibleView(), state };
        };
        const pressCanvasKey = async (key, init = {}, delay = 350) => {
          canvas().focus({ preventScroll: true });
          canvas().dispatchEvent(new KeyboardEvent('keydown', {
            key,
            bubbles: true,
            cancelable: true,
            ...init
          }));
          await new Promise((resolve) => setTimeout(resolve, delay));
          root = visibleView();
          return root;
        };
        const editSelectedTitle = async (title) => {
          await pressCanvasKey('Enter', {}, 100);
          const titleInputResult = await waitForTitleInput();
          root = titleInputResult.root;
          const input = titleInputResult.input;
          if (input) {
            input.focus();
            input.value = title;
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
          root = visibleView();
          return Boolean(input);
        };

        const report = {};
        let root = visibleView();
        if (!root) {
          return { setupFailure: pageState() };
        }
        const canvas = () => root.querySelector('.heading-mindmap-canvas');
        const rootNode = findByBadge(root, 'H1');
        const titleRect = rootNode.querySelector('.heading-mindmap-node-title').getBoundingClientRect();
        const nodeRect = rootNode.getBoundingClientRect();
        const bodyPane = root.querySelector('.heading-mindmap-body-pane');
        const canvasEl = canvas();
        report.open = {
          activeType: app.workspace.activeLeaf?.view?.getViewType?.() || null,
          activeFile: app.workspace.getActiveFile()?.path || null,
          leaves: app.workspace.getLeavesOfType('heading-mindmap-view').length,
          markdownLeaves: app.workspace.getLeavesOfType('markdown').length,
          labels: labels(root),
          nodeButtons: root.querySelectorAll('.heading-mindmap-node button').length,
          bodyPreview: root.querySelectorAll('.heading-mindmap-body-preview.markdown-reading-view').length,
          markdownRendered: root.querySelectorAll('.heading-mindmap-body-pane .markdown-preview-view.markdown-rendered').length,
          hasStrong: Boolean(root.querySelector('.heading-mindmap-body-pane strong')),
          hasList: Boolean(root.querySelector('.heading-mindmap-body-pane ul')),
          hasInternalLink: Boolean(root.querySelector('.heading-mindmap-body-pane .internal-link')),
          canvasHeight: Math.round(canvasEl.getBoundingClientRect().height),
          bodyHeight: Math.round(bodyPane.getBoundingClientRect().height),
          titleCenterDelta: Math.round(((titleRect.top + titleRect.height / 2) - (nodeRect.top + nodeRect.height / 2)) * 10) / 10
        };

        root.querySelector('.heading-mindmap-body-mode-button')?.click();
        await new Promise((resolve) => setTimeout(resolve, 700));
        report.sourceMode = {
          sourceView: root.querySelectorAll('.markdown-source-view.mod-cm6.cm-s-obsidian').length,
          cmEditor: root.querySelectorAll('.heading-mindmap-body-pane .cm-editor').length,
          activeInsideEditor: Boolean(document.activeElement?.closest?.('.cm-editor'))
        };
        root.querySelector('.heading-mindmap-body-mode-button')?.click();
        await new Promise((resolve) => setTimeout(resolve, 700));

        findExactLabel(root, 'H1:产品路线图')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 200));
        findExactLabel(root, 'H1:产品路线图')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, detail: 2 }));
        await new Promise((resolve) => setTimeout(resolve, 900));
        const foldedLabels = labels(root);
        findExactLabel(root, 'H1:产品路线图')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, detail: 2 }));
        await new Promise((resolve) => setTimeout(resolve, 900));
        root = visibleView();
        report.doubleClick = {
          foldedCount: foldedLabels.length,
          restoredLabels: labels(root)
        };

        await app.vault.modify(product, (await app.vault.read(product)).replace('## 风险', '## 外部刷新标题\\n\\n外部刷新正文。\\n\\n## 风险'));
        await new Promise((resolve) => setTimeout(resolve, 1400));
        root = visibleView();
        report.externalRefresh = {
          labels: labels(root),
          bodyTitle: root.querySelector('.heading-mindmap-body-title')?.textContent || ''
        };

        const fileNode = findByLabel(root, 'MD:');
        const fileNodeBefore = {
          found: Boolean(fileNode),
          label: fileNode ? ((fileNode.querySelector('.heading-mindmap-node-badge')?.textContent || '') + ':' +
            (fileNode.querySelector('.heading-mindmap-node-title')?.textContent || '')) : null,
          activeFile: app.workspace.getActiveFile()?.path || null,
          linkDest: app.metadataCache.getFirstLinkpathDest('目标文件.md', '产品路线图.md')?.path || null,
          vaultHasTarget: Boolean(app.vault.getAbstractFileByPath('目标文件.md'))
        };
        fileNode?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
        await new Promise((resolve) => setTimeout(resolve, 100));
        const selectedAfterFileClick = selected(root);
        fileNode?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, detail: 2 }));
        await new Promise((resolve) => setTimeout(resolve, 1200));
        root = visibleView();
        const expandedFileLabels = labels(root);
        const notices = Array.from(document.querySelectorAll('.notice')).map((notice) => notice.textContent || '');
        const external = Array.from(root.querySelectorAll('.heading-mindmap-node')).find(
          (node) => node.querySelector('.heading-mindmap-node-title')?.textContent === '外部章节'
        );
        external?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 300));
        const beforeReadonlyButtons = root.querySelectorAll('.heading-mindmap-node-title-input').length;
        canvas().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 300));
        report.fileOutline = {
          fileNodeBefore,
          selectedAfterFileClick,
          expandedFileLabels,
          notices,
          selectedExternal: selected(root),
          readonlyInputBefore: beforeReadonlyButtons,
          readonlyInputAfterEnter: root.querySelectorAll('.heading-mindmap-node-title-input').length,
          readonlyBodyButtonCount: root.querySelectorAll('.heading-mindmap-body-mode-button').length,
          bodyMeta: root.querySelector('.heading-mindmap-body-meta')?.textContent || ''
        };

        const fileNodeAfterReadonlyCheck = findByLabel(root, 'MD:');
        fileNodeAfterReadonlyCheck?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, detail: 2 }));
        await new Promise((resolve) => setTimeout(resolve, 900));
        root = visibleView();

        await app.workspace.getLeavesOfType('heading-mindmap-view')[0]?.view?.toggleListItemExpansion?.();
        await new Promise((resolve) => setTimeout(resolve, 800));
        root = visibleView();
        const listOn = root.querySelectorAll('.heading-mindmap-node.is-list-item').length;
        await app.workspace.getLeavesOfType('heading-mindmap-view')[0]?.view?.toggleListItemExpansion?.();
        await new Promise((resolve) => setTimeout(resolve, 800));
        root = visibleView();
        report.listItems = {
          on: listOn,
          off: root.querySelectorAll('.heading-mindmap-node.is-list-item').length
        };

        findExactLabel(root, 'H1:产品路线图')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 200));
        root = visibleView();
        canvas().focus({ preventScroll: true });
        canvas().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 200));
        root = visibleView();
        const afterRight = selected(root);
        canvas().focus({ preventScroll: true });
        canvas().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        const titleInputResult = await waitForTitleInput();
        root = titleInputResult.root;
        const titleInput = titleInputResult.input;
        const titleEditDebug = {
          selectedAfterEnter: selected(root),
          inputFound: Boolean(titleInput),
          inputValueBefore: titleInput?.value || null,
          focusedBefore: document.activeElement === titleInput,
          activeElementTag: document.activeElement?.tagName || null,
          activeElementClass: String(document.activeElement?.className || ''),
          notices: Array.from(document.querySelectorAll('.notice')).map((notice) => notice.textContent || '')
        };
        if (titleInput) {
          titleInput.focus();
          titleInput.value = '目标更新';
          titleInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        }
        await new Promise((resolve) => setTimeout(resolve, 1200));
        root = visibleView();
        const afterTitleEdit = labels(root);

        root.querySelector('.heading-mindmap-body-mode-button')?.click();
        await new Promise((resolve) => setTimeout(resolve, 700));
        const bodyEditText = '正文编辑写回 **加粗正文**\\n\\n- 正文列表验收';
        const bodyView = app.workspace.getLeavesOfType('heading-mindmap-view')[0]?.view;
        const bodyEditor = bodyView?.bodyEditorView;
        if (bodyEditor) {
          bodyEditor.dispatch({
            changes: { from: 0, to: bodyEditor.state.doc.length, insert: bodyEditText }
          });
          await bodyView.saveBodyAfterEditing();
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
        root = visibleView();
        const markdownAfterBodyEdit = await app.vault.read(product);
        const bodyEditorWriteback = {
          sourceView: root.querySelectorAll('.markdown-source-view.mod-cm6.cm-s-obsidian').length,
          markdownAfterBodyEdit,
          bodyTextInModel: bodyView?.getSelectedNode?.()?.body || ''
        };
        root.querySelector('.heading-mindmap-body-mode-button')?.click();
        await new Promise((resolve) => setTimeout(resolve, 700));
        root = visibleView();
        bodyEditorWriteback.previewStrong = Boolean(root.querySelector('.heading-mindmap-body-pane strong'));
        bodyEditorWriteback.previewList = Boolean(root.querySelector('.heading-mindmap-body-pane ul'));

        canvas().dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 1200));
        root = visibleView();
        const afterTabLabels = labels(root);

        const keyboardExtended = {};
        keyboardExtended.afterTabTextNodeCount = labels(root).filter((label) => label === 'TEXT:新节点').length;
        await pressCanvasKey('Enter', { shiftKey: true }, 1000);
        keyboardExtended.afterShiftEnterSelected = selected(root);
        keyboardExtended.afterShiftEnterTextNodeCount = labels(root).filter((label) => label === 'TEXT:新节点').length;
        findExactLabel(root, 'H3:子目标')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 200));
        keyboardExtended.childIndexBeforeSort = labels(root).indexOf('H3:子目标');
        await pressCanvasKey('ArrowDown', { altKey: true }, 1000);
        keyboardExtended.afterAltDownLabels = labels(root);
        keyboardExtended.childIndexAfterAltDown = keyboardExtended.afterAltDownLabels.indexOf('H3:子目标');
        await pressCanvasKey('ArrowUp', { altKey: true }, 1000);
        keyboardExtended.afterAltUpLabels = labels(root);
        keyboardExtended.childIndexAfterAltUp = keyboardExtended.afterAltUpLabels.indexOf('H3:子目标');
        findExactLabel(root, 'TEXT:新节点')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 200));
        await pressCanvasKey('Tab', { shiftKey: true }, 1200);
        keyboardExtended.afterShiftTabLabels = labels(root);
        keyboardExtended.markdownAfterPromote = await app.vault.read(product);
        await pressCanvasKey('Delete', {}, 1200);
        keyboardExtended.afterDeleteLabels = labels(root);
        keyboardExtended.markdownAfterDelete = await app.vault.read(product);
        findExactLabel(root, 'H2:目标更新')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 200));
        await pressCanvasKey(' ', {}, 800);
        keyboardExtended.afterSpaceFoldLabels = labels(root);
        await pressCanvasKey(' ', {}, 800);
        keyboardExtended.afterSpaceUnfoldLabels = labels(root);
        findExactLabel(root, 'TEXT:新节点')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 200));
        await pressCanvasKey('ArrowLeft', {}, 300);
        keyboardExtended.afterArrowLeft = selected(root);
        findExactLabel(root, 'H2:目标更新')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 200));
        keyboardExtended.beforeCtrlEnter = {
          selected: selected(root),
          bodyPaneMode: app.workspace.getLeavesOfType('heading-mindmap-view')[0]?.view?.bodyPaneMode || null,
          modeButtonCount: root.querySelectorAll('.heading-mindmap-body-mode-button').length,
          sourceViewCount: root.querySelectorAll('.markdown-source-view.mod-cm6.cm-s-obsidian').length
        };
        const ctrlEnterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          ctrlKey: true,
          bubbles: true,
          cancelable: true
        });
        keyboardExtended.ctrlEnterEventBeforeDispatch = {
          key: ctrlEnterEvent.key,
          ctrlKey: ctrlEnterEvent.ctrlKey,
          metaKey: ctrlEnterEvent.metaKey,
          shiftKey: ctrlEnterEvent.shiftKey
        };
        keyboardExtended.canvasBeforeCtrlEnter = {
          isConnected: canvas().isConnected,
          className: String(canvas().className || ''),
          activeElementClass: String(document.activeElement?.className || ''),
          titleInputCount: root.querySelectorAll('.heading-mindmap-node-title-input').length
        };
        canvas().focus({ preventScroll: true });
        canvas().dispatchEvent(ctrlEnterEvent);
        keyboardExtended.ctrlEnterDefaultPrevented = ctrlEnterEvent.defaultPrevented;
        const ctrlEnterFocusResult = await waitForFocusedBodySource();
        root = ctrlEnterFocusResult.root;
        keyboardExtended.canvasAfterCtrlEnter = {
          titleInputCount: root.querySelectorAll('.heading-mindmap-node-title-input').length,
          notices: Array.from(document.querySelectorAll('.notice')).map((notice) => notice.textContent || '')
        };
        keyboardExtended.afterCtrlEnterState = ctrlEnterFocusResult.state;
        keyboardExtended.ctrlEnterSourceView = ctrlEnterFocusResult.state.sourceView;
        keyboardExtended.ctrlEnterFocusedEditor = ctrlEnterFocusResult.state.focusedEditor;
        keyboardExtended.ctrlEnterCmFocused = ctrlEnterFocusResult.state.cmFocused;
        root.querySelector('.heading-mindmap-body-mode-button')?.click();
        await new Promise((resolve) => setTimeout(resolve, 700));
        root = visibleView();

        const markdownAfterEdit = await app.vault.read(product);
        report.keyboardAndWriteback = {
          afterRight,
          titleEditDebug,
          afterTitleEdit,
          bodyEditorWriteback,
          afterTabLabels,
          keyboardExtended,
          markdownAfterEdit,
          activeType: app.workspace.activeLeaf?.view?.getViewType?.() || null
        };

        const h2 = findByLabel(root, 'H2:目标更新');
        canvas().scrollLeft = 120;
        canvas().scrollTop = 40;
        await new Promise((resolve) => setTimeout(resolve, 100));
        const scrollBefore = { left: canvas().scrollLeft, top: canvas().scrollTop };
        h2?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, detail: 2 }));
        await new Promise((resolve) => setTimeout(resolve, 900));
        root = visibleView();
        report.scrollStability = {
          before: scrollBefore,
          after: { left: canvas().scrollLeft, top: canvas().scrollTop }
        };

        await app.workspace.getLeavesOfType('heading-mindmap-view')[0].detach();
        await new Promise((resolve) => setTimeout(resolve, 500));
        await app.workspace.getLeaf(false).openFile(product);
        await app.commands.executeCommandById('heading-mindmap:open');
        await new Promise((resolve) => setTimeout(resolve, 1200));
        root = visibleView();
        report.reopenState = {
          labels: labels(root),
          scrollLeft: canvas().scrollLeft,
          scrollTop: canvas().scrollTop,
          activeType: app.workspace.activeLeaf?.view?.getViewType?.() || null
        };

        return report;
      })()
    `, 90000);

    assert(!report.setupFailure, "打开导图后没有找到可见导图视图", report.setupFailure);
    assert(report.open.activeType === "heading-mindmap-view", "导图视图没有成为 active view", report.open);
    assert(report.open.leaves === 1, "打开后导图 leaf 数量不正确", report.open);
    assert(report.open.markdownLeaves >= 1, "打开导图后没有保留普通 Markdown 视图", report.open);
    assert(report.open.labels.length >= 5, "标题层级未正确渲染到导图", report.open.labels);
    assert(report.open.nodeButtons === 0, "导图节点内仍存在按钮", report.open);
    assert(report.open.bodyPreview === 1 && report.open.markdownRendered === 1, "阅读视图 Markdown class 不完整", report.open);
    assert(report.open.hasStrong && report.open.hasList && report.open.hasInternalLink, "正文阅读视图没有渲染 Markdown 内容", report.open);
    assert(report.open.bodyHeight >= report.open.canvasHeight, "正文区域高度小于导图区", report.open);
    assert(report.open.titleCenterDelta === 0, "节点标题未垂直居中", report.open);
    assert(report.sourceMode.sourceView === 1 && report.sourceMode.cmEditor === 1, "源码编辑视图没有使用 Obsidian/CM6 结构", report.sourceMode);
    assert(report.doubleClick.foldedCount === 1 && report.doubleClick.restoredLabels.length >= 5, "普通节点双击折叠/展开失败", report.doubleClick);
    assert(report.externalRefresh.labels.some((label) => label.includes("外部刷新标题")), "普通 Markdown 修改后导图没有自动刷新", report.externalRefresh);
    assert(report.fileOutline.expandedFileLabels.some((label) => label.includes("外部章节")), "文件节点未展开目标 Markdown 大纲", report.fileOutline);
    assert(report.fileOutline.readonlyInputAfterEnter === 0, "跨文件只读节点仍可进入标题编辑", report.fileOutline);
    assert(report.fileOutline.readonlyBodyButtonCount === 0, "跨文件只读节点仍显示正文编辑按钮", report.fileOutline);
    assert(report.fileOutline.bodyMeta.includes("只读"), "跨文件只读节点缺少只读提示", report.fileOutline);
    assert(report.listItems.on >= 2 && report.listItems.off === 0, "列表项开关行为不正确", report.listItems);
    assert(report.keyboardAndWriteback.afterRight.badge === "H2", "ArrowRight 未移动到第一个子节点", report.keyboardAndWriteback);
    assert(report.keyboardAndWriteback.afterTitleEdit.some((label) => label.includes("目标更新")), "Enter 内联标题编辑未生效", report.keyboardAndWriteback);
    assert(report.keyboardAndWriteback.bodyEditorWriteback.sourceView === 1, "正文编辑没有进入 Obsidian 源码编辑结构", report.keyboardAndWriteback.bodyEditorWriteback);
    assert(report.keyboardAndWriteback.bodyEditorWriteback.markdownAfterBodyEdit.includes("正文编辑写回 **加粗正文**"), "正文编辑没有写回 Markdown", report.keyboardAndWriteback.bodyEditorWriteback);
    assert(report.keyboardAndWriteback.bodyEditorWriteback.previewStrong && report.keyboardAndWriteback.bodyEditorWriteback.previewList, "正文编辑后阅读视图没有渲染 Markdown", report.keyboardAndWriteback.bodyEditorWriteback);
    assert(report.keyboardAndWriteback.afterTabLabels.some((label) => label.includes("新节点")), "Tab 新建子节点未生效", report.keyboardAndWriteback.afterTabLabels);
    assert(report.keyboardAndWriteback.keyboardExtended.afterTabTextNodeCount >= 1, "Tab 新建子节点未形成文本节点", report.keyboardAndWriteback.keyboardExtended);
    assert(report.keyboardAndWriteback.keyboardExtended.afterShiftEnterTextNodeCount > report.keyboardAndWriteback.keyboardExtended.afterTabTextNodeCount, "Shift+Enter 新建兄弟节点未生效", report.keyboardAndWriteback.keyboardExtended);
    assert(
      report.keyboardAndWriteback.keyboardExtended.childIndexAfterAltDown > report.keyboardAndWriteback.keyboardExtended.childIndexBeforeSort,
      "Alt+Down 未下移同级节点",
      report.keyboardAndWriteback.keyboardExtended
    );
    assert(
      report.keyboardAndWriteback.keyboardExtended.childIndexAfterAltUp === report.keyboardAndWriteback.keyboardExtended.childIndexBeforeSort,
      "Alt+Up 未上移同级节点",
      report.keyboardAndWriteback.keyboardExtended
    );
    assert(report.keyboardAndWriteback.keyboardExtended.markdownAfterPromote.split('\n').includes("## 新节点"), "Shift+Tab 未把节点升级写回 Markdown", report.keyboardAndWriteback.keyboardExtended);
    assert(!report.keyboardAndWriteback.keyboardExtended.markdownAfterDelete.split('\n').includes("## 新节点"), "Delete 未删除升级后的当前节点", report.keyboardAndWriteback.keyboardExtended);
    assert(!report.keyboardAndWriteback.keyboardExtended.afterSpaceFoldLabels.includes("TEXT:新节点"), "Space 未折叠当前子树", report.keyboardAndWriteback.keyboardExtended);
    assert(report.keyboardAndWriteback.keyboardExtended.afterSpaceUnfoldLabels.includes("TEXT:新节点"), "Space 未展开当前子树", report.keyboardAndWriteback.keyboardExtended);
    assert(report.keyboardAndWriteback.keyboardExtended.afterArrowLeft.title === "目标更新", "ArrowLeft 未移动到父节点", report.keyboardAndWriteback.keyboardExtended);
    assert(report.keyboardAndWriteback.keyboardExtended.ctrlEnterSourceView === 1, "Ctrl+Enter 未切换到正文源码编辑视图", report.keyboardAndWriteback.keyboardExtended);
    assert(
      report.keyboardAndWriteback.keyboardExtended.ctrlEnterFocusedEditor ||
        report.keyboardAndWriteback.keyboardExtended.ctrlEnterCmFocused === 1,
      "Ctrl+Enter 未聚焦正文编辑器",
      report.keyboardAndWriteback.keyboardExtended
    );
    assert(report.keyboardAndWriteback.markdownAfterEdit.includes("## 目标更新"), "导图标题编辑没有写回 Markdown", report.keyboardAndWriteback.markdownAfterEdit);
    assert(!report.keyboardAndWriteback.markdownAfterEdit.includes("双击此节点"), "Markdown 写回包含旧提示文案", report.keyboardAndWriteback.markdownAfterEdit);
    assert(report.scrollStability.after.left === report.scrollStability.before.left, "双击操作后水平滚动位置不稳定", report.scrollStability);
    assert(report.reopenState.scrollLeft === report.scrollStability.before.left, "关闭重开后水平视野状态未保留", report.reopenState);
    assert(report.reopenState.scrollTop === report.scrollStability.before.top, "关闭重开后垂直视野状态未保留", report.reopenState);
    assert(report.reopenState.labels.some((label) => label.includes("目标更新")), "关闭重开后导图未恢复最新 Markdown", report.reopenState);
    assert(report.reopenState.activeType === "heading-mindmap-view", "关闭重开后未回到导图视图", report.reopenState);

    nodeReplWrite(JSON.stringify({ root, vault, report }, null, 2));
  } finally {
    try {
      child.kill();
    } catch {
      // Process may already be gone.
    }
    stopTempObsidian();
  }
}

function nodeReplWrite(text) {
  console.log(text);
}

if (!existsSync("main.js")) {
  throw new Error("main.js not found; run npm run build first");
}

main().catch((error) => {
  stopTempObsidian();
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
