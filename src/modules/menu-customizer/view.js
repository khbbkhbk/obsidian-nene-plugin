'use strict';

var obsidian = require('obsidian');

// 渲染右键菜单模块弹窗的公共标题区。
function renderMenuCustomizerHeader(containerEl, title, description) {
  const headerEl = containerEl.createDiv({ cls: 'nene-settings-modal-header' });
  headerEl.createDiv({ cls: 'nene-settings-modal-title', text: title });

  if (description) {
    headerEl.createEl('p', {
      cls: 'nene-settings-modal-description',
      text: description
    });
  }
}

// 渲染摘要项，用于顶部状态卡片与预览信息区。
function renderSummaryItem(containerEl, label, value, codeStyle) {
  const itemEl = containerEl.createDiv({ cls: 'nene-settings-detail-item' });
  itemEl.createDiv({ cls: 'nene-settings-detail-label', text: label });
  itemEl.createEl(codeStyle ? 'code' : 'div', {
    cls: 'nene-settings-detail-value',
    text: value
  });
}

// 生成用于展示的菜单类型标题。
function getMenuTypeName(store, menuType) {
  return store.getMenuTypeOptions().find((item) => item.id === menuType)?.name || menuType;
}

// 定义模块级确认弹窗，避免重置配置时误触。
class MenuCustomizerConfirmModal extends obsidian.Modal {
  constructor(app, title, description, onConfirm) {
    super(app);
    this.title = title; // 保存标题，便于复用同一确认弹窗
    this.description = description; // 保存说明文本，帮助用户理解影响范围
    this.onConfirm = onConfirm; // 保存确认后的实际执行逻辑
  }

  // 打开弹窗时渲染说明与确认按钮。
  onOpen() {
    const { contentEl } = this;
    this.modalEl.addClass('mod-sidebar-layout', 'nene-settings-panel-modal');
    contentEl.empty();
    contentEl.addClass('nene-settings-modal');

    renderMenuCustomizerHeader(contentEl, this.title, this.description);

    const actionEl = contentEl.createDiv({ cls: 'nene-settings-modal-actions' });
    const cancelButtonEl = actionEl.createEl('button', { text: '取消' });
    const confirmButtonEl = actionEl.createEl('button', {
      cls: 'mod-warning',
      text: '确认'
    });

    cancelButtonEl.addEventListener('click', () => this.close());
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

  // 关闭弹窗时清空内容，避免重复挂载旧 DOM。
  onClose() {
    this.contentEl.empty();
  }
}

// 定义右键菜单模块管理弹窗，集中承载菜单类型、分组和命令覆盖配置。
class MenuCustomizerManagementModal extends obsidian.Modal {
  constructor(app, plugin, onSettingsChanged) {
    super(app);
    this.plugin = plugin;
    this.onSettingsChanged = onSettingsChanged; // 保存回调，便于操作完成后刷新主设置页
    this.activeMenuType = plugin.menuCustomizerStore.getMenuTypeOptions()[0]?.id || 'editor'; // 记录当前分页
    this.previewPaneEl = null; // 记录预览区容器，便于局部刷新
    this.summaryPaneEl = null; // 记录顶部摘要容器，便于局部刷新
  }

  // 打开弹窗时渲染最新配置。
  onOpen() {
    this.modalEl.addClass(
      'mod-sidebar-layout',
      'nene-settings-panel-modal',
      'nene-menu-customizer-panel-modal'
    );
    this.contentEl.empty();
    this.contentEl.addClass('nene-settings-modal', 'nene-menu-customizer-modal');
    void this.render();
  }

  // 根据当前状态重绘整个右键菜单管理界面。
  async render() {
    const { contentEl } = this;
    const store = this.plugin.menuCustomizerStore;
    const menuTypeOptions = store.getMenuTypeOptions();

    if (!menuTypeOptions.some((item) => item.id === this.activeMenuType)) {
      this.activeMenuType = menuTypeOptions[0]?.id || 'editor';
    }

    contentEl.empty();
    renderMenuCustomizerHeader(
      contentEl,
      '右键菜单自定义',
      ''
    );

    this.summaryPaneEl = contentEl.createDiv({ cls: 'nene-menu-customizer-summary' });
    await this.renderSummaryPanel();

    const shellEl = contentEl.createDiv({ cls: 'nene-menu-customizer-shell' });
    const settingsPaneEl = shellEl.createDiv({ cls: 'nene-menu-customizer-settings-pane' });
    this.previewPaneEl = shellEl.createDiv({ cls: 'nene-menu-customizer-preview-pane' });

    this.renderMenuTypeTabs(settingsPaneEl, menuTypeOptions);
    this.renderActiveMenuSettings(settingsPaneEl);
    this.renderPreviewPanel();
  }

