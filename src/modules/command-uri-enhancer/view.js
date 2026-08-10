'use strict';

var obsidian = require('obsidian');

// 弹窗渲染辅助函数：供本文件内各弹窗与 open-with-command-view.js 复用。
// open-with-command-view.js 会顶层引用本文件，而本文件仅在点击条目时才延迟
// require open-with-command-view.js，因此两者之间不会形成模块加载循环。

// 渲染弹窗公共头部，统一标题与说明样式。
function renderModalHeader(containerEl, title, description) {
  const headerEl = containerEl.createDiv({ cls: 'nene-settings-modal-header' });
  headerEl.createDiv({ cls: 'nene-settings-modal-title', text: title });

  if (description) {
    headerEl.createEl('p', {
      cls: 'nene-settings-modal-description',
      text: description
    });
  }
}

// 渲染分区标题，使用小号全大写风格与顶部分隔线。
function renderSectionTitle(containerEl, title) {
  containerEl.createDiv({ cls: 'nene-modal-section-title', text: title });
}

// 渲染 row flex 条目：左侧为文本信息，右侧为按钮。
// 默认渲染图标按钮；传入 buttonText 时渲染文本按钮（其余条目不受影响）。
function renderEntryRow(containerEl, key, title, description, iconName, onClick, buttonText) {
  const rowEl = containerEl.createDiv({
    cls: 'nene-entry-row',
    attr: { 'data-entry-key': key }
  });

  const infoEl = rowEl.createDiv({ cls: 'nene-entry-info' });
  infoEl.createDiv({ cls: 'nene-entry-title', text: title });
  if (description) {
    infoEl.createDiv({ cls: 'nene-entry-desc', text: description });
  }

  const actionEl = rowEl.createDiv({ cls: 'nene-entry-action' });
  const buttonEl = actionEl.createEl('button', {
    cls: buttonText ? 'nene-entry-text-button' : 'nene-icon-button',
    attr: { 'data-action-key': key, 'aria-label': title }
  });
  if (buttonText) {
    buttonEl.setText(buttonText);
  } else {
    obsidian.setIcon(buttonEl, iconName);
  }
  buttonEl.addEventListener('click', onClick);

  return rowEl;
}

// 渲染空状态提示，用于列表无内容时兜底。
function renderEmptyState(containerEl, text) {
  const emptyEl = containerEl.createDiv({ cls: 'nene-empty-state' });
  const iconEl = emptyEl.createDiv({ cls: 'nene-empty-state-icon' });
  obsidian.setIcon(iconEl, 'info');
  emptyEl.createDiv({ cls: 'nene-empty-state-text', text });
}

// 本模块注册的命令 ID 白名单，用于“已注册命令”弹窗中精准筛选。
const COMMAND_ID_WHITELIST = [
  'copy-vault-path',
  'copy-full-path',
  'copy-uri-link'
];

// Obsidian 官方内置 URI 语法清单：语法模板 + 中文注释。
const OBSIDIAN_URI_SYNTAXES = [
  { key: 'open', syntax: 'obsidian://open?vault=<vault>&file=<file_path>', comment: '打开指定仓库的指定笔记' },
  { key: 'open-method', syntax: 'obsidian://open?vault=<vault>&file=<file_path>&method=<tab|window|split>', comment: '控制笔记的打开方式：tab=新标签页、window=新窗口、split=新面板' },
  { key: 'open-block', syntax: 'obsidian://open?vault=<vault>&file=<file_path>&block=<block_id>', comment: '打开笔记并定位到指定文本块' },
  { key: 'open-header', syntax: 'obsidian://open?vault=<vault>&file=<file_path>&header=<标题>', comment: '打开笔记并定位到指定标题' },
  { key: 'search', syntax: 'obsidian://search?vault=<vault>&query=<query>', comment: '在指定仓库内搜索指定关键词' },
  { key: 'show-plugin', syntax: 'obsidian://show-plugin?id=<plugin_id>', comment: '在社区插件市场搜索指定的第三方插件' },
  // 由命令&URI增强运行时注册的自定义协议：用于快速定位插件设置或快捷键配置页。
  // 参数按插件显示名称匹配，大小写敏感；show=config/show=hotkeys 会按名称自动解析出插件 id。
  { key: 'goto-plugin', syntax: 'obsidian://goto-plugin', comment: '仅打开插件市场' },
  { key: 'goto-plugin-id', syntax: 'obsidian://goto-plugin?name=<manifest.json_name>', comment: '在社区插件市场定位已安装的指定第三方插件' },
  { key: 'goto-plugin-config', syntax: 'obsidian://goto-plugin?name=<manifest.json_name>&show=config', comment: '打开已安装的指定插件的设置页' },
  { key: 'goto-plugin-hotkeys', syntax: 'obsidian://goto-plugin?name=<manifest.json_name>&show=hotkeys', comment: '打开已安装的指定插件的快捷键配置页' },
];

