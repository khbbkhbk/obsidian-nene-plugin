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

/**
 * 计算鼠标当前位置对应的目标插入索引（基于各行中点，跳过被拖拽行）。
 * 返回值相对于非克隆行的顺序（0 = 最前，length = 末尾）。
 */
function calculateTargetIndex(event, rowsContainer) {
  var children = Array.from(rowsContainer.children);
  var mouseY = event.clientY;
  var nonCloneCount = 0;

  for (var i = 0; i < children.length; i++) {
    if (children[i].classList.contains('nene-organizer-row-clone')) continue;
    var rect = children[i].getBoundingClientRect();
    nonCloneCount++;

    if (mouseY < rect.top + rect.height / 2) {
      return nonCloneCount - 1;
    }
  }

  return nonCloneCount;
}

/**
 * 清除所有行上的拖拽目标高亮。
 */
function clearDropIndicator(rowsContainer) {
  Array.from(rowsContainer.children).forEach(function (entry) {
    entry.removeClass('nene-organizer-row-drop-target');
  });
}

/**
 * 在目标位置的行上添加拖拽目标高亮。
 */
function updateDropIndicator(rowsContainer, targetIndex) {
  clearDropIndicator(rowsContainer);

  var children = Array.from(rowsContainer.children);
  var nonCloneIdx = -1;

  for (var i = 0; i < children.length; i++) {
    if (children[i].classList.contains('nene-organizer-row-clone')) continue;
    nonCloneIdx++;
    if (nonCloneIdx === targetIndex) {
      children[i].addClass('nene-organizer-row-drop-target');
      break;
    }
  }
}

/**
 * 将非克隆索引转换为 rowsContainer 中的绝对索引。
 */
function toAbsoluteIndex(rowsContainer, nonCloneIndex) {
  var children = rowsContainer.children;
  var nonCloneIdx = -1;

  for (var i = 0; i < children.length; i++) {
    if (children[i].classList.contains('nene-organizer-row-clone')) continue;
    nonCloneIdx++;
    if (nonCloneIdx === nonCloneIndex) {
      return i;
    }
  }

  return children.length;
}

/**
 * 拖拽结束时执行最终 DOM 重排 + 状态栏 CSS order 同步 + 保存。
 */
function applyFinalReorder(plugin, barStatus, rowsContainer, rows, row, stationaryRow, targetNonCloneIndex) {
  var absIndex = toAbsoluteIndex(rowsContainer, targetNonCloneIndex);
  var currentAbsIndex = Array.from(rowsContainer.children).indexOf(stationaryRow);

  if (absIndex === currentAbsIndex) return;

  // 重排行容器 DOM
  rowsContainer.removeChild(stationaryRow);
  if (absIndex !== rowsContainer.children.length) {
    rowsContainer.insertBefore(stationaryRow, rowsContainer.children[absIndex]);
  } else {
    rowsContainer.appendChild(stationaryRow);
  }

  // 更新 barStatus 中所有行的 position，并立即同步状态栏元素的 CSS order
  Array.from(rowsContainer.children).forEach(function (entry, idx) {
    var id = entry.getAttribute('data-nene-organizer-row-id');
    barStatus[id].position = idx;
    var rowData = rows.filter(function (r) { return r.id === id; })[0];
    if (rowData && rowData.element) {
      rowData.element.style.order = (idx + 1).toString();
    }
  });

  // 持久化
  plugin.setOrganizerElementStatus(barStatus);
}

/**
 * 清理拖拽视觉状态：移除监听、还原克隆、清除高亮、释放锁、恢复 Observer。
 * 注意：此函数不保存 barStatus，调用方需自行决定是否保存。
 */
function cleanupDragVisuals(plugin, rowsWrapper, rowsContainer, cloneData) {
  clearDropIndicator(rowsContainer);
  if (cloneData) {
    deleteRowClone(rowsWrapper, cloneData.stationaryRow, cloneData.movableRow);
  }
  dragging = false;
  plugin.getOrganizerSpooler().enableObserver();
}

function handleMouseDown(event, plugin, barStatus, rowsWrapper, rowsContainer, rows, row) {
  if (dragging) return;
  dragging = true;
  event.preventDefault();

  var cloneData = cloneRow(rowsWrapper, barStatus, rowsContainer, event, row);
  // 被拖拽行在非克隆行中的起始索引（用 barStatus 中已保存的 position，不受 cloneRow 添加的 class 影响）
  var targetIndex = barStatus[row.id].position;

  // 拖拽期间禁用 Observer，避免干扰
  plugin.getOrganizerSpooler().disableObserver();

  // 初始化目标行高亮
  updateDropIndicator(rowsContainer, targetIndex);

  function onMouseMove(moveEvent) {
    moveEvent.preventDefault();

    // 更新克隆体跟随鼠标
    cloneData.movableRow.style.left = (moveEvent.clientX - cloneData.offsetX) + 'px';
    cloneData.movableRow.style.top = (moveEvent.clientY - cloneData.offsetY) + 'px';

    // 基于行中点计算新目标位置，只更新高亮，不动 DOM
    var newTarget = calculateTargetIndex(moveEvent, rowsContainer);
    if (newTarget !== targetIndex) {
      targetIndex = newTarget;
      updateDropIndicator(rowsContainer, targetIndex);
    }
  }

  function onMouseUp() {
    cleanupMouseDownListeners();
    applyFinalReorder(plugin, barStatus, rowsContainer, rows, row, cloneData.stationaryRow, targetIndex);
    cleanupDragVisuals(plugin, rowsWrapper, rowsContainer, cloneData);
  }

  function cleanupMouseDownListeners() {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('blur', onWindowBlur);
  }

  // 兜底：窗口失去焦点时释放拖拽锁（如鼠标在浏览器外释放），不做任何重排
  function onWindowBlur() {
    cleanupMouseDownListeners();
    cleanupDragVisuals(plugin, rowsWrapper, rowsContainer, cloneData);
  }

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('blur', onWindowBlur);
}

module.exports = {
  StatusBarOrganizerModal: StatusBarOrganizerModal
};
