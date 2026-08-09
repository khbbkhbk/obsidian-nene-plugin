'use strict';

/**
 * 同步更新匹配标签命令的交互组件：
 *  - TagNameEditor：在光标右下角弹出标签名编辑输入框，负责输入校验、红色错误提示、
 *    Enter 提交 / Esc 退出 / 点击外部退出。
 *  - SingleTagConfirmModal：输入以 "/" 结尾（转单标签）时的二次确认弹窗。
 */

const obsidian = require('obsidian');

// 输入框下方红色小字提示文案。
const ERROR_EMPTY_NAME = '标签名不能为空';
const ERROR_INVALID_NAME = '标签名仅支持字母，斜杠只能出现在结尾';
// 二次确认弹窗标题。
const CONFIRM_TITLE = '转换为单标签';

// 合法输入正则：大小写字母，可选一个结尾斜杠（斜杠最多一次且必须在结尾）。
const VALID_INPUT_PATTERN = /^[a-zA-Z]+(?:\/)?$/;

class TagNameEditor {
  /**
   * @param {Object} app Obsidian App 实例，用于二次确认弹窗。
   */
  constructor(app) {
    this.app = app;
    this.el = null;
    this.inputEl = null;
    this.errorEl = null;
    this.options = null;
    this.documentPointerHandler = null;
    // 二次确认弹窗期间编辑器内的高亮标记（markText 实例集合）。
    this.marks = [];
    this.valid = false;
  }

  /**
   * 打开编辑输入框。
   * @param {Object} options
   *   anchorCoords:    光标像素坐标 { left, top, bottom }，输入框定位在光标右下角。
   *   initialName:     当前标签名（不含 "/"）。
   *   editor:          当前 CodeMirror 编辑器实例（用于转单标签二次确认时的高亮）。
   *   highlightRanges: 高亮范围数组 [{ from: {line, ch}, to: {line, ch} }]，弹出二次确认窗口时应用。
   *   onCommit:        (newName, isSingleTag) => void，回车确认后回调，newName 已统一小写。
   *   onCancel:        () => void，Esc / 点击外部退出时回调。
   */
  open(options) {
    this.close();
    this.options = options || {};
    this.buildDom();
    this.position(options.anchorCoords);
    this.inputEl.value = options.initialName || '';
    this.validate();
    this.inputEl.focus();
    this.inputEl.select();
  }

  /**
   * 构建输入框 DOM 并绑定事件。
   */
  buildDom() {
    this.el = document.createElement('div');
    this.el.className = 'nene-tag-name-editor';

    this.inputEl = document.createElement('input');
    this.inputEl.type = 'text';
    this.inputEl.spellcheck = false;
    this.inputEl.autocomplete = 'off';
    this.inputEl.placeholder = '标签名';

    this.errorEl = document.createElement('div');
    this.errorEl.className = 'nene-tag-name-editor-error';

    this.el.appendChild(this.inputEl);
    this.el.appendChild(this.errorEl);
    document.body.appendChild(this.el);

    // 输入即校验：合法输入保持焦点，非法输入显示红字并禁用 Enter。
    this.inputEl.addEventListener('input', () => this.validate());
    this.inputEl.addEventListener('keydown', (evt) => this.onKeyDown(evt));

    // 点击输入框之外的区域视为退出（捕获阶段，保证优先于编辑器事件）。
    this.documentPointerHandler = (evt) => {
      if (this.el && evt.target instanceof Node && this.el.contains(evt.target)) {
        return;
      }
      this.cancel();
    };
    document.addEventListener('pointerdown', this.documentPointerHandler, true);
  }

  /**
   * 将输入框定位到光标像素坐标的右下角。
   */
  position(coords) {
    if (!coords || !this.el) {
      return;
    }
    const top = typeof coords.bottom === 'number' ? coords.bottom : coords.top;
    this.el.style.left = coords.left + 'px';
    this.el.style.top = (top + 6) + 'px';
  }

  /**
   * 校验当前输入内容：非法时显示红色小字提示。
   * @returns {boolean} 输入是否合法（合法才允许 Enter 提交）。
   */
  validate() {
    const raw = this.inputEl.value;
    let message = null;
    if (raw.length === 0) {
      message = ERROR_EMPTY_NAME;
    } else if (!VALID_INPUT_PATTERN.test(raw)) {
      message = ERROR_INVALID_NAME;
    }
    this.valid = message === null;
    this.errorEl.textContent = message || '';
    this.errorEl.classList.toggle('show', message !== null);
    return this.valid;
  }

  /**
   * 输入框按键处理：Esc 退出，Enter 提交（非法输入时禁用）。
   */
  onKeyDown(evt) {
    if (evt.key === 'Escape') {
      evt.preventDefault();
      evt.stopImmediatePropagation();
      this.cancel();
      return;
    }
    if (evt.key === 'Enter') {
      evt.preventDefault();
      evt.stopImmediatePropagation();
      this.confirm();
    }
  }

  /**
   * 回车确认：非法输入直接忽略；以 "/" 结尾时先触发二次确认。
   */
  confirm() {
    if (!this.validate()) {
      return;
    }
    const raw = this.inputEl.value;
    const isSingleTag = raw.endsWith('/');
    const newName = (isSingleTag ? raw.slice(0, -1) : raw).toLowerCase();
    if (isSingleTag) {
      this.askSingleTagConfirm(newName);
    } else {
      this.commit(newName, false);
    }
  }

