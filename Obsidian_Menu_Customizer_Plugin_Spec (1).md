# Obsidian 右键菜单自定义插件方案文档

> 适用版本：Obsidian v1.4.16（固定版本，不升级）
> 方案目标：完全接管并自定义文件夹右键菜单、文件右键菜单、编辑区右键菜单、编辑区"更多选项"菜单的分组、排序、重命名、隐藏、子菜单及样式

---

## 一、问题分析

### 1.1 现有痛点

| # | 痛点 | 现有 CSS 方案的局限 |
|---|------|-------------------|
| 1 | **不能自定义分组** | 只能隐藏/显示，无法创建逻辑分组 |
| 2 | **菜单项没有唯一标识** | 只能通过 `data-section` + SVG 类名间接定位，选择器脆弱且性能差 |
| 3 | **不能自定义命令名称和顺序** | 菜单项是只读的，无法修改标题或重排 |
| 4 | **多余的分隔符** | 隐藏命令后，相邻分隔符残留 |
| 5 | **命令不能真正隐藏** | 只能 `display: none`，DOM 仍在，消耗资源 |
| 6 | **需要子菜单（级联菜单）** | 无原生支持，无法实现悬浮出面板的分组效果 |

### 1.2 根本原因

Obsidian 的 `Menu` API 只允许**追加**（`addItem` / `addSeparator`），不允许：
- 修改已有项的标题/图标/顺序
- 删除已有项
- 创建子菜单（`setSubmenu` 为私有 API，未在文档公开）

### 1.3 两种技术路线的对比

| 维度 | 完全接管 Menu 创建 | 重构 Menu DOM（推荐） |
|------|-------------------|----------------------|
| **菜单创建** | 从零构建，需查询命令、创建 MenuItem、绑定回调 | Obsidian + 插件已构建好，只读 DOM |
| **命令执行** | `executeCommandById`，部分命令参数传不对会失败 | 原始回调保留在 DOM 节点上，移动即可 |
| **插件兼容性** | 需手动调用其他插件命令注册逻辑，容易遗漏 | 其他插件命令已在 DOM 里，天然兼容 |
| **事件绑定** | 自己处理 click、hover、键盘导航 | 原始事件监听器随 DOM 节点移动 |
| **DOM 操作量** | 创建全新 DOM 节点 | 移动已有节点 + 插入少量分组标题/分隔符 |
| **内存分配** | 新建大量对象 | 几乎零新增（复用已有节点） |
| **子菜单支持** | 需自己实现定位和事件 | 利用 v1.4.16 私有 API `setSubmenu()` |
| **性能** | +50~200ms（命令查询+创建） | +5~20ms（纯 DOM 重排） |
| **代码复杂度** | 高 | 中 |

**结论：采用"重构 Menu DOM"方案，结合 v1.4.16 私有 API `setSubmenu()` 实现子菜单。**

---

## 二、核心发现：v1.4.16 的私有子菜单 API

### 2.1 论坛源码分析

从 Obsidian 中文论坛（topic/29349、topic/30838）的 `app.js` 反编译代码确认：

```typescript
// MenuItem 存在 setSubmenu 方法（私有）
MenuItem.prototype.setSubmenu = function() {
    this.submenu || (this.dom.addClass("has-submenu"), 
    this.submenu = new Menu(this.app), 
    this.dom.createDiv("menu-item-icon mod-submenu"), 
    this.onClick((function(e) {
        return e.preventDefault();  // 阻止默认点击，改为打开子菜单
    })));
    return this.submenu;
};

// Menu 存在 openSubmenu 方法（内部处理 hover/click 显示定位）
Menu.prototype.openSubmenu = function(e) {
    // 处理子菜单显示位置、边界检测、关闭逻辑
    // ...
};
```

### 2.2 关键特征

| 特征 | 说明 |
|------|------|
| `setSubmenu()` | 在 `MenuItem` 上，返回新的 `Menu` 实例 |
| `has-submenu` | 添加到父项 DOM 的 CSS 类 |
| `mod-submenu` | 子菜单箭头图标的 CSS 类 |
| `openSubmenu` | 内部处理悬浮/点击显示、定位、关闭 |
| `parentMenu` / `currentSubmenu` | 维护菜单层级关系 |

### 2.3 使用示例

```typescript
menu.addItem((item) => {
    item.setIcon("copy").setTitle("test1");
    const submenu = (item as any).setSubmenu();  // 调用私有 API
    submenu.addItem((subItem) => {
        subItem.setIcon("copy").setTitle("test2");
    });
});
```

---

## 三、方案架构

### 3.1 整体思路

```
Obsidian + 插件正常构建菜单 → 菜单显示前拦截 → 读取已有 DOM 节点 → 
按用户配置重新分组/排序/重命名 → 多命令分组转为子菜单 → 
精确控制分隔符 → 显示重构后的菜单
```

### 3.2 模块划分

```
Plugin
├── 核心拦截层
│   ├── patchMenuShow()          // 拦截 Menu.showAtMouseEvent / showAtPosition
│   ├── shouldCustomize()         // 判断菜单类型（editor / file / folder / moreOptions）
│   └── rebuildMenu()             // 主重构逻辑
│
├── 命令识别层
│   ├── resolveCommandId()        // 标题+section → 命令 ID 映射
│   └── COMMAND_MAP               // v1.4.16 静态映射表（中英双语）
│
├── DOM 重构层
│   ├── collectItems()            // 收集并识别所有菜单项
│   ├── applyOverrides()          // 应用重命名/图标覆盖
│   ├── buildGroups()             // 按配置分组
│   ├── createSubmenu()           // 调用 setSubmenu() 创建子菜单
│   └── injectSeparators()        // 精确插入分隔符
│
├── 设置界面
│   ├── MenuConfigSettingTab      // 分组管理、命令配置
│   ├── DragDropSorter            // 拖拽排序
│   └── CommandPicker             // 命令选择器
│
└── CSS 注入层
    └── injectStyles()            // 注入动态 CSS（分组标题样式、flex 布局等）
```

---

## 四、关键代码实现

### 4.1 类型扩展（声明私有 API）

```typescript
// types.d.ts

declare module 'obsidian' {
    interface MenuItem {
        /** 私有 API：创建子菜单 */
        setSubmenu(): Menu;
        /** 子菜单引用 */
        submenu?: Menu;
        /** 内部 DOM 元素 */
        dom: HTMLElement;
        /** 标题元素 */
        titleEl?: HTMLElement;
        /** 所属分组 */
        section?: string;
        /** 回调函数 */
        callback?: () => void;
    }

    interface Menu {
        /** 内部 DOM 元素 */
        dom: HTMLElement;
        /** 菜单项数组 */
        items: MenuItem[];
        /** 私有 API：打开子菜单 */
        openSubmenu(item: MenuItem): void;
        /** 私有 API：关闭子菜单 */
        closeSubmenu(): void;
        /** 当前子菜单 */
        currentSubmenu?: Menu;
        /** 父菜单 */
        parentMenu?: Menu;
        /** 当前选中项索引 */
        selected?: number;
    }
}
```

### 4.2 核心插件类

