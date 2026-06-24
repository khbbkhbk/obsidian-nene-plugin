'use strict';

var obsidian = require('obsidian');
var fileMarker = require('./modules/file-marker/index.js');
var pluginData = require('./modules/plugin-data/index.js');
var pluginSettings = require('./modules/plugin-settings/index.js');
var pluginListEnhancerModule = require('./modules/plugin-list-enhancer/index.js');
var anchorGraphLinksModule = require('./modules/anchor-graph-links/index.js');
var settingsTabModule = require('./modules/settings-tab/index.js');

// 定义插件主类，作为模块装配层，统一协调各功能目录。
class ObsidianNenePlugin extends obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.dataStore = new pluginData.PluginDataStore(this); // 管理整份插件数据及旧结构迁移
    this.pluginSettingsStore = new pluginSettings.PluginSettingsStore(this); // 管理插件级功能开关
    this.fileMarkerStore = new fileMarker.FileMarkerStore(this); // 管理文件标记业务数据
    this.pluginListEnhancer = new pluginListEnhancerModule.PluginListEnhancer(this); // 管理旧设置页增强逻辑
    this.anchorGraphLinkEnhancer = new anchorGraphLinksModule.AnchorGraphLinkEnhancer(this); // 管理关系图谱 HTML 内部链接增强逻辑
  }

  // 暴露只读设置访问入口，兼容后续模块对当前配置的读取。
  get settings() {
    return this.dataStore.getData();
  }

  // 插件加载时执行初始化逻辑。
  async onload() {
    console.log('Loading obsidian-nene-plugin');

    await this.dataStore.load(); // 先加载整份插件数据并迁移旧结构
    this.pluginSettingsStore.load(this.dataStore.getFeatures()); // 将插件级功能开关注入设置仓库
    this.fileMarkerStore.load(this.dataStore.getFileMarkerData()); // 将文件标记切片挂载到业务仓库
    await this.fileMarkerStore.pruneMissingMarks(); // 清理已经不存在的文件标记

    this.setupFileMarkerView();
    this.setupFileMenu();
    this.setupVaultEvents();
    this.setupCommandEntries();
    this.setupLayoutEvents();
    this.setupAnchorGraphEvents();
    this.addSettingTab(new settingsTabModule.ObsidianNenePluginSettingTab(this.app, this));

    this.pluginListEnhancer.start();
    this.syncFileMarkerFeatureState();
    this.syncAnchorGraphEnhancerState();
  }

  // 插件卸载时清理动态资源和已打开视图。
  onunload() {
    console.log('Unloading obsidian-nene-plugin');
    this.pluginListEnhancer.stop();
    this.anchorGraphLinkEnhancer.stop();

    this.app.workspace.getLeavesOfType(fileMarker.FILE_MARKER_VIEW_TYPE).forEach((leaf) => {
      leaf.detach();
    });
  }

  // 注册侧边栏视图，用于集中展示所有文件标记。
  /* ------------------------------ */
  /* 主入口装配 */
  /* ------------------------------ */

  // 注册侧边栏视图，用于集中展示所有文件标记。
  setupFileMarkerView() {
    this.registerView(fileMarker.FILE_MARKER_VIEW_TYPE, (leaf) => {
      return new fileMarker.FileMarkerView(leaf, this);
    });
  }

  // 注册文件资源管理器右键菜单项。
  setupFileMenu() {
    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file) => {
        if (!this.isFileMarkerEnabled()) return;
        if (!(file instanceof obsidian.TFile)) return;

        const hasMark = Boolean(this.getMarkRecord(file.path));
        menu.addItem((item) => {
          item
            .setTitle(hasMark ? '编辑文件标记' : '添加文件标记')
            .setIcon('tag')
            .onClick(() => {
              this.openMarkEditor(file);
            });
        });
      })
    );
  }

  // 注册文件系统事件，保证文件改名或删除后标记数据同步更新。
  setupVaultEvents() {
    this.registerEvent(
      this.app.vault.on('rename', async (file, oldPath) => {
        if (!(file instanceof obsidian.TFile)) return;

        const hasChanged = await this.fileMarkerStore.renameMark(file, oldPath);
        if (hasChanged) {
          this.refreshAllFileMarkerViews();
        }
      })
    );

    this.registerEvent(
      this.app.vault.on('delete', async (file) => {
        if (!(file instanceof obsidian.TFile)) return;

        const hasChanged = await this.fileMarkerStore.removeMarkByFile(file);
        if (hasChanged) {
          this.refreshAllFileMarkerViews();
        }
      })
    );
  }

  // 注册命令入口，便于用户通过命令面板快速打开文件标记视图。
  setupCommandEntries() {
    this.addCommand({
      id: 'open-file-marker-view',
      name: '打开文件标记面板',
      callback: async () => {
        await this.startFileMarkerFeature();
      }
    });

    this.addCommand({
      id: 'refresh-anchor-graph-links',
      name: '刷新关系图谱 HTML 链接',
      callback: async () => {
        await this.refreshAnchorGraphLinks(true);
      }
    });
  }

  // 注册布局变化监听，保留原有插件列表增强能力。
  setupLayoutEvents() {
    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        this.pluginListEnhancer.processPluginList();
        this.anchorGraphLinkEnhancer.processGraphRefreshButtons();
      })
    );
  }

  // 注册关系图谱 HTML 链接刷新事件，兼顾单文件更新和结构变化后的全量重建。
  setupAnchorGraphEvents() {
    this.registerEvent(
      this.app.workspace.on('editor-change', (editor, view) => {
        if (!this.isAnchorGraphEnabled()) return;

        const file = view && view.file instanceof obsidian.TFile
          ? view.file
          : this.app.workspace.getActiveFile();
        if (!(file instanceof obsidian.TFile) || file.extension !== 'md') return;

        this.anchorGraphLinkEnhancer.scheduleSourceRefresh(file, editor.getValue(), 240);
      })
    );

    this.registerEvent(
      this.app.metadataCache.on('changed', async (file, data) => {
        if (!this.isAnchorGraphEnabled()) return;
        await this.anchorGraphLinkEnhancer.refreshSourceFile(file, data);
      })
    );

    this.registerEvent(
      this.app.vault.on('create', async (file) => {
        if (!this.isAnchorGraphEnabled()) return;
        if (!(file instanceof obsidian.TFile)) return;

        await this.anchorGraphLinkEnhancer.refreshSourceFileFromVault(file);
        this.anchorGraphLinkEnhancer.scheduleFullRefresh(this.anchorGraphLinkEnhancer.getStructureRefreshDelay());
      })
    );

    this.registerEvent(
      this.app.vault.on('rename', async (file, oldPath) => {
        if (!this.isAnchorGraphEnabled()) return;
        if (!(file instanceof obsidian.TFile)) return;

        await this.anchorGraphLinkEnhancer.handleSourceFileRename(file, oldPath);
        this.anchorGraphLinkEnhancer.scheduleFullRefresh(this.anchorGraphLinkEnhancer.getStructureRefreshDelay());
      })
    );

    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        if (!this.isAnchorGraphEnabled()) return;
        if (!(file instanceof obsidian.TFile)) return;

        this.anchorGraphLinkEnhancer.removeSourceFileLinks(file.path);
        this.anchorGraphLinkEnhancer.scheduleFullRefresh(this.anchorGraphLinkEnhancer.getStructureRefreshDelay());
      })
    );
  }

  /* ------------------------------ */
  /* 只读代理 */
  /* ------------------------------ */

  // 返回指定路径的标记记录，未命中时返回空值。
  getMarkRecord(filePath) {
    return this.fileMarkerStore.getSettings().marks[filePath] || null;
  }

  // 返回当前全部分组信息。
  getGroups() {
    return this.fileMarkerStore.getGroups();
  }

  // 根据状态值获取显示名称。
  getStatusLabel(statusValue) {
    return this.fileMarkerStore.getStatusLabel(statusValue);
  }

  // 根据文件类型返回图标名称。
  getFileIcon(file) {
    return this.fileMarkerStore.getFileIcon(file);
  }

  // 返回格式化后的更新时间文本。
  formatTime(timestamp) {
    return this.fileMarkerStore.formatTime(timestamp);
  }

  // 返回按分组整理后的文件标记数据。
  getGroupedMarkedFiles() {
    return this.fileMarkerStore.getGroupedMarkedFiles();
  }

  // 返回关系图谱增强当前是否被用户启用。
  isAnchorGraphEnabled() {
    return this.pluginSettingsStore.isAnchorGraphEnabled();
  }

  // 返回当前文件标记数量，供设置页与后续状态摘要复用。
  getMarkCount() {
    return Object.keys(this.fileMarkerStore.getSettings().marks).length;
  }

  // 返回文件标记模块当前是否被用户启用。
  isFileMarkerEnabled() {
    return this.pluginSettingsStore.isFileMarkerEnabled();
  }

  // 返回文件标记面板当前是否已在工作区打开。
  isFileMarkerViewOpen() {
    return this.app.workspace.getLeavesOfType(fileMarker.FILE_MARKER_VIEW_TYPE).length > 0;
  }

  // 返回设置页所需的数据摘要，统一管理展示字段。
  getSettingsSummary() {
    const anchorGraphStats = this.anchorGraphLinkEnhancer.getStats();
    const anchorGraphRuntime = this.anchorGraphLinkEnhancer.getRuntimeStatus();

    return {
      markCount: this.getMarkCount(),
      groupCount: this.getGroups().length,
      fileMarkerEnabled: this.isFileMarkerEnabled(),
      fileMarkerViewOpen: this.isFileMarkerViewOpen(),
      anchorGraphSourceFileCount: anchorGraphStats.sourceFileCount,
      anchorGraphEdgeCount: anchorGraphStats.edgeCount,
      anchorGraphEnabled: this.isAnchorGraphEnabled(),
      anchorGraphRuntimeState: anchorGraphRuntime.state,
      anchorGraphRuntimeMessage: anchorGraphRuntime.message
    };
  }

  /* ------------------------------ */
  /* 写操作代理 */
  /* ------------------------------ */

  // 打开文件标记编辑弹窗。
  openMarkEditor(file) {
    new fileMarker.FileMarkerModal(this.app, this, file).open();
  }

  // 保存单个文件的标记记录，并刷新视图。
  async saveMarkRecord(file, payload) {
    await this.fileMarkerStore.saveMark(file, payload);
    this.refreshAllFileMarkerViews();
  }

  // 删除单个文件的标记记录，并刷新视图。
  async removeMarkRecord(filePath) {
    const hasChanged = await this.fileMarkerStore.removeMark(filePath);
    if (hasChanged) {
      this.refreshAllFileMarkerViews();
    }

    return hasChanged;
  }

  // 新增分组，并在保存后刷新视图。
  async createMarkGroup(groupName) {
    const result = await this.fileMarkerStore.addGroup(groupName);
    this.refreshAllFileMarkerViews();
    return result;
  }

  // 切换指定分组的展开或折叠状态。
  async updateGroupCollapsedState(groupId, collapsed) {
    const hasChanged = await this.fileMarkerStore.setGroupCollapsed(groupId, collapsed);
    if (hasChanged) {
      this.refreshAllFileMarkerViews();
    }

    return hasChanged;
  }

  // 一键展开或折叠全部分组。
  async updateAllGroupsCollapsedState(collapsed) {
    await this.fileMarkerStore.setAllGroupsCollapsed(collapsed);
    this.refreshAllFileMarkerViews();
  }

  // 打开指定路径对应的文件，不存在时提示用户。
  async openMarkedFileByPath(filePath) {
    const result = await this.fileMarkerStore.openMarkedFile(filePath);
    if (!result.success && result.message) {
      new obsidian.Notice(result.message);
    }

    return result;
  }

  // 清理已经不存在的文件标记，并在有变更时刷新文件标记视图。
  async pruneMissingMarkRecords() {
    const hasChanged = await this.fileMarkerStore.pruneMissingMarks();
    if (hasChanged) {
      this.refreshAllFileMarkerViews();
    }

    return hasChanged;
  }

  // 更新文件标记模块开关，并根据当前设置立即同步启停状态。
  async updateFileMarkerEnabled(enabled) {
    const nextEnabled = await this.pluginSettingsStore.setFileMarkerEnabled(enabled);
    this.syncFileMarkerFeatureState();
    return nextEnabled;
  }

  // 一键启动文件标记模块，确保右侧面板已创建并处于可见状态。
  async startFileMarkerFeature() {
    if (!this.isFileMarkerEnabled()) {
      new obsidian.Notice('文件标记面板当前已关闭，请先在设置页中启用。');
      return;
    }

    await this.ensureFileMarkerViewOpen();
  }

  // 更新关系图谱增强开关，并根据当前设置立即同步启停状态。
  async updateAnchorGraphEnabled(enabled) {
    const nextEnabled = await this.pluginSettingsStore.setAnchorGraphEnabled(enabled);
    this.syncAnchorGraphEnhancerState();
    return nextEnabled;
  }

  // 手动刷新关系图谱 HTML 链接识别结果，供图谱刷新按钮与命令面板调用。
  async refreshAnchorGraphLinks(showNotice) {
    if (!this.isAnchorGraphEnabled()) {
      if (showNotice) {
        new obsidian.Notice('关系图谱 HTML 链接增强当前已关闭，请先在设置页中启用。');
      }
      return;
    }

    await this.anchorGraphLinkEnhancer.refreshAll(Boolean(showNotice));
  }

  // 一键启动关系图谱 HTML 链接增强，必要时先启用开关后再执行一次刷新。
  async startAnchorGraphFeature() {
    await this.refreshAnchorGraphLinks(true);
  }

  /* ------------------------------ */
  /* 视图控制 */
  /* ------------------------------ */

  // 激活文件标记面板，若面板尚未创建则自动在右侧侧边栏打开。
  async ensureFileMarkerViewOpen() {
    if (!this.isFileMarkerEnabled()) {
      new obsidian.Notice('文件标记面板当前已关闭，请先在设置页中启用。');
      return;
    }

    let leaf = this.app.workspace.getLeavesOfType(fileMarker.FILE_MARKER_VIEW_TYPE)[0];

    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false);
      await leaf.setViewState({
        type: fileMarker.FILE_MARKER_VIEW_TYPE,
        active: true
      });
    }

    await this.app.workspace.revealLeaf(leaf);

    if (leaf.view instanceof fileMarker.FileMarkerView) {
      leaf.view.render();
    }
  }

  // 刷新所有已打开的文件标记视图，保证界面能实时反映最新数据。
  refreshAllFileMarkerViews() {
    this.app.workspace.getLeavesOfType(fileMarker.FILE_MARKER_VIEW_TYPE).forEach((leaf) => {
      if (leaf.view instanceof fileMarker.FileMarkerView) {
        leaf.view.render();
      }
    });
  }

  // 根据当前设置同步文件标记模块的启停状态，关闭时回收已打开面板。
  syncFileMarkerFeatureState() {
    if (this.isFileMarkerEnabled()) {
      return;
    }

    this.app.workspace.getLeavesOfType(fileMarker.FILE_MARKER_VIEW_TYPE).forEach((leaf) => {
      leaf.detach();
    });
  }

  // 根据当前设置同步关系图谱增强模块的启停状态，供启动和设置切换共用。
  syncAnchorGraphEnhancerState() {
    if (this.isAnchorGraphEnabled()) {
      this.anchorGraphLinkEnhancer.start();
      return;
    }

    this.anchorGraphLinkEnhancer.stop();
  }
}

module.exports = ObsidianNenePlugin; // 导出插件主类，供 Obsidian 加载
