'use strict';

// 定义文件资源管理器增强模块的默认配置，不包含标签过滤器和 hideStrictPathFilters。
// 置顶选择器与隐藏选择器默认处于关闭状态。

const DEFAULT_FILE_EXPLORER_ENHANCER_SETTINGS = {
  pinFilters: {
    active: false,
    paths: []
  },
  hideFilters: {
    active: false,
    paths: []
  }
};

module.exports = {
  DEFAULT_FILE_EXPLORER_ENHANCER_SETTINGS
};
