'use strict';

// 文件路径建议器：提供输入框下方的建议浮层与键盘导航，支持库内文件的模糊匹配。

var obsidian = require('obsidian');
var popper = require('@popperjs/core');

// 取模循环，保证键盘上下移动在建议列表间循环。
function wrapAround(value, size) {
  return ((value % size) + size) % size;
}

// 建议列表核心：负责渲染建议项、高亮选中项与处理键盘导航。
class Suggest {
  constructor(owner, containerEl, scope) {
    this.owner = owner; // 建议使用者，提供 renderSuggestion / selectSuggestion 回调
    this.containerEl = containerEl; // 建议项容器
    this.values = []; // 当前建议数据数组
    this.suggestions = []; // 当前建议 DOM 元素数组
    this.selectedItem = 0; // 当前选中项索引

    // 点击与悬停选择建议项
    containerEl.on('click', '.suggestion-item', (event, el) => this.onSuggestionClick(event, el));
    containerEl.on('mousemove', '.suggestion-item', (_event, el) => this.onSuggestionMouseover(el));

    // 键盘导航：上下移动，回车确认
    scope.register([], 'ArrowUp', (event) => {
      if (!event.isComposing) {
        this.setSelectedItem(this.selectedItem - 1, true);
        return false;
      }
      return undefined;
    });
    scope.register([], 'ArrowDown', (event) => {
      if (!event.isComposing) {
        this.setSelectedItem(this.selectedItem + 1, true);
        return false;
      }
      return undefined;
    });
    scope.register([], 'Enter', (event) => {
      if (!event.isComposing) {
        this.useSelectedItem(event);
        return false;
      }
      return undefined;
    });
  }

  // 点击建议项时选中并触发选择回调。
  onSuggestionClick(event, el) {
    event.preventDefault();
    const item = this.suggestions.indexOf(el);
    this.setSelectedItem(item, false);
    this.useSelectedItem(event);
  }

  // 鼠标悬停时高亮对应建议项。
  onSuggestionMouseover(_event, el) {
    const item = this.suggestions.indexOf(el);
    this.setSelectedItem(item, false);
  }

  // 重建建议列表内容。
  setSuggestions(values) {
    this.containerEl.empty();
    const suggestionEls = [];

    values.forEach((value) => {
      const suggestionEl = this.containerEl.createDiv('suggestion-item');
      this.owner.renderSuggestion(value, suggestionEl);
      suggestionEls.push(suggestionEl);
    });

    this.values = values;
    this.suggestions = suggestionEls;
    this.setSelectedItem(0, false);
  }

  // 触发当前选中项的选择回调。
  useSelectedItem(event) {
    const currentValue = this.values[this.selectedItem];
    if (currentValue) {
      this.owner.selectSuggestion(currentValue, event);
    }
  }

  // 更新选中项并同步高亮状态。
  setSelectedItem(selectedIndex, scrollIntoView) {
    const normalizedIndex = wrapAround(selectedIndex, this.suggestions.length);
    const prevSelectedSuggestion = this.suggestions[this.selectedItem];
    const selectedSuggestion = this.suggestions[normalizedIndex];

    if (prevSelectedSuggestion) {
      prevSelectedSuggestion.removeClass('is-selected');
    }
    if (selectedSuggestion) {
      selectedSuggestion.addClass('is-selected');
    }

    this.selectedItem = normalizedIndex;

    if (scrollIntoView && selectedSuggestion) {
      selectedSuggestion.scrollIntoView(false);
    }
  }
}

