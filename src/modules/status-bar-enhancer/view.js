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

// 定义状态栏增强模块管理弹窗，集中放置状态栏显示与复制行为配置。
class StatusBarEnhancerManagementModal extends obsidian.Modal {
  constructor(app, plugin, onSettingsChanged) {
    super(app);
    this.plugin = plugin;
    this.onSettingsChanged = onSettingsChanged; // 保存回调，便于修改设置后刷新主设置页
  }

  // 打开弹窗时渲染状态栏增强模块详情与配置项。
  onOpen() {
    this.modalEl.addClass('mod-sidebar-layout', 'nene-settings-panel-modal');
    this.contentEl.empty();
    this.contentEl.addClass('nene-settings-modal');
    void this.render();
  }

  // 根据当前最新状态渲染状态栏增强模块管理界面。
  async render() {
    const { contentEl } = this;
    const summary = this.plugin.getSettingsSummary();
    const configSummary = await this.plugin.getConfigManagementSummary();

    contentEl.empty();
    renderModalHeader(
      contentEl,
      '状态栏增强模块',
      '该模块会在状态栏显示当前活动文件的路径。点击状态栏路径可直接复制；移动端通常不显示状态栏，因此主要用于桌面端。'
    );

    const detailListEl = contentEl.createDiv({ cls: 'nene-settings-detail-list' });
    renderDetailItem(detailListEl, '当前状态', summary.statusBarEnhancerEnabled ? '已启用' : '已关闭');
    renderDetailItem(detailListEl, '显示文件名', summary.statusBarEnhancerShowFileName ? '已开启' : '已关闭');
    renderDetailItem(detailListEl, '显示图标', summary.statusBarEnhancerShowIcons ? '已开启' : '已关闭');
    renderDetailItem(detailListEl, '点击复制绝对路径', summary.statusBarEnhancerCopyAbsolutePath ? '已开启' : '已关闭');
    renderDetailItem(detailListEl, '配置文件', configSummary.statusBarEnhancer.path, true);

    new obsidian.Setting(contentEl)
      .setName('显示文件名')
      .setDesc('在状态栏路径中显示当前文件名。考虑到状态栏长度，建议关闭')
      .addToggle((toggle) => {
        toggle
          .setValue(summary.statusBarEnhancerShowFileName)
          .onChange(async (value) => {
            await this.plugin.updateStatusBarEnhancerShowFileName(value);
            new obsidian.Notice(value ? '已开启状态栏文件名显示' : '已关闭状态栏文件名显示');
            await this.onSettingsChanged();
            await this.render();
          });
      });

    new obsidian.Setting(contentEl)
      .setName('显示图标')
      .setDesc('在状态栏路径中显示文件夹与文件图标。考虑到状态栏长度，建议关闭')
      .addToggle((toggle) => {
        toggle
          .setValue(summary.statusBarEnhancerShowIcons)
          .onChange(async (value) => {
            await this.plugin.updateStatusBarEnhancerShowIcons(value);
            new obsidian.Notice(value ? '已开启状态栏图标显示' : '已关闭状态栏图标显示');
            await this.onSettingsChanged();
            await this.render();
          });
      });

    new obsidian.Setting(contentEl)
      .setName('复制绝对路径')
      .setDesc('切换点击状态栏时所复制的路径类型为绝对路径，默认启用')
      .addToggle((toggle) => {
        toggle
          .setValue(summary.statusBarEnhancerCopyAbsolutePath)
          .onChange(async (value) => {
            await this.plugin.updateStatusBarEnhancerCopyAbsolutePath(value);
            new obsidian.Notice(value ? '状态栏点击复制已改为绝对路径' : '状态栏点击复制已改为库内相对路径');
            await this.onSettingsChanged();
            await this.render();
          });
      });
  }

  // 关闭弹窗时清理内容，避免重复挂载旧节点。
  onClose() {
    this.contentEl.empty();
  }
}

module.exports = {
  StatusBarEnhancerManagementModal
};
