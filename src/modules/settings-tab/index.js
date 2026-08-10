'use strict';

var obsidian = require('obsidian');
var commandUriEnhancerModule = require('../command-uri-enhancer/index.js');
var editorEnhancerModule = require('../editor-enhancer/index.js');
var menuCustomizerModule = require('../context-menu-enhancer/index.js');
var statusBarEnhancerModule = require('../status-bar-enhancer/index.js');
var tabBarEnhancerModule = require('../tab-bar-enhancer/index.js');
var fileExplorerEnhancerModule = require('../file-explorer-enhancer/index.js');
var themeEnhancerModule = require('../theme-enhancer/index.js');

// 打开设置子界面并登记到插件，供热更新重载时统一关闭与恢复。
// kind 为子界面类型标识，重载后按该标识用新插件实例重建弹窗。
function openSettingsModal(plugin, modal, kind) {
  plugin.trackSettingsModal(modal, kind);
  modal.open();
  return modal;
}

// 热更新重载后按类型重新打开对应的设置子界面，全部使用新插件实例重建，
// 使弹窗内容随最新代码与数据即时刷新。
function reopenSettingsSubinterface(plugin, kind) {
  const refreshSettings = async () => {
    if (plugin.settingTab) {
      await plugin.settingTab.display();
    }
  };

  switch (kind) {
    case 'file-marker':
      openSettingsModal(plugin, new FileMarkerManagementModal(plugin.app, plugin, refreshSettings), kind);
      break;
    case 'anchor-graph':
      openSettingsModal(plugin, new AnchorGraphManagementModal(plugin.app, plugin, refreshSettings), kind);
      break;
    case 'menu-customizer':
      openSettingsModal(plugin, new MenuCustomizerManagementModal(plugin.app, plugin, refreshSettings), kind);
      break;
    case 'command-uri':
      openSettingsModal(plugin, new CommandUriEnhancerManagementModal(plugin.app, plugin, refreshSettings), kind);
      break;
    case 'open-with-command':
      openSettingsModal(plugin, new commandUriEnhancerModule.OpenWithCommandSettingsModal(plugin.app, plugin, refreshSettings), kind);
      break;
    case 'status-bar':
      openSettingsModal(plugin, new StatusBarEnhancerManagementModal(plugin.app, plugin, refreshSettings), kind);
      break;
    case 'tab-bar':
      openSettingsModal(plugin, new TabBarEnhancerManagementModal(plugin.app, plugin, refreshSettings), kind);
      break;
    case 'config':
      openSettingsModal(plugin, new ConfigManagementModal(plugin.app, plugin, refreshSettings), kind);
      break;
    case 'file-explorer':
      openSettingsModal(plugin, new fileExplorerEnhancerModule.FileExplorerManagerModal(plugin), kind);
      break;
    case 'editor-enhancer':
      openSettingsModal(plugin, new EditorEnhancerManagementModal(plugin.app, plugin, refreshSettings), kind);
      break;
    case 'status-bar-organizer':
      openSettingsModal(plugin, new statusBarEnhancerModule.StatusBarOrganizerModal(plugin.app, plugin, refreshSettings), kind);
      break;
    case 'theme-enhancer':
      openSettingsModal(plugin, new themeEnhancerModule.ThemeEnhancerManagementModal(plugin.app, plugin, refreshSettings), kind);
      break;
    default:
      break;
  }
}

// 优先使用现代剪贴板 API，失败时回退到传统复制命令。
async function copyTextToClipboard(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textareaEl = document.createElement('textarea');
  textareaEl.value = text;
  textareaEl.style.position = 'fixed';
  textareaEl.style.opacity = '0';
  document.body.appendChild(textareaEl);
  textareaEl.focus();
  textareaEl.select();

  const copied = document.execCommand('copy');
  document.body.removeChild(textareaEl);

  if (!copied) {
    throw new Error('Clipboard copy is not supported');
  }
}

// 渲染弹窗公共头部，统一标题与说明样式。
function renderModalHeader(containerEl, title, description) {
  const headerEl = containerEl.createDiv({ cls: 'nene-settings-modal-header' });
  headerEl.createDiv({ cls: 'nene-settings-modal-title', text: title });

  if (description) {
    headerEl.createEl('p', {
      cls: 'nene-settings-modal-description',
      text: description
    });
  }
}

// 渲染信息行，用于展示状态、路径与摘要。
function renderDetailItem(containerEl, label, value, codeStyle) {
  const itemEl = containerEl.createDiv({ cls: 'nene-settings-detail-item' });
  itemEl.createDiv({ cls: 'nene-settings-detail-label', text: label });
  itemEl.createEl(codeStyle ? 'code' : 'div', {
    cls: 'nene-settings-detail-value',
    text: value
  });
}

// 定义导出弹窗，便于用户直接复制完整配置 JSON。
class ConfigurationExportModal extends obsidian.Modal {
  constructor(app, exportedText) {
    super(app);
    this.exportedText = exportedText; // 保存已生成的导出文本，供复制与展示复用
  }