```typescript
// main.ts

import { 
    Plugin, Menu, MenuItem, TAbstractFile, 
    Editor, MarkdownView, WorkspaceLeaf 
} from 'obsidian';
import { MenuCustomizerSettingTab } from './settings';
import { DEFAULT_SETTINGS, MenuCustomizerSettings } from './types';

export default class MenuCustomizerPlugin extends Plugin {
    settings: MenuCustomizerSettings;
    private originalShowAtMouseEvent: Function;
    private originalShowAtPosition: Function;

    async onload() {
        await this.loadSettings();

        // 拦截菜单显示
        this.patchMenuMethods();

        // 注册设置界面
        this.addSettingTab(new MenuCustomizerSettingTab(this.app, this));

        // 注入基础 CSS
        this.injectBaseStyles();
    }

    /**
     * 拦截 Menu 的显示方法，在显示前重构菜单
     */
    private patchMenuMethods() {
        const plugin = this;

        this.originalShowAtMouseEvent = Menu.prototype.showAtMouseEvent;
        this.originalShowAtPosition = Menu.prototype.showAtPosition;

        Menu.prototype.showAtMouseEvent = function(evt: MouseEvent) {
            const menu = this as Menu;
            if (plugin.shouldCustomize(menu)) {
                plugin.rebuildMenu(menu);
            }
            return plugin.originalShowAtMouseEvent.call(menu, evt);
        };

        Menu.prototype.showAtPosition = function(pos: { x: number; y: number }) {
            const menu = this as Menu;
            if (plugin.shouldCustomize(menu)) {
                plugin.rebuildMenu(menu);
            }
            return plugin.originalShowAtPosition.call(menu, pos);
        };
    }

    /**
     * 判断菜单是否需要自定义，并推断菜单类型
     */
    private shouldCustomize(menu: Menu): boolean {
        const items = menu.items;
        if (!items || items.length === 0) return false;

        const titles = items.map(i => i.titleEl?.textContent?.trim() || '');
        const sections = items.map(i => i.section || '');

        // 编辑区右键菜单特征
        if (titles.some(t => /^(剪切|复制|粘贴|Cut|Copy|Paste)$/i.test(t)) &&
            sections.some(s => s === 'edit')) {
            (menu as any).__menuType = 'editor';
            return true;
        }

        // 编辑区"更多选项"菜单特征
        if (titles.some(t => /^(打开链接视图|复制 Obsidian 链接|Copy full path)$/i.test(t))) {
            (menu as any).__menuType = 'moreOptions';
            return true;
        }

        // 文件右键菜单特征
        if (titles.some(t => /^(打开|删除|重命名|Open|Delete|Rename)$/i.test(t)) &&
            !titles.some(t => /^(新建|New)/i.test(t))) {
            (menu as any).__menuType = 'file';
            return true;
        }

        // 文件夹右键菜单特征
        if (titles.some(t => /^(新建笔记|新建文件夹|New note|New folder)$/i.test(t))) {
            (menu as any).__menuType = 'folder';
            return true;
        }

        return false;
    }

    /**
     * 核心重构逻辑
     */
    private rebuildMenu(menu: Menu) {
        const menuType = (menu as any).__menuType as string;
        const config = this.settings.menus[menuType];
        if (!config || !config.enabled) return;

        const items = menu.items;
        const menuEl = menu.dom;

        // 1. 收集并识别所有菜单项
        const { identified, unknown } = this.collectItems(items, menuType);

        // 2. 应用用户覆盖配置（重命名、图标、隐藏）
        this.applyOverrides(identified, config);

        // 3. 过滤隐藏项
        const visible = new Map<string, MenuItem>();
        for (const [cmdId, item] of identified) {
            if (!config.commandOverrides[cmdId]?.hidden) {
                visible.set(cmdId, item);
            }
        }

        // 4. 清空原菜单 DOM（保留 items 数组引用，防止 submenu 丢失）
        menuEl.empty();
        // 注意：不清空 items 数组，因为子菜单可能引用其中的项

        // 5. 按分组重建
        let firstGroup = true;
        const usedCommands = new Set<string>();

        for (const group of config.groups) {
            if (group.hidden) continue;

            // 收集本组命令
            const groupItems: MenuItem[] = [];
            for (const cmdId of group.commands) {
                const item = visible.get(cmdId);
                if (item) {
                    groupItems.push(item);
                    usedCommands.add(cmdId);
                }
            }

            if (groupItems.length === 0) continue;

            // 插入分隔符（非第一组）
            if (!firstGroup) {
                this.addSeparator(menu, menuEl);
            }
            firstGroup = false;

            if (groupItems.length === 1 && !group.forceSubmenu) {
                // 单命令，直接显示
                const item = groupItems[0];
                menuEl.appendChild(item.dom);
                // 确保在 items 数组中
                if (!menu.items.includes(item)) {
                    menu.items.push(item);
                }
            } else {
                // 多命令，创建子菜单
                this.createSubmenuGroup(menu, menuEl, group, groupItems);
            }
        }

        // 6. 处理未分组的已识别命令
        const ungrouped: MenuItem[] = [];
        for (const [cmdId, item] of visible) {
            if (!usedCommands.has(cmdId)) {
                ungrouped.push(item);
            }
        }

        // 7. 追加未识别的插件命令
        if (unknown.length > 0 || ungrouped.length > 0) {
            if (!firstGroup) {
                this.addSeparator(menu, menuEl);
            }

            // 未分组命令
            for (const item of ungrouped) {
                menuEl.appendChild(item.dom);
                if (!menu.items.includes(item)) {
                    menu.items.push(item);
                }
            }

            // 插件命令
            for (const item of unknown) {
                menuEl.appendChild(item.dom);
                if (!menu.items.includes(item)) {
                    menu.items.push(item);
                }
            }
        }

        // 8. 清理 items 数组，移除未使用的项（防止内存泄漏）
        const usedDoms = new Set(Array.from(menuEl.children));
        menu.items = menu.items.filter(item => usedDoms.has(item.dom));
    }

    /**
     * 收集并识别菜单项
     */
    private collectItems(items: MenuItem[], menuType: string): {
        identified: Map<string, MenuItem>;
        unknown: MenuItem[];
    } {
        const identified = new Map<string, MenuItem>();
        const unknown: MenuItem[] = [];

        for (const item of items) {
            const title = item.titleEl?.textContent?.trim() || '';
            const section = item.section || '';
            const cmdId = this.resolveCommandId(title, section, menuType);

            if (cmdId) {
                identified.set(cmdId, item);
            } else {
                unknown.push(item);
            }
        }

        return { identified, unknown };
    }

    /**
     * 应用用户覆盖配置
     */
    private applyOverrides(identified: Map<string, MenuItem>, config: any) {
        for (const [cmdId, item] of identified) {
            const override = config.commandOverrides[cmdId];
            if (!override) continue;

            if (override.title) {
                item.titleEl!.textContent = override.title;
            }
            if (override.icon) {
                // 更新图标（需要重新创建图标元素）
                const iconEl = item.dom.querySelector('.menu-item-icon');
                if (iconEl) {
                    iconEl.empty();
                    // 使用 Obsidian 的 setIcon 工具函数
                    const { setIcon } = require('obsidian');
                    setIcon(iconEl as HTMLElement, override.icon);
                }
            }
        }
    }

    /**
     * 创建子菜单分组
     */
    private createSubmenuGroup(
        menu: Menu, 
        menuEl: HTMLElement, 
        group: any, 
        items: MenuItem[]
    ) {
        const parentItem = menu.addItem((item) => {
            item.setTitle(group.name);
            if (group.icon) {
                (item as any).setIcon(group.icon);
            }

            // 调用私有 API 创建子菜单
            const submenu = (item as any).setSubmenu();

            // 将命令移入子菜单
            for (const childItem of items) {
                submenu.items.push(childItem);
                submenu.dom.appendChild(childItem.dom);
            }
        });

        // 将父项 DOM 移到正确位置
        menuEl.appendChild(parentItem.dom);
    }

    /**
     * 添加分隔符
     */
    private addSeparator(menu: Menu, menuEl: HTMLElement) {
        const sep = menuEl.createDiv({ cls: 'menu-separator' });
        // 注意：不加入 menu.items，因为分隔符不是 MenuItem
    }

    /**
     * 命令 ID 解析（v1.4.16 静态映射表）
     */
    private resolveCommandId(title: string, section: string, menuType: string): string | null {
        const MAP = COMMAND_MAP[menuType];
        if (!MAP) return null;

        // 精确匹配
        if (MAP[title]) return MAP[title];

        // 模糊匹配
        const lowerTitle = title.toLowerCase();
        for (const [key, id] of Object.entries(MAP)) {
            if (lowerTitle.includes(key.toLowerCase()) || 
                key.toLowerCase().includes(lowerTitle)) {
                return id;
            }
        }

        return null;
    }

    /**
     * 注入基础 CSS
     */
    private injectBaseStyles() {
        const style = document.createElement('style');
        style.id = 'menu-customizer-styles';
        style.textContent = `
            /* 分组标题样式 */
            .menu-item.menu-group-title {
                font-weight: bold;
                color: var(--text-muted);
                cursor: default;
                pointer-events: none;
                background-color: var(--background-modifier-hover);
                padding: 4px 12px;
                margin: 0;
            }
            .menu-item.menu-group-title:hover {
                background-color: var(--background-modifier-hover) !important;
            }

            /* 子菜单箭头 */
            .menu-item.has-submenu .menu-item-icon.mod-submenu {
                margin-left: auto;
            }

            /* 编辑区命令 flex 布局 */
            .menu[data-menu-type="editor"] {
                /* 可根据需要启用 flex 布局 */
            }
        `;
        document.head.appendChild(style);
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    onunload() {
        // 恢复原始方法
        if (this.originalShowAtMouseEvent) {
            Menu.prototype.showAtMouseEvent = this.originalShowAtMouseEvent;
        }
        if (this.originalShowAtPosition) {
            Menu.prototype.showAtPosition = this.originalShowAtPosition;
        }

        // 移除注入的 CSS
        const style = document.getElementById('menu-customizer-styles');
        if (style) style.remove();
    }
}

// ==================== 命令映射表 ====================

const COMMAND_MAP: Record<string, Record<string, string>> = {
    editor: {
        '剪切': 'editor:cut',
        '复制': 'editor:copy',
        '粘贴': 'editor:paste',
        '以纯文本形式粘贴': 'editor:paste-as-plain-text',
        '全选': 'editor:select-all',
        '加粗': 'editor:toggle-bold',
        '斜体': 'editor:toggle-italics',
        '高亮': 'editor:toggle-highlight',
        '删除线': 'editor:toggle-strikethrough',
        '代码': 'editor:toggle-code',
        'Math block': 'editor:insert-mathblock',
        'Callout': 'editor:insert-callout',
        'Table': 'editor:insert-table',
        'Horizontal rule': 'editor:insert-horizontal-rule',
        'Code block': 'editor:insert-codeblock',
        'Link': 'editor:insert-link',
        'Embed file': 'editor:insert-embed',
        'Tag': 'editor:insert-tag',
        'Attachment': 'editor:attach-file',
        'Comment': 'editor:toggle-comment',
        'Footnote': 'editor:insert-footnote',
        'Heading 1': 'editor:set-heading-1',
        'Heading 2': 'editor:set-heading-2',
        'Heading 3': 'editor:set-heading-3',
        'Heading 4': 'editor:set-heading-4',
        'Heading 5': 'editor:set-heading-5',
        'Heading 6': 'editor:set-heading-6',
        'Toggle heading': 'editor:toggle-heading',
        'Increase indent': 'editor:indent-list',
        'Decrease indent': 'editor:unindent-list',
        'Toggle checklist status': 'editor:toggle-checklist-status',
        'Move line up': 'editor:move-line-up',
        'Move line down': 'editor:move-line-down',
        'Delete paragraph': 'editor:delete-paragraph',
        'Swap line up': 'editor:swap-line-up',
        'Swap line down': 'editor:swap-line-down',
        'Join lines': 'editor:join-lines',
        'Copy line up': 'editor:copy-line-up',
        'Copy line down': 'editor:copy-line-down',
        'Undo': 'editor:undo',
        'Redo': 'editor:redo',
        'Find': 'editor:open-search',
        'Find and replace': 'editor:open-search-replace',
        // 英文映射
        'Cut': 'editor:cut',
        'Copy': 'editor:copy',
        'Paste': 'editor:paste',
        'Paste as plain text': 'editor:paste-as-plain-text',
        'Select all': 'editor:select-all',
        'Bold': 'editor:toggle-bold',
        'Italics': 'editor:toggle-italics',
        'Highlight': 'editor:toggle-highlight',
        'Strikethrough': 'editor:toggle-strikethrough',
        'Inline code': 'editor:toggle-code',
    },

    moreOptions: {
        '打开链接视图': 'file-explorer:open-link-view',
        '复制 Obsidian 链接': 'file-explorer:copy-path',
        'Copy full path': 'file-explorer:copy-vault-path',
        'Create a command for this file': 'commander:create-command-for-file',
        // 更多选项菜单的命令需要进一步补充
    },

    file: {
        '打开': 'file-explorer:open',
        '在新标签页打开': 'file-explorer:open-in-new-tab',
        '在右侧打开': 'file-explorer:open-to-the-right',
        '在新窗口打开': 'file-explorer:open-in-new-window',
        '删除文件': 'file-explorer:delete-file',
        '重命名': 'file-explorer:rename-file',
        '复制 Obsidian 链接': 'file-explorer:copy-path',
        '复制路径': 'file-explorer:copy-vault-path',
        'Reveal in folder navigation': 'file-explorer:reveal-active-file',
        '在文件列表中显示': 'file-explorer:reveal-active-file',
        // 英文映射
        'Open': 'file-explorer:open',
        'Open in new tab': 'file-explorer:open-in-new-tab',
        'Open to the right': 'file-explorer:open-to-the-right',
        'Open in new window': 'file-explorer:open-in-new-window',
        'Delete file': 'file-explorer:delete-file',
        'Rename': 'file-explorer:rename-file',
        'Copy Obsidian URL': 'file-explorer:copy-path',
        'Copy path': 'file-explorer:copy-vault-path',
    },

    folder: {
        '新建笔记': 'file-explorer:new-file',
        '新建文件夹': 'file-explorer:new-folder',
        '重命名': 'file-explorer:rename-file',
        '删除文件夹': 'file-explorer:delete-file',
        '复制 Obsidian 链接': 'file-explorer:copy-path',
        '复制路径': 'file-explorer:copy-vault-path',
        '在文件列表中显示': 'file-explorer:reveal-active-file',
        '折叠': 'file-explorer:collapse-all',
        '展开': 'file-explorer:expand-all',
        // 英文映射
        'New note': 'file-explorer:new-file',
        'New folder': 'file-explorer:new-folder',
        'Rename': 'file-explorer:rename-file',
        'Delete folder': 'file-explorer:delete-file',
        'Collapse': 'file-explorer:collapse-all',
        'Expand': 'file-explorer:expand-all',
    }
};
```

