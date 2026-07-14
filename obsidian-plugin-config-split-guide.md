# Obsidian 插件配置拆分存储方案

> 基于 `app.vault.adapter` API 的模块化配置存储实践
> 适用版本：Obsidian v1.4.16+

---

## 一、为什么需要拆分存储

### 1.1 单文件 `data.json` 的痛点

| 问题 | 影响 |
|------|------|
| 所有配置混在一起 | 手动编辑困难，容易误改 |
| Git 版本控制噪音 | 一个功能变更导致整个文件 diff |
| 配置体积膨胀 | 缓存/索引数据与设置共存，加载变慢 |
| 迁移/备份困难 | 无法按需备份某个功能模块 |
| 多设备同步冲突 | 不同设备的功能使用差异导致冲突 |

### 1.2 拆分后的优势

- **模块化**：每个功能独立文件，结构清晰
- **可控同步**：核心设置同步，缓存/状态数据本地保留
- **版本友好**：Git diff 只显示相关功能的变更
- **按需迁移**：升级时可以有选择地迁移配置
- **用户透明**：高级用户可直接编辑特定功能的配置

---

## 二、核心 API 确认（Obsidian v1.4.16+）

`app.vault.adapter` 提供以下跨平台文件操作方法：

| 方法 | 签名 | 用途 |
|------|------|------|
| `exists` | `exists(path: string): Promise<boolean>` | 检查文件/目录是否存在 |
| `mkdir` | `mkdir(path: string): Promise<void>` | 创建目录 |
| `read` | `read(path: string): Promise<string>` | 读取文本文件 |
| `write` | `write(path: string, data: string): Promise<void>` | 写入文本文件 |
| `readBinary` | `readBinary(path: string): Promise<ArrayBuffer>` | 读取二进制文件 |
| `writeBinary` | `writeBinary(path: string, data: ArrayBuffer): Promise<void>` | 写入二进制文件 |
| `remove` | `remove(path: string): Promise<void>` | 删除文件 |
| `rename` | `rename(oldPath: string, newPath: string): Promise<void>` | 重命名 |
| `list` | `list(path: string): Promise<{files: string[], folders: string[]}>` | 列出目录内容 |

> ⚠️ **重要**：始终使用 `normalizePath()` 处理路径，确保跨平台兼容。

---

## 三、完整实现代码

### 3.1 目录结构

```
.obsidian/plugins/your-plugin-id/
├── main.js
├── manifest.json
├── styles.css
├── data.json              ← 保留：核心设置、版本信息、功能开关
└── configs/               ← 新增：按功能拆分的配置目录
    ├── graph-enhance.json
    ├── file-tags.json
    ├── auto-backlink.json
    └── ...
```

### 3.2 核心类实现

