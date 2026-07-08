# Heading Mindmap 架构基线

本文说明当前代码库的稳定结构和维护边界。它面向需要修改插件的工程师，重点回答：系统是什么、核心对象如何流动、模块如何分工，以及哪些规则必须保持成立。

## 系统定位

Heading Mindmap 是一个 Obsidian 插件，把 Markdown 文件作为唯一数据源，以思维导图方式编辑标题结构，并在下方正文区域查看或编辑当前节点正文。

插件不维护独立业务数据库。Markdown 正文保存标题、正文和文件节点；插件数据只保存视图状态，例如折叠状态、文件节点展开状态、正文区域大小/最小化状态、列表项展示开关和视野位置。

## 核心对象

- `MindNode` 是导图的内存节点模型，代表文档根节点、普通标题节点、文件节点和虚拟列表项节点。
- 文档根节点由当前 Markdown 文件派生，标题显示文件名，不序列化为 Markdown 标题；真实 Markdown 标题都是它的子节点，因此多个 H1 可以作为同级一级标题存在。
- Markdown 文件是持久化来源，解析后形成一棵 `MindNode` 树，保存时再序列化回整洁 Markdown。
- 文件节点引用另一个 Markdown 文件。文件节点展开后，目标文件大纲作为只读预览挂到当前导图中。
- 虚拟列表项节点来自节点正文里的 Markdown 列表项，只用于导图展示，不写回 Markdown 标题结构。
- 视图状态使用稳定结构键保存，而不是使用运行期节点 id；重新解析文件后可以恢复折叠、展开和选中位置。

## 主要流程

### 打开导图

`HeadingMindmapPlugin` 注册 Obsidian 视图和命令。命令与 ribbon tooltip 文案通过 `src/i18n.ts` 按 Obsidian 当前应用语言选择：中文语言显示中文，其它语言回退英文。用户打开导图时，插件根据当前活动导图、当前 Markdown 文件和默认路径决定目标文件，然后创建或复用 `heading-mindmap-view`。

### 加载和刷新

视图收到文件路径后，插件读取 Markdown，调用模型层解析为以文档根为根的 `MindNode` 树，再应用插件数据中保存的状态。普通 Markdown 文件被外部修改时，插件刷新同文件导图视图；如果修改的是已展开的文件节点目标文件，则刷新对应只读大纲。

### 编辑和保存

标题结构操作由纯函数修改 `MindNode` 树，快捷键分发层把用户动作翻译为结构操作或视图回调，视图负责把操作结果应用到当前选择、触发保存和重新渲染。正文编辑由正文运行时通过 CodeMirror 更新当前节点 body，并以延迟保存降低频繁写盘。正文源码编辑器拦截剪贴板图片粘贴，按 Obsidian 附件规则创建二进制文件，再把图片嵌入链接插入当前节点 body。保存时跳过文档根节点本身，只序列化真实 Markdown 标题、文档根正文、frontmatter 和标题前正文；虚拟列表项和已展开文件大纲不会写回当前 Markdown 文件。

### 渲染

导图视图采用上下分屏。上方画布 DOM 模块根据树布局结果绘制节点和连线；导图节点按标题内容估算宽高，长标题换行完整展示，布局和连线使用每个节点的实际尺寸。工具栏提供缩放、适配全图和 100% 重置入口，视野 DOM 辅助逻辑负责按当前画布尺寸计算缩放、滚动区域和居中偏移。下方正文面板 DOM 和运行时模块根据当前选中节点显示阅读视图或源码编辑视图，内容使用面板可用宽度排版，也可最小化为标题栏以释放导图编辑空间。只读节点只能预览，不能编辑标题、正文或结构。

## 模块边界

