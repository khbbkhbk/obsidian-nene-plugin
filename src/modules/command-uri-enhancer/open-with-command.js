'use strict';

// 文件速览命令核心逻辑：
// - OpenWithFileCommand：为单个文件创建一条 Obsidian 命令，执行时按配置的打开位置打开该文件
// - OpenWithCommandRuntime：统一管理命令注册与文件系统事件同步（重命名 / 删除）
// 打开位置提供 7 种选择：当前页 / 新标签 / 右侧分屏 / 下方分屏 / 右栏 / 左栏 / 新窗口。

var obsidian = require('obsidian');
var constants = require('./constants');

// 优先使用 obsidian 导出的 moment，缺失时回退到全局 moment。
var moment = obsidian.moment || (typeof window !== 'undefined' ? window.moment : null);

// 文件速览命令：封装单条命令的注册、执行与配置同步。
class OpenWithFileCommand {
  constructor(name, fileOrPath, plugin, id) {
    this.plugin = plugin; // 保存插件实例，便于访问工作区与仓库
    this.id = id; // 命令 ID（Obsidian 注册时会自动叠加插件前缀）
    this.name = name; // 命令显示名称
    // 兼容传入 TFile 对象或路径字符串两种形式
    if (fileOrPath instanceof obsidian.TFile) {
      this.filePath = fileOrPath.path;
    } else {
      this.filePath = typeof fileOrPath === 'string' ? fileOrPath : '';
    }
    // 默认使用全局"文件打开位置"设置，后续可被命令级配置覆盖
    this.openFileIn = this.plugin.commandUriEnhancerStore.getSettings().openFileIn;
    this.command = null; // 注册后返回的 Obsidian Command 对象
  }

  // 注册 Obsidian 命令，命令始终处于可执行状态，执行前再做存在性与模块开关校验。
  registerCommand() {
    const self = this;
    this.command = this.plugin.addCommand({
      id: this.id,
      name: this.name,
      checkCallback(checking) {
        if (checking) {
          return true;
        }
        void self.execute();
        return true;
      }
    });
    return this.command;
  }

  // 同步更新命令的名称与目标路径，并刷新已注册命令的显示名。
  updateCommand(name, filePath, openFileIn) {
    if (typeof name === 'string') {
      this.name = name;
    }
    if (typeof filePath === 'string') {
      this.filePath = filePath;
    }
    if (typeof openFileIn === 'string') {
      this.openFileIn = openFileIn;
    }
    if (this.command) {
      this.command.name = this.name;
    }
  }

  // 执行命令：校验模块开关与命令仍存在 → 变量替换 → 查找文件 → 按打开位置打开。
  async execute() {
    if (!this.plugin.isCommandUriEnhancerEnabled()) {
      new obsidian.Notice('命令&URI增强模块当前已关闭，请先在设置页中启用。');
      return;
    }

    // 命令可能已被用户删除，配置中不存在时静默失效（注册表无法可靠移除命令）。
    const settings = this.plugin.commandUriEnhancerStore.getSettings();
    const stillExists = (settings.commands || []).some((command) => command && command.id === this.id);
    if (!stillExists) {
      return;
    }

    // 变量替换后定位目标文件
    let filePath = await replaceArgs(this.filePath, this.plugin, settings.customVariables || []);
    const file = this.plugin.app.vault.getAbstractFileByPath(filePath || '');
    if (!(file instanceof obsidian.TFile)) {
      new obsidian.Notice(`文件 "${filePath}" 不存在，请检查命令配置`);
      return;
    }

    const leaf = getLeaf(this.plugin, this.openFileIn, file);
    if (!leaf) {
      return;
    }
    await leaf.openFile(file);
  }
}

// 文件速览命令运行时：负责按配置重建命令注册表，并处理文件重命名 / 删除的同步。
class OpenWithCommandRuntime {
  constructor(plugin) {
    this.plugin = plugin;
    this.fileCommands = []; // 当前已注册的命令实例列表
  }

