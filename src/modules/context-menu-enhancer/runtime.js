'use strict';

var obsidian = require('obsidian');
var constants = require('./constants');

// 定义运行时菜单重构器，负责拦截菜单显示、识别类型并按配置重排 DOM。
class MenuCustomizerRuntime {
  constructor(plugin) {
    this.plugin = plugin; // 保存插件实例，便于读取最新配置与输出日志
    this.settings = constants.createDefaultMenuCustomizerSettings(); // 缓存最近一次加载的配置
    this.originalShowAtMouseEvent = null; // 保存原始菜单显示方法，关闭模块时用于恢复
    this.originalShowAtPosition = null; // 保存原始定位显示方法，兼容子菜单与程序化打开
    this.isPatched = false; // 标记当前是否已完成原型打补丁，避免重复覆盖
  }

  // 挂载最新配置，供显示菜单前即时读取。
  load(settings) {
    this.settings = settings || constants.createDefaultMenuCustomizerSettings();
  }

  // 启动菜单拦截。
  start() {
    if (this.isPatched) {
      return;
    }

    this.patchMenuMethods();
  }

  // 停止菜单拦截并恢复原始方法。
  stop() {
    if (this.originalShowAtMouseEvent) {
      obsidian.Menu.prototype.showAtMouseEvent = this.originalShowAtMouseEvent;
    }

    if (this.originalShowAtPosition) {
      obsidian.Menu.prototype.showAtPosition = this.originalShowAtPosition;
    }

    this.originalShowAtMouseEvent = null;
    this.originalShowAtPosition = null;
    this.isPatched = false;
  }

  // 为文件或文件夹菜单打上上下文标记，提升识别稳定性。
  annotateFileMenu(menu, file) {
    if (!menu) {
      return;
    }

    menu.__neneMenuContext = {
      source: 'file-menu',
      fileKind:
        file instanceof obsidian.TFolder
          ? 'folder'
          : file instanceof obsidian.TFile
            ? 'file'
            : 'abstract'
    };
  }

  // 为编辑区菜单打上上下文标记，便于区分右键菜单与更多选项菜单。
  annotateEditorMenu(menu) {
    if (!menu) {
      return;
    }

    menu.__neneMenuContext = {
      source: 'editor-menu'
    };
  }

  // 拦截菜单显示方法，在真正显示前先重构 DOM。
  patchMenuMethods() {
    const runtime = this;
    this.originalShowAtMouseEvent = obsidian.Menu.prototype.showAtMouseEvent;
    this.originalShowAtPosition = obsidian.Menu.prototype.showAtPosition;

    if (typeof this.originalShowAtMouseEvent === 'function') {
      obsidian.Menu.prototype.showAtMouseEvent = function wrappedShowAtMouseEvent(event) {
        runtime.onBeforeMenuShow(this);
        const result = runtime.originalShowAtMouseEvent.call(this, event);
        runtime.onAfterMenuShow(this);
        return result;
      };
    }

    if (typeof this.originalShowAtPosition === 'function') {
      obsidian.Menu.prototype.showAtPosition = function wrappedShowAtPosition(position) {
        runtime.onBeforeMenuShow(this);
        const result = runtime.originalShowAtPosition.call(this, position);
        runtime.onAfterMenuShow(this);
        return result;
      };
    }

    this.isPatched = true;
  }

  // 在菜单显示前应用当前配置，失败时自动回退到原始菜单。
  onBeforeMenuShow(menu) {
    if (!menu || menu.__neneSkipCustomize || menu.__neneMenuCustomized) {
      return;
    }

    const menuType = this.detectMenuType(menu);
    if (!menuType) {
      return;
    }

    const menuConfig = this.settings.menus?.[menuType];
    if (!menuConfig || menuConfig.enabled !== true) {
      return;
    }

    try {
      this.rebuildMenu(menu, menuType, menuConfig);
      menu.__neneMenuCustomized = true;
    } catch (error) {
      console.error('[ねね] 右键菜单重构失败', error);
    }
  }

