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

module.exports = {
  DEFAULT_STATUS_BAR_ENHANCER_SETTINGS
};
