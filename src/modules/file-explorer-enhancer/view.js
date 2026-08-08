'use strict';

var obsidian = require('obsidian');
var runtime = require('./runtime');

// ---------------------------------------------------------------------------
// 路径自动补全建议（PathSuggest），依赖 @popperjs/core 实现弹出层定位。
// ---------------------------------------------------------------------------

var createPopper = require('@popperjs/core').createPopper;

// 环绕取值辅助函数，保证选中序号始终在合法范围内。
function wrapAround(value, size) {
  return ((value % size) + size) % size;
}

// 内部建议列表控制器，负责键盘导航与点击选择。
function Suggest(owner, containerEl, scope) {
  this.owner = owner;
  this.containerEl = containerEl;
  this.values = [];
  this.suggestions = [];
  this.selectedItem = 0;

  var self = this;

  containerEl.addEventListener('click', function (event) {
    var el = event.target.closest('.suggestion-item');
    if (!el) return;
    event.preventDefault();
    var item = self.suggestions.indexOf(el);
    self.setSelectedItem(item, false);
    self.useSelectedItem(event);
  });

  containerEl.addEventListener('mousemove', function (event) {
    var el = event.target.closest('.suggestion-item');
    if (!el) return;
    var item = self.suggestions.indexOf(el);
    self.setSelectedItem(item, false);
  });

  scope.register([], 'ArrowUp', function (event) {
    if (!event.isComposing) {
      self.setSelectedItem(self.selectedItem - 1, true);
      return false;
    }
  });

  scope.register([], 'ArrowDown', function (event) {
    if (!event.isComposing) {
      self.setSelectedItem(self.selectedItem + 1, true);
      return false;
    }
  });

  scope.register([], 'Enter', function (event) {
    if (!event.isComposing) {
      self.useSelectedItem(event);
      return false;
    }
  });
}

Suggest.prototype.setSuggestions = function (values) {
  this.containerEl.empty();
  var suggestionEls = [];

  for (var i = 0; i < values.length; i++) {
    var suggestionEl = this.containerEl.createDiv('suggestion-item');
    this.owner.renderSuggestion(values[i], suggestionEl);
    suggestionEls.push(suggestionEl);
  }

  this.values = values;
  this.suggestions = suggestionEls;
  this.setSelectedItem(0, false);
};

Suggest.prototype.useSelectedItem = function (event) {
  var currentValue = this.values[this.selectedItem];
  if (currentValue) {
    this.owner.selectSuggestion(currentValue, event);
  }
};

Suggest.prototype.setSelectedItem = function (selectedIndex, scrollIntoView) {
  var normalizedIndex = wrapAround(selectedIndex, this.suggestions.length);
  var prevSelected = this.suggestions[this.selectedItem];
  var selected = this.suggestions[normalizedIndex];

  if (prevSelected) prevSelected.removeClass('is-selected');
  if (selected) selected.addClass('is-selected');

  this.selectedItem = normalizedIndex;

  if (scrollIntoView && selected) {
    selected.scrollIntoView(false);
  }
};

// 文本输入自动补全基类。
function TextInputSuggest(app, inputEl) {
  this.app = app;
  this.inputEl = inputEl;
  this.scope = new obsidian.Scope();

  this.suggestEl = document.createElement('div');
  this.suggestEl.className = 'suggestion-container';
  var suggestion = document.createElement('div');
  suggestion.className = 'suggestion';
  this.suggestEl.appendChild(suggestion);
  this.suggest = new Suggest(this, suggestion, this.scope);

  var self = this;

  this.scope.register([], 'Escape', function () { self.close(); });

  this.inputEl.addEventListener('input', function () { self.onInputChanged(); });
  this.inputEl.addEventListener('focus', function () { self.onInputChanged(); });
  this.inputEl.addEventListener('blur', function () { self.close(); });
  this.suggestEl.addEventListener('mousedown', function (event) {
    event.preventDefault();
  });
}

TextInputSuggest.prototype.onInputChanged = function () {
  var inputStr = this.inputEl.value;
  var suggestions = this.getSuggestions(inputStr).slice(0, 10);

  if (suggestions.length > 0) {
    this.suggest.setSuggestions(suggestions);
    this.open(this.app.dom.appContainerEl, this.inputEl);
  }
};