  // 渲染顶部摘要，集中展示模块状态与配置文件路径。
  async renderSummaryPanel() {
    const summary = this.plugin.getSettingsSummary();
    const configSummary = await this.plugin.getConfigManagementSummary();

    if (!this.summaryPaneEl) {
      return;
    }

    this.summaryPaneEl.empty();

    const detailListEl = this.summaryPaneEl.createDiv({ cls: 'nene-settings-detail-list' });
    renderSummaryItem(detailListEl, '模块状态', summary.menuCustomizerEnabled ? '已启用' : '已关闭');
    renderSummaryItem(detailListEl, '已启用菜单', `${summary.menuCustomizerMenuCount} 个`);
    renderSummaryItem(detailListEl, '分组数量', `${summary.menuCustomizerGroupCount} 个`);
    renderSummaryItem(detailListEl, '配置文件', configSummary.menuCustomizer.path, true);

    const noteEl = this.summaryPaneEl.createDiv({ cls: 'nene-menu-customizer-note' });
    noteEl.createEl('strong', { text: '说明：' });
    noteEl.createSpan({
      text: '新增命令完全来自 Obsidian 命令注册表；无显式 commandId 的原始菜单项，请在下方“手动映射”中补齐 title、section 与 commandId。'
    });
  }

  // 渲染四个菜单类型的分页切换标签。
  renderMenuTypeTabs(containerEl, menuTypeOptions) {
    const tabsEl = containerEl.createDiv({ cls: 'nene-menu-customizer-tabs' });

    menuTypeOptions.forEach((menuType) => {
      const menuConfig = this.plugin.menuCustomizerStore.getMenuConfig(menuType.id);
      const tabButtonEl = tabsEl.createEl('button', {
        cls: `nene-menu-customizer-tab${menuType.id === this.activeMenuType ? ' is-active' : ''}`,
        text: menuType.name
      });

      if (menuConfig.enabled) {
        tabButtonEl.createSpan({
          cls: 'nene-menu-customizer-tab-badge',
          text: '启用中'
        });
      }

      tabButtonEl.addEventListener('click', () => {
        if (this.activeMenuType === menuType.id) {
          return;
        }

        this.activeMenuType = menuType.id;
        void this.render();
      });
    });
  }

  // 渲染当前选中菜单类型的设置区。
  renderActiveMenuSettings(containerEl) {
    const store = this.plugin.menuCustomizerStore;
    const menuType = this.activeMenuType;
    const menuConfig = store.getMenuConfig(menuType);
    const sectionEl = containerEl.createDiv({ cls: 'nene-menu-customizer-active-section' });

    const sectionHeaderEl = sectionEl.createDiv({ cls: 'nene-menu-customizer-panel-card' });
    sectionHeaderEl.createDiv({
      cls: 'nene-menu-customizer-section-title',
      text: getMenuTypeName(store, menuType)
    });

    this.renderControlRow(
      sectionHeaderEl,
      '启用当前菜单',
      `仅对 ${getMenuTypeName(store, menuType)} 生效，未开启时保留 Obsidian 原始行为。`,
      (controlsEl) => {
        const toggleEl = this.createSwitchControl(controlsEl, menuConfig.enabled, async (checked) => {
          await store.setMenuEnabled(menuType, checked);
          new obsidian.Notice(checked ? `已启用 ${getMenuTypeName(store, menuType)}` : `已关闭 ${getMenuTypeName(store, menuType)}`);
          await this.onSettingsChanged();
          await this.renderSummaryPanel();
          this.renderPreviewPanel();
        });

        toggleEl.classList.add('nene-menu-customizer-inline-switch');
      }
    );

    const groupsCardEl = sectionEl.createDiv({ cls: 'nene-menu-customizer-panel-card' });
    const groupsHeaderEl = groupsCardEl.createDiv({ cls: 'nene-menu-customizer-card-header' });
    groupsHeaderEl.createDiv({ cls: 'nene-menu-customizer-subtitle', text: '分组管理' });

    const addGroupButtonEl = groupsHeaderEl.createEl('button', {
      cls: 'mod-cta',
      text: '添加分组'
    });
    addGroupButtonEl.addEventListener('click', async () => {
      await store.addGroup(menuType);
      await this.onSettingsChanged();
      await this.renderSummaryPanel();
      await this.render();
    });

    if (menuConfig.groups.length === 0) {
      groupsCardEl.createDiv({
        cls: 'nene-menu-customizer-empty',
        text: '当前还没有分组，未命中的命令会按原顺序保留在菜单底部。'
      });
    }

    menuConfig.groups.forEach((group, groupIndex) => {
      this.renderGroupEditor(groupsCardEl, menuType, group, groupIndex, menuConfig.groups.length);
    });

    this.renderMappingsPanel(sectionEl, menuType, menuConfig);
    this.renderOverridesPanel(sectionEl, menuType, menuConfig);
    this.renderResetPanel(sectionEl);
  }

