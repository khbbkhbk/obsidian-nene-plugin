'use strict';

// 定义状态栏增强模块的默认配置，按用户要求默认不显示文件名、不显示图标、默认复制绝对路径；
// 时间戳显示默认开启最后修改时间、关闭创建时间，点击时间项默认循环切换显示内容。
const DEFAULT_STATUS_BAR_ENHANCER_SETTINGS = {
  showFileName: false,
  showIcons: false,
  copyAbsolutePath: true,
  lastModifiedEnabled: true,
  lastModifiedPrepend: '🖋️',
  lastModifiedTimestampFormat: ' HH:mm:ss',
  createdEnabled: false,
  createdPrepend: '📘',
  createdTimestampFormat: 'YYYY-MM-DD',
  cycleOnClickEnabled: true
};

// 定义状态栏元素管理（原 StatusBarOrganizer）的默认配置。
// 使用扁平结构：elements 以元素 ID 为键，值为 { position, visible }；
// deletedIds 记录用户主动隐藏的孤儿条目 ID，可用于恢复。
const DEFAULT_ORGANIZER_SETTINGS = {
  elements: {},
  deletedIds: []
};

module.exports = {
  DEFAULT_STATUS_BAR_ENHANCER_SETTINGS,
  DEFAULT_ORGANIZER_SETTINGS
};
