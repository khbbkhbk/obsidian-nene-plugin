'use strict';

var obsidian = require('obsidian');
var organizerView = require('./organizer-view');

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

// 渲染信息行，用于展示模块当前状态与配置文件路径。
function renderDetailItem(containerEl, label, value, codeStyle) {
  const itemEl = containerEl.createDiv({ cls: 'nene-settings-detail-item' });
  itemEl.createDiv({ cls: 'nene-settings-detail-label', text: label });
  itemEl.createEl(codeStyle ? 'code' : 'div', {
    cls: 'nene-settings-detail-value',
    text: value
  });
}

// 对文本输入的保存操作做防抖，避免每次按键都触发一次配置文件写入。
function debounceSave(saveTask, delay) {
  let timerId = null;
  return (...args) => {
    window.clearTimeout(timerId);
    timerId = window.setTimeout(() => {
      void saveTask(...args);
    }, delay);
  };
}

// 定义状态栏增强模块管理弹窗，集中放置状态栏显示与复制行为配置。
class StatusBarEnhancerManagementModal extends obsidian.Modal {
  constructor(app, plugin, onSettingsChanged) {
    super(app);
    this.plugin = plugin;
    this.onSettingsChanged = onSettingsChanged; // 保存回调，便于修改设置后刷新主设置页
  }

  // 打开弹窗时渲染状态栏增强模块详情与配置项。
  onOpen() {
    this.modalEl.addClass('mod-sidebar-layout', 'nene-settings-panel-modal');
    this.contentEl.empty();
    this.contentEl.addClass('nene-settings-modal');
    void this.render();
  }