  // 渲染单个分组编辑器，使用现代折叠结构避免长列表过长。
  renderGroupEditor(containerEl, menuType, group, groupIndex, totalGroups) {
    const store = this.plugin.menuCustomizerStore;
    const groupDetailsEl = containerEl.createEl('details', {
      cls: 'nene-menu-customizer-group-card'
    });

    if (groupIndex === 0) {
      groupDetailsEl.open = true;
    }

    const summaryEl = groupDetailsEl.createEl('summary', {
      cls: 'nene-menu-customizer-group-summary'
    });
    summaryEl.createDiv({
      cls: 'nene-menu-customizer-group-summary-title',
      text: group.name || `分组 ${groupIndex + 1}`
    });

    const metaEl = summaryEl.createDiv({ cls: 'nene-menu-customizer-group-summary-meta' });
    metaEl.createSpan({
      cls: 'nene-menu-customizer-meta-pill',
      text: `${group.commands.length} 个命令`
    });
    metaEl.createSpan({
      cls: 'nene-menu-customizer-meta-pill',
      text: group.layout === 'icon-bar' ? '图标栏' : group.layout === 'grid' ? '网格' : '列表'
    });
    if (group.forceSubmenu) {
      metaEl.createSpan({
        cls: 'nene-menu-customizer-meta-pill',
        text: '强制子菜单'
      });
    }
    if (group.hidden) {
      metaEl.createSpan({
        cls: 'nene-menu-customizer-meta-pill is-muted',
        text: '已隐藏'
      });
    }

    const bodyEl = groupDetailsEl.createDiv({ cls: 'nene-menu-customizer-group-body' });

    this.renderControlRow(
      bodyEl,
      '基础信息',
      group.id,
      (controlsEl) => {
        this.createTextInput(controlsEl, '分组名称', group.name, async (value) => {
          await store.updateGroup(menuType, groupIndex, { name: value });
          this.renderPreviewPanel();
        });

        this.createTextInput(controlsEl, '图标（可选）', group.icon || '', async (value) => {
          await store.updateGroup(menuType, groupIndex, { icon: value });
          this.renderPreviewPanel();
        });

        const moveControlsEl = controlsEl.createDiv({ cls: 'nene-menu-customizer-inline-actions' });
        this.createIconButton(moveControlsEl, 'arrow-up', '上移分组', groupIndex === 0, async () => {
          await store.moveGroup(menuType, groupIndex, -1);
          await this.onSettingsChanged();
          await this.render();
        });
        this.createIconButton(moveControlsEl, 'arrow-down', '下移分组', groupIndex === totalGroups - 1, async () => {
          await store.moveGroup(menuType, groupIndex, 1);
          await this.onSettingsChanged();
          await this.render();
        });
        this.createIconButton(moveControlsEl, 'trash', '删除分组', false, async () => {
          await store.removeGroup(menuType, groupIndex);
          await this.onSettingsChanged();
          await this.renderSummaryPanel();
          await this.render();
        }, true);
      }
    );

    this.renderControlRow(
      bodyEl,
      '布局与行为',
      '列表布局中的多命令分组默认折叠为子菜单。',
      (controlsEl) => {
        this.createSelectInput(
          controlsEl,
          store.getLayoutOptions(),
          group.layout,
          async (value) => {
            await store.updateGroup(menuType, groupIndex, { layout: value });
            await this.onSettingsChanged();
            this.renderPreviewPanel();
          }
        );

        this.createSwitchControl(controlsEl, group.hidden === true, async (checked) => {
          await store.updateGroup(menuType, groupIndex, { hidden: checked });
          this.renderPreviewPanel();
        }, '隐藏分组');

        this.createSwitchControl(controlsEl, group.forceSubmenu === true, async (checked) => {
          await store.updateGroup(menuType, groupIndex, { forceSubmenu: checked });
          this.renderPreviewPanel();
        }, '强制子菜单');
      }
    );

    const commandsSectionEl = bodyEl.createDiv({ cls: 'nene-menu-customizer-command-list' });
    commandsSectionEl.createDiv({ cls: 'nene-menu-customizer-mini-title', text: '命令顺序' });

    if (group.commands.length === 0) {
      commandsSectionEl.createDiv({
        cls: 'nene-menu-customizer-empty',
        text: '当前分组还没有命令。'
      });
    }

    group.commands.forEach((commandId, commandIndex) => {
      const commandRowEl = commandsSectionEl.createDiv({ cls: 'nene-menu-customizer-command-row' });

      const contentEl = commandRowEl.createDiv({ cls: 'nene-menu-customizer-command-content' });
      contentEl.createDiv({
        cls: 'nene-menu-customizer-command-label',
        text: store.getCommandLabel(menuType, commandId)
      });
      contentEl.createEl('code', {
        cls: 'nene-menu-customizer-command-id',
        text: commandId
      });

      const actionEl = commandRowEl.createDiv({ cls: 'nene-menu-customizer-command-actions' });
      this.createIconButton(actionEl, 'arrow-up', '上移命令', commandIndex === 0, async () => {
        await store.moveCommandInGroup(menuType, groupIndex, commandIndex, -1);
        await this.onSettingsChanged();
        await this.render();
      });
      this.createIconButton(actionEl, 'arrow-down', '下移命令', commandIndex === group.commands.length - 1, async () => {
        await store.moveCommandInGroup(menuType, groupIndex, commandIndex, 1);
        await this.onSettingsChanged();
        await this.render();
      });
      this.createIconButton(actionEl, 'x', '移除命令', false, async () => {
        await store.removeCommandFromGroup(menuType, groupIndex, commandIndex);
        await this.onSettingsChanged();
        await this.render();
      });
    });

    const addableCommands = store.getAddableCommands(menuType);
    let selectedCommandId = addableCommands[0]?.id || '';
    let manualCommandId = '';

    this.renderControlRow(
      bodyEl,
      '添加命令',
      `下拉列表完全来自当前 Obsidian 命令注册表，共 ${addableCommands.length} 条。手动输入时，已注册命令可新增到菜单；已在“手动映射”中登记的未注册命令，也可加入分组以控制原始菜单项。`,
      (controlsEl) => {
        const selectOptions = addableCommands.map((command) => ({
          value: command.id,
          label: `${command.label} (${command.id})`
        }));

        this.createSelectInput(
          controlsEl,
          selectOptions,
          selectedCommandId,
          async (value) => {
            selectedCommandId = value;
          }
        );

        this.createTextInput(controlsEl, '或手动输入命令 ID', '', async (value) => {
          manualCommandId = value;
        });

        const addButtonEl = controlsEl.createEl('button', {
          cls: 'mod-cta',
          text: '添加'
        });
        addButtonEl.addEventListener('click', async () => {
          const commandId = (manualCommandId || selectedCommandId || '').trim();
          if (!commandId) {
            new obsidian.Notice('请先选择或输入命令 ID');
            return;
          }

          const result = await store.addCommandToGroup(menuType, groupIndex, commandId);
          if (!result.success) {
            if (result.reason === 'missing') {
              new obsidian.Notice(`命令不存在，无法添加：${commandId}`);
            } else if (result.reason === 'duplicate') {
              new obsidian.Notice('该命令已经在当前分组中');
            } else {
              new obsidian.Notice('命令为空，无法添加');
            }
            return;
          }

          const commandLabel = store.getCommandLabel(menuType, commandId);
          new obsidian.Notice(`已添加命令：${commandLabel}`);
          await this.onSettingsChanged();
          await this.render();
        });
      }
    );
  }

