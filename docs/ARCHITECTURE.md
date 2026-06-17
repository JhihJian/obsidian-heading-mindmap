# Heading Mindmap 架构基线

本文说明当前代码库的稳定结构和维护边界。它面向需要修改插件的工程师，重点回答：系统是什么、核心对象如何流动、模块如何分工，以及哪些规则必须保持成立。

## 系统定位

Heading Mindmap 是一个 Obsidian 插件，把 Markdown 文件作为唯一数据源，以思维导图方式编辑标题结构，并在下方正文区域查看或编辑当前节点正文。

插件不维护独立业务数据库。Markdown 正文保存标题、正文和文件节点；插件数据只保存视图状态，例如折叠状态、文件节点展开状态、列表项展示开关和视野位置。

## 核心对象

- `MindNode` 是导图的内存节点模型，代表根节点、普通标题节点、文件节点和虚拟列表项节点。
- Markdown 文件是持久化来源，解析后形成一棵 `MindNode` 树，保存时再序列化回整洁 Markdown。
- 文件节点引用另一个 Markdown 文件。文件节点展开后，目标文件大纲作为只读预览挂到当前导图中。
- 虚拟列表项节点来自节点正文里的 Markdown 列表项，只用于导图展示，不写回 Markdown 标题结构。
- 视图状态使用稳定结构键保存，而不是使用运行期节点 id；重新解析文件后可以恢复折叠、展开和选中位置。

## 主要流程

### 打开导图

`HeadingMindmapPlugin` 注册 Obsidian 视图和命令。用户打开导图时，插件根据当前活动导图、当前 Markdown 文件和默认路径决定目标文件，然后创建或复用 `heading-mindmap-view`。

### 加载和刷新

视图收到文件路径后，插件读取 Markdown，调用模型层解析为 `MindNode` 树，再应用插件数据中保存的状态。普通 Markdown 文件被外部修改时，插件刷新同文件导图视图；如果修改的是已展开的文件节点目标文件，则刷新对应只读大纲。

### 编辑和保存

标题结构操作由纯函数修改 `MindNode` 树，视图负责把操作结果应用到当前选择、触发保存和重新渲染。正文编辑通过 CodeMirror 更新当前节点 body，并以延迟保存降低频繁写盘。保存总是序列化整棵真实节点树；虚拟列表项和已展开文件大纲不会写回当前 Markdown 文件。

### 渲染

导图视图采用上下分屏。上方画布根据树布局结果绘制节点和连线；下方正文面板根据当前选中节点显示阅读视图或源码编辑视图。只读节点只能预览，不能编辑标题、正文或结构。

## 模块边界

- `src/main.ts`：Obsidian 插件入口。负责注册视图、命令、文件读取写入、插件数据读写、文件节点目标解析和跨视图刷新。
- `src/mindmap-view.ts`：Obsidian `ItemView` 实现。负责视图状态加载、DOM 渲染、键盘分发、画布交互、正文面板和保存调度。
- `src/mindmap-model.ts`：Markdown 与 `MindNode` 的转换。负责解析标题、frontmatter、正文折叠标记、文件节点标题和虚拟列表项。
- `src/mindmap-operations.ts`：导图结构编辑规则。负责新增、删除、排序、升级、折叠和只读限制。
- `src/mindmap-view-state.ts`：视图状态持久化规则。负责结构键、折叠状态、文件展开状态和视野状态归一化。
- `src/tree-layout.ts`：纯布局计算。输入节点树，输出节点位置、边和画布尺寸。
- `src/keyboard-shortcuts.ts`、`src/mindmap-navigation.ts`、`src/node-selection.ts`：键盘动作、节点导航和选择策略。
- `src/plugin-data.ts`：插件持久化数据的容错归一化。
- `src/markdown-file-picker-modal.ts`：添加 Markdown 文件节点时使用的 Obsidian Modal。
- `styles.css`：导图、工具栏、正文面板和 Obsidian 源码/阅读视图适配样式。

## 依赖方向

插件入口和视图层可以依赖 Obsidian API、CodeMirror 和纯逻辑模块。模型、操作、布局、状态、导航、选择和策略模块应保持为纯 TypeScript 逻辑，避免直接依赖 Obsidian 运行时。测试主要覆盖这些纯逻辑模块，保证视图重构时业务规则不漂移。

## 必须守住的不变量

- Markdown 文件是唯一内容数据源；插件数据不能保存标题树或正文副本。
- 标题层级决定真实导图层级，标题最多六级。
- 文件节点展开的大纲是只读预览，不能通过当前导图改写目标文件。
- 虚拟列表项节点只来自正文展示开关，不能参与真实结构保存、排序和选中状态持久化。
- 保存当前导图时，不能把已展开文件大纲或虚拟列表项序列化进当前 Markdown。
- 同一文件的多个导图视图可以拥有不同 leaf 状态；文件级插件状态只保存可共享的折叠、展开和默认视野信息。
- 普通 Markdown 视图和导图视图应通过同一 Markdown 文件保持一致。

## 当前边界

当前 MVP 不包含拖拽重排、节点样式自定义、图片导出、聚焦模式和完整撤销/重做集成。后续新增这些能力时，应优先扩展纯逻辑模块和测试，再把视图层作为适配器接入。

## 来源映射

| 架构结论 | 来源 | 状态 |
| --- | --- | --- |
| Markdown 是唯一内容数据源，导图编辑等价于编辑 Markdown | `docs/PRD.md` 第 2、3、8 节；`src/mindmap-model.ts` | 已确认 |
| 插件入口负责注册视图、命令、文件读写和刷新 | `src/main.ts` | 已确认 |
| 视图层负责 DOM、键盘、正文面板和保存调度 | `src/mindmap-view.ts` | 已确认 |
| 模型层负责 Markdown 解析、序列化、文件节点和虚拟列表项 | `src/mindmap-model.ts`；`tests/outline-to-mindmap.test.ts` | 已确认 |
| 结构编辑规则集中在纯函数模块 | `src/mindmap-operations.ts`；`tests/mindmap-operations.test.ts` | 已确认 |
| 视图状态使用结构键而不是运行期节点 id | `src/mindmap-view-state.ts`；`tests/mindmap-view-state.test.ts` | 已确认 |
| 文件节点展开的大纲为只读预览 | `docs/PRD.md` 第 2、6、10 节；`src/mindmap-operations.ts` | 已确认 |
| 模型、操作、布局和状态模块应保持无 Obsidian 运行时依赖 | 当前测试结构和模块依赖方向 | 合理推断 |
