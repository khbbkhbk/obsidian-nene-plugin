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
    name: '向左跳过当前标签',
    hotkeys: [{ modifiers: ['Ctrl'], key: 'ArrowLeft' }]
  },
  {
    id: COMMAND_IDS.skipTagForward,
    name: '向右跳过当前标签',
    hotkeys: [{ modifiers: ['Ctrl'], key: 'ArrowRight' }]
  },
  {
    id: COMMAND_IDS.goToMatchingTag,
    name: '跳转至匹配标签',
    hotkeys: [{ modifiers: ['Ctrl'], key: 'm' }]
  },
  {
    id: COMMAND_IDS.syncMatchingTag,
    name: '同步更新匹配标签',
    hotkeys: [{ modifiers: ['Ctrl'], key: 'u' }]
  }
];

// 状态栏开关图标（自定义 SVG，替换内置 code-2/code 图标）。
// 启停通过 CSS 修改 <path> 的 fill 实现：启用态 fill: var(--text-accent)（填充强调色），
// 关闭态 fill: var(--text-muted)（弱化描边）。具体规则见 90-editor-enhancer.css 的 .is-active 选择器。
const STATUS_BAR_ICON_SVG =
  '<svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg">' +
  '<path fill-rule="evenodd" d="M32 256 A160 160 0 0 1 192 96 L832 96 A160 160 0 0 1 992 256 L992 768 A160 160 0 0 1 832 928 L192 928 A160 160 0 0 1 32 768 L32 256 Z M192 192 L832 192 A64 64 0 0 1 896 256 L896 768 A64 64 0 0 1 832 832 L192 832 A64 64 0 0 1 128 768 L128 256 A64 64 0 0 1 192 192 Z M512 511.424 L332.864 704 L256 624.064 l104.576-112.448 L256 400.192 L332.544 320 L512 511.424 z M768 704 H576 V576 h192 v128 z"/>' +
  '</svg>';

// 中文提示文案。
const NOTICE_MESSAGES = {
  commandNotInTag: '「%s」命令仅在光标位于标签内部时生效',
  goToMatchingTagOnVoid: '"跳转至匹配标签"命令对单标签无效！',
  syncMatchingTagOnVoid: '"同步更新匹配标签"命令对单标签无效！',
  tagExcluded: '当前标签已在排除列表中，命令不会生效',
  tagInCodeContext: '当前标签位于代码块或行内代码中，命令不会生效',
  noMatchingTag: '未找到与之匹配的匹配标签',
  noSkipTarget: '当前方向没有可跳转的标签',
  tagNamesAlreadySame: '目标标签名与当前一致，无需修改'
};

module.exports = {
  FEATURE_NAME,
  VOID_ELEMENTS,
  DEFAULT_EDITOR_ENHANCER_SETTINGS,
  COMMAND_IDS,
  COMMAND_DEFINITIONS,
  STATUS_BAR_ICON_SVG,
  NOTICE_MESSAGES
};
