# 源码目录说明

- 本目录用于存放多目录源码，平时开发只改这里。
- 根目录 `main.js` 为构建产物，供 Obsidian 直接加载，不作为日常开发入口。
- 根目录 `styles.css` 为构建产物，供 Obsidian 直接加载，不作为日常开发入口。
- 根目录 `main.js` 应由 `src/main.js` 与 `src/modules/` 通过打包生成，禁止手改。
- 根目录 `styles.css` 应由 `src/styles/` 下拆分后的样式源码合并生成，禁止手改。
- `src/styles/` 中的 CSS 文件按文件名升序合并，建议使用数字前缀控制输出顺序。
- 插件持久化数据采用“核心设置 + 模块独立文件”的模型：根目录 `data.json` 仅保留插件级功能开关等核心字段，模块业务数据保存到根目录 `configs/` 下的独立 JSON 文件。
- 如果根目录不存在 `main.js`，需要先执行一次打包，Obsidian 才能正常加载插件。
- 如果根目录不存在 `styles.css`，同样需要先执行一次打包，Obsidian 才能正常加载样式。
- 当前核心模块职责如下：
  - `src/modules/plugin-data/`：统一管理核心 `data.json`、独立功能配置目录以及旧数据迁移。
  - `src/modules/plugin-settings/`：只管理插件级功能开关，例如 `features.anchorGraph.enabled`。
  - `src/modules/file-marker/`：只管理文件标记自己的数据切片，即 `configs/file-marker.json` 中的 `marks` 与 `groups`。
  - `src/modules/graph-view-enhancer/`：管理关系图谱增强逻辑及 `configs/anchor-graph.json` 中的模块设置。
  - `src/modules/context-menu-enhancer/`：管理右键菜单自定义逻辑及 `configs/menu-customizer.json` 中的模块设置。
  - `src/modules/command-uri-enhancer/`：管理路径复制与 URI 相关命令及 `configs/command-uri-enhancer.json` 中的模块设置。
  - `src/modules/status-bar-enhancer/`：管理状态栏路径显示、点击复制逻辑及 `configs/status-bar-enhancer.json` 中的模块设置。
- 当前 `data.json` 结构如下：

```json
{
  "features": {
    "fileMarker": {
      "enabled": false
    },
    "anchorGraph": {
      "enabled": true
    }
  }
}
```

- 独立模块配置文件示例：

```json
// configs/file-marker.json
{
  "marks": {},
  "groups": [
    {
      "id": "ungrouped",
      "name": "未分组",
      "collapsed": false
    }
  ]
}
```

```json
// configs/anchor-graph.json
{
  "defaultSettings": {
    "htmlEnhancementEnabled": true
  },
  "noteOverrides": {}
}
```

- 后续新增模块数据时，应优先在 `configs/` 下新增独立文件，并在 `src/modules/` 下为其创建独立模块。
- 打包命令：

```bash
npm run build
```

- 监听开发命令（推荐直接使用 `watch`，`dev` 仍可继续使用）：

```bash
npm run watch
```

- 兼容旧命名方式：

```bash
npm run dev
```
