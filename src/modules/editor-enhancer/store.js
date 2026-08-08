'use strict';

const {
  DEFAULT_EDITOR_ENHANCER_SETTINGS
} = require('./constants.js');

/**
 * 编辑增强模块配置存储。
 *
 * 负责模块配置的读取、归一化与持久化，
 * 配置统一存放在插件数据的 configs/editor-enhancer.json 中。
 */
class EditorEnhancerStore {
  /**
   * 构造函数。
   * @param {object} plugin 宿主插件实例
   */
  constructor(plugin) {
    this.plugin = plugin;
    this.settings = this.normalizeSettings();
  }

  /**
   * 从数据存储加载配置。
   * @param {object} settings 已持久化的配置（可能不完整）
   */
  load(settings) {
    this.settings = this.normalizeSettings(settings);
  }

  /**
   * 将当前配置保存到数据存储。
   */
  async save() {
    this.settings = this.normalizeSettings(this.settings);
    this.plugin.dataStore.setEditorEnhancerData(this.settings);
    await this.plugin.dataStore.saveEditorEnhancerData(this.settings);
  }

  /**
   * 获取当前配置对象。
   * @returns {object} 配置对象
   */
  getSettings() {
    return this.settings;
  }

  /**
   * 归一化配置，补齐缺失字段并校正非法取值。
   * @param {object} source 原始配置
   * @returns {object} 归一化后的配置
   */
  normalizeSettings(source) {
    const base = source || {};
    return {
      excludedTags: typeof base.excludedTags === 'string' ? base.excludedTags : DEFAULT_EDITOR_ENHANCER_SETTINGS.excludedTags,
      cursorPosition: base.cursorPosition === 'after' ? 'after' : 'between',
      ignoreInCodeBlocks: base.ignoreInCodeBlocks !== false,
      ignoreInlineCode: base.ignoreInlineCode !== false,
      enablePasteAutoClose: base.enablePasteAutoClose === true,
      autoCompleteEnabled: base.autoCompleteEnabled !== false
    };
  }

  /**
   * 更新排除标签列表并保存。
   * 输入时自动转为小写，匹配时保持大小写敏感。
   * @param {string} value 排除标签列表（逗号分隔）
   */
  async setExcludedTags(value) {
    this.settings.excludedTags = String(value || '').toLowerCase();
    await this.save();
  }

  /**
   * 更新光标位置并保存。
   * @param {string} value 'between' 或 'after'
   */
  async setCursorPosition(value) {
    this.settings.cursorPosition = value === 'after' ? 'after' : 'between';
    await this.save();
  }

  /**
   * 更新是否忽略代码块并保存。
   * @param {boolean} enabled 是否忽略
   */
  async setIgnoreInCodeBlocks(enabled) {
    this.settings.ignoreInCodeBlocks = enabled === true;
    await this.save();
  }

  /**
   * 更新是否忽略行内代码并保存。
   * @param {boolean} enabled 是否忽略
   */
  async setIgnoreInlineCode(enabled) {
    this.settings.ignoreInlineCode = enabled === true;
    await this.save();
  }

  /**
   * 更新粘贴行为的自动补全开关并保存。
   * @param {boolean} enabled 是否在粘贴 HTML 标签后触发自动补全
   */
  async setEnablePasteAutoClose(enabled) {
    this.settings.enablePasteAutoClose = enabled === true;
    await this.save();
  }

  /**
   * 更新自动补全总开关（状态栏按钮状态）并保存。
   * 该开关仅控制自动补全提示框的启停。
   * @param {boolean} enabled 是否启用自动补全
   */
  async setAutoCompleteEnabled(enabled) {
    this.settings.autoCompleteEnabled = enabled === true;
    await this.save();
  }
}

module.exports = {
  EditorEnhancerStore
};
