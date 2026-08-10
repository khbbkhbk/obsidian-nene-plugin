'use strict';

var constants = require('./constants');

// 主题增强模块配置仓库，管理护眼模式状态的持久化。
class ThemeEnhancerStore {
  constructor(plugin) {
    this.plugin = plugin;
    this.settings = constants.normalizeThemeEnhancerSettings();
  }

  // 从插件数据仓库挂载主题增强的独立配置切片。
  load(settings) {
    this.settings = constants.normalizeThemeEnhancerSettings(settings);
  }

  // 返回当前完整配置。
  getSettings() {
    return this.settings;
  }

  // 持久化当前配置到独立配置文件。
  async save() {
    this.plugin.dataStore.setThemeEnhancerData(this.settings);
    await this.plugin.dataStore.saveThemeEnhancerData(this.settings);
  }

  // 更新护眼模式开关，并立即持久化。
  async setEyeProtection(enabled) {
    this.settings.eyeProtection = Boolean(enabled);
    await this.save();
    return this.settings.eyeProtection;
  }
}

module.exports = {
  ThemeEnhancerStore
};
