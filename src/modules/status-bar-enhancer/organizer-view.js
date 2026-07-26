'use strict';

var obsidian = require('obsidian');
var organizerRuntime = require('./organizer-runtime');

// 拖拽状态锁，防止同时进行多个拖拽
var dragging = false;

/**
 * 渲染弹窗公共头部。
 */
function renderModalHeader(containerEl, title, description) {
  var headerEl = containerEl.createDiv({ cls: 'nene-settings-modal-header' });
  headerEl.createDiv({ cls: 'nene-settings-modal-title', text: title });
  if (description) {
    headerEl.createEl('p', {
      cls: 'nene-settings-modal-description',
      text: description
    });
  }
}

/**
 * 渲染信息行。
 */
function renderDetailItem(containerEl, label, value, codeStyle) {
  var itemEl = containerEl.createDiv({ cls: 'nene-settings-detail-item' });
  itemEl.createDiv({ cls: 'nene-settings-detail-label', text: label });
  itemEl.createEl(codeStyle ? 'code' : 'div', {
    cls: 'nene-settings-detail-value',
    text: value
  });
}

/**
 * 状态栏元素管理弹窗。
 * 提供拖拽排序、显示/隐藏切换、删除僵死元素等功能。
 */
class StatusBarOrganizerModal extends obsidian.Modal {
  constructor(app, plugin, onSettingsChanged) {
    super(app);
    this.plugin = plugin;
    this.onSettingsChanged = onSettingsChanged;
  }

  onOpen() {
    this.modalEl.addClass('mod-sidebar-layout', 'nene-settings-panel-modal', 'nene-organizer-modal');
    this.contentEl.empty();
    this.contentEl.addClass('nene-settings-modal');
    void this.render();
  }

  /**
   * 根据当前状态栏元素和已保存配置渲染界面。
   */
  async render() {
    var contentEl = this.contentEl;
    contentEl.empty();

    renderModalHeader(
      contentEl,
      '状态栏元素管理',
      '拖动行左侧手柄可调整元素顺序，点击眼睛图标切换显示/隐藏。'
    );

    // 获取状态栏元素列表和已保存元素状态
    var statusBar = this.plugin.getStatusBarElement();
    var savedElements = this.plugin.getOrganizerSettings();

    if (!statusBar) {
      contentEl.createEl('p', {
        cls: 'nene-organizer-empty',
        text: '未检测到状态栏，该功能仅桌面端可用。'
      });
      return;
    }

    // 整理元素数据（savedElements 即为 elements 对象，不需要再取 .elements）
    var consolidated = this.consolidateElements(statusBar, savedElements);

    // 设置容器
    var rowsWrapper = contentEl.createDiv({ cls: 'nene-organizer-rows-wrapper' });
    var rowsContainer = rowsWrapper.createDiv({ cls: 'nene-organizer-rows-container' });

    // 检查名称冲突
    var nameCollisions = {};
    consolidated.rows.forEach(function (element) {
      if (element.name in nameCollisions) {
        nameCollisions[element.name]++;
      } else {
        nameCollisions[element.name] = 0;
      }
    });

    // 生成每一行
    var self = this;
    consolidated.rows.forEach(function (row) {
      var currentStatus = consolidated.barStatus[row.id];

      var entry = document.createElement('div');
      entry.addClass('nene-organizer-row');
      if (!currentStatus.visible) entry.addClass('nene-organizer-row-hidden');
      entry.setAttribute('data-nene-organizer-row-id', row.id);
      row.entry = entry;
      rowsContainer.appendChild(entry);

      // 拖拽手柄
      var handle = document.createElement('span');
      handle.addClass('nene-organizer-row-handle');
      handle.addEventListener('mousedown', function (event) {
        handleMouseDown(event, self.plugin, consolidated.barStatus, rowsWrapper, rowsContainer, consolidated.rows, row);
      });
      entry.appendChild(handle);

      // 格式化显示名称
      var displayName = row.name
        .replace(/^plugin-(obsidian-)?/, '')
        .split('-')
        .map(function (x) { return x.charAt(0).toUpperCase() + x.slice(1); })
        .join(' ') + (
          nameCollisions[row.name]
            ? ' (' + row.index + ')'
            : ''
        );

      // 元素名称
      var titleSpan = document.createElement('span');
      titleSpan.addClass('nene-organizer-row-title');
      titleSpan.textContent = displayName;
      entry.appendChild(titleSpan);

      // 内容预览
      var previewSpan = document.createElement('span');
      previewSpan.addClass('nene-organizer-row-preview');
      if (row.element) {
        previewSpan.innerHTML = row.element.innerHTML;
      }
      entry.appendChild(previewSpan);

      // 可见性切换按钮
      var actionSpan = document.createElement('span');
      actionSpan.addClass('nene-organizer-row-action');
      actionSpan.onclick = function () {
        toggleVisibility(self.plugin, consolidated.barStatus, row);
      };
      obsidian.setIcon(actionSpan, currentStatus.visible ? 'eye' : 'eye-off');
      entry.appendChild(actionSpan);
    });
  }

