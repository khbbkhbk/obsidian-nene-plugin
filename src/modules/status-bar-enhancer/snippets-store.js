'use strict';

var snippetsConstants = require('./snippets-constants');

// 定义 Snippets 管理配置仓库，数据嵌套在状态栏增强的独立配置中。
class SnippetsStore {
  constructor(plugin) {
    this.plugin = plugin;
    this.settings = snippetsConstants.normalizeSnippetsSettings();
  }

  // 从状态栏增强仓库中提取 snippets 配置切片。
  load() {
    const parentSettings = this.plugin.statusBarEnhancerStore.getSettings();
    this.settings = snippetsConstants.normalizeSnippetsSettings(parentSettings.snippets);
  }

  // 返回当前完整配置。
  getSettings() {
    return this.settings;
  }

  // 持久化 snippets 配置到状态栏增强的独立配置文件。
  async save() {
    const parentStore = this.plugin.statusBarEnhancerStore;
    const currentSettings = parentStore.getSettings();
    currentSettings.snippets = snippetsConstants.normalizeSnippetsSettings(this.settings);
    parentStore.settings = parentStore.normalizeSettings(currentSettings);
    await parentStore.save();
  }

  // 更新「毛玻璃效果」开关。
  async setAestheticStyle(enabled) {
    this.settings.aestheticStyle = Boolean(enabled);
    await this.save();
    return this.settings.aestheticStyle;
  }

  // 更新「自动打开新建片段」开关。
  async setOpenSnippetFile(enabled) {
    this.settings.openSnippetFile = Boolean(enabled);
    await this.save();
    return this.settings.openSnippetFile;
  }

  // 更新「新建片段默认启用」开关。
  async setSnippetEnabledStatus(enabled) {
    this.settings.snippetEnabledStatus = Boolean(enabled);
    await this.save();
    return this.settings.snippetEnabledStatus;
  }

  // 更新 CSS 模板文本。
  async setStylingTemplate(text) {
    this.settings.stylingTemplate = typeof text === 'string' ? text : '';
    await this.save();
    return this.settings.stylingTemplate;
  }
}

module.exports = {
  SnippetsStore
};
