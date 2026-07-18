'use strict';

// 定义关系图谱增强模块自己的默认配置结构，便于独立文件读写与旧数据迁移。
const DEFAULT_ANCHOR_GRAPH_SETTINGS = {
  defaultSettings: {
    htmlEnhancementEnabled: true
  },
  noteOverrides: {}
};

module.exports = {
  DEFAULT_ANCHOR_GRAPH_SETTINGS
};