// 优先使用现代剪贴板 API，失败时回退到传统复制命令。
async function copyTextToClipboard(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textareaEl = document.createElement('textarea');
  textareaEl.value = text;
  textareaEl.style.position = 'fixed';
  textareaEl.style.opacity = '0';
  document.body.appendChild(textareaEl);
  textareaEl.focus();
  textareaEl.select();

  const copied = document.execCommand('copy');
  document.body.removeChild(textareaEl);

  if (!copied) {
    throw new Error('Clipboard copy is not supported');
  }
}

// 收集命令注册表中属于本模块白名单的命令。
// 注意：注册表中的命令 ID 通常带插件前缀（如 obsidian-nene-plugin:copy-vault-path），
// 因此使用“等于裸 ID 或以后缀形式结尾”的匹配方式，兼容不同 Obsidian 版本的行为差异。
function collectWhitelistedCommands(app) {
  const registry = typeof app.commands.listCommands === 'function'
    ? app.commands.listCommands()
    : Object.values(app.commands.commands || {});
  return registry.filter((command) =>
    COMMAND_ID_WHITELIST.some((id) => command.id === id || command.id.endsWith(`:${id}`))
  );
}

// 定义已注册命令列表弹窗，展示命令增强分区注册的全部命令。
class CommandListModal extends obsidian.Modal {
  constructor(app) {
    super(app);
  }

  // 打开弹窗时渲染命令列表。
  onOpen() {
    this.modalEl.addClass('nene-popover-modal');
    this.contentEl.empty();
    this.contentEl.addClass('nene-settings-modal');
    renderModalHeader(
      this.contentEl,
      '已注册命令',
      '命令增强分区注册的全部命令，可直接在命令面板或右键菜单自定义中使用。'
    );

    const listEl = this.contentEl.createDiv({ cls: 'nene-command-list', attr: { 'data-command-list': 'true' } });
    const commands = collectWhitelistedCommands(this.app);

    if (commands.length === 0) {
      renderEmptyState(listEl, '未找到已注册的命令');
      return;
    }

    for (const command of commands) {
      const rowEl = listEl.createDiv({
        cls: 'nene-command-row',
        attr: { 'data-command-id': command.id }
      });
      rowEl.createDiv({ cls: 'nene-command-name', text: command.name });
      rowEl.createDiv({ cls: 'nene-command-id', text: command.id });
    }
  }

  // 关闭弹窗时清理内容，避免重复挂载旧节点。
  onClose() {
    this.contentEl.empty();
  }
}

// 定义可用 URI 列表弹窗，以表格形式展示 Obsidian 内置 URI 语法。
class UriListModal extends obsidian.Modal {
  constructor(app) {
    super(app);
  }

  // 打开弹窗时渲染 URI 语法表格。
  onOpen() {
    this.modalEl.addClass('nene-popover-modal');
    this.contentEl.empty();
    this.contentEl.addClass('nene-settings-modal');
    renderModalHeader(
      this.contentEl,
      '可用 URI',
      'Obsidian 支持的内置 URI 语法，点击行尾复制按钮即可复制到剪贴板。'
    );

    const tableEl = this.contentEl.createDiv({ cls: 'nene-uri-table', attr: { 'data-uri-table': 'true' } });
    this.renderTableHeader(tableEl);
    for (const item of OBSIDIAN_URI_SYNTAXES) {
      this.renderUriRow(tableEl, item);
    }
  }

  // 渲染加粗表头，列结构需与数据行保持对齐。
  renderTableHeader(tableEl) {
    const headerEl = tableEl.createDiv({ cls: 'nene-uri-header' });
    headerEl.createDiv({ cls: 'nene-uri-col-syntax', text: 'URI 语法' });
    headerEl.createDiv({ cls: 'nene-uri-col-action', text: '操作' });
  }