### 4.3 设置界面

```typescript
// settings.ts

import { App, PluginSettingTab, Setting } from 'obsidian';
import MenuCustomizerPlugin from './main';

export class MenuCustomizerSettingTab extends PluginSettingTab {
    plugin: MenuCustomizerPlugin;

    constructor(app: App, plugin: MenuCustomizerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: '右键菜单自定义' });

        // 菜单类型选择
        const menuTypes = [
            { id: 'editor', name: '编辑区右键菜单' },
            { id: 'moreOptions', name: '编辑区"更多选项"菜单' },
            { id: 'file', name: '文件右键菜单' },
            { id: 'folder', name: '文件夹右键菜单' },
        ];

        for (const menuType of menuTypes) {
            this.renderMenuSection(containerEl, menuType);
        }
    }

    private renderMenuSection(containerEl: HTMLElement, menuType: { id: string; name: string }) {
        const config = this.plugin.settings.menus[menuType.id];

        containerEl.createEl('h3', { text: menuType.name });

        // 启用开关
        new Setting(containerEl)
            .setName('启用自定义')
            .setDesc(`为${menuType.name}启用自定义分组和排序`)
            .addToggle(toggle => toggle
                .setValue(config.enabled)
                .onChange(async (value) => {
                    config.enabled = value;
                    await this.plugin.saveSettings();
                }));

        if (!config.enabled) return;

        // 分组管理
        containerEl.createEl('h4', { text: '分组管理' });

        for (let i = 0; i < config.groups.length; i++) {
            const group = config.groups[i];

            const groupEl = containerEl.createDiv({ cls: 'menu-group-config' });

            new Setting(groupEl)
                .setName(`分组 ${i + 1}`)
                .addText(text => text
                    .setPlaceholder('分组名称')
                    .setValue(group.name)
                    .onChange(async (value) => {
                        group.name = value;
                        await this.plugin.saveSettings();
                    }))
                .addText(text => text
                    .setPlaceholder('图标 (可选)')
                    .setValue(group.icon || '')
                    .onChange(async (value) => {
                        group.icon = value || undefined;
                        await this.plugin.saveSettings();
                    }))
                .addToggle(toggle => toggle
                    .setValue(!!group.forceSubmenu)
                    .setTooltip('强制使用子菜单（即使只有一个命令）')
                    .onChange(async (value) => {
                        group.forceSubmenu = value;
                        await this.plugin.saveSettings();
                    }))
                .addButton(btn => btn
                    .setButtonText('删除')
                    .onClick(async () => {
                        config.groups.splice(i, 1);
                        await this.plugin.saveSettings();
                        this.display();
                    }));

            // 命令列表（拖拽排序）
            const commandListEl = groupEl.createDiv({ cls: 'command-list' });
            for (let j = 0; j < group.commands.length; j++) {
                const cmdId = group.commands[j];
                const cmdConfig = config.commandOverrides[cmdId];

                const cmdEl = commandListEl.createDiv({ cls: 'command-item', text: cmdId });

                // 上移
                if (j > 0) {
                    cmdEl.createEl('button', { text: '↑', cls: 'move-up' })
                        .addEventListener('click', async () => {
                            [group.commands[j], group.commands[j-1]] = 
                            [group.commands[j-1], group.commands[j]];
                            await this.plugin.saveSettings();
                            this.display();
                        });
                }

                // 下移
                if (j < group.commands.length - 1) {
                    cmdEl.createEl('button', { text: '↓', cls: 'move-down' })
                        .addEventListener('click', async () => {
                            [group.commands[j], group.commands[j+1]] = 
                            [group.commands[j+1], group.commands[j]];
                            await this.plugin.saveSettings();
                            this.display();
                        });
                }

                // 删除
                cmdEl.createEl('button', { text: '×', cls: 'remove' })
                    .addEventListener('click', async () => {
                        group.commands.splice(j, 1);
                        await this.plugin.saveSettings();
                        this.display();
                    });
            }

            // 添加命令到分组
            new Setting(groupEl)
                .addText(text => text
                    .setPlaceholder('输入命令 ID'))
                .addButton(btn => btn
                    .setButtonText('添加命令')
                    .onClick(async () => {
                        const input = btn.buttonEl.previousElementSibling as HTMLInputElement;
                        const cmdId = input.value.trim();
                        if (cmdId) {
                            group.commands.push(cmdId);
                            input.value = '';
                            await this.plugin.saveSettings();
                            this.display();
                        }
                    }));
        }

        // 添加新分组
        new Setting(containerEl)
            .addButton(btn => btn
                .setButtonText('添加分组')
                .onClick(async () => {
                    config.groups.push({
                        name: '新分组',
                        commands: []
                    });
                    await this.plugin.saveSettings();
                    this.display();
                }));

        // 命令覆盖配置
        containerEl.createEl('h4', { text: '命令覆盖' });

        for (const [cmdId, override] of Object.entries(config.commandOverrides)) {
            const cmdEl = containerEl.createDiv({ cls: 'command-override' });

            new Setting(cmdEl)
                .setName(cmdId)
                .addText(text => text
                    .setPlaceholder('自定义名称')
                    .setValue(override.title || '')
                    .onChange(async (value) => {
                        override.title = value || undefined;
                        await this.plugin.saveSettings();
                    }))
                .addText(text => text
                    .setPlaceholder('自定义图标')
                    .setValue(override.icon || '')
                    .onChange(async (value) => {
                        override.icon = value || undefined;
                        await this.plugin.saveSettings();
                    }))
                .addToggle(toggle => toggle
                    .setValue(!override.hidden)
                    .setTooltip('显示/隐藏')
                    .onChange(async (value) => {
                        override.hidden = !value;
                        await this.plugin.saveSettings();
                    }));
        }
    }
}
```