TextInputSuggest.prototype.open = function (container, inputEl) {
  var self = this;
  this.app.keymap.pushScope(this.scope);

  // 解除 Obsidian 默认的 max-width 限制，让下拉框宽度完全由 sameWidth 修饰器控制
  this.suggestEl.style.maxWidth = 'none';
  container.appendChild(this.suggestEl);
  this.popper = createPopper(inputEl, this.suggestEl, {
    placement: 'bottom-start',
    modifiers: [
      {
        name: 'sameWidth',
        enabled: true,
        fn: function (_a) {
          var state = _a.state;
          var instance = _a.instance;
          // 优先使用 .search-input-container 的宽度，保证下拉框与搜索框外观匹配
          var searchContainer = inputEl.closest('.search-input-container');
          var targetWidth = searchContainer
            ? searchContainer.getBoundingClientRect().width + 'px'
            : state.rects.reference.width + 'px';
          if (state.styles.popper.width === targetWidth) return;
          state.styles.popper.width = targetWidth;
          instance.update();
        },
        phase: 'beforeWrite',
        requires: ['computeStyles']
      }
    ]
  });
};

TextInputSuggest.prototype.close = function () {
  this.app.keymap.popScope(this.scope);
  this.suggest.setSuggestions([]);
  if (this.popper) {
    this.popper.destroy();
  }
  if (this.suggestEl.parentNode) {
    this.suggestEl.detach();
  }
};

// 路径自动补全建议，根据输入内容从库中模糊匹配文件与文件夹路径。
function PathSuggest(app, inputEl) {
  TextInputSuggest.call(this, app, inputEl);
}

PathSuggest.prototype = Object.create(TextInputSuggest.prototype);
PathSuggest.prototype.constructor = PathSuggest;

PathSuggest.prototype.getSuggestions = function (inputStr) {
  var abstractFiles = this.app.vault.getAllLoadedFiles();
  var paths = [];
  var lowerCaseInputStr = inputStr.toLowerCase();

  for (var i = 0; i < abstractFiles.length; i++) {
    var path = abstractFiles[i];
    if (path.path.toLowerCase().indexOf(lowerCaseInputStr) !== -1) {
      paths.push(path);
    }
  }

  return paths;
};

PathSuggest.prototype.renderSuggestion = function (file, el) {
  el.setText(file.path);
};

PathSuggest.prototype.selectSuggestion = function (file) {
  this.inputEl.value = file.path;
  this.inputEl.dispatchEvent(new Event('input'));
  this.close();
};

// ---------------------------------------------------------------------------
// 弹窗：查看被过滤器匹配的文件或文件夹列表
// ---------------------------------------------------------------------------

function PathsActivatedModal(plugin, actionType) {
  obsidian.Modal.call(this, plugin.app);
  this.plugin = plugin;
  this.actionType = actionType; // 'PIN' 或 'HIDE'
}

PathsActivatedModal.prototype = Object.create(obsidian.Modal.prototype);
PathsActivatedModal.prototype.constructor = PathsActivatedModal;

PathsActivatedModal.prototype.onOpen = function () {
  var contentEl = this.contentEl;
  contentEl.empty();
  contentEl.addClasses(['file-explorer-plus', 'filters-activated-modal']);
  contentEl.addClass('nene-settings-modal');

  // 标题
  var headerEl = contentEl.createDiv({ cls: 'nene-settings-modal-header' });
  var titleText = this.actionType === 'PIN' ? '查看由选择器置顶的文件或文件夹' : '查看由选择器隐藏的文件或文件夹';
  headerEl.createDiv({ cls: 'nene-settings-modal-title', text: titleText });

  var self = this;
  var files = this.app.vault.getAllLoadedFiles();
  var pathFilters = this.actionType === 'HIDE'
    ? this.plugin.fileExplorerEnhancerSettings.hideFilters.paths
    : this.plugin.fileExplorerEnhancerSettings.pinFilters.paths;

  var pathsActivated = this.actionType === 'HIDE'
    ? runtime.getPathsToHide(this.plugin, files)
    : runtime.getPathsToPin(this.plugin, files);

  // 附加激活的过滤器名称
  pathsActivated = pathsActivated.map(function (file) {
    var activatedNames = pathFilters
      .filter(function (filter) { return runtime.checkPathFilter(filter, file); })
      .map(function (filter) {
        return filter.name && filter.name !== '' ? filter.name : filter.pattern;
      });
    file._filtersActivated = activatedNames.join(', ');
    return file;
  });

  if (pathsActivated.length === 0) {
    contentEl.createEl('p', {
      cls: 'nene-settings-modal-description',
      text: '当前没有匹配任何文件或文件夹。'
    });
    return;
  }

  // 构建表格数据
  var data = [['路径', '类型', '匹配的过滤器']];

  for (var i = 0; i < pathsActivated.length; i++) {
    var pathFile = pathsActivated[i];
    var row = [];

    if (pathFile instanceof obsidian.TFile) {
      var link = contentEl.createEl('a');
      link.addEventListener('click', (function (pf) {
        return function () {
          self.app.workspace.getLeaf('tab').openFile(pf);
        };
      })(pathFile));
      link.textContent = pathFile.path;
      row.push(link);
    } else {
      row.push(pathFile.path);
    }

    if (pathFile instanceof obsidian.TFile) {
      row.push('文件');
    } else if (pathFile instanceof obsidian.TFolder) {
      row.push('文件夹');
    } else {
      row.push('未知');
    }

    row.push(pathFile._filtersActivated || '');
    data.push(row);
  }

  var table = generateTable(data);
  contentEl.appendChild(table);
};