  // 打开弹窗时渲染只读文本与复制按钮。
  onOpen() {
    const { contentEl } = this;
    this.modalEl.addClass('mod-sidebar-layout', 'nene-settings-panel-modal');
    contentEl.empty();
    contentEl.addClass('nene-settings-modal');

    renderModalHeader(
      contentEl,
      '导出插件配置',
      '以下内容包含当前核心配置与模块配置，可直接复制保存，或用于后续导入恢复。'
    );

    const textareaEl = contentEl.createEl('textarea', {
      cls: 'nene-settings-json-textarea'
    });
    textareaEl.value = this.exportedText;
    textareaEl.readOnly = true;

    const actionEl = contentEl.createDiv({ cls: 'nene-settings-modal-actions' });
    const copyButtonEl = actionEl.createEl('button', {
      cls: 'mod-cta',
      text: '复制内容'
    });
    const closeButtonEl = actionEl.createEl('button', {
      text: '关闭'
    });

    copyButtonEl.addEventListener('click', async () => {
      try {
        await copyTextToClipboard(this.exportedText);
        new obsidian.Notice('配置内容已复制到剪贴板');
      } catch (error) {
        console.error('复制导出配置失败', error);
        new obsidian.Notice('复制失败，请手动全选文本后复制');
      }
    });

    closeButtonEl.addEventListener('click', () => {
      this.close();
    });
  }

  // 关闭弹窗时清理内容，避免重复挂载旧节点。
  onClose() {
    this.contentEl.empty();
  }
}

// 定义导入弹窗，允许用户粘贴 JSON 文本并立即恢复配置。
class ConfigurationImportModal extends obsidian.Modal {
  constructor(app, onSubmit) {
    super(app);
    this.onSubmit = onSubmit; // 保存提交回调，供设置页在导入成功后刷新界面
  }

  // 打开弹窗时渲染输入框与确认按钮。
  onOpen() {
    const { contentEl } = this;
    this.modalEl.addClass('mod-sidebar-layout', 'nene-settings-panel-modal');
    contentEl.empty();
    contentEl.addClass('nene-settings-modal');

    renderModalHeader(
      contentEl,
      '导入插件配置',
      '请粘贴此前导出的 JSON 文本。导入后会立即覆盖当前插件配置，请确认内容来源可信。'
    );

    const textareaEl = contentEl.createEl('textarea', {
      cls: 'nene-settings-json-textarea'
    });
    textareaEl.placeholder = '在此粘贴导出的配置 JSON';

    const actionEl = contentEl.createDiv({ cls: 'nene-settings-modal-actions' });
    const cancelButtonEl = actionEl.createEl('button', {
      text: '取消'
    });
    const submitButtonEl = actionEl.createEl('button', {
      cls: 'mod-warning',
      text: '导入并覆盖'
    });

    cancelButtonEl.addEventListener('click', () => {
      this.close();
    });

    submitButtonEl.addEventListener('click', async () => {
      const rawText = textareaEl.value.trim();
      if (!rawText) {
        new obsidian.Notice('请先粘贴需要导入的配置 JSON');
        return;
      }

      submitButtonEl.disabled = true;

      try {
        // 导入前安全审查：检测配置中是否包含 JavaScript 类型自定义变量
        var hasJsVars = false;
        try {
          var parsed = JSON.parse(rawText);
          hasJsVars = commandUriEnhancerModule.hasJavaScriptVariables(parsed);
        } catch (e) { /* JSON 解析失败由后续 importConfigurationBundle 处理 */ }

        if (hasJsVars) {
          // 发现 JavaScript 类型变量，弹出二次确认框明确告知风险
          submitButtonEl.disabled = false;
          var self = this;
          new ConfirmActionModal(
            this.app,
            '安全风险确认 — JavaScript 代码变量',
            '检测到导入配置中包含 JavaScript 类型变量。这些变量会以受限沙箱方式执行（仅可访问 Date/Math/JSON 等内置对象），但仍存在一定风险。请确认导入的配置来源完全可信，建议仅导入自己导出或信任来源的配置。',
            '确认导入（我已了解风险）',
            async function () {
              submitButtonEl.disabled = true;
              try {
                await self.onSubmit(rawText);
                new obsidian.Notice('插件配置已导入');
                self.close();
              } catch (error) {
                console.error('导入插件配置失败', error);
                new obsidian.Notice('导入失败：' + (error.message || '请检查 JSON 格式'));
              } finally {
                submitButtonEl.disabled = false;
              }
            }
          ).open();
          return;
        }

        await this.onSubmit(rawText);
        new obsidian.Notice('插件配置已导入');
        this.close();
      } catch (error) {
        console.error('导入插件配置失败', error);
        new obsidian.Notice(`导入失败：${error.message || '请检查 JSON 格式'}`);
      } finally {
        submitButtonEl.disabled = false;
      }
    });
  }

  // 关闭弹窗时清理内容，避免重复挂载旧节点。
  onClose() {
    this.contentEl.empty();
  }
}

// 定义确认弹窗，避免重置配置时误触造成不可逆覆盖。
class ConfirmActionModal extends obsidian.Modal {
  constructor(app, title, description, confirmText, onConfirm) {
    super(app);
    this.title = title; // 保存标题，便于同一个确认弹窗复用不同操作
    this.description = description; // 保存风险说明，帮助用户理解当前操作影响
    this.confirmText = confirmText; // 保存确认按钮文案，便于针对不同操作定制
    this.onConfirm = onConfirm; // 保存确认后的执行逻辑
  }