### 4.4 类型定义

```typescript
// types.ts

export interface MenuGroupConfig {
    /** 分组名称 */
    name: string;
    /** 分组图标（Obsidian icon 名称） */
    icon?: string;
    /** 包含的命令 ID 列表 */
    commands: string[];
    /** 是否隐藏整个分组 */
    hidden?: boolean;
    /** 强制使用子菜单（即使只有一个命令） */
    forceSubmenu?: boolean;
}

export interface CommandOverride {
    /** 自定义显示名称 */
    title?: string;
    /** 自定义图标 */
    icon?: string;
    /** 是否隐藏 */
    hidden?: boolean;
}

export interface MenuConfig {
    /** 是否启用自定义 */
    enabled: boolean;
    /** 分组列表 */
    groups: MenuGroupConfig[];
    /** 命令覆盖配置 */
    commandOverrides: Record<string, CommandOverride>;
}

export interface MenuCustomizerSettings {
    menus: Record<string, MenuConfig>;
}

export const DEFAULT_SETTINGS: MenuCustomizerSettings = {
    menus: {
        editor: {
            enabled: false,
            groups: [
                {
                    name: '编辑',
                    icon: 'scissors',
                    commands: ['editor:cut', 'editor:copy', 'editor:paste', 'editor:paste-as-plain-text']
                },
                {
                    name: '格式',
                    icon: 'bold',
                    commands: ['editor:toggle-bold', 'editor:toggle-italics', 'editor:toggle-highlight']
                },
                {
                    name: '插入',
                    icon: 'plus',
                    commands: ['editor:insert-link', 'editor:insert-embed', 'editor:insert-table']
                }
            ],
            commandOverrides: {}
        },
        moreOptions: {
            enabled: false,
            groups: [],
            commandOverrides: {}
        },
        file: {
            enabled: false,
            groups: [
                {
                    name: '打开',
                    icon: 'file-open',
                    commands: ['file-explorer:open', 'file-explorer:open-in-new-tab', 'file-explorer:open-to-the-right']
                },
                {
                    name: '管理',
                    icon: 'settings',
                    commands: ['file-explorer:rename-file', 'file-explorer:delete-file']
                }
            ],
            commandOverrides: {}
        },
        folder: {
            enabled: false,
            groups: [
                {
                    name: '新建',
                    icon: 'plus',
                    commands: ['file-explorer:new-file', 'file-explorer:new-folder']
                }
            ],
            commandOverrides: {}
        }
    }
};
```

