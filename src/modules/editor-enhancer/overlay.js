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
 * 自建 HTML 标签闭合补全浮层。
 *
 * 替代 Obsidian EditorSuggest（官方建议框对方向键占用、关闭后无法重新触发、
 * 鼠标移动不触发等行为不可控，实测无法满足需求）：
 *  - 自绘绝对定位浮层，仅展示 "</tag>" 单条建议，样式跟随 Obsidian 主题
 *  - 触发驱动：Obsidian editor-change 事件（击键、方向键移动、粘贴时触发）
 *    + 编辑器 DOM pointerup（覆盖鼠标点击移动光标）
 *  - 方向键完全不拦截：浮层只负责显示，上下左右光标自由移动；光标移开后浮层
 *    关闭，移回 `>` 右邻时自动重新检测并弹出
 *  - 补全后抑制、粘贴抑制均为"位置相关"：光标移离抑制位置即解除，移回可再触发
 *  - Tab 采用补全，Esc 关闭浮层
 *  - 单标签（<hr>/<br>/<img> 及自闭合形式）不触发补全
 */
class AutoCloseOverlay {
  /**
   * 构造函数。
   * @param {object} plugin 宿主插件实例
   * @param {object} store EditorEnhancerStore 实例
   */
  constructor(plugin, store) {
    this.plugin = plugin;
    this.store = store;

    // 自动补全总开关（状态栏按钮控制）。
    this.enabled = false;
    // 补全后抑制标记：为 true 时不再触发补全提示。
    this.suppressUntilTyping = false;
    // 补全后抑制发生时记录的光标位置，用于检测光标是否已移离。
    this.suppressCursor = null;
    // 粘贴后一次性触发标记（开启"粘贴行为的自动补全"时使用）。
    this.allowPasteAutoClose = false;
    // 粘贴抑制位置（关闭"粘贴行为的自动补全"时使用）。
    this.pasteSuppressPos = null;
    // 浮层是否显示中。
    this.visible = false;
    // 最近一次触发时的补全文本与标签。
    this.lastQuery = null;
    this.pendingTag = null;
    // 最近一次检测时保存的活动编辑器。
    this.activeEditor = null;

    // 监听器引用（便于 enable/disable 反复切换时安全移除）。
    this.editorChangeHandler = null;
    this.keydownHandler = null;
    this.pointerUpHandler = null;
    // 方向键兜底重检：方向键移动光标后，editor-change 并非总是广播
    // （实测光标移回 `>` 右邻时偶有缺失），以此为标记区分消费方。
    this.pendingRecheck = false;
    this.recheckTimer = null;
    // 浮层 DOM 元素。
    this.overlayEl = null;
    this.overlayItemEl = null;
  }

  /**
   * 日志辅助方法（调试用，前缀统一便于筛选）。
   * @param {Array} args 日志内容
   */
  log(...args) {
    console.log('[自动补全]', ...args);
  }

  /**
   * 启用自动补全浮层（状态栏开关打开时调用）。
   * 注册 editor-change / keydown / pointerup 监听。
   */
  enable() {
    this.enabled = true;
    // 重新启用时清除抑制标记，避免补全功能"卡死"。
    this.suppressUntilTyping = false;
    this.log('启用自动补全浮层');

    if (!this.editorChangeHandler) {
      this.editorChangeHandler = (editor) => this.onEditorEvent(editor);
      this.plugin.app.workspace.on('editor-change', this.editorChangeHandler);
    }
    if (!this.keydownHandler) {
      this.keydownHandler = this.onDocumentKeyDown.bind(this);
      window.addEventListener('keydown', this.keydownHandler, true);
    }
    if (!this.pointerUpHandler) {
      this.pointerUpHandler = (evt) => this.onPointerUp(evt);
      document.addEventListener('pointerup', this.pointerUpHandler, true);
    }
  }

