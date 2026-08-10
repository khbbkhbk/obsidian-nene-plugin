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
var renderEmptyState = viewHelpers.renderEmptyState;

// 文件速览命令设置弹窗。
class OpenWithCommandSettingsModal extends obsidian.Modal {
  constructor(app, plugin, onSettingsChanged) {
    super(app);
    this.plugin = plugin; // 保存插件实例，便于访问 store 与运行时
    this.onSettingsChanged = onSettingsChanged; // 变更回调，用于联动父级弹窗刷新
    this.suggesters = []; // 当前已创建的路径建议器列表，重渲染前统一释放
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

    // 释放上一轮渲染遗留的建议浮层与事件监听，避免 DOM 残留与监听泄漏
    this.disposeSuggesters();
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

    new obsidian.Setting(contentEl)
      .setName('命令管理')
      .setDesc('创建或管理指定文件的速览命令。')
      .addButton((button) => {
        button
          .setIcon('plus')
          .setTooltip('创建新命令')
          .onClick(() => {
            new NewCommandModal(this.app, this.plugin, async () => {
              await this.onSettingsChanged();
              await this.render();
            }).open();
          });
      });

    if (settings.commands.length === 0) {
      renderEmptyState(contentEl, '暂无文件速览命令，点击上方"创建新命令"按钮添加。');
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

  // 释放全部路径建议器：关闭残留浮层并移除事件监听，清空登记列表。
  disposeSuggesters() {
    this.suggesters.forEach((suggester) => {
      suggester.dispose();
    });
    this.suggesters = [];
  }

  // 渲染单条命令配置行：删除按钮 + 名称 + 路径搜索 + 打开位置下拉。
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

    // 命令名称输入：与创建时一致，不允许为空、不允许与已有命令重名
    setting.addText((text) => {
      text
        .setPlaceholder('命令名称')
        .setValue(commandConfig.name || '')
        .onChange((value) => {
          const newName = (value || '').trim();
          // 命令名称不允许为空
          if (!newName) {
            new obsidian.Notice('命令名称不能为空');
            text.setValue(commandConfig.name || '');
            return;
          }
          // 不允许与已有命令重名（排除自身）
          const sameName = store
            .getSettings()
            .commands.find((command) => command && command.name === newName && command.id !== commandConfig.id);
          if (sameName) {
            new obsidian.Notice(`已存在同名命令「${sameName.name}」，请更换命令名称`);
            text.setValue(commandConfig.name || '');
            return;
          }
          commandConfig.name = newName;
          void store.save();
          runtime.reload();
        });
    });

    // 文件路径搜索（带库内文件建议器）：与创建时一致，不允许为空、目标文件必须存在、不允许与已有命令指向同一文件
    setting.addSearch((search) => {
      this.suggesters.push(new suggesters.FileSuggest(search.inputEl, this.plugin));
      search
        .setPlaceholder('文件路径')
        .setValue(commandConfig.filePath || '')
        .onChange((value) => {
          // 路径不允许为空
          if (!value) {
            new obsidian.Notice('请选择目标文件路径');
            search.setValue(commandConfig.filePath || '');
            return;
          }
          // 含变量占位符的路径无法静态校验存在性，跳过；普通路径必须指向库内已有文件
          if (!value.includes('{{')) {
            const targetFile = this.plugin.app.vault.getAbstractFileByPath(value);
            if (!(targetFile instanceof obsidian.TFile)) {
              new obsidian.Notice('目标文件不存在，请选择库内已有文件');
              search.setValue(commandConfig.filePath || '');
              return;
            }
          }
          // 禁止两条命令指向同一文件（排除自身）
          const duplicate = store
            .getSettings()
            .commands.find((command) => command && command.filePath === value && command.id !== commandConfig.id);
          if (duplicate) {
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

// 新建文件速览命令编辑弹窗：提供名称、路径（带建议器）与打开方式三个字段，
// 确认前校验路径是否与已有命令重复，重复时 toast 警告并停留；校验通过后持久化并重建命令注册表。
// 默认值与原有新建逻辑保持一致：名称"文件命令名"、路径为空、打开方式为当前标签页。
class NewCommandModal extends obsidian.Modal {
  constructor(app, plugin, onSaved) {
    super(app);
    this.plugin = plugin; // 保存插件实例，便于访问 store 与运行时
    this.onSaved = onSaved; // 保存成功回调，用于联动父级弹窗刷新
    this.pendingCommand = {
      id: crypto.randomUUID(),
      name: '文件命令名',
      filePath: '',
      openFileIn: 'activeTab'
    };
    this.suggesters = []; // 当前已创建的路径建议器列表，弹窗关闭时统一释放
  }

  // 弹窗关闭时释放路径建议器，避免浮层 DOM 残留与事件监听泄漏。
  onClose() {
    this.suggesters.forEach((suggester) => {
      suggester.dispose();
    });
    this.suggesters = [];
    super.onClose();
  }

  // 打开弹窗时渲染编辑表单。
  onOpen() {
    this.modalEl.addClass('nene-popover-modal');
    this.modalEl.addClass('nene-new-command-modal');
    this.contentEl.empty();
    this.contentEl.addClass('nene-settings-modal');
    this.render();
  }

  // 渲染新建表单：所有控件平铺一行，底部右对齐操作按钮。
  render() {
    const { contentEl } = this;

    // 可滚动的内容区域
    const bodyEl = contentEl.createDiv({ cls: 'nene-new-command-body' });
    bodyEl.createEl('h3', { text: '新建文件速览命令' });

    // 名称 + 文件路径（带建议器）+ 打开方式 平铺一行
    const setting = new obsidian.Setting(bodyEl);
    setting.settingEl.addClass('nene-new-command-setting');
    setting
      .addText((text) => {
        text
          .setPlaceholder('命令名称')
          .setValue(this.pendingCommand.name)
          .onChange((value) => {
            this.pendingCommand.name = value;
          });
      })
      .addSearch((search) => {
        this.suggesters.push(new suggesters.FileSuggest(search.inputEl, this.plugin));
        search
          .setPlaceholder('文件路径')
          .setValue(this.pendingCommand.filePath)
          .onChange((value) => {
            this.pendingCommand.filePath = value;
          });
      })
      .addDropdown((dropdown) => {
        dropdown
          .addOptions(constants.OPEN_FILE_IN_OPTIONS)
          .setValue(this.pendingCommand.openFileIn)
          .onChange((value) => {
            this.pendingCommand.openFileIn = value;
          });
      });

    // 固定在底部右对齐的操作按钮
    const footerEl = contentEl.createDiv({ cls: 'nene-new-command-footer' });
    footerEl.createEl('button', { text: '取消' }).addEventListener('click', () => {
      this.close();
    });
    footerEl.createEl('button', { cls: 'mod-cta', text: '确认' }).addEventListener('click', () => {
      this.confirmCreate();
    });
  }

  // 确认创建：校验名称非空且不重名、路径已填写且不与已有命令重复，不通过时 toast 警告并停留；通过后保存、刷新并关闭。
  confirmCreate() {
    const store = this.plugin.commandUriEnhancerStore;
    const targetPath = this.pendingCommand.filePath || '';
    const targetName = (this.pendingCommand.name || '').trim();

    // 禁止创建空路径命令：路径必须填写，否则无法定位目标文件
    if (!targetPath) {
      new obsidian.Notice('请先选择目标文件路径');
      return;
    }
    // 含变量占位符的路径无法静态校验存在性，跳过；普通路径必须指向库内已有文件
    if (!targetPath.includes('{{')) {
      const targetFile = this.plugin.app.vault.getAbstractFileByPath(targetPath);
      if (!(targetFile instanceof obsidian.TFile)) {
        new obsidian.Notice('目标文件不存在，请选择库内已有文件');
        return;
      }
    }
    // 命令名称可选，但不允许为空
    if (!targetName) {
      new obsidian.Notice('命令名称不能为空');
      return;
    }
    // 禁止命令重名
    const sameName = store
      .getSettings()
      .commands.find((command) => command && command.name === targetName && command.id !== this.pendingCommand.id);
    if (sameName) {
      new obsidian.Notice(`已存在同名命令「${sameName.name}」，请更换命令名称`);
      return;
    }
    // 禁止两条命令指向同一文件
    const duplicate = store.getSettings().commands.find((command) => command && command.filePath === targetPath);
    if (duplicate) {
      new obsidian.Notice(`已存在指向同一文件的命令「${duplicate.name}」，请更换目标文件`);
      return;
    }

    // 校验通过后，以去除首尾空白后的名称创建
    this.pendingCommand.name = targetName;

    void (async () => {
      try {
        await store.addCommand(this.pendingCommand);
        // 创建后立即按目标文件是否存在刷新有效性，避免空路径 / 失效命令误显示为有效样式
        this.plugin.openWithCommandRuntime.validateAllCommands();
        this.plugin.openWithCommandRuntime.reload();
        await this.onSaved();
        this.close();
      } catch (error) {
        console.error('[ねね] 创建文件速览命令失败', error);
        new obsidian.Notice(`创建命令失败：${error.message || '未知错误'}`);
      }
    })();
  }
}

module.exports = {
  OpenWithCommandSettingsModal,
  ManageVariablesModal,
  ConfirmCommandDeleteModal,
  NewCommandModal
};