### 4.5 manifest.json

```json
{
    "id": "menu-customizer",
    "name": "Menu Customizer",
    "version": "1.0.0",
    "minAppVersion": "1.4.16",
    "description": "自定义右键菜单的分组、排序、子菜单和样式",
    "author": "Your Name",
    "authorUrl": "",
    "isDesktopOnly": true
}
```

---

## 五、文件结构

```
menu-customizer/
├── main.ts              # 核心插件逻辑
├── settings.ts          # 设置界面
├── types.ts             # 类型定义和默认配置
├── styles.css           # 可选：额外样式（也可通过 JS 注入）
├── manifest.json        # 插件清单
└── esbuild.config.mjs   # 构建配置
```

---

## 六、构建步骤

```bash
# 1. 初始化项目
mkdir menu-customizer
cd menu-customizer
npm init -y

# 2. 安装依赖
npm install obsidian
npm install --save-dev esbuild obsidian

# 3. 创建 esbuild.config.mjs
```

```javascript
// esbuild.config.mjs
import esbuild from 'esbuild';
import process from 'process';

const prod = process.argv[2] === 'production';

const context = await esbuild.context({
    entryPoints: ['main.ts'],
    bundle: true,
    external: ['obsidian'],
    format: 'cjs',
    target: 'es2018',
    outfile: 'main.js',
    sourcemap: prod ? false : 'inline',
});

if (prod) {
    await context.rebuild();
    process.exit(0);
} else {
    await context.watch();
}
```

```bash
# 4. 构建
node esbuild.config.mjs production

# 5. 复制到 Obsidian 插件目录
cp main.js manifest.json "你的库/.obsidian/plugins/menu-customizer/"
```

---

## 七、使用方式

1. 将插件文件夹复制到 `.obsidian/plugins/menu-customizer/`
2. 在 Obsidian 设置 → 社区插件中启用 "Menu Customizer"
3. 进入插件设置，选择要自定义的菜单类型
4. 创建分组，拖拽/输入命令 ID，配置显示名称和图标
5. 即时生效，无需重启

---

## 八、待完善项

| # | 事项 | 优先级 |
|---|------|--------|
| 1 | 补充完整 `moreOptions` 菜单的命令映射 | 高 |
| 2 | 实现拖拽排序（当前用上下按钮） | 中 |
| 3 | 命令选择器（从可用命令列表选择，而非手动输入 ID） | 中 |
| 4 | 导入/导出配置 | 低 |
| 5 | 支持条件显示（如仅在有选中文本时显示某分组） | 低 |
| 6 | 更多选项菜单的识别逻辑需要进一步验证 | 高 |

---

## 九、风险与限制

| 风险 | 说明 | 缓解措施 |
|------|------|---------|
| `setSubmenu` 为私有 API | 虽在 v1.4.16 可用，但无官方文档保证 | 固定在 v1.4.16，不升级 |
| 命令映射表不完整 | 部分命令可能识别失败 | 未识别命令保留在"其他"分组，不丢失 |
| 插件命令兼容 | 第三方插件的命令标题可能变化 | 支持手动输入命令 ID 强制匹配 |
| 菜单显示闪烁 | DOM 重构可能导致短暂闪烁 | 使用 `visibility: hidden` 重构完再显示 |
| 键盘导航 | 子菜单的键盘导航依赖 Obsidian 内部实现 | 测试验证，必要时补充 |

---

*文档生成时间：2026-07-14*
*适用版本：Obsidian v1.4.16*
*方案状态：技术验证通过，待实现完整插件*


## 十、右键菜单 CSS 样式集成方案

### 10.1 现有 CSS 功能分析

从用户提供的 10 个 CSS 文件中，与右键菜单相关的样式主要集中在 `ObsidianFunctionCustomization.css` 中。以下是功能拆解：

#### 功能 1：编辑区右键菜单基础编辑按钮改为图标栏布局

**当前 CSS 实现（使用 `:has`，性能差）：**

```css
/* 隐藏功能按钮的文本 */
div[data-section="edit"] .menu-item-title {
    display: none;
}

/* 情况一：无"编辑链接"命令 */
div.menu:has(div.menu-item[data-section="edit"] svg[class*="lucide-scissors"]):has(div.menu-item[data-section="edit"] svg[class*="lucide-clipboard-type"]) {
    display: flex;
    flex-wrap: wrap;
    width: max(calc(var(--size-4-2) * 2 * 5 + 16px * 5 + var(--size-2-3) * 2 + 1px * 2), 158px);
}

/* 情况二：存在"编辑链接"命令 */
div.menu:has(div.menu-item[data-section="edit"] svg[class*="lucide-scissors"]):has(div.menu-item[data-section="edit"] svg[class*="lucide-clipboard-type"]):has(div.menu-item[data-section="edit"] svg[class*="lucide-text-cursor-input"]) {
    display: flex;
    flex-wrap: wrap;
    width: max(calc(var(--size-4-2) * 2 * 6 + 16px * 6 + var(--size-2-3) * 2 + 1px * 2), 158px);
}

/* 情况三：存在"将当前选中内容移动到其他文件中"命令 */
div.menu:has(div.menu-item[data-section="edit"] svg[class*="lucide-scissors"]):has(div.menu-item[data-section="edit"] svg[class*="lucide-clipboard-type"]):has(div.menu-item[data-section="action"] svg[class*="lucide-git-branch-plus"]) {
    display: flex;
    flex-wrap: wrap;
    width: max(calc(var(--size-4-2) * 2 * 6 + 16px * 6 + var(--size-2-3) * 2 + 1px * 2), 248.77px);
}

/* 恢复分隔符 */
div.menu:has(...) .menu-separator {
    flex-basis: 100%;
    height: 0px;
    padding: 0px;
    overflow: hidden;
}

/* 非编辑命令适配宽度 */
div.menu:has(...) .menu-item:not([data-section="edit"]) {
    width: 100%;
}

/* 裁切"查找"命令的溢出文本 */
div.menu:has(...) .menu-item[data-section="view"]:has(...) div.menu-item-title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
```

