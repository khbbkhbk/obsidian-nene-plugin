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

  // 更新“是否显示最后修改时间”开关。
  async setLastModifiedEnabled(enabled) {
    this.settings.lastModifiedEnabled = Boolean(enabled);
    await this.save();
    return this.settings.lastModifiedEnabled;
  }

  // 更新最后修改时间的前缀文本。
  async setLastModifiedPrepend(text) {
    this.settings.lastModifiedPrepend = typeof text === 'string' ? text : '';
    await this.save();
    return this.settings.lastModifiedPrepend;
  }

  // 更新最后修改时间的显示格式，空值时回退为默认格式。
  async setLastModifiedTimestampFormat(format) {
    const trimmedFormat = typeof format === 'string' ? format : '';
    this.settings.lastModifiedTimestampFormat = trimmedFormat
      ? trimmedFormat
      : constants.DEFAULT_STATUS_BAR_ENHANCER_SETTINGS.lastModifiedTimestampFormat;
    await this.save();
    return this.settings.lastModifiedTimestampFormat;
  }

  // 更新“是否显示创建时间”开关。
  async setCreatedEnabled(enabled) {
    this.settings.createdEnabled = Boolean(enabled);
    await this.save();
    return this.settings.createdEnabled;
  }

  // 更新创建时间的前缀文本。
  async setCreatedPrepend(text) {
    this.settings.createdPrepend = typeof text === 'string' ? text : '';
    await this.save();
    return this.settings.createdPrepend;
  }

  // 更新创建时间的显示格式，空值时回退为默认格式。
  async setCreatedTimestampFormat(format) {
    const trimmedFormat = typeof format === 'string' ? format : '';
    this.settings.createdTimestampFormat = trimmedFormat
      ? trimmedFormat
      : constants.DEFAULT_STATUS_BAR_ENHANCER_SETTINGS.createdTimestampFormat;
    await this.save();
    return this.settings.createdTimestampFormat;
  }

  // 更新“点击循环显示”开关。
  async setCycleOnClickEnabled(enabled) {
    this.settings.cycleOnClickEnabled = Boolean(enabled);
    await this.save();
    return this.settings.cycleOnClickEnabled;
  }

  // 一次性更新两个时间戳的显示开关，供点击循环复用，避免短时间内重复写入配置文件。
  async setTimestampDisplayState(lastModifiedEnabled, createdEnabled) {
    this.settings.lastModifiedEnabled = Boolean(lastModifiedEnabled);
    this.settings.createdEnabled = Boolean(createdEnabled);
    await this.save();
    return {
      lastModifiedEnabled: this.settings.lastModifiedEnabled,
      createdEnabled: this.settings.createdEnabled
    };
  }

  // 归一化状态栏增强模块配置结构。
  normalizeSettings(settings) {
    const source = settings || constants.DEFAULT_STATUS_BAR_ENHANCER_SETTINGS;
    const defaults = constants.DEFAULT_STATUS_BAR_ENHANCER_SETTINGS;

    return {
      showFileName: source.showFileName === true,
      showIcons: source.showIcons === true,
      copyAbsolutePath: source.copyAbsolutePath !== false,
      lastModifiedEnabled: source.lastModifiedEnabled !== false,
      lastModifiedPrepend: typeof source.lastModifiedPrepend === 'string'
        ? source.lastModifiedPrepend
        : defaults.lastModifiedPrepend,
      lastModifiedTimestampFormat: typeof source.lastModifiedTimestampFormat === 'string' && source.lastModifiedTimestampFormat
        ? source.lastModifiedTimestampFormat
        : defaults.lastModifiedTimestampFormat,
      createdEnabled: source.createdEnabled === true,
      createdPrepend: typeof source.createdPrepend === 'string'
        ? source.createdPrepend
        : defaults.createdPrepend,
      createdTimestampFormat: typeof source.createdTimestampFormat === 'string' && source.createdTimestampFormat
        ? source.createdTimestampFormat
        : defaults.createdTimestampFormat,
      cycleOnClickEnabled: source.cycleOnClickEnabled !== false
    };
  }
}

module.exports = {
  StatusBarEnhancerStore
};
