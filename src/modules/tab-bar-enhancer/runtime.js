'use strict';

var obsidian = require('obsidian');

// 标签头与标签栏容器的选择器，用于判断滚轮事件是否发生在标签区域。
const TAB_HEADER_SELECTOR = '.workspace-tab-header';
const TAB_HEADER_CONTAINER_SELECTOR = '.workspace-tab-header-container';

// 挂载在 body 上的实验性开关 class，配合样式文件关闭标签栏空白区的窗口拖拽区域。
const TOP_BAR_WHEEL_CLASS = 'nene-tab-bar-wheel-switch';

// 调试模式下短暂高亮命中元素所用的 class 名称。
const DEBUG_HIGHLIGHT_CLASS = 'nene-tab-debug-highlight';
const DEBUG_HIGHLIGHT_YELLOW_CLASS = 'nene-tab-debug-yellow';
const DEBUG_HIGHLIGHT_RED_CLASS = 'nene-tab-debug-red';

// 定义标签栏增强运行时，负责滚轮事件注册、标签定位与左右循环切换。
// 注意：滚轮切换标签依赖若干未文档化的内部 API（均以 @private-api 标注），
// 已在 Obsidian v1.4.16 桌面端验证可用，后续版本存在失效风险。
class TabBarEnhancerRuntime {
  constructor(plugin) {
    this.plugin = plugin; // 保存插件实例，便于读取配置与工作区状态
    this.settings = null; // 缓存最近一次加载的配置
    this.registeredWindows = new Set(); // 记录已注册滚轮监听的窗口，避免重复挂载
  }

  // 挂载最新配置。
  load(settings) {
    this.settings = settings || this.plugin.tabBarEnhancerStore.getSettings();
  }

  // 启动标签栏增强，同步 body 上的实验性 class；滚轮监听由主入口统一注册。
  start() {
    this.syncTopBarWheelClass(true);
  }

  // 停止标签栏增强，移除 body 上的实验性 class；滚轮监听随插件卸载自动回收。
  stop() {
    document.body.classList.toggle(TOP_BAR_WHEEL_CLASS, false);
  }

  // 根据模块开关与配置同步 body 上的实验性 class，供启停与配置变更时调用。
  syncTopBarWheelClass(moduleEnabled) {
    const shouldEnable = Boolean(moduleEnabled) && this.getTopBarWheelTabSwitch();
    document.body.classList.toggle(TOP_BAR_WHEEL_CLASS, shouldEnable);
  }

  // 为当前全部工作区窗口注册滚轮监听，供布局就绪后调用。
  registerWheelHandlersForExistingWindows() {
    this.getAllWorkspaceWindows().forEach((win) => {
      this.registerWheelHandler(win);
    });
  }

  // 为单个窗口注册滚轮监听，重复注册时直接跳过。
  registerWheelHandler(win) {
    if (!win || this.registeredWindows.has(win)) {
      return;
    }

    this.registeredWindows.add(win);
    this.plugin.registerDomEvent(win, 'wheel', (evt) => {
      this.handleWheelEvent(win, evt);
    });
  }

  // 弹出窗口关闭时移除记录，避免缓存持有已销毁的窗口对象。
  unregisterWheelHandler(win) {
    this.registeredWindows.delete(win);
  }

  // 处理滚轮事件，根据滚动方向切换到左邻或右邻标签。
  handleWheelEvent(win, evt) {
    if (!this.plugin.isTabBarEnhancerEnabled()) {
      return;
    }

    const leaf = this.findLeafByWheelEvent(evt);
    if (!leaf) {
      return;
    }

    // 确保承载标签的窗口获得焦点，避免切换后焦点仍停留在其他窗口。
    this.focusElectronWindow(win);

    const skipOptions = {
      skipCssHiddenTabs: this.getSkipCssHiddenTabs(),
      skipUnloadedPluginTabs: this.getSkipUnloadedPluginTabs()
    };

    if (evt.deltaY <= 0) {
      this.gotoSiblingTab(leaf, -1, skipOptions);
    } else {
      this.gotoSiblingTab(leaf, 1, skipOptions);
    }
  }

