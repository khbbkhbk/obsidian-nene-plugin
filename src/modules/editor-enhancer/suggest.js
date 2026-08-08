'use strict';

const obsidian = require('obsidian');

const {
  cursorTag,
  isSingleTag,
  isTagExcluded,
  isInFencedCodeBlock,
  isInInlineCode,
  shouldAutoClose
} = require('./tag-utils.js');

/**
 * 编辑增强自动补全建议器。
 *
 * 基于 Obsidian EditorSuggest 实现 HTML 标签闭合补全：
 *  - 输入完开始标签的 '>' 且无配对闭标签时，弹出唯一建议 '</tag>'
 *  - Tab 键完成补全，Esc 键退出，上下左右方向键不被占用（光标正常移动）
 *  - 单标签（<hr>/<br>/<img> 及自闭合形式）不触发补全
 *  - 补全后设置抑制标记，仅当用户发生非控制类按键的实际键入（排除方向键）后才解除，
 *    避免光标停留在标签内部时反复弹出补全提示
 *  - 支持粘贴 HTML 标签后触发补全（由 runtime 通过 setPasteAutoCloseFlag 通知）
 */
class EditorEnhancerSuggest extends obsidian.EditorSuggest {
  /**
   * 构造函数。
   * @param {object} plugin 宿主插件实例
   * @param {object} store EditorEnhancerStore 实例
   */
  constructor(plugin, store) {
    super(plugin.app);
    this.plugin = plugin;
    this.store = store;

    // 模块启用/自动补全总开关（状态栏按钮控制）。
    this.enabled = false;
    // 补全后抑制标记：为 true 时不再触发补全提示。
    this.suppressUntilTyping = false;
    // 补全后抑制发生时记录光标位置，用于检测光标是否已通过鼠标等方式移离。
    this.suppressCursor = null;
    // 粘贴后一次性触发标记。
    this.allowPasteAutoClose = false;
    // 粘贴抑制位置：粘贴 HTML 标签后光标落点（仅 enablePasteAutoClose=false 时设置）。
    // 光标仍停留在该位置时不触发补全；一旦光标移离即解除抑制，移回后可再次触发。
    this.pasteSuppressPos = null;
    // 提示框是否处于打开状态。
    this.isOpenFlag = false;
    // 最近一次的建议文本。
    this.lastQuery = null;
    // 触发时记录的光标标签，供补全定位使用。
    this.pendingTag = null;
    // window 捕获阶段 keydown 监听器引用。
    this.keydownHandler = null;
    // 最近一次触发时保存的活动编辑器，供 Tab 确认补全时稳健定位。
    this.activeEditor = null;
  }

  /**
   * 日志辅助方法（调试用，前缀统一便于筛选）。
   * @param {Array} args 日志内容
   */
  log(...args) {
    console.log('[自动补全]', ...args);
  }

  /**
   * 启用自动补全（状态栏开关打开时调用）。
   * 同时注册 window 捕获阶段 keydown 监听，用于 Tab 确认与抑制解除。
   *
   * 注意：必须挂在 window 捕获阶段。Obsidian 对建议弹窗的方向键拦截
   * （方向键用于选择建议）发生在 document 捕获阶段，若我们挂在 document
   * 会因注册顺序靠后而收不到方向键事件，导致光标无法移动。
   */
  enable() {
    this.enabled = true;
    // 重新启用时清除抑制标记，避免补全功能"卡死"。
    this.suppressUntilTyping = false;
    this.log('启用自动补全');
    if (!this.keydownHandler) {
      this.keydownHandler = this.onDocumentKeyDown.bind(this);
      window.addEventListener('keydown', this.keydownHandler, true);
    }
  }

