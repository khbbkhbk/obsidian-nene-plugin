'use strict';

var constants = require('./constants');

// 定义右键菜单配置仓库，负责细项配置的归一化、读写与设置页操作。
class MenuCustomizerStore {
  constructor(plugin) {
    this.plugin = plugin; // 保存插件实例，便于访问独立配置文件写入能力
    this.settings = this.normalizeSettings(); // 初始化默认结构，避免设置页首次打开时报空
  }

  // 挂载从独立配置文件读出的设置切片。
  load(settings) {
    this.settings = this.normalizeSettings(settings);
  }

  // 持久化当前右键菜单配置到独立 JSON 文件。
  async save() {
    this.settings = this.normalizeSettings(this.settings);
    this.plugin.dataStore.setMenuCustomizerData(this.settings);
    await this.plugin.dataStore.saveMenuCustomizerData(this.settings);

    if (this.plugin.menuCustomizerRuntime && typeof this.plugin.menuCustomizerRuntime.load === 'function') {
      this.plugin.menuCustomizerRuntime.load(this.settings);
    }
  }

  // 返回当前完整的右键菜单配置。
  getSettings() {
    return this.settings;
  }

  // 返回指定菜单类型的配置，不存在时回退到默认值。
  getMenuConfig(menuType) {
    return this.settings.menus[menuType] || this.normalizeMenuConfig(menuType);
  }

  // 返回按根级结构顺序排序后的分组列表，保证设置页展示顺序与运行时一致。
  getOrderedGroups(menuType) {
    const menuConfig = this.getMenuConfig(menuType);
    const groupsById = new Map(menuConfig.groups.map((group) => [group.id, group]));
    const orderedGroups = [];
    const seenGroupIds = new Set();

    menuConfig.rootItems.forEach((item) => {
      if (item.type !== 'group') {
        return;
      }

      const group = groupsById.get(item.groupId);
      if (!group || seenGroupIds.has(group.id)) {
        return;
      }

      seenGroupIds.add(group.id);
      orderedGroups.push(group);
    });

    menuConfig.groups.forEach((group) => {
      if (seenGroupIds.has(group.id)) {
        return;
      }

      seenGroupIds.add(group.id);
      orderedGroups.push(group);
    });

    return orderedGroups;
  }

  // 返回指定菜单类型的根级结构项，供设置页与运行时共用。
  getMenuRootItems(menuType) {
    return this.getMenuConfig(menuType).rootItems.slice();
  }

  // 返回设置页可展示的菜单类型列表。
  getMenuTypeOptions() {
    return constants.MENU_TYPE_OPTIONS.slice();
  }

  // 返回设置页可选的布局类型列表。
  getLayoutOptions() {
    return constants.GROUP_LAYOUT_OPTIONS.slice();
  }

  // 返回指定菜单类型下的手动映射列表。
  getMenuCommandMappings(menuType) {
    return this.getMenuConfig(menuType).commandMappings.slice();
  }

  // 返回当前 Obsidian 已注册的全部命令，供新增菜单命令时校验和选择。
  getRegisteredCommands() {
    const commandRegistry = this.plugin.app?.commands?.commands;
    if (!commandRegistry || typeof commandRegistry !== 'object') {
      return [];
    }

    return Object.values(commandRegistry)
      .filter((command) => command && typeof command.id === 'string' && command.id.trim())
      .map((command) => ({
        id: command.id.trim(),
        label: typeof command.name === 'string' && command.name.trim()
          ? command.name.trim()
          : command.id.trim(),
        icon: typeof command.icon === 'string' ? command.icon.trim() : '',
        aliases: [],
        sections: [],
        source: 'registered',
        canExecute: true
      }))
      .sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'));
  }

  // 判断某个命令是否存在于当前命令注册表。
  isRegisteredCommand(commandId) {
    const normalizedCommandId = typeof commandId === 'string' ? commandId.trim() : '';
    if (!normalizedCommandId) {
      return false;
    }

    return this.getRegisteredCommands().some((command) => command.id === normalizedCommandId);
  }

