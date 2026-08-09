'use strict';

var obsidian = require('obsidian');

/**
 * 编辑增强模块设置弹窗。
 *
 * 布局与可设置项对齐 Auto Close Tags 插件（1.1.2）原设置面板：
 *  - 排除标签列表（输入自动转小写，匹配大小写敏感）
 *  - 自动补全后光标位置（标签中间 / 闭合标签之后）
 *  - 忽略代码块
 *  - 忽略行内代码
 *  - 粘贴行为的自动补全（默认关闭）
 * 全部文案均已汉化。
 */

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

// 定义编辑增强模块管理弹窗，5 个设置项纵向排列。
class EditorEnhancerManagementModal extends obsidian.Modal {
  constructor(app, plugin, onSettingsChanged) {
    super(app);
    this.plugin = plugin;
    this.onSettingsChanged = onSettingsChanged; // 保存回调，便于修改设置后刷新主设置页
  }

  // 打开弹窗时渲染全部设置项。
  onOpen() {
    this.modalEl.addClass('mod-sidebar-layout', 'nene-settings-panel-modal');
    this.contentEl.empty();
    this.contentEl.addClass('nene-settings-modal');
    void this.render();
  }

  // 根据当前最新配置渲染模块管理界面。
  async render() {
    const { contentEl } = this;
    const settings = this.plugin.editorEnhancerStore.getSettings();

    contentEl.empty();
    renderModalHeader(
      contentEl,
      '编辑增强模块',
      '自动补全 HTML 标签，并提供向左/向右跳过当前标签、跳转至匹配标签与同步更新匹配标签等命令。以下设置项与 Auto Close Tags 插件保持一致。'
    );

    new obsidian.Setting(contentEl)
      .setName('排除标签')
      .setDesc('排除标签列表（英文逗号分隔），输入时自动转为小写，匹配时大小写敏感。')
      .addText((text) => {
        text
          .setPlaceholder('eg: div, span, i')
          .setValue(settings.excludedTags)
          .onChange(async (value) => {
            await this.plugin.updateEditorEnhancerExcludedTags(value);
            await this.onSettingsChanged();
            // 注意：此处不能调用 this.render()。
            // render() 会清空并重建整个设置弹窗，导致输入框 DOM 被销毁、
            // 每输入一个字符即丢失焦点。文本输入框需连续输入，仅更新数据即可，
            // 界面显示的用户输入原值无需回填。
          });
      });

    new obsidian.Setting(contentEl)
      .setName('光标位置')
      .setDesc('自动补全结束标签后，光标停留的位置。')
      .addDropdown((dropdown) => {
        dropdown
          .addOption('between', '标签中间')
          .addOption('after', '结束标签之后')
          .setValue(settings.cursorPosition)
          .onChange(async (value) => {
            await this.plugin.updateEditorEnhancerCursorPosition(value);
            await this.onSettingsChanged();
            await this.render();
          });
      });

    new obsidian.Setting(contentEl)
      .setName('忽略代码块')
      .setDesc('不对代码块（``````）内部的标签进行自动补全。')
      .addToggle((toggle) => {
        toggle
          .setValue(settings.ignoreInCodeBlocks)
          .onChange(async (value) => {
            await this.plugin.updateEditorEnhancerIgnoreInCodeBlocks(value);
            await this.onSettingsChanged();
            await this.render();
          });
      });

    new obsidian.Setting(contentEl)
      .setName('忽略行内代码')
      .setDesc('不对行内代码（``）内部的标签进行自动补全。')
      .addToggle((toggle) => {
        toggle
          .setValue(settings.ignoreInlineCode)
          .onChange(async (value) => {
            await this.plugin.updateEditorEnhancerIgnoreInlineCode(value);
            await this.onSettingsChanged();
            await this.render();
          });
      });

    new obsidian.Setting(contentEl)
      .setName('粘贴行为的自动补全')
      .setDesc('开启后，粘贴 HTML 标签后将自动弹出结束标签补全提示。')
      .addToggle((toggle) => {
        toggle
          .setValue(settings.enablePasteAutoClose)
          .onChange(async (value) => {
            await this.plugin.updateEditorEnhancerEnablePasteAutoClose(value);
            await this.onSettingsChanged();
            await this.render();
          });
      });
  }

  // 关闭弹窗时清理内容，避免重复挂载旧节点。
  onClose() {
    this.contentEl.empty();
  }
}

module.exports = {
  EditorEnhancerManagementModal
};