  // 打开弹窗时渲染说明文本与确认按钮。
  onOpen() {
    const { contentEl } = this;
    this.modalEl.addClass('mod-sidebar-layout', 'nene-settings-panel-modal');
    contentEl.empty();
    contentEl.addClass('nene-settings-modal');

    renderModalHeader(contentEl, this.title, this.description);

    const actionEl = contentEl.createDiv({ cls: 'nene-settings-modal-actions' });
    const cancelButtonEl = actionEl.createEl('button', {
      text: '取消'
    });
    const confirmButtonEl = actionEl.createEl('button', {
      cls: 'mod-warning',
      text: this.confirmText
    });

    cancelButtonEl.addEventListener('click', () => {
      this.close();
    });

    confirmButtonEl.addEventListener('click', async () => {
      confirmButtonEl.disabled = true;

      try {
        await this.onConfirm();
        this.close();
      } finally {
        confirmButtonEl.disabled = false;
      }
    });
  }

  // 关闭弹窗时清理内容，避免重复挂载旧节点。
  onClose() {
    this.contentEl.empty();
  }
}

// 定义文件标记管理弹窗，将详细维护动作从主设置页中移出。
class FileMarkerManagementModal extends obsidian.Modal {
  constructor(app, plugin, onSettingsChanged) {
    super(app);
    this.plugin = plugin;
    this.onSettingsChanged = onSettingsChanged; // 保存回调，便于操作完成后刷新设置页
  }

  // 打开弹窗时渲染模块详情与维护操作。
  onOpen() {
    this.modalEl.addClass('mod-sidebar-layout', 'nene-settings-panel-modal');
    this.contentEl.empty();
    this.contentEl.addClass('nene-settings-modal');
    void this.render();
  }

  // 根据当前最新状态渲染文件标记模块管理界面。
  async render() {
    const { contentEl } = this;
    const summary = this.plugin.getSettingsSummary();
    const configSummary = await this.plugin.getConfigManagementSummary();

    contentEl.empty();
    renderModalHeader(
      contentEl,
      '文件标记模块',
      '这里集中放置文件标记模块的具体管理动作，主设置页只保留启用状态与入口。'
    );

    const detailListEl = contentEl.createDiv({ cls: 'nene-settings-detail-list' });
    renderDetailItem(detailListEl, '当前状态', summary.fileMarkerEnabled ? '已启用' : '已关闭');
    renderDetailItem(detailListEl, '标记数量', `${summary.markCount} 条`);
    renderDetailItem(detailListEl, '分组数量', `${summary.groupCount} 个`);
    renderDetailItem(detailListEl, '配置文件', configSummary.fileMarker.path, true);

    new obsidian.Setting(contentEl)
      .setName('打开文件标记面板')
      .setDesc(summary.fileMarkerEnabled ? '在右侧侧边栏打开文件标记面板。' : '模块当前未启用，请先回到设置页开启。')
      .addButton((button) => {
        button
          .setButtonText('打开面板')
          .setDisabled(!summary.fileMarkerEnabled)
          .onClick(async () => {
            await this.plugin.startFileMarkerFeature();
          });
      });

    new obsidian.Setting(contentEl)
      .setName('清理失效标记')
      .setDesc('立即移除已不存在文件对应的标记记录，并同步刷新文件标记面板。')
      .addButton((button) => {
        button
          .setButtonText('立即清理')
          .onClick(async () => {
            const hasChanged = await this.plugin.pruneMissingMarkRecords();
            new obsidian.Notice(hasChanged ? '失效标记已清理' : '当前没有需要清理的失效标记');
            await this.onSettingsChanged();
            await this.render();
          });
      });

    new obsidian.Setting(contentEl)
      .setName('重置模块配置')
      .setDesc('将文件标记模块的数据文件恢复为默认值，不影响关系图谱设置与核心开关。')
      .addButton((button) => {
        button
          .setButtonText('重置 file-marker')
          .setWarning()
          .onClick(() => {
            new ConfirmActionModal(
              this.app,
              '重置文件标记配置',
              '此操作会将文件标记的 marks 与 groups 恢复为默认值，当前已有的标记记录将被覆盖。',
              '确认重置',
              async () => {
                await this.plugin.resetFeatureConfiguration('fileMarker');
                new obsidian.Notice('文件标记配置已重置');
                await this.onSettingsChanged();
                await this.render();
              }
            ).open();
          });
      });
  }

  // 关闭弹窗时清理内容，避免重复挂载旧节点。
  onClose() {
    this.contentEl.empty();
  }
}

// 定义关系图谱管理弹窗，将模块维护动作从主设置页中移出。
class AnchorGraphManagementModal extends obsidian.Modal {
  constructor(app, plugin, onSettingsChanged) {
    super(app);
    this.plugin = plugin;
    this.onSettingsChanged = onSettingsChanged; // 保存回调，便于操作完成后刷新设置页
  }

  // 打开弹窗时渲染模块详情与维护操作。
  onOpen() {
    this.modalEl.addClass('mod-sidebar-layout', 'nene-settings-panel-modal');
    this.contentEl.empty();
    this.contentEl.addClass('nene-settings-modal');
    void this.render();
  }

