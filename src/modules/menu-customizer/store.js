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
    const registeredCommand = this.getRegisteredCommands().find((item) => item.id === normalizedCommandId) || null;

    if (!preferredMapping && !registeredCommand) {
      return null;
    }

    return {
      id: normalizedCommandId,
      label: preferredMapping?.title || registeredCommand?.label || normalizedCommandId,
      icon: registeredCommand?.icon || '',
      aliases: Array.from(new Set(mappings.map((mapping) => mapping.title).filter(Boolean))),
      sections: Array.from(new Set(mappings.map((mapping) => mapping.section).filter(Boolean))),
      source: preferredMapping
        ? registeredCommand ? 'mapped-registered' : 'mapped'
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

  // 新增一个空分组，供用户后续配置名称、布局与命令。
  async addGroup(menuType) {
    this.ensureMenuConfig(menuType);
    this.settings.menus[menuType].groups.push(this.createGroup(menuType));
    await this.save();
  }

  // 删除指定索引的分组。
  async removeGroup(menuType, groupIndex) {
    this.ensureMenuConfig(menuType);
    this.settings.menus[menuType].groups.splice(groupIndex, 1);
    await this.save();
  }

  // 更新分组属性，统一经过归一化，保证结构稳定。
  async updateGroup(menuType, groupIndex, patch) {
    this.ensureMenuConfig(menuType);
    const currentGroup = this.settings.menus[menuType].groups[groupIndex];
    if (!currentGroup) return;

    this.settings.menus[menuType].groups[groupIndex] = this.normalizeGroup(
      menuType,
      Object.assign({}, currentGroup, patch)
    );
    await this.save();
  }

  // 调整分组顺序，便于控制菜单中的最终呈现顺序。
  async moveGroup(menuType, groupIndex, offset) {
    this.ensureMenuConfig(menuType);
    const groups = this.settings.menus[menuType].groups;
    const targetIndex = groupIndex + offset;

    if (targetIndex < 0 || targetIndex >= groups.length) return;

    const [group] = groups.splice(groupIndex, 1);
    groups.splice(targetIndex, 0, group);
    await this.save();
  }

  // 往指定分组中追加命令，自动去重，避免重复渲染。
  async addCommandToGroup(menuType, groupIndex, commandId) {
    this.ensureMenuConfig(menuType);
    const targetGroup = this.settings.menus[menuType].groups[groupIndex];
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
    if (!targetGroup) return;

    targetGroup.commands.splice(commandIndex, 1);
    await this.save();
  }

  // 调整分组内命令顺序。
  async moveCommandInGroup(menuType, groupIndex, commandIndex, offset) {
    this.ensureMenuConfig(menuType);
    const targetGroup = this.settings.menus[menuType].groups[groupIndex];
    if (!targetGroup) return;

    const targetIndex = commandIndex + offset;
    if (targetIndex < 0 || targetIndex >= targetGroup.commands.length) return;

    const [commandId] = targetGroup.commands.splice(commandIndex, 1);
    targetGroup.commands.splice(targetIndex, 0, commandId);
    await this.save();
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

  // 根据用户提供的 title + section + commandId 映射，严格识别无显式 commandId 的菜单项。
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

    return '';
  }

  // 更新某个命令的显示名称、图标或隐藏状态。
  async updateCommandOverride(menuType, commandId, patch) {
    this.ensureMenuConfig(menuType);
    const normalizedCommandId = typeof commandId === 'string' ? commandId.trim() : '';
    if (!normalizedCommandId) return;

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
      commandOverrides: {},
      commandMappings: []
    };
    const source = this.isPlainObject(menuConfig) ? menuConfig : {};
    const commandOverrides = {};

    if (this.isPlainObject(source.commandOverrides)) {
      Object.entries(source.commandOverrides).forEach(([commandId, override]) => {
        const normalizedCommandId = typeof commandId === 'string' ? commandId.trim() : '';
        if (!normalizedCommandId) return;
        commandOverrides[normalizedCommandId] = this.normalizeCommandOverride(override);
      });
    }

    return {
      enabled: source.enabled === true,
      groups: Array.isArray(source.groups)
        ? source.groups.map((group) => this.normalizeGroup(menuType, group))
        : defaultMenuConfig.groups.map((group) => this.normalizeGroup(menuType, group)),
      commandOverrides,
      commandMappings: Array.isArray(source.commandMappings)
        ? source.commandMappings.map((mapping) => this.normalizeCommandMapping(mapping))
        : defaultMenuConfig.commandMappings.map((mapping) => this.normalizeCommandMapping(mapping))
    };
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
      if (typeof commandId !== 'string') return;
      const normalizedCommandId = commandId.trim();
      if (!normalizedCommandId || seen.has(normalizedCommandId)) return;

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