  /**
   * 停用自动补全（状态栏开关关闭时调用）。
   * 关闭当前提示框并移除 keydown 监听。
   */
  disable() {
    this.enabled = false;
    this.log('停用自动补全');
    if (this.isOpenFlag) {
      this.close('停用');
    }
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler, true);
      this.keydownHandler = null;
    }
  }

  /**
   * 设置粘贴后一次性触发标记。
   * 由 runtime 在粘贴事件中调用（仅在开启"粘贴行为的自动补全"时）。
   */
  setPasteAutoCloseFlag() {
    this.allowPasteAutoClose = true;
    this.log('粘贴事件：设置"粘贴自动补全"放行标记');
  }

  /**
   * 设置粘贴抑制位置。
   * 由 runtime 在粘贴事件中调用（仅在关闭"粘贴行为的自动补全"时）。
   * 光标停留在该位置时不再触发补全，移离后自动解除。
   * @param {object|null} pos 光标位置 { line, ch }
   */
  setPasteSuppressPos(pos) {
    this.pasteSuppressPos = pos;
    this.log('粘贴事件：设置粘贴抑制位置', JSON.stringify(pos));
  }

  /**
   * 获取最近一次触发时保存的活动编辑器（供 runtime 计算粘贴落点）。
   * @returns {object|null} CodeMirror 编辑器实例
   */
  getActiveEditor() {
    return this.activeEditor;
  }

  /**
   * 覆盖 close，维护提示框打开状态。
   * @param {string} reason 关闭原因（日志用）
   */
  close(reason) {
    this.log('提示框关闭 | 原因:', reason || '系统触发', '（isOpenFlag=' + this.isOpenFlag + '）');
    this.isOpenFlag = false;
    this.pendingTag = null;
    super.close();
  }

  /**
   * 覆盖打开逻辑：由 Obsidian 生命周期调用，同步维护打开状态标记。
   */
  open() {
    this.log('提示框打开 | 建议:', this.lastQuery || '(未知)');
    this.isOpenFlag = true;
    super.open();
  }

  /**
   * 触发检测：判断是否应当弹出补全提示。
   * @param {object} cursor 编辑器光标
   * @param {object} editor CodeMirror 编辑器实例
   * @returns {object|null} 触发信息，不触发时返回 null
   */
  onTrigger(cursor, editor) {
    const settings = this.store.getSettings();
    const pos = cursor ? cursor.line + ':' + cursor.ch : 'null';
    // 统一"拦截"出口：记录不触发原因。
    const fail = (reason) => {
      this.log('检测 光标=' + pos, '→ 不触发 |', reason);
      return null;
    };

    // 状态栏开关关闭时不触发。
    if (!this.enabled) return fail('状态栏开关关闭');
    if (!cursor || cursor.ch === 0) return fail('光标在行首或无光标');

    this.activeEditor = editor;
    const line = editor.getLine(cursor.line);
    // 仅在刚输入完 '>' 时触发（粘贴的完整标签末尾同样是 '>'）。
    if (line[cursor.ch - 1] !== '>') {
      return fail('光标前一字符是"' + (line[cursor.ch - 1] || '') + '"而非">"');
    }

    // 粘贴标志为一次性，读取后立即清除。
    const pasteFlag = this.allowPasteAutoClose;
    this.allowPasteAutoClose = false;

    // 粘贴抑制：光标仍停留在粘贴落点时（粘贴后未移动），不触发补全。
    // 若光标已移离粘贴落点（方向键或鼠标），解除粘贴抑制，允许移回后再次触发。
    if (this.pasteSuppressPos) {
      const same = cursor.line === this.pasteSuppressPos.line && cursor.ch === this.pasteSuppressPos.ch;
      this.log('检测 光标=' + pos, '粘贴抑制位置=' + JSON.stringify(this.pasteSuppressPos),
        '同位置=' + same, '放行标记=' + pasteFlag);
      if (same) {
        if (!pasteFlag) return fail('粘贴抑制生效（光标仍在粘贴落点）');
        this.pasteSuppressPos = null;
      } else {
        this.pasteSuppressPos = null;
        this.log('检测 光标=' + pos, '→ 解除粘贴抑制（光标已移离粘贴落点）');
      }
    }

    // 补全后抑制期间：若光标已移离补全时的位置（无论通过何种方式），解除抑制。
    if (this.suppressUntilTyping) {
      const same = this.suppressCursor &&
        cursor.line === this.suppressCursor.line && cursor.ch === this.suppressCursor.ch;
      this.log('检测 光标=' + pos, '补全后抑制中 抑制位置=' + JSON.stringify(this.suppressCursor),
        '同位置=' + same, '放行标记=' + pasteFlag);
      if (this.suppressCursor && !same) {
        this.suppressUntilTyping = false;
        this.suppressCursor = null;
        this.log('检测 光标=' + pos, '→ 解除补全后抑制（光标已移离补全落点）');
      } else if (!pasteFlag) {
        return fail('补全后抑制中（光标未移离补全落点）');
      }
    }

    const tag = cursorTag(cursor, editor, false);
    if (!tag) return fail('无法解析光标所在标签');

    // 闭标签、单标签、排除标签不触发。
    if (tag.isClosing) return fail('光标在闭标签 </' + tag.name + '> 内');
    if (isSingleTag(tag)) return fail('单标签 <' + tag.name + '> 不触发');
    if (isTagExcluded(settings.excludedTags, tag.name)) return fail('标签 <' + tag.name + '> 在排除列表中');

    // 代码块/行内代码内的标签不触发。
    if (settings.ignoreInCodeBlocks && isInFencedCodeBlock(editor, cursor.line)) return fail('位于代码块内');
    if (settings.ignoreInlineCode && isInInlineCode(line, cursor.ch)) return fail('位于行内代码内');

    // 检测是否应触发自动补全（支持嵌套同名标签场景）。
    if (!shouldAutoClose(editor, tag, {
      ignoreInCodeBlocks: settings.ignoreInCodeBlocks,
      ignoreInlineCode: settings.ignoreInlineCode,
      excludedTags: settings.excludedTags
    })) return fail('已存在配对闭标签，不重复补全');

    const closingTag = '</' + tag.name + '>';
    this.lastQuery = closingTag;
    this.pendingTag = tag;
    // 兜底标记：不同 Obsidian 版本对 EditorSuggest 的 open() 调用时机存在差异，
    // 此处直接视为"将弹出提示框"，供 Tab 确认与方向键放行逻辑判断。
    this.isOpenFlag = true;
    this.log('检测 光标=' + pos, '标签=<' + tag.name + '> → 触发补全 | 建议:', closingTag);

    return {
      start: { line: cursor.line, ch: cursor.ch },
      end: { line: cursor.line, ch: cursor.ch },
      query: closingTag
    };
  }

  /**
   * 提供补全建议列表（唯一建议）。
   * @param {object} context 建议上下文
   * @returns {Array<string>} 建议列表
   */
  getSuggestions(context) {
    return context.query ? [context.query] : [];
  }

  /**
   * 渲染建议条目。
   * @param {string} suggestion 建议文本
   * @param {HTMLElement} el 建议条目元素
   */
  renderSuggestion(suggestion, el) {
    el.setText(suggestion);
  }

  /**
   * 确认补全：在开始标签之后插入闭合标签，并按光标位置设置落点。
   * @param {string} suggestion 建议文本
   */
  selectSuggestion(suggestion) {
    if (!suggestion || !this.pendingTag) {
      this.log('补全被拒绝 | 原因: 缺少建议文本或待补全标签（suggestion=' + suggestion + ' pendingTag=' + !!this.pendingTag + '）');
      return;
    }
    const editor = this.activeEditor || (this.context && this.context.editor);
    if (!editor) {
      this.log('补全被拒绝 | 原因: 无法定位编辑器');
      return;
    }
    const settings = this.store.getSettings();
    const insertPos = {
      line: this.pendingTag.line,
      ch: this.pendingTag.index + this.pendingTag.length
    };

    editor.replaceRange(suggestion, insertPos, insertPos);

    if (settings.cursorPosition === 'after') {
      // 光标落在闭合标签之后。
      editor.setCursor({ line: insertPos.line, ch: insertPos.ch + suggestion.length });
    } else {
      // 默认：光标保持在开始标签与闭合标签之间。
      editor.setCursor(insertPos);
    }

    // 补全后进入抑制状态，避免光标停留标签内部时反复弹出提示。
    // 同时记录抑制时的光标位置，以便后续通过鼠标等非键盘方式移动光标后自动解除抑制。
    this.suppressUntilTyping = true;
    this.suppressCursor = { line: insertPos.line, ch: insertPos.ch };
    if (settings.cursorPosition === 'after') {
      this.suppressCursor = { line: insertPos.line, ch: insertPos.ch + suggestion.length };
    }
    this.isOpenFlag = false;
    this.pendingTag = null;
    this.log('补全被采用 | 建议:', suggestion, '插入点=' + insertPos.line + ':' + insertPos.ch,
      '光标落点=' + this.suppressCursor.line + ':' + this.suppressCursor.ch, '→ 进入补全后抑制');
  }

  /**
   * 手动移动光标（仅当 Obsidian 拦截方向键导致光标未移动时兜底使用）。
   * 移动规则与 CodeMirror 默认方向键行为保持一致：
   *  - 上下键：跨行移动，列号保持（超出目标行长度时截断）
   *  - 左右键：仅在同一行内移动，行首/行尾不跨行
   * @param {object} editor CodeMirror 编辑器实例
   * @param {string} key 方向键名称（ArrowUp/ArrowDown/ArrowLeft/ArrowRight）
   */
  moveCursorByKey(editor, key) {
    const cursor = editor.getCursor();
    const lineCount = editor.lineCount();
    if (key === 'ArrowUp') {
      if (cursor.line > 0) {
        const prevLen = editor.getLine(cursor.line - 1).length;
        editor.setCursor({ line: cursor.line - 1, ch: Math.min(cursor.ch, prevLen) });
      }
    } else if (key === 'ArrowDown') {
      if (cursor.line < lineCount - 1) {
        const nextLen = editor.getLine(cursor.line + 1).length;
        editor.setCursor({ line: cursor.line + 1, ch: Math.min(cursor.ch, nextLen) });
      }
    } else if (key === 'ArrowLeft') {
      if (cursor.ch > 0) {
        editor.setCursor({ line: cursor.line, ch: cursor.ch - 1 });
      }
    } else if (key === 'ArrowRight') {
      const curLen = editor.getLine(cursor.line).length;
      if (cursor.ch < curLen) {
        editor.setCursor({ line: cursor.line, ch: cursor.ch + 1 });
      }
    }
  }

  /**
   * window 捕获阶段 keydown 处理器：
   *  - 方向键：提示框打开时先关闭提示框，再放行事件让 CodeMirror 正常移动光标
   *    （不拦截、不重复手动移动，避免光标双跳）；若 Obsidian 在建议关闭后
   *    仍拦截方向键导致光标未移动，则兜底手动移动一次。
   *  - 方向键同时解除补全后抑制与粘贴抑制，保证"移回 `>` 右邻即可再次弹出提示框"。
   *  - 解除抑制：非控制类按键的实际键入后允许再次触发补全
   *  - Tab 键：确认当前补全
   * @param {KeyboardEvent} evt 键盘事件
   */
  onDocumentKeyDown(evt) {
    // 方向键：提示框打开时先关闭提示框并放行事件，让光标正常移动。
    if (evt.key.startsWith('Arrow')) {
      this.log('按键', evt.key, '| 提示框打开=' + this.isOpenFlag);
      if (this.isOpenFlag) {
        // 先关闭本建议器，再同步关闭 Obsidian 全局建议管理器，
        // 确保其"方向键选择建议"的键盘拦截立即释放。
        this.close('方向键移动');
        const manager = (this.plugin.app && this.plugin.app.workspace && this.plugin.app.workspace.editorSuggest) ||
          (this.plugin.app && this.plugin.app.editorSuggest);
        if (manager && typeof manager.close === 'function') {
          manager.close();
        }
        // 兜底：若 Obsidian/CodeMirror 在建议关闭后仍拦截方向键导致光标未移动，
        // 则手动移动一次光标（已移动时跳过，避免双跳）。
        const editor = this.activeEditor;
        const before = editor ? editor.getCursor() : null;
        const key = evt.key;
        setTimeout(() => {
          if (!this.enabled || !editor || !before) return;
          const after = editor.getCursor();
          if (after.line === before.line && after.ch === before.ch) {
            this.moveCursorByKey(editor, key);
            this.log('按键', key, '| 兜底手动移动光标');
          }
        }, 0);
      }
      // 方向键视为主动移动光标：解除补全后抑制与粘贴抑制，
      // 保证"移回 `>` 右邻即可再次弹出提示框"。
      if (this.suppressUntilTyping || this.suppressCursor || this.pasteSuppressPos) {
        this.log('按键', evt.key, '| 解除抑制（补全后抑制=' + this.suppressUntilTyping + ' 粘贴抑制=' + !!this.pasteSuppressPos + '）');
      }
      this.suppressUntilTyping = false;
      this.suppressCursor = null;
      this.pasteSuppressPos = null;
      return;
    }

    // 可打印字符（非方向键、非控制键）视为实际键入，解除抑制。
    if (evt.key.length === 1 && !evt.ctrlKey && !evt.metaKey && !evt.altKey) {
      if (this.suppressUntilTyping) {
        this.log('按键', JSON.stringify(evt.key), '| 键入字符，解除补全后抑制');
      }
      this.suppressUntilTyping = false;
      this.suppressCursor = null;
    }

    // 提示框打开时，Tab 键完成补全。
    if (evt.key === 'Tab' && this.isOpenFlag && this.lastQuery) {
      this.log('按键 Tab | 采用补全:', this.lastQuery);
      evt.preventDefault();
      evt.stopImmediatePropagation();
      this.selectSuggestion(this.lastQuery);
      this.close('Tab 采用');
    }
  }
}

module.exports = {
  EditorEnhancerSuggest
};
