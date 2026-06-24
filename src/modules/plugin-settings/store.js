'use strict';

var constants = require('./constants');

// 定义插件级功能设置仓库，只负责跨模块功能开关，不再处理 file-marker 数据。
class PluginSettingsStore {
  constructor(plugin) {
    this.plugin = plugin; // 保存插件实例，便于访问插件级数据仓库
    this.settings = this.normalizeSettings(); // 初始化默认配置，避免首次读取时报空
  }

  // 挂载插件级数据中的功能开关切片，供后续业务逻辑复用。
  load(settings) {
    this.settings = this.normalizeSettings(settings);
  }

  // 将最新功能开关同步到插件级数据仓库并持久化到本地。
  async save() {
    this.settings = this.normalizeSettings(this.settings);
    this.plugin.dataStore.setFeatures(this.settings);
    await this.plugin.dataStore.save();
  }

  // 返回关系图谱增强是否启用，供主入口和设置页统一读取。
  isAnchorGraphEnabled() {
    return Boolean(this.settings.anchorGraph.enabled);
  }

  // 切换关系图谱增强的启用状态，并立即持久化到本地。
  async setAnchorGraphEnabled(enabled) {
    this.settings.anchorGraph.enabled = Boolean(enabled);
    await this.save();
    return this.isAnchorGraphEnabled();
  }

  // 返回功能设置对象，供主入口与设置页读取当前切片。
  getSettings() {
    return this.settings;
  }

  // 归一化插件级功能设置结构。
  normalizeSettings(data) {
    const source = data || constants.DEFAULT_FEATURE_SETTINGS;
    return {
      anchorGraph: {
        enabled: source.anchorGraph?.enabled !== false
      }
    };
  }
}

module.exports = {
  PluginSettingsStore
};