  // 按最新配置重建命令注册表：已存在的命令复用实例并同步字段，新增命令注册，被移除的命令不再维护。
  reload() {
    const settings = this.plugin.commandUriEnhancerStore.getSettings();
    const configs = settings.commands || [];
    const existingById = new Map(this.fileCommands.map((command) => [command.id, command]));
    const nextCommands = [];

    for (const config of configs) {
      if (!config || !config.id) {
        continue;
      }

      let command = existingById.get(config.id);
      if (command) {
        // 复用已注册实例，仅同步字段，避免重复注册
        command.updateCommand(config.name, config.filePath, config.openFileIn);
      } else {
        command = new OpenWithFileCommand(config.name, config.filePath, this.plugin, config.id);
        if (config.openFileIn) {
          command.openFileIn = config.openFileIn;
        }
        command.registerCommand();
      }
      nextCommands.push(command);
    }

    this.fileCommands = nextCommands;
  }

  // 扫描全部命令，检查目标文件在仓库中是否仍存在，并将结果写入 isValid 字段持久化。
  // 模块启用时调用，模块关闭期间文件变更导致的失效命令将在此次核查中被标记。
  validateAllCommands() {
    const settings = this.plugin.commandUriEnhancerStore.getSettings();
    const commands = settings.commands || [];
    let hasChange = false;

    for (const cmd of commands) {
      if (!cmd || !cmd.id) {
        continue;
      }
      const file = cmd.filePath ? this.plugin.app.vault.getAbstractFileByPath(cmd.filePath) : null;
      const isValid = file instanceof obsidian.TFile;
      if (cmd.isValid !== isValid) {
        cmd.isValid = isValid;
        hasChange = true;
      }
    }

    if (hasChange) {
      void this.plugin.commandUriEnhancerStore.save();
    }
  }

  // 文件重命名同步：按配置开关更新所有指向原路径的命令的名称与目标路径。
  // 仅在命令&URI增强模块启用时生效，模块关闭期间发生的文件变更由下次模块启用时按有效性核查归类。
  handleFileRename(file, oldPath) {
    if (!(file instanceof obsidian.TFile)) {
      return;
    }

    if (!this.plugin.isCommandUriEnhancerEnabled()) {
      return;
    }

    const settings = this.plugin.commandUriEnhancerStore.getSettings();
    if (!settings.updateCommandsOnRename) {
      return;
    }

    const matchedConfigs = (settings.commands || []).filter((command) => command && command.filePath === oldPath);
    if (matchedConfigs.length === 0) {
      return;
    }

    for (const commandConfig of matchedConfigs) {
      // 更新持久化配置
      commandConfig.filePath = file.path;
      commandConfig.name = file.basename;

      // 更新已注册命令实例
      const command = this.fileCommands.find((item) => item.id === commandConfig.id);
      if (command) {
        command.updateCommand(file.basename, file.path);
      }
    }

    void this.plugin.commandUriEnhancerStore.save();
  }

  // 文件删除同步：按配置开关删除所有指向被删文件的命令的配置与实例。
  // 仅在命令&URI增强模块启用时生效，模块关闭期间发生的文件变更由下次打开弹窗时按有效性重新归类。
  handleFileDelete(file) {
    const settings = this.plugin.commandUriEnhancerStore.getSettings();
    if (!settings.deleteCommandWhenFileIsDeleted) {
      return;
    }

    if (!this.plugin.isCommandUriEnhancerEnabled()) {
      return;
    }

    const matchedIds = new Set(
      (settings.commands || [])
        .filter((command) => command && command.filePath === file.path)
        .map((command) => command.id)
    );

    if (matchedIds.size === 0) {
      return;
    }

    settings.commands = (settings.commands || []).filter((command) => command && !matchedIds.has(command.id));
    this.fileCommands = this.fileCommands.filter((command) => !matchedIds.has(command.id));

    void this.plugin.commandUriEnhancerStore.save();
  }
}

// 将文件路径中的 {{变量}} 占位符替换为实际值。
async function replaceArgs(filePath, plugin, customVariables) {
  const args = filePath.match(/\{\{([^}]+)\}\}/g);
  if (!args) {
    return filePath;
  }

  const result = await replaceVariables(filePath, plugin, customVariables, args);
  if (result !== undefined) {
    filePath = result;
  }
  return filePath;
}

