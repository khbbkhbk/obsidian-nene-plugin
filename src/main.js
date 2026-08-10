'use strict';

var obsidian = require('obsidian');
var fileMarker = require('./modules/file-marker/index.js');
var pluginData = require('./modules/plugin-data/index.js');
var pluginSettings = require('./modules/plugin-settings/index.js');
var pluginListEnhancerModule = require('./modules/plugin-list-enhancer/index.js');
var graphViewEnhancerModule = require('./modules/graph-view-enhancer/index.js');
var commandUriEnhancerModule = require('./modules/command-uri-enhancer/index.js');
var statusBarEnhancerModule = require('./modules/status-bar-enhancer/index.js');
var tabBarEnhancerModule = require('./modules/tab-bar-enhancer/index.js');
var contextMenuEnhancerModule = require('./modules/context-menu-enhancer/index.js');
var settingsTabModule = require('./modules/settings-tab/index.js');
var fileExplorerEnhancerModule = require('./modules/file-explorer-enhancer/index.js');
var editorEnhancerModule = require('./modules/editor-enhancer/index.js');
var themeEnhancerModule = require('./modules/theme-enhancer/index.js');

// 热更新桥接键名：插件被 hot-reload 重载时，借助 window 全局对象跨旧实例与新实例传递
// 需要恢复的状态（已打开的子界面类型、设置面板是否正显示本插件设置页）。
// 因为重载会重新执行整个打包产物（main.js），模块级变量会全部丢失，只有 window 上的状态能保留下来。
const HOT_RELOAD_BRIDGE_KEY = '__nene_hot_reload_bridge__';
// 热更新时间窗口（毫秒）：仅当“关闭后重新启用”发生在该窗口内时，才视为开发热更新并自动恢复子界面；
// 超出窗口则视为用户手动禁用插件后再次启用，不自动弹窗，避免打扰。
const HOT_RELOAD_WINDOW_MS = 8000;
// 设置页可见性轮询：core 禁用插件时会先于插件 onunload 关闭设置面板，
// 导致 onunload 中无法检测到“用户正显示本插件设置页”（实测 isOpen 已为 false），
// 因此通过低频轮询把可见性实时记录到 window，供重载后的新实例判断是否需要重新打开设置面板。
const SETTINGS_TAB_VISIBILITY_KEY = '__nene_settings_tab_visibility__';
const SETTINGS_TAB_POLL_MS = 500; // 可见性轮询间隔（毫秒）
const SETTINGS_TAB_FRESH_MS = 3000; // 可见性记录的新鲜度窗口（毫秒），超出视为过期