  /**
   * 转单标签二次确认：
   *  - 弹窗期间在编辑器中高亮当前标签与其匹配标签，突出待操作范围；
   *  - 临时停用"点击外部退出"，避免点击弹窗按钮时误触发输入框取消；
   *  - 确认后提交，取消 / Esc 则清除高亮并回到输入框继续编辑。
   */
  askSingleTagConfirm(newName) {
    const self = this;
    // 弹出二次确认窗口前应用高亮（先清理旧标记，避免重复叠加）。
    this.applyHighlight();
    // 弹窗期间临时移除输入框的"点击外部退出"监听，Modal 关闭后恢复。
    this.suspendPointerHandler();
    const modal = new SingleTagConfirmModal(this.app, {
      newName,
      onConfirm() {
        self.commit(newName, true);
      },
      onCancel() {
        self.refocusInput();
      }
    });
    // 无论确认 / 取消 / Esc 关闭弹窗：清除高亮、恢复点击外部退出监听、焦点回到输入框。
    const originalOnClose = modal.onClose.bind(modal);
    modal.onClose = () => {
      originalOnClose();
      self.clearHighlight();
      self.resumePointerHandler();
      self.refocusInput();
    };
    modal.open();
  }

  /**
   * 在编辑器中标记待同步的标签范围（markText 高亮）。
   * 范围数据取自 open() 时传入的 options.editor 与 options.highlightRanges。
   */
  applyHighlight() {
    this.clearHighlight();
    const options = this.options || {};
    const editor = options.editor;
    const ranges = options.highlightRanges;
    if (!editor || !editor.cm || typeof editor.cm.markText !== 'function' || !Array.isArray(ranges) || !ranges.length) {
      return;
    }
    for (const range of ranges) {
      if (!range || !range.from || !range.to) continue;
      try {
        // CodeMirror 6（Obsidian 当前版本）的 markText 装饰字段为 class，而非 CM5 的 className。
        this.marks.push(editor.cm.markText(range.from, range.to, { class: 'nene-sync-tag-highlight' }));
      } catch (error) {
        // 高亮失败不影响输入框与弹窗功能，仅记录日志。
        console.log('[同步更新匹配标签] 标签高亮失败（已隔离）', error);
      }
    }
  }

  /**
   * 清除全部编辑器高亮标记。
   */
  clearHighlight() {
    for (const mark of this.marks) {
      try {
        mark.clear();
      } catch (error) {
        // 标记可能已被编辑器自动清理，忽略即可。
      }
    }
    this.marks = [];
  }

  /**
   * 临时移除"点击外部退出"监听（二次确认弹窗打开期间调用）。
   */
  suspendPointerHandler() {
    if (this.documentPointerHandler) {
      document.removeEventListener('pointerdown', this.documentPointerHandler, true);
    }
  }

  /**
   * 恢复"点击外部退出"监听（二次确认弹窗关闭后调用）。
   */
  resumePointerHandler() {
    if (this.documentPointerHandler) {
      document.addEventListener('pointerdown', this.documentPointerHandler, true);
    }
  }

  /**
   * 弹窗关闭后重新聚焦输入框，让用户继续编辑。
   */
  refocusInput() {
    setTimeout(() => {
      if (this.inputEl) {
        this.inputEl.focus();
        this.inputEl.select();
      }
    }, 50);
  }

  /**
   * 提交合法输入并关闭输入框。
   */
  commit(newName, isSingleTag) {
    const onCommit = this.options && this.options.onCommit;
    this.close();
    if (onCommit) {
      onCommit(newName, isSingleTag);
    }
  }

  /**
   * 放弃修改退出（Esc / 点击外部）。
   */
  cancel() {
    const onCancel = this.options && this.options.onCancel;
    this.close();
    if (onCancel) {
      onCancel();
    }
  }

  /**
   * 关闭并清理输入框：移除事件监听、高亮标记与 DOM。
   */
  close() {
    if (this.documentPointerHandler) {
      document.removeEventListener('pointerdown', this.documentPointerHandler, true);
      this.documentPointerHandler = null;
    }
    // 清理编辑器中残留的高亮标记，避免关闭输入框后仍停留在文档中。
    this.clearHighlight();
    if (this.el && this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
    this.el = null;
    this.inputEl = null;
    this.errorEl = null;
    this.options = null;
  }
}

/**
 * 转单标签二次确认弹窗。
 */
class SingleTagConfirmModal extends obsidian.Modal {
  /**
   * @param {Object} app    Obsidian App 实例。
   * @param {Object} options { newName, onConfirm, onCancel }
   */
  constructor(app, options) {
    super(app);
    this.options = options || {};
  }

  onOpen() {
    const { contentEl } = this;
    const name = this.options.newName;
    contentEl.empty();
    contentEl.createEl('h3', { text: CONFIRM_TITLE });
    contentEl.createEl('p', {
      text: '将以单标签 <' + name + '/> 更新当前标签，并删除其匹配标签，是否继续？'
    });
    new obsidian.Setting(contentEl)
      .addButton((btn) => btn.setButtonText('取消').setWarning().onClick(() => {
        this.close();
        if (this.options.onCancel) {
          this.options.onCancel();
        }
      }))
      .addButton((btn) => btn.setButtonText('确认').setCta().onClick(() => {
        this.close();
        if (this.options.onConfirm) {
          this.options.onConfirm();
        }
      }));
    // 回车触发确认，Esc 关闭弹窗（回到输入框）。
    this.enterKey = () => {
      this.close();
      if (this.options.onConfirm) {
        this.options.onConfirm();
      }
    };
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = {
  TagNameEditor,
  SingleTagConfirmModal
};
