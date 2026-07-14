'use strict';

// 定义右键菜单支持的菜单类型，供运行时识别与设置页渲染统一复用。
const MENU_TYPE_OPTIONS = [
  { id: 'editor', name: '编辑区右键菜单' },
  { id: 'moreOptions', name: '编辑区“更多选项”菜单' },
  { id: 'file', name: '文件右键菜单' },
  { id: 'folder', name: '文件夹右键菜单' }
];

// 定义分组布局类型，图标栏用于替代原有依赖 :has 的 CSS 方案。
const GROUP_LAYOUT_OPTIONS = [
  { value: 'list', label: '列表' },
  { value: 'icon-bar', label: '图标栏' },
  { value: 'grid', label: '网格' }
];

// 定义四个菜单默认的分组结构，仅作为首次安装与重置后的初始配置。
const DEFAULT_MENU_GROUPS = {
  editor: [
    {
      id: 'editor-quick-actions',
      name: '编辑',
      icon: 'mouse-pointer-click',
      layout: 'icon-bar',
      hidden: false,
      forceSubmenu: false,
      commands: [
        'editor:cut',
        'editor:copy',
        'editor:paste',
        'editor:paste-as-plain-text',
        'editor:select-all'
      ]
    },
    {
      id: 'editor-format',
      name: '格式',
      icon: 'bold',
      layout: 'list',
      hidden: false,
      forceSubmenu: true,
      commands: [
        'editor:toggle-bold',
        'editor:toggle-italics',
        'editor:toggle-highlight',
        'editor:toggle-strikethrough',
        'editor:toggle-code'
      ]
    },
    {
      id: 'editor-insert',
      name: '插入',
      icon: 'plus',
      layout: 'list',
      hidden: false,
      forceSubmenu: true,
      commands: [
        'editor:insert-link',
        'editor:insert-embed',
        'editor:insert-table',
        'editor:insert-codeblock',
        'editor:insert-horizontal-rule'
      ]
    }
  ],
  moreOptions: [
    {
      id: 'more-options-links',
      name: '链接与路径',
      icon: 'link',
      layout: 'list',
      hidden: false,
      forceSubmenu: true,
      commands: [
        'file-explorer:open-link-view',
        'file-explorer:copy-path',
        'file-explorer:copy-vault-path'
      ]
    }
  ],
  file: [
    {
      id: 'file-open-actions',
      name: '打开',
      icon: 'file-text',
      layout: 'list',
      hidden: false,
      forceSubmenu: true,
      commands: [
        'file-explorer:open',
        'file-explorer:open-in-new-tab',
        'file-explorer:open-to-the-right',
        'file-explorer:open-in-new-window'
      ]
    },
    {
      id: 'file-management',
      name: '管理',
      icon: 'settings',
      layout: 'list',
      hidden: false,
      forceSubmenu: true,
      commands: [
        'file-explorer:rename-file',
        'file-explorer:copy-path',
        'file-explorer:copy-vault-path',
        'file-explorer:delete-file'
      ]
    }
  ],
  folder: [
    {
      id: 'folder-create',
      name: '新建',
      icon: 'folder-plus',
      layout: 'list',
      hidden: false,
      forceSubmenu: true,
      commands: [
        'file-explorer:new-file',
        'file-explorer:new-folder'
      ]
    },
    {
      id: 'folder-management',
      name: '管理',
      icon: 'settings',
      layout: 'list',
      hidden: false,
      forceSubmenu: true,
      commands: [
        'file-explorer:rename-file',
        'file-explorer:copy-path',
        'file-explorer:copy-vault-path',
        'file-explorer:delete-file'
      ]
    }
  ]
};

// 深拷贝默认分组，避免运行时共享引用。
function cloneDefaultGroups(menuType) {
  return JSON.parse(JSON.stringify(DEFAULT_MENU_GROUPS[menuType] || []));
}

// 构造菜单自定义模块的默认配置。
function buildDefaultMenuCustomizerSettings() {
  const menus = {};

  MENU_TYPE_OPTIONS.forEach((menuType) => {
    menus[menuType.id] = {
      enabled: false,
      groups: cloneDefaultGroups(menuType.id),
      commandOverrides: {},
      commandMappings: []
    };
  });

  return { menus };
}

// 定义各菜单的默认配置，默认关闭，由用户按需开启。
const DEFAULT_MENU_CUSTOMIZER_SETTINGS = buildDefaultMenuCustomizerSettings();

// 生成默认配置深拷贝，避免运行时共享同一对象引用。
function createDefaultMenuCustomizerSettings() {
  return JSON.parse(JSON.stringify(DEFAULT_MENU_CUSTOMIZER_SETTINGS));
}

module.exports = {
  DEFAULT_MENU_CUSTOMIZER_SETTINGS,
  DEFAULT_MENU_GROUPS,
  GROUP_LAYOUT_OPTIONS,
  MENU_TYPE_OPTIONS,
  createDefaultMenuCustomizerSettings
};