// 定义插件主类，作为模块装配层，统一协调各功能目录。
class ObsidianNenePlugin extends obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.dataStore = new pluginData.PluginDataStore(this); // 管理整份插件数据及旧结构迁移
    this.pluginSettingsStore = new pluginSettings.PluginSettingsStore(this); // 管理插件级功能开关
    this.fileMarkerStore = new fileMarker.FileMarkerStore(this); // 管理文件标记业务数据
    this.pluginListEnhancer = new pluginListEnhancerModule.PluginListEnhancer(this); // 管理旧设置页增强逻辑
    this.anchorGraphLinkEnhancer = new graphViewEnhancerModule.AnchorGraphLinkEnhancer(this); // 管理关系图谱 HTML 内部链接增强逻辑
    this.commandUriEnhancerStore = new commandUriEnhancerModule.CommandUriEnhancerStore(this); // 管理命令&URI增强模块配置与右键菜单目标缓存
    this.commandUriEnhancerService = new commandUriEnhancerModule.CommandUriEnhancerService(this); // 管理命令&URI增强命令执行逻辑
    this.commandUriRuntime = new commandUriEnhancerModule.CommandUriRuntime(this); // 管理 goto-plugin URI 协议跳转逻辑
    this.openWithCommandRuntime = new commandUriEnhancerModule.OpenWithCommandRuntime(this); // 管理文件速览命令注册与文件系统事件同步
    this.statusBarEnhancerStore = new statusBarEnhancerModule.StatusBarEnhancerStore(this); // 管理状态栏增强模块配置
    this.statusBarEnhancerRuntime = new statusBarEnhancerModule.StatusBarEnhancerRuntime(this); // 管理状态栏增强运行时
    this.organizerSpooler = null; // 状态栏元素管理 Spooler，在 onload 中初始化
    this.tabBarEnhancerStore = new tabBarEnhancerModule.TabBarEnhancerStore(this); // 管理标签栏增强模块配置
    this.tabBarEnhancerRuntime = new tabBarEnhancerModule.TabBarEnhancerRuntime(this); // 管理标签栏增强运行时
    this.menuCustomizerStore = new contextMenuEnhancerModule.MenuCustomizerStore(this); // 管理右键菜单自定义配置
    this.menuCustomizerRuntime = new contextMenuEnhancerModule.MenuCustomizerRuntime(this); // 管理右键菜单运行时拦截与重构
    this.snippetsStore = new statusBarEnhancerModule.SnippetsStore(this); // 管理 Snippets 管理模块配置
    this.snippetsRuntime = new statusBarEnhancerModule.SnippetsRuntime(this); // 管理 Snippets 运行时
    this.fileExplorerEnhancerStore = new fileExplorerEnhancerModule.FileExplorerEnhancerStore(this); // 管理文件资源管理器增强配置切片
    this.editorEnhancerStore = new editorEnhancerModule.EditorEnhancerStore(this); // 管理编辑增强模块配置
    this.editorEnhancerOverlay = new editorEnhancerModule.AutoCloseOverlay(this, this.editorEnhancerStore); // 管理 HTML 标签自动补全浮层（自建，替代官方 EditorSuggest）
    this.editorEnhancerRuntime = new editorEnhancerModule.EditorEnhancerRuntime(this, this.editorEnhancerStore, this.editorEnhancerOverlay); // 管理编辑增强运行时
    this.themeEnhancerStore = new themeEnhancerModule.ThemeEnhancerStore(this); // 管理主题增强模块配置
    this.themeEnhancerRuntime = new themeEnhancerModule.ThemeEnhancerRuntime(this, this.themeEnhancerStore); // 管理护眼模式下拉框注入与body class
    this._fileExplorerView = null; // 缓存文件资源管理器视图引用
    this._lastFocusedFile = null; // 文件列表中最后点击的文件/文件夹
    this._eyeToggleHistory = []; // 眼睛按钮停用的隐藏规则索引记录
    this.settingTab = null; // 设置页实例引用，供热更新恢复子界面时刷新页面
    this._trackedSettingsModals = new Map(); // 已打开设置子界面的登记表（modal -> 类型），供热更新统一关闭与恢复
  }

  // 登记一个已打开的设置子界面，供热更新重载时统一关闭与恢复。
  trackSettingsModal(modal, kind) {
    this._trackedSettingsModals.set(modal, kind);
  }

  // 关闭全部仍打开的子界面并把类型写入全局桥接，同时记录设置面板是否正显示本插件设置页，
  // 供重载后的新实例恢复，避免子界面失效与设置面板内容消失。
  captureAndCloseSettingsModals() {
    const pendingKinds = [];
    const bridge = window[HOT_RELOAD_BRIDGE_KEY] || { pending: [], timestamp: 0 };

    this._trackedSettingsModals.forEach((kind, modal) => {
      if (modal && modal.isOpen) {
        pendingKinds.push(kind);
        modal.close();
      }
    });
    this._trackedSettingsModals.clear();

    // 检测设置面板当前是否正显示本插件的设置页，若是则记录，
    // 重载后自动重新激活新设置页签，避免面板空白需要重新进入。
    // 注：app.setting 为半公开 API，异常时静默降级，不影响主流程。
    // 判断方式：直接比较激活页签与本插件页签实例（onunload 时 core 尚未移除页签，
    // 该对象比较最可靠）；再以页签容器“仍在文档中且可见”兜底，兼容 core 提前清空 activeTab 的情况。
    try {
      const setting = this.app.setting;
      const tabContainer = this.settingTab && this.settingTab.containerEl;
      const settingsTabWasActive = Boolean(
        setting &&
        ((setting.isOpen && setting.activeTab === this.settingTab) ||
          (tabContainer &&
            tabContainer.isConnected &&
            typeof tabContainer.isShown === 'function' &&
            tabContainer.isShown()))
      );
      if (settingsTabWasActive) {
        bridge.reopenSettingsTab = true;
      }
    } catch (error) {
      // 半公开 API 不可用时忽略，仅影响热更新恢复体验
    }

    // 无条件记录卸载时间戳：即便上述检测漏判，onload 侧仍可在时间窗口内
    // 通过“设置面板开着但激活页签已失效”的兜底条件恢复设置页
    bridge.pending.push(...pendingKinds);
    bridge.timestamp = Date.now();
    window[HOT_RELOAD_BRIDGE_KEY] = bridge;
  }

  // 恢复热更新重载前的状态：重新激活设置面板中的新设置页签，并用新插件实例重建已打开的子界面。
  restoreSettingsSubinterfaces() {
    const bridge = window[HOT_RELOAD_BRIDGE_KEY];
    if (!bridge) {
      return;
    }

    const pendingKinds = Array.isArray(bridge.pending) ? bridge.pending.slice() : [];
    const shouldReopenSettingsTab = bridge.reopenSettingsTab === true;
    const isRecentReload = Date.now() - (bridge.timestamp || 0) <= HOT_RELOAD_WINDOW_MS;
    delete window[HOT_RELOAD_BRIDGE_KEY];

    // 超过时间窗口视为手动禁用后重新启用，不自动恢复子界面
    if (!isRecentReload) {
      return;
    }

    // 读取旧实例轮询留存的设置页可见性：core 禁用插件时会先于 onunload 关闭设置面板，
    // 只能依据轮询留存的最后可见状态判断用户之前是否正显示本插件设置页
    const visibilityMarker = window[SETTINGS_TAB_VISIBILITY_KEY];
    const settingsTabWasVisible = Boolean(
      visibilityMarker &&
      visibilityMarker.visible === true &&
      Date.now() - (visibilityMarker.timestamp || 0) <= SETTINGS_TAB_FRESH_MS
    );
    delete window[SETTINGS_TAB_VISIBILITY_KEY];

    // 通道一：onunload 检测或可见性轮询确认用户正显示本插件设置页，
    // 延迟重试重新打开设置面板（core 已将其关闭）并激活新页签
    if ((shouldReopenSettingsTab || settingsTabWasVisible) && this.settingTab) {
      this.scheduleReopenSettingsTab(0);
    } else {
      // 通道二（兜底）：onunload 检测可能因旧版本代码或 core 行为差异而漏判，
      // 延迟检查设置面板是否处于“开着但激活页签已失效”的空白残留状态，若是则恢复本插件页签
      this.scheduleRecoverBlankSettingsTab(0);
    }

    pendingKinds.forEach((kind) => {
      try {
        settingsTabModule.reopenSettingsSubinterface(this, kind);
      } catch (error) {
        console.error('[ねね] 热更新恢复设置子界面失败', kind, error);
      }
    });
  }

  // 兜底恢复：热更新时间窗口内，若设置面板开着但当前激活页签已失效
  // （core 禁用插件时移除了本插件页签，面板残留空白），则自动激活本插件新设置页签。
  // 若用户正正常浏览其他设置页（激活页签有效且可见），则不打扰。
  scheduleRecoverBlankSettingsTab(attempt) {
    const self = this;
    const maxAttempts = 6; // 最多重试次数
    const retryIntervalMs = 100; // 基础重试间隔（毫秒），随次数递增

    setTimeout(() => {
      try {
        const setting = self.app.setting;
        if (!setting || !setting.isOpen) {
          return; // 设置面板未打开，无需恢复
        }
        const activeTab = setting.activeTab;
        const activeTabVisible = Boolean(
          activeTab &&
          activeTab.containerEl &&
          activeTab.containerEl.isConnected &&
          typeof activeTab.containerEl.isShown === 'function' &&
          activeTab.containerEl.isShown()
        );
        if (activeTabVisible) {
          return; // 用户正正常浏览某个设置页，不打扰
        }
        // 面板处于空白残留状态：激活本插件新设置页签
        self.scheduleReopenSettingsTab(0);
      } catch (error) {
        // 半公开 API 异常时按失败处理，进入重试
        if (attempt < maxAttempts) {
          self.scheduleRecoverBlankSettingsTab(attempt + 1);
        }
      }
    }, retryIntervalMs * (attempt + 1));
  }

  // 启动设置页可见性轮询：把“设置面板当前是否正显示本插件设置页”实时记录到 window。
  // 背景：core 禁用插件时会先于 onunload 关闭设置面板，onunload 中已读取不到真实状态，
  // 只能依靠轮询留存的最后可见状态，供热更新后的新实例决定是否重新打开设置面板。
  startSettingsTabVisibilityTracking() {
    const self = this;
    self.registerInterval(
      window.setInterval(() => {
        try {
          const tabContainer = self.settingTab && self.settingTab.containerEl;
          const visible = Boolean(
            tabContainer &&
            tabContainer.isConnected &&
            typeof tabContainer.isShown === 'function' &&
            tabContainer.isShown()
          );
          window[SETTINGS_TAB_VISIBILITY_KEY] = { visible: visible, timestamp: Date.now() };
        } catch (error) {
          // 半公开 API 异常时忽略本轮轮询
        }
      }, SETTINGS_TAB_POLL_MS)
    );
  }

  // 延迟重试重新激活设置面板中的本插件设置页签。
  // 说明：core 的 enablePlugin 在插件 onload 完成后才完成设置页签登记，
  // 且禁用插件时 core 可能直接关闭整个设置面板；此方法按固定间隔重试数次：
  // 若设置面板已被关闭则先重新打开，再优先用 openTabById 激活页签，
  // 该半公开方法不存在时降级为 openTab(页签实例)；全部重试仍失败则输出警告，
  // 不影响插件主流程。
  scheduleReopenSettingsTab(attempt) {
    const self = this;
    const maxAttempts = 6; // 最多重试次数
    const retryIntervalMs = 100; // 每次重试间隔（毫秒）

    setTimeout(() => {
      let reopened = false;
      try {
        const setting = self.app.setting;
        if (!setting) {
          return; // 设置对象不存在时重试无意义，直接放弃
        }
        // 设置面板若被 core 在禁用插件时关闭，先重新打开再激活页签。
        // 注意：core 关闭面板时可能未重置 isOpen，因此以面板 DOM 是否仍在文档中为准
        const modalElement = setting.modalEl || setting.containerEl;
        const modalInDom = Boolean(modalElement && modalElement.isConnected);
        if (!modalInDom) {
          setting.open();
        }
        if (typeof setting.openTabById === 'function') {
          reopened = Boolean(setting.openTabById(self.manifest.id));
        } else if (typeof setting.openTab === 'function' && self.settingTab) {
          setting.openTab(self.settingTab);
          reopened = true;
        }
        // 激活后当前页签已是本插件新页签，视为成功（兼容 openTabById 无返回值）
        if (!reopened && setting.activeTab === self.settingTab) {
          reopened = true;
        }
        // 最终校验：面板 DOM 确实在文档中且当前页签是本插件新页签，避免 core 状态误报假成功
        const modalElementAfter = setting.modalEl || setting.containerEl;
        reopened = Boolean(
          reopened &&
          modalElementAfter &&
          modalElementAfter.isConnected &&
          setting.activeTab === self.settingTab
        );
      } catch (error) {
        // 半公开 API 异常时按失败处理，进入重试
      }
      if (!reopened && attempt < maxAttempts) {
        self.scheduleReopenSettingsTab(attempt + 1);
      } else if (!reopened) {
        console.warn('[ねね] 热更新恢复设置面板失败：设置页签尚未就绪');
      }
    }, retryIntervalMs);
  }

  // 暴露只读设置访问入口，兼容后续模块对当前配置的读取。
  get settings() {
    return this.dataStore.getData();
  }

  // 暴露文件资源管理器增强模块设置，供 runtime 直接读写。
  get fileExplorerEnhancerSettings() {
    return this.fileExplorerEnhancerStore.getSettings();
  }

  // 插件加载时执行初始化逻辑。
  async onload() {
    console.log('Loading obsidian-nene-plugin');

    await this.dataStore.load(); // 先加载整份插件数据并迁移旧结构
    this.pluginSettingsStore.load(this.dataStore.getFeatures()); // 将插件级功能开关注入设置仓库
    this.fileMarkerStore.load(this.dataStore.getFileMarkerData()); // 将文件标记切片挂载到业务仓库
    this.menuCustomizerStore.load(this.dataStore.getMenuCustomizerData()); // 将右键菜单配置切片挂载到业务仓库
    this.commandUriEnhancerStore.load(this.dataStore.getCommandUriEnhancerData()); // 将命令&URI增强配置切片挂载到业务仓库
    this.openWithCommandRuntime.reload(); // 按配置注册全部文件速览命令
    if (this.isCommandUriEnhancerEnabled()) {
      this.openWithCommandRuntime.validateAllCommands(); // 模块启用时核查全部命令有效性，标记失效命令
    }
    this.statusBarEnhancerStore.load(this.dataStore.getStatusBarEnhancerData()); // 将状态栏增强配置切片挂载到业务仓库
    this.tabBarEnhancerStore.load(this.dataStore.getTabBarEnhancerData()); // 将标签栏增强配置切片挂载到业务仓库
    this.snippetsStore.load(); // 从状态栏增强配置中提取 snippets 切片
    this.fileExplorerEnhancerStore.load(this.dataStore.getFileExplorerEnhancerData()); // 将文件资源管理器增强配置切片挂载到业务仓库
    this.editorEnhancerStore.load(this.dataStore.getEditorEnhancerData()); // 将编辑增强配置切片挂载到业务仓库
    this.themeEnhancerStore.load(this.dataStore.getThemeEnhancerData()); // 将主题增强配置切片挂载到业务仓库
    this.initializeOrganizerSpooler(); // 初始化状态栏元素管理 Spooler
    await this.fileMarkerStore.pruneMissingMarks(); // 清理已经不存在的文件标记

    this.setupFileMarkerView();
    this.setupFileMenu();
    this.setupEditorMenu();
    this.setupStatusBarEnhancerEvents();
    this.setupTabBarEnhancerEvents();
    this.setupVaultEvents();
    this.setupOpenWithCommandEvents();
    this.setupCommandEntries();
    this.setupLayoutEvents();
    this.commandUriRuntime.registerProtocolHandlers(); // 注册 goto-plugin 与 open 扩展 URI 协议处理器，随插件卸载自动清理
    this.setupAnchorGraphEvents();
    this.setupFileExplorerEnhancer(); // 装配文件资源管理器增强（缓存右键目标 + 注册命令 + 布局监听）
    this.editorEnhancerRuntime.registerCommands(); // 无条件注册编辑增强命令
    this.settingTab = new settingsTabModule.ObsidianNenePluginSettingTab(this.app, this);
    this.addSettingTab(this.settingTab);
    // 启动设置页可见性轮询，把可见状态实时写入 window，供热更新重载后的新实例恢复设置面板
    this.startSettingsTabVisibilityTracking();
    // 热更新重载后恢复此前已打开的设置子界面，保证开发过程中弹窗随新代码刷新
    this.restoreSettingsSubinterfaces();

    this.pluginListEnhancer.start();
    this.syncFileMarkerFeatureState();
    this.syncAnchorGraphEnhancerState();
    this.syncStatusBarEnhancerState();
    this.syncTabBarEnhancerState();
    this.syncFileExplorerEnhancerState();
    this.syncMenuCustomizerState();
    this.syncEditorEnhancerState();
    this.syncThemeEnhancerState();
  }

  // 插件卸载时清理动态资源和已打开视图。
  onunload() {
    console.log('Unloading obsidian-nene-plugin');
    // 关闭已打开的全部设置子界面并记录类型，供热更新后的新实例自动恢复
    this.captureAndCloseSettingsModals();
    this.pluginListEnhancer.stop();
    this.anchorGraphLinkEnhancer.stop();
    this.statusBarEnhancerRuntime.stop();
    this.snippetsRuntime.stop();
    if (this.organizerSpooler) {
      this.organizerSpooler.stop();
    }
    this.tabBarEnhancerRuntime.stop();
    this.menuCustomizerRuntime.stop();
    this.fileExplorerEnhancerUnload();
    this.editorEnhancerRuntime.stop();
    this.editorEnhancerOverlay.destroy();
    this.themeEnhancerRuntime.stop();

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
        this.commandUriEnhancerStore.rememberMenuTarget(file);
        // 菜单关闭时清空右键菜单目标，使目标生命周期与菜单生命周期保持一致
        menu.onClose(() => {
          this.commandUriEnhancerStore.clearRecentMenuTarget();
        });
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
        this.statusBarEnhancerRuntime.renderTimestamps(file);
      })
    );

    this.registerEvent(
      this.app.vault.on('rename', (file) => {
        if (file instanceof obsidian.TFile && file === this.app.workspace.getActiveFile()) {
          this.statusBarEnhancerRuntime.renderFilePath(file);
          this.statusBarEnhancerRuntime.renderTimestamps(file);
        }
      })
    );

    // 文件保存后仅刷新最后修改时间，避免高频事件下重复渲染全部状态栏项。
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (file instanceof obsidian.TFile && file === this.app.workspace.getActiveFile()) {
          this.statusBarEnhancerRuntime.renderLastModifiedTimestamp(file);
        }
      })
    );
  }

  // 注册标签栏增强所需的滚轮监听，布局就绪后为全部窗口挂载，并跟踪弹出窗口的开关。
  setupTabBarEnhancerEvents() {
    this.app.workspace.onLayoutReady(() => {
      this.tabBarEnhancerRuntime.registerWheelHandlersForExistingWindows();

      this.registerEvent(
        this.app.workspace.on('window-open', (workspaceWindow) => {
          this.tabBarEnhancerRuntime.registerWheelHandler(workspaceWindow.win);
        })
      );

      this.registerEvent(
        this.app.workspace.on('window-close', (workspaceWindow) => {
          this.tabBarEnhancerRuntime.unregisterWheelHandler(workspaceWindow.win);
        })
      );
    });
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

  // 注册文件速览命令所需的文件系统事件：重命名与删除时按配置开关同步命令。
  setupOpenWithCommandEvents() {
    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) => {
        this.openWithCommandRuntime.handleFileRename(file, oldPath);
      })
    );

    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        this.openWithCommandRuntime.handleFileDelete(file);
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
        await this.commandUriEnhancerService.copyVaultPathFromCommand();
      }
    });

    this.addCommand({
      id: 'copy-full-path',
      name: '复制当前目标的完整路径',
      callback: async () => {
        await this.commandUriEnhancerService.copyFullPathFromCommand();
      }
    });

    this.addCommand({
      id: 'copy-uri-link',
      name: '复制当前目标的URI链接',
      callback: async () => {
        await this.commandUriEnhancerService.copyUriLinkFromCommand();
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

  // 返回文件资源管理器增强模块是否已启用。
  isFileExplorerEnhancerEnabled() {
    return this.pluginSettingsStore.isFileExplorerEnhancerEnabled();
  }

  // 返回右键菜单自定义模块当前是否被用户启用。
  isMenuCustomizerEnabled() {
    return this.pluginSettingsStore.isMenuCustomizerEnabled();
  }

  // 返回命令&URI增强模块当前是否被用户启用。
  isCommandUriEnhancerEnabled() {
    return this.pluginSettingsStore.isCommandUriEnhancerEnabled();
  }

  // 返回状态栏增强模块当前是否被用户启用。
  isStatusBarEnhancerEnabled() {
    return this.pluginSettingsStore.isStatusBarEnhancerEnabled();
  }

  // 返回标签栏增强模块当前是否被用户启用。
  isTabBarEnhancerEnabled() {
    return this.pluginSettingsStore.isTabBarEnhancerEnabled();
  }

  // 返回编辑增强模块当前是否被用户启用。
  isEditorEnhancerEnabled() {
    return this.pluginSettingsStore.isEditorEnhancerEnabled();
  }

  // 返回主题增强模块当前是否被用户启用。
  isThemeEnhancerEnabled() {
    return this.pluginSettingsStore.isThemeEnhancerEnabled();
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
      commandUriEnhancerEnabled: this.isCommandUriEnhancerEnabled(),
      commandUriEnhancerTrailingSlashEnabled: this.commandUriEnhancerStore.getSettings().addTrailingSlashToFolders === true,
      statusBarEnhancerEnabled: this.isStatusBarEnhancerEnabled(),
      statusBarEnhancerShowFileName: this.statusBarEnhancerStore.getSettings().showFileName === true,
      statusBarEnhancerShowIcons: this.statusBarEnhancerStore.getSettings().showIcons === true,
      statusBarEnhancerCopyAbsolutePath: this.statusBarEnhancerStore.getSettings().copyAbsolutePath !== false,
      statusBarEnhancerLastModifiedEnabled: this.statusBarEnhancerStore.getSettings().lastModifiedEnabled !== false,
      statusBarEnhancerLastModifiedPrepend: this.statusBarEnhancerStore.getSettings().lastModifiedPrepend,
      statusBarEnhancerLastModifiedTimestampFormat: this.statusBarEnhancerStore.getSettings().lastModifiedTimestampFormat,
      statusBarEnhancerCreatedEnabled: this.statusBarEnhancerStore.getSettings().createdEnabled === true,
      statusBarEnhancerCreatedPrepend: this.statusBarEnhancerStore.getSettings().createdPrepend,
      statusBarEnhancerCreatedTimestampFormat: this.statusBarEnhancerStore.getSettings().createdTimestampFormat,
      statusBarEnhancerCycleOnClick: this.statusBarEnhancerStore.getSettings().cycleOnClickEnabled !== false,
      statusBarEnhancerOrganizerElementCount: Object.keys(this.statusBarEnhancerStore.getOrganizerElements()).length,
      tabBarEnhancerEnabled: this.isTabBarEnhancerEnabled(),
      tabBarEnhancerTopBarWheel: this.tabBarEnhancerStore.getSettings().topBarWheelTabSwitch === true,
      tabBarEnhancerSkipCssHiddenTabs: this.tabBarEnhancerStore.getSettings().skipCssHiddenTabs !== false,
      tabBarEnhancerSkipUnloadedPluginTabs: this.tabBarEnhancerStore.getSettings().skipUnloadedPluginTabs !== false,
      tabBarEnhancerDebug: this.tabBarEnhancerStore.getSettings().debug === true,
      fileExplorerEnhancerEnabled: this.isFileExplorerEnhancerEnabled(),
      fileExplorerEnhancerPinFilterCount: (this.fileExplorerEnhancerStore.getSettings().pinFilters.paths || []).length,
      fileExplorerEnhancerHideFilterCount: (this.fileExplorerEnhancerStore.getSettings().hideFilters.paths || []).length,
      editorEnhancerEnabled: this.isEditorEnhancerEnabled(),
      editorEnhancerAutoCompleteEnabled: this.editorEnhancerStore.getSettings().autoCompleteEnabled !== false,
      editorEnhancerPasteAutoCloseEnabled: this.editorEnhancerStore.getSettings().enablePasteAutoClose === true,
      themeEnhancerEnabled: this.isThemeEnhancerEnabled(),
      themeEnhancerEyeProtection: this.isThemeEnhancerEnabled()
        ? this.themeEnhancerStore.getSettings().eyeProtection
        : false,
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

  // 更新命令&URI增强模块开关。
  async updateCommandUriEnhancerEnabled(enabled) {
    const result = await this.pluginSettingsStore.setCommandUriEnhancerEnabled(enabled);
    if (enabled) {
      this.openWithCommandRuntime.validateAllCommands(); // 模块启用时立即核查全部命令有效性
    }
    return result;
  }

  // 更新命令&URI增强模块的文件夹末尾斜杠配置。
  async updateCommandUriEnhancerTrailingSlashEnabled(enabled) {
    return this.commandUriEnhancerStore.setAddTrailingSlashToFolders(enabled);
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

  // 更新状态栏增强的“显示最后修改时间”配置，并立即刷新状态栏。
  async updateStatusBarEnhancerLastModifiedEnabled(enabled) {
    const nextValue = await this.statusBarEnhancerStore.setLastModifiedEnabled(enabled);
    this.syncStatusBarEnhancerState();
    return nextValue;
  }

  // 更新状态栏增强的最后修改时间前缀，并立即刷新状态栏。
  async updateStatusBarEnhancerLastModifiedPrepend(text) {
    const nextValue = await this.statusBarEnhancerStore.setLastModifiedPrepend(text);
    this.syncStatusBarEnhancerState();
    return nextValue;
  }

  // 更新状态栏增强的最后修改时间格式，并立即刷新状态栏。
  async updateStatusBarEnhancerLastModifiedTimestampFormat(format) {
    const nextValue = await this.statusBarEnhancerStore.setLastModifiedTimestampFormat(format);
    this.syncStatusBarEnhancerState();
    return nextValue;
  }

  // 更新状态栏增强的“显示创建时间”配置，并立即刷新状态栏。
  async updateStatusBarEnhancerCreatedEnabled(enabled) {
    const nextValue = await this.statusBarEnhancerStore.setCreatedEnabled(enabled);
    this.syncStatusBarEnhancerState();
    return nextValue;
  }

  // 更新状态栏增强的创建时间前缀，并立即刷新状态栏。
  async updateStatusBarEnhancerCreatedPrepend(text) {
    const nextValue = await this.statusBarEnhancerStore.setCreatedPrepend(text);
    this.syncStatusBarEnhancerState();
    return nextValue;
  }

  // 更新状态栏增强的创建时间格式，并立即刷新状态栏。
  async updateStatusBarEnhancerCreatedTimestampFormat(format) {
    const nextValue = await this.statusBarEnhancerStore.setCreatedTimestampFormat(format);
    this.syncStatusBarEnhancerState();
    return nextValue;
  }

  // 更新状态栏增强的“点击循环显示”配置，并立即同步运行时设置。
  async updateStatusBarEnhancerCycleOnClickEnabled(enabled) {
    const nextValue = await this.statusBarEnhancerStore.setCycleOnClickEnabled(enabled);
    this.syncStatusBarEnhancerState();
    return nextValue;
  }

  /* ------------------------------ */
  /* 状态栏元素管理代理 */
  /* ------------------------------ */

  // 初始化状态栏元素管理 Spooler，查找 .status-bar 容器并创建监听器。
  initializeOrganizerSpooler() {
    var statusBar = document.getElementsByClassName('status-bar')[0];
    if (!statusBar) {
      console.warn('[ねね] 未找到状态栏容器，状态栏元素管理不可用');
      return;
    }

    var self = this;
    this.organizerSpooler = new statusBarEnhancerModule.OrganizerSpooler(
      statusBar,
      function () {
        return self.statusBarEnhancerStore.getOrganizerElements();
      },
      function () {
        // 排序修复完成后的回调
      },
      function (allElements) {
        // 自动发现新元素后，立即写入配置文件跨界面持久化
        self.statusBarEnhancerStore.setOrganizerElements(allElements);
      }
    );
  }

  // 返回 .status-bar 容器 DOM 元素。
  getStatusBarElement() {
    return document.getElementsByClassName('status-bar')[0] || null;
  }

  // 返回当前 organizer 元素状态映射表。
  getOrganizerSettings() {
    return this.statusBarEnhancerStore.getOrganizerElements();
  }

  // 保存 organizer 元素状态映射表。
  async setOrganizerElementStatus(elements) {
    return this.statusBarEnhancerStore.setOrganizerElements(elements);
  }

  // 返回 organizer Spooler 实例。
  getOrganizerSpooler() {
    return this.organizerSpooler;
  }

  // 返回已删除的孤儿条目 ID 列表。
  getOrganizerDeletedIds() {
    return this.statusBarEnhancerStore.getDeletedIds();
  }

  // 保存已删除的孤儿条目 ID 列表。
  async setOrganizerDeletedIds(ids) {
    return this.statusBarEnhancerStore.setDeletedIds(ids);
  }

  // 更新标签栏增强模块开关，并立即同步实验性 class 的挂载状态。
  async updateTabBarEnhancerEnabled(enabled) {
    const nextEnabled = await this.pluginSettingsStore.setTabBarEnhancerEnabled(enabled);
    this.syncTabBarEnhancerState();
    return nextEnabled;
  }

  // 更新标签栏增强的“空白标签区滚轮切换”配置，并立即同步实验性 class。
  async updateTabBarEnhancerTopBarWheel(enabled) {
    const nextValue = await this.tabBarEnhancerStore.setTopBarWheelTabSwitch(enabled);
    this.syncTabBarEnhancerState();
    return nextValue;
  }

  // 更新标签栏增强的“跳过 CSS 隐藏的标签”配置，并立即重载运行时设置。
  async updateTabBarEnhancerSkipCssHiddenTabs(enabled) {
    const nextValue = await this.tabBarEnhancerStore.setSkipCssHiddenTabs(enabled);
    this.syncTabBarEnhancerState();
    return nextValue;
  }

  // 更新标签栏增强的“跳过未加载插件的标签”配置，并立即重载运行时设置。
  async updateTabBarEnhancerSkipUnloadedPluginTabs(enabled) {
    const nextValue = await this.tabBarEnhancerStore.setSkipUnloadedPluginTabs(enabled);
    this.syncTabBarEnhancerState();
    return nextValue;
  }

  // 更新标签栏增强的“调试模式”配置，并立即重载运行时设置。
  async updateTabBarEnhancerDebug(enabled) {
    const nextValue = await this.tabBarEnhancerStore.setDebug(enabled);
    this.syncTabBarEnhancerState();
    return nextValue;
  }

  // 更新文件资源管理器增强模块开关，并立即同步启停状态。
  async updateFileExplorerEnhancerEnabled(enabled) {
    const nextEnabled = await this.pluginSettingsStore.setFileExplorerEnhancerEnabled(enabled);
    this.syncFileExplorerEnhancerState();
    return nextEnabled;
  }

  // 更新编辑增强模块开关，并立即同步运行时状态。
  async updateEditorEnhancerEnabled(enabled) {
    const nextEnabled = await this.pluginSettingsStore.setEditorEnhancerEnabled(enabled);
    this.syncEditorEnhancerState();
    return nextEnabled;
  }

  // 更新编辑增强模块的排除标签列表。
  async updateEditorEnhancerExcludedTags(value) {
    return this.editorEnhancerStore.setExcludedTags(value);
  }

  // 更新编辑增强模块的自动补全后光标位置。
  async updateEditorEnhancerCursorPosition(value) {
    return this.editorEnhancerStore.setCursorPosition(value);
  }

  // 更新编辑增强模块的"忽略代码块"配置。
  async updateEditorEnhancerIgnoreInCodeBlocks(enabled) {
    return this.editorEnhancerStore.setIgnoreInCodeBlocks(enabled);
  }

  // 更新编辑增强模块的"忽略行内代码"配置。
  async updateEditorEnhancerIgnoreInlineCode(enabled) {
    return this.editorEnhancerStore.setIgnoreInlineCode(enabled);
  }

  // 更新编辑增强模块的"粘贴行为的自动补全"配置（默认关闭）。
  async updateEditorEnhancerEnablePasteAutoClose(enabled) {
    return this.editorEnhancerStore.setEnablePasteAutoClose(enabled);
  }

  // 更新状态栏按钮控制的自动补全开关，并同步浮层启停与按钮图标。
  async updateEditorEnhancerAutoCompleteEnabled(enabled) {
    const nextValue = await this.editorEnhancerStore.setAutoCompleteEnabled(enabled);
    if (this.isEditorEnhancerEnabled()) {
      if (nextValue) {
        this.editorEnhancerOverlay.enable();
      } else {
        this.editorEnhancerOverlay.disable();
      }
      this.editorEnhancerRuntime.refreshStatusBarIcon();
    }
    return nextValue;
  }

  // 更新主题增强模块开关，并立即同步运行时状态。
  async updateThemeEnhancerEnabled(enabled) {
    const nextEnabled = await this.pluginSettingsStore.setThemeEnhancerEnabled(enabled);
    this.syncThemeEnhancerState();
    return nextEnabled;
  }

  // 更新主题增强模块的护眼模式（子功能）开关，仅模块启用时生效。
  async updateThemeEnhancerEyeProtection(enabled) {
    if (!this.isThemeEnhancerEnabled()) {
      return false;
    }

    return this.themeEnhancerRuntime.setEyeProtection(enabled);
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
  // 始终先执行 stop() 清理可能残留的旧会话合成链接数据（如上次崩溃退出未正常卸载），再按需启动。
  syncAnchorGraphEnhancerState() {
    this.anchorGraphLinkEnhancer.stop();

    if (this.isAnchorGraphEnabled()) {
      this.anchorGraphLinkEnhancer.start();
    }
  }

  // 根据当前设置同步状态栏增强模块的启停状态，并在启用时刷新当前活动文件路径。
  syncStatusBarEnhancerState() {
    this.statusBarEnhancerRuntime.load(this.statusBarEnhancerStore.getSettings());
    this.snippetsRuntime.load(this.snippetsStore.getSettings());

    if (this.isStatusBarEnhancerEnabled()) {
      this.statusBarEnhancerRuntime.start();
      this.snippetsRuntime.start();
      if (this.organizerSpooler) {
        this.organizerSpooler.start();
      }
    } else {
      this.statusBarEnhancerRuntime.stop();
      this.snippetsRuntime.stop();
      if (this.organizerSpooler) {
        this.organizerSpooler.stop();
      }
    }
  }

  // 根据当前设置同步标签栏增强模块的启停状态，并挂载或移除实验性 class。
  syncTabBarEnhancerState() {
    this.tabBarEnhancerRuntime.load(this.tabBarEnhancerStore.getSettings());

    if (this.isTabBarEnhancerEnabled()) {
      this.tabBarEnhancerRuntime.start();
      return;
    }

    this.tabBarEnhancerRuntime.stop();
  }

  // 装配文件资源管理器增强：缓存右键目标、注册命令、监听布局变化挂载 monkey-patch。
  setupFileExplorerEnhancer() {
    var self = this;

    // 缓存最近右键目标，供置顶/隐藏命令使用
    self.registerEvent(
      self.app.workspace.on('file-menu', function (menu, file) {
        self.fileExplorerEnhancerStore._lastMenuTarget = file;
      })
    );

    // 无条件注册命令，确保菜单自定义模块可在文件资源管理器就绪前探测到命令
    fileExplorerEnhancerModule.addCommands(self);

    // 布局变化时重试挂载：文件资源管理器可能在插件 onload 之后才就绪
    self.registerEvent(
      self.app.workspace.on('layout-change', function () {
        if (self.isFileExplorerEnhancerEnabled() && !self._fileExplorerView) {
          self.attachFileExplorerPatch();
        }
      })
    );
  }

  // 挂载文件资源管理器增强的 monkey-patch，在视图就绪时调用。
  attachFileExplorerPatch() {
    var self = this;

    var fileExplorerLeaves = self.app.workspace.getLeavesOfType('file-explorer');
    if (fileExplorerLeaves.length > 0 && !self._fileExplorerView) {
      var view = fileExplorerLeaves[0].view;
      self._fileExplorerView = view;
      self.fileExplorerEnhancerStore.load(self.dataStore.getFileExplorerEnhancerData());
      fileExplorerEnhancerModule.patchFileExplorerFolder(self, view);
      fileExplorerEnhancerModule.addOnRename(self);
      fileExplorerEnhancerModule.addOnDelete(self);
      fileExplorerEnhancerModule.setupFileExplorerFocusTracking(self);
      fileExplorerEnhancerModule.injectEyeButtons(self, view);
      view.requestSort();
    }
  }

  // 卸载文件资源管理器增强的 monkey-patch，恢复原始排序。
  fileExplorerEnhancerUnload(skipCommands) {
    if (!this._fileExplorerView) return;

    fileExplorerEnhancerModule.unloadFileExplorerEnhancer(this, this._fileExplorerView);
    fileExplorerEnhancerModule.removeEyeButtons();
    this._fileExplorerView.requestSort();
    // 清除缓存引用，确保下次启用时能重新挂载
    this._fileExplorerView = null;
    this._lastFocusedFile = null;
    this._eyeToggleHistory = [];
    this._eyeRevealedPaths = null;
    this._eyeFocusTrackingBound = false;
    this._eyeLeafChangeBound = false;
    this._eyeToggleBtn = null;
    this._eyeRestoreBtn = null;
  }

  // 根据当前设置同步文件资源管理器增强模块的启停状态。
  syncFileExplorerEnhancerState() {
    if (this.isFileExplorerEnhancerEnabled()) {
      this.attachFileExplorerPatch();
      return;
    }

    this.fileExplorerEnhancerUnload(true);
  }

  // 根据当前设置同步编辑增强模块的启停状态。
  // 模块启用时：启动状态栏按钮与粘贴监听，并按"自动补全开关"决定是否激活浮层；
  // 模块禁用时：停止运行时并停用浮层。
  syncEditorEnhancerState() {
    this.editorEnhancerRuntime.load(this.editorEnhancerStore.getSettings());

    if (this.isEditorEnhancerEnabled()) {
      this.editorEnhancerRuntime.start();
      if (this.editorEnhancerStore.getSettings().autoCompleteEnabled) {
        this.editorEnhancerOverlay.enable();
      } else {
        this.editorEnhancerOverlay.disable();
      }
      return;
    }

    this.editorEnhancerRuntime.stop();
    this.editorEnhancerOverlay.disable();
  }

  // 根据当前设置同步主题增强模块的启停状态。
  syncThemeEnhancerState() {
    this.themeEnhancerRuntime.load(this.themeEnhancerStore.getSettings());

    if (this.isThemeEnhancerEnabled()) {
      this.themeEnhancerRuntime.start();
      return;
    }

    this.themeEnhancerRuntime.stop();
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
    this.commandUriEnhancerStore.load(this.dataStore.getCommandUriEnhancerData());
    this.openWithCommandRuntime.reload(); // 重载文件速览命令注册表
    if (this.isCommandUriEnhancerEnabled()) {
      this.openWithCommandRuntime.validateAllCommands(); // 导入/重置后核查全部命令有效性
    }
    this.statusBarEnhancerStore.load(this.dataStore.getStatusBarEnhancerData());
    this.tabBarEnhancerStore.load(this.dataStore.getTabBarEnhancerData());
    this.fileExplorerEnhancerStore.load(this.dataStore.getFileExplorerEnhancerData());
    this.editorEnhancerStore.load(this.dataStore.getEditorEnhancerData());
    this.themeEnhancerStore.load(this.dataStore.getThemeEnhancerData());
    this.snippetsStore.load();

    this.syncFileMarkerFeatureState();
    this.refreshAllFileMarkerViews();
    this.syncAnchorGraphEnhancerState();
    this.syncStatusBarEnhancerState();
    this.syncTabBarEnhancerState();
    this.syncMenuCustomizerState();
    this.syncEditorEnhancerState();
    this.syncThemeEnhancerState();

    if (this.isAnchorGraphEnabled()) {
      await this.refreshAnchorGraphLinks(false);
    }
  }
}

module.exports = ObsidianNenePlugin; // 导出插件主类，供 Obsidian 加载