  // 根据当前最新状态渲染状态栏增强模块管理界面。
  async render() {
    const { contentEl } = this;
    const summary = this.plugin.getSettingsSummary();
    const configSummary = await this.plugin.getConfigManagementSummary();

    contentEl.empty();
    renderModalHeader(
      contentEl,
      '状态栏增强模块',
      '该模块会在状态栏显示当前活动文件的路径。点击状态栏路径可直接复制；移动端通常不显示状态栏，因此主要用于桌面端。'
    );

    const detailListEl = contentEl.createDiv({ cls: 'nene-settings-detail-list' });
    renderDetailItem(detailListEl, '当前状态', summary.statusBarEnhancerEnabled ? '已启用' : '已关闭');
    renderDetailItem(detailListEl, '显示文件名', summary.statusBarEnhancerShowFileName ? '已开启' : '已关闭');
    renderDetailItem(detailListEl, '显示图标', summary.statusBarEnhancerShowIcons ? '已开启' : '已关闭');
    renderDetailItem(detailListEl, '点击复制绝对路径', summary.statusBarEnhancerCopyAbsolutePath ? '已开启' : '已关闭');
    renderDetailItem(detailListEl, '显示最后修改时间', summary.statusBarEnhancerLastModifiedEnabled ? '已开启' : '已关闭');
    renderDetailItem(detailListEl, '显示创建时间', summary.statusBarEnhancerCreatedEnabled ? '已开启' : '已关闭');
    renderDetailItem(detailListEl, '点击循环显示', summary.statusBarEnhancerCycleOnClick ? '已开启' : '已关闭');
    renderDetailItem(detailListEl, '配置文件', configSummary.statusBarEnhancer.path, true);

    new obsidian.Setting(contentEl)
      .setName('显示文件名')
      .setDesc('在状态栏路径中显示当前文件名。考虑到状态栏长度，建议关闭')
      .addToggle((toggle) => {
        toggle
          .setValue(summary.statusBarEnhancerShowFileName)
          .onChange(async (value) => {
            await this.plugin.updateStatusBarEnhancerShowFileName(value);
            new obsidian.Notice(value ? '已开启状态栏文件名显示' : '已关闭状态栏文件名显示');
            await this.onSettingsChanged();
            await this.render();
          });
      });

    new obsidian.Setting(contentEl)
      .setName('显示图标')
      .setDesc('在状态栏路径中显示文件夹与文件图标。考虑到状态栏长度，建议关闭')
      .addToggle((toggle) => {
        toggle
          .setValue(summary.statusBarEnhancerShowIcons)
          .onChange(async (value) => {
            await this.plugin.updateStatusBarEnhancerShowIcons(value);
            new obsidian.Notice(value ? '已开启状态栏图标显示' : '已关闭状态栏图标显示');
            await this.onSettingsChanged();
            await this.render();
          });
      });

    new obsidian.Setting(contentEl)
      .setName('复制绝对路径')
      .setDesc('切换点击状态栏时所复制的路径类型为绝对路径，默认启用')
      .addToggle((toggle) => {
        toggle
          .setValue(summary.statusBarEnhancerCopyAbsolutePath)
          .onChange(async (value) => {
            await this.plugin.updateStatusBarEnhancerCopyAbsolutePath(value);
            new obsidian.Notice(value ? '状态栏点击复制已改为绝对路径' : '状态栏点击复制已改为库内相对路径');
            await this.onSettingsChanged();
            await this.render();
          });
      });

    new obsidian.Setting(contentEl)
      .setName('最后修改时间')
      .setHeading();

    new obsidian.Setting(contentEl)
      .setName('显示最后修改时间')
      .setDesc('在状态栏显示当前活动文件的最后修改时间。')
      .addToggle((toggle) => {
        toggle
          .setValue(summary.statusBarEnhancerLastModifiedEnabled)
          .onChange(async (value) => {
            await this.plugin.updateStatusBarEnhancerLastModifiedEnabled(value);
            new obsidian.Notice(value ? '已开启最后修改时间显示' : '已关闭最后修改时间显示');
            await this.onSettingsChanged();
            await this.render();
          });
      });

    new obsidian.Setting(contentEl)
      .setName('最后修改时间前缀')
      .setDesc('显示在最后修改时间之前的文本。')
      .addText((text) => {
        const debouncedSave = debounceSave(async (value) => {
          await this.plugin.updateStatusBarEnhancerLastModifiedPrepend(value);
          await this.onSettingsChanged();
        }, 500);
        text
          .setPlaceholder('🖋️')
          .setValue(summary.statusBarEnhancerLastModifiedPrepend)
          .onChange(debouncedSave);
      });

    new obsidian.Setting(contentEl)
      .setName('最后修改时间格式')
      .setDesc('兼容 Moment.js 格式，例如 YYYY-MM-DD HH:mm:ss。')
      .addText((text) => {
        const debouncedSave = debounceSave(async (value) => {
          await this.plugin.updateStatusBarEnhancerLastModifiedTimestampFormat(value);
          await this.onSettingsChanged();
        }, 500);
        text
          .setPlaceholder(' HH:mm:ss')
          .setValue(summary.statusBarEnhancerLastModifiedTimestampFormat)
          .onChange(debouncedSave);
      });

    new obsidian.Setting(contentEl)
      .setName('创建时间')
      .setHeading();

    new obsidian.Setting(contentEl)
      .setName('显示创建时间')
      .setDesc('在状态栏显示当前活动文件的创建时间。')
      .addToggle((toggle) => {
        toggle
          .setValue(summary.statusBarEnhancerCreatedEnabled)
          .onChange(async (value) => {
            await this.plugin.updateStatusBarEnhancerCreatedEnabled(value);
            new obsidian.Notice(value ? '已开启创建时间显示' : '已关闭创建时间显示');
            await this.onSettingsChanged();
            await this.render();
          });
      });

    new obsidian.Setting(contentEl)
      .setName('创建时间前缀')
      .setDesc('显示在创建时间之前的文本。')
      .addText((text) => {
        const debouncedSave = debounceSave(async (value) => {
          await this.plugin.updateStatusBarEnhancerCreatedPrepend(value);
          await this.onSettingsChanged();
        }, 500);
        text
          .setPlaceholder('📘')
          .setValue(summary.statusBarEnhancerCreatedPrepend)
          .onChange(debouncedSave);
      });

    new obsidian.Setting(contentEl)
      .setName('创建时间格式')
      .setDesc('兼容 Moment.js 格式，例如 YYYY-MM-DD HH:mm:ss。')
      .addText((text) => {
        const debouncedSave = debounceSave(async (value) => {
          await this.plugin.updateStatusBarEnhancerCreatedTimestampFormat(value);
          await this.onSettingsChanged();
        }, 500);
        text
          .setPlaceholder('YYYY-MM-DD')
          .setValue(summary.statusBarEnhancerCreatedTimestampFormat)
          .onChange(debouncedSave);
      });

    new obsidian.Setting(contentEl)
      .setName('交互')
      .setHeading();

    new obsidian.Setting(contentEl)
      .setName('点击循环显示')
      .setDesc('点击状态栏时间项时，在「仅最后修改时间 → 仅创建时间 → 两者都显示」之间循环，循环结果会保存为当前配置。')
      .addToggle((toggle) => {
        toggle
          .setValue(summary.statusBarEnhancerCycleOnClick)
          .onChange(async (value) => {
            await this.plugin.updateStatusBarEnhancerCycleOnClickEnabled(value);
            new obsidian.Notice(value ? '已开启点击循环显示' : '已关闭点击循环显示');
            await this.onSettingsChanged();
            await this.render();
          });
      });

    /* ---------- 状态栏元素管理入口 ---------- */

    new obsidian.Setting(contentEl)
      .setName('状态栏元素管理')
      .setHeading();

    new obsidian.Setting(contentEl)
      .setName('排序与可见性')
      .setDesc('管理状态栏各元素的位置和显示/隐藏状态，支持拖拽排序。')
      .addButton((button) => {
        button
          .setButtonText('打开元素管理')
          .onClick(() => {
            var modal = new organizerView.StatusBarOrganizerModal(this.app, this.plugin, async () => {
              await this.render();
            });
            modal.open();
          });
      });

    /* ---------- Snippets 管理 ---------- */

    new obsidian.Setting(contentEl)
      .setName('Snippets 管理')
      .setHeading();

    const snippetsSettings = this.plugin.snippetsStore.getSettings();

    new obsidian.Setting(contentEl)
      .setName('玻璃菜单效果')
      .setDesc('将菜单的背景由主题的次要背景色--background-secondary更改为玻璃背景，建议关闭')
      .addToggle((toggle) => {
        toggle
          .setValue(snippetsSettings.aestheticStyle)
          .onChange(async (value) => {
            await this.plugin.snippetsStore.setAestheticStyle(value);
            new obsidian.Notice(value ? '已开启毛玻璃菜单效果' : '已关闭毛玻璃菜单效果');
            await this.onSettingsChanged();
            await this.render();
          });
      });

    new obsidian.Setting(contentEl)
      .setName('自动打开新建CSS片段')
      .setDesc('是否在新建CSS代码片段文件后立即以默认应用程序将其打开，建议启用')
      .addToggle((toggle) => {
        toggle
          .setValue(snippetsSettings.openSnippetFile)
          .onChange(async (value) => {
            await this.plugin.snippetsStore.setOpenSnippetFile(value);
            new obsidian.Notice(value ? '已开启自动打开新建CSS片段' : '已关闭自动打开新建CSS片段');
            await this.onSettingsChanged();
            await this.render();
          });
      });

    new obsidian.Setting(contentEl)
      .setName('设置新建CSS片段的状态')
      .setDesc('是否自动启用新建CSS代码片段，建议启用')
      .addToggle((toggle) => {
        toggle
          .setValue(snippetsSettings.snippetEnabledStatus)
          .onChange(async (value) => {
            await this.plugin.snippetsStore.setSnippetEnabledStatus(value);
            new obsidian.Notice(value ? '新建CSS片段将默认启用' : '新建CSS片段将默认关闭');
            await this.onSettingsChanged();
            await this.render();
          });
      });

    const templateSetting = new obsidian.Setting(contentEl);
    templateSetting.settingEl.setAttribute(
      'style',
      'display: grid; grid-template-columns: 1fr;'
    );
    templateSetting
      .setName('CSS片段模板')
      .setDesc('设置新建CSS代码片段的默认样式。');
    templateSetting.addTextArea((textarea) => {
      const debouncedSave = debounceSave(async (value) => {
        await this.plugin.snippetsStore.setStylingTemplate(value);
        await this.onSettingsChanged();
      }, 500);
      textarea.inputEl.setAttribute('style', 'margin-top: 12px; width: 100%; min-height: 32vh;');
      textarea.inputEl.addClass('nene-css-editor');
      textarea
        .setValue(snippetsSettings.stylingTemplate)
        .onChange(debouncedSave);
    });
  }

  // 关闭弹窗时清理内容，避免重复挂载旧节点。
  onClose() {
    this.contentEl.empty();
  }
}

module.exports = {
  StatusBarEnhancerManagementModal
};
