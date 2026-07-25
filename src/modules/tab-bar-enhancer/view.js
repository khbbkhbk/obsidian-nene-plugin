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

// 定义标签栏增强模块管理弹窗，集中放置滚轮切换标签的相关配置。
class TabBarEnhancerManagementModal extends obsidian.Modal {
  constructor(app, plugin, onSettingsChanged) {
    super(app);
    this.plugin = plugin;
    this.onSettingsChanged = onSettingsChanged; // 保存回调，便于修改设置后刷新主设置页
  }

  // 打开弹窗时渲染标签栏增强模块详情与配置项。
  onOpen() {
    this.modalEl.addClass('mod-sidebar-layout', 'nene-settings-panel-modal');
    this.contentEl.empty();
    this.contentEl.addClass('nene-settings-modal');
    void this.render();
  }

  // 根据当前最新状态渲染标签栏增强模块管理界面。
  async render() {
    const { contentEl } = this;
    const summary = this.plugin.getSettingsSummary();
    const configSummary = await this.plugin.getConfigManagementSummary();

    contentEl.empty();
    renderModalHeader(
      contentEl,
      '标签栏增强模块',
      '该模块支持在标签头或标签栏上滚动鼠标滚轮切换标签：向上滚动切换到左侧标签，向下滚动切换到右侧标签，到达边界后循环。仅面向桌面端。'
    );

    const detailListEl = contentEl.createDiv({ cls: 'nene-settings-detail-list' });
    renderDetailItem(detailListEl, '当前状态', summary.tabBarEnhancerEnabled ? '已启用' : '已关闭');
    renderDetailItem(detailListEl, '空白标签区滚轮切换', summary.tabBarEnhancerTopBarWheel ? '已开启' : '已关闭');
    renderDetailItem(detailListEl, '跳过 CSS 隐藏的标签', summary.tabBarEnhancerSkipCssHiddenTabs ? '已开启' : '已关闭');
    renderDetailItem(detailListEl, '跳过未加载插件的标签', summary.tabBarEnhancerSkipUnloadedPluginTabs ? '已开启' : '已关闭');
    renderDetailItem(detailListEl, '调试模式', summary.tabBarEnhancerDebug ? '已开启' : '已关闭');
    renderDetailItem(detailListEl, '配置文件', configSummary.tabBarEnhancer.path, true);

    new obsidian.Setting(contentEl)
      .setName('空白标签区滚轮切换（实验性）')
      .setDesc('允许在标签栏的空白区域滚动滚轮切换标签。注意：当窗口框架样式为“隐藏”时，开启后该空白区域将无法用于拖拽移动窗口。')
      .addToggle((toggle) => {
        toggle
          .setValue(summary.tabBarEnhancerTopBarWheel)
          .onChange(async (value) => {
            await this.plugin.updateTabBarEnhancerTopBarWheel(value);
            new obsidian.Notice(value ? '已开启空白标签区滚轮切换' : '已关闭空白标签区滚轮切换');
            await this.onSettingsChanged();
            await this.render();
          });
      });

    new obsidian.Setting(contentEl)
      .setName('跳过 CSS 隐藏的标签')
      .setDesc('切换标签时跳过被 CSS 隐藏（display: none）的标签头。')
      .addToggle((toggle) => {
        toggle
          .setValue(summary.tabBarEnhancerSkipCssHiddenTabs)
          .onChange(async (value) => {
            await this.plugin.updateTabBarEnhancerSkipCssHiddenTabs(value);
            new obsidian.Notice(value ? '切换时将跳过 CSS 隐藏的标签' : '切换时不再跳过 CSS 隐藏的标签');
            await this.onSettingsChanged();
            await this.render();
          });
      });

    new obsidian.Setting(contentEl)
      .setName('跳过未加载插件的标签')
      .setDesc('切换标签时跳过所属插件尚未加载的标签。')
      .addToggle((toggle) => {
        toggle
          .setValue(summary.tabBarEnhancerSkipUnloadedPluginTabs)
          .onChange(async (value) => {
            await this.plugin.updateTabBarEnhancerSkipUnloadedPluginTabs(value);
            new obsidian.Notice(value ? '切换时将跳过未加载插件的标签' : '切换时不再跳过未加载插件的标签');
            await this.onSettingsChanged();
            await this.render();
          });
      });

    new obsidian.Setting(contentEl)
      .setName('调试模式')
      .setDesc('在控制台输出调试日志，并短暂高亮滚轮命中的标签元素，仅排查问题时开启。')
      .addToggle((toggle) => {
        toggle
          .setValue(summary.tabBarEnhancerDebug)
          .onChange(async (value) => {
            await this.plugin.updateTabBarEnhancerDebug(value);
            new obsidian.Notice(value ? '已开启标签栏增强调试模式' : '已关闭标签栏增强调试模式');
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
  TabBarEnhancerManagementModal
};
