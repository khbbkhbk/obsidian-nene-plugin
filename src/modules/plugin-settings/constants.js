'use strict';

// 定义插件级功能开关默认值，首次安装时各子功能均保持关闭状态。
const DEFAULT_FEATURE_SETTINGS = {
  fileMarker: {
    enabled: false
  },
  anchorGraph: {
    enabled: false
  },
  menuCustomizer: {
    enabled: false
  },
  commandUriEnhancer: {
    enabled: false
  },
  statusBarEnhancer: {
    enabled: false
  },
  tabBarEnhancer: {
    enabled: false
  },
  fileExplorerEnhancer: {
    enabled: false
  },
  editorEnhancer: {
    enabled: false
  },
  themeEnhancer: {
    enabled: false
  }
};

module.exports = {
  DEFAULT_FEATURE_SETTINGS
};
