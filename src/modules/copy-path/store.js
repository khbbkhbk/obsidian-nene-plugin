'use strict';

var constants = require('./constants');

// 定义复制路径配置仓库，同时缓存最近一次文件右键菜单的目标对象。
class CopyPathStore {
  constructor(plugin) {
    this.plugin = plugin; // 保存插件实例，便于读写独立配置文件
    this.settings = this.normalizeSettings(); // 初始化默认配置，避免首次读取时报空
    this.lastMenuTarget = null; // 缓存最近一次右键菜单目标，供 synthetic 菜单命令复用
    this.lastMenuTargetAt = 0; // 记录缓存时间，避免命令面板误用过期目标
  }

  // 挂载从独立配置文件读出的设置切片。
  load(settings) {
    this.settings = this.normalizeSettings(settings);
  }

  // 持久化当前复制路径配置到独立 JSON 文件。
  async save() {
    this.settings = this.normalizeSettings(this.settings);
    this.plugin.dataStore.setCopyPathData(this.settings);
    await this.plugin.dataStore.saveCopyPathData(this.settings);
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
    this.lastMenuTargetAt = Date.now();
  }

  // 返回仍处于有效期内的右键菜单目标，过期后自动清空。
  getRecentMenuTarget() {
    if (!this.lastMenuTarget) {
      return null;
    }

    if (Date.now() - this.lastMenuTargetAt > constants.MENU_TARGET_MAX_AGE) {
      this.clearRecentMenuTarget();
      return null;
    }

    return this.lastMenuTarget;
  }

  // 主动清空最近一次菜单目标，避免后续无关命令误用。
  clearRecentMenuTarget() {
    this.lastMenuTarget = null;
    this.lastMenuTargetAt = 0;
  }

  // 归一化复制路径模块的配置结构。
  normalizeSettings(settings) {
    const source = settings || constants.DEFAULT_COPY_PATH_SETTINGS;

    return {
      addTrailingSlashToFolders: source.addTrailingSlashToFolders !== false
    };
  }
}

module.exports = {
  CopyPathStore
};