  // 返回某个命令在指定菜单类型下的元信息，优先采用手动映射中的真实菜单标题。
  getCommandMetadata(menuType, commandId) {
    const normalizedCommandId = typeof commandId === 'string' ? commandId.trim() : '';
    if (!normalizedCommandId) {
      return null;
    }

    const mappings = this.getCommandMappingsForCommand(menuType, normalizedCommandId);
    const preferredMapping = mappings.find((mapping) => mapping.title) || null;
    const builtinMetadata = constants.getBuiltinCommandMetadata(menuType, normalizedCommandId);
    const registeredCommand = this.getRegisteredCommands().find((item) => item.id === normalizedCommandId) || null;

    if (!preferredMapping && !builtinMetadata && !registeredCommand) {
      return null;
    }

    return {
      id: normalizedCommandId,
      label: preferredMapping?.title || builtinMetadata?.label || registeredCommand?.label || normalizedCommandId,
      icon: builtinMetadata?.icon || registeredCommand?.icon || '',
      aliases: Array.from(new Set([
        ...mappings.map((mapping) => mapping.title),
        ...(builtinMetadata?.aliases || [])
      ].filter(Boolean))),
      sections: Array.from(new Set([
        ...mappings.map((mapping) => mapping.section),
        ...(builtinMetadata?.sections || [])
      ].filter(Boolean))),
      source: preferredMapping
        ? registeredCommand
          ? 'mapped-registered'
          : builtinMetadata
            ? 'mapped-builtin'
            : 'mapped'
        : builtinMetadata
          ? registeredCommand ? 'builtin-registered' : 'builtin'
          : 'registered',
      canExecute: Boolean(registeredCommand)
    };
  }

  // 返回当前菜单类型可供新增的具体命令列表，完全来自 Obsidian 命令注册表。
  getAddableCommands() {
    return this.getRegisteredCommands();
  }

  // 返回指定菜单类型当前“可配置”的命令集合，仅包含已配置或已映射的命令。
  getAvailableCommands(menuType) {
    const commandIds = new Set();
    const menuConfig = this.getMenuConfig(menuType);

    menuConfig.groups.forEach((group) => {
      group.commands.forEach((commandId) => commandIds.add(commandId));
    });

    menuConfig.rootItems.forEach((item) => {
      if (item.type === 'command' && item.commandId) {
        commandIds.add(item.commandId);
      }
    });

    Object.keys(menuConfig.commandOverrides).forEach((commandId) => commandIds.add(commandId));
    menuConfig.commandMappings.forEach((mapping) => {
      if (mapping.commandId) {
        commandIds.add(mapping.commandId);
      }
    });

    return Array.from(commandIds)
      .map((commandId) => {
        const metadata = this.getCommandMetadata(menuType, commandId);
        return {
          id: commandId,
          label: metadata?.label || commandId,
          icon: metadata?.icon || '',
          aliases: metadata?.aliases || [],
          sections: metadata?.sections || [],
          source: metadata?.source || 'configured',
          canExecute: metadata?.canExecute === true
        };
      })
      .sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'));
  }

  // 返回指定命令在设置页中应展示的名称。
  getCommandLabel(menuType, commandId) {
    const metadata = this.getCommandMetadata(menuType, commandId);
    return metadata?.label || commandId;
  }

  // 返回模块中已启用的菜单数量，供设置页摘要显示。
  getEnabledMenuCount() {
    return constants.MENU_TYPE_OPTIONS.filter((menuType) => {
      return this.getMenuConfig(menuType.id).enabled;
    }).length;
  }

  // 返回全部分组数量，供设置页摘要显示。
  getGroupCount() {
    return constants.MENU_TYPE_OPTIONS.reduce((count, menuType) => {
      return count + this.getMenuConfig(menuType.id).groups.length;
    }, 0);
  }

  // 切换某个菜单类型的启用状态。
  async setMenuEnabled(menuType, enabled) {
    this.ensureMenuConfig(menuType);
    this.settings.menus[menuType].enabled = Boolean(enabled);
    await this.save();
    return this.getMenuConfig(menuType).enabled;
  }

