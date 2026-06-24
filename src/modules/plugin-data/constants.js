'use strict';

// 定义插件级持久化数据的默认结构，按模块切片分离，避免跨功能互相污染。
const DEFAULT_PLUGIN_DATA = {
  features: {
    fileMarker: {
      enabled: false
    },
    anchorGraph: {
      enabled: false
    }
  },
  fileMarker: {
    marks: {},
    groups: [
      {
        id: 'ungrouped',
        name: '未分组',
        collapsed: false
      }
    ]
  }
};

module.exports = {
  DEFAULT_PLUGIN_DATA
};