  // 根据当前最新状态渲染关系图谱模块管理界面。
  async render() {
    const { contentEl } = this;
    const summary = this.plugin.getSettingsSummary();
    const configSummary = await this.plugin.getConfigManagementSummary();

    contentEl.empty();
    renderModalHeader(
      contentEl,
      '关系图谱模块',
      '这里集中放置关系图谱增强模块的具体管理动作，主设置页只保留启用状态与入口。'
    );

    const detailListEl = contentEl.createDiv({ cls: 'nene-settings-detail-list' });
    renderDetailItem(detailListEl, '当前状态', summary.anchorGraphEnabled ? '已启用' : '已关闭');
    renderDetailItem(detailListEl, '运行状态', summary.anchorGraphRuntimeMessage);
    renderDetailItem(detailListEl, '已识别源文件', `${summary.anchorGraphSourceFileCount} 个`);
    renderDetailItem(detailListEl, '已注入关系边', `${summary.anchorGraphEdgeCount} 条`);
    renderDetailItem(detailListEl, '配置文件', configSummary.anchorGraph.path, true);

    new obsidian.Setting(contentEl)
      .setName('立即刷新关系图谱')
      .setDesc(summary.anchorGraphEnabled ? '重新扫描并注入当前可识别的 HTML 内部链接关系。' : '模块当前未启用，请先回到设置页开启。')
      .addButton((button) => {
        button
          .setButtonText('立即刷新')
          .setDisabled(!summary.anchorGraphEnabled)
          .onClick(async () => {
            await this.plugin.refreshAnchorGraphLinks(true);
            await this.onSettingsChanged();
            await this.render();
          });
      });

    new obsidian.Setting(contentEl)
      .setName('重置模块配置')
      .setDesc('将关系图谱增强模块的数据文件恢复为默认值，不影响文件标记设置与核心开关。')
      .addButton((button) => {
        button
          .setButtonText('重置 anchor-graph')
          .setWarning()
          .onClick(() => {
            new ConfirmActionModal(
              this.app,
              '重置关系图谱配置',
              '此操作会将关系图谱增强的默认设置与笔记覆盖规则恢复为默认值。',
              '确认重置',
              async () => {
                await this.plugin.resetFeatureConfiguration('anchorGraph');
                new obsidian.Notice('关系图谱配置已重置');
                await this.onSettingsChanged();
                await this.render();
              }
            ).open();
          });
      });
  }

  // 关闭弹窗时清理内容，避免重复挂载旧节点。
  onClose() {
    this.contentEl.empty();
  }
}

// 定义右键菜单管理弹窗入口，实际内容由独立模块实现。
class MenuCustomizerManagementModal extends menuCustomizerModule.MenuCustomizerManagementModal {
}

// 定义命令&URI增强模块管理弹窗入口，实际内容由独立模块实现。
class CommandUriEnhancerManagementModal extends commandUriEnhancerModule.CommandUriEnhancerManagementModal {
}

// 定义状态栏增强模块管理弹窗入口，实际内容由独立模块实现。
class StatusBarEnhancerManagementModal extends statusBarEnhancerModule.StatusBarEnhancerManagementModal {
}

// 定义标签栏增强模块管理弹窗入口，实际内容由独立模块实现。
class TabBarEnhancerManagementModal extends tabBarEnhancerModule.TabBarEnhancerManagementModal {
}

// 定义编辑增强模块管理弹窗入口，实际内容由独立模块实现。
class EditorEnhancerManagementModal extends editorEnhancerModule.EditorEnhancerManagementModal {
}

// 定义配置文件管理弹窗，集中处理导入、导出与全量重置。
class ConfigManagementModal extends obsidian.Modal {
  constructor(app, plugin, onSettingsChanged) {
    super(app);
    this.plugin = plugin;
    this.onSettingsChanged = onSettingsChanged; // 保存回调，便于操作完成后刷新设置页
  }

  // 打开弹窗时渲染配置文件管理界面。
  onOpen() {
    this.modalEl.addClass('mod-sidebar-layout', 'nene-settings-panel-modal');
    this.contentEl.empty();
    this.contentEl.addClass('nene-settings-modal');
    void this.render();
  }