// 文本输入建议基类：监听输入框的输入与聚焦事件，弹出建议浮层。
class TextInputSuggest {
  constructor(inputEl) {
    this.inputEl = inputEl; // 绑定的输入框
    this.scope = new obsidian.Scope();
    this.suggestEl = createDiv('suggestion-container');
    const suggestion = this.suggestEl.createDiv('suggestion');
    this.suggest = new Suggest(this, suggestion, this.scope);

    // 具名绑定事件处理函数，便于 dispose() 精确移除监听，避免重渲染后监听泄漏
    this.onInputBound = () => this.onInputChanged();
    this.onCloseBound = () => this.close();
    this.onMouseDownBound = (event) => {
      event.preventDefault();
    };

    // Esc 关闭建议
    this.scope.register([], 'Escape', this.onCloseBound);

    this.inputEl.addEventListener('input', this.onInputBound);
    this.inputEl.addEventListener('focus', this.onInputBound);
    this.inputEl.addEventListener('blur', this.onCloseBound);

    // 阻止建议容器内的 mousedown 默认行为，避免输入框失焦导致建议提前关闭
    this.suggestEl.addEventListener('mousedown', this.onMouseDownBound);
  }

  // 释放全部资源：关闭建议浮层并移除输入框与浮层上的事件监听，供弹窗重渲染前调用。
  dispose() {
    this.close();
    this.inputEl.removeEventListener('input', this.onInputBound);
    this.inputEl.removeEventListener('focus', this.onInputBound);
    this.inputEl.removeEventListener('blur', this.onCloseBound);
    this.suggestEl.removeEventListener('mousedown', this.onMouseDownBound);
  }

  // 输入变化时重新计算建议列表。
  onInputChanged() {
    const inputStr = this.inputEl.value;
    const suggestions = this.getSuggestions(inputStr);

    if (!suggestions) {
      this.close();
      return;
    }

    if (suggestions.length > 0) {
      this.suggest.setSuggestions(suggestions);
      this.open(app.dom.appContainerEl, this.inputEl);
    } else {
      this.close();
    }
  }

  // 打开建议浮层并挂载到应用根容器。
  open(container, inputEl) {
    app.keymap.pushScope(this.scope);
    container.appendChild(this.suggestEl);

    this.popper = popper.createPopper(inputEl, this.suggestEl, {
      placement: 'bottom-start',
      modifiers: [
        {
          name: 'sameWidth',
          enabled: true,
          fn: ({ state, instance }) => {
            // 第一次计算定位后，将浮层宽度对齐输入框宽度并再次更新定位
            const targetWidth = `${state.rects.reference.width}px`;
            if (state.styles.popper.width === targetWidth) {
              return;
            }
            state.styles.popper.width = targetWidth;
            instance.update();
          },
          phase: 'beforeWrite',
          requires: ['computeStyles']
        }
      ]
    });
  }

  // 关闭建议浮层并释放键盘作用域。
  close() {
    app.keymap.popScope(this.scope);
    this.suggest.setSuggestions([]);
    if (this.popper) {
      this.popper.destroy();
    }
    this.suggestEl.detach();
  }

  getSuggestions() { /* 由子类实现 */ }

  renderSuggestion() { /* 由子类实现 */ }

  selectSuggestion() { /* 由子类实现 */ }
}

// 文件路径建议器：按关键字从库内全部文件中模糊匹配。
class FileSuggest extends TextInputSuggest {
  constructor(inputEl, plugin) {
    super(inputEl);
    this.plugin = plugin; // 保存插件实例，便于访问 vault 文件列表
  }

  // 根据输入关键字返回匹配的文件列表（大小写不敏感）。
  getSuggestions(inputStr) {
    const files = [];
    const lowerInputStr = inputStr.toLowerCase();

    this.plugin.app.vault.getFiles().forEach((file) => {
      if (file instanceof obsidian.TFile && file.path.toLowerCase().includes(lowerInputStr)) {
        files.push(file);
      }
    });

    return files;
  }

  // 建议项展示文件库内路径。
  renderSuggestion(file, el) {
    el.setText(file.path);
  }

  // 选中后先关闭建议浮层，再写入路径并触发 input 事件，
  // 避免 trigger('input') 在 close() 之前同步触发 onInputChanged 导致 Popper 闪烁重建。
  selectSuggestion(file) {
    this.close();
    this.inputEl.value = file.path;
    this.inputEl.trigger('input');
  }
}

module.exports = {
  TextInputSuggest,
  FileSuggest
};
