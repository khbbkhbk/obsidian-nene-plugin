'use strict';

var obsidian = require('obsidian');
var constants = require('./constants');

// 定义功能配置管理器，负责将不同模块的数据拆分到独立 JSON 文件中。
class FeatureConfigManager {
  constructor(plugin) {
    this.plugin = plugin; // 保存插件实例，便于访问 vault adapter 与 manifest
    this.writeQueue = new Map(); // 按功能名串行写入，避免短时间多次保存互相覆盖
    this.configDirectoryPath = obsidian.normalizePath(
      `${plugin.app.vault.configDir}/plugins/${plugin.manifest.id}/${constants.FEATURE_CONFIG_DIRECTORY_NAME}`
    );
    this.exportDirectoryPath = obsidian.normalizePath(
      `${plugin.app.vault.configDir}/plugins/${plugin.manifest.id}/${constants.FEATURE_EXPORT_DIRECTORY_NAME}`
    );
  }

  // 初始化配置目录，首次加载时确保 configs 目录存在。
  async initialize() {
    await this.ensureDirectory(this.configDirectoryPath);
  }

  // 读取指定功能的独立配置文件，返回是否存在以及解析后的内容。
  async load(featureKey) {
    const adapter = this.plugin.app.vault.adapter;
    const filePath = this.getFeatureConfigPath(featureKey);

    if (!(await adapter.exists(filePath))) {
      return {
        found: false,
        data: null
      };
    }

    try {
      const content = await adapter.read(filePath);
      return {
        found: true,
        data: JSON.parse(content)
      };
    } catch (error) {
      console.error(`[${this.plugin.manifest.name}] 读取功能配置失败 (${featureKey})`, error);
      return {
        found: true,
        data: null
      };
    }
  }

  // 保存指定功能的配置，并通过写入队列避免并发覆盖。
  async save(featureKey, data) {
    return this.enqueueWrite(featureKey, async () => {
      const adapter = this.plugin.app.vault.adapter;
      const filePath = this.getFeatureConfigPath(featureKey);
      const jsonContent = JSON.stringify(data, null, 2);
      await adapter.write(filePath, jsonContent);
    });
  }

  // 返回指定功能的配置文件当前是否已存在。
  async exists(featureKey) {
    return this.plugin.app.vault.adapter.exists(this.getFeatureConfigPath(featureKey));
  }

  // 返回配置目录路径，供设置页展示状态与定位文件。
  getConfigDirectoryPath() {
    return this.configDirectoryPath;
  }

  // 返回配置导出目录路径，供设置页展示导出文件位置。
  getExportDirectoryPath() {
    return this.exportDirectoryPath;
  }

  // 将导出内容写入独立备份文件，并返回实际写入路径。
  async writeExportFile(fileName, content) {
    await this.ensureDirectory(this.exportDirectoryPath);
    const filePath = obsidian.normalizePath(`${this.exportDirectoryPath}/${fileName}`);
    await this.plugin.app.vault.adapter.write(filePath, content);
    return filePath;
  }

  // 返回某个功能配置文件的完整路径。
  getFeatureConfigPath(featureKey) {
    const fileName = constants.FEATURE_CONFIG_FILE_NAMES[featureKey] || featureKey;
    return obsidian.normalizePath(`${this.configDirectoryPath}/${fileName}.json`);
  }

  // 将同一功能的写入串行化，保证最后一次保存不会被前一次异步回写覆盖。
  async enqueueWrite(queueKey, writeOperation) {
    const previousTask = this.writeQueue.get(queueKey) || Promise.resolve();
    const nextTask = previousTask
      .catch(() => { })
      .then(writeOperation)
      .finally(() => {
        if (this.writeQueue.get(queueKey) === nextTask) {
          this.writeQueue.delete(queueKey);
        }
      });

    this.writeQueue.set(queueKey, nextTask);
    return nextTask;
  }

  // 确保指定目录存在，便于首次导出或初始化时统一复用。
  async ensureDirectory(directoryPath) {
    const adapter = this.plugin.app.vault.adapter;
    if (await adapter.exists(directoryPath)) return;

    await adapter.mkdir(directoryPath);
  }
}

module.exports = {
  FeatureConfigManager
};
