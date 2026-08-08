'use strict';

/**
 * 编辑增强模块常量定义
 *
 * 功能来源：
 *  - Obsidian Auto Close Tags 插件（1.1.2）：设置项、单标签识别、代码块/行内代码忽略等
 *  - HTML Tags Autocomplete 插件（0.0.7）：自动补全提示框、标签跳转与跳过命令
 * 所有文案均已汉化。
 */

// 模块功能开关在 plugin-settings 中使用的键名。
const FEATURE_NAME = 'editorEnhancer';

// 单标签（自闭合）元素清单，来源于 Auto Close Tags 插件的 VOID_ELEMENTS。
// 这些标签不触发自动补全，也不参与匹配标签跳转。
const VOID_ELEMENTS = [
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'source', 'track', 'wbr'
];

/**
 * 编辑增强模块默认配置。
 *
 *  - excludedTags: 排除标签列表（逗号分隔），输入时自动转小写，匹配时大小写敏感
 *  - cursorPosition: 自动补全后光标位置，'between'=标签中间，'after'=闭合标签之后
 *  - ignoreInCodeBlocks: 忽略围栏代码块中的标签
 *  - ignoreInlineCode: 忽略行内代码中的标签
 *  - enablePasteAutoClose: 是否在粘贴 HTML 标签后触发自动补全（默认关闭）
 *  - autoCompleteEnabled: 状态栏开关状态，仅控制自动补全提示框的启停
 */
const DEFAULT_EDITOR_ENHANCER_SETTINGS = {
  excludedTags: '',
  cursorPosition: 'between',
  ignoreInCodeBlocks: true,
  ignoreInlineCode: true,
  enablePasteAutoClose: false,
  autoCompleteEnabled: true
};

// 命令 ID 常量。
const COMMAND_IDS = {
  skipTagBackward: 'editor-enhancer-skip-tag-backward',
  skipTagForward: 'editor-enhancer-skip-tag-forward',
  goToMatchingTag: 'editor-enhancer-go-to-matching-tag',
  syncMatchingTag: 'editor-enhancer-sync-matching-tag'
};

// 命令注册定义（名称汉化，快捷键按需求指定）。
// 注意：Obsidian Hotkey.key 必须是字符串（字母键用小写字母，方向键用 ArrowLeft/ArrowRight），
// 数字键码会导致设置面板渲染快捷键时崩溃。
const COMMAND_DEFINITIONS = [
  {
    id: COMMAND_IDS.skipTagBackward,
    name: '向左跳过标签',
    hotkeys: [{ modifiers: ['Ctrl'], key: 'ArrowLeft' }]
  },
  {
    id: COMMAND_IDS.skipTagForward,
    name: '向右跳过标签',
    hotkeys: [{ modifiers: ['Ctrl'], key: 'ArrowRight' }]
  },
  {
    id: COMMAND_IDS.goToMatchingTag,
    name: '跳转至匹配标签',
    hotkeys: [{ modifiers: ['Ctrl'], key: 'm' }]
  },
  {
    id: COMMAND_IDS.syncMatchingTag,
    name: '同步修改配对标签',
    hotkeys: []
  }
];

// 状态栏开关图标：启用为填充、关闭为描边，参考 Obsidian 书签插件的填充/描边区分方式。
// 启用态使用 code-2 并通过 CSS 填充着色，关闭态使用 code（描边）。
const STATUS_BAR_ICONS = {
  enabled: 'code-2',
  disabled: 'code'
};

// 中文提示文案。
const NOTICE_MESSAGES = {
  commandNotInTag: '「%s」命令仅在光标位于标签内部时生效',
  goToMatchingTagOnVoid: '"跳转至匹配标签"命令对单标签无效！',
  syncMatchingTagOnVoid: '"同步修改配对标签"命令对单标签无效！',
  tagExcluded: '当前标签已在排除列表中，命令不会生效',
  tagInCodeContext: '当前标签位于代码块或行内代码中，命令不会生效',
  noMatchingTag: '未找到匹配的配对标签',
  tagNamesAlreadySame: '配对标签名称已一致，无需修改'
};

module.exports = {
  FEATURE_NAME,
  VOID_ELEMENTS,
  DEFAULT_EDITOR_ENHANCER_SETTINGS,
  COMMAND_IDS,
  COMMAND_DEFINITIONS,
  STATUS_BAR_ICONS,
  NOTICE_MESSAGES
};
