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

    containerEl.createEl('h2', { text: 'ねね 设置' });
    containerEl.createEl('p', {
      text: '当前设置页以快捷操作和状态展示为主，默认行为保持与原有插件逻辑一致。'
    });

    new obsidian.Setting(containerEl)
      .setName('文件标记面板')
      .setDesc(`当前共有 ${summary.markCount} 条文件标记、${summary.groupCount} 个分组，可直接打开右侧文件标记面板。`)
      .addButton((button) => {
        button
          .setButtonText('打开面板')
          .setCta()
          .onClick(async () => {
            await this.plugin.ensureFileMarkerViewOpen();
          });
      });

    new obsidian.Setting(containerEl)
      .setName('清理失效标记')
      .setDesc('立即移除已不存在文件对应的标记记录，并同步刷新文件标记面板。')
      .addButton((button) => {
        button
          .setButtonText('立即清理')
          .onClick(async () => {
            const hasChanged = await this.plugin.pruneMissingMarkRecords();
            new obsidian.Notice(hasChanged ? '失效标记已清理' : '当前没有需要清理的失效标记');
            this.display();
          });
      });

    new obsidian.Setting(containerEl)
      .setName('关系图谱 HTML 链接增强')
      .setDesc(`已识别 ${summary.anchorGraphSourceFileCount} 个源文件中的 ${summary.anchorGraphEdgeCount} 条 a.internal-link 正向关系边。`)
      .addButton((button) => {
        button
          .setButtonText('立即刷新')
          .onClick(async () => {
            await this.plugin.refreshAnchorGraphLinks(true);
            this.display();
          });
      });

    containerEl.createEl('h3', { text: '识别规则' });
    const ruleListEl = containerEl.createEl('ul');
    ruleListEl.createEl('li', {
      text: '文件标记、插件列表增强等原有功能默认保持开启，不通过设置页改变其现有行为。'
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