PathsActivatedModal.prototype.onClose = function () {
  this.contentEl.empty();
};

// ---------------------------------------------------------------------------
// 拖拽排序工具函数（参照 status-bar-enhancer/organizer-view.js 的 cloneRow 模式）
// ---------------------------------------------------------------------------

/**
 * 克隆被拖拽的行，生成跟随鼠标的浮动副本。
 */
function cloneFilterRow(rowsContainer, stationaryRow, event) {
  stationaryRow.addClass('nene-filter-row-clone');

  var fauxRow = document.createElement('div');
  fauxRow.className = stationaryRow.className + ' nene-filter-row-drag';
  fauxRow.innerHTML = stationaryRow.innerHTML;

  rowsContainer.appendChild(fauxRow);

  var containerRect = rowsContainer.getBoundingClientRect();
  fauxRow.style.left = (stationaryRow.getBoundingClientRect().left - containerRect.left) + 'px';
  fauxRow.style.top = (stationaryRow.getBoundingClientRect().top - containerRect.top) + 'px';
  fauxRow.style.width = stationaryRow.offsetWidth + 'px';

  var offsetX = event.clientX - fauxRow.getBoundingClientRect().left;
  var offsetY = event.clientY - fauxRow.getBoundingClientRect().top;
  var currentIndex = Array.from(rowsContainer.children).indexOf(stationaryRow);

  return {
    stationaryRow: stationaryRow,
    movableRow: fauxRow,
    offsetX: offsetX + containerRect.left,
    offsetY: offsetY + containerRect.top,
    index: currentIndex
  };
}

/**
 * 清除浮动副本、克隆标记与所有落点提示。
 */
function deleteFilterRowClone(stationaryRow, movableRow) {
  stationaryRow.removeClass('nene-filter-row-clone');
  if (movableRow.parentNode) {
    movableRow.parentNode.removeChild(movableRow);
  }
  // 清除所有 drop-target
  var targets = document.querySelectorAll('.nene-filter-row-drop-target');
  for (var t = 0; t < targets.length; t++) {
    targets[t].removeClass('nene-filter-row-drop-target');
  }
}

/**
 * 根据鼠标位置计算新索引（超过 0.75 行高触发换位）。
 */
function calculateFilterRowIndex(event, rowsContainer, movableRow, stationaryRow, offsetX, offsetY, index) {
  movableRow.style.left = (event.clientX - offsetX) + 'px';
  movableRow.style.top = (event.clientY - offsetY) + 'px';

  var dist = movableRow.getBoundingClientRect().top - stationaryRow.getBoundingClientRect().top;
  var dir = dist > 0 ? 1 : -1;

  if (Math.abs(dist) > stationaryRow.offsetHeight * 0.75) {
    var newIndex = Math.max(0, Math.min(index + dir, rowsContainer.children.length - 1));

    // 清除旧落点提示，为目标行添加落点提示
    var prevTargets = rowsContainer.querySelectorAll('.nene-filter-row-drop-target');
    for (var p = 0; p < prevTargets.length; p++) {
      prevTargets[p].removeClass('nene-filter-row-drop-target');
    }
    var targetRow = rowsContainer.children[newIndex];
    if (targetRow) {
      targetRow.addClass('nene-filter-row-drop-target');
    }

    return newIndex;
  }
  return index;
}

/**
 * 在 DOM 中交换行位置。不修改 data-nene-filter-row-index，
 * 以保留从 DOM 顺序到原始数组索引的映射。
 */
function swapFilterRowPosition(rowsContainer, stationaryRow, newIndex) {
  rowsContainer.removeChild(stationaryRow);
  if (newIndex >= rowsContainer.children.length) {
    rowsContainer.appendChild(stationaryRow);
  } else {
    rowsContainer.insertBefore(stationaryRow, rowsContainer.children[newIndex]);
  }
}

/**
 * 拖拽入口：mousedown 时创建浮动副本，绑定 mousemove/mouseup 到 window。
 * 参照 organizer-view.js handleMouseDown 的完整流程。
 */
