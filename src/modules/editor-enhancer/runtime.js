'use strict';

const obsidian = require('obsidian');

const {
  COMMAND_DEFINITIONS,
  STATUS_BAR_ICONS,
  NOTICE_MESSAGES
} = require('./constants.js');

const {
  cursorTag,
  isCursorInsideTag,
  isSingleTag,
  tagNameEndPosition,
  getTagConstraintError,
  findMatchingTag
} = require('./tag-utils.js');

/**
 * 编辑增强运行时。
 *
 * 负责：
 *  - 注册 4 条中文命令（跳过标签、跳转匹配标签、同步修改配对标签）
 *  - 状态栏自动补全开关按钮（启用/关闭图标以填充/描边区分）
 *  - 粘贴 HTML 标签后触发自动补全的监听
 */
class EditorEnhancerRuntime {
  /**
   * 构造函数。
   * @param {object} plugin 宿主插件实例
   * @param {object} store EditorEnhancerStore 实例
   * @param {object} overlay AutoCloseOverlay 实例（自建补全浮层）
   */
  constructor(plugin, store, overlay) {
    this.plugin = plugin;
    this.store = store;
    this.overlay = overlay;
    this.settings = this.store.getSettings();
    this.statusBarItem = null;
    this.pasteHandler = null;
  }

  /**
   * 载入最新配置。
   * @param {object} settings 模块配置
   */
  load(settings) {
    this.settings = settings;
  }

  /**
   * 启动运行时：创建状态栏按钮并注册粘贴监听。
   */
  start() {
    this.ensureStatusBarItem();
    this.registerPasteListener();
  }

  /**
   * 停止运行时：移除状态栏按钮与粘贴监听。
   */
  stop() {
    if (this.statusBarItem) {
      this.statusBarItem.remove();
      this.statusBarItem = null;
    }
    if (this.pasteHandler) {
      document.removeEventListener('paste', this.pasteHandler, true);
      this.pasteHandler = null;
    }
  }

  /**
   * 注册全部编辑增强命令（无条件注册，模块开关与状态栏按钮不干预注册）。
   */
  registerCommands() {
    COMMAND_DEFINITIONS.forEach((def) => {
      const command = {
        id: def.id,
        name: def.name,
        editorCallback: (editor) => this.handleCommand(def.id, editor)
      };
      if (def.hotkeys && def.hotkeys.length) {
        command.hotkeys = def.hotkeys;
      }
      this.plugin.addCommand(command);
    });
  }

  /**
   * 命令分发。
   * @param {string} commandId 命令 ID
   * @param {object} editor CodeMirror 编辑器实例
   */
  handleCommand(commandId, editor) {
    if (!this.plugin.isEditorEnhancerEnabled()) {
      new obsidian.Notice('编辑增强模块未启用，命令不可用');
      return;
    }
    if (commandId === 'editor-enhancer-skip-tag-backward' || commandId === 'editor-enhancer-skip-tag-forward') {
      this.handleSkipTag(editor);
    } else if (commandId === 'editor-enhancer-go-to-matching-tag') {
      this.handleGoToMatchingTag(editor);
    } else if (commandId === 'editor-enhancer-sync-matching-tag') {
      this.handleSyncMatchingTag(editor);
    }
  }

  /**
   * 获取光标所在标签，并校验光标是否位于 '<' 与 '>' 内部。
   * @param {object} editor CodeMirror 编辑器实例
   * @param {string} commandName 命令名（用于 toast 提示）
   * @returns {object|null} 标签对象，校验失败时返回 null
   */
  getCommandTargetTag(editor, commandName) {
    const cursor = editor.getCursor();
    const tag = cursorTag(cursor, editor, false);
    if (!tag || !isCursorInsideTag(cursor, tag)) {
      new obsidian.Notice(NOTICE_MESSAGES.commandNotInTag.replace('%s', commandName));
      return null;
    }
    return tag;
  }