  // 根据滚轮事件定位所属标签对应的工作区面板，未命中标签区域时返回空值。
  findLeafByWheelEvent(evt) {
    this.logDebug('开始定位滚轮事件对应的标签', evt);

    if (!this.checkIsWheelInTabContainer(evt)) {
      this.logDebug('滚轮事件不在标签区域内，提前返回');
      return null;
    }

    const targetEl = evt.target instanceof Element ? evt.target : null;
    const wheeledTabContainer = targetEl ? targetEl.closest(TAB_HEADER_CONTAINER_SELECTOR) : null;
    if (!wheeledTabContainer) {
      this.logDebug('未找到标签栏容器，提前返回');
      return null;
    }

    if (this.getDebug()) {
      this.highlightElement(wheeledTabContainer, DEBUG_HIGHLIGHT_YELLOW_CLASS);
    }

    // 优先取当前激活的标签头，取不到时退化为容器内第一个标签头。
    const wheeledTabHeader =
      wheeledTabContainer.find(`${TAB_HEADER_SELECTOR}.is-active`) ||
      wheeledTabContainer.find(TAB_HEADER_SELECTOR);
    if (!wheeledTabHeader) {
      this.logDebug('未找到标签头，提前返回');
      return null;
    }

    if (this.getDebug()) {
      this.highlightElement(wheeledTabHeader, DEBUG_HIGHLIGHT_RED_CLASS);
    }

    // @private-api 依赖未文档化的 leaf.tabHeaderEl 与 leaf.id，用于把 DOM 标签头反查为工作区面板。
    const wheeledLeaf = this.getAllLeaves().find((leaf) =>
      leaf.tabHeaderEl && leaf.tabHeaderEl.isEqualNode(wheeledTabHeader)
    );
    if (!wheeledLeaf) {
      this.logDebug('未找到标签头对应的工作区面板，提前返回');
      return null;
    }

    if (this.getDebug()) {
      this.highlightLeaf(wheeledLeaf);
    }

    // @private-api 依赖未文档化的 leaf.parentSplit 与 split.containerEl，用于定位标签所在的分栏。
    const wheeledParent = this.getAllWorkspaceParents().find((split) =>
      split.containerEl && split.containerEl.contains(wheeledTabHeader)
    );
    if (!wheeledParent) {
      this.logDebug('未找到标签所在的分栏，提前返回');
      return null;
    }

    // @private-api 依赖未文档化的 split.children，用于在分栏内精确定位目标面板。
    const foundLeaf = (wheeledParent.children || []).find(
      (leaf) => leaf instanceof obsidian.WorkspaceLeaf && leaf.id === wheeledLeaf.id
    );

    this.logDebug('定位完成', foundLeaf);
    return foundLeaf || null;
  }

  // 判断滚轮事件是否发生在标签头或标签栏容器内。
  // 使用 Element 而非 HTMLElement 判定，兼容标签头内 SVG 图标上触发的滚轮事件。
  checkIsWheelInTabContainer(evt) {
    const targetEl = evt.target instanceof Element ? evt.target : null;
    if (!targetEl) {
      return false;
    }

    return Boolean(targetEl.closest(TAB_HEADER_SELECTOR) || targetEl.closest(TAB_HEADER_CONTAINER_SELECTOR));
  }

  // 切换到指定方向的相邻标签，到达边界时循环，并按配置跳过特定标签。
  gotoSiblingTab(argLeaf, direction, skipOptions) {
    // @private-api 依赖未文档化的 leaf.parentSplit 与 split.children，用于按标签顺序导航。
    const parentSplit = argLeaf.parentSplit;
    if (!parentSplit || !Array.isArray(parentSplit.children)) {
      return;
    }

    const siblingLeaves = parentSplit.children.filter(
      (item) => item instanceof obsidian.WorkspaceLeaf
    );
    const index = siblingLeaves.findIndex((leaf) => leaf.id === argLeaf.id);
    if (index === -1) {
      return;
    }

    let targetIndex = index;
    let steps = 0;
    const maxSteps = siblingLeaves.length;

    while (steps < maxSteps) {
      targetIndex += direction;

      if (targetIndex < 0) {
        targetIndex = siblingLeaves.length - 1;
      } else if (targetIndex >= siblingLeaves.length) {
        targetIndex = 0;
      }

      steps++;

      if (!this.shouldSkipLeaf(siblingLeaves[targetIndex], skipOptions)) {
        break;
      }
    }

    this.focusLeaf(siblingLeaves[targetIndex]);
  }

  // 判断目标标签是否需要按配置跳过。
  shouldSkipLeaf(leaf, skipOptions) {
    if (skipOptions.skipCssHiddenTabs && this.isTabHeaderHidden(leaf)) {
      return true;
    }

    if (skipOptions.skipUnloadedPluginTabs && this.isUnloadedPluginLeaf(leaf)) {
      return true;
    }

    return false;
  }

