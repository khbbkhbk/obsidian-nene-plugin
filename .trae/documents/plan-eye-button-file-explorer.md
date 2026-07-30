# 计划：文件列表工具栏添加眼睛按钮与恢复按钮

## 摘要

在文件资源管理器顶部工具栏注入**眼睛按钮**和**恢复按钮**。
- **眼睛按钮**：反映当前目录下是否存在被隐藏的文件。若有则显示 `eye-off`（可点击，临时停用匹配的隐藏规则）；若无则显示 `eye`（禁用，仅状态提示）。
- **恢复按钮**：位于眼睛按钮右侧，记录眼睛按钮每次停用了哪些隐藏规则。使用后恢复按钮变为可用，点击一键恢复所有被眼睛按钮停用的规则并清空记录，之后按钮归回禁用态。

## 当前状态分析

### 现有架构
- 工具栏注入：项目中无 `.nav-buttons-container` 注入代码，参考 `graph-view-enhancer/index.js`（第 622-661 行）的 `clickable-icon` 模式
- 视图引用：`plugin._fileExplorerView`（`main.js` `attachFileExplorerPatch()` 中赋值）
- 隐藏匹配：`runtime.js` 的 `checkPathFilter()` / `store.js` 的 `quickCheckPathFilter()`
- 活动笔记：`app.workspace.getActiveFile()` 多处已使用
- 全量文件：`app.vault.getAllLoadedFiles()` 获取所有文件/文件夹

### 需修改的文件
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/modules/file-explorer-enhancer/runtime.js` | **修改** | 眼睛按钮 + 恢复按钮注入/卸载、焦点追踪、隐藏检测、揭示逻辑、撤销记录 |
| `src/modules/file-explorer-enhancer/index.js` | **修改** | 导出新增函数 |
| `src/main.js` | **修改** | 生命周期集成，构造函数加 `_lastFocusedFile` + `_eyeToggleHistory` |
| `src/styles/80-file-explorer-enhancer.css` | **修改** | 两个按钮的禁用态样式 |

## 行为定义

```
当前目录下有被隐藏规则隐藏的文件？
  ├── 是 → 眼睛图标 eye-off（闭眼），可点击
  │         点击后：停用所有匹配该目录的隐藏规则，记录到撤销列表
  │         恢复按钮变为可用
  └── 否 → 眼睛图标 eye（睁眼），不可点击（禁用态）

恢复按钮
  ├── 撤销列表不为空 → 图标 undo/rotate-ccw，可点击
  │                       点击后：重新启用撤销列表中的所有规则，清空列表
  │                       恢复按钮归回禁用态
  └── 撤销列表为空 → 禁用态