  /**
   * 合并已保存设置与实际状态栏元素状态。
   * 新元素自动追加到末尾；已不存在的元素自动从已保存数据中清理。
   *
   * @param {Element} statusBar - .status-bar 容器
   * @param {object} savedElements - 已保存的元素状态 { [id]: { position, visible } }
   * @returns {{ rows: Array, barStatus: object }}
   */
  consolidateElements(statusBar, savedElements) {
    var unorderedElements = organizerRuntime.getStatusBarElements(statusBar);
    var currentIds = unorderedElements.map(function (e) { return e.id; });

    var barStatus = {};
    var rows = unorderedElements.slice();
    var insertPosition = rows.length + 1;

    // 仅保留尚存在的元素，清理已不存在的孤儿数据
    rows.forEach(function (element, index) {
      var saved = savedElements[element.id];
      barStatus[element.id] = saved || { position: index, visible: true };
    });

    // 追加已保存但之前未捕获的新元素
    Object.keys(savedElements).forEach(function (id) {
      if (currentIds.indexOf(id) === -1) return; // 已不存在，跳过
      if (id in barStatus) return;

      var status = savedElements[id];
      status.position = insertPosition++;
      barStatus[id] = status;
    });

    // 按已保存位置排序
    rows.sort(function (a, b) { return barStatus[a.id].position - barStatus[b.id].position; });

    // 保存并清理孤儿数据
    this.plugin.setOrganizerElementStatus(barStatus);

    return {
      rows: rows,
      barStatus: barStatus
    };
  }

  onClose() {
    this.contentEl.empty();
  }
}

/**
 * 切换元素可见性。
 */
function toggleVisibility(plugin, barStatus, row) {
  var status = barStatus[row.id];
  status.visible = !status.visible;

  if (status.visible) {
    if (row.element) row.element.removeClass('nene-organizer-element-hidden');
    if (row.entry) row.entry.removeClass('nene-organizer-row-hidden');
    obsidian.setIcon(row.entry.children[3], 'eye');
  } else {
    if (row.element) row.element.addClass('nene-organizer-element-hidden');
    if (row.entry) row.entry.addClass('nene-organizer-row-hidden');
    obsidian.setIcon(row.entry.children[3], 'eye-off');
  }

  plugin.setOrganizerElementStatus(barStatus);
}

/* ---------- 拖拽排序逻辑 ---------- */