```typescript
// src/FeatureConfigManager.ts
import { Plugin, normalizePath, TFile } from 'obsidian';

/**
 * 功能配置管理器
 * 负责将不同功能的配置存储到独立的 JSON 文件中
 */
export class FeatureConfigManager {
    private plugin: Plugin;
    private configDir: string;

    constructor(plugin: Plugin) {
        this.plugin = plugin;
        this.configDir = normalizePath(
            `${plugin.app.vault.configDir}/plugins/${plugin.manifest.id}/configs`
        );
    }

    /**
     * 初始化配置目录
     * 在插件 onload 时调用
     */
    async initialize(): Promise<void> {
        const adapter = this.plugin.app.vault.adapter;
        if (!(await adapter.exists(this.configDir))) {
            await adapter.mkdir(this.configDir);
        }
    }

    /**
     * 获取某个功能的配置文件路径
     */
    private getConfigPath(featureName: string): string {
        return normalizePath(`${this.configDir}/${featureName}.json`);
    }

    /**
     * 保存功能配置
     * @param featureName 功能标识名（如 'graph-enhance'）
     * @param data 配置数据对象
     */
    async save<T>(featureName: string, data: T): Promise<void> {
        const filePath = this.getConfigPath(featureName);
        const adapter = this.plugin.app.vault.adapter;

        try {
            const jsonString = JSON.stringify(data, null, 2);
            await adapter.write(filePath, jsonString);
        } catch (error) {
            console.error(
                `[${this.plugin.manifest.name}] 保存配置失败 (${featureName}):`,
                error
            );
            throw error;
        }
    }

    /**
     * 加载功能配置
     * @param featureName 功能标识名
     * @param defaultValue 默认值（文件不存在时返回）
     * @returns 配置数据或默认值
     */
    async load<T>(featureName: string, defaultValue: T): Promise<T> {
        const filePath = this.getConfigPath(featureName);
        const adapter = this.plugin.app.vault.adapter;

        try {
            if (!(await adapter.exists(filePath))) {
                return defaultValue;
            }

            const content = await adapter.read(filePath);
            return JSON.parse(content) as T;
        } catch (error) {
            console.error(
                `[${this.plugin.manifest.name}] 加载配置失败 (${featureName}):`,
                error
            );
            return defaultValue;
        }
    }

    /**
     * 检查某个功能是否有已保存的配置
     */
    async exists(featureName: string): Promise<boolean> {
        const filePath = this.getConfigPath(featureName);
        return this.plugin.app.vault.adapter.exists(filePath);
    }

    /**
     * 删除某个功能的配置
     */
    async remove(featureName: string): Promise<void> {
        const filePath = this.getConfigPath(featureName);
        const adapter = this.plugin.app.vault.adapter;

        if (await adapter.exists(filePath)) {
            await adapter.remove(filePath);
        }
    }

    /**
     * 列出所有已保存的功能配置
     * @returns 功能名称数组（不含 .json 后缀）
     */
    async list(): Promise<string[]> {
        const adapter = this.plugin.app.vault.adapter;

        if (!(await adapter.exists(this.configDir))) {
            return [];
        }

        const listed = await adapter.list(this.configDir);
        return listed.files
            .filter((f: string) => f.endsWith('.json'))
            .map((f: string) => f.replace('.json', ''));
    }

    /**
     * 重命名功能配置
     */
    async rename(oldName: string, newName: string): Promise<void> {
        const oldPath = this.getConfigPath(oldName);
        const newPath = this.getConfigPath(newName);
        const adapter = this.plugin.app.vault.adapter;

        if (await adapter.exists(oldPath)) {
            await adapter.rename(oldPath, newPath);
        }
    }
}
```

### 3.3 在插件主文件中使用