function handleFilterDragStart(event, plugin, actionType, rowsContainer, stationaryRow, index) {
  if (filterDragLock) return;
  filterDragLock = true;
  event.preventDefault();

  var cloneData = cloneFilterRow(rowsContainer, stationaryRow, event);
  var currentIndex = cloneData.index;

  function onMouseMove(moveEvent) {
    moveEvent.preventDefault();

    var newIndex = calculateFilterRowIndex(
      moveEvent, rowsContainer,
      cloneData.movableRow, cloneData.stationaryRow,
      cloneData.offsetX, cloneData.offsetY, currentIndex
    );

    if (newIndex !== currentIndex) {
      swapFilterRowPosition(rowsContainer, cloneData.stationaryRow, newIndex);
      currentIndex = newIndex;
    }
  }

  function onMouseUp() {
    deleteFilterRowClone(cloneData.stationaryRow, cloneData.movableRow);
    filterDragLock = false;

    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);

    // 按当前 DOM 顺序 + 保留的原始索引重建数据层数组
    var list = actionType === 'PIN'
      ? plugin.fileExplorerEnhancerSettings.pinFilters.paths
      : plugin.fileExplorerEnhancerSettings.hideFilters.paths;

    var children = Array.from(rowsContainer.children);
    var newOrder = [];
    for (var k = 0; k < children.length; k++) {
      var origIndex = parseInt(children[k].getAttribute('data-nene-filter-row-index'), 10);
      newOrder.push(list[origIndex]);
    }

    // 用新的 position 值更新数组，保持对象引用不变
    for (var m = 0; m < newOrder.length; m++) {
      newOrder[m].position = m;
    }

    // 按 position 排序数组
    list.length = 0;
    for (var m = 0; m < newOrder.length; m++) {
      list.push(newOrder[m]);
    }

    plugin.fileExplorerEnhancerStore.save();
    if (plugin._fileExplorerView) {
      plugin._fileExplorerView.requestSort();
    }

    // 原地更新每行显示名与 data-nene-filter-row-index，避免整页重渲染闪烁
    var typeTextMap = { FILES_AND_DIRECTORIES: '文件与文件夹', FILES: '文件', DIRECTORIES: '文件夹' };
    var modeTextMap = { WILDCARD: '通配符', REGEX: '正则表达式', STRICT: '严格模式' };
    for (var n = 0; n < children.length; n++) {
      children[n].setAttribute('data-nene-filter-row-index', String(n));
      var f = list[n];
      var inputs = children[n].querySelectorAll('.nene-filter-text-display');
      if (inputs.length >= 4) {
        inputs[0].value = f.pattern || '(空)';
        inputs[1].value = f.name || '';
        inputs[2].value = typeTextMap[f.type] || f.type;
        inputs[3].value = modeTextMap[f.patternType] || f.patternType;
      }
    }
  }

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

// ---------------------------------------------------------------------------
// 弹窗：路径过滤器管理列表（编辑、启用/禁用、删除）
// ---------------------------------------------------------------------------

function PathFilterListModal(plugin, actionType, onChanged) {
  obsidian.Modal.call(this, plugin.app);
  this.plugin = plugin;
  this.actionType = actionType; // 'PIN' 或 'HIDE'
  this.onChanged = onChanged || null;
}

PathFilterListModal.prototype = Object.create(obsidian.Modal.prototype);
PathFilterListModal.prototype.constructor = PathFilterListModal;

PathFilterListModal.prototype.getFilters = function () {
  return this.actionType === 'PIN'
    ? this.plugin.fileExplorerEnhancerSettings.pinFilters.paths
    : this.plugin.fileExplorerEnhancerSettings.hideFilters.paths;
};

PathFilterListModal.prototype.onOpen = function () {
  this.modalEl.addClass('mod-sidebar-layout', 'nene-settings-panel-modal');
  var contentEl = this.contentEl;
  contentEl.empty();
  contentEl.addClass('nene-settings-modal');

  var titleText = this.actionType === 'PIN' ? '置顶路径过滤器' : '隐藏路径过滤器';
  var headerEl = contentEl.createDiv({ cls: 'nene-settings-modal-header' });
  headerEl.createDiv({ cls: 'nene-settings-modal-title', text: titleText });

  this.renderFilterList(contentEl);
};

// 拖拽状态锁，防止同时进行多个拖拽
var filterDragLock = false;