- `src/main.ts`：Obsidian 插件入口。负责注册视图、命令、文件读取写入、插件数据读写、文件节点目标解析和跨视图刷新。
- `src/i18n.ts`：插件命令和 ribbon tooltip 的轻量本地化文案。
- `src/mindmap-view.ts`：Obsidian `ItemView` 协调层。负责视图状态加载、选中节点、保存调度、跨模块回调和 Obsidian 生命周期，不直接承载画布 DOM、正文编辑器或快捷键操作细节。
- `src/mindmap-view-store.ts`：导图视图运行期状态容器。集中保存当前文件、根节点、选中节点、视野、正文面板状态、保存队列和正文运行时。
- `src/mindmap-view-loader.ts`：视图加载和刷新控制器。负责 leaf state 应用、磁盘重载、展开文件大纲刷新和视图状态恢复。
- `src/mindmap-view-renderer.ts`：视图渲染协调器。负责组装工具栏、画布、正文面板，读取/恢复视野，更新选择态和正文面板模式。
- `src/mindmap-view-actions.ts`：用户动作控制器。负责快捷键入口、结构操作结果应用、标题编辑、文件节点展开、文件选择和列表项开关。
- `src/mindmap-view-persistence.ts`：保存控制器。负责 UI 状态保存、正文延迟保存、Markdown 写盘队列和关闭时 flush。
- `src/mindmap-toolbar-dom.ts`：导图工具栏 DOM 组装。负责标题、路径、缩放控制、列表项开关和添加文件节点入口。
- `src/mindmap-canvas-dom.ts`：导图画布 DOM 组装。负责画布尺寸、滚轮缩放事件、节点和连线渲染、节点点击/双击/标题输入事件转发。
- `src/viewport-dom.ts`：导图视野和滚动 DOM 辅助逻辑。负责滚动保留、适配全图缩放、缩放中心保持、滚动区域尺寸和小导图居中偏移。
- `src/body-pane-dom.ts`：正文面板标题栏、模式按钮、最小化按钮和拖拽条 DOM 组装。
- `src/body-pane-runtime.ts`：正文面板运行时。负责 Markdown 预览渲染、CodeMirror 编辑器生命周期、正文图片粘贴附件写入和编辑器聚焦。
- `src/body-pane-resizer.ts`：正文区域拖拽条运行时。负责 pointer/keyboard resize 事件、ARIA 状态更新和高度变化回调。
- `src/body-editor.ts`：正文源码 CodeMirror 编辑器创建。负责快捷键、粘贴事件、换行和文档变更回调接线。
- `src/clipboard-image-attachments.ts`：剪贴板图片识别、附件文件名生成和图片嵌入链接规范化。
- `src/body-pane-size.ts`：正文区域高度、拖拽键盘调整和 resizer ARIA 状态的纯逻辑。
- `src/mindmap-shortcut-dispatch.ts`：导图快捷键动作分发。负责把快捷键动作翻译为节点操作、选择移动或视图回调。
- `src/file-outline-runtime.ts`：文件节点大纲运行时。负责查找已展开文件节点、刷新目标文件大纲、展开文件节点并返回状态。
- `src/mindmap-model.ts`：Markdown 与 `MindNode` 的转换。负责解析标题、frontmatter、正文折叠标记、文件节点标题和虚拟列表项。
- `src/mindmap-operations.ts`：导图结构编辑规则。负责新增、删除、排序、升级、折叠和只读限制。
- `src/mindmap-view-state.ts`：视图状态持久化规则。负责结构键、折叠状态、文件展开状态、正文区域状态和视野状态归一化。
- `src/tree-layout.ts`：纯布局计算。输入节点树，输出节点位置、边和画布尺寸。
- `src/keyboard-shortcuts.ts`、`src/mindmap-navigation.ts`、`src/node-selection.ts`：键盘动作、节点导航和选择策略。
- `src/plugin-data.ts`：插件持久化数据的容错归一化。
- `src/markdown-file-picker-modal.ts`：添加 Markdown 文件节点时使用的 Obsidian Modal。
- `styles.css`：导图、工具栏、正文面板和 Obsidian 源码/阅读视图适配样式。

## 依赖方向

插件入口和视图协调层可以依赖 Obsidian API、DOM 适配模块和纯逻辑模块。DOM 适配模块可以使用 Obsidian DOM 扩展和 CodeMirror，但应通过回调把状态变化交回视图协调层。模型、操作、布局、状态、导航、选择、文件大纲 runtime 和策略模块应保持为纯 TypeScript 逻辑，避免直接依赖 Obsidian 运行时。测试主要覆盖这些纯逻辑模块，并用源码契约测试防止视图类重新吸收已拆出的职责。