  // 新增一个空分组，并自动挂到根级结构末尾。
  async addGroup(menuType) {
    this.ensureMenuConfig(menuType);
    const menuConfig = this.settings.menus[menuType];
    const group = this.createGroup(menuType);

    menuConfig.groups.push(group);
    menuConfig.rootItems.push(this.createRootItem('group', { groupId: group.id }));
    this.alignGroupOrderWithRootItems(menuConfig);
    await this.save();
  }

  // 删除指定索引的分组，并同步移除对应的根级结构引用。
  async removeGroup(menuType, groupIndex) {
    this.ensureMenuConfig(menuType);
    const menuConfig = this.settings.menus[menuType];
    const targetGroup = menuConfig.groups[groupIndex];
    if (!targetGroup) {
      return;
    }

    menuConfig.groups.splice(groupIndex, 1);
    menuConfig.rootItems = menuConfig.rootItems.filter((item) => {
      return item.type !== 'group' || item.groupId !== targetGroup.id;
    });
    this.alignGroupOrderWithRootItems(menuConfig);
    await this.save();
  }

  // 更新分组属性，统一经过归一化，保证结构稳定。
  async updateGroup(menuType, groupIndex, patch) {
    this.ensureMenuConfig(menuType);
    const menuConfig = this.settings.menus[menuType];
    const currentGroup = menuConfig.groups[groupIndex];
    if (!currentGroup) {
      return;
    }

    menuConfig.groups[groupIndex] = this.normalizeGroup(
      menuType,
      Object.assign({}, currentGroup, patch)
    );
    this.alignGroupOrderWithRootItems(menuConfig);
    await this.save();
  }

  // 调整分组在根级结构中的顺序，保证设置页与运行时顺序一致。
  async moveGroup(menuType, groupIndex, offset) {
    this.ensureMenuConfig(menuType);
    const menuConfig = this.settings.menus[menuType];
    const targetGroup = menuConfig.groups[groupIndex];
    if (!targetGroup) {
      return;
    }

    const rootItemIndex = this.getGroupRootItemIndex(menuConfig, targetGroup.id);
    if (rootItemIndex === -1) {
      return;
    }

    if (!this.moveArrayItem(menuConfig.rootItems, rootItemIndex, offset)) {
      return;
    }

    this.alignGroupOrderWithRootItems(menuConfig);
    await this.save();
  }

  // 往指定分组中追加命令，自动去重，避免重复渲染。
  async addCommandToGroup(menuType, groupIndex, commandId) {
    this.ensureMenuConfig(menuType);
    const menuConfig = this.settings.menus[menuType];
    const targetGroup = menuConfig.groups[groupIndex];
    const normalizedCommandId = typeof commandId === 'string' ? commandId.trim() : '';

    if (!targetGroup || !normalizedCommandId) {
      return {
        success: false,
        reason: 'empty'
      };
    }

    if (!this.getCommandMetadata(menuType, normalizedCommandId)) {
      return {
        success: false,
        reason: 'missing'
      };
    }

    if (targetGroup.commands.includes(normalizedCommandId)) {
      return {
        success: false,
        reason: 'duplicate'
      };
    }

    targetGroup.commands.push(normalizedCommandId);
    await this.save();
    return {
      success: true,
      reason: 'added'
    };
  }

  // 从分组中移除某个命令。
  async removeCommandFromGroup(menuType, groupIndex, commandIndex) {
    this.ensureMenuConfig(menuType);
    const targetGroup = this.settings.menus[menuType].groups[groupIndex];
    if (!targetGroup) {
      return;
    }

    targetGroup.commands.splice(commandIndex, 1);
    await this.save();
  }

  // 调整分组内命令顺序。
  async moveCommandInGroup(menuType, groupIndex, commandIndex, offset) {
    this.ensureMenuConfig(menuType);
    const targetGroup = this.settings.menus[menuType].groups[groupIndex];
    if (!targetGroup) {
      return;
    }

    if (!this.moveArrayItem(targetGroup.commands, commandIndex, offset)) {
      return;
    }

    await this.save();
  }