  // 在 Obsidian 完成真实菜单渲染后，再包装图标组/网格组，避免被内部重排抹平。
  onAfterMenuShow(menu) {
    if (!menu?.dom || menu.__neneSkipCustomize !== true && menu.__neneMenuCustomized !== true) {
      return;
    }

    window.requestAnimationFrame(() => {
      this.wrapRenderedGroups(menu);
    });
  }

  // 根据上下文和标题特征识别当前菜单类型。
  detectMenuType(menu) {
    const context = menu.__neneMenuContext || {};
    if (context.fileKind === 'folder') {
      return 'folder';
    }

    if (context.fileKind === 'file') {
      return 'file';
    }

    const entries = this.collectMenuEntries(menu, null);
    const titles = entries.map((entry) => entry.title);
    const normalizedTitleSet = new Set(titles.map((title) => this.normalizeText(title)));
    const hasEditSection = entries.some((entry) => entry.section === 'edit');

    if (
      hasEditSection
      && (
        normalizedTitleSet.has(this.normalizeText('剪切'))
        || normalizedTitleSet.has(this.normalizeText('Cut'))
        || normalizedTitleSet.has(this.normalizeText('复制'))
        || normalizedTitleSet.has(this.normalizeText('Copy'))
      )
    ) {
      return 'editor';
    }

    if (context.source === 'editor-menu') {
      return 'moreOptions';
    }

    if (
      normalizedTitleSet.has(this.normalizeText('新建笔记'))
      || normalizedTitleSet.has(this.normalizeText('New note'))
      || normalizedTitleSet.has(this.normalizeText('新建文件夹'))
      || normalizedTitleSet.has(this.normalizeText('New folder'))
    ) {
      return 'folder';
    }

    if (
      normalizedTitleSet.has(this.normalizeText('打开'))
      || normalizedTitleSet.has(this.normalizeText('Open'))
      || normalizedTitleSet.has(this.normalizeText('打开链接'))
      || normalizedTitleSet.has(this.normalizeText('Open link'))
      || normalizedTitleSet.has(this.normalizeText('重命名'))
      || normalizedTitleSet.has(this.normalizeText('Rename'))
    ) {
      return 'file';
    }

    return null;
  }

  // 按配置重排菜单内容；根级结构严格按设置渲染，未配置项统一后置。
  rebuildMenu(menu, menuType, menuConfig) {
    if (!menu.dom || !Array.isArray(menu.items)) {
      return;
    }

    const collectedEntries = this.collectMenuEntries(menu, menuType);
    const recognizedByCommandId = new Map();
    const orderedConfiguredCommandIds = this.getOrderedConfiguredCommandIds(menuConfig);
    const nextRootItems = [];
    const renderedCommandIds = new Set();
    const menuEl = menu.dom;

    collectedEntries.forEach((entry) => {
      if (!entry.commandId) {
        return;
      }

      const override = menuConfig.commandOverrides?.[entry.commandId];
      this.applyItemOverride(entry.item, override);

      if (override?.hidden === true || recognizedByCommandId.has(entry.commandId)) {
        return;
      }

      recognizedByCommandId.set(entry.commandId, entry);
    });

    menuEl.empty();

    let hasConfiguredContent = false;
    const groupsById = new Map(menuConfig.groups.map((group) => [group.id, group]));

    menuConfig.rootItems.forEach((rootItem) => {
      if (rootItem.type === 'separator') {
        if (rootItem.hidden === true) {
          return;
        }

        this.appendSeparator(menuEl);
        return;
      }

      if (rootItem.type === 'group') {
        const group = groupsById.get(rootItem.groupId);
        const rendered = this.renderConfiguredGroup(
          menu,
          menuEl,
          group,
          recognizedByCommandId,
          renderedCommandIds,
          nextRootItems,
          menuType,
          menuConfig
        );
        hasConfiguredContent = hasConfiguredContent || rendered;
        return;
      }

      if (rootItem.type === 'command') {
        if (rootItem.hidden === true) {
          return;
        }

        const rendered = this.renderConfiguredCommand(
          menu,
          menuEl,
          menuType,
          rootItem.commandId,
          recognizedByCommandId,
          renderedCommandIds,
          nextRootItems,
          menuConfig
        );
        hasConfiguredContent = hasConfiguredContent || rendered;
      }
    });

    const leftoverEntries = collectedEntries
      .filter((entry) => {
        if (!entry.commandId) {
          return true;
        }

        const override = menuConfig.commandOverrides?.[entry.commandId];
        if (override?.hidden === true) {
          return false;
        }

        if (renderedCommandIds.has(entry.commandId)) {
          return false;
        }

        if (orderedConfiguredCommandIds.has(entry.commandId)) {
          return false;
        }

        return true;
      })
      .sort((left, right) => left.order - right.order);

    if (hasConfiguredContent && leftoverEntries.length > 0) {
      this.appendSeparator(menuEl);
    }

    leftoverEntries.forEach((entry) => {
      this.prepareRenderedItem(entry.item, entry.commandId, 'list', null, null, 'nene-tail');
      menuEl.appendChild(entry.item.dom);
      nextRootItems.push(entry.item);

      if (entry.commandId) {
        renderedCommandIds.add(entry.commandId);
      }
    });

    this.cleanupSeparators(menuEl);
    this.applyMenuClasses(menuEl, menuType);
    menu.items = nextRootItems;
  }