function cloneRow(rowsWrapper, barStatus, rowsContainer, event, row) {
  var realEntry = row.entry;
  realEntry.addClass('nene-organizer-row-clone');

  var fauxEntry = document.createElement('div');
  fauxEntry.addClass('nene-organizer-row');
  fauxEntry.addClass('nene-organizer-row-drag');
  if (!barStatus[row.id].visible) fauxEntry.addClass('nene-organizer-row-hidden');

  rowsWrapper.appendChild(fauxEntry);

  var containerRect = rowsWrapper.getBoundingClientRect();
  fauxEntry.style.left = (realEntry.getBoundingClientRect().left - containerRect.left) + 'px';
  fauxEntry.style.top = (realEntry.getBoundingClientRect().top - containerRect.top) + 'px';
  fauxEntry.style.width = realEntry.offsetWidth + 'px';

  // 复制子元素
  Array.from(realEntry.children).forEach(function (child) {
    var fauxSpan = document.createElement('span');
    fauxSpan.className = child.className;
    fauxSpan.innerHTML = child.innerHTML;
    fauxEntry.appendChild(fauxSpan);
  });

  var offsetX = event.clientX - fauxEntry.getBoundingClientRect().left;
  var offsetY = event.clientY - fauxEntry.getBoundingClientRect().top;
  var index = Array.from(rowsContainer.children).indexOf(realEntry);

  return {
    stationaryRow: realEntry,
    movableRow: fauxEntry,
    offsetX: offsetX + containerRect.left,
    offsetY: offsetY + containerRect.top,
    index: index
  };
}

function deleteRowClone(rowsWrapper, stationaryRow, movableRow) {
  stationaryRow.removeClass('nene-organizer-row-clone');
  rowsWrapper.removeChild(movableRow);
}

function calculateRowIndex(event, rowsContainer, movableRow, stationaryRow, offsetX, offsetY, index) {
  movableRow.style.left = (event.clientX - offsetX) + 'px';
  movableRow.style.top = (event.clientY - offsetY) + 'px';

  var dist = movableRow.getBoundingClientRect().top - stationaryRow.getBoundingClientRect().top;

  if (Math.abs(dist) > stationaryRow.offsetHeight * 0.75) {
    var dir = dist > 0 ? 1 : -1;
    var newIndex = Math.max(0, Math.min(index + dir, rowsContainer.children.length - 1));
    return newIndex;
  }
  return index;
}

function handlePositionChange(barStatus, rowsContainer, rows, row, stationaryRow, newIndex) {
  var passedEntry = rowsContainer.children[newIndex];
  var passedId = passedEntry.getAttribute('data-nene-organizer-row-id');

  if (row.element) {
    var statusBarChangeRequired = barStatus[passedId] != null;
    if (statusBarChangeRequired) {
      var passedElement = rows.filter(function (x) { return x.id === passedId; })[0].element;
      var temp = passedElement.style.order;
      passedElement.style.order = row.element.style.order;
      row.element.style.order = temp;
    }
  }

  rowsContainer.removeChild(stationaryRow);
  if (newIndex !== rowsContainer.children.length) {
    rowsContainer.insertBefore(stationaryRow, rowsContainer.children[newIndex]);
  } else {
    rowsContainer.appendChild(stationaryRow);
  }

  Array.from(rowsContainer.children).forEach(function (entry, idx) {
    var id = entry.getAttribute('data-nene-organizer-row-id');
    barStatus[id].position = idx;
  });
}

function handleMouseDown(event, plugin, barStatus, rowsWrapper, rowsContainer, rows, row) {
  if (dragging) return;
  dragging = true;
  event.preventDefault();

  var cloneData = cloneRow(rowsWrapper, barStatus, rowsContainer, event, row);
  var index = cloneData.index;

  function onMouseMove(moveEvent) {
    moveEvent.preventDefault();
    plugin.getOrganizerSpooler().disableObserver();

    var newIndex = calculateRowIndex(moveEvent, rowsContainer, cloneData.movableRow, cloneData.stationaryRow, cloneData.offsetX, cloneData.offsetY, index);
    if (newIndex !== index) {
      handlePositionChange(barStatus, rowsContainer, rows, row, cloneData.stationaryRow, newIndex);
      index = newIndex;
    }

    plugin.getOrganizerSpooler().enableObserver();
  }

  function onMouseUp() {
    deleteRowClone(rowsWrapper, cloneData.stationaryRow, cloneData.movableRow);
    dragging = false;

    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);

    // 保存最终状态
    plugin.setOrganizerElementStatus(barStatus);
  }

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

module.exports = {
  StatusBarOrganizerModal: StatusBarOrganizerModal
};
