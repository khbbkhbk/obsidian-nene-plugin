'use strict';

var constants = require('./constants');

// 定义命令&URI增强配置仓库，同时缓存最近一次文件右键菜单的目标对象。
class CommandUriEnhancerStore {
  constructor(plugin) {
    this.plugin = plugin; // 保存插件实例，便于读写独立配置文件
    this.settings = this.normalizeSettings(); // 初始化默认配置，避免首次读取时报空
    this.lastMenuTarget = null; // 缓存最近一次右键菜单目标，菜单关闭时由主入口清空
  }

  // 挂载从独立配置文件读出的设置切片。
  load(settings) {
    this.settings = this.normalizeSettings(settings);
  }

  // 持久化当前命令&URI增强配置到独立 JSON 文件。
  async save() {
    this.settings = this.normalizeSettings(this.settings);
    this.plugin.dataStore.setCommandUriEnhancerData(this.settings);
    await this.plugin.dataStore.saveCommandUriEnhancerData(this.settings);
  }

  // 返回当前完整配置。
  getSettings() {
    return this.settings;
  }

  // 更新“文件夹路径末尾补 /”开关，并立即持久化。
  async setAddTrailingSlashToFolders(enabled) {
    this.settings.addTrailingSlashToFolders = Boolean(enabled);
    await this.save();
    return this.settings.addTrailingSlashToFolders;
  }

  // 更新“删除文件时删除命令”开关，并立即持久化。
  async setDeleteCommandWhenFileIsDeleted(enabled) {
    this.settings.deleteCommandWhenFileIsDeleted = Boolean(enabled);
    await this.save();
    return this.settings.deleteCommandWhenFileIsDeleted;
  }

  // 更新“重命名文件时更新命令”开关，并立即持久化。
  async setUpdateCommandsOnRename(enabled) {
    this.settings.updateCommandsOnRename = Boolean(enabled);
    await this.save();
    return this.settings.updateCommandsOnRename;
  }

  // 追加一条文件速览命令配置并持久化，返回新增的命令配置。
  async addCommand(command) {
    const normalizedCommand = this.normalizeCommands([command])[0];
    if (normalizedCommand) {
      this.settings.commands.push(normalizedCommand);
      await this.save();
      return normalizedCommand;
    }
    return null;
  }

  // 按 id 移除文件速览命令配置并持久化。
  async removeCommandById(id) {
    this.settings.commands = this.settings.commands.filter((command) => command && command.id !== id);
    await this.save();
  }

  // 记录最近一次文件或文件夹右键菜单的目标对象。
  rememberMenuTarget(file) {
    this.lastMenuTarget = file || null;
  }

  // 返回最近一次右键菜单目标；生命周期由主入口在菜单关闭时统一清空。
  getRecentMenuTarget() {
    return this.lastMenuTarget;
  }

  // 主动清空最近一次菜单目标，避免后续无关命令误用。
  clearRecentMenuTarget() {
    this.lastMenuTarget = null;
  }

  // 归一化命令&URI增强模块的配置结构。
  normalizeSettings(settings) {
    const source = settings || constants.DEFAULT_COMMAND_URI_ENHANCER_SETTINGS;
    const defaults = constants.DEFAULT_COMMAND_URI_ENHANCER_SETTINGS;

    return {
      addTrailingSlashToFolders: source.addTrailingSlashToFolders !== false,
      openNewTab: source.openNewTab === true,
      openFileIn: this.normalizeOpenFileIn(source.openFileIn, defaults.openFileIn),
      deleteCommandWhenFileIsDeleted: source.deleteCommandWhenFileIsDeleted !== false,
      updateCommandsOnRename: source.updateCommandsOnRename !== false,
      commands: this.normalizeCommands(source.commands),
      customVariables: this.normalizeCustomVariables(source.customVariables, defaults.customVariables)
    };
  }

  // 校验打开位置取值，非法或缺失时回退到给定的默认值。
  normalizeOpenFileIn(value, fallback) {
    return Object.keys(constants.OPEN_FILE_IN_OPTIONS).indexOf(value) !== -1 ? value : fallback;
  }

  // 归一化文件速览命令列表，缺失字段补默认值并补齐 id。
  normalizeCommands(commands) {
    if (!Array.isArray(commands)) {
      return [];
    }
    return commands
      .filter((command) => command && typeof command === 'object' && !Array.isArray(command))
      .map((command) => ({
        id: typeof command.id === 'string' && command.id ? command.id : crypto.randomUUID(),
        name: typeof command.name === 'string' ? command.name : '',
        filePath: typeof command.filePath === 'string' ? command.filePath : '',
        openFileIn: this.normalizeOpenFileIn(command.openFileIn, 'activeTab'),
        isValid: command.isValid !== false
      }));
  }

  // 归一化自定义变量列表；未定义时回退到默认变量，显式空数组则保留为空。
  normalizeCustomVariables(variables, fallback) {
    if (!Array.isArray(variables)) {
      return fallback;
    }
    return variables
      .filter((variable) => variable && typeof variable === 'object' && !Array.isArray(variable))
      .map((variable) => ({
        name: typeof variable.name === 'string' ? variable.name : '',
        value: typeof variable.value === 'string' ? variable.value : '',
        type: variable.type === 'javascript' ? 'javascript' : 'string'
      }));
  }
}

module.exports = {
  CommandUriEnhancerStore
};
