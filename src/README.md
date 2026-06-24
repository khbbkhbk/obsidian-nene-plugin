# 源码目录说明

- 本目录用于存放多目录源码，平时开发只改这里。
- 根目录 `main.js` 为构建产物，供 Obsidian 直接加载，不作为日常开发入口。
- 根目录 `styles.css` 为构建产物，供 Obsidian 直接加载，不作为日常开发入口。
- 根目录 `main.js` 应由 `src/main.js` 与 `src/modules/` 通过打包生成，禁止手改。
- 根目录 `styles.css` 应由 `src/styles/` 下拆分后的样式源码合并生成，禁止手改。
- `src/styles/` 中的 CSS 文件按文件名升序合并，建议使用数字前缀控制输出顺序。
- 插件持久化数据由根目录 `data.json` 保存，源码层当前采用“根数据仓库 + 模块切片”的数据模型。
- 如果根目录不存在 `main.js`，需要先执行一次打包，Obsidian 才能正常加载插件。
- 如果根目录不存在 `styles.css`，同样需要先执行一次打包，Obsidian 才能正常加载样式。
- 当前核心模块职责如下：
  - `src/modules/plugin-data/`：统一管理整份插件数据的默认结构、归一化与落盘。
  - `src/modules/plugin-settings/`：只管理插件级功能开关，例如 `features.anchorGraph.enabled`。
  - `src/modules/file-marker/`：只管理文件标记自己的数据切片，即 `fileMarker.marks` 与 `fileMarker.groups`。
- 当前 `data.json` 结构如下：

```json
{
  "features": {
    "anchorGraph": {
      "enabled": true
    }
  },
  "fileMarker": {
    "marks": {},
    "groups": [
      {
        "id": "ungrouped",
        "name": "未分组",
        "collapsed": false
      }
    ]
  }
}
```

- 后续新增模块数据时，应在 `data.json` 顶层新增独立切片字段，并在 `src/modules/` 下为其创建独立模块，不再兼容旧扁平模型。
- 打包命令：

```bash
npm run build
```

- 监听开发命令：

```bash
npm run dev
```