  // 新增一个与分组并列的根级命令。
  async addRootCommand(menuType, commandId) {
    this.ensureMenuConfig(menuType);
    const menuConfig = this.settings.menus[menuType];
    const normalizedCommandId = typeof commandId === 'string' ? commandId.trim() : '';

    if (!normalizedCommandId) {
      return {
        success: false,
        reason: 'empty'
      };
    }

    if (!this.getCommandMetadata(menuType, normalizedCommandId)) {
      return {
        success: false,
        reason: 'missing'
      };
    }

    if (menuConfig.rootItems.some((item) => item.type === 'command' && item.commandId === normalizedCommandId)) {
      return {
        success: false,
        reason: 'duplicate'
      };
    }

    menuConfig.rootItems.push(this.createRootItem('command', { commandId: normalizedCommandId }));
    await this.save();
    return {
      success: true,
      reason: 'added'
    };
  }

  // 新增一个根级分隔线。
  async addRootSeparator(menuType) {
    this.ensureMenuConfig(menuType);
    this.settings.menus[menuType].rootItems.push(this.createRootItem('separator'));
    await this.save();
  }

  // 删除根级结构中的命令或分隔线；分组应通过“删除分组”操作处理。
  async removeRootItem(menuType, itemIndex) {
    this.ensureMenuConfig(menuType);
    const menuConfig = this.settings.menus[menuType];
    const targetItem = menuConfig.rootItems[itemIndex];
    if (!targetItem || targetItem.type === 'group') {
      return false;
    }

    menuConfig.rootItems.splice(itemIndex, 1);
    await this.save();
    return true;
  }

  // 调整根级结构项顺序。
  async moveRootItem(menuType, itemIndex, offset) {
    this.ensureMenuConfig(menuType);
    const menuConfig = this.settings.menus[menuType];
    if (!this.moveArrayItem(menuConfig.rootItems, itemIndex, offset)) {
      return false;
    }

    this.alignGroupOrderWithRootItems(menuConfig);
    await this.save();
    return true;
  }

  // 更新根级结构项属性，目前主要用于命令/分隔线的隐藏状态。
  async updateRootItem(menuType, itemIndex, patch) {
    this.ensureMenuConfig(menuType);
    const menuConfig = this.settings.menus[menuType];
    const currentItem = menuConfig.rootItems[itemIndex];
    if (!currentItem || currentItem.type === 'group') {
      return false;
    }

    menuConfig.rootItems[itemIndex] = this.normalizeRootItem(
      menuType,
      Object.assign({}, currentItem, patch),
      new Set(menuConfig.groups.map((group) => group.id))
    );
    await this.save();
    return true;
  }

  // 新增一条手动命令映射，用于补齐无 commandId 的原始菜单项识别。
  async addCommandMapping(menuType) {
    this.ensureMenuConfig(menuType);
    this.settings.menus[menuType].commandMappings.push(this.createCommandMapping());
    await this.save();
  }

  // 更新手动命令映射。
  async updateCommandMapping(menuType, mappingIndex, patch) {
    this.ensureMenuConfig(menuType);
    const currentMapping = this.settings.menus[menuType].commandMappings[mappingIndex];
    if (!currentMapping) {
      return;
    }

    this.settings.menus[menuType].commandMappings[mappingIndex] = this.normalizeCommandMapping(
      Object.assign({}, currentMapping, patch)
    );
    await this.save();
  }

  // 删除手动命令映射。
  async removeCommandMapping(menuType, mappingIndex) {
    this.ensureMenuConfig(menuType);
    this.settings.menus[menuType].commandMappings.splice(mappingIndex, 1);
    await this.save();
  }