  // 渲染手动命令映射面板，用于补齐无显式 commandId 的原始菜单项识别。
  renderMappingsPanel(containerEl, menuType, menuConfig) {
    const store = this.plugin.menuCustomizerStore;
    const mappingsCardEl = containerEl.createEl('details', {
      cls: 'nene-menu-customizer-panel-card nene-menu-customizer-collapsible-card'
    });

    const summaryEl = mappingsCardEl.createEl('summary', {
      cls: 'nene-menu-customizer-card-header'
    });
    summaryEl.createDiv({ cls: 'nene-menu-customizer-subtitle', text: '手动映射' });
    summaryEl.createSpan({
      cls: 'nene-menu-customizer-meta-pill',
      text: `${menuConfig.commandMappings.length} 条`
    });

    const bodyEl = mappingsCardEl.createDiv({ cls: 'nene-menu-customizer-mappings' });
    bodyEl.createDiv({
      cls: 'nene-menu-customizer-note',
      text: '当某个原始右键菜单项没有暴露 commandId 时，在这里填写它的标题、section 和你约定的 commandId。运行时会按 title + section 做严格匹配。'
    });

    if (menuConfig.commandMappings.length === 0) {
      bodyEl.createDiv({
        cls: 'nene-menu-customizer-empty',
        text: '当前菜单还没有手动映射。'
      });
    }

    menuConfig.commandMappings.forEach((mapping, mappingIndex) => {
      const rowEl = bodyEl.createDiv({ cls: 'nene-menu-customizer-mapping-row' });

      const infoEl = rowEl.createDiv({ cls: 'nene-menu-customizer-mapping-info' });
      infoEl.createDiv({
        cls: 'nene-menu-customizer-command-label',
        text: mapping.title || '未填写标题'
      });
      infoEl.createEl('code', {
        cls: 'nene-menu-customizer-command-id',
        text: mapping.commandId || '未填写 commandId'
      });

      const metaEl = infoEl.createDiv({ cls: 'nene-menu-customizer-group-summary-meta' });
      metaEl.createSpan({
        cls: 'nene-menu-customizer-meta-pill',
        text: mapping.section ? `section: ${mapping.section}` : 'section 未填写'
      });
      metaEl.createSpan({
        cls: `nene-menu-customizer-meta-pill${store.isRegisteredCommand(mapping.commandId) ? '' : ' is-muted'}`,
        text: store.isRegisteredCommand(mapping.commandId)
          ? '已注册，可新增执行'
          : '未注册，仅识别原始项'
      });

      const controlsEl = rowEl.createDiv({ cls: 'nene-menu-customizer-mapping-controls' });
      this.createTextInput(controlsEl, '菜单标题', mapping.title || '', async (value) => {
        await store.updateCommandMapping(menuType, mappingIndex, { title: value });
        await this.onSettingsChanged();
        await this.render();
      });
      this.createTextInput(controlsEl, 'section（如 action）', mapping.section || '', async (value) => {
        await store.updateCommandMapping(menuType, mappingIndex, { section: value });
        await this.onSettingsChanged();
        await this.render();
      });
      this.createTextInput(controlsEl, 'commandId', mapping.commandId || '', async (value) => {
        await store.updateCommandMapping(menuType, mappingIndex, { commandId: value });
        await this.onSettingsChanged();
        await this.render();
      });

      const actionEl = controlsEl.createDiv({ cls: 'nene-menu-customizer-command-actions' });
      this.createIconButton(actionEl, 'trash', '删除映射', false, async () => {
        await store.removeCommandMapping(menuType, mappingIndex);
        await this.onSettingsChanged();
        await this.render();
      }, true);
    });

    const footerEl = bodyEl.createDiv({ cls: 'nene-menu-customizer-mapping-footer' });
    const addButtonEl = footerEl.createEl('button', {
      cls: 'mod-cta',
      text: '添加映射'
    });
    addButtonEl.addEventListener('click', async () => {
      await store.addCommandMapping(menuType);
      await this.onSettingsChanged();
      await this.render();
    });
  }

