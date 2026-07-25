'use strict';

// 定义标签栏增强模块的默认配置，默认关闭实验性空白区切换与调试模式，默认跳过隐藏标签。
const DEFAULT_TAB_BAR_ENHANCER_SETTINGS = {
  debug: false,
  topBarWheelTabSwitch: false,
  skipCssHiddenTabs: true,
  skipUnloadedPluginTabs: true
};

module.exports = {
  DEFAULT_TAB_BAR_ENHANCER_SETTINGS
};