```typescript
// main.ts
import { Plugin, App, PluginSettingTab, Setting } from 'obsidian';
import { FeatureConfigManager } from './src/FeatureConfigManager';

// ============ 接口定义 ============

interface MyPluginSettings {
    version: string;
    // 核心设置保留在 data.json 中
    enableGraphEnhance: boolean;
    enableFileTags: boolean;
    enableAutoBacklink: boolean;
}

interface GraphEnhanceConfig {
    nodeColors: Record<string, string>;
    customFilters: string[];
    layoutSettings: {
        force: number;
        distance: number;
    };
}

interface FileTagConfig {
    tagRules: Array<{
        pattern: string;
        tag: string;
    }>;
    autoTagPatterns: string[];
    defaultFolder: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
    version: '1.0.0',
    enableGraphEnhance: true,
    enableFileTags: true,
    enableAutoBacklink: false,
};

const DEFAULT_GRAPH_CONFIG: GraphEnhanceConfig = {
    nodeColors: {
        'MOC': '#ff6b6b',
        'Project': '#4ecdc4',
        'Daily': '#45b7d1',
    },
    customFilters: [],
    layoutSettings: {
        force: 100,
        distance: 150,
    },
};

const DEFAULT_TAG_CONFIG: FileTagConfig = {
    tagRules: [
        { pattern: 'TODO', tag: '待办' },
        { pattern: 'BUG', tag: '缺陷' },
    ],
    autoTagPatterns: ['#review', '#archive'],
    defaultFolder: 'Inbox',
};

// ============ 插件主类 ============

export default class MyPlugin extends Plugin {
    settings: MyPluginSettings;
    featureConfig: FeatureConfigManager;

    // 各功能的配置缓存（可选，减少磁盘读取）
    graphConfig: GraphEnhanceConfig;
    tagConfig: FileTagConfig;

    async onload() {
        // 1. 加载核心设置（data.json）
        await this.loadSettings();

        // 2. 初始化功能配置管理器
        this.featureConfig = new FeatureConfigManager(this);
        await this.featureConfig.initialize();

        // 3. 加载各功能的独立配置
        await this.loadFeatureConfigs();

        // 4. 注册命令、视图、事件等
        this.addCommand({
            id: 'open-graph-settings',
            name: '打开关系图谱设置',
            callback: () => this.openGraphSettings(),
        });

        this.addCommand({
            id: 'open-tag-settings',
            name: '打开文件标记设置',
            callback: () => this.openTagSettings(),
        });

        // 5. 添加设置面板
        this.addSettingTab(new MySettingTab(this.app, this));
    }

    async onunload() {
        // 可选：保存所有未保存的配置
        await this.saveAllFeatureConfigs();
    }

    // ============ 核心设置读写（data.json） ============

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    // ============ 功能配置读写（独立文件） ============

    async loadFeatureConfigs() {
        this.graphConfig = await this.featureConfig.load(
            'graph-enhance',
            DEFAULT_GRAPH_CONFIG
        );
        this.tagConfig = await this.featureConfig.load(
            'file-tags',
            DEFAULT_TAG_CONFIG
        );
    }

    async saveGraphConfig() {
        await this.featureConfig.save('graph-enhance', this.graphConfig);
    }

    async saveTagConfig() {
        await this.featureConfig.save('file-tags', this.tagConfig);
    }

    async saveAllFeatureConfigs() {
        await this.saveGraphConfig();
        await this.saveTagConfig();
    }

    // ============ 配置迁移（从 data.json 到独立文件） ============

    async migrateFromDataJson() {
        const oldData = await this.loadData();

        // 检查是否存在旧版配置
        if (oldData.graphEnhance) {
            await this.featureConfig.save('graph-enhance', oldData.graphEnhance);
            delete oldData.graphEnhance;
        }

        if (oldData.fileTags) {
            await this.featureConfig.save('file-tags', oldData.fileTags);
            delete oldData.fileTags;
        }

        // 保存清理后的 data.json
        await this.saveData(oldData);
    }

    // ============ 设置面板交互 ============

    openGraphSettings() {
        // 打开关系图谱设置模态框
        // 修改 this.graphConfig 后调用 this.saveGraphConfig()
    }

    openTagSettings() {
        // 打开文件标记设置模态框
        // 修改 this.tagConfig 后调用 this.saveTagConfig()
    }
}

// ============ 设置面板 ============

class MySettingTab extends PluginSettingTab {
    plugin: MyPlugin;

    constructor(app: App, plugin: MyPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'My Plugin 设置' });

        // 核心设置（保存在 data.json）
        new Setting(containerEl)
            .setName('启用关系图谱增强')
            .setDesc('开启后可在图谱视图中使用增强功能')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableGraphEnhance)
                .onChange(async (value) => {
                    this.plugin.settings.enableGraphEnhance = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启用文件标记')
            .setDesc('自动根据规则为文件添加标签')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableFileTags)
                .onChange(async (value) => {
                    this.plugin.settings.enableFileTags = value;
                    await this.plugin.saveSettings();
                }));

        // 功能配置入口（跳转到独立配置编辑器）
        containerEl.createEl('h3', { text: '功能配置' });

        new Setting(containerEl)
            .setName('关系图谱增强配置')
            .setDesc('编辑节点颜色、过滤器等')
            .addButton(button => button
                .setButtonText('编辑')
                .onClick(() => this.plugin.openGraphSettings()));

        new Setting(containerEl)
            .setName('文件标记配置')
            .setDesc('编辑自动标记规则')
            .addButton(button => button
                .setButtonText('编辑')
                .onClick(() => this.plugin.openTagSettings()));
    }
}
```

---

## 四、数据分类策略

### 4.1 什么应该留在 `data.json`