  // 收集菜单项并尽量解析出稳定命令标识。
  collectMenuEntries(menu, menuType) {
    const items = Array.isArray(menu.items) ? menu.items : [];

    return items
      .map((item, order) => {
        if (!item || !item.dom) {
          return null;
        }

        const title = this.getItemTitle(item);
        const section = this.getItemSection(item);
        const explicitCommandId = this.getExplicitCommandId(item);
        const commandId = explicitCommandId || this.resolveCommandId(title, section, menuType);

        return {
          item,
          title,
          section,
          order,
          commandId
        };
      })
      .filter(Boolean);
  }

  // 返回已被“排序结构”显式配置过的命令集合。
  getOrderedConfiguredCommandIds(menuConfig) {
    const commandIds = new Set();

    menuConfig.groups.forEach((group) => {
      group.commands.forEach((commandId) => commandIds.add(commandId));
    });

    menuConfig.rootItems.forEach((item) => {
      if (item.type === 'command' && item.commandId) {
        commandIds.add(item.commandId);
      }
    });

    return commandIds;
  }

  // 渲染根级分组。
  renderConfiguredGroup(menu, menuEl, group, recognizedByCommandId, renderedCommandIds, nextRootItems, menuType, menuConfig) {
    if (!group || group.hidden === true) {
      return false;
    }

    const groupEntries = [];
    group.commands.forEach((commandId) => {
      if (renderedCommandIds.has(commandId)) {
        return;
      }

      const override = menuConfig.commandOverrides?.[commandId];
      if (override?.hidden === true) {
        return;
      }

      const entry = recognizedByCommandId.get(commandId)
        || this.createSyntheticCommandEntry(menu, menuType, commandId, override);

      if (!entry) {
        return;
      }

      groupEntries.push(entry);
    });

    if (groupEntries.length === 0) {
      return false;
    }

    if (this.shouldRenderAsSubmenu(group, groupEntries)) {
      const parentItem = this.createSubmenuParent(menu, group, groupEntries, menuType);
      if (!parentItem) {
        return false;
      }

      this.prepareRenderedItem(parentItem, null, 'list', null, null, 'nene-configured');
      menuEl.appendChild(parentItem.dom);
      nextRootItems.push(parentItem);
      groupEntries.forEach((entry) => renderedCommandIds.add(entry.commandId));
      return true;
    }

    groupEntries.forEach((entry) => {
      this.prepareRenderedItem(
        entry.item,
        entry.commandId,
        group.layout,
        group.id,
        group.layout,
        'nene-configured'
      );
      menuEl.appendChild(entry.item.dom);
      nextRootItems.push(entry.item);
      renderedCommandIds.add(entry.commandId);
    });

    return true;
  }