  // 根据“手动映射 + 初始内置数据”严格识别无显式 commandId 的菜单项。
  resolveMappedCommandId(menuType, title, section) {
    const normalizedTitle = this.normalizeText(title);
    const normalizedSection = this.normalizeText(section);

    if (!menuType || !normalizedTitle) {
      return '';
    }

    for (const mapping of this.getMenuCommandMappings(menuType)) {
      if (!mapping.title || !mapping.commandId) {
        continue;
      }

      if (this.normalizeText(mapping.title) !== normalizedTitle) {
        continue;
      }

      const mappingSection = this.normalizeText(mapping.section);
      if (mappingSection && mappingSection !== normalizedSection) {
        continue;
      }

      return mapping.commandId;
    }

    for (const builtinEntry of constants.getBuiltinCommandEntries(menuType)) {
      if (!builtinEntry.title || !builtinEntry.commandId) {
        continue;
      }

      if (this.normalizeText(builtinEntry.title) !== normalizedTitle) {
        continue;
      }

      const builtinSection = this.normalizeText(builtinEntry.section);
      if (builtinSection && builtinSection !== normalizedSection) {
        continue;
      }

      return builtinEntry.commandId;
    }

    return '';
  }

  // 更新某个命令的显示名称、图标或隐藏状态。
  async updateCommandOverride(menuType, commandId, patch) {
    this.ensureMenuConfig(menuType);
    const normalizedCommandId = typeof commandId === 'string' ? commandId.trim() : '';
    if (!normalizedCommandId) {
      return;
    }

    const currentOverride = this.settings.menus[menuType].commandOverrides[normalizedCommandId] || {};
    const nextOverride = this.normalizeCommandOverride(Object.assign({}, currentOverride, patch));

    if (!nextOverride.title && !nextOverride.icon && nextOverride.hidden !== true) {
      delete this.settings.menus[menuType].commandOverrides[normalizedCommandId];
    } else {
      this.settings.menus[menuType].commandOverrides[normalizedCommandId] = nextOverride;
    }

    await this.save();
  }

