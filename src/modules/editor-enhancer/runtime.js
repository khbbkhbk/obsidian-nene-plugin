'use strict';

const obsidian = require('obsidian');

const {
  COMMAND_DEFINITIONS,
  STATUS_BAR_ICON_SVG,
  NOTICE_MESSAGES
} = require('./constants.js');

const {
  cursorTag,
  isCursorInsideTag,
  isSingleTag,
  tagNameEndPosition,
  getTagConstraintError,
  findMatchingTag,
  findSkipTag
} = require('./tag-utils.js');

const { TagNameEditor } = require('./tag-name-editor.js');

/**
 * 编辑增强运行时。
 *
 * 负责：
 *  - 注册 4 条中文命令（跳过标签、跳转匹配标签、同步更新匹配标签）
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
    // 标签名编辑输入框（同步更新匹配标签命令的交互组件）。
    this.tagNameEditor = new TagNameEditor(plugin.app);
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
    // 模块停用时关闭可能仍打开的标签名编辑输入框。
    this.tagNameEditor.close();
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
    // 每次命令执行前从配置仓库读取最新配置：
    // store.save() 会替换 settings 对象（新引用），若沿用构造函数缓存的旧引用，
    // 设置面板变更（排除列表、代码块、行内代码等）将无法实时约束命令行为。
    this.settings = this.store.getSettings();
    if (commandId === 'editor-enhancer-skip-tag-backward') {
      this.handleSkipTag(editor, '向左跳过当前标签', 'left');
    } else if (commandId === 'editor-enhancer-skip-tag-forward') {
      this.handleSkipTag(editor, '向右跳过当前标签', 'right');
    } else if (commandId === 'editor-enhancer-go-to-matching-tag') {
      this.handleGoToMatchingTag(editor);
    } else if (commandId === 'editor-enhancer-sync-matching-tag') {
      this.handleSyncMatchingTag(editor);
    }
  }

  /**
   * 获取光标所在标签，并按优先级校验命令前置条件：
   *   1. 排除列表（tagExcluded）
   *   2. 代码块/行内代码（tagInCodeContext）
   *   3. 光标是否位于标签 '<' 与 '>' 内部（commandNotInTag）
   * @param {object} editor CodeMirror 编辑器实例
   * @param {string} commandName 命令名（用于 toast 提示）
   * @returns {object|null} 标签对象，任一校验失败时返回 null
   */
  getCommandTargetTag(editor, commandName) {
    const cursor = editor.getCursor();
    const tag = cursorTag(cursor, editor, false);

    // 约束检查（排除列表 → 代码块/行内代码）优先于光标位置检查。
    const error = getTagConstraintError(editor, cursor, tag, this.settings, NOTICE_MESSAGES);
    if (error) {
      new obsidian.Notice(error);
      return null;
    }

    const inside = tag ? isCursorInsideTag(cursor, tag) : false;
    // 诊断日志：输出光标实际位置与标签解析结果，用于定位"点击标签内仍警告"问题。
    console.log('[编辑增强命令]', commandName,
      '光标=' + cursor.line + ':' + cursor.ch,
      '行内容=' + JSON.stringify(editor.getLine(cursor.line)),
      '解析标签=' + (tag ? tag.full : 'null'),
      'tagIndex=' + (tag ? tag.index : '-'),
      'tagLength=' + (tag ? tag.length : '-'),
      'isCursorInsideTag=' + inside);
    if (!tag || !inside) {
      new obsidian.Notice(NOTICE_MESSAGES.commandNotInTag.replace('%s', commandName));
      return null;
    }
    return tag;
  }

  /**
   * 向左/向右跳过当前标签：从当前标签跳转至其外层或左侧（左向）/内层或右侧（右向）
   * 的最近标签，支持单标签与双标签；落点为目标标签名的右邻位置。
   * @param {object} editor CodeMirror 编辑器实例
   * @param {string} commandName 命令名（用于 toast 提示）
   * @param {string} direction 'left' 向左跳过 / 'right' 向右跳过
   */
  handleSkipTag(editor, commandName, direction) {
    const tag = this.getCommandTargetTag(editor, commandName);
    if (!tag) return;

    // 查找方向侧最近的可跳转标签（约束跟随设置）。
    const target = findSkipTag(editor, tag, direction, {
      ignoreInCodeBlocks: this.settings.ignoreInCodeBlocks,
      ignoreInlineCode: this.settings.ignoreInlineCode,
      excludedTags: this.settings.excludedTags
    });
    if (!target) {
      new obsidian.Notice(NOTICE_MESSAGES.noSkipTarget);
      return;
    }
    editor.setCursor({ line: target.line, ch: tagNameEndPosition(target) });
  }

  /**
   * 跳转至匹配标签：支持来回跳转，光标落点位于配对标签的标签名末尾。
   * 单标签无效，并给出中文 toast 警告。
   * @param {object} editor CodeMirror 编辑器实例
   */
  handleGoToMatchingTag(editor) {
    const tag = this.getCommandTargetTag(editor, '跳转至匹配标签');
    if (!tag) return;

    // 单标签检查在约束检查（已由 getCommandTargetTag 完成）之后。
    if (isSingleTag(tag)) {
      new obsidian.Notice(NOTICE_MESSAGES.goToMatchingTagOnVoid);
      return;
    }

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
   * 同步更新匹配标签：在光标右下角弹出标签名编辑输入框。
   *  - 输入框默认值为当前标签名（结束标签不包含 "/"），全选并聚焦；
   *  - 仅允许大小写字母与结尾 "/"，非法输入显示红色小字并禁用 Enter；
   *  - Esc / 点击外部退出；回车确认后同步更新开始标签与结束标签的标签名；
   *  - 新标签名以单个 "/" 结尾时，回车触发二次确认（转换为单标签）。
   * 更新前后光标位置保持不变。
   * @param {object} editor CodeMirror 编辑器实例
   */
  handleSyncMatchingTag(editor) {
    const tag = this.getCommandTargetTag(editor, '同步更新匹配标签');
    if (!tag) return;

    // 单标签检查在约束检查（已由 getCommandTargetTag 完成）之后。
    if (isSingleTag(tag)) {
      new obsidian.Notice(NOTICE_MESSAGES.syncMatchingTagOnVoid);
      return;
    }

    const pair = findMatchingTag(editor, tag, {
      ignoreInCodeBlocks: this.settings.ignoreInCodeBlocks,
      ignoreInlineCode: this.settings.ignoreInlineCode,
      excludedTags: this.settings.excludedTags
    });
    if (!pair) {
      new obsidian.Notice(NOTICE_MESSAGES.noMatchingTag);
      return;
    }

    // 计算光标像素坐标作为输入框定位锚点（光标右下角）。
    let coords = this.getCursorCoords(editor);
    if (!coords) {
      // 降级：定位到编辑器可视区域左上角偏移处，保证输入框可交互。
      const editorDom = editor.cm && editor.cm.dom;
      if (editorDom) {
        const rect = editorDom.getBoundingClientRect();
        coords = { left: rect.left + 20, top: rect.top + 20, bottom: rect.top + 20 };
      }
    }
    if (!coords) {
      new obsidian.Notice(NOTICE_MESSAGES.commandNotInTag.replace('%s', '同步更新匹配标签'));
      return;
    }

    this.tagNameEditor.open({
      anchorCoords: coords,
      initialName: tag.name,
      // 编辑器实例与高亮范围：转单标签弹出二次确认窗口时高亮当前标签与其匹配标签。
      editor,
      highlightRanges: [
        { from: { line: tag.line, ch: tag.index }, to: { line: tag.line, ch: tag.index + tag.length } },
        { from: { line: pair.line, ch: pair.index }, to: { line: pair.line, ch: pair.index + pair.length } }
      ],
      onCommit: (newName, isSingleTag) => {
        this.commitTagRename(editor, tag, pair, newName, isSingleTag);
      }
    });
  }

  /**
   * 提交标签名更新：
   *  - 双向同步：同时更新当前标签与匹配标签的标签名；
   *  - 转单标签：以当前标签为基准，删除其匹配标签，并将当前标签更新为自闭合单标签；
   *  - 更新前后光标位置保持不变（按文档逻辑位置恢复）。
   * @param {object} editor CodeMirror 编辑器实例
   * @param {object} tag 当前标签
   * @param {object} pair 匹配标签
   * @param {string} newName 新标签名（已统一小写，不含 "/"）
   * @param {boolean} isSingleTag 是否转换为单标签
   */
  commitTagRename(editor, tag, pair, newName, isSingleTag) {
    // 标签名未变化（且非转单标签）时无需修改。
    if (!isSingleTag && newName === tag.name.toLowerCase()) {
      new obsidian.Notice(NOTICE_MESSAGES.tagNamesAlreadySame);
      // 未发生修改也要恢复编辑器焦点，避免输入框 / 弹窗关闭后焦点丢失。
      editor.focus();
      return;
    }

    const cursor0 = editor.getCursor();
    const edits = [];
    if (isSingleTag) {
      // 当前标签 → 自闭合单标签，并删除其匹配标签。
      edits.push({
        from: { line: tag.line, ch: tag.index },
        to: { line: tag.line, ch: tag.index + tag.length },
        text: '<' + newName + '/>'
      });
      edits.push({
        from: { line: pair.line, ch: pair.index },
        to: { line: pair.line, ch: pair.index + pair.length },
        text: ''
      });
    } else {
      // 双向同步：开始标签与结束标签的标签名一同更新。
      edits.push({
        from: { line: tag.line, ch: tag.index },
        to: { line: tag.line, ch: tag.index + tag.length },
        text: (tag.isClosing ? '</' : '<') + newName + '>'
      });
      edits.push({
        from: { line: pair.line, ch: pair.index },
        to: { line: pair.line, ch: pair.index + pair.length },
        text: (pair.isClosing ? '</' : '<') + newName + '>'
      });
    }

    // 同一行内的多段编辑需从后往前执行，确保 replaceRange 坐标始终基于未受影响的区域。
    edits.sort(function (a, b) {
      return b.from.line - a.from.line || b.from.ch - a.from.ch;
    });
    // 光标恢复采用顺序偏移映射（保持文档逻辑位置）：
    //  - 编辑完全在光标之前 → 列号按长度差平移；
    //  - 光标位于编辑区域内 → 保持相对编辑起点的偏移（不超过新文本长度）；
    //  - 编辑起点在光标处或之后 → 光标不受影响。
    let cursor = { line: cursor0.line, ch: cursor0.ch };
    for (const edit of edits) {
      const newLen = edit.text.length;
      const oldLen = edit.to.ch - edit.from.ch;
      const delta = newLen - oldLen;
      if (edit.from.line === cursor0.line) {
        if (edit.from.ch >= cursor.ch) {
          // 编辑起点在光标处或之后：光标不受影响。
        } else if (edit.to.ch <= cursor.ch) {
          // 编辑完全在光标之前：列号按长度差平移，保持逻辑位置不变。
          cursor.ch += delta;
        } else {
          // 光标位于编辑区域内：保持相对编辑起点的偏移。
          cursor.ch = edit.from.ch + Math.min(cursor.ch - edit.from.ch, newLen);
        }
      }
      editor.replaceRange(edit.text, edit.from, edit.to);
    }
    editor.setCursor(cursor);
    // 回车确认后恢复编辑器焦点：输入框 / 二次确认弹窗关闭后，焦点必须回到笔记编辑器。
    editor.focus();
  }

  /**
   * 获取光标所在位置的像素坐标，用于输入框定位。
   * @param {object} editor CodeMirror 编辑器实例
   * @returns {object|null} { left, top, bottom } 或 null（无法定位时）
   */
  getCursorCoords(editor) {
    const cm = editor.cm;
    if (!cm || typeof cm.coordsAtPos !== 'function') {
      return null;
    }
    const offset = editor.posToOffset(editor.getCursor());
    if (offset === null || offset === undefined) {
      return null;
    }
    return cm.coordsAtPos(offset);
  }

  /**
   * 创建状态栏开关按钮（仅创建一次）。
   * 图标使用自定义 SVG，启停状态由 CSS 以 fill 区分（启用填充强调色/关闭无填充）。
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

    // 重建图标子元素：启停由 CSS 区分。
    this.statusBarItem.empty();
    const iconEl = this.statusBarItem.createSpan({ cls: 'status-bar-item-icon' });
    iconEl.innerHTML = STATUS_BAR_ICON_SVG;
  }

  /**
   * 切换自动补全启停（仅影响提示框）。
   * 异常隔离：配置保存失败时提示用户，避免异常冒泡影响 Obsidian 状态栏。
   */
  async toggleAutoComplete() {
    try {
      const next = !this.store.getSettings().autoCompleteEnabled;
      await this.plugin.updateEditorEnhancerAutoCompleteEnabled(next);
    } catch (error) {
      console.log('[自动补全] 状态栏开关切换失败（已隔离）', error);
      new obsidian.Notice('自动补全开关切换失败，请重试');
    }
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