```

## 详细变更

### 1. `runtime.js` — 核心逻辑

#### 1.1 `injectEyeButtons(plugin, view)` 
- 在 `view.containerEl` 中查找 `.nav-header` → `.nav-buttons-container`
- 创建眼睛按钮：`<button class="clickable-icon nav-action-button nene-eye-toggle-button">`
- 创建恢复按钮：`<button class="clickable-icon nav-action-button nene-eye-restore-button">`，初始禁用
- 调用 `updateEyeButtonState(plugin)` 设置初始状态
- 防重复注入

#### 1.2 `removeEyeButtons()`
- 移除 `.nene-eye-toggle-button` 和 `.nene-eye-restore-button`

#### 1.3 `updateEyeButtonState(plugin)` — 眼睛按钮状态刷新
1. 调用 `getTargetDirectory(plugin)` 获取目标目录路径
2. 若无有效目录 → 图标 `eye`，禁用，`aria-label="无可用目录"`
3. 调用 `hasHiddenFilesInDir(plugin, dirPath)` 检查是否有隐藏文件
4. 若有 → `setIcon(button, 'eye-off')`，`disabled = false`，`aria-label="显示当前目录下的隐藏文件"`
5. 若无 → `setIcon(button, 'eye')`，`disabled = true`，`aria-label="当前目录无隐藏文件"`

#### 1.4 `updateRestoreButtonState(plugin)` — 恢复按钮状态刷新
1. 读取 `plugin._eyeToggleHistory`（数组）
2. 若长度 > 0 → `setIcon(button, 'rotate-ccw')`，`disabled = false`，`aria-label="恢复所有临时显示的隐藏文件"`
3. 若长度 = 0 → `setIcon(button, 'rotate-ccw')`，`disabled = true`，`aria-label="无需恢复"`

#### 1.5 `hasHiddenFilesInDir(plugin, dirPath)` — 检测目录下是否有隐藏文件
- 过滤 `app.vault.getAllLoadedFiles()` 中路径以 `dirPath` 开头的文件/文件夹
- 遍历检查是否被任何**激活**的隐藏规则（hideFilters.paths 中 active=true 的规则）命中
- 任一命中返回 `true`

#### 1.6 `handleEyeClick(plugin)` — 眼睛按钮点击处理
1. 获取目标目录路径
2. 遍历 `hideFilters.paths`，找出所有激活且影响该目录的规则
3. 对每条匹配规则：
   - 将 `filter.active` 设为 `false`
   - 将规则在 `hideFilters.paths` 中的**索引**推入 `plugin._eyeToggleHistory`（去重）
4. `plugin.fileExplorerEnhancerStore.save()` 保存并刷新排序
5. 同时刷新眼睛按钮和恢复按钮状态

#### 1.7 `handleRestoreClick(plugin)` — 恢复按钮点击处理
1. 读取 `plugin._eyeToggleHistory`
2. 遍历其中的索引，将对应的 `hideFilters.paths[idx].active` 设为 `true`（跳过索引越界的情况）
3. 清空 `plugin._eyeToggleHistory = []`
4. `plugin.fileExplorerEnhancerStore.save()` 保存并刷新排序
5. 同时刷新眼睛按钮和恢复按钮状态

#### 1.8 `getTargetDirectory(plugin)` — 确定目标目录
- 优先：`plugin._lastFocusedFile`（焦点追踪缓存）
  - 若是 `TFolder` → 返回 `path`
  - 若是 `TFile` → 返回父目录 `path`
- 回退：`app.workspace.getActiveFile()` → 返回父目录 `path`
- 若无 → 返回 `null`

#### 1.9 `setupFileExplorerFocusTracking(plugin)` — 焦点追踪
- 监听文件资源管理器 `containerEl` 的 `click` 事件
- 命中 `.tree-item-self` 时，通过 `fileItems` 反查 `TAbstractFile`，缓存到 `plugin._lastFocusedFile`
- 每次点击后调用 `updateEyeButtonState(plugin)` 刷新眼睛按钮

#### 1.10 导出更新
`injectEyeButtons`、`removeEyeButtons`、`setupFileExplorerFocusTracking`、`updateEyeButtonState`

### 2. `main.js` — 生命周期

#### 2.1 构造函数（~第 36 行）
```javascript
this._lastFocusedFile = null;       // 文件列表中最后点击的文件/文件夹
this._eyeToggleHistory = [];        // 眼睛按钮停用的隐藏规则索引记录
```

#### 2.2 `attachFileExplorerPatch()`（~第 902 行）
追加：
```javascript
fileExplorerEnhancerModule.setupFileExplorerFocusTracking(self);
fileExplorerEnhancerModule.injectEyeButtons(self, view);
```

#### 2.3 `fileExplorerEnhancerUnload()`（~第 918 行）
追加：
```javascript
fileExplorerEnhancerModule.removeEyeButtons();
```

### 3. `80-file-explorer-enhancer.css`

```css
/* 眼睛按钮 / 恢复按钮统一禁用态 */
.nene-eye-toggle-button:disabled,
.nene-eye-restore-button:disabled {
  opacity: 0.4;
  cursor: default;
}
```

## 关键设计决策

1. **恢复记录机制**：用数组存储被眼睛按钮停用的规则在 `hideFilters.paths` 中的索引。恢复时按索引回写 `active = true`，已删除或越界的索引自动跳过。
2. **去重**：同一个规则被眼睛按钮多次停用，恢复列表中只存一条索引。
3. **检测方式**：对目录下所有文件逐条过隐藏规则，任一命中即为"有隐藏文件"。
4. **状态刷新**：焦点变化和任意按钮点击后均刷新两个按钮的状态。

## 验证步骤

1. 当不存在可获取的当前目标时 → 眼睛为 `eye`，禁用
2. 配置隐藏规则使某目录下有文件被隐藏 → 点击该目录下文件 → 眼睛 `eye-off`，可用
3. 点击眼睛按钮 → 隐藏文件全部显示 → 眼睛变为 `eye`，禁用；恢复按钮变为可用
4. 切换至其它有隐藏文件的目录 → 眼睛 `eye-off`，可用
5. 切换至其它不含隐藏文件的目录 → 眼睛 `eye`，禁用
6. 眼睛可连续多次使用，恢复按钮只在眼睛按钮被使用过至少一次后才可用
7. 点击恢复按钮 → 所有被眼睛停用的规则恢复 → 隐藏文件再次隐藏 → 恢复按钮归回禁用
8. 关闭文件列表增强模块 → 两个按钮均消失
9. 文件列表视图重新打开 → 按钮自动恢复
