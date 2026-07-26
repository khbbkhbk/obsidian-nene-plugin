'use strict';

/**
 * 状态栏元素管理运行时
 *
 * 负责解析状态栏元素、监听变化并自动恢复排序与可见性。
 * 从 Opisek/obsidian-statusbar-organizer 移植的核心逻辑，已去除预设与全屏分离功能。
 */

// 解析元素时忽略的内部 class（包含本插件已有状态栏项目）
var IGNORED_CLASSES = [
  'mod-clickable',
  'status-bar-item',
  'nene-status-bar-enhancer',
  'nene-status-bar-timestamp'
];

/**
 * 解析状态栏子元素列表，为每个元素生成唯一 ID。
 * 同一 name 的多个元素通过序号区分。
 *
 * @param {Element} statusBar - .status-bar 容器
 * @returns {Array<{name: string, index: number, id: string, element: HTMLElement}>}
 */
function getStatusBarElements(statusBar) {
  var elements = [];
  var nameCount = {};

  Array.from(statusBar.children).forEach(function (element) {
    var id = element.getAttribute('data-nene-organizer-id');
    var name, index;

    if (id == null) {
      name = Array
        .from(element.classList)
        .filter(function (cls) { return IGNORED_CLASSES.indexOf(cls) === -1; })
        .join('-');

      index = (name in nameCount) ? nameCount[name] + 1 : 1;
      id = name + ';' + index;
      element.setAttribute('data-nene-organizer-id', id);
    } else {
      var parsed = parseElementId(id);
      name = parsed.name;
      index = parsed.index;
    }

    nameCount[name] = Math.max(index, name in nameCount ? nameCount[name] : 0);

    elements.push({
      name: name,
      index: index,
      id: id,
      element: element
    });
  });

  return elements;
}

/**
 * 从元素 ID 中解析出名称和序号。
 *
 * @param {string} id - 例如 "plugin-obsidian-xxx;1"
 * @returns {{name: string, index: number}}
 */
function parseElementId(id) {
  var parts = id.split(';');
  var index = Number.parseInt(parts.pop(), 10);
  var name = parts.join(';');
  return { name: name, index: index };
}

/**
 * 根据已保存的元素状态，重新排序并设置可见性。
 * 未知元素（新出现）自动追加到末尾。
 *
 * @param {Element} statusBar - .status-bar 容器
 * @param {object} elementStatus - { [elementId]: { position: number, visible: boolean } }
 */
function fixOrder(statusBar, elementStatus) {
  var elements = getStatusBarElements(statusBar);
  var known = [];
  var orphans = [];

  for (var i = 0; i < elements.length; i++) {
    var element = elements[i];
    if (element.id in elementStatus) {
      var status = elementStatus[element.id];
      known.push([element, status.position]);
      if (status.visible) {
        element.element.removeClass('nene-organizer-element-hidden');
      } else {
        element.element.addClass('nene-organizer-element-hidden');
      }
    } else {
      orphans.push(element.element);
    }
  }

  // 按已保存位置升序排列
  known.sort(function (a, b) { return a[1] - b[1]; });
  var orderedElements = known.map(function (entry) { return entry[0].element; });

  // 新元素追加到末尾
  var allElements = orderedElements.concat(orphans);

  // 通过 CSS order 重置显示顺序
  allElements.forEach(function (element, idx) {
    element.style.order = (idx + 1).toString();
  });
}

/**
 * Spooler — 使用 MutationObserver 监听状态栏子节点变化，自动调度排序修复。
 */
class OrganizerSpooler {
  /**
   * @param {Element} statusBar - .status-bar 容器
   * @param {Function} elementStatusProvider - 返回当前元素状态对象 { id: { position, visible } }
   * @param {Function} onFix - 排序修复完成后的回调（可选）
   */
  constructor(statusBar, elementStatusProvider, onFix) {
    this.statusBar = statusBar;
    this.elementStatusProvider = elementStatusProvider;
    this.onFix = onFix || function () {};
    this.mutex = false;
    this.spooler = null;
    this.observer = null;

    this.observer = new MutationObserver((function (_this) {
      return function (mutations) {
        if (_this.mutex) return;
        var hasAdded = mutations.some(function (m) {
          return m.type === 'childList' && m.addedNodes.length > 0;
        });
        if (hasAdded) {
          _this.scheduleFix(0);
        }
      };
    })(this));
  }

  /**
   * 启动 MutationObserver 监听。
   */
  start() {
    this.observer.observe(this.statusBar, { childList: true });
  }

  /**
   * 停止监听并清除待执行的排序任务。
   */
  stop() {
    if (this.observer) {
      this.observer.disconnect();
    }
    clearTimeout(this.spooler);
  }

  /**
   * 暂停监听（拖拽操作时调用，避免干扰）。
   */
  disableObserver() {
    this.observer.disconnect();
  }

  /**
   * 恢复监听（拖拽操作结束后调用）。
   */
  enableObserver() {
    this.observer.observe(this.statusBar, { childList: true });
  }

  /**
   * 安排一次排序修复，多次调用会合并为一次。
   *
   * @param {number} timeout - 延迟毫秒数，默认 1000
   */
  scheduleFix(timeout) {
    clearTimeout(this.spooler);
    if (typeof timeout !== 'number') timeout = 1000;

    this.spooler = setTimeout((function (_this) {
      return function () {
        if (_this.mutex) {
          _this.scheduleFix();
          return;
        }
        _this.mutex = true;
        _this.disableObserver();

        var elementStatus = _this.elementStatusProvider();
        fixOrder(_this.statusBar, elementStatus);
        _this.onFix();

        _this.enableObserver();
        _this.mutex = false;
      };
    })(this), timeout);
  }
}

module.exports = {
  getStatusBarElements: getStatusBarElements,
  parseElementId: parseElementId,
  fixOrder: fixOrder,
  OrganizerSpooler: OrganizerSpooler
};