  // 渲染单行 URI：左侧语法与注释纵向排列，右侧复制按钮。
  renderUriRow(tableEl, item) {
    const rowEl = tableEl.createDiv({
      cls: 'nene-uri-row',
      attr: { 'data-uri-key': item.key }
    });

    const infoEl = rowEl.createDiv({ cls: 'nene-uri-info' });
    infoEl.createEl('code', { cls: 'nene-uri-syntax', text: item.syntax });
    infoEl.createDiv({ cls: 'nene-uri-comment', text: item.comment });

    const actionEl = rowEl.createDiv({ cls: 'nene-uri-action' });
    const copyButtonEl = actionEl.createEl('button', {
      cls: 'nene-icon-button',
      attr: { 'data-uri-copy': item.key, 'aria-label': '复制 URI 语法' }
    });
    obsidian.setIcon(copyButtonEl, 'copy');
    copyButtonEl.addEventListener('click', async () => {
      try {
        await copyTextToClipboard(item.syntax);
        new obsidian.Notice('已复制 URI 语法');
      } catch (error) {
        console.error('[ねね] 复制 URI 语法失败', error);
        new obsidian.Notice(`复制失败：${error.message || '请检查当前平台是否支持该操作'}`);
      }
    });
  }

  // 关闭弹窗时清理内容，避免重复挂载旧节点。
  onClose() {
    this.contentEl.empty();
  }
}

// 定义命令&URI增强模块管理弹窗，按命令增强与 URI 增强分区纵向排列。
class CommandUriEnhancerManagementModal extends obsidian.Modal {
  constructor(app, plugin, onSettingsChanged) {
    super(app);
    this.plugin = plugin;
    this.onSettingsChanged = onSettingsChanged; // 保存回调，便于修改设置后刷新主设置页
  }

  // 打开弹窗时渲染命令&URI增强模块分区与配置项。
  onOpen() {
    this.modalEl.addClass('mod-sidebar-layout', 'nene-settings-panel-modal');
    this.contentEl.empty();
    this.contentEl.addClass('nene-settings-modal');
    void this.render();
  }

  // 根据当前最新状态渲染模块管理界面。
  async render() {
    const { contentEl } = this;
    const summary = this.plugin.getSettingsSummary();

    contentEl.empty();
    renderModalHeader(
      contentEl,
      '命令&URI增强模块',
      '该模块分为命令增强与 URI 增强两部分：命令增强仅注册命令，不会直接向右键菜单注入入口；URI 增强提供 Obsidian 内置 URI 语法速查。'
    );

    this.renderCommandSection(contentEl, summary);
    this.renderUriSection(contentEl);
  }

  // 渲染命令增强分区：配置项与“已注册命令”条目。
  renderCommandSection(containerEl, summary) {
    const sectionEl = containerEl.createDiv({
      cls: 'nene-modal-section',
      attr: { 'data-section-key': 'command-enhance' }
    });
    renderSectionTitle(sectionEl, '命令增强');

    new obsidian.Setting(sectionEl)
      .setName('文件夹路径末尾补 /')
      .setDesc('开启后，复制文件夹路径时会自动在末尾追加 /，便于与文件路径区分。')
      .addToggle((toggle) => {
        toggle
          .setValue(summary.commandUriEnhancerTrailingSlashEnabled)
          .onChange(async (value) => {
            await this.plugin.updateCommandUriEnhancerTrailingSlashEnabled(value);
            new obsidian.Notice(value ? '已开启文件夹路径末尾补 /' : '已关闭文件夹路径末尾补 /');
            await this.onSettingsChanged();
            await this.render();
          });
      });

    renderEntryRow(
      sectionEl,
      'registered-commands',
      '已注册命令',
      '查看命令增强分区注册的全部命令',
      'search',
      () => {
        new CommandListModal(this.app).open();
      }
    );

    renderEntryRow(
      sectionEl,
      'open-with-command-settings',
      '文件速览命令',
      '创建只打开单个文件的命令，支持变量替换与多种打开方式',
      null,
      () => {
        // 延迟 require 避免与 open-with-command-view.js 形成模块加载循环
        const openWithCommandView = require('./open-with-command-view');
        new openWithCommandView.OpenWithCommandSettingsModal(this.app, this.plugin, async () => {
          await this.onSettingsChanged();
        }).open();
      },
      '打开命令设置'
    );
  }

  // 渲染 URI 增强分区：“可用 URI”条目。
  renderUriSection(containerEl) {
    const sectionEl = containerEl.createDiv({
      cls: 'nene-modal-section',
      attr: { 'data-section-key': 'uri-enhance' }
    });
    renderSectionTitle(sectionEl, 'URI增强');

    renderEntryRow(
      sectionEl,
      'available-uris',
      '可用URI',
      '查看 Obsidian 内置的 URI 语法并复制',
      'search',
      () => {
        new UriListModal(this.app).open();
      }
    );
  }

  // 关闭弹窗时清理内容，避免重复挂载旧节点。
  onClose() {
    this.contentEl.empty();
  }
}

module.exports = {
  CommandUriEnhancerManagementModal,
  renderModalHeader,
  renderSectionTitle,
  renderEntryRow,
  renderEmptyState
};
