'use strict';

var constants = require('./constants');

// 定义标签栏增强配置仓库，负责独立配置文件的归一化与持久化。
class TabBarEnhancerStore {
  constructor(plugin) {
    this.plugin = plugin; // 保存插件实例，便于访问独立配置存储
    this.settings = this.normalizeSettings(); // 初始化默认结构，避免首次读取时报空
  }

  // 挂载从独立配置文件读出的设置切片。
  load(settings) {
    this.settings = this.normalizeSettings(settings);
  }

  // 持久化当前标签栏增强配置到独立 JSON 文件。
  async save() {
    this.settings = this.normalizeSettings(this.settings);
    this.plugin.dataStore.setTabBarEnhancerData(this.settings);
    await this.plugin.dataStore.saveTabBarEnhancerData(this.settings);
  }

  // 返回当前完整配置。
  getSettings() {
    return this.settings;
  }

  // 更新“空白标签区滚轮切换”开关。
  async setTopBarWheelTabSwitch(enabled) {
    this.settings.topBarWheelTabSwitch = Boolean(enabled);
    await this.save();
    return this.settings.topBarWheelTabSwitch;
  }

  // 更新“跳过 CSS 隐藏的标签”开关。
  async setSkipCssHiddenTabs(enabled) {
    this.settings.skipCssHiddenTabs = Boolean(enabled);
    await this.save();
    return this.settings.skipCssHiddenTabs;
  }

  // 更新“跳过未加载插件的标签”开关。
  async setSkipUnloadedPluginTabs(enabled) {
    this.settings.skipUnloadedPluginTabs = Boolean(enabled);
    await this.save();
    return this.settings.skipUnloadedPluginTabs;
  }

  // 更新“调试模式”开关。
  async setDebug(enabled) {
    this.settings.debug = Boolean(enabled);
    await this.save();
    return this.settings.debug;
  }

  // 归一化标签栏增强模块配置结构。
  normalizeSettings(settings) {
    const source = settings || constants.DEFAULT_TAB_BAR_ENHANCER_SETTINGS;

    return {
      debug: source.debug === true,
      topBarWheelTabSwitch: source.topBarWheelTabSwitch === true,
      skipCssHiddenTabs: source.skipCssHiddenTabs !== false,
      skipUnloadedPluginTabs: source.skipUnloadedPluginTabs !== false
    };
  }
}

module.exports = {
  TabBarEnhancerStore
};