  // 渲染命令覆盖面板。
  renderOverridesPanel(containerEl, menuType, menuConfig) {
    const store = this.plugin.menuCustomizerStore;
    const overridesCardEl = containerEl.createEl('details', {
      cls: 'nene-menu-customizer-panel-card nene-menu-customizer-collapsible-card'
    });

    const summaryEl = overridesCardEl.createEl('summary', {
      cls: 'nene-menu-customizer-card-header'
    });
    summaryEl.createDiv({ cls: 'nene-menu-customizer-subtitle', text: '命令覆盖' });

    const commandIds = new Set(store.getAvailableCommands(menuType).map((command) => command.id));
    menuConfig.groups.forEach((group) => {
      group.commands.forEach((commandId) => commandIds.add(commandId));
    });
    menuConfig.commandMappings.forEach((mapping) => {
      if (mapping.commandId) {
        commandIds.add(mapping.commandId);
      }
    });
    Object.keys(menuConfig.commandOverrides).forEach((commandId) => commandIds.add(commandId));

    summaryEl.createSpan({
      cls: 'nene-menu-customizer-meta-pill',
      text: `${commandIds.size} 项`
    });

    const bodyEl = overridesCardEl.createDiv({ cls: 'nene-menu-customizer-overrides' });

    Array.from(commandIds)
      .sort((left, right) => store.getCommandLabel(menuType, left).localeCompare(store.getCommandLabel(menuType, right), 'zh-CN'))
      .forEach((commandId) => {
        const override = menuConfig.commandOverrides[commandId] || {};
        const rowEl = bodyEl.createDiv({ cls: 'nene-menu-customizer-override-row' });

        const titleEl = rowEl.createDiv({ cls: 'nene-menu-customizer-override-title' });
        titleEl.createDiv({
          cls: 'nene-menu-customizer-command-label',
          text: store.getCommandLabel(menuType, commandId)
        });
        titleEl.createEl('code', {
          cls: 'nene-menu-customizer-command-id',
          text: commandId
        });

        const controlsEl = rowEl.createDiv({ cls: 'nene-menu-customizer-override-controls' });
        this.createTextInput(controlsEl, '自定义标题', override.title || '', async (value) => {
          await store.updateCommandOverride(menuType, commandId, { title: value });
          this.renderPreviewPanel();
        });
        this.createTextInput(controlsEl, '自定义图标', override.icon || '', async (value) => {
          await store.updateCommandOverride(menuType, commandId, { icon: value });
          this.renderPreviewPanel();
        });
        this.createSwitchControl(controlsEl, override.hidden === true, async (checked) => {
          await store.updateCommandOverride(menuType, commandId, { hidden: checked });
          this.renderPreviewPanel();
        }, '隐藏命令');
      });
  }