| 类型 | 示例 | 原因 |
|------|------|------|
| 功能开关 | `enableGraphEnhance` | 决定插件加载哪些模块 |
| 版本信息 | `version`, `lastMigration` | 迁移和兼容性检查 |
| 全局偏好 | `theme`, `language` | 影响整个插件的行为 |
| 敏感信息 | API Key、密码 | 利用 Obsidian 的加密同步 |
| 设备特定 | `deviceId` | 多设备同步时识别来源 |

### 4.2 什么应该拆分到独立文件

| 类型 | 示例 | 原因 |
|------|------|------|
| 大型配置 | 图谱节点颜色映射 | 体积大，变更频繁 |
| 规则列表 | 标记规则、过滤器 | 用户经常手动编辑 |
| 缓存数据 | 任务索引、外部日历缓存 | 可重建，不需要同步 |
| 状态数据 | 置顶任务、活跃追踪器 | 设备特定，实时变化 |
| 历史记录 | 操作日志、时间追踪 | 体积膨胀，独立归档 |

---

## 五、进阶技巧

### 5.1 配置版本控制

```typescript
interface VersionedConfig<T> {
    version: string;
    lastModified: number;
    data: T;
}

async saveWithVersion<T>(
    featureName: string,
    data: T,
    version: string
): Promise<void> {
    const versioned: VersionedConfig<T> = {
        version,
        lastModified: Date.now(),
        data,
    };
    await this.featureConfig.save(featureName, versioned);
}

async loadWithVersion<T>(
    featureName: string,
    currentVersion: string,
    defaultValue: T
): Promise<T> {
    const versioned = await this.featureConfig.load<VersionedConfig<T>>(
        featureName,
        null
    );

    if (!versioned) return defaultValue;

    // 版本迁移逻辑
    if (versioned.version !== currentVersion) {
        return await this.migrateConfig(versioned, currentVersion);
    }

    return versioned.data;
}
```

### 5.2 批量导入/导出

```typescript
async exportAllConfigs(): Promise<Record<string, any>> {
    const features = await this.featureConfig.list();
    const exportData: Record<string, any> = {};

    for (const feature of features) {
        exportData[feature] = await this.featureConfig.load(feature, null);
    }

    return exportData;
}

async importAllConfigs(data: Record<string, any>): Promise<void> {
    for (const [feature, config] of Object.entries(data)) {
        await this.featureConfig.save(feature, config);
    }
}
```

### 5.3 配置重置

```typescript
async resetFeatureConfig(
    featureName: string,
    defaultValue: any
): Promise<void> {
    await this.featureConfig.save(featureName, defaultValue);
}

async resetAllConfigs(): Promise<void> {
    const features = await this.featureConfig.list();
    for (const feature of features) {
        await this.featureConfig.remove(feature);
    }
}
```

### 5.4 写入队列（防止并发冲突）

```typescript
class WriteQueue {
    private queue: Map<string, Promise<void>> = new Map();

    async enqueue<T>(
        featureName: string,
        data: T,
        writeFn: (name: string, data: T) => Promise<void>
    ): Promise<void> {
        // 等待该功能的上一次写入完成
        const pending = this.queue.get(featureName);
        if (pending) {
            await pending;
        }

        const writePromise = writeFn(featureName, data).finally(() => {
            this.queue.delete(featureName);
        });

        this.queue.set(featureName, writePromise);
        await writePromise;
    }
}
```

---

## 六、迁移指南（从旧版 data.json 迁移）

### 6.1 检测旧版配置

```typescript
async detectLegacyConfig(): Promise<boolean> {
    const data = await this.loadData();
    return !!(data.graphEnhance || data.fileTags || data.legacyFeature);
}
```

### 6.2 自动迁移流程

