'use strict';

// 定义复制路径模块的默认配置，当前仅保留文件夹末尾斜杠选项。
const DEFAULT_COPY_PATH_SETTINGS = {
  addTrailingSlashToFolders: true
};

// 限制右键菜单目标的有效时间，避免命令面板误复用旧的菜单上下文。
const MENU_TARGET_MAX_AGE = 2000;

module.exports = {
  DEFAULT_COPY_PATH_SETTINGS,
  MENU_TARGET_MAX_AGE
};
