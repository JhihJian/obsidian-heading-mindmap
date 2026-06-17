# Heading Mindmap

Heading Mindmap 是一个 Obsidian 思维导图插件，让 Markdown 笔记可以用“可编辑思维导图”方式打开。

导图是笔记内容的结构化视图。标题层级决定节点层级；上方导图只显示标题树，下方正文区域以阅读/编辑模式查看和编辑当前节点正文，结果写回原 Markdown 文件。

产品需求见 [docs/PRD.md](docs/PRD.md)。

## 核心能力

- 导图上方只显示标题树，节点内不放操作按钮或正文内容。
- 正文在下方单栏面板中查看和编辑，阅读模式使用 Obsidian Markdown 渲染，右上角可切换到源码编辑模式。
- Markdown 文件节点标题显示文件名，双击后根据目标文件大纲展开子导图。
- 可选把正文里的 Markdown 列表项作为只读虚拟子节点展示到导图上，不改写原 Markdown。
- 思维导图本身保存为普通 Markdown 文件。
- 支持键盘交互：`Tab` 新建子节点，`Enter` 内联编辑标题，`Ctrl+Enter` 聚焦正文面板，方向键移动选中节点。

## 当前实现状态

已实现：

- 打开独立思维导图视图。
- 从 Markdown 文件解析导图结构。
- 新建子节点、新建兄弟节点、删除节点及子树、同级排序、节点升级。
- 从当前库选择 Markdown 文件并添加为文件节点。
- 双击文件节点展开/收起目标文件标题层级。
- 下方正文区域默认显示 Markdown 阅读效果，右上角按钮可切换到源码编辑视图。
- 正文列表项可选展示为只读虚拟导图子节点。
- 节点标题内联编辑，正文在下方面板编辑。
- PRD 定义的键盘操作。
- 第六级标题边界提示。
- 普通 Markdown 视图修改后，导图视图自动刷新。
- 子树折叠、文件展开状态记忆。
- 同一文件的多个导图视图分别保存选中节点、滚动和缩放状态。
- 基础缩放和平移。

待补齐：

- 更完整的撤销/重做集成。

## 开发命令

```powershell
npm install
npm run build
npm test
```

发布或修改 Obsidian 运行时交互前，额外运行真实 Obsidian 端到端验证：

```powershell
npm run build
npm run test:e2e:obsidian
```

该脚本需要 Node.js 22 或更高版本，并默认使用 `C:\Program Files\Obsidian\Obsidian.exe`；如安装路径不同，可通过 `OBSIDIAN_EXE` 环境变量指定。

开发监听：

```powershell
npm run dev
```

## 部署到 Obsidian 测试库

推荐使用脚本：

```powershell
npm run deploy -- "D:\path\to\your\test-vault"
```

也可以手动复制以下文件到库目录：

```text
.obsidian/plugins/heading-mindmap/
```

需要复制：

```text
main.js
manifest.json
styles.css
```

然后在 Obsidian 设置中启用 `Heading Mindmap`，用命令面板执行 `打开思维导图`。命令默认在新 tab 打开导图以保留当前 Markdown 源码视图；如果当前 tab 已经是同一文件的导图，则复用当前导图。
