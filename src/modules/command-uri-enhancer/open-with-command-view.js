'use strict';

// 文件速览命令设置界面：
// - OpenWithCommandSettingsModal：命令增强分区点击条目后弹出的主设置弹窗
// - ManageVariablesModal：自定义变量管理弹窗
// - ConfirmCommandDeleteModal：删除命令前的二次确认弹窗
// 弹窗样式、排版与布局沿用命令&URI增强模块现有 nene 规范。

var obsidian = require('obsidian');
var constants = require('./constants');
var suggesters = require('./file-suggester');

// 公共渲染辅助函数从 view.js 导入，view.js 通过函数内延迟 require 本文件，
// 故此处顶层引用不会形成模块加载循环。
var viewHelpers = require('./view');

var renderModalHeader = viewHelpers.renderModalHeader;
var renderSectionTitle = viewHelpers.renderSectionTitle;
var renderEntryRow = viewHelpers.renderEntryRow;

// 文件速览命令设置弹窗。
class OpenWithCommandSettingsModal extends obsidian.Modal {
  constructor(app, plugin, onSettingsChanged) {
    super(app);
    this.plugin = plugin; // 保存插件实例，便于访问 store 与运行时
    this.onSettingsChanged = onSettingsChanged; // 变更回调，用于联动父级弹窗刷新
  }

  onOpen() {
    this.modalEl.addClass('mod-sidebar-layout', 'nene-settings-panel-modal');
    this.contentEl.empty();
    this.contentEl.addClass('nene-settings-modal');
    void this.render();
  }

  async render() {
    const { contentEl } = this;
    const store = this.plugin.commandUriEnhancerStore;
    const settings = store.getSettings();

    contentEl.empty();

    // 弹窗头部
    renderModalHeader(
      contentEl,
      '文件速览命令设置',
      ''
    );

    // 删除文件时删除命令
    new obsidian.Setting(contentEl)
      .setName('删除文件时删除命令')
      .setDesc('开启后，删除文件会同时删除该文件对应的命令。')
      .addToggle((toggle) => {
        toggle
          .setValue(settings.deleteCommandWhenFileIsDeleted)
          .onChange(async (value) => {
            await store.setDeleteCommandWhenFileIsDeleted(value);
            new obsidian.Notice(value ? '已开启：删除文件时同步删除命令' : '已关闭：删除文件时保留命令');
            await this.onSettingsChanged();
            await this.render();
          });
      });

    // 重命名文件时更新命令
    new obsidian.Setting(contentEl)
      .setName('重命名文件时更新命令')
      .setDesc('开启后，重命名文件会同步更新命令的名称与目标路径。')
      .addToggle((toggle) => {
        toggle
          .setValue(settings.updateCommandsOnRename)
          .onChange(async (value) => {
            await store.setUpdateCommandsOnRename(value);
            new obsidian.Notice(value ? '已开启：重命名文件时同步更新命令' : '已关闭：重命名文件时保留原命令');
            await this.onSettingsChanged();
            await this.render();
          });
      });

    // 自定义变量条目：左侧两层文本，右侧弹窗按钮
    renderEntryRow(
      contentEl,
      'custom-variables',
      '自定义变量',
      '管理命令路径中的动态变量，支持日期格式与自定义代码',
      null,
      () => {
        new ManageVariablesModal(this.app, this.plugin, async () => {
          await this.onSettingsChanged();
          await this.render();
        }).open();
      },
      '变量管理'
    );

    // 管理命令分区
    renderSectionTitle(contentEl, '管理命令');

    new obsidian.Setting(contentEl)
      .setName('创建新命令')
      .setDesc('点击下方按钮为指定文件创建一条速览命令。')
      .addButton((button) => {
        button
          .setIcon('plus')
          .setTooltip('创建新命令')
          .onClick(() => {
            this.addNewCommand(contentEl);
          });
      });

    if (settings.commands.length === 0) {
      this.addNewCommand(contentEl);
      return;
    }

    // 按持久化的 isValid 分类：有效命令在前，失效命令在后
    var validCommands = [];
    var invalidCommands = [];

    settings.commands.forEach((cmd) => {
      if (cmd.isValid !== false) {
        validCommands.push(cmd);
      } else {
        invalidCommands.push(cmd);
      }
    });

    validCommands.forEach((cmd) => {
      this.renderCommandRow(contentEl, cmd, false);
    });

    if (invalidCommands.length > 0) {
      renderSectionTitle(contentEl, '失效命令');
      invalidCommands.forEach((cmd) => {
        this.renderCommandRow(contentEl, cmd, true);
      });
    }
  }

