'use strict';

var anchorGraphConstants = require('../graph-view-enhancer/constants');
var copyPathConstants = require('../copy-path/constants');
var fileMarkerConstants = require('../file-marker/constants');
var menuCustomizerConstants = require('../context-menu-enhancer/constants');
var statusBarEnhancerConstants = require('../status-bar-enhancer/constants');

// 定义独立功能配置目录名称，统一由功能配置管理器复用。
const FEATURE_CONFIG_DIRECTORY_NAME = 'configs';

// 定义配置导出目录名称，统一存放用户手动导出的备份文件。
const FEATURE_EXPORT_DIRECTORY_NAME = 'exports';

// 定义各功能在磁盘中的独立配置文件名，便于后续新增模块时继续扩展。
const FEATURE_CONFIG_FILE_NAMES = {
  fileMarker: 'file-marker',
  anchorGraph: 'anchor-graph',
  menuCustomizer: 'menu-customizer',
  copyPath: 'copy-path',
  statusBarEnhancer: 'status-bar-enhancer'
};

// 定义插件级持久化数据的默认结构，拆分后仅保留核心开关与兼容字段。
const DEFAULT_PLUGIN_DATA = {
  features: {
    fileMarker: {
      enabled: false
    },
    anchorGraph: {
      enabled: false
    },
    menuCustomizer: {
      enabled: false
    },
    copyPath: {
      enabled: false
    },
    statusBarEnhancer: {
      enabled: false
    }
  }
};

// 定义各功能独立配置文件的默认内容，供首次安装和迁移失败时回退使用。
const DEFAULT_FEATURE_DATA = {
  fileMarker: fileMarkerConstants.DEFAULT_FILE_MARKER_SETTINGS,
  anchorGraph: anchorGraphConstants.DEFAULT_ANCHOR_GRAPH_SETTINGS,
  menuCustomizer: menuCustomizerConstants.DEFAULT_MENU_CUSTOMIZER_SETTINGS,
  copyPath: copyPathConstants.DEFAULT_COPY_PATH_SETTINGS,
  statusBarEnhancer: statusBarEnhancerConstants.DEFAULT_STATUS_BAR_ENHANCER_SETTINGS
};

module.exports = {
  DEFAULT_FEATURE_DATA,
  DEFAULT_PLUGIN_DATA,
  FEATURE_CONFIG_DIRECTORY_NAME,
  FEATURE_EXPORT_DIRECTORY_NAME,
  FEATURE_CONFIG_FILE_NAMES
};