PathFilterListModal.prototype.renderFilterList = function (containerEl) {
  var filters = this.getFilters();
  var self = this;
  var plugin = this.plugin;
  var actionType = this.actionType;

  if (filters.length === 0) {
    var emptyEl = containerEl.createDiv({ cls: 'nene-settings-modal-description' });
    emptyEl.createEl('p', { text: '当前没有路径过滤器规则。' });
    return;
  }

  // 类型与匹配模式的显示文本映射
  var typeTextMap = { FILES_AND_DIRECTORIES: '文件与文件夹', FILES: '文件', DIRECTORIES: '文件夹' };
  var modeTextMap = { WILDCARD: '通配符', REGEX: '正则表达式', STRICT: '严格模式' };

  var obsidian = require('obsidian');

  // 获取当前最新 filter（解决 save() 替换 settings 后闭包引用过期问题）
  function getCurrentFilter(idx) {
    var currentFilters = actionType === 'PIN'
      ? plugin.fileExplorerEnhancerSettings.pinFilters.paths
      : plugin.fileExplorerEnhancerSettings.hideFilters.paths;
    return currentFilters[idx];
  }

  // 表头行（含拖曳列对齐，按钮列为空白占位保证对齐）
  var headerRow = containerEl.createDiv({ cls: 'nene-filter-table-header' });
  headerRow.createSpan({ cls: 'nene-filter-col-drag' });
  headerRow.createSpan({ cls: 'nene-filter-col-selector', text: '选择器' });
  headerRow.createSpan({ cls: 'nene-filter-col-name', text: '名称' });
  headerRow.createSpan({ cls: 'nene-filter-col-type', text: '文件类型' });
  headerRow.createSpan({ cls: 'nene-filter-col-mode', text: '匹配模式' });
  // 占位列：对齐数据行的 toggle + 3 个 ExtraButton
  headerRow.createSpan({ cls: 'nene-filter-col-toggle' });
  headerRow.createSpan({ cls: 'nene-filter-col-btn' });
  headerRow.createSpan({ cls: 'nene-filter-col-btn' });
  headerRow.createSpan({ cls: 'nene-filter-col-btn' });

  // 行容器，用于拖拽时定位参照
  var rowsContainer = containerEl.createDiv({ cls: 'nene-filter-rows-container' });

  // 收集每行的 DOM 引用与元数据，供拖拽逻辑使用
  var rowRefs = [];

  for (var i = 0; i < filters.length; i++) {
    (function (index) {
      var f = getCurrentFilter(index);
      var patternText = f.pattern || '(空)';
      var nameText = f.name || '';
      var typeText = typeTextMap[f.type] || f.type;
      var modeText = modeTextMap[f.patternType] || f.patternType;

      var setting = new obsidian.Setting(rowsContainer);
      setting.settingEl.addClass('nene-filter-setting-row');
      setting.settingEl.setAttribute('data-nene-filter-row-index', String(index));

      // 选择器路径（只读文本）
      setting.addText(function (text) {
        text.setValue(patternText).setDisabled(true);
        text.inputEl.addClass('nene-filter-text-display');
      });

      // 名称（只读文本）
      setting.addText(function (text) {
        text.setValue(nameText).setDisabled(true);
        text.inputEl.addClass('nene-filter-text-display');
      });

      // 文件类型（只读文本）
      setting.addText(function (text) {
        text.setValue(typeText).setDisabled(true);
        text.inputEl.addClass('nene-filter-text-display');
      });

      // 匹配模式（只读文本）
      setting.addText(function (text) {
        text.setValue(modeText).setDisabled(true);
        text.inputEl.addClass('nene-filter-text-display');
      });

      // 启用开关
      setting.addToggle(function (toggle) {
        toggle
          .setTooltip('启用')
          .setValue(f.active)
          .onChange(function (isActive) {
            var cur = getCurrentFilter(index);
            cur.active = isActive;
            plugin.fileExplorerEnhancerStore.save();
            if (plugin._fileExplorerView) {
              plugin._fileExplorerView.requestSort();
            }
          });
      });

      // 查看按钮
      setting.addExtraButton(function (button) {
        button
          .setIcon('search')
          .setTooltip('查看当前规则生效的文件与文件夹')
          .onClick(function () {
            new SingleFilterActivatedModal(plugin, getCurrentFilter(index), actionType).open();
          });
      });

      // 编辑按钮
      setting.addExtraButton(function (button) {
        button
          .setIcon('pencil')
          .setTooltip('编辑')
          .onClick(function () {
            new NewPathFilterModal(plugin, actionType, index, function () {
              self.onOpen();
            }).open();
          });
      });

      // 删除按钮
      setting.addExtraButton(function (button) {
        button
          .setIcon('cross')
          .setTooltip('删除')
          .onClick(function () {
            var list = actionType === 'PIN'
              ? plugin.fileExplorerEnhancerSettings.pinFilters.paths
              : plugin.fileExplorerEnhancerSettings.hideFilters.paths;
            list.splice(index, 1);
            plugin.fileExplorerEnhancerStore.save();
            if (plugin._fileExplorerView) {
              plugin._fileExplorerView.requestSort();
            }
            self.onOpen();
          });
      });

      // 拖曳手柄（最左侧）
      var controlEl = setting.settingEl.querySelector('.setting-item-control');
      var dragHandle = controlEl.createSpan({ cls: 'nene-filter-drag-handle' });
      obsidian.setIcon(dragHandle, 'grip-vertical');
      controlEl.insertBefore(dragHandle, controlEl.firstChild);

      // 记录行引用
      rowRefs.push({ el: setting.settingEl, index: index });
      setting.settingEl._filterIndex = index;

      // 参照 organizer-view 的 mousedown 拖拽逻辑
      dragHandle.addEventListener('mousedown', function (event) {
        handleFilterDragStart(event, plugin, actionType, rowsContainer, setting.settingEl, index);
        event.preventDefault();
      });
    })(i);
  }
};

