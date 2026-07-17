'use strict';

var constants = require('./constants');

// 定义状态栏增强配置仓库，负责独立配置文件的归一化与持久化。
class StatusBarEnhancerStore {
  constructor(plugin) {
    this.plugin = plugin; // 保存插件实例，便于访问独立配置存储
    this.settings = this.normalizeSettings(); // 初始化默认结构，避免首次读取时报空
  }

  // 挂载从独立配置文件读出的设置切片。
  load(settings) {
    this.settings = this.normalizeSettings(settings);
  }

  // 持久化当前状态栏增强配置到独立 JSON 文件。
  async save() {
    this.settings = this.normalizeSettings(this.settings);
    this.plugin.dataStore.setStatusBarEnhancerData(this.settings);
    await this.plugin.dataStore.saveStatusBarEnhancerData(this.settings);
  }

  // 返回当前完整配置。
  getSettings() {
    return this.settings;
  }

  // 更新“是否显示文件名”开关。
  async setShowFileName(enabled) {
    this.settings.showFileName = Boolean(enabled);
    await this.save();
    return this.settings.showFileName;
  }

  // 更新“是否显示图标”开关。
  async setShowIcons(enabled) {
    this.settings.showIcons = Boolean(enabled);
    await this.save();
    return this.settings.showIcons;
  }

  // 更新“是否复制绝对路径”开关。
  async setCopyAbsolutePath(enabled) {
    this.settings.copyAbsolutePath = Boolean(enabled);
    await this.save();
    return this.settings.copyAbsolutePath;
  }

  // 归一化状态栏增强模块配置结构。
  normalizeSettings(settings) {
    const source = settings || constants.DEFAULT_STATUS_BAR_ENHANCER_SETTINGS;

    return {
      showFileName: source.showFileName === true,
      showIcons: source.showIcons === true,
      copyAbsolutePath: source.copyAbsolutePath !== false
    };
  }
}

module.exports = {
  StatusBarEnhancerStore
};
