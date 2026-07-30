'use strict';

// 定义复制路径模块的默认配置，当前仅保留文件夹末尾斜杠选项。
const DEFAULT_COPY_PATH_SETTINGS = {
  addTrailingSlashToFolders: false
};

// 限制右键菜单目标的有效时间，避免命令面板误用旧的菜单上下文。
// 设为 30 秒以兼容右键菜单自定义模块的二级子菜单展开耗时。
const MENU_TARGET_MAX_AGE = 30000;

module.exports = {
  DEFAULT_COPY_PATH_SETTINGS,
  MENU_TARGET_MAX_AGE
};