// 递归替换全部变量：内置日期变量与自定义变量。
async function replaceVariables(filePath, plugin, customVariables, args) {
  for (const arg of args) {
    const argName = arg.replace(/\{\{([^}]+)\}\}/g, '$1');

    // 内置日期变量：{{date:格式}} 或 {{d:格式}}，使用 moment 格式化（区分大小写）
    if (argName.startsWith('date:') || argName.startsWith('d:')) {
      const format = argName.replace('date:', '').replace('d:', '');
      const argValue = moment ? moment().format(format) : '';
      filePath = filePath.replace(arg, argValue);
    }

    // 自定义变量：名称严格相等匹配
    const customVariable = (customVariables || []).find((variable) => variable && variable.name === argName);
    if (!customVariable) {
      continue;
    }

    if (customVariable.type === 'javascript') {
      // 注意：JavaScript 类型变量会直接执行用户输入的代码（new Function），
      // 存在任意代码执行风险，仅应使用可信来源的代码。
      // 对返回值做空值兜底，避免空函数或异常时将 "undefined" / "null" 写入路径。
      var userFunction = new Function(customVariable.value);
      var jsResult = userFunction();
      if (jsResult === undefined || jsResult === null || jsResult === '') {
        filePath = filePath.replace(arg, '');
      } else {
        filePath = filePath.replace(arg, String(jsResult));
      }
    } else {
      // 字符串类型支持嵌套变量递归替换
      const nestedArgs = customVariable.value.match(/\{\{([^}]+)\}\}/g);
      let variableCopy = Object.assign({}, customVariable);
      if (nestedArgs) {
        const result = await replaceVariables(customVariable.value, plugin, customVariables, nestedArgs);
        if (result !== undefined) {
          variableCopy.value = result;
        }
      }
      filePath = filePath.replace(arg, variableCopy.value);
    }
  }
  return filePath;
}

// 根据打开位置配置获取目标 WorkspaceLeaf，并返回 null 表示已复用现有叶子。
function getLeaf(plugin, openFileIn, file) {
  let leaf = null;

  switch (openFileIn) {
    case 'activeTab':
      // 当前活动标签页
      leaf = plugin.app.workspace.getLeaf(false);
      break;
    case 'newTab':
      // 新标签页
      leaf = plugin.app.workspace.getLeaf('tab');
      break;
    case 'newTabSplit':
      // 右侧分屏
      leaf = plugin.app.workspace.getLeaf('split', 'vertical');
      break;
    case 'newTabSplitHorizontal':
      // 下方分屏
      leaf = plugin.app.workspace.getLeaf('split', 'horizontal');
      break;
    case 'window':
      // 新窗口
      leaf = plugin.app.workspace.getLeaf('window');
      break;
    case 'rightLeaf': {
      // 右侧边栏：已打开同文件时直接激活，否则在右侧边栏新建
      const existingRightLeaf = findLeafInSplit(plugin, plugin.app.workspace.rightSplit, file);
      if (existingRightLeaf) {
        plugin.app.workspace.revealLeaf(existingRightLeaf);
        return null;
      }
      leaf = plugin.app.workspace.getRightLeaf(false);
      plugin.app.workspace.revealLeaf(leaf);
      break;
    }
    case 'leftLeaf': {
      // 左侧边栏：已打开同文件时直接激活，否则在左侧边栏新建
      const existingLeftLeaf = findLeafInSplit(plugin, plugin.app.workspace.leftSplit, file);
      if (existingLeftLeaf) {
        plugin.app.workspace.revealLeaf(existingLeftLeaf);
        return null;
      }
      leaf = plugin.app.workspace.getLeftLeaf(false);
      plugin.app.workspace.revealLeaf(leaf);
      break;
    }
    default:
      leaf = plugin.app.workspace.getLeaf(false);
      break;
  }

  return leaf;
}

// 在指定侧边栏分组中查找已打开同一文件的叶子。
function findLeafInSplit(plugin, split, file) {
  return plugin.app.workspace.getLeavesOfType('markdown').find((leaf) => {
    return (
      leaf.getRoot() === split &&
      leaf.view instanceof obsidian.FileView &&
      leaf.view.file &&
      leaf.view.file.path === file.path
    );
  });
}

module.exports = {
  OpenWithFileCommand,
  OpenWithCommandRuntime
};