  // 生成默认分组对象。
  createGroup(menuType) {
    return {
      id: `${menuType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: '新分组',
      icon: '',
      layout: 'list',
      hidden: false,
      forceSubmenu: false,
      commands: []
    };
  }

  // 生成默认根级结构项。
  createRootItem(type, payload) {
    const source = this.isPlainObject(payload) ? payload : {};
    const id = typeof source.id === 'string' && source.id.trim()
      ? source.id.trim()
      : `root-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (type === 'group') {
      return {
        id,
        type: 'group',
        groupId: typeof source.groupId === 'string' ? source.groupId.trim() : '',
        hidden: false
      };
    }

    if (type === 'command') {
      return {
        id,
        type: 'command',
        commandId: typeof source.commandId === 'string' ? source.commandId.trim() : '',
        hidden: source.hidden === true
      };
    }

    return {
      id,
      type: 'separator',
      hidden: source.hidden === true
    };
  }

  // 生成默认手动映射对象。
  createCommandMapping() {
    return {
      title: '',
      section: '',
      commandId: ''
    };
  }

  // 归一化整个菜单自定义配置结构。
  normalizeSettings(settings) {
    const defaultSettings = constants.createDefaultMenuCustomizerSettings();
    const source = this.isPlainObject(settings) ? settings : {};
    const normalizedMenus = {};

    constants.MENU_TYPE_OPTIONS.forEach((menuType) => {
      normalizedMenus[menuType.id] = this.normalizeMenuConfig(menuType.id, source.menus?.[menuType.id]);
    });

    return Object.assign({}, defaultSettings, {
      menus: normalizedMenus
    });
  }

  // 归一化单个菜单类型的配置。
  normalizeMenuConfig(menuType, menuConfig) {
    const defaultSettings = constants.createDefaultMenuCustomizerSettings();
    const defaultMenuConfig = defaultSettings.menus[menuType] || {
      enabled: false,
      groups: [],
      rootItems: constants.cloneDefaultRootItems(menuType),
      commandOverrides: {},
      commandMappings: []
    };
    const source = this.isPlainObject(menuConfig) ? menuConfig : {};
    const commandOverrides = {};
    const groups = Array.isArray(source.groups)
      ? source.groups.map((group) => this.normalizeGroup(menuType, group))
      : defaultMenuConfig.groups.map((group) => this.normalizeGroup(menuType, group));

    if (this.isPlainObject(source.commandOverrides)) {
      Object.entries(source.commandOverrides).forEach(([commandId, override]) => {
        const normalizedCommandId = typeof commandId === 'string' ? commandId.trim() : '';
        if (!normalizedCommandId) {
          return;
        }

        commandOverrides[normalizedCommandId] = this.normalizeCommandOverride(override);
      });
    }

    const normalizedConfig = {
      enabled: source.enabled === true,
      groups,
      rootItems: this.normalizeRootItems(
        menuType,
        Array.isArray(source.rootItems) ? source.rootItems : defaultMenuConfig.rootItems,
        groups
      ),
      commandOverrides,
      commandMappings: Array.isArray(source.commandMappings)
        ? source.commandMappings.map((mapping) => this.normalizeCommandMapping(mapping))
        : defaultMenuConfig.commandMappings.map((mapping) => this.normalizeCommandMapping(mapping))
    };

    this.alignGroupOrderWithRootItems(normalizedConfig);
    return normalizedConfig;
  }

  // 归一化分组配置，清理非法布局值与空命令。
  normalizeGroup(menuType, group) {
    const source = this.isPlainObject(group) ? group : {};
    const normalizedLayout = constants.GROUP_LAYOUT_OPTIONS.some((layout) => layout.value === source.layout)
      ? source.layout
      : 'list';

    return {
      id: typeof source.id === 'string' && source.id.trim()
        ? source.id.trim()
        : `${menuType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: typeof source.name === 'string' && source.name.trim()
        ? source.name.trim()
        : '未命名分组',
      icon: typeof source.icon === 'string' ? source.icon.trim() : '',
      layout: normalizedLayout,
      hidden: source.hidden === true,
      forceSubmenu: source.forceSubmenu === true,
      commands: this.normalizeCommandList(source.commands)
    };
  }

  // 归一化单个根级结构项。
  normalizeRootItem(menuType, item, validGroupIds) {
    const source = this.isPlainObject(item) ? item : {};
    const type = typeof source.type === 'string' ? source.type.trim() : '';

    if (type === 'group') {
      const groupId = typeof source.groupId === 'string' ? source.groupId.trim() : '';
      if (!groupId || !validGroupIds.has(groupId)) {
        return null;
      }

      return this.createRootItem('group', {
        id: source.id,
        groupId
      });
    }

    if (type === 'command') {
      const commandId = typeof source.commandId === 'string' ? source.commandId.trim() : '';
      if (!commandId) {
        return null;
      }

      return this.createRootItem('command', {
        id: source.id,
        commandId,
        hidden: source.hidden === true
      });
    }

    if (type === 'separator') {
      return this.createRootItem('separator', {
        id: source.id,
        hidden: source.hidden === true
      });
    }

    return null;
  }

  // 归一化根级结构列表，并自动补齐缺失的分组引用。
  normalizeRootItems(menuType, rootItems, groups) {
    const source = Array.isArray(rootItems) ? rootItems : [];
    const validGroupIds = new Set(groups.map((group) => group.id));
    const normalizedItems = [];
    const seenGroupIds = new Set();

    source.forEach((item) => {
      const normalizedItem = this.normalizeRootItem(menuType, item, validGroupIds);
      if (!normalizedItem) {
        return;
      }

      if (normalizedItem.type === 'group') {
        if (seenGroupIds.has(normalizedItem.groupId)) {
          return;
        }

        seenGroupIds.add(normalizedItem.groupId);
      }

      normalizedItems.push(normalizedItem);
    });

    groups.forEach((group) => {
      if (seenGroupIds.has(group.id)) {
        return;
      }

      seenGroupIds.add(group.id);
      normalizedItems.push(this.createRootItem('group', {
        id: `${group.id}::root`,
        groupId: group.id
      }));
    });

    if (normalizedItems.length === 0 && groups.length === 0) {
      return constants.cloneDefaultRootItems(menuType).filter((item) => item.type !== 'group');
    }

    return normalizedItems;
  }

  // 归一化单条手动命令映射。
  normalizeCommandMapping(mapping) {
    const source = this.isPlainObject(mapping) ? mapping : {};

    return {
      title: typeof source.title === 'string' ? source.title.trim() : '',
      section: typeof source.section === 'string' ? source.section.trim() : '',
      commandId: typeof source.commandId === 'string' ? source.commandId.trim() : ''
    };
  }

  // 归一化命令覆盖结构，避免空字符串污染存储。
  normalizeCommandOverride(override) {
    const source = this.isPlainObject(override) ? override : {};

    return {
      title: typeof source.title === 'string' ? source.title.trim() : '',
      icon: typeof source.icon === 'string' ? source.icon.trim() : '',
      hidden: source.hidden === true
    };
  }

  // 清理命令列表，去掉空值并自动去重。
  normalizeCommandList(commands) {
    if (!Array.isArray(commands)) {
      return [];
    }

    const dedupedCommands = [];
    const seen = new Set();

    commands.forEach((commandId) => {
      if (typeof commandId !== 'string') {
        return;
      }

      const normalizedCommandId = commandId.trim();
      if (!normalizedCommandId || seen.has(normalizedCommandId)) {
        return;
      }

      seen.add(normalizedCommandId);
      dedupedCommands.push(normalizedCommandId);
    });

    return dedupedCommands;
  }

  // 返回指定菜单类型下对应该命令的全部映射。
  getCommandMappingsForCommand(menuType, commandId) {
    const normalizedCommandId = typeof commandId === 'string' ? commandId.trim() : '';
    if (!normalizedCommandId) {
      return [];
    }

    return this.getMenuCommandMappings(menuType).filter((mapping) => mapping.commandId === normalizedCommandId);
  }

  // 确保指定菜单类型的配置对象存在。
  ensureMenuConfig(menuType) {
    if (this.settings.menus[menuType]) {
      return;
    }

    this.settings.menus[menuType] = this.normalizeMenuConfig(menuType);
  }

  // 根据根级结构顺序同步分组数组顺序，避免设置页展示错位。
  alignGroupOrderWithRootItems(menuConfig) {
    if (!menuConfig || !Array.isArray(menuConfig.groups) || !Array.isArray(menuConfig.rootItems)) {
      return;
    }

    const groupOrderMap = new Map();
    menuConfig.rootItems.forEach((item, index) => {
      if (item.type === 'group' && !groupOrderMap.has(item.groupId)) {
        groupOrderMap.set(item.groupId, index);
      }
    });

    menuConfig.groups = menuConfig.groups
      .map((group, index) => ({ group, index }))
      .sort((left, right) => {
        const leftOrder = groupOrderMap.has(left.group.id) ? groupOrderMap.get(left.group.id) : Number.MAX_SAFE_INTEGER;
        const rightOrder = groupOrderMap.has(right.group.id) ? groupOrderMap.get(right.group.id) : Number.MAX_SAFE_INTEGER;
        return leftOrder === rightOrder ? left.index - right.index : leftOrder - rightOrder;
      })
      .map((entry) => entry.group);
  }

  // 返回指定分组在根级结构中的位置。
  getGroupRootItemIndex(menuConfig, groupId) {
    return menuConfig.rootItems.findIndex((item) => item.type === 'group' && item.groupId === groupId);
  }

  // 通用数组位移工具，返回是否移动成功。
  moveArrayItem(list, currentIndex, offset) {
    if (!Array.isArray(list)) {
      return false;
    }

    const targetIndex = currentIndex + offset;
    if (currentIndex < 0 || currentIndex >= list.length || targetIndex < 0 || targetIndex >= list.length) {
      return false;
    }

    const [item] = list.splice(currentIndex, 1);
    list.splice(targetIndex, 0, item);
    return true;
  }

  // 统一做标题归一化，降低空白与大小写差异带来的识别误差。
  normalizeText(value) {
    return typeof value === 'string'
      ? value.trim().toLowerCase().replace(/\s+/g, ' ')
      : '';
  }

  // 判断当前值是否为普通对象，避免数组或空值被误当成配置对象。
  isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }
}

module.exports = {
  MenuCustomizerStore
};