  /**
   * 停用自动补全浮层（状态栏开关关闭时调用）。
   * 移除监听并隐藏浮层（保留 DOM，便于快速重新启用）。
   */
  disable() {
    this.enabled = false;
    this.log('停用自动补全浮层');
    if (this.editorChangeHandler) {
      this.plugin.app.workspace.off('editor-change', this.editorChangeHandler);
      this.editorChangeHandler = null;
    }
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler, true);
      this.keydownHandler = null;
    }
    if (this.pointerUpHandler) {
      document.removeEventListener('pointerup', this.pointerUpHandler, true);
      this.pointerUpHandler = null;
    }
    // 停用后取消挂起的兜底重检。
    this.cancelRecheck();
    this.hide('停用');
  }

  /**
   * 完全清理浮层（模块禁用/插件卸载时调用）：停用监听并移除 DOM。
   */
  destroy() {
    this.disable();
    if (this.overlayEl && this.overlayEl.parentNode) {
      this.overlayEl.parentNode.removeChild(this.overlayEl);
    }
    this.overlayEl = null;
    this.overlayItemEl = null;
  }

  /**
   * 设置粘贴后一次性触发标记（开启"粘贴行为的自动补全"时由 runtime 调用）。
   */
  setPasteAutoCloseFlag() {
    this.allowPasteAutoClose = true;
    this.log('粘贴事件：设置"粘贴自动补全"放行标记');
  }

  /**
   * 设置粘贴抑制位置（关闭"粘贴行为的自动补全"时由 runtime 调用）。
   * @param {object|null} pos 光标位置 { line, ch }
   */
  setPasteSuppressPos(pos) {
    this.pasteSuppressPos = pos;
    this.log('粘贴事件：设置粘贴抑制位置', JSON.stringify(pos));
  }

  /**
   * 获取最近一次检测时保存的活动编辑器（供 runtime 计算粘贴落点）。
   * @returns {object|null} CodeMirror 编辑器实例
   */
  getActiveEditor() {
    return this.activeEditor;
  }

  /**
   * 获取当前活动 Markdown 编辑器的编辑器实例。
   * @returns {object|null} CodeMirror 编辑器实例
   */
  getActiveEditorFromWorkspace() {
    try {
      const view = this.plugin.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
      return view ? view.editor : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * editor-change 回调：每次编辑器内容/光标变化时触发检测。
   * 整体 try/catch 保护：不将异常冒泡到 Obsidian 事件分发链，
   * 避免影响其他同样监听 editor-change 事件的模块。
   * @param {object} editor CodeMirror 编辑器实例
   */
  onEditorEvent(editor) {
    try {
      this.onEditorEventInternal(editor);
    } catch (error) {
      this.log('editor-change 处理异常（已隔离，不影响其他模块）', error);
    }
  }

  // editor-change 实际处理逻辑（供 onEditorEvent 的异常隔离外壳调用）。
  onEditorEventInternal(editor) {
    if (!this.enabled || !editor) return;
    // 仅处理活动编辑器（避免后台叶子触发误判）。
    const active = this.getActiveEditorFromWorkspace();
    if (active !== editor) return;

    // 方向键兜底重检标记由 editor-change 消费：既然已走到此处，
    // 说明光标移动已广播 editor-change，取消挂起的兜底定时器。
    this.cancelRecheck();

    this.activeEditor = editor;
    const cursor = editor.getCursor();
    const closingTag = this.evaluate(editor, cursor);
    if (closingTag) {
      this.show(editor, cursor);
    } else {
      this.hide();
    }
  }

  /**
   * 取消挂起的兜底重检定时器并清除标记。
   */
  cancelRecheck() {
    if (this.recheckTimer) {
      clearTimeout(this.recheckTimer);
      this.recheckTimer = null;
    }
    this.pendingRecheck = false;
  }

  /**
   * 调度方向键兜底重检：方向键移动光标后若 editor-change 未广播，
   * 则由本定时器在宏任务阶段主动检测一次，确保光标移回 `>` 右邻时可重新触发。
   * editor-change 同步先于定时器执行时会消费标记，此处自动跳过。
   */
  scheduleRecheck() {
    this.pendingRecheck = true;
    if (this.recheckTimer) {
      clearTimeout(this.recheckTimer);
    }
    this.recheckTimer = setTimeout(() => {
      this.recheckTimer = null;
      if (!this.enabled || !this.pendingRecheck) return;
      this.pendingRecheck = false;
      const editor = this.getActiveEditorFromWorkspace();
      if (!editor) return;
      this.log('方向键兜底重检（editor-change 未广播，主动检测光标位置）');
      this.onEditorEventInternal(editor);
    }, 0);
  }

  /**
   * pointerup 兜底：
   *  - 点击目标位于编辑器 DOM 内时重新检测（鼠标移动光标后触发）。
   *  - 点击目标位于编辑器外部时隐藏浮层，避免浮层残留及后续键盘误拦截。
   * 仅读取与隐藏，不拦截事件，不影响其他模块的鼠标处理。
   * @param {PointerEvent} evt 指针事件
   */
  onPointerUp(evt) {
    if (!this.enabled) return;
    const editor = this.getActiveEditorFromWorkspace();
    if (!editor || !editor.cm || !editor.cm.dom) {
      this.hide('点击在编辑器外部（无法定位编辑器）');
      return;
    }
    if (editor.cm.dom.contains(evt.target)) {
      this.log('鼠标点击：光标可能已移动，重新检测');
      this.onEditorEvent(editor);
      return;
    }
    // 点击编辑器 DOM 之外（其他输入框、设置页等）：关闭浮层，解除抑制，完全放行事件。
    this.hide('点击在编辑器外部');
    this.suppressUntilTyping = false;
    this.suppressCursor = null;
    this.pasteSuppressPos = null;
  }

  /**
   * 触发检测：判断是否应当显示补全浮层。
   * @param {object} editor CodeMirror 编辑器实例
   * @param {object} cursor 编辑器光标
   * @returns {string|null} 补全文本，不触发时返回 null
   */
  evaluate(editor, cursor) {
    const settings = this.store.getSettings();
    const pos = cursor ? cursor.line + ':' + cursor.ch : 'null';
    // 统一"拦截"出口：记录不触发原因。
    const fail = (reason) => {
      this.log('检测 光标=' + pos, '→ 不触发 |', reason);
      return null;
    };

    if (!cursor || cursor.ch === 0) return fail('光标在行首或无光标');

    const line = editor.getLine(cursor.line);
    // 仅在光标前一字符为 '>' 时检测（手动输入的标签或粘贴的完整标签末尾）。
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
    this.log('检测 光标=' + pos, '标签=<' + tag.name + '> → 触发补全 | 建议:', closingTag);
    return closingTag;
  }

  /**
   * 确保浮层 DOM 已创建并挂载。
   */
  ensureEl() {
    if (this.overlayEl) return;
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'nene-autoclose-suggest';
    this.overlayItemEl = document.createElement('div');
    this.overlayItemEl.className = 'nene-autoclose-suggest-item';
    this.overlayEl.appendChild(this.overlayItemEl);
    document.body.appendChild(this.overlayEl);
  }

  /**
   * 显示补全浮层并定位到光标附近。
   * @param {object} editor CodeMirror 编辑器实例
   * @param {object} cursor 编辑器光标
   */
  show(editor, cursor) {
    if (!this.visible) {
      this.ensureEl();
      this.overlayItemEl.setText(this.lastQuery || '');
      this.visible = true;
      this.log('提示框显示 | 建议:', this.lastQuery || '(未知)');
    }
    this.updatePosition(editor, cursor);
    this.overlayEl.style.display = 'flex';
  }

  /**
   * 隐藏补全浮层。
   * @param {string} reason 关闭原因（日志用）
   */
  hide(reason) {
    if (!this.visible && !reason) return;
    if (this.visible) {
      this.log('提示框隐藏 | 原因:', reason || '自动隐藏');
    }
    this.visible = false;
    this.pendingTag = null;
    if (this.overlayEl) {
      this.overlayEl.style.display = 'none';
    }
  }

  /**
   * 依据光标像素坐标更新浮层位置（fixed 定位，坐标取自 CodeMirror coordsAtPos）。
   * @param {object} editor CodeMirror 编辑器实例
   * @param {object} cursor 编辑器光标
   */
  updatePosition(editor, cursor) {
    const cm = editor.cm;
    if (!cm || typeof cm.coordsAtPos !== 'function') return;
    let offset = null;
    if (typeof editor.posToOffset === 'function') {
      offset = editor.posToOffset(cursor);
    }
    if (offset === null || offset === undefined) return;
    const coords = cm.coordsAtPos(offset);
    if (!coords) return;
    this.overlayEl.style.left = coords.left + 'px';
    this.overlayEl.style.top = (coords.bottom + 6) + 'px';
  }

  /**
   * 采用补全：在开始标签之后插入闭合标签，并按光标位置设置落点。
   */
  apply() {
    if (!this.lastQuery || !this.pendingTag) {
      this.log('补全被拒绝 | 原因: 缺少补全文本或待补全标签');
      return;
    }
    const editor = this.activeEditor;
    if (!editor || !editor.cm || typeof editor.replaceRange !== 'function') {
      this.log('补全被拒绝 | 原因: 无法定位编辑器或编辑器已失效');
      return;
    }
    const settings = this.store.getSettings();
    const insertPos = {
      line: this.pendingTag.line,
      ch: this.pendingTag.index + this.pendingTag.length
    };

    editor.replaceRange(this.lastQuery, insertPos, insertPos);

    if (settings.cursorPosition === 'after') {
      // 光标落在闭合标签之后。
      editor.setCursor({ line: insertPos.line, ch: insertPos.ch + this.lastQuery.length });
    } else {
      // 默认：光标保持在开始标签与闭合标签之间。
      editor.setCursor(insertPos);
    }

    // 补全后进入抑制状态，避免光标停留标签内部时反复弹出提示。
    // 同时记录抑制时的光标位置，以便后续通过鼠标等非键盘方式移动光标后自动解除抑制。
    this.suppressUntilTyping = true;
    this.suppressCursor = { line: insertPos.line, ch: insertPos.ch };
    if (settings.cursorPosition === 'after') {
      this.suppressCursor = { line: insertPos.line, ch: insertPos.ch + this.lastQuery.length };
    }
    this.log('补全被采用 | 建议:', this.lastQuery,
      '插入点=' + insertPos.line + ':' + insertPos.ch,
      '光标落点=' + this.suppressCursor.line + ':' + this.suppressCursor.ch,
      '→ 进入补全后抑制');
    this.hide('补全采用');
    this.lastQuery = null;
  }

  /**
   * window 捕获阶段 keydown 处理器：
   *  - 方向键：浮层完全不拦截，仅隐藏浮层并解除抑制，事件放行让光标正常移动；
   *    移回 `>` 右邻时由 editor-change 触发重新检测。
   *  - 可打印字符：解除补全后抑制。
   *  - Tab 键：仅当焦点仍在活动编辑器内且浮层显示时采用补全；焦点移出编辑器
   *    （搜索框、设置页等）则完全放行，避免干涉其他输入框的 Tab 行为。
   *  - Esc 键：仅当焦点仍在活动编辑器内时关闭浮层。
   * 整体 try/catch 保护：不将异常冒泡到 window 捕获阶段的监听链。
   * @param {KeyboardEvent} evt 键盘事件
   */
  onDocumentKeyDown(evt) {
    try {
      this.onDocumentKeyDownInternal(evt);
    } catch (error) {
      this.log('keydown 处理异常（已隔离，不影响其他模块）', error);
    }
  }

  // window 捕获阶段 keydown 实际处理逻辑（供异常隔离外壳调用）。
  onDocumentKeyDownInternal(evt) {
    // 方向键：仅隐藏浮层 + 解除抑制，不拦截事件（光标自由移动）。
    if (evt.key.startsWith('Arrow')) {
      this.log('按键', evt.key, '| 方向键移动（visible=' + this.visible +
        ' 补全后抑制=' + this.suppressUntilTyping + ' 粘贴抑制=' + !!this.pasteSuppressPos + '）');
      if (this.visible) {
        this.hide('方向键移动');
      }
      this.suppressUntilTyping = false;
      this.suppressCursor = null;
      this.pasteSuppressPos = null;
      // 调度兜底重检：光标移动后 editor-change 并非总是广播，
      // 由 scheduleRecheck 在宏任务阶段兜底，确保移回 `>` 右邻时可重新触发。
      this.scheduleRecheck();
      return;
    }

    // 可打印字符（非方向键、非控制键）视为实际键入，解除补全后抑制。
    if (evt.key.length === 1 && !evt.ctrlKey && !evt.metaKey && !evt.altKey) {
      if (this.suppressUntilTyping) {
        this.log('按键', JSON.stringify(evt.key), '| 键入字符，解除补全后抑制');
      }
      this.suppressUntilTyping = false;
      this.suppressCursor = null;
    }

    // 仅当焦点仍在活动编辑器内时才拦截 Tab/Esc，避免干涉其他输入框。
    const editor = this.getActiveEditorFromWorkspace();
    const focusInEditor = !!(editor && editor.cm && editor.cm.dom && evt.target instanceof Node &&
      editor.cm.dom.contains(evt.target));

    // 提示框显示时，Tab 键采用补全（焦点在编辑器内才拦截）。
    if (evt.key === 'Tab' && this.visible && this.lastQuery && focusInEditor) {
      this.log('按键 Tab | 采用补全:', this.lastQuery);
      evt.preventDefault();
      evt.stopImmediatePropagation();
      this.apply();
      return;
    }

    // Esc 键关闭浮层（焦点在编辑器内才拦截；其他输入框的 Esc 完全放行）。
    if (evt.key === 'Escape' && this.visible && focusInEditor) {
      this.log('按键 Esc | 关闭浮层');
      evt.preventDefault();
      evt.stopImmediatePropagation();
      this.hide('Esc');
    }
  }
}

module.exports = {
  AutoCloseOverlay
};
