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

// 定义右键菜单的初始内置数据，用于补齐没有显式 commandId 的原始菜单项。
// 这里使用扁平结构，每条记录自行声明所属 menuType，便于统一追加与检索。
const BUILTIN_MENU_COMMAND_DATA = [
  { menuType: 'editor', commandId: 'editor:cut', label: '剪切', title: '剪切', section: 'edit', icon: 'scissors' },
  { menuType: 'editor', commandId: 'editor:copy', label: '复制', title: '复制', section: 'edit', icon: 'copy' },
  { menuType: 'editor', commandId: 'editor:paste', label: '粘贴', title: '粘贴', section: 'edit', icon: 'clipboard-check' },
  { menuType: 'editor', commandId: 'editor:paste-as-plain-text', label: '以纯文本形式粘贴', title: '以纯文本形式粘贴', section: 'edit', icon: 'clipboard-type' },
  { menuType: 'editor', commandId: 'editor:select-all', label: '全选', title: '全选', section: 'edit', icon: 'box-select' },
  { menuType: 'editor', commandId: 'editor:edit-link', label: '编辑链接', title: '编辑链接', section: 'edit', icon: 'text-cursor-input' },
  { menuType: 'editor', commandId: 'editor:toggle-bold', label: '加粗', title: '加粗', section: 'format', icon: 'bold' },
  { menuType: 'editor', commandId: 'editor:toggle-italics', label: '斜体', title: '斜体', section: 'format', icon: 'italic' },
  { menuType: 'editor', commandId: 'editor:toggle-highlight', label: '高亮', title: '高亮', section: 'format', icon: 'highlighter' },
  { menuType: 'editor', commandId: 'editor:toggle-strikethrough', label: '删除线', title: '删除线', section: 'format', icon: 'strikethrough' },
  { menuType: 'editor', commandId: 'editor:toggle-code', label: '代码', title: '代码', section: 'format', icon: 'code' },
  { menuType: 'editor', commandId: 'editor:insert-link', label: '链接', title: '链接', section: 'insert', icon: 'link' },
  { menuType: 'editor', commandId: 'editor:insert-embed', label: '嵌入', title: '嵌入', section: 'insert', icon: 'sticky-note' },
  { menuType: 'editor', commandId: 'editor:insert-codeblock', label: '代码块', title: '代码块', section: 'insert', icon: 'code-2' },
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
        'editor:edit-link',
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
      layout: 'icon-bar',
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
      layout: 'icon-bar',
      hidden: false,
      forceSubmenu: true,
      commands: [
        'editor:insert-link',
        'editor:insert-embed',
        'editor:insert-codeblock'
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

// 根据默认分组生成根级菜单结构，保证首次安装时“分组顺序”与默认配置一致。
function buildDefaultRootItems(menuType) {
  return cloneDefaultGroups(menuType).map((group) => ({
    id: `${group.id}::root`,
    type: 'group',
    groupId: group.id,
    hidden: false
  }));
}

// 深拷贝默认分组，避免运行时共享引用。
function cloneDefaultGroups(menuType) {
  return JSON.parse(JSON.stringify(DEFAULT_MENU_GROUPS[menuType] || []));
}

// 深拷贝默认根级结构，避免运行时共享引用。
function cloneDefaultRootItems(menuType) {
  return JSON.parse(JSON.stringify(buildDefaultRootItems(menuType)));
}

// 构造菜单自定义模块的默认配置。
function buildDefaultMenuCustomizerSettings() {
  const menus = {};

  MENU_TYPE_OPTIONS.forEach((menuType) => {
    menus[menuType.id] = {
      enabled: false,
      groups: cloneDefaultGroups(menuType.id),
      rootItems: cloneDefaultRootItems(menuType.id),
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

// 返回指定菜单类型下的初始内置命令条目。
function getBuiltinCommandEntries(menuType) {
  return BUILTIN_MENU_COMMAND_DATA
    .filter((entry) => entry.menuType === menuType)
    .map((entry) => Object.assign({}, entry));
}

// 返回指定菜单类型和命令 ID 对应的初始内置命令元信息。
function getBuiltinCommandMetadata(menuType, commandId) {
  const normalizedCommandId = typeof commandId === 'string' ? commandId.trim() : '';
  if (!menuType || !normalizedCommandId) {
    return null;
  }

  const entries = getBuiltinCommandEntries(menuType).filter((entry) => entry.commandId === normalizedCommandId);
  if (entries.length === 0) {
    return null;
  }

  const primaryEntry = entries[0];

  return {
    id: normalizedCommandId,
    label: primaryEntry.label || primaryEntry.title || normalizedCommandId,
    icon: primaryEntry.icon || '',
    aliases: Array.from(new Set(entries.map((entry) => entry.title).filter(Boolean))),
    sections: Array.from(new Set(entries.map((entry) => entry.section).filter(Boolean))),
    source: 'builtin',
    canExecute: false
  };
}

module.exports = {
  BUILTIN_MENU_COMMAND_DATA,
  DEFAULT_MENU_CUSTOMIZER_SETTINGS,
  DEFAULT_MENU_GROUPS,
  GROUP_LAYOUT_OPTIONS,
  MENU_TYPE_OPTIONS,
  cloneDefaultRootItems,
  createDefaultMenuCustomizerSettings,
  getBuiltinCommandEntries,
  getBuiltinCommandMetadata
};
