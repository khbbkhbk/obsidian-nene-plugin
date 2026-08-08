'use strict';

var constants = require('./constants');

// 定义命令&URI增强配置仓库，同时缓存最近一次文件右键菜单的目标对象。
class CommandUriEnhancerStore {
  constructor(plugin) {
    this.plugin = plugin; // 保存插件实例，便于读写独立配置文件
    this.settings = this.normalizeSettings(); // 初始化默认配置，避免首次读取时报空
    this.lastMenuTarget = null; // 缓存最近一次右键菜单目标，菜单关闭时由主入口清空
  }

  // 挂载从独立配置文件读出的设置切片。
  load(settings) {
    this.settings = this.normalizeSettings(settings);
  }

  // 持久化当前命令&URI增强配置到独立 JSON 文件。
  async save() {
    this.settings = this.normalizeSettings(this.settings);
    this.plugin.dataStore.setCommandUriEnhancerData(this.settings);
    await this.plugin.dataStore.saveCommandUriEnhancerData(this.settings);
  }

  // 返回当前完整配置。
  getSettings() {
    return this.settings;
  }

  // 更新“文件夹路径末尾补 /”开关，并立即持久化。
  async setAddTrailingSlashToFolders(enabled) {
    this.settings.addTrailingSlashToFolders = Boolean(enabled);
    await this.save();
    return this.settings.addTrailingSlashToFolders;
  }

  // 记录最近一次文件或文件夹右键菜单的目标对象。
  rememberMenuTarget(file) {
    this.lastMenuTarget = file || null;
  }

  // 返回最近一次右键菜单目标；生命周期由主入口在菜单关闭时统一清空。
  getRecentMenuTarget() {
    return this.lastMenuTarget;
  }

  // 主动清空最近一次菜单目标，避免后续无关命令误用。
  clearRecentMenuTarget() {
    this.lastMenuTarget = null;
  }

  // 归一化命令&URI增强模块的配置结构。
  normalizeSettings(settings) {
    const source = settings || constants.DEFAULT_COMMAND_URI_ENHANCER_SETTINGS;

    return {
      addTrailingSlashToFolders: source.addTrailingSlashToFolders !== false
    };
  }
}

module.exports = {
  CommandUriEnhancerStore
};
