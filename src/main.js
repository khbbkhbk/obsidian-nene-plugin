'use strict';

var obsidian = require('obsidian');
var fileMarker = require('./modules/file-marker/index.js');
var pluginData = require('./modules/plugin-data/index.js');
var pluginSettings = require('./modules/plugin-settings/index.js');
var pluginListEnhancerModule = require('./modules/plugin-list-enhancer/index.js');
var graphViewEnhancerModule = require('./modules/graph-view-enhancer/index.js');
var copyPathModule = require('./modules/copy-path/index.js');
var statusBarEnhancerModule = require('./modules/status-bar-enhancer/index.js');
var contextMenuEnhancerModule = require('./modules/context-menu-enhancer/index.js');
var settingsTabModule = require('./modules/settings-tab/index.js');

// 定义插件主类，作为模块装配层，统一协调各功能目录。
class ObsidianNenePlugin extends obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.dataStore = new pluginData.PluginDataStore(this); // 管理整份插件数据及旧结构迁移
    this.pluginSettingsStore = new pluginSettings.PluginSettingsStore(this); // 管理插件级功能开关
    this.fileMarkerStore = new fileMarker.FileMarkerStore(this); // 管理文件标记业务数据
    this.pluginListEnhancer = new pluginListEnhancerModule.PluginListEnhancer(this); // 管理旧设置页增强逻辑
    this.anchorGraphLinkEnhancer = new graphViewEnhancerModule.AnchorGraphLinkEnhancer(this); // 管理关系图谱 HTML 内部链接增强逻辑
    this.copyPathStore = new copyPathModule.CopyPathStore(this); // 管理复制路径模块配置与右键菜单目标缓存
    this.copyPathService = new copyPathModule.CopyPathService(this); // 管理复制路径命令执行逻辑
    this.statusBarEnhancerStore = new statusBarEnhancerModule.StatusBarEnhancerStore(this); // 管理状态栏增强模块配置
    this.statusBarEnhancerRuntime = new statusBarEnhancerModule.StatusBarEnhancerRuntime(this); // 管理状态栏增强运行时
    this.menuCustomizerStore = new contextMenuEnhancerModule.MenuCustomizerStore(this); // 管理右键菜单自定义配置
    this.menuCustomizerRuntime = new contextMenuEnhancerModule.MenuCustomizerRuntime(this); // 管理右键菜单运行时拦截与重构
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
    this.menuCustomizerStore.load(this.dataStore.getMenuCustomizerData()); // 将右键菜单配置切片挂载到业务仓库
    this.copyPathStore.load(this.dataStore.getCopyPathData()); // 将复制路径配置切片挂载到业务仓库
    this.statusBarEnhancerStore.load(this.dataStore.getStatusBarEnhancerData()); // 将状态栏增强配置切片挂载到业务仓库
    await this.fileMarkerStore.pruneMissingMarks(); // 清理已经不存在的文件标记

    this.setupFileMarkerView();
    this.setupFileMenu();
    this.setupEditorMenu();
    this.setupStatusBarEnhancerEvents();
    this.setupVaultEvents();
    this.setupCommandEntries();
    this.setupLayoutEvents();
    this.setupAnchorGraphEvents();
    this.addSettingTab(new settingsTabModule.ObsidianNenePluginSettingTab(this.app, this));

    this.pluginListEnhancer.start();
    this.syncFileMarkerFeatureState();
    this.syncAnchorGraphEnhancerState();
    this.syncStatusBarEnhancerState();
    this.syncMenuCustomizerState();
  }

  // 插件卸载时清理动态资源和已打开视图。
  onunload() {
    console.log('Unloading obsidian-nene-plugin');
    this.pluginListEnhancer.stop();
    this.anchorGraphLinkEnhancer.stop();
    this.statusBarEnhancerRuntime.stop();
    this.menuCustomizerRuntime.stop();

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
        this.menuCustomizerRuntime.annotateFileMenu(menu, file);
        this.copyPathStore.rememberMenuTarget(file);
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

  // 注册编辑区右键菜单上下文标记，便于运行时区分编辑菜单与更多选项菜单。
  setupEditorMenu() {
    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu) => {
        this.menuCustomizerRuntime.annotateEditorMenu(menu);
      })
    );
  }

  // 注册状态栏增强所需的工作区事件，保证切换文件与改名时状态栏立即刷新。
  setupStatusBarEnhancerEvents() {
    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        this.statusBarEnhancerRuntime.renderFilePath(file);
      })
    );

    this.registerEvent(
      this.app.vault.on('rename', (file) => {
        if (file instanceof obsidian.TFile && file === this.app.workspace.getActiveFile()) {
          this.statusBarEnhancerRuntime.renderFilePath(file);
        }
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

    this.addCommand({
      id: 'copy-vault-path',
      name: '复制当前目标的库内路径',
      callback: async () => {
        await this.copyPathService.copyVaultPathFromCommand();
      }
    });

    this.addCommand({
      id: 'copy-full-path',
      name: '复制当前目标的完整路径',
      callback: async () => {
        await this.copyPathService.copyFullPathFromCommand();
      }
    });

    this.addCommand({
      id: 'copy-uri-link',
      name: '复制当前目标的URI链接',
      callback: async () => {
        await this.copyPathService.copyUriLinkFromCommand();
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

  // 返回右键菜单自定义模块当前是否被用户启用。
  isMenuCustomizerEnabled() {
    return this.pluginSettingsStore.isMenuCustomizerEnabled();
  }

  // 返回复制路径模块当前是否被用户启用。
  isCopyPathEnabled() {
    return this.pluginSettingsStore.isCopyPathEnabled();
  }

  // 返回状态栏增强模块当前是否被用户启用。
  isStatusBarEnhancerEnabled() {
    return this.pluginSettingsStore.isStatusBarEnhancerEnabled();
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
      anchorGraphRuntimeMessage: anchorGraphRuntime.message,
      menuCustomizerEnabled: this.isMenuCustomizerEnabled(),
      menuCustomizerMenuCount: this.menuCustomizerStore.getEnabledMenuCount(),
      menuCustomizerGroupCount: this.menuCustomizerStore.getGroupCount(),
      copyPathEnabled: this.isCopyPathEnabled(),
      copyPathTrailingSlashEnabled: this.copyPathStore.getSettings().addTrailingSlashToFolders === true,
      statusBarEnhancerEnabled: this.isStatusBarEnhancerEnabled(),
      statusBarEnhancerShowFileName: this.statusBarEnhancerStore.getSettings().showFileName === true,
      statusBarEnhancerShowIcons: this.statusBarEnhancerStore.getSettings().showIcons === true,
      statusBarEnhancerCopyAbsolutePath: this.statusBarEnhancerStore.getSettings().copyAbsolutePath !== false
    };
  }

  // 返回设置页所需的配置文件状态摘要，便于展示导入导出与重置入口。
  async getConfigManagementSummary() {
    return this.dataStore.getConfigFileStatuses();
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

  // 更新右键菜单自定义开关，并根据当前设置立即同步运行时状态。
  async updateMenuCustomizerEnabled(enabled) {
    const nextEnabled = await this.pluginSettingsStore.setMenuCustomizerEnabled(enabled);
    this.syncMenuCustomizerState();
    return nextEnabled;
  }

  // 更新复制路径模块开关。
  async updateCopyPathEnabled(enabled) {
    return this.pluginSettingsStore.setCopyPathEnabled(enabled);
  }

  // 更新复制路径模块的文件夹末尾斜杠配置。
  async updateCopyPathTrailingSlashEnabled(enabled) {
    return this.copyPathStore.setAddTrailingSlashToFolders(enabled);
  }

  // 更新状态栏增强模块开关，并立即同步状态栏显示状态。
  async updateStatusBarEnhancerEnabled(enabled) {
    const nextEnabled = await this.pluginSettingsStore.setStatusBarEnhancerEnabled(enabled);
    this.syncStatusBarEnhancerState();
    return nextEnabled;
  }

  // 更新状态栏增强的“显示文件名”配置，并立即刷新状态栏。
  async updateStatusBarEnhancerShowFileName(enabled) {
    const nextValue = await this.statusBarEnhancerStore.setShowFileName(enabled);
    this.syncStatusBarEnhancerState();
    return nextValue;
  }

  // 更新状态栏增强的“显示图标”配置，并立即刷新状态栏。
  async updateStatusBarEnhancerShowIcons(enabled) {
    const nextValue = await this.statusBarEnhancerStore.setShowIcons(enabled);
    this.syncStatusBarEnhancerState();
    return nextValue;
  }

  // 更新状态栏增强的“复制绝对路径”配置。
  async updateStatusBarEnhancerCopyAbsolutePath(enabled) {
    return this.statusBarEnhancerStore.setCopyAbsolutePath(enabled);
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

  // 导出当前全部配置为 JSON 字符串，供设置页复制或备份。
  exportConfigurationBundle() {
    return JSON.stringify(this.dataStore.exportConfigurationBundle(), null, 2);
  }

  // 导出当前全部配置到独立备份文件，并返回写入结果。
  async exportConfigurationBundleToFile() {
    return this.dataStore.exportConfigurationBundleToFile();
  }

  // 导入用户提供的配置 JSON，并在完成后同步运行时状态与已打开视图。
  async importConfigurationBundle(rawText) {
    const parsedBundle = JSON.parse(rawText);
    await this.dataStore.importConfigurationBundle(parsedBundle);
    await this.reloadRuntimeStateFromDataStore();
  }

  // 将指定功能配置重置为默认值，并同步当前运行时状态。
  async resetFeatureConfiguration(featureKey) {
    await this.dataStore.resetFeatureData(featureKey);
    await this.reloadRuntimeStateFromDataStore();
  }

  // 将整个插件配置重置为默认值，并同步当前运行时状态。
  async resetAllConfiguration() {
    await this.dataStore.resetAllData();
    await this.reloadRuntimeStateFromDataStore();
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

  // 根据当前设置同步状态栏增强模块的启停状态，并在启用时刷新当前活动文件路径。
  syncStatusBarEnhancerState() {
    this.statusBarEnhancerRuntime.load(this.statusBarEnhancerStore.getSettings());

    if (this.isStatusBarEnhancerEnabled()) {
      this.statusBarEnhancerRuntime.start();
      return;
    }

    this.statusBarEnhancerRuntime.stop();
  }

  // 根据当前设置同步右键菜单模块的启停状态，并在启用时刷新运行时配置。
  syncMenuCustomizerState() {
    this.menuCustomizerRuntime.load(this.menuCustomizerStore.getSettings());

    if (this.isMenuCustomizerEnabled()) {
      this.menuCustomizerRuntime.start();
      return;
    }

    this.menuCustomizerRuntime.stop();
  }

  // 在导入或重置配置后重载各仓库状态，确保设置页、面板与图谱行为立即同步。
  async reloadRuntimeStateFromDataStore() {
    this.pluginSettingsStore.load(this.dataStore.getFeatures());
    this.fileMarkerStore.load(this.dataStore.getFileMarkerData());
    this.menuCustomizerStore.load(this.dataStore.getMenuCustomizerData());
    this.copyPathStore.load(this.dataStore.getCopyPathData());
    this.statusBarEnhancerStore.load(this.dataStore.getStatusBarEnhancerData());

    this.syncFileMarkerFeatureState();
    this.refreshAllFileMarkerViews();
    this.syncAnchorGraphEnhancerState();
    this.syncStatusBarEnhancerState();
    this.syncMenuCustomizerState();

    if (this.isAnchorGraphEnabled()) {
      await this.refreshAnchorGraphLinks(false);
    }
  }
}

module.exports = ObsidianNenePlugin; // 导出插件主类，供 Obsidian 加载