  // 新增一条空命令并渲染到列表末尾。
  addNewCommand(containerEl) {
    const store = this.plugin.commandUriEnhancerStore;
    const newCommand = {
      id: crypto.randomUUID(),
      name: '文件命令名',
      filePath: '',
      openFileIn: 'activeTab'
    };
    void store.addCommand(newCommand);
    this.plugin.openWithCommandRuntime.reload();
    void this.onSettingsChanged();
    this.renderCommandRow(containerEl, newCommand, true);
  }

  // 渲染单条命令配置行：删除 / 复制按钮 + 名称 + 路径搜索 + 打开位置下拉。
  // isInvalid 为 true 时将渲染失效样式（半透明背景、警告图标），适用于目标文件已不存在的命令。
  renderCommandRow(containerEl, commandConfig, isInvalid) {
    const store = this.plugin.commandUriEnhancerStore;
    const runtime = this.plugin.openWithCommandRuntime;
    const setting = new obsidian.Setting(containerEl);
    setting.setClass('nene-open-command-row');
    if (isInvalid) {
      setting.setClass('nene-open-command-invalid');
    }

    // 删除按钮：红色突出，点击后弹二次确认
    setting.addButton((button) => {
      button
        .setIcon('trash-2')
        .setClass('nene-command-delete-button')
        .setTooltip('删除命令')
        .onClick(() => {
          new ConfirmCommandDeleteModal(
            this.app,
            '删除命令',
            `确定删除命令「${commandConfig.name || '未命名命令'}」吗？此操作不可撤销。`,
            async () => {
              await store.removeCommandById(commandConfig.id);
              runtime.reload();
              new obsidian.Notice('命令已删除');
              await this.onSettingsChanged();
              await this.render();
            }
          ).open();
        });
    });

    // 复制按钮：生成一条相同配置的新命令
    setting.addButton((button) => {
      button
        .setIcon('copy')
        .setTooltip('复制命令')
        .onClick(() => {
          const copyCommand = {
            id: crypto.randomUUID(),
            name: commandConfig.name,
            filePath: commandConfig.filePath,
            openFileIn: commandConfig.openFileIn
          };
          void store.addCommand(copyCommand);
          runtime.reload();
          void this.onSettingsChanged();
          this.render();
        });
    });

    // 命令名称输入
    setting.addText((text) => {
      text
        .setPlaceholder('命令名称')
        .setValue(commandConfig.name || '')
        .onChange((value) => {
          commandConfig.name = value;
          void store.save();
          runtime.reload();
        });
    });

    // 文件路径搜索（带库内文件建议器）
    setting.addSearch((search) => {
      new suggesters.FileSuggest(search.inputEl, this.plugin);
      search
        .setPlaceholder('文件路径')
        .setValue(commandConfig.filePath || '')
        .onChange((value) => {
          // 禁止两条命令指向同一文件
          const duplicate = store
            .getSettings()
            .commands.find((command) => command && command.filePath === value && command.id !== commandConfig.id);
          if (duplicate && value) {
            new obsidian.Notice(`已存在指向同一文件的命令「${duplicate.name}」`);
            search.setValue(commandConfig.filePath || '');
            return;
          }
          commandConfig.filePath = value;
          void store.save();
          runtime.reload();
        });
    });

    // 命令级打开位置下拉
    setting.addDropdown((dropdown) => {
      dropdown.addOptions(constants.OPEN_FILE_IN_OPTIONS);
      dropdown.setValue(commandConfig.openFileIn || store.getSettings().openFileIn);
      dropdown.onChange((value) => {
        commandConfig.openFileIn = value;
        void store.save();
        runtime.reload();
      });
    });
  }
}

// 自定义变量管理弹窗。
class ManageVariablesModal extends obsidian.Modal {
  constructor(app, plugin, onSettingsChanged) {
    super(app);
    this.plugin = plugin;
    this.onSettingsChanged = onSettingsChanged;
  }

