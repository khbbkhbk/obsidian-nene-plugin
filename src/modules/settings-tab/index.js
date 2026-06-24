'use strict';

var obsidian = require('obsidian');

// 定义插件设置页，在不改变现有默认逻辑的前提下提供查看与快捷操作入口。
class ObsidianNenePluginSettingTab extends obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin; // 保存插件实例，便于读取统计信息和触发快捷操作
  }

  // 渲染设置页内容，展示当前功能说明、数据统计与维护操作。
  display() {
    const { containerEl } = this;
    const summary = this.plugin.getSettingsSummary();
    containerEl.empty();
    const anchorGraphStatusLabelMap = {
      active: '已启用',
      degraded: '已降级',
      disabled: '已关闭',
      idle: '待初始化'
    };

    containerEl.createEl('h2', { text: 'ねね 设置' });
    containerEl.createEl('p', {
      text: '当前设置页按子功能模块分区展示，便于分别查看状态、执行维护操作与一键启动。'
    });
    this.renderFileMarkerSection(containerEl, summary);
    containerEl.createEl('hr');
    this.renderAnchorGraphSection(containerEl, summary, anchorGraphStatusLabelMap);
    containerEl.createEl('hr');
    this.renderRuleSection(containerEl);
  }

  // 渲染文件标记模块分区，集中展示开关、运行状态与维护操作。
  renderFileMarkerSection(containerEl, summary) {
    containerEl.createEl('h3', { text: '文件标记面板' });
    containerEl.createEl('p', {
      text: summary.fileMarkerEnabled
        ? (
          summary.fileMarkerViewOpen
            ? `模块状态：已启用，面板已打开，当前共有 ${summary.markCount} 条文件标记、${summary.groupCount} 个分组。`
            : `模块状态：已启用，面板未打开，当前已保存 ${summary.markCount} 条文件标记、${summary.groupCount} 个分组。`
        )
        : `模块状态：未启用，当前已保存 ${summary.markCount} 条文件标记、${summary.groupCount} 个分组。`
    });

    new obsidian.Setting(containerEl)
      .setName('模块开关')
      .setDesc('首次安装默认关闭。启用后会写入配置，后续再次启用插件时将保持当前状态。')
      .addToggle((toggle) => {
        toggle
          .setValue(summary.fileMarkerEnabled)
          .onChange(async (value) => {
            await this.plugin.updateFileMarkerEnabled(value);
            new obsidian.Notice(value ? '已启用文件标记面板' : '已关闭文件标记面板');
            this.display();
          });
      });

    new obsidian.Setting(containerEl)
      .setName('运行状态')
      .setDesc(summary.fileMarkerEnabled
        ? (summary.fileMarkerViewOpen ? '文件标记面板当前已打开。' : '文件标记面板当前未打开。')
        : '文件标记面板当前已关闭，请先启用模块。')
      .addButton((button) => {
        button
          .setButtonText('打开面板')
          .setDisabled(!summary.fileMarkerEnabled)
          .onClick(async () => {
            await this.plugin.startFileMarkerFeature();
            this.display();
          });
      });

    new obsidian.Setting(containerEl)
      .setName('维护操作')
      .setDesc('立即移除已不存在文件对应的标记记录，并同步刷新文件标记面板。')
      .addButton((button) => {
        button
          .setButtonText('立即清理')
          .setDisabled(!summary.fileMarkerEnabled)
          .onClick(async () => {
            const hasChanged = await this.plugin.pruneMissingMarkRecords();
            new obsidian.Notice(hasChanged ? '失效标记已清理' : '当前没有需要清理的失效标记');
            this.display();
          });
      });
  }

  // 渲染关系图谱模块分区，集中展示开关、运行状态与刷新操作。
  renderAnchorGraphSection(containerEl, summary, anchorGraphStatusLabelMap) {
    containerEl.createEl('h3', { text: '关系图谱 HTML 链接增强' });
    containerEl.createEl('p', {
      text: `模块状态：${anchorGraphStatusLabelMap[summary.anchorGraphRuntimeState] || '未知'}，已识别 ${summary.anchorGraphSourceFileCount} 个源文件中的 ${summary.anchorGraphEdgeCount} 条 a.internal-link 正向关系边。`
    });

    new obsidian.Setting(containerEl)
      .setName('模块开关')
      .setDesc('首次安装默认关闭。启用后会写入配置，后续再次启用插件时将保持当前状态。')
      .addToggle((toggle) => {
        toggle
          .setValue(summary.anchorGraphEnabled)
          .onChange(async (value) => {
            await this.plugin.updateAnchorGraphEnabled(value);
            new obsidian.Notice(value ? '已启用关系图谱 HTML 链接增强' : '已关闭关系图谱 HTML 链接增强');
            this.display();
          });
      });

    new obsidian.Setting(containerEl)
      .setName('运行状态')
      .setDesc(summary.anchorGraphRuntimeMessage)
      .addButton((button) => {
        button
          .setButtonText('立即刷新')
          .setDisabled(!summary.anchorGraphEnabled)
          .onClick(async () => {
            await this.plugin.refreshAnchorGraphLinks(true);
            this.display();
          });
      });
  }

  // 渲染识别规则说明，帮助用户理解图谱增强的生效范围。
  renderRuleSection(containerEl) {
    containerEl.createEl('h3', { text: '识别规则' });
    const ruleListEl = containerEl.createEl('ul');
    ruleListEl.createEl('li', {
      text: '文件标记面板和关系图谱 HTML 链接增强均默认关闭，需要先在设置页手动启用后才能执行相关操作。'
    });
    ruleListEl.createEl('li', {
      text: '关系图谱会额外识别 class 包含 internal-link，且带有 data-href 或 href 的 HTML a 标签。'
    });
    ruleListEl.createEl('li', {
      text: '图谱增强只向运行时索引注入合成关系边，不会改写任何笔记内容。'
    });
  }
}

module.exports = {
  ObsidianNenePluginSettingTab
};