  // 渲染底部重置卡片。
  renderResetPanel(containerEl) {
    const resetCardEl = containerEl.createDiv({ cls: 'nene-menu-customizer-panel-card' });

    this.renderControlRow(
      resetCardEl,
      '重置右键菜单配置',
      '仅重置右键菜单自定义模块的独立配置文件，不影响其他模块与总开关。',
      (controlsEl) => {
        const resetButtonEl = controlsEl.createEl('button', {
          cls: 'mod-warning',
          text: '重置 menu-customizer'
        });

        resetButtonEl.addEventListener('click', () => {
          new MenuCustomizerConfirmModal(
            this.app,
            '重置右键菜单配置',
            '此操作会将右键菜单模块的分组、排序、重命名、隐藏与子菜单配置全部恢复为默认值。',
            async () => {
              await this.plugin.resetFeatureConfiguration('menuCustomizer');
              new obsidian.Notice('右键菜单配置已重置');
              await this.onSettingsChanged();
              await this.render();
            }
          ).open();
        });
      }
    );
  }

  // 渲染右侧预览区，模拟最终菜单结构。
  renderPreviewPanel() {
    if (!this.previewPaneEl) {
      return;
    }

    const store = this.plugin.menuCustomizerStore;
    const menuType = this.activeMenuType;
    const menuConfig = store.getMenuConfig(menuType);
    const previewModel = this.buildPreviewModel(menuType, menuConfig);

    this.previewPaneEl.empty();

    const previewHeaderEl = this.previewPaneEl.createDiv({ cls: 'nene-menu-customizer-preview-header' });
    previewHeaderEl.createDiv({ cls: 'nene-menu-customizer-subtitle', text: '菜单预览' });
    previewHeaderEl.createDiv({
      cls: `nene-menu-customizer-preview-status${menuConfig.enabled ? ' is-active' : ''}`,
      text: menuConfig.enabled ? '当前菜单已启用' : '当前菜单未启用'
    });

    const infoListEl = this.previewPaneEl.createDiv({ cls: 'nene-settings-detail-list' });
    renderSummaryItem(infoListEl, '当前分页', getMenuTypeName(store, menuType));
    renderSummaryItem(infoListEl, '可见分组', `${previewModel.groups.length} 个`);
    renderSummaryItem(infoListEl, '未分组命令', `${previewModel.ungroupedItems.length} 个`);

    const surfaceEl = this.previewPaneEl.createDiv({ cls: 'nene-menu-customizer-preview-surface' });
    const menuEl = surfaceEl.createDiv({ cls: 'nene-menu-customizer-preview-menu' });

    if (!menuConfig.enabled) {
      menuEl.createDiv({
        cls: 'nene-menu-customizer-preview-empty',
        text: '当前分页未启用。启用后右键菜单才会按左侧配置重构。'
      });
      return;
    }

    if (previewModel.groups.length === 0 && previewModel.ungroupedItems.length === 0) {
      menuEl.createDiv({
        cls: 'nene-menu-customizer-preview-empty',
        text: '当前没有可预览的命令。'
      });
      return;
    }

    previewModel.groups.forEach((group, groupIndex) => {
      if (groupIndex > 0) {
        menuEl.createDiv({ cls: 'nene-menu-customizer-preview-separator' });
      }

      this.renderPreviewGroup(menuEl, group);
    });

    if (previewModel.ungroupedItems.length > 0) {
      if (previewModel.groups.length > 0) {
        menuEl.createDiv({ cls: 'nene-menu-customizer-preview-separator' });
      }

      const sectionLabelEl = menuEl.createDiv({ cls: 'nene-menu-customizer-preview-section-label' });
      sectionLabelEl.setText('未分组命令');

      previewModel.ungroupedItems.forEach((item) => {
        this.renderPreviewMenuItem(menuEl, item);
      });
    }
  }

