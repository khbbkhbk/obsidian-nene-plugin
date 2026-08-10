'use strict';

var obsidian = require('obsidian');

// 当前子窗口管理的功能模块标识与显示名称。
const FEATURE_KEY = 'themeEnhancer';
const FEATURE_DISPLAY_NAME = '主题增强模块';

// 复制文本到剪贴板，优先使用异步 Clipboard API，失败时回退到隐藏 textarea。
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

  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(textareaEl);
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

// 定义确认弹窗，用于重置类操作的二次确认。
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

// 定义模块配置导出弹窗，提供复制到剪贴板与保存到文件两种方式。
class FeatureExportModal extends obsidian.Modal {
  constructor(app, exportText, onSaveToFile) {
    super(app);
    this.exportText = exportText; // 保存已生成的导出文本，供复制与展示复用
    this.onSaveToFile = onSaveToFile; // 保存写文件回调，导出到独立备份文件
  }

  // 打开弹窗时渲染只读文本与操作按钮。
  onOpen() {
    const { contentEl } = this;
    this.modalEl.addClass('mod-sidebar-layout', 'nene-settings-panel-modal');
    contentEl.empty();
    contentEl.addClass('nene-settings-modal');

    renderModalHeader(
      contentEl,
      '导出模块配置',
      '包含当前模块的完整配置，可直接复制保存，或导出为独立备份文件用于后续导入恢复。'
    );

    const textareaEl = contentEl.createEl('textarea', {
      cls: 'nene-settings-json-textarea'
    });
    textareaEl.value = this.exportText;
    textareaEl.readOnly = true;

    const actionEl = contentEl.createDiv({ cls: 'nene-settings-modal-actions' });
    const copyButtonEl = actionEl.createEl('button', {
      cls: 'mod-cta',
      text: '复制内容'
    });
    const saveButtonEl = actionEl.createEl('button', {
      text: '保存到文件'
    });
    const closeButtonEl = actionEl.createEl('button', {
      text: '关闭'
    });

    copyButtonEl.addEventListener('click', async () => {
      try {
        await copyTextToClipboard(this.exportText);
        new obsidian.Notice('配置内容已复制到剪贴板');
      } catch (error) {
        console.error('复制导出配置失败', error);
        new obsidian.Notice('复制失败，请手动全选文本后复制');
      }
    });

    saveButtonEl.addEventListener('click', async () => {
      if (!this.onSaveToFile) {
        new obsidian.Notice('当前环境不支持保存到文件');
        return;
      }

      saveButtonEl.disabled = true;

      try {
        const result = await this.onSaveToFile();
        new obsidian.Notice(`已保存：${result.fileName}`);
      } catch (error) {
        console.error('保存导出配置失败', error);
        new obsidian.Notice(`保存失败：${error.message || '请检查目录权限'}`);
      } finally {
        saveButtonEl.disabled = false;
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

// 定义模块配置导入弹窗，允许粘贴 JSON 文本并确认覆盖后恢复配置。
class FeatureImportModal extends obsidian.Modal {
  constructor(app, onSubmit) {
    super(app);
    this.onSubmit = onSubmit; // 保存提交回调，供管理弹窗导入成功后刷新界面
  }

  // 打开弹窗时渲染输入框与确认按钮。
  onOpen() {
    const { contentEl } = this;
    this.modalEl.addClass('mod-sidebar-layout', 'nene-settings-panel-modal');
    contentEl.empty();
    contentEl.addClass('nene-settings-modal');

    renderModalHeader(
      contentEl,
      '导入模块配置',
      '请粘贴此前导出的 JSON 文本。导入后会立即覆盖当前模块配置，请确认内容来源可信。'
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
        await this.onSubmit(rawText);
        new obsidian.Notice('模块配置已导入');
        this.close();
      } catch (error) {
        console.error('导入模块配置失败', error);
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

// 定义主题增强模块管理弹窗，集中放置护眼模式等子功能设置项与维护操作。
class ThemeEnhancerManagementModal extends obsidian.Modal {
  constructor(app, plugin, onSettingsChanged) {
    super(app);
    this.plugin = plugin;
    this.onSettingsChanged = onSettingsChanged; // 保存回调，便于修改设置后刷新主设置页
  }

  // 打开弹窗时渲染管理界面。
  onOpen() {
    this.modalEl.addClass('mod-sidebar-layout', 'nene-settings-panel-modal');
    this.contentEl.empty();
    this.contentEl.addClass('nene-settings-modal');
    void this.render();
  }

  // 根据当前最新状态渲染主题增强模块管理界面。
  async render() {
    const { contentEl } = this;
    const summary = this.plugin.getSettingsSummary();

    contentEl.empty();
    renderModalHeader(
      contentEl,
      FEATURE_DISPLAY_NAME + '管理',
      '集中管理主题增强模块的子功能，主设置页只保留模块开关与入口。'
    );

    // 功能配置区：护眼模式开关。
    new obsidian.Setting(contentEl)
      .setName('护眼模式')
      .setDesc(
        summary.themeEnhancerEyeProtection
          ? '以豆沙绿配色覆盖所有界面，可在"设置 → 外观 → 基础颜色"下拉框中切换回其它主题。'
          : '开启后会在"设置 → 外观 → 基础颜色"下拉框追加"护眼模式"选项，以豆沙绿配色保护眼睛。'
      )
      .addToggle((toggle) => {
        toggle
          .setValue(summary.themeEnhancerEyeProtection)
          .onChange(async (value) => {
            await this.plugin.updateThemeEnhancerEyeProtection(value);
            new obsidian.Notice(value ? '护眼模式已开启' : '护眼模式已关闭');
            await this.onSettingsChanged();
            await this.render();
          });
      });

    // 底部维护操作栏：导出、导入、重置。
    const footerEl = contentEl.createDiv({ cls: 'nene-theme-enhancer-footer' });

    const exportButtonEl = footerEl.createEl('button', {
      cls: 'mod-cta',
      text: '导出'
    });
    const importButtonEl = footerEl.createEl('button', {
      text: '导入'
    });
    const resetButtonEl = footerEl.createEl('button', {
      cls: 'mod-warning',
      text: '重置'
    });

    exportButtonEl.addEventListener('click', () => {
      const exportText = this.plugin.exportFeatureData(FEATURE_KEY);
      new FeatureExportModal(this.app, exportText, () => this.plugin.exportFeatureDataToFile(FEATURE_KEY)).open();
    });

    importButtonEl.addEventListener('click', () => {
      new FeatureImportModal(this.app, async (rawText) => {
        await this.plugin.importFeatureData(FEATURE_KEY, rawText);
        await this.onSettingsChanged();
        await this.render();
      }).open();
    });

    resetButtonEl.addEventListener('click', () => {
      new ConfirmActionModal(
        this.app,
        '重置模块配置',
        '此操作会将护眼模式开关恢复为默认值，当前设置将被覆盖。',
        '确认重置',
        async () => {
          await this.plugin.resetFeatureConfiguration(FEATURE_KEY);
          new obsidian.Notice('主题增强配置已重置');
          await this.onSettingsChanged();
          await this.render();
        }
      ).open();
    });
  }

  // 关闭弹窗时清理内容，避免重复挂载旧节点。
  onClose() {
    this.contentEl.empty();
  }
}

module.exports = {
  ThemeEnhancerManagementModal
};
