'use strict';

var obsidian = require('obsidian');

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

// 渲染信息行，用于展示模块当前状态与配置文件路径。
function renderDetailItem(containerEl, label, value, codeStyle) {
  const itemEl = containerEl.createDiv({ cls: 'nene-settings-detail-item' });
  itemEl.createDiv({ cls: 'nene-settings-detail-label', text: label });
  itemEl.createEl(codeStyle ? 'code' : 'div', {
    cls: 'nene-settings-detail-value',
    text: value
  });
}

// 定义命令&URI增强模块管理弹窗，集中放置配置项与命令说明。
class CommandUriEnhancerManagementModal extends obsidian.Modal {
  constructor(app, plugin, onSettingsChanged) {
    super(app);
    this.plugin = plugin;
    this.onSettingsChanged = onSettingsChanged; // 保存回调，便于修改设置后刷新主设置页
  }

  // 打开弹窗时渲染命令&URI增强模块详情与配置项。
  onOpen() {
    this.modalEl.addClass('mod-sidebar-layout', 'nene-settings-panel-modal');
    this.contentEl.empty();
    this.contentEl.addClass('nene-settings-modal');
    void this.render();
  }

  // 根据当前最新状态渲染命令&URI增强模块管理界面。
  async render() {
    const { contentEl } = this;
    const summary = this.plugin.getSettingsSummary();
    const configSummary = await this.plugin.getConfigManagementSummary();

    contentEl.empty();
    renderModalHeader(
      contentEl,
      '命令&URI增强模块',
      '该模块只注册命令，不会直接向文件或文件夹右键菜单注入入口。若需要出现在右键菜单中，请在“右键菜单自定义”模块中手动添加这些命令。'
    );

    const detailListEl = contentEl.createDiv({ cls: 'nene-settings-detail-list' });
    renderDetailItem(detailListEl, '当前状态', summary.commandUriEnhancerEnabled ? '已启用' : '已关闭');
    renderDetailItem(
      detailListEl,
      '文件夹末尾补 /',
      summary.commandUriEnhancerTrailingSlashEnabled ? '已开启' : '已关闭'
    );
    renderDetailItem(detailListEl, '配置文件', configSummary.commandUriEnhancer.path, true);

    new obsidian.Setting(contentEl)
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

    const hintEl = contentEl.createDiv({ cls: 'nene-settings-hint' });
    hintEl.createDiv({ cls: 'nene-settings-hint-title', text: '已注册命令' });
    const listEl = hintEl.createEl('ul');
    listEl.createEl('li', { text: '复制当前目标的库内路径' });
    listEl.createEl('li', { text: '复制当前目标的完整路径' });
    listEl.createEl('li', { text: '复制当前目标的URI链接' });
  }

  // 关闭弹窗时清理内容，避免重复挂载旧节点。
  onClose() {
    this.contentEl.empty();
  }
}

module.exports = {
  CommandUriEnhancerManagementModal
};