  // 构建预览模型，尽量贴近运行时最终显示结果。
  buildPreviewModel(menuType, menuConfig) {
    const store = this.plugin.menuCustomizerStore;
    const availableCommands = store.getAvailableCommands(menuType);
    const commandMap = new Map();
    const usedCommandIds = new Set();

    availableCommands.forEach((command) => {
      const override = menuConfig.commandOverrides[command.id] || {};
      commandMap.set(command.id, {
        id: command.id,
        title: override.title || command.label || command.id,
        icon: override.icon || command.icon || '',
        hidden: override.hidden === true
      });
    });

    const groups = menuConfig.groups
      .filter((group) => group.hidden !== true)
      .map((group) => {
        const items = group.commands
          .map((commandId) => commandMap.get(commandId) || {
            id: commandId,
            title: menuConfig.commandOverrides[commandId]?.title || commandId,
            icon: menuConfig.commandOverrides[commandId]?.icon || '',
            hidden: menuConfig.commandOverrides[commandId]?.hidden === true
          })
          .filter((item) => item.hidden !== true);

        items.forEach((item) => usedCommandIds.add(item.id));

        return {
          id: group.id,
          name: group.name,
          icon: group.icon || '',
          layout: group.layout,
          forceSubmenu: group.forceSubmenu === true,
          items
        };
      })
      .filter((group) => group.items.length > 0);

    const ungroupedItems = availableCommands
      .map((command) => commandMap.get(command.id))
      .filter((item) => item && item.hidden !== true && !usedCommandIds.has(item.id));

    return {
      groups,
      ungroupedItems
    };
  }

  // 渲染单个预览分组。
  renderPreviewGroup(containerEl, group) {
    if (group.layout === 'icon-bar') {
      const blockEl = containerEl.createDiv({ cls: 'nene-menu-customizer-preview-block' });
      this.renderPreviewBlockTitle(blockEl, group);
      const iconBarEl = blockEl.createDiv({ cls: 'nene-menu-customizer-preview-icon-bar' });
      group.items.forEach((item) => {
        const chipEl = iconBarEl.createDiv({ cls: 'nene-menu-customizer-preview-icon-chip' });
        if (item.icon) {
          const iconEl = chipEl.createSpan({ cls: 'nene-menu-customizer-preview-icon' });
          obsidian.setIcon(iconEl, item.icon);
        }
        chipEl.title = item.title;
      });
      return;
    }

    if (group.layout === 'grid') {
      const blockEl = containerEl.createDiv({ cls: 'nene-menu-customizer-preview-block' });
      this.renderPreviewBlockTitle(blockEl, group);
      const gridEl = blockEl.createDiv({ cls: 'nene-menu-customizer-preview-grid' });
      group.items.forEach((item) => {
        const cardEl = gridEl.createDiv({ cls: 'nene-menu-customizer-preview-grid-item' });
        if (item.icon) {
          const iconEl = cardEl.createSpan({ cls: 'nene-menu-customizer-preview-icon' });
          obsidian.setIcon(iconEl, item.icon);
        }
        cardEl.createDiv({
          cls: 'nene-menu-customizer-preview-grid-title',
          text: item.title
        });
      });
      return;
    }

    if (group.forceSubmenu || group.items.length > 1) {
      const submenuEl = containerEl.createDiv({ cls: 'nene-menu-customizer-preview-submenu' });
      const parentItemEl = submenuEl.createDiv({ cls: 'nene-menu-customizer-preview-item is-parent' });
      this.appendPreviewItemContent(parentItemEl, {
        title: group.name,
        icon: group.icon
      });
      parentItemEl.createSpan({
        cls: 'nene-menu-customizer-preview-arrow',
        text: '›'
      });

      const childMenuEl = submenuEl.createDiv({ cls: 'nene-menu-customizer-preview-submenu-panel' });
      group.items.forEach((item) => {
        this.renderPreviewMenuItem(childMenuEl, item);
      });
      return;
    }

    group.items.forEach((item) => {
      this.renderPreviewMenuItem(containerEl, item);
    });
  }