  onOpen() {
    this.modalEl.addClass('nene-popover-modal');
    this.contentEl.empty();
    this.contentEl.addClass('nene-settings-modal');
    void this.render();
  }

  async render() {
    const { contentEl } = this;
    const store = this.plugin.commandUriEnhancerStore;
    const settings = store.getSettings();

    contentEl.empty();

    renderModalHeader(
      contentEl,
      '自定义变量',
      '变量可在命令的文件路径中以 {{变量名}} 形式引用，支持内置日期变量 {{d:格式}}（如 {{d:YYYY-MM-DD}}，区分大小写）。'
    );

    // moment 日期格式化文档链接
    const docsEl = contentEl.createDiv({ cls: 'nene-variable-docs' });
    docsEl.createSpan({ text: '文档：' });
    docsEl.createEl('a', {
      text: 'https://momentjs.com/docs/#/displaying/format/',
      href: 'https://momentjs.com/docs/#/displaying/format/'
    });

    // JavaScript 类型变量的安全风险提示
    const riskHint = contentEl.createDiv({ cls: 'nene-variable-risk-hint' });
    riskHint.createDiv({ cls: 'nene-variable-risk-title', text: '安全提示' });
    riskHint.createEl(
      'p',
      { text: 'JavaScript 类型的变量会在命令执行时直接运行你输入的代码，等同于在配置中写代码。仅使用可信来源的代码，切勿粘贴来源不明的配置。' }
    );

    new obsidian.Setting(contentEl)
      .setName('管理变量')
      .setDesc('添加变量后，可在命令的文件路径中直接使用。')
      .addButton((button) => {
        button
          .setButtonText('添加变量')
          .onClick(async () => {
            settings.customVariables.push({ name: '', value: '', type: 'string' });
            await store.save();
            await this.render();
          });
      });

    settings.customVariables.forEach((variable) => {
      this.renderVariableRow(contentEl, variable);
    });
  }

  // 渲染单条变量配置行：名称 + 值 + 类型 + 删除按钮。
  renderVariableRow(containerEl, variable) {
    const store = this.plugin.commandUriEnhancerStore;
    const setting = new obsidian.Setting(containerEl);
    setting.setClass('nene-variable-row');

    setting.addText((text) => {
      text
        .setPlaceholder('变量名称')
        .setValue(variable.name || '')
        .onChange((value) => {
          variable.name = value;
          void store.save();
        });
    });

    setting.addTextArea((textarea) => {
      textarea
        .setPlaceholder('变量值')
        .setValue(variable.value || '')
        .onChange((value) => {
          variable.value = value;
          void store.save();
        });
    });

    setting.addDropdown((dropdown) => {
      dropdown
        .addOption('string', '字符串')
        .addOption('javascript', 'JavaScript')
        .setValue(variable.type || 'string')
        .onChange((value) => {
          variable.type = value;
          void store.save();
        });
    });

    setting.addButton((button) => {
      button
        .setIcon('trash')
        .setClass('nene-command-delete-button')
        .setTooltip('删除变量')
        .onClick(async () => {
          const variableIndex = store.getSettings().customVariables.indexOf(variable);
          if (variableIndex > -1) {
            store.getSettings().customVariables.splice(variableIndex, 1);
          }
          await store.save();
          await this.render();
        });
    });
  }
}

// 删除命令前的二次确认弹窗。
class ConfirmCommandDeleteModal extends obsidian.Modal {
  constructor(app, title, description, onConfirm) {
    super(app);
    this.title = title;
    this.description = description;
    this.onConfirm = onConfirm;
  }

  onOpen() {
    this.modalEl.addClass('nene-popover-modal');
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('nene-settings-modal');

    renderModalHeader(contentEl, this.title, this.description);

    const actionRow = contentEl.createDiv({ cls: 'nene-confirm-actions' });
    actionRow.createEl('button', { cls: 'mod-cta nene-confirm-cancel', text: '取消' }).addEventListener(
      'click',
      () => this.close()
    );
    actionRow
      .createEl('button', { cls: 'mod-warning nene-confirm-ok', text: '删除' })
      .addEventListener('click', () => {
        void this.onConfirm();
        this.close();
      });
  }
}

module.exports = {
  OpenWithCommandSettingsModal,
  ManageVariablesModal,
  ConfirmCommandDeleteModal
};
