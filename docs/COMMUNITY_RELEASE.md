# 官方社区插件发布清单

本文记录 Heading Mindmap 提交到 Obsidian 官方社区插件目录前需要满足的事项。

## 已在仓库中准备

- `manifest.json` 使用唯一插件 ID：`heading-mindmap`。
- `manifest.json` 插件名为 `Heading Mindmap`，描述使用英文短句，便于官方目录检索。
- `manifest.json` 已填写 `author`、`authorUrl`、`minAppVersion` 和 `isDesktopOnly`。
- `LICENSE` 使用 MIT License。
- `versions.json` 记录当前插件版本和最低 Obsidian 版本。
- `.github/workflows/release.yml` 会在推送版本 tag 时运行测试、构建插件，并创建包含 `main.js`、`manifest.json`、`styles.css` 的草稿 GitHub Release。
- 插件命令 ID 不重复包含插件 ID；Obsidian 会自动生成最终命令 ID，例如 `heading-mindmap:open`。

## 发布步骤

1. 确认 `manifest.json` 中的 `version` 是本次发布版本，格式必须是 `x.y.z`。
2. 运行本地验证：

   ```powershell
   npm test
   npm run build
   ```

3. 提交并推送默认分支。
4. 创建和 `manifest.json` 版本完全一致的 tag：

   ```powershell
   git tag -a 0.1.0 -m "0.1.0"
   git push origin 0.1.0
   ```

5. 等待 GitHub Actions 创建草稿 Release。
6. 打开 GitHub Release，补充发布说明并发布。
7. 登录 Obsidian 社区目录，提交 GitHub 仓库 URL：

   ```text
   https://github.com/JhihJian/obsidian-heading-mindmap
   ```

## 提交前检查

- 默认分支 HEAD 上的 `manifest.json` 必须准确。
- GitHub Release 的 tag 必须和 `manifest.json` 的 `version` 完全一致。
- Release 必须附带 `main.js`、`manifest.json`，本插件还需要附带 `styles.css`。
- 如果之后提高 `minAppVersion`，同步更新 `versions.json`。