## 必须守住的不变量

- Markdown 文件是唯一内容数据源；插件数据不能保存标题树或正文副本。
- 标题层级决定真实导图层级，标题最多六级。
- 文档根节点不对应 Markdown 标题，不能被当作 H1 序列化；H1 是文档根下的普通一级标题节点，可以拥有同级 H1。
- 文件节点展开的大纲是只读预览，不能通过当前导图改写目标文件。
- 虚拟列表项节点只来自正文展示开关，不能参与真实结构保存、排序和选中状态持久化。
- 保存当前导图时，不能把已展开文件大纲或虚拟列表项序列化进当前 Markdown。
- 同一文件的多个导图视图可以拥有不同 leaf 状态；文件级插件状态只保存可共享的折叠、展开、正文区域默认状态和默认视野信息。
- 普通 Markdown 视图和导图视图应通过同一 Markdown 文件保持一致。

## 当前边界

当前 MVP 不包含拖拽重排、节点样式自定义、图片导出、聚焦模式和完整撤销/重做集成。后续新增这些能力时，应优先扩展纯逻辑模块和测试，再把视图层作为适配器接入。

## 文档组织边界

当前项目规模较小，模块边界和来源映射暂时集中在本文档中维护。若后续新增独立功能域、复杂发布决策或跨模块约束，应拆分出模块文档、独立来源映射和架构决策记录。

## 来源映射

| 架构结论 | 来源 | 状态 |
| --- | --- | --- |
| Markdown 是唯一内容数据源，导图编辑等价于编辑 Markdown | `docs/PRD.md` 第 2、3、8 节；`src/mindmap-model.ts` | 已确认 |
| 文档根节点不写回为 Markdown 标题，H1 是可同级编辑的真实标题节点 | `docs/PRD.md` 第 3、6、10 节；`src/mindmap-model.ts`；`tests/mindmap-operations.test.ts` | 已确认 |
| 插件入口负责注册视图、命令、文件读写和刷新 | `src/main.ts` | 已确认 |
| 视图层是薄协调层，运行期状态、加载、渲染、动作、保存、DOM、正文运行时、快捷键分发和文件大纲刷新分属独立模块 | `src/mindmap-view.ts`；`src/mindmap-view-store.ts`；`src/mindmap-view-loader.ts`；`src/mindmap-view-renderer.ts`；`src/mindmap-view-actions.ts`；`src/mindmap-view-persistence.ts`；`src/mindmap-canvas-dom.ts`；`src/body-pane-runtime.ts`；`src/mindmap-shortcut-dispatch.ts`；`src/file-outline-runtime.ts`；`tests/view-source-contract.test.ts` | 已确认 |
| 模型层负责 Markdown 解析、序列化、文件节点和虚拟列表项 | `src/mindmap-model.ts`；`tests/outline-to-mindmap.test.ts` | 已确认 |
| 结构编辑规则集中在纯函数模块 | `src/mindmap-operations.ts`；`tests/mindmap-operations.test.ts` | 已确认 |
| 视图状态使用结构键而不是运行期节点 id，并保存正文区域大小/最小化状态 | `src/mindmap-view-state.ts`；`tests/mindmap-view-state.test.ts` | 已确认 |
| 工具栏承载缩放和适配全图入口，视野辅助逻辑负责移动端全局查看的缩放与居中 | `src/mindmap-toolbar-dom.ts`；`src/viewport-dom.ts`；`tests/viewport-dom.test.ts`；`tests/styles-contract.test.ts` | 已确认 |
| 文件节点展开的大纲为只读预览 | `docs/PRD.md` 第 2、6、10 节；`src/mindmap-operations.ts` | 已确认 |
| 模型、操作、布局、状态、文件大纲 runtime 和快捷键分发模块应保持无 Obsidian 运行时依赖 | 当前测试结构和模块依赖方向；`tests/file-outline-runtime.test.ts`；`tests/mindmap-shortcut-dispatch.test.ts` | 已确认 |