  /**
   * 校验标签是否满足设置约束（排除列表、代码块、行内代码）。
   * @param {object} editor CodeMirror 编辑器实例
   * @param {object} tag 标签对象
   * @returns {boolean} 是否通过约束校验
   */
  checkTagConstraints(editor, tag) {
    const cursor = editor.getCursor();
    const error = getTagConstraintError(editor, cursor, tag, this.settings, NOTICE_MESSAGES);
    if (error) {
      new obsidian.Notice(error);
      return false;
    }
    return true;
  }

  /**
   * 向左/向右跳过标签：光标落点位于标签名的末尾（'<' 或 '</' 之后标签名最后一个字符之后）。
   * 两个方向在当前光标标签上的落点一致，均收敛到标签名末尾。
   * @param {object} editor CodeMirror 编辑器实例
   */
  handleSkipTag(editor) {
    const tag = this.getCommandTargetTag(editor, '向左跳过标签');
    if (!tag) return;
    if (!this.checkTagConstraints(editor, tag)) return;

    // 单标签同样允许跳转（落点仍为标签名末尾）。
    const target = { line: tag.line, ch: tagNameEndPosition(tag) };
    editor.setCursor(target);
  }

  /**
   * 跳转至匹配标签：支持来回跳转，光标落点位于配对标签的标签名末尾。
   * 单标签无效，并给出中文 toast 警告。
   * @param {object} editor CodeMirror 编辑器实例
   */
  handleGoToMatchingTag(editor) {
    const tag = this.getCommandTargetTag(editor, '跳转至匹配标签');
    if (!tag) return;

    if (isSingleTag(tag)) {
      new obsidian.Notice(NOTICE_MESSAGES.goToMatchingTagOnVoid);
      return;
    }
    if (!this.checkTagConstraints(editor, tag)) return;

    const pair = findMatchingTag(editor, tag, {
      ignoreInCodeBlocks: this.settings.ignoreInCodeBlocks,
      ignoreInlineCode: this.settings.ignoreInlineCode,
      excludedTags: this.settings.excludedTags
    });
    if (!pair) {
      new obsidian.Notice(NOTICE_MESSAGES.noMatchingTag);
      return;
    }

    const target = { line: pair.line, ch: tagNameEndPosition(pair) };
    editor.setCursor(target);
  }

  /**
   * 同步修改配对标签：读取光标处标签的当前名称，仅替换配对标签的标签名区域，
   * 更新前后光标位置保持不变；支持修改结束标签同步开始标签，或反之。
   * @param {object} editor CodeMirror 编辑器实例
   */
  handleSyncMatchingTag(editor) {
    const tag = this.getCommandTargetTag(editor, '同步修改配对标签');
    if (!tag) return;

    if (isSingleTag(tag)) {
      new obsidian.Notice(NOTICE_MESSAGES.syncMatchingTagOnVoid);
      return;
    }
    if (!this.checkTagConstraints(editor, tag)) return;

    const pair = findMatchingTag(editor, tag, {
      ignoreInCodeBlocks: this.settings.ignoreInCodeBlocks,
      ignoreInlineCode: this.settings.ignoreInlineCode,
      excludedTags: this.settings.excludedTags
    });
    if (!pair) {
      new obsidian.Notice(NOTICE_MESSAGES.noMatchingTag);
      return;
    }

    // 配对标签名称与光标处标签一致时无需修改。
    if (pair.name === tag.name) {
      new obsidian.Notice(NOTICE_MESSAGES.tagNamesAlreadySame);
      return;
    }

    // 记录当前光标位置，替换后恢复（保持光标位置不变）。
    const cursor = editor.getCursor();
    const nameStart = pair.index + (pair.isClosing ? 2 : 1);
    editor.replaceRange(
      tag.name,
      { line: pair.line, ch: nameStart },
      { line: pair.line, ch: nameStart + pair.name.length }
    );
    editor.setCursor(cursor);
  }

  /**
   * 创建状态栏开关按钮（仅创建一次）。
   * 图标以填充（启用）/描边（关闭）区分状态，参考 Obsidian 书签插件。
   */
  ensureStatusBarItem() {
    if (this.statusBarItem) return;

    this.statusBarItem = this.plugin.addStatusBarItem();
    this.statusBarItem.addClass('mod-clickable');
    this.statusBarItem.addClass('nene-editor-enhancer-toggle');
    this.statusBarItem.onClickEvent(() => this.toggleAutoComplete());
    this.refreshStatusBarIcon();
  }