PathFilterListModal.prototype.onClose = function () {
  if (this.onChanged) this.onChanged();
  this.contentEl.empty();
};

// ---------------------------------------------------------------------------
// 弹窗：文件资源管理器增强管理器（置顶选择器 + 隐藏选择器）
// ---------------------------------------------------------------------------

function FileExplorerManagerModal(plugin) {
  obsidian.Modal.call(this, plugin.app);
  this.plugin = plugin;
}

FileExplorerManagerModal.prototype = Object.create(obsidian.Modal.prototype);
FileExplorerManagerModal.prototype.constructor = FileExplorerManagerModal;

FileExplorerManagerModal.prototype.onOpen = function () {
  var contentEl = this.contentEl;
  contentEl.empty();
  contentEl.addClass('nene-settings-modal');

  var headerEl = contentEl.createDiv({ cls: 'nene-settings-modal-header' });
  headerEl.createDiv({ cls: 'nene-settings-modal-title', text: '文件列表管理' });

  var plugin = this.plugin;
  var settings = plugin.fileExplorerEnhancerStore.getSettings();
  var self = this;

  // --- 置顶选择器 ---
  var pinSectionEl = contentEl.createDiv({ cls: 'nene-settings-subsection' });
  pinSectionEl.createEl('h4', { text: '置顶选择器' });

  new obsidian.Setting(pinSectionEl)
    .setName('启用置顶选择器')
    .addToggle(function (toggle) {
      toggle
        .setValue(settings.pinFilters.active)
        .onChange(async function (value) {
          settings.pinFilters.active = value;
          await plugin.fileExplorerEnhancerStore.save();
          if (plugin._fileExplorerView) plugin._fileExplorerView.requestSort();
          self.onOpen();
        });
    });

  new obsidian.Setting(pinSectionEl)
    .setName('路径过滤器')
    .setDesc(getFilterDesc(settings.pinFilters.paths))
    .addButton(function (button) {
      button.setButtonText('查看列表').onClick(function () {
        new PathFilterListModal(plugin, 'PIN', function () {
          self.onOpen();
        }).open();
      });
    })
    .addButton(function (button) {
      button.setButtonText('新建').setCta().onClick(function () {
        new NewPathFilterModal(plugin, 'PIN', -1, function () {
          self.onOpen();
        }).open();
      });
    });

  // --- 隐藏选择器 ---
  var hideSectionEl = contentEl.createDiv({ cls: 'nene-settings-subsection' });
  hideSectionEl.createEl('h4', { text: '隐藏选择器' });

  new obsidian.Setting(hideSectionEl)
    .setName('启用隐藏选择器')
    .addToggle(function (toggle) {
      toggle
        .setValue(settings.hideFilters.active)
        .onChange(async function (value) {
          settings.hideFilters.active = value;
          await plugin.fileExplorerEnhancerStore.save();
          if (plugin._fileExplorerView) plugin._fileExplorerView.requestSort();
          self.onOpen();
        });
    });

  new obsidian.Setting(hideSectionEl)
    .setName('路径过滤器')
    .setDesc(getFilterDesc(settings.hideFilters.paths))
    .addButton(function (button) {
      button.setButtonText('查看列表').onClick(function () {
        new PathFilterListModal(plugin, 'HIDE', function () {
          self.onOpen();
        }).open();
      });
    })
    .addButton(function (button) {
      button.setButtonText('新建').setCta().onClick(function () {
        new NewPathFilterModal(plugin, 'HIDE', -1, function () {
          self.onOpen();
        }).open();
      });
    });
};

FileExplorerManagerModal.prototype.onClose = function () {
  this.contentEl.empty();
};

// ---------------------------------------------------------------------------
// 弹窗：新建/编辑路径过滤器（支持创建与修改两种模式）
// ---------------------------------------------------------------------------

function NewPathFilterModal(plugin, actionType, editIndex, onSaved) {
  obsidian.Modal.call(this, plugin.app);
  this.plugin = plugin;
  this.actionType = actionType;
  this.editIndex = editIndex >= 0 ? editIndex : -1;
  this.onSaved = onSaved || null;
}