  // 渲染预览块标题。
  renderPreviewBlockTitle(containerEl, group) {
    const titleEl = containerEl.createDiv({ cls: 'nene-menu-customizer-preview-section-label' });
    if (group.icon) {
      const iconEl = titleEl.createSpan({ cls: 'nene-menu-customizer-preview-icon' });
      obsidian.setIcon(iconEl, group.icon);
    }
    titleEl.createSpan({ text: group.name });
  }

  // 渲染普通预览菜单项。
  renderPreviewMenuItem(containerEl, item) {
    const itemEl = containerEl.createDiv({ cls: 'nene-menu-customizer-preview-item' });
    this.appendPreviewItemContent(itemEl, item);
  }

  // 渲染预览菜单项公共内容。
  appendPreviewItemContent(containerEl, item) {
    const iconEl = containerEl.createSpan({ cls: 'nene-menu-customizer-preview-icon' });
    if (item.icon) {
      obsidian.setIcon(iconEl, item.icon);
    }

    containerEl.createSpan({
      cls: 'nene-menu-customizer-preview-title',
      text: item.title
    });
  }

  // 渲染一行紧凑设置控件。
  renderControlRow(containerEl, title, description, renderControls) {
    const rowEl = containerEl.createDiv({ cls: 'nene-menu-customizer-control-row' });
    const infoEl = rowEl.createDiv({ cls: 'nene-menu-customizer-control-info' });
    infoEl.createDiv({ cls: 'nene-menu-customizer-control-title', text: title });

    if (description) {
      infoEl.createDiv({
        cls: 'nene-menu-customizer-control-desc',
        text: description
      });
    }

    const controlsEl = rowEl.createDiv({ cls: 'nene-menu-customizer-control-actions' });
    renderControls(controlsEl);
  }

  // 创建输入框控件。
  createTextInput(containerEl, placeholder, value, onInput) {
    const inputEl = containerEl.createEl('input', {
      cls: 'nene-menu-customizer-text-input',
      type: 'text'
    });
    inputEl.placeholder = placeholder;
    inputEl.value = value || '';
    inputEl.addEventListener('input', async () => {
      await onInput(inputEl.value);
    });
    return inputEl;
  }

  // 创建下拉框控件。
  createSelectInput(containerEl, options, selectedValue, onChange) {
    const selectEl = containerEl.createEl('select', {
      cls: 'nene-menu-customizer-select'
    });

    options.forEach((option) => {
      const normalizedOption = typeof option === 'string'
        ? { value: option, label: option }
        : option;
      const optionEl = selectEl.createEl('option', {
        text: normalizedOption.label
      });
      optionEl.value = normalizedOption.value;
    });

    if (selectedValue) {
      selectEl.value = selectedValue;
    }

    selectEl.addEventListener('change', async () => {
      await onChange(selectEl.value);
    });

    return selectEl;
  }

  // 创建开关控件。
  createSwitchControl(containerEl, checked, onChange, labelText) {
    const wrapperEl = containerEl.createDiv({ cls: 'nene-menu-customizer-switch' });
    const inputEl = wrapperEl.createEl('input', {
      type: 'checkbox'
    });
    inputEl.checked = Boolean(checked);

    const labelEl = wrapperEl.createSpan({
      cls: 'nene-menu-customizer-switch-label',
      text: labelText || (checked ? '已开启' : '已关闭')
    });

    inputEl.addEventListener('change', async () => {
      if (!labelText) {
        labelEl.setText(inputEl.checked ? '已开启' : '已关闭');
      }

      await onChange(inputEl.checked);
    });

    return wrapperEl;
  }

  // 创建统一风格的小图标按钮，减少重复代码。
  createIconButton(containerEl, iconName, tooltip, disabled, onClick, isDanger) {
    const buttonEl = containerEl.createEl('button', {
      cls: `clickable-icon${isDanger ? ' mod-warning' : ''}`
    });

    obsidian.setIcon(buttonEl, iconName);
    buttonEl.ariaLabel = tooltip;
    buttonEl.disabled = Boolean(disabled);
    buttonEl.addEventListener('click', async () => {
      if (buttonEl.disabled) {
        return;
      }

      await onClick();
    });
  }

  // 关闭弹窗时清理 DOM。
  onClose() {
    this.contentEl.empty();
  }
}

module.exports = {
  MenuCustomizerManagementModal
};