  // 判断标签头是否被 CSS 隐藏（自身或祖先节点 display: none）。
  isTabHeaderHidden(leaf) {
    // @private-api 依赖未文档化的 leaf.tabHeaderEl。
    const tabHeaderEl = leaf ? leaf.tabHeaderEl : null;
    if (!tabHeaderEl) {
      return true;
    }

    return !tabHeaderEl.isShown();
  }

  // 判断标签所属插件是否尚未加载，通过 Obsidian 未知视图使用的幽灵图标识别。
  isUnloadedPluginLeaf(leaf) {
    // @private-api 依赖未文档化的 leaf.tabHeaderEl，以及内部未知视图使用 lucide-ghost 图标的实现细节。
    const iconEl = leaf && leaf.tabHeaderEl ? leaf.tabHeaderEl.find('svg') : null;
    return Boolean(iconEl && iconEl.classList.contains('lucide-ghost'));
  }

  // 激活目标面板并处理搜索视图等需要额外聚焦输入框的特殊情况。
  focusLeaf(leaf) {
    if (!leaf) {
      return;
    }

    this.plugin.app.workspace.setActiveLeaf(leaf, { focus: true });

    if (leaf.getViewState().type === 'search') {
      const searchInputEl = leaf.view.containerEl.find('.search-input-container input');
      if (searchInputEl) {
        searchInputEl.focus();
      }
    }
  }

  // 聚焦承载标签的 Electron 窗口，平台不支持时静默跳过。
  focusElectronWindow(win) {
    // @private-api 依赖 Electron 渲染窗口上未文档化的 electronWindow 对象，仅桌面端存在。
    const electronWindow = win ? win.electronWindow : null;
    if (electronWindow && typeof electronWindow.focus === 'function') {
      electronWindow.focus();
    }
  }

  // 返回当前全部工作区面板。
  getAllLeaves() {
    const leaves = [];
    this.plugin.app.workspace.iterateAllLeaves((leaf) => {
      leaves.push(leaf);
    });
    return leaves;
  }

  // 返回当前全部工作区窗口对象，按窗口去重。
  getAllWorkspaceWindows() {
    const windows = new Set();
    this.plugin.app.workspace.iterateAllLeaves((leaf) => {
      const container = leaf.getContainer();
      if (container && container.win) {
        windows.add(container.win);
      }
    });
    return Array.from(windows);
  }

  // 返回当前全部工作区分栏，按对象去重。
  getAllWorkspaceParents() {
    const parents = new Set();
    this.plugin.app.workspace.iterateAllLeaves((leaf) => {
      // @private-api 依赖未文档化的 leaf.parentSplit。
      if (leaf.parentSplit) {
        parents.add(leaf.parentSplit);
      }
    });
    return Array.from(parents);
  }

  // 调试模式下短暂高亮指定元素，便于确认滚轮命中的标签区域。
  highlightElement(el, colorClass) {
    el.addClass(DEBUG_HIGHLIGHT_CLASS, colorClass);
    window.setTimeout(() => {
      el.removeClass(DEBUG_HIGHLIGHT_CLASS, colorClass);
    }, 300);
  }

  // 调试模式下短暂高亮整个面板，平台不支持时静默跳过。
  highlightLeaf(leaf) {
    // @private-api 依赖未文档化的 leaf.highlight / leaf.unhighlight。
    if (typeof leaf.highlight === 'function' && typeof leaf.unhighlight === 'function') {
      leaf.highlight();
      window.setTimeout(() => leaf.unhighlight(), 300);
    }
  }

  // 仅在调试模式开启时输出控制台日志。
  logDebug(...args) {
    if (this.getDebug()) {
      console.debug('[ねね] 标签栏增强', ...args);
    }
  }

  // 返回“空白标签区滚轮切换”开关。
  getTopBarWheelTabSwitch() {
    return this.settings?.topBarWheelTabSwitch === true;
  }

  // 返回“跳过 CSS 隐藏的标签”开关。
  getSkipCssHiddenTabs() {
    return this.settings?.skipCssHiddenTabs !== false;
  }

  // 返回“跳过未加载插件的标签”开关。
  getSkipUnloadedPluginTabs() {
    return this.settings?.skipUnloadedPluginTabs !== false;
  }

  // 返回“调试模式”开关。
  getDebug() {
    return this.settings?.debug === true;
  }
}

module.exports = {
  TabBarEnhancerRuntime
};