  // 渲染根级单命令。
  renderConfiguredCommand(menu, menuEl, menuType, commandId, recognizedByCommandId, renderedCommandIds, nextRootItems, menuConfig) {
    if (!commandId || renderedCommandIds.has(commandId)) {
      return false;
    }

    const override = menuConfig.commandOverrides?.[commandId];
    if (override?.hidden === true) {
      return false;
    }

    const entry = recognizedByCommandId.get(commandId)
      || this.createSyntheticCommandEntry(menu, menuType, commandId, override);

    if (!entry) {
      return false;
    }

    this.prepareRenderedItem(entry.item, entry.commandId, 'list', null, null, 'nene-configured');
    menuEl.appendChild(entry.item.dom);
    nextRootItems.push(entry.item);
    renderedCommandIds.add(entry.commandId);
    return true;
  }

  // 返回菜单项当前标题文本。
  getItemTitle(item) {
    if (item.titleEl && typeof item.titleEl.textContent === 'string') {
      return item.titleEl.textContent.trim();
    }

    const titleEl = item.dom?.querySelector('.menu-item-title');
    return typeof titleEl?.textContent === 'string' ? titleEl.textContent.trim() : '';
  }

  // 返回菜单项的分区标识。
  getItemSection(item) {
    if (typeof item.section === 'string' && item.section.trim()) {
      return item.section.trim();
    }

    const domSection = item.dom?.getAttribute('data-section');
    return typeof domSection === 'string' ? domSection.trim() : '';
  }