NewPathFilterModal.prototype = Object.create(obsidian.Modal.prototype);
NewPathFilterModal.prototype.constructor = NewPathFilterModal;

NewPathFilterModal.prototype.onOpen = function () {
  this.modalEl.addClass('nene-new-filter-modal');
  var contentEl = this.contentEl;
  contentEl.empty();

  var self = this;
  var plugin = this.plugin;
  var actionType = this.actionType;
  var isEditing = this.editIndex >= 0;

  // 编辑模式：从已有规则预填数据
  var existingFilter = null;
  if (isEditing) {
    var filtersList = actionType === 'PIN'
      ? plugin.fileExplorerEnhancerSettings.pinFilters.paths
      : plugin.fileExplorerEnhancerSettings.hideFilters.paths;
    existingFilter = filtersList[self.editIndex];
  }

  var tempFilter = {
    name: existingFilter ? existingFilter.name : '',
    active: true,
    type: existingFilter ? existingFilter.type : 'FILES',
    pattern: existingFilter ? existingFilter.pattern : '',
    patternType: existingFilter ? existingFilter.patternType : 'STRICT'
  };

  // 可滚动的内容区域
  var bodyEl = contentEl.createDiv({ cls: 'nene-new-filter-body' });

  var titleText = isEditing
    ? (actionType === 'PIN' ? '编辑置顶路径过滤器' : '编辑隐藏路径过滤器')
    : (actionType === 'PIN' ? '新建置顶路径过滤器' : '新建隐藏路径过滤器');
  bodyEl.createEl('h3', { text: titleText });

  // 所有控件平铺一行（PathSuggest 异常已修复，放心使用 Setting API）
  var setting = new obsidian.Setting(bodyEl);
  setting.settingEl.addClass('nene-new-filter-setting');
  setting
    .addText(function (text) {
      text.setPlaceholder('名称（可选）')
        .setValue(tempFilter.name)
        .onChange(function (v) { tempFilter.name = v; });
    })
    .addSearch(function (text) {
      new PathSuggest(plugin.app, text.inputEl);
      text.setPlaceholder('路径规则（可选）')
        .setValue(tempFilter.pattern)
        .onChange(function (v) { tempFilter.pattern = v; });
    })
    .addDropdown(function (dropdown) {
      dropdown
        .addOptions({
          FILES: '文件',
          DIRECTORIES: '文件夹'
        })
        .setValue(tempFilter.type)
        .onChange(function (v) { tempFilter.type = v; });
    })
    .addDropdown(function (dropdown) {
      dropdown
        .addOptions({
          WILDCARD: '通配符',
          REGEX: '正则表达式',
          STRICT: '严格模式'
        })
        .setValue(tempFilter.patternType)
        .onChange(function (v) { tempFilter.patternType = v; });
    });

  // 固定在底部右对齐的操作按钮
  var footerEl = contentEl.createDiv({ cls: 'nene-new-filter-footer' });

  var cancelBtn = footerEl.createEl('button', { text: '取消' });
  cancelBtn.addEventListener('click', function () { self.close(); });

  var confirmBtn = footerEl.createEl('button', { cls: 'mod-cta', text: isEditing ? '保存' : '确认' });
  confirmBtn.addEventListener('click', function () {
    var filtersList = actionType === 'PIN'
      ? plugin.fileExplorerEnhancerSettings.pinFilters.paths
      : plugin.fileExplorerEnhancerSettings.hideFilters.paths;

    var newFilter = {
      name: tempFilter.name,
      active: isEditing ? existingFilter.active : tempFilter.active,
      type: tempFilter.type,
      pattern: tempFilter.pattern,
      patternType: tempFilter.patternType,
      position: isEditing ? existingFilter.position : filtersList.length
    };

    if (isEditing) {
      filtersList[self.editIndex] = newFilter;
      new obsidian.Notice('路径过滤器已更新');
    } else {
      filtersList.push(newFilter);
      new obsidian.Notice('路径过滤器已添加');
    }

    plugin.fileExplorerEnhancerStore.save();
    if (tempFilter.active && plugin._fileExplorerView) {
      plugin._fileExplorerView.requestSort();
    }
    if (self.onSaved) self.onSaved();
    self.close();
  });
};

NewPathFilterModal.prototype.onClose = function () {
  this.contentEl.empty();
};

// ---------------------------------------------------------------------------
// 工具函数：生成 HTML 表格
// ---------------------------------------------------------------------------