  // 根据当前最新状态渲染配置文件管理界面。
  async render() {
    const { contentEl } = this;
    const configSummary = await this.plugin.getConfigManagementSummary();

    contentEl.empty();
    renderModalHeader(
      contentEl,
      '配置文件管理',
      ''
    );

    const detailListEl = contentEl.createDiv({ cls: 'nene-settings-detail-list' });
    renderDetailItem(detailListEl, '核心配置', `${configSummary.core.exists ? '已存在' : '未发现'}，${configSummary.core.summary}`);
    renderDetailItem(detailListEl, '文件标记配置', `${configSummary.fileMarker.exists ? '已存在' : '未发现'}，${configSummary.fileMarker.summary}`);
    renderDetailItem(detailListEl, '关系图谱配置', `${configSummary.anchorGraph.exists ? '已存在' : '未发现'}，${configSummary.anchorGraph.summary}`);
    renderDetailItem(detailListEl, '右键菜单配置', `${configSummary.menuCustomizer.exists ? '已存在' : '未发现'}，${configSummary.menuCustomizer.summary}`);
    renderDetailItem(detailListEl, '命令&URI增强配置', `${configSummary.commandUriEnhancer.exists ? '已存在' : '未发现'}，${configSummary.commandUriEnhancer.summary}`);
    renderDetailItem(detailListEl, '状态栏增强配置', `${configSummary.statusBarEnhancer.exists ? '已存在' : '未发现'}，${configSummary.statusBarEnhancer.summary}`);
    renderDetailItem(detailListEl, '标签栏增强配置', `${configSummary.tabBarEnhancer.exists ? '已存在' : '未发现'}，${configSummary.tabBarEnhancer.summary}`);
    renderDetailItem(detailListEl, '文件列表增强配置', `${configSummary.fileExplorerEnhancer.exists ? '已存在' : '未发现'}，${configSummary.fileExplorerEnhancer.summary}`);
    renderDetailItem(detailListEl, '编辑增强配置', `${configSummary.editorEnhancer.exists ? '已存在' : '未发现'}，${configSummary.editorEnhancer.summary}`);
    renderDetailItem(detailListEl, '配置目录', configSummary.directoryPath, true);
    renderDetailItem(detailListEl, '导出目录', configSummary.exportDirectoryPath, true);

    new obsidian.Setting(contentEl)
      .setName('查看导出 JSON')
      .setDesc('')
      .addButton((button) => {
        button
          .setButtonText('查看内容')
          .onClick(() => {
            new ConfigurationExportModal(this.app, this.plugin.exportConfigurationBundle()).open();
          });
      });

    new obsidian.Setting(contentEl)
      .setName('导出到独立文件')
      .setDesc('将当前完整配置导出为独立备份文件，自动写入插件目录下的 exports 子目录。')
      .addButton((button) => {
        button
          .setButtonText('导出文件')
          .onClick(async () => {
            const exportResult = await this.plugin.exportConfigurationBundleToFile();
            new obsidian.Notice(`配置已导出到 ${exportResult.fileName}`);
            await this.render();
          });
      });

    new obsidian.Setting(contentEl)
      .setName('复制配置目录路径')
      .setDesc('复制 configs 目录路径')
      .addButton((button) => {
        button
          .setButtonText('复制路径')
          .onClick(async () => {
            try {
              await copyTextToClipboard(configSummary.directoryPath);
              new obsidian.Notice('配置目录路径已复制');
            } catch (error) {
              console.error('复制配置目录路径失败', error);
              new obsidian.Notice('复制失败，请手动查看上方路径');
            }
          });
      });

    new obsidian.Setting(contentEl)
      .setName('导入配置')
      .setDesc('粘贴此前导出的 JSON 文本后，立即覆盖当前插件配置。导入后设置页与运行时状态会自动同步。')
      .addButton((button) => {
        button
          .setButtonText('导入 JSON')
          .onClick(() => {
            new ConfigurationImportModal(this.app, async (rawText) => {
              await this.plugin.importConfigurationBundle(rawText);
              await this.onSettingsChanged();
              await this.render();
            }).open();
          });
      });

    new obsidian.Setting(contentEl)
      .setName('重置全部配置')
      .setDesc('同时重置 data.json 与所有模块配置文件。功能开关、文件标记、关系图谱、右键菜单、命令&URI增强、状态栏增强、标签栏增强、文件列表增强和编辑增强设置都会恢复为首次安装状态。')
      .addButton((button) => {
        button
          .setButtonText('重置全部')
          .setWarning()
          .onClick(() => {
            new ConfirmActionModal(
              this.app,
              '重置全部插件配置',
              '此操作会覆盖当前插件的全部配置文件，包括 data.json、file-marker.json、anchor-graph.json、menu-customizer.json、command-uri-enhancer.json、status-bar-enhancer.json、tab-bar-enhancer.json、file-explorer-enhancer.json 和 editor-enhancer.json。请仅在确认需要恢复初始状态时执行。',
              '确认全部重置',
              async () => {
                await this.plugin.resetAllConfiguration();
                new obsidian.Notice('插件全部配置已重置');
                await this.onSettingsChanged();
                await this.render();
              }
            ).open();
          });
      });
  }

  // 关闭弹窗时清理内容，避免重复挂载旧节点。
  onClose() {
    this.contentEl.empty();
  }
}