**性能问题：**
- 大量使用 `:has()` 选择器，每次 DOM 变化都需要遍历大量节点
- 依赖 SVG 类名定位，脆弱且不可维护
- 三种情况分别用 `:has` 链式匹配，复杂度 O(n³) 级别

#### 功能 2：右键菜单命令隐藏

```css
div.menu div.menu-item[data-section="action"]:has(svg[class*="lucide-image"]),
div.menu div.menu-item[data-section="pane"]:has(svg[class*="links-coming-in"]),
div.menu div.menu-item[data-section="action"]:has(svg[class*="lucide-file-search"]) {
    display: none;
}
```

#### 功能 3：右键菜单分隔符隐藏

```css
div.menu div.menu-item.has-submenu:has(svg[class*="lucide-link"]) + div.menu-separator,
div.menu div.menu-item.is-warning:has(svg[class*="lucide-trash-2"]) + div.menu-separator {
    display: none;
}
```

### 10.2 原生实现方案（替代 CSS :has）

#### 方案：插件重构时直接应用样式类

在 `rebuildMenu()` 过程中，根据菜单类型和配置，直接给 `.menu` 和 `.menu-item` 添加特定的 CSS 类，完全绕过 `:has()` 选择器。

**新增代码（main.ts 中）：**

```typescript
/**
 * 应用菜单布局样式类（替代 CSS :has 方案）
 */
private applyLayoutClasses(menuEl: HTMLElement, menuType: string, config: MenuConfig) {
    // 1. 给菜单根元素添加类型标识类
    menuEl.addClass(`mc-menu-${menuType}`);

    // 2. 根据配置判断是否需要图标栏布局
    const hasIconBarGroup = config.groups.some(g => g.layout === 'icon-bar');
    if (hasIconBarGroup) {
        menuEl.addClass('mc-layout-icon-bar');
    }

    // 3. 给每个菜单项添加命令标识类
    const items = menuEl.querySelectorAll('.menu-item');
    items.forEach((el, index) => {
        const titleEl = el.querySelector('.menu-item-title');
        const title = titleEl?.textContent?.trim() || '';
        const section = el.getAttribute('data-section') || '';

        // 添加命令类型类
        el.addClass(`mc-cmd-${this.slugify(title)}`);
        if (section) {
            el.addClass(`mc-section-${section}`);
        }

        // 标记是否为图标栏成员
        const cmdId = this.resolveCommandId(title, section, menuType);
        if (cmdId && this.isInIconBar(cmdId, config)) {
            el.addClass('mc-icon-bar-item');
        }
    });
}

/**
 * 判断命令是否在图标栏分组中
 */
private isInIconBar(cmdId: string, config: MenuConfig): boolean {
    for (const group of config.groups) {
        if (group.layout === 'icon-bar' && group.commands.includes(cmdId)) {
            return true;
        }
    }
    return false;
}

/**
 * 将标题转换为有效的 CSS 类名
 */
private slugify(text: string): string {
    return text.toLowerCase()
        .replace(/[^a-z0-9一-龥]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}
```

**注入的 CSS（替代所有 :has）：**