function generateTable(data) {
  var table = document.createElement('table');
  var thead = document.createElement('thead');
  var tbody = document.createElement('tbody');

  table.appendChild(thead);
  table.appendChild(tbody);

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var tableRow = document.createElement('tr');

    if (i === 0) {
      thead.appendChild(tableRow);
    } else {
      tbody.appendChild(tableRow);
    }

    for (var j = 0; j < row.length; j++) {
      var cell;
      if (i === 0) {
        cell = document.createElement('th');
        cell.textContent = data[i][j];
      } else {
        cell = document.createElement('td');
        if (typeof data[i][j] === 'string') {
          cell.textContent = data[i][j];
        } else {
          cell.appendChild(data[i][j]);
        }
      }
      tableRow.appendChild(cell);
    }
  }

  return table;
}

// 计算过滤器类型 + 模式的简短描述文本。
function getFilterKindText(filter) {
  var typeMap = { FILES: '文件', DIRECTORIES: '文件夹', FILES_AND_DIRECTORIES: '文件与文件夹' };
  var modeMap = { WILDCARD: '通配符', REGEX: '正则', STRICT: '严格' };
  return (typeMap[filter.type] || filter.type) + '  ·  ' + (modeMap[filter.patternType] || filter.patternType);
}

// ---------------------------------------------------------------------------
// 弹窗：查看单个过滤器规则生效的文件或文件夹列表
// ---------------------------------------------------------------------------

function SingleFilterActivatedModal(plugin, filter, actionType) {
  obsidian.Modal.call(this, plugin.app);
  this.plugin = plugin;
  this.filter = filter;
  this.actionType = actionType;
}

SingleFilterActivatedModal.prototype = Object.create(obsidian.Modal.prototype);
SingleFilterActivatedModal.prototype.constructor = SingleFilterActivatedModal;

SingleFilterActivatedModal.prototype.onOpen = function () {
  this.modalEl.addClass('mod-sidebar-layout');
  var contentEl = this.contentEl;
  contentEl.empty();
  contentEl.addClasses(['file-explorer-plus', 'filters-activated-modal']);

  var allFiles = this.plugin.app.vault.getAllLoadedFiles();
  var matched = [];
  var checkFn = require('./runtime').checkPathFilter;

  for (var i = 0; i < allFiles.length; i++) {
    if (checkFn(this.filter, allFiles[i])) {
      matched.push(allFiles[i]);
    }
  }

  if (matched.length === 0) {
    contentEl.createEl('p', { text: '当前没有匹配的文件或文件夹。' });
    return;
  }

  // 构建表格，参考原插件 PathsActivatedModal 格式
  var table = document.createElement('table');
  var thead = document.createElement('thead');
  var tbody = document.createElement('tbody');
  table.appendChild(thead);
  table.appendChild(tbody);

  // 表头：路径 | 类型 | 过滤器
  var headerRow = document.createElement('tr');
  var thPath = document.createElement('th'); thPath.textContent = '路径'; headerRow.appendChild(thPath);
  var thType = document.createElement('th'); thType.textContent = '类型'; headerRow.appendChild(thType);
  var thFilter = document.createElement('th'); thFilter.textContent = '过滤器'; headerRow.appendChild(thFilter);
  thead.appendChild(headerRow);

  var self = this;
  var filterDisplay = this.filter.name || this.filter.pattern;

  for (var j = 0; j < matched.length; j++) {
    var file = matched[j];
    var row = document.createElement('tr');

    // 路径列
    var tdPath = document.createElement('td');
    if (file instanceof obsidian.TFile) {
      var link = document.createElement('a');
      link.textContent = file.path;
      link.addEventListener('click', (function (f) {
        return function () { self.plugin.app.workspace.getLeaf('tab').openFile(f); };
      })(file));
      tdPath.appendChild(link);
    } else {
      tdPath.textContent = file.path;
    }
    row.appendChild(tdPath);

    // 类型列
    var tdType = document.createElement('td');
    tdType.textContent = file instanceof obsidian.TFile ? '文件' : '文件夹';
    row.appendChild(tdType);

    // 过滤器列
    var tdFilter = document.createElement('td');
    tdFilter.textContent = filterDisplay;
    row.appendChild(tdFilter);

    tbody.appendChild(row);
  }

  contentEl.appendChild(table);

};

SingleFilterActivatedModal.prototype.onClose = function () {
  this.contentEl.empty();
};

// 计算路径过滤器的描述文本。
function getFilterDesc(filters) {
  if (!filters || filters.length === 0) {
    return '当前 0 条规则。';
  }
  var activeCount = filters.filter(function (f) { return f.active; }).length;
  return '当前 ' + filters.length + ' 条规则，' + activeCount + ' 条启用。';
}

module.exports = {
  PathSuggest: PathSuggest,
  PathFilterListModal: PathFilterListModal,
  PathsActivatedModal: PathsActivatedModal,
  NewPathFilterModal: NewPathFilterModal,
  FileExplorerManagerModal: FileExplorerManagerModal,
  SingleFilterActivatedModal: SingleFilterActivatedModal
};