```typescript
async runMigration(): Promise<void> {
    if (!(await this.detectLegacyConfig())) return;

    const data = await this.loadData();
    const migratedFeatures: string[] = [];

    // 定义迁移映射
    const migrationMap: Record<string, string> = {
        graphEnhance: 'graph-enhance',
        fileTags: 'file-tags',
        autoBacklink: 'auto-backlink',
    };

    for (const [oldKey, newKey] of Object.entries(migrationMap)) {
        if (data[oldKey]) {
            await this.featureConfig.save(newKey, data[oldKey]);
            delete data[oldKey];
            migratedFeatures.push(newKey);
        }
    }

    // 更新版本标记
    data.version = '2.0.0';
    data.lastMigration = Date.now();
    await this.saveData(data);

    // 通知用户
    if (migratedFeatures.length > 0) {
        new Notice(
            `已自动迁移 ${migratedFeatures.length} 个功能配置到独立文件`
        );
    }
}
```

### 6.3 向后兼容读取

```typescript
async loadWithFallback<T>(
    featureName: string,
    oldKey: string,
    defaultValue: T
): Promise<T> {
    // 优先从独立文件读取
    const fromFile = await this.featureConfig.load<T>(featureName, null);
    if (fromFile !== null) return fromFile;

    // 回退到 data.json
    const data = await this.loadData();
    if (data[oldKey]) {
        // 异步迁移（下次保存时写入独立文件）
        await this.featureConfig.save(featureName, data[oldKey]);
        return data[oldKey];
    }

    return defaultValue;
}
```

---

## 七、注意事项

### 7.1 路径处理

```typescript
// ✅ 正确：使用 normalizePath
const path = normalizePath(`${configDir}/${featureName}.json`);

// ❌ 错误：手动拼接
const path = configDir + '\' + featureName + '.json'; // Windows 不兼容
```

### 7.2 错误处理

```typescript
// 读取时始终提供默认值，避免崩溃
const config = await this.featureConfig.load('my-feature', DEFAULT_CONFIG);

// 写入时捕获并记录错误
try {
    await this.featureConfig.save('my-feature', config);
} catch (error) {
    console.error('保存失败:', error);
    new Notice('配置保存失败，请检查磁盘空间');
}
```

### 7.3 性能优化

```typescript
// 对于频繁读取的配置，使用内存缓存
private configCache: Map<string, any> = new Map();

async loadCached<T>(featureName: string, defaultValue: T): Promise<T> {
    if (this.configCache.has(featureName)) {
        return this.configCache.get(featureName);
    }

    const config = await this.featureConfig.load(featureName, defaultValue);
    this.configCache.set(featureName, config);
    return config;
}

// 修改后清除缓存
async updateConfig(featureName: string, data: any): Promise<void> {
    this.configCache.set(featureName, data);
    await this.featureConfig.save(featureName, data);
}
```

### 7.4 移动端兼容

`app.vault.adapter` API 在桌面端和移动端完全一致，无需额外处理。但需注意：

- 避免同步过大的配置文件（>1MB）
- 频繁写入可能触发 Obsidian 同步冲突
- 考虑使用防抖（debounce）减少写入频率

---

## 八、参考案例

| 插件 | 仓库 | 拆分策略 |
|------|------|----------|
| **Folder Bridge** | [GitHub](https://github.com/tescolopio/Obsidian_FolderBridge) | `data.json` + 独立 TOC JSON 文件 |
| **Operon** | [GitHub](https://github.com/hasanyilmaz/operon) | `data.json` + `state/` + `runtime/` + `cache/` |
| **Excalidraw** | [GitHub](https://github.com/zsviczian/obsidian-excalidraw-plugin) | 独立 `.excalidraw` 文件存储绘图数据 |

---

## 九、快速开始检查清单

- [ ] 在插件目录下创建 `configs/` 子目录
- [ ] 实现 `FeatureConfigManager` 类封装读写逻辑
- [ ] 定义各功能的配置接口（TypeScript）
- [ ] 在 `onload()` 中初始化配置管理器并加载配置
- [ ] 将核心设置保留在 `data.json`，功能配置拆分到独立文件
- [ ] 实现配置迁移逻辑（兼容旧版用户）
- [ ] 添加导入/导出功能（可选）
- [ ] 测试跨平台兼容性（Windows/macOS/Linux/Android）

---

*文档生成时间：2026-07-14*
*基于 Obsidian API v1.4.16+*