  // 读取菜单项内部可能已存在的命令 ID，兼容第三方插件命令。
  getExplicitCommandId(item) {
    const candidates = [
      item.commandId,
      item.id,
      item.command?.id,
      item.command?.commandId,
      item.dom?.dataset?.commandId,
      typeof item.dom?.getAttribute === 'function' ? item.dom.getAttribute('data-command-id') : ''
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    return '';
  }

  // 根据“手动映射 + 初始内置数据”严格识别无显式 commandId 的菜单项。
  resolveCommandId(title, section, menuType) {
    if (!menuType) {
      return '';
    }

    return this.plugin.menuCustomizerStore?.resolveMappedCommandId(menuType, title, section) || '';
  }

  // 判断当前菜单分组是否应该渲染为子菜单。
  shouldRenderAsSubmenu(group, groupEntries) {
    if (group.layout === 'icon-bar' || group.layout === 'grid') {
      return false;
    }

    return group.forceSubmenu === true || groupEntries.length > 1;
  }

  // 应用标题与图标覆盖配置。
  applyItemOverride(item, override) {
    if (!override) {
      return;
    }

    if (override.title) {
      if (typeof item.setTitle === 'function') {
        item.setTitle(override.title);
      }

      if (item.titleEl) {
        item.titleEl.setText?.(override.title);
        if (typeof item.titleEl.textContent === 'string') {
          item.titleEl.textContent = override.title;
        }
      }
    }

    if (override.icon) {
      const iconEl = item.dom?.querySelector('.menu-item-icon');

      if (iconEl) {
        iconEl.empty?.();
        obsidian.setIcon(iconEl, override.icon);
      } else if (typeof item.setIcon === 'function') {
        item.setIcon(override.icon);
      }
    }
  }

  // 创建子菜单父项，并将命令节点直接移动到子菜单 DOM 中。
  createSubmenuParent(menu, group, groupEntries, menuType) {
    let parentItem = null;

    menu.addItem((item) => {
      parentItem = item;
      item.setTitle(group.name || '未命名分组');
      if (group.icon && typeof item.setIcon === 'function') {
        item.setIcon(group.icon);
      }

      if (typeof item.setSubmenu !== 'function') {
        return;
      }

      const submenu = item.setSubmenu();
      submenu.__neneSkipCustomize = true;
      submenu.__neneMenuContext = {
        source: 'nene-submenu',
        menuType
      };
      submenu.items = [];
      submenu.dom.empty();

      groupEntries.forEach((entry) => {
        this.prepareRenderedItem(entry.item, entry.commandId, 'list', null, null, 'nene-submenu');
        submenu.items.push(entry.item);
        submenu.dom.appendChild(entry.item.dom);
      });
    });

    if (!parentItem || typeof parentItem.setSubmenu !== 'function') {
      parentItem?.dom?.remove();
      return null;
    }

    parentItem.dom.classList.add('nene-menu-submenu-parent');
    return parentItem;
  }

  // 为不存在于原始右键菜单中的命令创建可执行的菜单项。
  createSyntheticCommandEntry(menu, menuType, commandId, override) {
    const metadata = this.plugin.menuCustomizerStore?.getCommandMetadata(menuType, commandId);
    if (!metadata || metadata.canExecute !== true) {
      return null;
    }

    let syntheticItem = null;
    menu.addItem((item) => {
      syntheticItem = item;
      item.setTitle(override?.title || metadata.label || commandId);

      if (override?.icon) {
        item.setIcon(override.icon);
      } else if (metadata.icon) {
        item.setIcon(metadata.icon);
      }

      item.onClick(() => {
        this.executeRegisteredCommand(commandId);
      });
    });

    if (!syntheticItem || !syntheticItem.dom) {
      return null;
    }

    if (Array.isArray(metadata.sections) && metadata.sections.length > 0) {
      syntheticItem.dom.setAttribute('data-section', metadata.sections[0]);
    }

    syntheticItem.commandId = commandId;

    return {
      item: syntheticItem,
      title: override?.title || metadata.label || commandId,
      section: Array.isArray(metadata.sections) ? metadata.sections[0] || '' : '',
      order: Number.MAX_SAFE_INTEGER,
      commandId
    };
  }

  // 执行命令注册表中的命令，失败时提示用户。
  executeRegisteredCommand(commandId) {
    const executor = this.plugin.app?.commands?.executeCommandById;
    if (typeof executor !== 'function') {
      new obsidian.Notice(`当前环境无法执行命令：${commandId}`);
      return;
    }

    try {
      const executed = executor.call(this.plugin.app.commands, commandId);
      if (executed === false) {
        new obsidian.Notice(`命令未执行：${commandId}`);
      }
    } catch (error) {
      console.error('[ねね] 执行右键菜单命令失败', commandId, error);
      new obsidian.Notice(`命令执行失败：${commandId}`);
    }
  }

  // 给已渲染的菜单项打上布局类与命令标识类，供样式层复用。
  prepareRenderedItem(item, commandId, layout, groupId, groupLayout, sectionName) {
    if (!item?.dom) {
      return;
    }

    const layoutClassNames = [
      'nene-menu-item--icon-bar',
      'nene-menu-item--grid'
    ];

    layoutClassNames.forEach((className) => item.dom.classList.remove(className));
    item.dom.classList.add('nene-menu-item');

    if (layout === 'icon-bar') {
      item.dom.classList.add('nene-menu-item--icon-bar');
    } else if (layout === 'grid') {
      item.dom.classList.add('nene-menu-item--grid');
    }

    if (typeof item.dom.setAttribute === 'function') {
      item.dom.setAttribute('data-nene-command-id', commandId || '');
      if (groupId) {
        item.dom.setAttribute('data-nene-group-id', groupId);
      } else {
        item.dom.removeAttribute('data-nene-group-id');
      }

      if (groupLayout) {
        item.dom.setAttribute('data-nene-group-layout', groupLayout);
      } else {
        item.dom.removeAttribute('data-nene-group-layout');
      }

      if (sectionName) {
        item.dom.setAttribute('data-section', sectionName);
      }
    }

    if (sectionName) {
      item.section = sectionName;
    }
  }

  // 在真实菜单 DOM 上把连续的图标组/网格组重新包成独立容器。
  wrapRenderedGroups(menu) {
    const menuEl = menu?.dom;
    if (!menuEl) {
      return;
    }

    this.unwrapRenderedGroups(menuEl);

    const children = Array.from(menuEl.children);
    let activeGroupId = '';
    let activeLayout = '';
    let activeNodes = [];

    const flushGroup = () => {
      if (activeNodes.length === 0 || !activeGroupId || !this.shouldWrapGroupLayout(activeLayout)) {
        activeGroupId = '';
        activeLayout = '';
        activeNodes = [];
        return;
      }

      const wrapperEl = document.createElement('div');
      wrapperEl.className = `nene-menu-group-wrapper nene-menu-group-wrapper--${activeLayout}`;
      wrapperEl.setAttribute('data-nene-group-id', activeGroupId);
      menuEl.insertBefore(wrapperEl, activeNodes[0]);

      activeNodes.forEach((node) => {
        wrapperEl.appendChild(node);
      });

      activeGroupId = '';
      activeLayout = '';
      activeNodes = [];
    };

    children.forEach((childEl) => {
      if (!childEl.classList.contains('menu-item')) {
        flushGroup();
        return;
      }

      const groupId = childEl.getAttribute('data-nene-group-id') || '';
      const groupLayout = childEl.getAttribute('data-nene-group-layout') || '';

      if (!groupId || !this.shouldWrapGroupLayout(groupLayout)) {
        flushGroup();
        return;
      }

      if (!activeGroupId || activeGroupId === groupId && activeLayout === groupLayout) {
        activeGroupId = groupId;
        activeLayout = groupLayout;
        activeNodes.push(childEl);
        return;
      }

      flushGroup();
      activeGroupId = groupId;
      activeLayout = groupLayout;
      activeNodes.push(childEl);
    });

    flushGroup();
  }

  // 清理旧的分组包装层，避免重复包裹。
  unwrapRenderedGroups(menuEl) {
    const wrappers = Array.from(menuEl.querySelectorAll(':scope > .nene-menu-group-wrapper'));

    wrappers.forEach((wrapperEl) => {
      while (wrapperEl.firstChild) {
        menuEl.insertBefore(wrapperEl.firstChild, wrapperEl);
      }

      wrapperEl.remove();
    });
  }

  // 只有图标组与网格组需要外层容器。
  shouldWrapGroupLayout(layout) {
    return layout === 'icon-bar' || layout === 'grid';
  }

  // 为菜单根节点添加类型与布局类，替代原有复杂的 :has CSS。
  applyMenuClasses(menuEl, menuType) {
    const rootClassNames = [
      'nene-menu-customizer-menu',
      'nene-menu-type--editor',
      'nene-menu-type--moreOptions',
      'nene-menu-type--file',
      'nene-menu-type--folder',
      'nene-menu-layout--icon-bar',
      'nene-menu-layout--grid'
    ];

    rootClassNames.forEach((className) => menuEl.classList.remove(className));
    menuEl.classList.add('nene-menu-customizer-menu', `nene-menu-type--${menuType}`);

    const iconBarItems = menuEl.querySelectorAll('.nene-menu-item--icon-bar');
    const gridItems = menuEl.querySelectorAll('.nene-menu-item--grid');

    if (iconBarItems.length > 0) {
      menuEl.classList.add('nene-menu-layout--icon-bar');
      menuEl.setAttribute('data-nene-icon-bar-count', String(iconBarItems.length));
    } else {
      menuEl.removeAttribute('data-nene-icon-bar-count');
    }

    if (gridItems.length > 0) {
      menuEl.classList.add('nene-menu-layout--grid');
    }
  }

  // 仅在需要时补一个分隔符，避免连续空分隔。
  appendSeparator(menuEl) {
    const lastChild = menuEl.lastElementChild;
    if (!lastChild) {
      return;
    }

    if (lastChild.classList.contains('menu-separator')) {
      return;
    }

    const separatorEl = document.createElement('div');
    separatorEl.className = 'menu-separator';
    menuEl.appendChild(separatorEl);
  }

  // 清理首尾与连续分隔符，确保最终菜单结构干净。
  cleanupSeparators(menuEl) {
    const children = Array.from(menuEl.children);
    let previousWasSeparator = true;

    children.forEach((childEl) => {
      const currentIsSeparator = childEl.classList.contains('menu-separator');
      if (currentIsSeparator && previousWasSeparator) {
        childEl.remove();
        return;
      }

      previousWasSeparator = currentIsSeparator;
    });

    const lastChild = menuEl.lastElementChild;
    if (lastChild?.classList.contains('menu-separator')) {
      lastChild.remove();
    }
  }

  // 统一做标题归一化，降低中英文与空白差异带来的识别误差。
  normalizeText(value) {
    return typeof value === 'string'
      ? value.trim().toLowerCase().replace(/\s+/g, ' ')
      : '';
  }
}

module.exports = {
  MenuCustomizerRuntime
};
