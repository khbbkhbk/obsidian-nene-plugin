'use strict';

var constants = require('./constants');

// 定义插件级数据仓库，统一负责整份数据的切片读取、归一化和落盘。
class PluginDataStore {
  constructor(plugin) {
    this.plugin = plugin; // 保存插件实例，便于访问 loadData 和 saveData
    this.data = this.normalizeData(); // 初始化默认数据，避免首次读取时报空
  }

  // 加载本地持久化数据，并按当前模块切片结构归一化。
  async load() {
    const rawData = await this.plugin.loadData();
    this.data = this.normalizeData(rawData);
  }

  // 保存当前整份插件数据到本地。
  async save() {
    this.data = this.normalizeData(this.data);
    await this.plugin.saveData(this.data);
  }

  // 返回整份插件数据对象，供主入口按需透传。
  getData() {
    return this.data;
  }

  // 返回插件级功能开关切片。
  getFeatures() {
    return this.data.features;
  }

  // 更新插件级功能开关切片。
  setFeatures(features) {
    this.data.features = this.normalizeFeatures(features);
  }

  // 返回文件标记数据切片。
  getFileMarkerData() {
    return this.data.fileMarker;
  }

  // 更新文件标记数据切片。
  setFileMarkerData(fileMarkerData) {
    this.data.fileMarker = this.normalizeFileMarkerData(fileMarkerData);
  }

  // 归一化整份插件数据，只接受当前模块切片结构。
  normalizeData(data) {
    const source = data && typeof data === 'object' ? data : {};

    return {
      features: this.normalizeFeatures(source.features),
      fileMarker: this.normalizeFileMarkerData(source.fileMarker)
    };
  }

  // 归一化插件级功能开关结构。
  normalizeFeatures(features) {
    return {
      fileMarker: {
        enabled: features?.fileMarker?.enabled === true
      },
      anchorGraph: {
        enabled: features?.anchorGraph?.enabled === true
      }
    };
  }

  // 归一化文件标记切片的顶层结构，具体业务字段由 file-marker 模块进一步收敛。
  normalizeFileMarkerData(fileMarkerData) {
    const source = fileMarkerData && typeof fileMarkerData === 'object' ? fileMarkerData : {};
    const defaultFileMarker = constants.DEFAULT_PLUGIN_DATA.fileMarker;

    return {
      marks: source.marks && typeof source.marks === 'object' ? source.marks : defaultFileMarker.marks,
      groups: Array.isArray(source.groups) ? source.groups : defaultFileMarker.groups
    };
  }
}

module.exports = {
  PluginDataStore
};
