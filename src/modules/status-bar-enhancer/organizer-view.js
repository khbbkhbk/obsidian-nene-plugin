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
 * 状态栏元素管理弹窗。
 * 提供拖拽排序、显示/隐藏切换、孤儿条目删除与恢复。
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
      '拖动行左侧手柄可调整元素顺序，点击眼睛图标切换显示/隐藏。红色条目表示对应插件已卸载或元素已不存在，可点击垃圾桶删除，之后可通过底部"恢复"按钮还原。'
    );

    var statusBar = this.plugin.getStatusBarElement();
    var savedElements = this.plugin.getOrganizerSettings();
    var deletedIds = this.plugin.getOrganizerDeletedIds();

    if (!statusBar) {
      contentEl.createEl('p', {
        cls: 'nene-organizer-empty',
        text: '未检测到状态栏，该功能仅桌面端可用。'
      });
      return;
    }

    // 整理元素数据
    var consolidated = this.consolidateElements(statusBar, savedElements, deletedIds);

    // 设定容器
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
      var currentExists = consolidated.existsStatus[row.id];

      var entry = document.createElement('div');
      entry.addClass('nene-organizer-row');
      if (!currentExists) entry.addClass('nene-organizer-row-disabled');
      if (!currentStatus.visible) entry.addClass('nene-organizer-row-hidden');
      entry.setAttribute('data-nene-organizer-row-id', row.id);
      row.entry = entry;
      rowsContainer.appendChild(entry);

      // 拖拽手柄
      var handle = document.createElement('span');
      handle.addClass('nene-organizer-row-handle');
      handle.addEventListener('mousedown', function (event) {
        handleMouseDown(event, self.plugin, consolidated.barStatus, consolidated.existsStatus, rowsWrapper, rowsContainer, consolidated.rows, row);
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

      // 内容预览（仅当前存在的元素有预览）
      var previewSpan = document.createElement('span');
      previewSpan.addClass('nene-organizer-row-preview');
      if (currentExists && row.element) {
        // 白名单消毒：移除 <script> 标签防止 XSS，保留其余 HTML（含 SVG 图标等）
        previewSpan.innerHTML = row.element.innerHTML.replace(
          /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
          ''
        );
      }
      entry.appendChild(previewSpan);

      // 操作按钮：当前存在 → 眼睛切换可见性；孤儿 → 垃圾桶删除
      var actionSpan = document.createElement('span');
      actionSpan.addClass('nene-organizer-row-action');
      actionSpan.onclick = function () {
        if (currentExists) {
          toggleVisibility(self.plugin, consolidated.barStatus, row);
        } else {
          deleteOrphan(self.plugin, deletedIds, row, self);
        }
      };
      obsidian.setIcon(actionSpan, currentExists ? (currentStatus.visible ? 'eye' : 'eye-off') : 'trash-2');
      entry.appendChild(actionSpan);
    });

    // 已删除条目：逐条恢复 + 全部恢复
    if (consolidated.hasDeleted) {
      contentEl.createDiv({ cls: 'nene-organizer-restore-area' });

      // 逐个已删除条目
      consolidated.deletedOrphanList.forEach(function (orphan) {
        var displayName = orphan.name
          .replace(/^plugin-(obsidian-)?/, '')
          .split('-')
          .map(function (x) { return x.charAt(0).toUpperCase() + x.slice(1); })
          .join(' ') + (
            nameCollisions[orphan.name]
              ? ' (' + orphan.index + ')'
              : ''
          );

        new obsidian.Setting(contentEl)
          .setName(displayName)
          .setDesc('已删除，对应插件已卸载或元素已不存在')
          .addButton(function (button) {
            button
              .setButtonText('恢复')
              .onClick(async function () {
                var newDeletedIds = self.plugin.getOrganizerDeletedIds().filter(function (id) { return id !== orphan.id; });
                self.plugin.setOrganizerDeletedIds(newDeletedIds);
                new obsidian.Notice('已恢复：' + displayName);
                await self.render();
              });
          });
      });

      // 恢复全部按钮
      new obsidian.Setting(contentEl)
        .setName('全部恢复')
        .setDesc('将以上所有删除条目重新显示')
        .addButton(function (button) {
          button
            .setButtonText('恢复全部')
            .setCta()
            .onClick(async function () {
              self.plugin.setOrganizerDeletedIds([]);
              new obsidian.Notice('已恢复所有删除的条目');
              await self.render();
            });
        });
    }
  }

  /**
   * 合并已保存设置与实际状态栏元素状态。
   * 新元素自动追加到末尾；已保存但不存在的元素显示为孤儿条目；
   * 被删除（deletedIds）的孤儿条目不显示。
   *
   * @param {Element} statusBar - .status-bar 容器
   * @param {object} savedElements - 已保存的元素状态 { [id]: { position, visible } }
   * @param {string[]} deletedIds - 已被用户删除的条目 ID 列表
   * @returns {{ rows: Array, barStatus: object, existsStatus: object, hasDeleted: boolean }}
   */
  consolidateElements(statusBar, savedElements, deletedIds) {
    var unorderedElements = organizerRuntime.getStatusBarElements(statusBar);
    var currentIds = unorderedElements.map(function (e) { return e.id; });

    var barStatus = {};
    var existsStatus = {};

    // 遍历保存的元素，标记状态
    Object.keys(savedElements).forEach(function (id) {
      barStatus[id] = savedElements[id];
      existsStatus[id] = currentIds.indexOf(id) !== -1;
    });

    // 追加新元素（从未保存的），并自动保存以确保后续可管理
    var newElementsSaved = false;
    unorderedElements.forEach(function (element) {
      if (element.id in barStatus) return;

      var insertPosition = Object.keys(barStatus).length + 1;
      barStatus[element.id] = { position: insertPosition, visible: true };
      existsStatus[element.id] = true;
      newElementsSaved = true;
    });

    // 自动持久化新发现的元素，避免用户进入某些界面后元素消失无法管理
    if (newElementsSaved) {
      this.plugin.setOrganizerElementStatus(barStatus);
    }

    // 构建行：当前元素 + 未删除的孤儿
    var visibleOrphans = Object.keys(savedElements)
      .filter(function (id) {
        return !existsStatus[id] && deletedIds.indexOf(id) === -1;
      })
      .map(function (id) {
        var parsed = organizerRuntime.parseElementId(id);
        return { name: parsed.name, index: parsed.index, id: id };
      });

    var rows = unorderedElements.concat(visibleOrphans);
    rows.sort(function (a, b) { return barStatus[a.id].position - barStatus[b.id].position; });

    // 构建已删除的孤儿条目列表（用于逐条恢复）
    var deletedOrphanList = Object.keys(savedElements)
      .filter(function (id) {
        return !existsStatus[id] && deletedIds.indexOf(id) !== -1;
      })
      .map(function (id) {
        var parsed = organizerRuntime.parseElementId(id);
        var status = barStatus[id];
        return {
          name: parsed.name,
          index: parsed.index,
          id: id,
          position: status ? status.position : 0,
          visible: status ? status.visible : true
        };
      });

    return {
      rows: rows,
      barStatus: barStatus,
      existsStatus: existsStatus,
      hasDeleted: deletedIds.length > 0,
      deletedOrphanList: deletedOrphanList
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

/**
 * 将孤儿条目标记为已删除（隐藏），数据仍保留在存储中以便恢复。
 * 删除后重新渲染弹窗以显示恢复入口。
 */
function deleteOrphan(plugin, deletedIds, row, modalInstance) {
  deletedIds.push(row.id);
  plugin.setOrganizerDeletedIds(deletedIds);
  new obsidian.Notice('已删除该条目，可通过底部的「恢复」按钮重新显示');
  modalInstance.render();
}

/* ---------- 拖拽排序逻辑 ---------- */

function cloneRow(rowsWrapper, barStatus, existsStatus, rowsContainer, event, row) {
  var realEntry = row.entry;
  realEntry.addClass('nene-organizer-row-clone');

  var fauxEntry = document.createElement('div');
  fauxEntry.addClass('nene-organizer-row');
  fauxEntry.addClass('nene-organizer-row-drag');
  if (!existsStatus[row.id]) fauxEntry.addClass('nene-organizer-row-disabled');
  if (!barStatus[row.id].visible) fauxEntry.addClass('nene-organizer-row-hidden');

  rowsWrapper.appendChild(fauxEntry);

  var containerRect = rowsWrapper.getBoundingClientRect();
  fauxEntry.style.left = (realEntry.getBoundingClientRect().left - containerRect.left) + 'px';
  fauxEntry.style.top = (realEntry.getBoundingClientRect().top - containerRect.top) + 'px';
  fauxEntry.style.width = realEntry.offsetWidth + 'px';

  Array.from(realEntry.children).forEach(function (child) {
    var fauxSpan = document.createElement('span');
    fauxSpan.className = child.className;
    // 使用 cloneNode 替代 innerHTML 复制，避免 XSS 风险
    Array.from(child.childNodes).forEach(function (childNode) {
      fauxSpan.appendChild(childNode.cloneNode(true));
    });
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

function handlePositionChange(barStatus, existsStatus, rowsContainer, rows, row, stationaryRow, newIndex) {
  var passedEntry = rowsContainer.children[newIndex];
  var passedId = passedEntry.getAttribute('data-nene-organizer-row-id');
  var statusBarChangeRequired = existsStatus[row.id] && existsStatus[passedId];

  if (statusBarChangeRequired && row.element) {
    var passedElement = rows.filter(function (x) { return x.id === passedId; })[0].element;
    var temp = passedElement.style.order;
    passedElement.style.order = row.element.style.order;
    row.element.style.order = temp;
  }

  rowsContainer.removeChild(stationaryRow);
  if (newIndex !== rowsContainer.children.length) {
    rowsContainer.insertBefore(stationaryRow, rowsContainer.children[newIndex]);
  } else {
    rowsContainer.appendChild(stationaryRow);
  }

  Array.from(rowsContainer.children).forEach(function (entry, idx) {
    var id = entry.getAttribute('data-nene-organizer-row-id');
    if (barStatus[id]) {
      barStatus[id].position = idx;
    }
  });
}

function handleMouseDown(event, plugin, barStatus, existsStatus, rowsWrapper, rowsContainer, rows, row) {
  if (dragging) return;
  dragging = true;
  event.preventDefault();

  var cloneData = cloneRow(rowsWrapper, barStatus, existsStatus, rowsContainer, event, row);
  var index = cloneData.index;

  function onMouseMove(moveEvent) {
    moveEvent.preventDefault();
    plugin.getOrganizerSpooler().disableObserver();

    var newIndex = calculateRowIndex(moveEvent, rowsContainer, cloneData.movableRow, cloneData.stationaryRow, cloneData.offsetX, cloneData.offsetY, index);
    if (newIndex !== index) {
      handlePositionChange(barStatus, existsStatus, rowsContainer, rows, row, cloneData.stationaryRow, newIndex);
      index = newIndex;
    }

    plugin.getOrganizerSpooler().enableObserver();
  }

  function onMouseUp() {
    deleteRowClone(rowsWrapper, cloneData.stationaryRow, cloneData.movableRow);
    dragging = false;

    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);

    plugin.setOrganizerElementStatus(barStatus);
  }

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

module.exports = {
  StatusBarOrganizerModal: StatusBarOrganizerModal
};
