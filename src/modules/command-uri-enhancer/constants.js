'use strict';

// 定义命令&URI增强模块的默认配置。
// 除原有的"文件夹末尾补 /"外，还包含"文件速览命令"功能所需的默认值：
// openFileIn / deleteCommandWhenFileIsDeleted / updateCommandsOnRename 为用户指定默认值，
// openNewTab 为历史保留字段，当前未被打开逻辑使用。
const DEFAULT_COMMAND_URI_ENHANCER_SETTINGS = {
  addTrailingSlashToFolders: false,
  openNewTab: false,
  openFileIn: 'activeTab',
  deleteCommandWhenFileIsDeleted: true,
  updateCommandsOnRename: true,
  commands: [],
  customVariables: [
    {
      name: 'date',
      value: '{{d:YYYY-MM-DD}}',
      type: 'string'
    },
    {
      name: 'time',
      value: '{{d:HH:mm:ss}}',
      type: 'string'
    }
  ]
};

// 文件速览命令的可选打开位置清单：键为持久化取值，值为中文显示文本。
const OPEN_FILE_IN_OPTIONS = {
  activeTab: '在当前标签页打开',
  newTab: '在新标签页打开',
  newTabSplit: '在右侧分屏打开',
  newTabSplitHorizontal: '在下方分屏打开',
  rightLeaf: '在右侧边栏打开',
  leftLeaf: '在左侧边栏打开',
  window: '在新窗口打开'
};

// 文件速览命令的命令 ID 前缀（插件注册命令时 Obsidian 会自动再叠加插件前缀）。
const OPEN_WITH_COMMAND_ID_PREFIX = 'open-with-command';

module.exports = {
  DEFAULT_COMMAND_URI_ENHANCER_SETTINGS,
  OPEN_FILE_IN_OPTIONS,
  OPEN_WITH_COMMAND_ID_PREFIX
};