// 定义插件设置页，在不改变现有默认逻辑的前提下提供查看与快捷操作入口。
class ObsidianNenePluginSettingTab extends obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin; // 保存插件实例，便于读取统计信息和触发快捷操作
  }

  // 创建带模块标识的设置项，便于子窗口关闭后定位并高亮对应条目。
  createEntrySetting(containerEl, kind) {
    const setting = new obsidian.Setting(containerEl);
    setting.settingEl.addClass('nene-settings-entry');
    setting.settingEl.dataset.entryKind = kind;
    return setting;
  }

  // 打开模块设置子窗口，并在其关闭后高亮设置页中对应的模块条目。
  // kind 与 createEntrySetting 传入的标识保持一致。
  openSubSettingsModal(modal, kind) {
    const settingTab = this;
    const originalOnClose = modal.onClose;
    modal.onClose = function () {
      if (typeof originalOnClose === 'function') {
        originalOnClose.call(this);
      }
      settingTab.highlightEntry(kind);
    };
    openSettingsModal(settingTab.plugin, modal, kind);
    return modal;
  }

  // 高亮设置页中 kind 对应的模块条目，闪烁动画结束后自动移除高亮类。
  highlightEntry(kind) {
    const entryEl = this.containerEl.querySelector(`.nene-settings-entry[data-entry-kind="${kind}"]`);
    if (!entryEl) {
      return;
    }
    entryEl.addClass('nene-settings-entry-highlight');
    // 动画时长 1.0s，稍作余量后移除类，保证下次进入能重新触发动画。
    window.setTimeout(() => {
      entryEl.removeClass('nene-settings-entry-highlight');
    }, 1000);
  }

  // 渲染设置页内容，主页面只保留模块开启状态与管理入口。
  async display() {
    const { containerEl } = this;
    const summary = this.plugin.getSettingsSummary();
    containerEl.empty();
    containerEl.addClass('nene-settings-tab');

    const headerEl = containerEl.createDiv({ cls: 'nene-settings-header' });
    headerEl.createDiv({ cls: 'nene-settings-title', text: 'ねね 设置' });
    headerEl.createEl('p', {
      cls: 'nene-settings-description',
      text: ''
    });

    const featureGroupEl = containerEl.createDiv({ cls: 'nene-settings-group' });
    featureGroupEl.createDiv({ cls: 'nene-settings-group-title', text: '功能模块' });

    this.renderThemeEnhancerSection(featureGroupEl, summary);
    this.renderStatusBarEnhancerSection(featureGroupEl, summary);
    this.renderTabBarEnhancerSection(featureGroupEl, summary);
    this.renderMenuCustomizerSection(featureGroupEl, summary);
    this.renderEditorEnhancerSection(featureGroupEl, summary);
    this.renderCommandUriEnhancerSection(featureGroupEl, summary);
    this.renderFileMarkerSection(featureGroupEl, summary);
    this.renderAnchorGraphSection(featureGroupEl, summary);

    // 核心插件增强作为独立分组，与功能模块、配置管理平级。
    const corePluginGroupEl = containerEl.createDiv({ cls: 'nene-settings-group' });
    this.renderCorePluginEnhancerSection(corePluginGroupEl, summary);

    const managementGroupEl = containerEl.createDiv({ cls: 'nene-settings-group' });
    managementGroupEl.createDiv({ cls: 'nene-settings-group-title', text: '配置管理' });

    this.renderConfigManagementEntry(managementGroupEl);
    this.renderRuleSection(managementGroupEl);
  }

  // 渲染文件标记模块分区，仅保留状态概览、开关与弹窗入口。
  renderFileMarkerSection(containerEl, summary) {
    this.createEntrySetting(containerEl, 'file-marker')
      .setName('文件标记面板')
      .setDesc(
        summary.fileMarkerEnabled
          ? (
            summary.fileMarkerViewOpen
              ? `已启用，面板已打开，当前共有 ${summary.markCount} 条标记、${summary.groupCount} 个分组。`
              : `已启用，面板未打开，当前已保存 ${summary.markCount} 条标记、${summary.groupCount} 个分组。`
          )
          : `未启用，当前已保存 ${summary.markCount} 条标记、${summary.groupCount} 个分组。`
      )
      .addToggle((toggle) => {
        toggle
          .setValue(summary.fileMarkerEnabled)
          .onChange(async (value) => {
            await this.plugin.updateFileMarkerEnabled(value);
            new obsidian.Notice(value ? '已启用文件标记面板' : '已关闭文件标记面板');
            await this.display();
          });
      })
      .addButton((button) => {
        button
          .setButtonText('管理')
          .onClick(() => {
            this.openSubSettingsModal(new FileMarkerManagementModal(this.app, this.plugin, async () => {
              await this.display();
            }), 'file-marker');
          });
      });
  }

  // 渲染关系图谱模块分区，仅保留状态概览、开关与弹窗入口。
  renderAnchorGraphSection(containerEl, summary) {
    const runtimeStateLabelMap = {
      active: '运行中',
      degraded: '已降级',
      disabled: '已关闭',
      idle: '待初始化'
    };

    this.createEntrySetting(containerEl, 'anchor-graph')
      .setName('关系图谱 HTML 链接增强')
      .setDesc(
        `${runtimeStateLabelMap[summary.anchorGraphRuntimeState] || '未知'}，已识别 ${summary.anchorGraphSourceFileCount} 个源文件中的 ${summary.anchorGraphEdgeCount} 条关系边。`
      )
      .addToggle((toggle) => {
        toggle
          .setValue(summary.anchorGraphEnabled)
          .onChange(async (value) => {
            await this.plugin.updateAnchorGraphEnabled(value);
            new obsidian.Notice(value ? '已启用关系图谱 HTML 链接增强' : '已关闭关系图谱 HTML 链接增强');
            await this.display();
          });
      })
      .addButton((button) => {
        button
          .setButtonText('管理')
          .onClick(() => {
            this.openSubSettingsModal(new AnchorGraphManagementModal(this.app, this.plugin, async () => {
              await this.display();
            }), 'anchor-graph');
          });
      });
  }

  // 渲染右键菜单自定义模块分区，仅保留状态概览、开关与弹窗入口。
  renderMenuCustomizerSection(containerEl, summary) {
    this.createEntrySetting(containerEl, 'menu-customizer')
      .setName('右键菜单自定义')
      .setDesc(
        summary.menuCustomizerEnabled
          ? `已启用，当前共有 ${summary.menuCustomizerMenuCount} 个菜单类型开启自定义，配置了 ${summary.menuCustomizerGroupCount} 个分组。`
          : `未启用，已保存 ${summary.menuCustomizerGroupCount} 个分组配置，启用后会在菜单显示前重构右键菜单。`
      )
      .addToggle((toggle) => {
        toggle
          .setValue(summary.menuCustomizerEnabled)
          .onChange(async (value) => {
            await this.plugin.updateMenuCustomizerEnabled(value);
            new obsidian.Notice(value ? '已启用右键菜单自定义' : '已关闭右键菜单自定义');
            await this.display();
          });
      })
      .addButton((button) => {
        button
          .setButtonText('管理')
          .onClick(() => {
            this.openSubSettingsModal(new MenuCustomizerManagementModal(this.app, this.plugin, async () => {
              await this.display();
            }), 'menu-customizer');
          });
      });
  }

  // 渲染编辑增强模块分区，仅保留状态概览、开关与弹窗入口。
  renderEditorEnhancerSection(containerEl, summary) {
    this.createEntrySetting(containerEl, 'editor-enhancer')
      .setName('⛔编辑增强')
      .setDesc(
        summary.editorEnhancerEnabled
          ? (
            `已启用，自动补全${summary.editorEnhancerAutoCompleteEnabled ? '已开启' : '已关闭'}，`
            + `粘贴行为自动补全${summary.editorEnhancerPasteAutoCloseEnabled ? '已开启' : '已关闭'}。`
          )
          : '未启用。启用后输入 HTML 标签可自动补全闭合标签，并提供标签跳过、匹配标签跳转与同步修改配对标签等命令。'
      )
      .addToggle((toggle) => {
        toggle
          .setValue(summary.editorEnhancerEnabled)
          .onChange(async (value) => {
            await this.plugin.updateEditorEnhancerEnabled(value);
            new obsidian.Notice(value ? '已启用编辑增强模块' : '已关闭编辑增强模块');
            await this.display();
          });
      })
      .addButton((button) => {
        button
          .setButtonText('管理')
          .onClick(() => {
            this.openSubSettingsModal(new EditorEnhancerManagementModal(this.app, this.plugin, async () => {
              await this.display();
            }), 'editor-enhancer');
          });
      });
  }

  // 渲染命令&URI增强模块分区，仅保留状态概览、开关与弹窗入口。
  renderCommandUriEnhancerSection(containerEl, summary) {
    this.createEntrySetting(containerEl, 'command-uri')
      .setName('命令&URI增强')
      .setDesc(
        summary.commandUriEnhancerEnabled
          ? (
            summary.commandUriEnhancerTrailingSlashEnabled
              ? '已启用，文件夹路径复制时会自动在末尾追加 /。模块只注册命令，不会直接向右键菜单添加入口。'
              : '已启用，当前不会为文件夹路径自动补 /。模块只注册命令，不会直接向右键菜单添加入口。'
          )
          : '未启用。启用后会注册中文命令，并可被“右键菜单自定义”模块自动探测并手动加入菜单。'
      )
      .addToggle((toggle) => {
        toggle
          .setValue(summary.commandUriEnhancerEnabled)
          .onChange(async (value) => {
            await this.plugin.updateCommandUriEnhancerEnabled(value);
            new obsidian.Notice(value ? '已启用命令&URI增强模块' : '已关闭命令&URI增强模块');
            await this.display();
          });
      })
      .addButton((button) => {
        button
          .setButtonText('管理')
          .onClick(() => {
            this.openSubSettingsModal(new CommandUriEnhancerManagementModal(this.app, this.plugin, async () => {
              await this.display();
            }), 'command-uri');
          });
      });
  }

  // 渲染状态栏增强模块分区，仅保留状态概览、开关与弹窗入口。
  renderStatusBarEnhancerSection(containerEl, summary) {
    this.createEntrySetting(containerEl, 'status-bar')
      .setName('状态栏增强')
      .setDesc(
        summary.statusBarEnhancerEnabled
          ? (
            `已启用，当前${summary.statusBarEnhancerShowFileName ? '显示文件名' : '不显示文件名'}、`
            + `${summary.statusBarEnhancerShowIcons ? '显示图标' : '不显示图标'}，`
            + `点击状态栏时复制${summary.statusBarEnhancerCopyAbsolutePath ? '绝对路径' : '库内相对路径'}。`
            + `状态栏元素管理已记录 ${summary.statusBarEnhancerOrganizerElementCount} 个元素。`
          )
          : '未启用。启用后会在状态栏显示当前活动文件路径，并支持点击状态栏路径直接复制。'
      )
      .addToggle((toggle) => {
        toggle
          .setValue(summary.statusBarEnhancerEnabled)
          .onChange(async (value) => {
            await this.plugin.updateStatusBarEnhancerEnabled(value);
            new obsidian.Notice(value ? '已启用状态栏增强模块' : '已关闭状态栏增强模块');
            await this.display();
          });
      })
      .addButton((button) => {
        button
          .setButtonText('管理')
          .onClick(() => {
            this.openSubSettingsModal(new StatusBarEnhancerManagementModal(this.app, this.plugin, async () => {
              await this.display();
            }), 'status-bar');
          });
      });
  }

  // 渲染标签栏增强模块分区，仅保留状态概览、开关与弹窗入口。
  renderTabBarEnhancerSection(containerEl, summary) {
    this.createEntrySetting(containerEl, 'tab-bar')
      .setName('标签栏增强')
      .setDesc(
        summary.tabBarEnhancerEnabled
          ? (
            `已启用，空白区滚轮切换${summary.tabBarEnhancerTopBarWheel ? '已开启' : '已关闭'}，`
            + `跳过 CSS 隐藏标签${summary.tabBarEnhancerSkipCssHiddenTabs ? '已开启' : '已关闭'}，`
            + `跳过未加载插件标签${summary.tabBarEnhancerSkipUnloadedPluginTabs ? '已开启' : '已关闭'}。`
          )
          : '未启用。启用后可在标签头上滚动鼠标滚轮切换标签，仅桌面端可用。'
      )
      .addToggle((toggle) => {
        toggle
          .setValue(summary.tabBarEnhancerEnabled)
          .onChange(async (value) => {
            await this.plugin.updateTabBarEnhancerEnabled(value);
            new obsidian.Notice(value ? '已启用标签栏增强模块' : '已关闭标签栏增强模块');
            await this.display();
          });
      })
      .addButton((button) => {
        button
          .setButtonText('管理')
          .onClick(() => {
            this.openSubSettingsModal(new TabBarEnhancerManagementModal(this.app, this.plugin, async () => {
              await this.display();
            }), 'tab-bar');
          });
      });
  }

  // 渲染配置管理入口，仅保留总览描述与弹窗入口。
  renderConfigManagementEntry(containerEl) {
    this.createEntrySetting(containerEl, 'config')
      .setName('配置文件管理')
      .setDesc('查看配置文件状态、导出到独立文件、导入 JSON 以及重置全部配置。')
      .addButton((button) => {
        button
          .setButtonText('打开管理窗口')
          .onClick(() => {
            this.openSubSettingsModal(new ConfigManagementModal(this.app, this.plugin, async () => {
              await this.display();
            }), 'config');
          });
      });
  }

  // 渲染识别规则说明，帮助用户理解当前模块的生效范围。
  renderRuleSection(containerEl) {
    const hintEl = containerEl.createDiv({ cls: 'nene-settings-hint' });
    hintEl.createDiv({ cls: 'nene-settings-hint-title', text: '说明' });
    const listEl = hintEl.createEl('ul');

    listEl.createEl('li', {
      text: '关系图谱会额外识别 class 包含 internal-link，且带有 data-href 或 href 的 HTML a 标签。'
    });
    listEl.createEl('li', {
      text: '右键菜单自定义基于 Obsidian v1.4.16 的菜单结构设计，启用后会保留原始命令回调，但会重新组织 DOM 顺序。'
    });
    listEl.createEl('li', {
      text: '命令&URI增强模块默认不直接向右键菜单注入入口，只注册命令；如需显示在右键菜单中，可通过“右键菜单自定义”手动添加。'
    });
    listEl.createEl('li', {
      text: '状态栏增强模块主要面向桌面端；移动端通常不显示状态栏，因此只会保留配置，不会实际显示路径。'
    });
    listEl.createEl('li', {
      text: '标签栏增强模块仅面向桌面端，依赖若干未文档化的内部接口实现滚轮切换标签，后续 Obsidian 版本存在失效风险。'
    });
    listEl.createEl('li', {
      text: '文件列表增强模块仅面向桌面端，通过路径规则对文件资源管理器中的文件/文件夹进行置顶与隐藏。右键菜单命令可配合"右键菜单自定义"模块手动配置。'
    });
    listEl.createEl('li', {
      text: '编辑增强模块在输入完开始标签的 > 后弹出闭合标签补全，按 Tab 完成补全、Esc 退出，不占用上下左右方向键；单标签（如 <br>、<img>）不触发自动补全。'
    });
  }

  // 渲染核心插件增强分区，包含文件列表子模块（二级窗口管理置顶/隐藏选择器）。
  renderCorePluginEnhancerSection(containerEl, summary) {
    var plugin = this.plugin;
    var self = this;

    // --- 核心插件增强分组标题 ---
    containerEl.createDiv({ cls: 'nene-settings-group-title', text: '核心插件增强' });

    // --- 文件列表主开关 + 管理按钮 ---
    self.createEntrySetting(containerEl, 'file-explorer')
      .setName('✅文件列表')
      .setDesc(
        summary.fileExplorerEnhancerEnabled
          ? '已启用。可通过路径规则对文件资源管理器中的文件/文件夹进行置顶与隐藏管理。'
          : '未启用。启用后可对文件资源管理器中的文件/文件夹进行置顶与隐藏。'
      )
      .addToggle(function (toggle) {
        toggle
          .setValue(summary.fileExplorerEnhancerEnabled)
          .onChange(async function (value) {
            await plugin.updateFileExplorerEnhancerEnabled(value);
            new obsidian.Notice(value ? '已启用文件列表增强模块' : '已关闭文件列表增强模块');
            await self.display();
          }.bind({ plugin: plugin }));
      })
      .addButton(function (button) {
        button
          .setButtonText('管理')
          .setDisabled(!summary.fileExplorerEnhancerEnabled)
          .onClick(function () {
            self.openSubSettingsModal(new fileExplorerEnhancerModule.FileExplorerManagerModal(plugin), 'file-explorer');
          });
      });
  }

  // 渲染主题增强模块设置项，作为功能模块分组的普通成员（与其它模块平级）。
  renderThemeEnhancerSection(containerEl, summary) {
    this.createEntrySetting(containerEl, 'theme-enhancer')
      .setName('✅主题增强')
      .setDesc(
        summary.themeEnhancerEnabled
          ? '已启用。可修改Obsidian主题相关的配置。'
          : '未启用。启用后可可修改Obsidian主题相关的配置。'
      )
      .addToggle((toggle) => {
        toggle
          .setValue(summary.themeEnhancerEnabled)
          .onChange(async (value) => {
            await this.plugin.updateThemeEnhancerEnabled(value);
            new obsidian.Notice(value ? '已启用主题增强模块' : '已关闭主题增强模块，已回退至浅色');
            await this.display();
          });
      })
      .addButton((button) => {
        button
          .setButtonText('管理')
          .setDisabled(!summary.themeEnhancerEnabled)
          .onClick(() => {
            this.openSubSettingsModal(new themeEnhancerModule.ThemeEnhancerManagementModal(this.app, this.plugin, async () => {
              await this.display();
            }), 'theme-enhancer');
          });
      });
  }
}

module.exports = {
  ObsidianNenePluginSettingTab,
  reopenSettingsSubinterface
};