  /**
   * 刷新状态栏按钮图标与提示文案。
   * 按钮仅控制自动补全提示框的启停，不影响命令与设置面板。
   */
  refreshStatusBarIcon() {
    if (!this.statusBarItem) return;
    const enabled = this.store.getSettings().autoCompleteEnabled;

    this.statusBarItem.toggleClass('is-active', enabled);
    this.statusBarItem.setAttribute('aria-label', enabled ? '自动补全：已开启（点击关闭）' : '自动补全：已关闭（点击开启）');
    this.statusBarItem.setAttribute('data-tooltip-position', 'top');

    // 重建图标子元素，启用/关闭使用不同图标。
    this.statusBarItem.empty();
    const iconEl = this.statusBarItem.createSpan({ cls: 'status-bar-item-icon' });
    obsidian.setIcon(iconEl, enabled ? STATUS_BAR_ICONS.enabled : STATUS_BAR_ICONS.disabled);
  }

  /**
   * 切换自动补全启停（仅影响提示框）。
   */
  async toggleAutoComplete() {
    const next = !this.store.getSettings().autoCompleteEnabled;
    await this.plugin.updateEditorEnhancerAutoCompleteEnabled(next);
  }

  /**
   * 注册粘贴监听：
   *  - 开启"粘贴行为的自动补全"时，粘贴后通知浮层一次性触发补全。
   *  - 关闭时，记录粘贴后光标落点为"粘贴抑制位置"：粘贴的 HTML 标签后光标
   *    停留在 `>` 右邻时不触发补全；光标一旦移离该位置即解除抑制，移回后可再次触发。
   * 使用捕获阶段监听，避免编辑器的粘贴处理（如 CodeMirror 6）提前消费事件。
   */
  registerPasteListener() {
    if (this.pasteHandler) return;
    this.pasteHandler = (evt) => {
      try {
        this.handlePaste(evt);
      } catch (error) {
        // 异常隔离：粘贴监听位于 document 捕获阶段，不得冒泡影响其他模块。
        console.log('[自动补全] 粘贴事件处理异常（已隔离）', error);
      }
    };
    document.addEventListener('paste', this.pasteHandler, true);
  }

  // 粘贴事件实际处理逻辑（供 pasteHandler 的异常隔离外壳调用）。
  handlePaste(evt) {
    const settings = this.store.getSettings();
    if (!this.plugin.isEditorEnhancerEnabled()) return;

    if (settings.enablePasteAutoClose) {
      this.overlay.setPasteAutoCloseFlag();
      return;
    }

    // 关闭粘贴自动补全：计算粘贴后光标落点，作为粘贴抑制位置。
    // 使用选区起点 getCursor('from')（全选/选区粘贴时返回起点而非末尾），
    // 粘贴文本末尾即粘贴后的光标位置（近似，单行精确）。
    const editor = this.overlay.getActiveEditor() || this.overlay.getActiveEditorFromWorkspace();
    if (!editor) return;

    const cursor = editor.getCursor('from');
    let text = '';
    if (evt.clipboardData && typeof evt.clipboardData.getData === 'function') {
      text = evt.clipboardData.getData('text');
    }
    if (!text) return;

    const parts = text.split('\n');
    const endPos = {
      line: cursor.line + parts.length - 1,
      ch: parts.length === 1 ? cursor.ch + parts[parts.length - 1].length : parts[parts.length - 1].length
    };
    console.log('[自动补全] 粘贴事件：enablePasteAutoClose=false',
      '选区起点=' + cursor.line + ':' + cursor.ch,
      '粘贴文本长度=' + text.length, '粘贴落点=' + endPos.line + ':' + endPos.ch);
    this.overlay.setPasteSuppressPos(endPos);
  }
}

module.exports = {
  EditorEnhancerRuntime
};