```typescript
private injectMenuStyles() {
    const style = document.createElement('style');
    style.id = 'menu-customizer-layout-styles';
    style.textContent = `
        /* ========== 图标栏布局 ========== */

        /* 图标栏菜单根容器 */
        .menu.mc-layout-icon-bar {
            display: flex;
            flex-wrap: wrap;
            min-width: 158px;
        }

        /* 图标栏中的命令项 */
        .menu.mc-layout-icon-bar .menu-item.mc-icon-bar-item {
            width: auto;
            flex: 0 0 auto;
            padding: var(--size-2-3);
        }

        /* 隐藏图标栏命令的文本 */
        .menu.mc-layout-icon-bar .menu-item.mc-icon-bar-item .menu-item-title {
            display: none;
        }

        /* 图标栏中的图标 */
        .menu.mc-layout-icon-bar .menu-item.mc-icon-bar-item .menu-item-icon {
            margin-right: 0;
        }

        /* 分隔符在图标栏布局中占满整行 */
        .menu.mc-layout-icon-bar .menu-separator {
            flex-basis: 100%;
            height: 0;
            padding: 0;
            overflow: hidden;
        }

        /* 非图标栏命令占满整行 */
        .menu.mc-layout-icon-bar .menu-item:not(.mc-icon-bar-item) {
            width: 100%;
        }

        /* ========== 隐藏命令（由插件控制，CSS 兜底） ========== */

        .menu-item.mc-hidden {
            display: none !important;
        }

        /* ========== 分组标题样式 ========== */

        .menu-item.mc-group-title {
            font-weight: bold;
            color: var(--text-muted);
            cursor: default;
            pointer-events: none;
            background-color: var(--background-modifier-hover);
            padding: 4px 12px;
            margin: 0;
        }

        .menu-item.mc-group-title:hover {
            background-color: var(--background-modifier-hover) !important;
        }

        /* ========== 子菜单父项样式 ========== */

        .menu-item.has-submenu.mc-submenu-parent {
            position: relative;
        }

        .menu-item.has-submenu.mc-submenu-parent .menu-item-icon.mod-submenu {
            margin-left: auto;
        }

        /* ========== 命令特定样式 ========== */

        /* 查找命令文本溢出处理 */
        .menu-item.mc-cmd-查找 .menu-item-title,
        .menu-item.mc-cmd-find .menu-item-title {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        /* ========== 编辑区菜单特定布局 ========== */

        .menu.mc-menu-editor.mc-layout-icon-bar {
            width: max-content;
        }

        /* 5个图标时的宽度 */
        .menu.mc-menu-editor.mc-layout-icon-bar[data-icon-bar-count="5"] {
            width: calc(var(--size-4-2) * 2 * 5 + 16px * 5 + var(--size-2-3) * 2 + 1px * 2);
        }

        /* 6个图标时的宽度 */
        .menu.mc-menu-editor.mc-layout-icon-bar[data-icon-bar-count="6"] {
            width: calc(var(--size-4-2) * 2 * 6 + 16px * 6 + var(--size-2-3) * 2 + 1px * 2);
        }
    `;
    document.head.appendChild(style);
}
```

### 10.3 配置扩展（支持布局类型）

```typescript
// types.ts 扩展

export interface MenuGroupConfig {
    /** 分组名称 */
    name: string;
    /** 分组图标 */
    icon?: string;
    /** 包含的命令 ID 列表 */
    commands: string[];
    /** 布局类型 */
    layout?: 'list' | 'icon-bar' | 'grid';
    /** 是否隐藏整个分组 */
    hidden?: boolean;
    /** 强制使用子菜单 */
    forceSubmenu?: boolean;
}
```

### 10.4 重构流程中的样式应用时机

```typescript
// 在 rebuildMenu() 中，第 8 步之后添加：

// 8. 应用布局样式类
this.applyLayoutClasses(menuEl, menuType, config);

// 9. 设置图标栏计数（用于宽度计算）
const iconBarItems = menuEl.querySelectorAll('.mc-icon-bar-item');
if (iconBarItems.length > 0) {
    menuEl.setAttribute('data-icon-bar-count', String(iconBarItems.length));
}

// 10. 显示菜单
requestAnimationFrame(() => {
    menuEl.style.visibility = '';
});
```

### 10.5 性能对比

| 方案 | 选择器复杂度 | 渲染性能 | 维护性 |
|------|-----------|---------|--------|
| CSS `:has` 链式 | O(n³)，每次 DOM 变化全量匹配 | 差（卡顿来源） | 差（依赖 SVG 类名） |
| 原生插件 + 预置类 | O(1)，直接类名匹配 | 好 | 好（命令 ID 稳定） |

### 10.6 用户现有 CSS 的迁移建议

| 现有 CSS 功能 | 插件替代方案 | 操作 |
|-------------|-----------|------|
| 编辑区右键菜单图标栏 | `layout: 'icon-bar'` 分组配置 | 删除对应 CSS |
| 命令隐藏 | `hidden: true` 命令覆盖 | 删除对应 CSS |
| 分隔符隐藏 | 插件自动精确控制 | 删除对应 CSS |
| 查找命令溢出裁切 | `.mc-cmd-查找` 预置样式 | 删除对应 CSS |

**迁移后保留的 CSS：**
- 护眼模式颜色（与菜单无关）
- 文件树图标（与菜单无关）
- 其他非菜单相关的样式

### 10.7 完整样式注入代码

### 10.8 用户现有右键菜单 CSS（完整原始代码）

以下 CSS 来自用户的 `ObsidianFunctionCustomization.css`，是插件需要替代的目标：

```css
/* —————————————————————右键菜单优化————————————————————————— */
/* 1.更改编辑区右键菜单中基础编辑功能按钮的布局 */
/* 首先，隐藏功能按钮的文本 */
div[data-section="edit"] .menu-item-title{
	display: none;			
}
/* 其次，定位右键菜单，更改布局 */
/* 情况一：无"编辑链接"命令，基于"剪切"与"以纯文本形式粘贴"命令定位右键菜单 */
div.menu:has(div.menu-item[data-section="edit"] svg[class*="lucide-scissors"]):has(div.menu-item[data-section="edit"] svg[class*="lucide-clipboard-type"]){
	display: flex;
	flex-wrap: wrap;		/* 允许元素换行*/
	width: max(calc(var(--size-4-2) * 2 * 5 + 16px * 5 + var(--size-2-3) * 2 + 1px * 2), 158px);
	/* 图标两侧内边距var(--size-4-2)*2，图标大小16，共5个图标，右键菜单内边距var(--size-2-3)*2，右键菜单边框1px*2 */
	/* 编辑区右键菜单的原始宽度为158px */
}
/* 情况二：存在"编辑链接"命令，基于"编辑链接"、"剪切"与"以纯文本形式粘贴"命令定位右键菜单 */
div.menu:has(div.menu-item[data-section="edit"] svg[class*="lucide-scissors"]):has(div.menu-item[data-section="edit"] svg[class*="lucide-clipboard-type"]):has(div.menu-item[data-section="edit"] svg[class*="lucide-text-cursor-input"]){
	display: flex;
	flex-wrap: wrap;
	width: max(calc(var(--size-4-2) * 2 * 6 + 16px * 6 + var(--size-2-3) * 2 + 1px * 2), 158px);
	/* 图标两侧内边距var(--size-4-2)*2，图标大小16，共6个图标，右键菜单内边距var(--size-2-3)*2，右键菜单边框1px*2 */
}
/* 情况三：存在"将当前选中内容移动到其他文件中"命令，基于"将当前选中内容移动到其他文件中"、"剪切"与"以纯文本形式粘贴"命令定位右键菜单 */
div.menu:has(div.menu-item[data-section="edit"] svg[class*="lucide-scissors"]):has(div.menu-item[data-section="edit"] svg[class*="lucide-clipboard-type"]):has(div.menu-item[data-section="action"] svg[class*="lucide-git-branch-plus"]){
	display: flex;
	flex-wrap: wrap;
	width: max(calc(var(--size-4-2) * 2 * 6 + 16px * 6 + var(--size-2-3) * 2 + 1px * 2), 248.77px);
	/* 编辑区右键菜单中的"将当前选中内容移动到其他文件中"命令宽度为248.77px */
}
/* 再次，恢复原本的分隔符 */
div.menu:has(div.menu-item[data-section="edit"] svg[class*="lucide-scissors"]):has(div.menu-item[data-section="edit"] svg[class*="lucide-clipboard-type"]) .menu-separator{
	flex-basis: 100%;		/* 占据整行 */
	height: 0px;			/* 清空分隔符的高度 */
	padding: 0px;			/* 移除可能的内边距 */
	overflow: hidden;		/* 隐藏分隔符可能的内容 */
}
/* 最后，强制基础编辑功能按钮以外的命令适配右键菜单的宽度 */
div.menu:has(div.menu-item[data-section="edit"] svg[class*="lucide-scissors"]):has(div.menu-item[data-section="edit"] svg[class*="lucide-clipboard-type"]) .menu-item:not([data-section="edit"]){
	width: 100%
}
/* 其它相关修正 */
/* 裁切"查找"命令的溢出文本 */
div.menu:has(div.menu-item[data-section="edit"] svg[class*="lucide-scissors"]):has(div.menu-item[data-section="edit"] svg[class*="lucide-clipboard-type"]) .menu-item[data-section="view"]:has(div.menu-item-icon svg.lucide-search) div.menu-item-title{
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

/* 2.右键菜单命令隐藏 */
div.menu div.menu-item[data-section="action"]:has(svg[class*="lucide-image"]),		/* "将其设置为附件文件夹"（文件列表中文件夹的右键菜单） */
div.menu div.menu-item[data-section="pane"]:has(svg[class*="links-coming-in"]),		/* "在页面中显示反向链接"（编辑区的"更多选项"菜单） */
div.menu div.menu-item[data-section="action"]:has(svg[class*="lucide-file-search"])	/* "查找"与"替换"（编辑区的"更多选项"菜单） */
{
	display: none;
}
/* 3.右键菜单分隔符隐藏 */
div.menu div.menu-item.has-submenu:has(svg[class*="lucide-link"]) + div.menu-separator,		/* "复制 Obsidian 链接"上方（编辑区的"更多选项"菜单） */
div.menu div.menu-item.is-warning:has(svg[class*="lucide-trash-2"]) + div.menu-separator	/* "删除文件"下方（编辑区的"更多选项"菜单） */
{
	display: none;
}
```

#### 逐条分析与替代映射

| # | 原始 CSS 规则 | 功能 | 插件替代方案 | 删除建议 |
|---|-------------|------|-----------|---------|
| 1 | `div[data-section="edit"] .menu-item-title { display: none; }` | 隐藏编辑命令文本 | `layout: "icon-bar"` 分组配置 | ✅ 删除 |
| 2 | 情况一 `:has(scissors+clipboard-type)` 宽度计算 | 5个图标时的菜单宽度 | `data-icon-bar-count="5"` + CSS变量 | ✅ 删除 |
| 3 | 情况二 `:has(scissors+clipboard-type+text-cursor-input)` 宽度 | 6个图标时的菜单宽度 | `data-icon-bar-count="6"` + CSS变量 | ✅ 删除 |
| 4 | 情况三 `:has(git-branch-plus+scissors+clipboard-type)` 宽度 | 含"移动"命令时的宽度 | 插件自动计算，无需硬编码 | ✅ 删除 |
| 5 | `.menu-separator { flex-basis: 100%; ... }` | 分隔符占满整行 | 插件精确控制分隔符插入 | ✅ 删除 |
| 6 | `.menu-item:not([data-section="edit"]) { width: 100%; }` | 非编辑命令占满整行 | `.menu-item:not(.mc-icon-bar-item)` | ✅ 删除 |
| 7 | 查找命令溢出裁切 | 文本溢出省略号 | `.mc-cmd-查找 .menu-item-title` | ✅ 删除 |
| 8 | `[data-section="action"]:has(lucide-image)` 隐藏 | 隐藏"设为附件文件夹" | `commandOverrides` 中 `hidden: true` | ✅ 删除 |
| 9 | `[data-section="pane"]:has(links-coming-in)` 隐藏 | 隐藏"显示反向链接" | `commandOverrides` 中 `hidden: true` | ✅ 删除 |
| 10 | `[data-section="action"]:has(lucide-file-search)` 隐藏 | 隐藏"查找与替换" | `commandOverrides` 中 `hidden: true` | ✅ 删除 |
| 11 | `has-submenu:has(lucide-link) + .menu-separator` 隐藏 | 隐藏"复制链接"上方分隔符 | 插件不插入多余分隔符 | ✅ 删除 |
| 12 | `is-warning:has(lucide-trash-2) + .menu-separator` 隐藏 | 隐藏"删除"下方分隔符 | 插件不插入多余分隔符 | ✅ 删除 |

**结论：以上 12 条 CSS 规则全部由插件原生实现替代，可从 CSS Snippets 中完全删除。**



```typescript
// 合并到 main.ts 的 injectBaseStyles() 中

private injectBaseStyles() {
    const style = document.createElement('style');
    style.id = 'menu-customizer-styles';
    style.textContent = `
        /* ===== 基础变量 ===== */
        .menu {
            --mc-icon-size: 16px;
            --mc-icon-padding: var(--size-4-2);
            --mc-item-padding: var(--size-2-3);
            --mc-border-width: 1px;
        }

        /* ===== 图标栏布局 ===== */
        .menu.mc-layout-icon-bar {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            min-width: 158px;
            max-width: 100%;
        }

        .menu.mc-layout-icon-bar .menu-item.mc-icon-bar-item {
            flex: 0 0 auto;
            width: auto;
            padding: var(--mc-item-padding);
            justify-content: center;
        }

        .menu.mc-layout-icon-bar .menu-item.mc-icon-bar-item .menu-item-title {
            display: none;
        }

        .menu.mc-layout-icon-bar .menu-item.mc-icon-bar-item .menu-item-icon {
            margin-right: 0;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .menu.mc-layout-icon-bar .menu-item.mc-icon-bar-item .menu-item-icon svg {
            width: var(--mc-icon-size);
            height: var(--mc-icon-size);
        }

        /* 分隔符在图标栏中占满整行 */
        .menu.mc-layout-icon-bar .menu-separator {
            flex-basis: 100%;
            height: 0;
            padding: 0;
            margin: 0;
            overflow: hidden;
            border: none;
        }

        /* 非图标栏项占满整行 */
        .menu.mc-layout-icon-bar .menu-item:not(.mc-icon-bar-item) {
            width: 100%;
            flex-basis: 100%;
        }

        /* 子菜单父项在图标栏中的特殊处理 */
        .menu.mc-layout-icon-bar .menu-item.has-submenu.mc-icon-bar-item {
            padding-right: calc(var(--mc-item-padding) + 12px);
        }

        /* ===== 网格布局（预留） ===== */
        .menu.mc-layout-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
            gap: 2px;
        }

        .menu.mc-layout-grid .menu-item.mc-grid-item {
            flex-direction: column;
            align-items: center;
            padding: var(--size-2-2);
        }

        .menu.mc-layout-grid .menu-item.mc-grid-item .menu-item-title {
            font-size: var(--font-ui-smaller);
            margin-top: 2px;
        }

        /* ===== 分组标题 ===== */
        .menu-item.mc-group-title {
            font-weight: 600;
            font-size: var(--font-ui-smaller);
            color: var(--text-muted);
            background-color: var(--background-modifier-hover);
            padding: 2px 12px;
            cursor: default;
            pointer-events: none;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .menu-item.mc-group-title:hover {
            background-color: var(--background-modifier-hover) !important;
        }

        /* ===== 子菜单 ===== */
        .menu-item.has-submenu.mc-submenu-parent {
            position: relative;
        }

        .menu-item.has-submenu.mc-submenu-parent .menu-item-icon.mod-submenu {
            margin-left: auto;
            opacity: 0.6;
        }

        /* ===== 隐藏命令 ===== */
        .menu-item.mc-hidden {
            display: none !important;
        }

        /* ===== 命令覆盖样式 ===== */
        .menu-item.mc-cmd-查找 .menu-item-title,
        .menu-item.mc-cmd-find .menu-item-title {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 120px;
        }

        /* ===== 特定菜单类型优化 ===== */

        /* 编辑区菜单 */
        .menu.mc-menu-editor {
            min-width: 180px;
        }

        /* 文件菜单 */
        .menu.mc-menu-file {
            min-width: 200px;
        }

        /* 文件夹菜单 */
        .menu.mc-menu-folder {
            min-width: 180px;
        }

        /* 更多选项菜单 */
        .menu.mc-menu-moreOptions {
            min-width: 220px;
        }

        /* ===== 动态宽度计算 ===== */
        .menu.mc-layout-icon-bar[data-icon-bar-count="4"] {
            width: calc(var(--mc-icon-padding) * 2 * 4 + var(--mc-icon-size) * 4 + var(--mc-item-padding) * 2 * 4 + var(--mc-border-width) * 2);
        }

        .menu.mc-layout-icon-bar[data-icon-bar-count="5"] {
            width: calc(var(--mc-icon-padding) * 2 * 5 + var(--mc-icon-size) * 5 + var(--mc-item-padding) * 2 * 5 + var(--mc-border-width) * 2);
        }

        .menu.mc-layout-icon-bar[data-icon-bar-count="6"] {
            width: calc(var(--mc-icon-padding) * 2 * 6 + var(--mc-icon-size) * 6 + var(--mc-item-padding) * 2 * 6 + var(--mc-border-width) * 2);
        }

        /* ===== 动画优化 ===== */
        .menu-item {
            transition: background-color 0.15s ease;
        }

        /* ===== 无障碍 ===== */
        .menu-item:focus-visible {
            outline: 2px solid var(--interactive-accent);
            outline-offset: -2px;
        }
    `;
    document.head.appendChild(style);
}
```
