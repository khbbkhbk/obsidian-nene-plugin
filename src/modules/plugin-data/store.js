'use strict';

var featureConfigManagerModule = require('./feature-config-manager');
var constants = require('./constants');

// 定义插件级数据仓库，统一负责整份数据的切片读取、归一化和落盘。
class PluginDataStore {
  constructor(plugin) {
    this.plugin = plugin; // 保存插件实例，便于访问 loadData 和 saveData
    this.featureConfigManager = new featureConfigManagerModule.FeatureConfigManager(plugin); // 管理独立功能配置文件
    this.data = this.normalizeCoreData(); // 初始化核心配置，避免首次读取时报空
    this.featureData = this.normalizeFeatureData(); // 初始化各模块数据缓存，便于统一对外暴露
  }

  // 加载本地持久化数据，并在需要时将旧版模块切片迁移到独立配置文件。
  async load() {
    const rawData = await this.plugin.loadData();
    this.data = this.normalizeCoreData(rawData);
    await this.featureConfigManager.initialize();

    this.featureData.fileMarker = await this.loadFeatureSlice('fileMarker', rawData?.fileMarker);
    this.featureData.anchorGraph = await this.loadFeatureSlice('anchorGraph', rawData?.anchorGraph);
    this.featureData.menuCustomizer = await this.loadFeatureSlice('menuCustomizer', rawData?.menuCustomizer);
    this.featureData.commandUriEnhancer = await this.loadFeatureSlice('commandUriEnhancer', rawData?.commandUriEnhancer);
    this.featureData.statusBarEnhancer = await this.loadFeatureSlice('statusBarEnhancer', rawData?.statusBarEnhancer);
    this.featureData.tabBarEnhancer = await this.loadFeatureSlice('tabBarEnhancer', rawData?.tabBarEnhancer);
    this.featureData.fileExplorerEnhancer = await this.loadFeatureSlice('fileExplorerEnhancer', rawData?.fileExplorerEnhancer);
    this.featureData.editorEnhancer = await this.loadFeatureSlice('editorEnhancer', rawData?.editorEnhancer);
    this.featureData.themeEnhancer = await this.loadFeatureSlice('themeEnhancer', rawData?.themeEnhancer);

    if (this.hasLegacyFeatureSlices(rawData)) {
      await this.save();
    }
  }

  // 保存当前核心配置到 data.json，本方法不再负责落盘模块业务数据。
  async save() {
    this.data = this.normalizeCoreData(this.data);
    await this.plugin.saveData(this.data);
  }

  // 返回整份插件数据快照，兼容上层仍以 settings 读取模块切片的场景。
  getData() {
    return this.normalizeData(Object.assign({}, this.data, this.featureData));
  }

  // 返回插件级功能开关切片。
  getFeatures() {
    return this.data.features;
  }

  // 更新插件级功能开关切片。
  setFeatures(features) {
    this.data.features = this.normalizeFeatures(features);
  }

  // 返回文件标记数据切片。
  getFileMarkerData() {
    return this.featureData.fileMarker;
  }

  // 更新文件标记数据切片缓存。
  setFileMarkerData(fileMarkerData) {
    this.featureData.fileMarker = this.normalizeFileMarkerData(fileMarkerData);
  }

  // 返回关系图谱增强的独立配置切片。
  getAnchorGraphData() {
    return this.featureData.anchorGraph;
  }

  // 更新关系图谱增强的独立配置切片缓存。
  setAnchorGraphData(anchorGraphData) {
    this.featureData.anchorGraph = this.normalizeAnchorGraphData(anchorGraphData);
  }

  // 返回右键菜单自定义的独立配置切片。
  getMenuCustomizerData() {
    return this.featureData.menuCustomizer;
  }

  // 更新右键菜单自定义的独立配置切片缓存。
  setMenuCustomizerData(menuCustomizerData) {
    this.featureData.menuCustomizer = this.normalizeMenuCustomizerData(menuCustomizerData);
  }

  // 返回命令&URI增强模块的独立配置切片。
  getCommandUriEnhancerData() {
    return this.featureData.commandUriEnhancer;
  }

  // 更新命令&URI增强模块的独立配置切片缓存。
  setCommandUriEnhancerData(commandUriEnhancerData) {
    this.featureData.commandUriEnhancer = this.normalizeCommandUriEnhancerData(commandUriEnhancerData);
  }

  // 返回状态栏增强模块的独立配置切片。
  getStatusBarEnhancerData() {
    return this.featureData.statusBarEnhancer;
  }

  // 更新状态栏增强模块的独立配置切片缓存。
  setStatusBarEnhancerData(statusBarEnhancerData) {
    this.featureData.statusBarEnhancer = this.normalizeStatusBarEnhancerData(statusBarEnhancerData);
  }

  // 返回标签栏增强模块的独立配置切片。
  getTabBarEnhancerData() {
    return this.featureData.tabBarEnhancer;
  }

  // 更新标签栏增强模块的独立配置切片缓存。
  setTabBarEnhancerData(tabBarEnhancerData) {
    this.featureData.tabBarEnhancer = this.normalizeTabBarEnhancerData(tabBarEnhancerData);
  }

  // 返回文件资源管理器增强模块的独立配置切片。
  getFileExplorerEnhancerData() {
    return this.featureData.fileExplorerEnhancer;
  }

  // 更新文件资源管理器增强模块的独立配置切片缓存。
  setFileExplorerEnhancerData(fileExplorerEnhancerData) {
    this.featureData.fileExplorerEnhancer = this.normalizeFileExplorerEnhancerData(fileExplorerEnhancerData);
  }

  // 返回编辑增强模块的独立配置切片。
  getEditorEnhancerData() {
    return this.featureData.editorEnhancer;
  }

  // 更新编辑增强模块的独立配置切片缓存。
  setEditorEnhancerData(editorEnhancerData) {
    this.featureData.editorEnhancer = this.normalizeEditorEnhancerData(editorEnhancerData);
  }

  // 返回主题增强模块的独立配置切片。
  getThemeEnhancerData() {
    return this.featureData.themeEnhancer;
  }
  // 更新主题增强模块的独立配置切片缓存。
  setThemeEnhancerData(themeEnhancerData) {
    this.featureData.themeEnhancer = this.normalizeThemeEnhancerData(themeEnhancerData);
  }
  // 保存主题增强模块数据到独立配置文件。
  async saveThemeEnhancerData(themeEnhancerData) {
    this.setThemeEnhancerData(themeEnhancerData);
    await this.featureConfigManager.save('themeEnhancer', this.featureData.themeEnhancer);
  }

  // 保存文件标记功能数据到独立配置文件。
  async saveFileMarkerData(fileMarkerData) {
    this.setFileMarkerData(fileMarkerData);
    await this.featureConfigManager.save('fileMarker', this.featureData.fileMarker);
  }

  // 保存关系图谱增强功能数据到独立配置文件。
  async saveAnchorGraphData(anchorGraphData) {
    this.setAnchorGraphData(anchorGraphData);
    await this.featureConfigManager.save('anchorGraph', this.featureData.anchorGraph);
  }

  // 保存右键菜单自定义功能数据到独立配置文件。
  async saveMenuCustomizerData(menuCustomizerData) {
    this.setMenuCustomizerData(menuCustomizerData);
    await this.featureConfigManager.save('menuCustomizer', this.featureData.menuCustomizer);
  }

  // 保存命令&URI增强模块数据到独立配置文件。
  async saveCommandUriEnhancerData(commandUriEnhancerData) {
    this.setCommandUriEnhancerData(commandUriEnhancerData);
    await this.featureConfigManager.save('commandUriEnhancer', this.featureData.commandUriEnhancer);
  }

  // 保存状态栏增强模块数据到独立配置文件。
  async saveStatusBarEnhancerData(statusBarEnhancerData) {
    this.setStatusBarEnhancerData(statusBarEnhancerData);
    await this.featureConfigManager.save('statusBarEnhancer', this.featureData.statusBarEnhancer);
  }

  // 保存标签栏增强模块数据到独立配置文件。
  async saveTabBarEnhancerData(tabBarEnhancerData) {
    this.setTabBarEnhancerData(tabBarEnhancerData);
    await this.featureConfigManager.save('tabBarEnhancer', this.featureData.tabBarEnhancer);
  }

  // 保存编辑增强模块数据到独立配置文件。
  async saveEditorEnhancerData(editorEnhancerData) {
    this.setEditorEnhancerData(editorEnhancerData);
    await this.featureConfigManager.save('editorEnhancer', this.featureData.editorEnhancer);
  }

  // 保存文件资源管理器增强模块数据到独立配置文件。
  async saveFileExplorerEnhancerData(fileExplorerEnhancerData) {
    this.setFileExplorerEnhancerData(fileExplorerEnhancerData);
    await this.featureConfigManager.save('fileExplorerEnhancer', this.featureData.fileExplorerEnhancer);
  }

  // 将当前核心配置与全部模块配置一次性持久化，供导入和全量重置复用。
  async saveAll() {
    await this.save();
    await this.featureConfigManager.save('fileMarker', this.featureData.fileMarker);
    await this.featureConfigManager.save('anchorGraph', this.featureData.anchorGraph);
    await this.featureConfigManager.save('menuCustomizer', this.featureData.menuCustomizer);
    await this.featureConfigManager.save('commandUriEnhancer', this.featureData.commandUriEnhancer);
    await this.featureConfigManager.save('statusBarEnhancer', this.featureData.statusBarEnhancer);
    await this.featureConfigManager.save('tabBarEnhancer', this.featureData.tabBarEnhancer);
    await this.featureConfigManager.save('editorEnhancer', this.featureData.editorEnhancer);
    await this.featureConfigManager.save('themeEnhancer', this.featureData.themeEnhancer);
  }

  // 返回当前插件管理的配置文件状态摘要，供设置页展示配置文件入口。
  async getConfigFileStatuses() {
    const adapter = this.plugin.app.vault.adapter;
    const coreConfigPath = this.getCoreConfigPath();
    const fileMarkerPath = this.featureConfigManager.getFeatureConfigPath('fileMarker');
    const anchorGraphPath = this.featureConfigManager.getFeatureConfigPath('anchorGraph');
    const menuCustomizerPath = this.featureConfigManager.getFeatureConfigPath('menuCustomizer');
    const commandUriEnhancerPath = this.featureConfigManager.getFeatureConfigPath('commandUriEnhancer');
    const statusBarEnhancerPath = this.featureConfigManager.getFeatureConfigPath('statusBarEnhancer');
    const tabBarEnhancerPath = this.featureConfigManager.getFeatureConfigPath('tabBarEnhancer');
    const fileExplorerEnhancerPath = this.featureConfigManager.getFeatureConfigPath('fileExplorerEnhancer');
    const editorEnhancerPath = this.featureConfigManager.getFeatureConfigPath('editorEnhancer');
    const themeEnhancerPath = this.featureConfigManager.getFeatureConfigPath('themeEnhancer');

    return {
      directoryPath: this.featureConfigManager.getConfigDirectoryPath(),
      exportDirectoryPath: this.featureConfigManager.getExportDirectoryPath(),
      core: {
        key: 'core',
        name: '核心配置',
        path: coreConfigPath,
        exists: await adapter.exists(coreConfigPath),
        summary: `保存 ${Object.keys(this.data.features || {}).length} 个功能开关分组`
      },
      fileMarker: {
        key: 'fileMarker',
        name: '文件标记配置',
        path: fileMarkerPath,
        exists: await this.featureConfigManager.exists('fileMarker'),
        summary: `当前含 ${Object.keys(this.featureData.fileMarker.marks || {}).length} 条标记、${(this.featureData.fileMarker.groups || []).length} 个分组`
      },
      anchorGraph: {
        key: 'anchorGraph',
        name: '关系图谱配置',
        path: anchorGraphPath,
        exists: await this.featureConfigManager.exists('anchorGraph'),
        summary: `当前含 ${Object.keys(this.featureData.anchorGraph.noteOverrides || {}).length} 条笔记覆盖规则`
      },
      menuCustomizer: {
        key: 'menuCustomizer',
        name: '右键菜单配置',
        path: menuCustomizerPath,
        exists: await this.featureConfigManager.exists('menuCustomizer'),
        summary: `当前含 ${Object.values(this.featureData.menuCustomizer.menus || {}).reduce((count, menuConfig) => count + (Array.isArray(menuConfig.groups) ? menuConfig.groups.length : 0), 0)} 个分组`
      },
      commandUriEnhancer: {
        key: 'commandUriEnhancer',
        name: '命令&URI增强配置',
        path: commandUriEnhancerPath,
        exists: await this.featureConfigManager.exists('commandUriEnhancer'),
        summary: `文件夹末尾补 /：${this.featureData.commandUriEnhancer.addTrailingSlashToFolders === true ? '已开启' : '已关闭'}`
      },
      statusBarEnhancer: {
        key: 'statusBarEnhancer',
        name: '状态栏增强配置',
        path: statusBarEnhancerPath,
        exists: await this.featureConfigManager.exists('statusBarEnhancer'),
        summary: `显示文件名：${this.featureData.statusBarEnhancer.showFileName === true ? '已开启' : '已关闭'}，显示图标：${this.featureData.statusBarEnhancer.showIcons === true ? '已开启' : '已关闭'}，复制绝对路径：${this.featureData.statusBarEnhancer.copyAbsolutePath !== false ? '已开启' : '已关闭'}，最后修改时间：${this.featureData.statusBarEnhancer.lastModifiedEnabled !== false ? '已开启' : '已关闭'}，创建时间：${this.featureData.statusBarEnhancer.createdEnabled === true ? '已开启' : '已关闭'}`
      },
      tabBarEnhancer: {
        key: 'tabBarEnhancer',
        name: '标签栏增强配置',
        path: tabBarEnhancerPath,
        exists: await this.featureConfigManager.exists('tabBarEnhancer'),
        summary: `空白区滚轮切换：${this.featureData.tabBarEnhancer.topBarWheelTabSwitch === true ? '已开启' : '已关闭'}，跳过隐藏标签：${this.featureData.tabBarEnhancer.skipCssHiddenTabs !== false ? '已开启' : '已关闭'}，跳过未加载插件标签：${this.featureData.tabBarEnhancer.skipUnloadedPluginTabs !== false ? '已开启' : '已关闭'}`
      },
      fileExplorerEnhancer: {
        key: 'fileExplorerEnhancer',
        name: '文件资源管理器增强配置',
        path: fileExplorerEnhancerPath,
        exists: await this.featureConfigManager.exists('fileExplorerEnhancer'),
        summary: `置顶路径规则：${(this.featureData.fileExplorerEnhancer.pinFilters.paths || []).length} 条，隐藏路径规则：${(this.featureData.fileExplorerEnhancer.hideFilters.paths || []).length} 条`
      },
      editorEnhancer: {
        key: 'editorEnhancer',
        name: '编辑增强配置',
        path: editorEnhancerPath,
        exists: await this.featureConfigManager.exists('editorEnhancer'),
        summary: `自动补全：${this.featureData.editorEnhancer.autoCompleteEnabled !== false ? '开' : '关'}，粘贴自动补全：${this.featureData.editorEnhancer.enablePasteAutoClose === true ? '开' : '关'}`
      },
      themeEnhancer: {
        key: 'themeEnhancer',
        name: '主题增强配置',
        path: themeEnhancerPath,
        exists: await this.featureConfigManager.exists('themeEnhancer'),
        summary: '护眼模式：' + (this.featureData.themeEnhancer.eyeProtection === true ? '已开启' : '已关闭')
      }
    };
  }

  // 获取指定功能模块的配置切片。
  getFeatureDataSlice(featureKey) {
    return this.featureData[featureKey];
  }

  // 更新指定功能模块的配置切片缓存。
  setFeatureData(featureKey, featureData) {
    this.featureData[featureKey] = this.normalizeFeatureSlice(featureKey, featureData);
  }

  // 保存指定功能模块数据到独立配置文件。
  async saveFeatureData(featureKey, featureData) {
    this.setFeatureData(featureKey, featureData);
    await this.featureConfigManager.save(featureKey, this.featureData[featureKey]);
  }

  // 导出指定功能模块的配置快照，供管理弹窗复制备份与迁移。
  exportFeatureData(featureKey) {
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      featureKey,
      data: this.getFeatureDataSlice(featureKey)
    };
  }

  // 导入指定功能模块的配置快照，校验后立即持久化。
  async importFeatureData(featureKey, bundle) {
    const source = this.isPlainObject(bundle) ? bundle : {};
    const incomingData = this.isPlainObject(source.data) ? source.data : source;
    const normalized = this.normalizeFeatureSlice(featureKey, incomingData);
    await this.saveFeatureData(featureKey, normalized);
    return normalized;
  }

  // 将指定功能模块的配置快照导出为独立备份文件，并返回写入结果。
  async exportFeatureDataToFile(featureKey) {
    const exportFileName = this.buildFeatureExportFileName(featureKey);
    const exportText = JSON.stringify(this.exportFeatureData(featureKey), null, 2);
    const filePath = await this.featureConfigManager.writeExportFile(exportFileName, exportText);

    return {
      fileName: exportFileName,
      filePath
    };
  }

  // 生成包含时间戳的模块级导出文件名，避免连续导出时相互覆盖。
  buildFeatureExportFileName(featureKey) {
    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      '-',
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0')
    ].join('');

    return `${featureKey}-export-${timestamp}.json`;
  }

  // 导出完整配置快照，便于设置页复制、备份和迁移。
  exportConfigurationBundle() {
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      coreData: this.normalizeCoreData(this.data),
      featureData: this.normalizeFeatureData(this.featureData)
    };
  }

  // 将当前配置导出为独立备份文件，便于用户保留多个版本快照。
  async exportConfigurationBundleToFile() {
    const exportFileName = this.buildExportFileName();
    const exportText = JSON.stringify(this.exportConfigurationBundle(), null, 2);
    const filePath = await this.featureConfigManager.writeExportFile(exportFileName, exportText);

    return {
      fileName: exportFileName,
      filePath
    };
  }

  // 导入完整配置快照，兼容当前导出格式与旧版顶层切片结构。
  async importConfigurationBundle(bundle) {
    const normalizedBundle = this.normalizeImportedBundle(bundle);
    this.data = normalizedBundle.coreData;
    this.featureData = normalizedBundle.featureData;
    await this.saveAll();
    return this.getData();
  }

  // 将指定功能配置恢复为默认值并立即持久化。
  async resetFeatureData(featureKey) {
    const defaultFeatureData = this.normalizeFeatureSlice(featureKey, constants.DEFAULT_FEATURE_DATA[featureKey]);

    if (featureKey === 'fileMarker') {
      this.featureData.fileMarker = defaultFeatureData;
    } else if (featureKey === 'anchorGraph') {
      this.featureData.anchorGraph = defaultFeatureData;
    } else if (featureKey === 'menuCustomizer') {
      this.featureData.menuCustomizer = defaultFeatureData;
    } else if (featureKey === 'commandUriEnhancer') {
      this.featureData.commandUriEnhancer = defaultFeatureData;
    } else if (featureKey === 'statusBarEnhancer') {
      this.featureData.statusBarEnhancer = defaultFeatureData;
    } else if (featureKey === 'tabBarEnhancer') {
      this.featureData.tabBarEnhancer = defaultFeatureData;
    } else if (featureKey === 'fileExplorerEnhancer') {
      this.featureData.fileExplorerEnhancer = defaultFeatureData;
    } else if (featureKey === 'editorEnhancer') {
      this.featureData.editorEnhancer = defaultFeatureData;
    } else if (featureKey === 'themeEnhancer') {
      this.featureData.themeEnhancer = defaultFeatureData;
    }

    await this.featureConfigManager.save(featureKey, defaultFeatureData);
    return defaultFeatureData;
  }

  // 将整个插件配置恢复为默认值，并同步覆盖所有配置文件。
  async resetAllData() {
    this.data = this.normalizeCoreData(constants.DEFAULT_PLUGIN_DATA);
    this.featureData = this.normalizeFeatureData(constants.DEFAULT_FEATURE_DATA);
    await this.saveAll();
    return this.getData();
  }

  // 归一化整份插件数据快照，便于统一输出当前内存中的完整状态。
  normalizeData(data) {
    const source = this.isPlainObject(data) ? data : {};
    const normalizedCoreData = this.normalizeCoreData(source);

    return Object.assign({}, normalizedCoreData, {
      fileMarker: this.normalizeFileMarkerData(source.fileMarker),
      anchorGraph: this.normalizeAnchorGraphData(source.anchorGraph),
      menuCustomizer: this.normalizeMenuCustomizerData(source.menuCustomizer),
      commandUriEnhancer: this.normalizeCommandUriEnhancerData(source.commandUriEnhancer),
      statusBarEnhancer: this.normalizeStatusBarEnhancerData(source.statusBarEnhancer),
      tabBarEnhancer: this.normalizeTabBarEnhancerData(source.tabBarEnhancer),
      fileExplorerEnhancer: this.normalizeFileExplorerEnhancerData(source.fileExplorerEnhancer),
      editorEnhancer: this.normalizeEditorEnhancerData(source.editorEnhancer),
      themeEnhancer: this.normalizeThemeEnhancerData(source.themeEnhancer)
    });
  }

  // 归一化核心配置，只保留 data.json 应继续存储的字段，并移除旧版功能切片。
  normalizeCoreData(data) {
    const source = this.isPlainObject(data) ? data : {};
    const normalizedCoreData = Object.assign({}, source);

    delete normalizedCoreData.fileMarker;
    delete normalizedCoreData.anchorGraph;
    delete normalizedCoreData.menuCustomizer;
    delete normalizedCoreData.commandUriEnhancer;
    delete normalizedCoreData.statusBarEnhancer;
    delete normalizedCoreData.tabBarEnhancer;
    delete normalizedCoreData.fileExplorerEnhancer;
    delete normalizedCoreData.editorEnhancer;
    delete normalizedCoreData.themeEnhancer;

    normalizedCoreData.features = this.normalizeFeatures(source.features);
    return normalizedCoreData;
  }

  // 归一化功能配置缓存，避免首次读取时报空。
  normalizeFeatureData(featureData) {
    const source = this.isPlainObject(featureData) ? featureData : {};

    return {
      fileMarker: this.normalizeFileMarkerData(source.fileMarker),
      anchorGraph: this.normalizeAnchorGraphData(source.anchorGraph),
      menuCustomizer: this.normalizeMenuCustomizerData(source.menuCustomizer),
      commandUriEnhancer: this.normalizeCommandUriEnhancerData(source.commandUriEnhancer),
      statusBarEnhancer: this.normalizeStatusBarEnhancerData(source.statusBarEnhancer),
      tabBarEnhancer: this.normalizeTabBarEnhancerData(source.tabBarEnhancer),
      fileExplorerEnhancer: this.normalizeFileExplorerEnhancerData(source.fileExplorerEnhancer),
      editorEnhancer: this.normalizeEditorEnhancerData(source.editorEnhancer),
      themeEnhancer: this.normalizeThemeEnhancerData(source.themeEnhancer)
    };
  }

  // 归一化插件级功能开关结构。
  normalizeFeatures(features) {
    return {
      fileMarker: {
        enabled: features?.fileMarker?.enabled === true
      },
      anchorGraph: {
        enabled: features?.anchorGraph?.enabled === true
      },
      menuCustomizer: {
        enabled: features?.menuCustomizer?.enabled === true
      },
      commandUriEnhancer: {
        enabled: features?.commandUriEnhancer?.enabled === true
      },
      statusBarEnhancer: {
        enabled: features?.statusBarEnhancer?.enabled === true
      },
      tabBarEnhancer: {
        enabled: features?.tabBarEnhancer?.enabled === true
      },
      fileExplorerEnhancer: {
        enabled: features?.fileExplorerEnhancer?.enabled === true
      },
      editorEnhancer: {
        enabled: features?.editorEnhancer?.enabled === true
      },
      themeEnhancer: {
        enabled: features?.themeEnhancer?.enabled === true
      }
    };
  }

  // 归一化文件标记切片的顶层结构，具体业务字段由 file-marker 模块进一步收敛。
  normalizeFileMarkerData(fileMarkerData) {
    const source = this.isPlainObject(fileMarkerData) ? fileMarkerData : {};
    const defaultFileMarker = constants.DEFAULT_FEATURE_DATA.fileMarker;

    return Object.assign({}, source, {
      marks: source.marks && typeof source.marks === 'object' ? source.marks : defaultFileMarker.marks,
      groups: Array.isArray(source.groups) ? source.groups : defaultFileMarker.groups
    });
  }

  // 归一化关系图谱增强配置结构，保证旧数据迁移后能维持稳定形状。
  normalizeAnchorGraphData(anchorGraphData) {
    const source = this.isPlainObject(anchorGraphData) ? anchorGraphData : {};
    const defaultAnchorGraph = constants.DEFAULT_FEATURE_DATA.anchorGraph;
    const defaultSettings = this.isPlainObject(source.defaultSettings) ? source.defaultSettings : {};
    const noteOverrides = {};

    if (this.isPlainObject(source.noteOverrides)) {
      Object.entries(source.noteOverrides).forEach(([notePath, override]) => {
        if (!notePath || !this.isPlainObject(override)) return;

        noteOverrides[notePath] = Object.assign({}, override, {
          mode: typeof override.mode === 'string' && override.mode.trim()
            ? override.mode.trim()
            : 'inherit'
        });
      });
    }

    return Object.assign({}, source, {
      defaultSettings: Object.assign({}, defaultAnchorGraph.defaultSettings, defaultSettings, {
        htmlEnhancementEnabled: defaultSettings.htmlEnhancementEnabled !== false
      }),
      noteOverrides
    });
  }

  // 归一化右键菜单自定义配置结构，保证首次安装与旧数据迁移后形状稳定。
  normalizeMenuCustomizerData(menuCustomizerData) {
    const source = this.isPlainObject(menuCustomizerData) ? menuCustomizerData : {};
    const defaultMenuCustomizer = constants.DEFAULT_FEATURE_DATA.menuCustomizer;
    const normalizedMenus = {};

    Object.keys(defaultMenuCustomizer.menus || {}).forEach((menuType) => {
      const menuSource = this.isPlainObject(source.menus?.[menuType]) ? source.menus[menuType] : {};
      const defaultMenuConfig = defaultMenuCustomizer.menus[menuType];

      normalizedMenus[menuType] = {
        enabled: menuSource.enabled === true,
        groups: Array.isArray(menuSource.groups) ? menuSource.groups : defaultMenuConfig.groups,
        rootItems: Array.isArray(menuSource.rootItems) ? menuSource.rootItems : defaultMenuConfig.rootItems,
        commandOverrides: this.isPlainObject(menuSource.commandOverrides) ? menuSource.commandOverrides : defaultMenuConfig.commandOverrides,
        commandMappings: Array.isArray(menuSource.commandMappings) ? menuSource.commandMappings : defaultMenuConfig.commandMappings
      };
    });

    return {
      menus: normalizedMenus
    };
  }

  // 归一化命令&URI增强模块配置结构，保证首次安装与旧数据迁移后形状稳定。
  // 注意：此处仅以用户存储值判断，不得再与默认值（恒为 false）做与运算，
  // 否则开关会被恒等钳制为 false，导致"文件夹路径末尾补 /"无法持久化。
  // 同时补齐文件速览命令功能所需的打开位置、开关与命令/变量列表字段。
  normalizeCommandUriEnhancerData(commandUriEnhancerData) {
    const source = this.isPlainObject(commandUriEnhancerData) ? commandUriEnhancerData : {};
    const commandUriEnhancerConstants = require('../command-uri-enhancer/constants');
    const defaults = commandUriEnhancerConstants.DEFAULT_COMMAND_URI_ENHANCER_SETTINGS;
    const openFileInValues = Object.keys(commandUriEnhancerConstants.OPEN_FILE_IN_OPTIONS);

    return {
      addTrailingSlashToFolders: source.addTrailingSlashToFolders !== false,
      openNewTab: source.openNewTab === true,
      openFileIn: openFileInValues.indexOf(source.openFileIn) !== -1 ? source.openFileIn : defaults.openFileIn,
      deleteCommandWhenFileIsDeleted: source.deleteCommandWhenFileIsDeleted !== false,
      updateCommandsOnRename: source.updateCommandsOnRename !== false,
      commands: this.normalizeOpenWithCommands(source.commands),
      customVariables: Array.isArray(source.customVariables)
        ? this.normalizeOpenWithVariables(source.customVariables)
        : defaults.customVariables
    };
  }

  // 归一化文件速览命令列表，补齐 id 与缺失字段，保证命令配置形状稳定。
  normalizeOpenWithCommands(commands) {
    if (!Array.isArray(commands)) {
      return [];
    }
    const openFileInValues = Object.keys(require('../command-uri-enhancer/constants').OPEN_FILE_IN_OPTIONS);

    return commands
      .filter((command) => this.isPlainObject(command))
      .map((command) => ({
        id: typeof command.id === 'string' && command.id ? command.id : crypto.randomUUID(),
        name: typeof command.name === 'string' ? command.name : '',
        filePath: typeof command.filePath === 'string' ? command.filePath : '',
        openFileIn: openFileInValues.indexOf(command.openFileIn) !== -1 ? command.openFileIn : 'activeTab',
        isValid: command.isValid !== false
      }));
  }

  // 归一化自定义变量列表，校验类型取值。
  normalizeOpenWithVariables(variables) {
    return variables
      .filter((variable) => this.isPlainObject(variable))
      .map((variable) => ({
        name: typeof variable.name === 'string' ? variable.name : '',
        value: typeof variable.value === 'string' ? variable.value : '',
        type: variable.type === 'javascript' ? 'javascript' : 'string'
      }));
  }

  // 归一化状态栏增强模块配置结构，保证首次安装与旧数据迁移后形状稳定。
  normalizeStatusBarEnhancerData(statusBarEnhancerData) {
    const source = this.isPlainObject(statusBarEnhancerData) ? statusBarEnhancerData : {};
    const defaults = constants.DEFAULT_FEATURE_DATA.statusBarEnhancer;

    return {
      showFileName: source.showFileName === true,
      showIcons: source.showIcons === true,
      copyAbsolutePath: source.copyAbsolutePath !== false,
      lastModifiedEnabled: source.lastModifiedEnabled !== false,
      lastModifiedPrepend: typeof source.lastModifiedPrepend === 'string'
        ? source.lastModifiedPrepend
        : defaults.lastModifiedPrepend,
      lastModifiedTimestampFormat: typeof source.lastModifiedTimestampFormat === 'string' && source.lastModifiedTimestampFormat
        ? source.lastModifiedTimestampFormat
        : defaults.lastModifiedTimestampFormat,
      createdEnabled: source.createdEnabled === true,
      createdPrepend: typeof source.createdPrepend === 'string'
        ? source.createdPrepend
        : defaults.createdPrepend,
      createdTimestampFormat: typeof source.createdTimestampFormat === 'string' && source.createdTimestampFormat
        ? source.createdTimestampFormat
        : defaults.createdTimestampFormat,
      cycleOnClickEnabled: source.cycleOnClickEnabled !== false,
      organizer: this.isPlainObject(source.organizer) ? {
        elements: this.normalizeOrganizerElements(source.organizer.elements),
        deletedIds: Array.isArray(source.organizer.deletedIds)
          ? source.organizer.deletedIds.filter(function (id) { return typeof id === 'string'; })
          : []
      } : {
        elements: {},
        deletedIds: []
      },
      snippets: this.isPlainObject(source.snippets) ? source.snippets : {}
    };
  }

  // 归一化状态栏元素管理（organizer）的元素状态映射表。
  normalizeOrganizerElements(elements) {
    var source = this.isPlainObject(elements) ? elements : {};
    var result = {};

    Object.keys(source).forEach(function (id) {
      var status = source[id];
      if (typeof status !== 'object' || status === null) return;

      result[id] = {
        position: typeof status.position === 'number' ? status.position : 0,
        visible: status.visible !== false
      };
    });

    return result;
  }

  // 归一化标签栏增强模块配置结构，保证首次安装与旧数据迁移后形状稳定。
  normalizeTabBarEnhancerData(tabBarEnhancerData) {
    const source = this.isPlainObject(tabBarEnhancerData) ? tabBarEnhancerData : {};

    return {
      debug: source.debug === true,
      topBarWheelTabSwitch: source.topBarWheelTabSwitch === true,
      skipCssHiddenTabs: source.skipCssHiddenTabs !== false,
      skipUnloadedPluginTabs: source.skipUnloadedPluginTabs !== false
    };
  }

  // 归一化文件资源管理器增强配置结构，保证首次安装与旧数据迁移后形状稳定。
  normalizeFileExplorerEnhancerData(fileExplorerEnhancerData) {
    var source = this.isPlainObject(fileExplorerEnhancerData) ? fileExplorerEnhancerData : {};
    var defaults = require('../file-explorer-enhancer/constants').DEFAULT_FILE_EXPLORER_ENHANCER_SETTINGS;

    return {
      pinFilters: {
        active: source.pinFilters && source.pinFilters.active === true,
        paths: Array.isArray(source.pinFilters && source.pinFilters.paths)
          ? this.normalizePathFilters(source.pinFilters.paths)
          : defaults.pinFilters.paths
      },
      hideFilters: {
        active: source.hideFilters && source.hideFilters.active === true,
        paths: Array.isArray(source.hideFilters && source.hideFilters.paths)
          ? this.normalizePathFilters(source.hideFilters.paths)
          : defaults.hideFilters.paths
      }
    };
  }

  // 归一化编辑增强模块配置结构，保证首次安装与旧数据迁移后形状稳定。
  normalizeEditorEnhancerData(editorEnhancerData) {
    var source = this.isPlainObject(editorEnhancerData) ? editorEnhancerData : {};
    var defaults = constants.DEFAULT_FEATURE_DATA.editorEnhancer;

    return {
      excludedTags: typeof source.excludedTags === 'string' ? source.excludedTags : defaults.excludedTags,
      cursorPosition: source.cursorPosition === 'after' ? 'after' : 'between',
      ignoreInCodeBlocks: source.ignoreInCodeBlocks !== false,
      ignoreInlineCode: source.ignoreInlineCode !== false,
      enablePasteAutoClose: source.enablePasteAutoClose === true,
      autoCompleteEnabled: source.autoCompleteEnabled !== false
    };
  }

  // 归一化主题增强模块配置结构。
  normalizeThemeEnhancerData(themeEnhancerData) {
    var source = this.isPlainObject(themeEnhancerData) ? themeEnhancerData : {};
    return {
      eyeProtection: source.eyeProtection === true
    };
  }

  // 归一化路径过滤器数组，保证 position 等字段在持久化时不会丢失。
  normalizePathFilters(filters) {
    return filters
      .filter(function (f) { return f && typeof f === 'object' && !Array.isArray(f); })
      .map(function (f, idx) {
        return {
          name: typeof f.name === 'string' ? f.name : '',
          active: f.active !== false,
          type: ['FILES', 'DIRECTORIES'].indexOf(f.type) !== -1
            ? f.type
            : 'FILES',
          pattern: typeof f.pattern === 'string' ? f.pattern : '',
          patternType: ['REGEX', 'WILDCARD', 'STRICT'].indexOf(f.patternType) !== -1
            ? f.patternType
            : 'STRICT',
          position: (typeof f.position === 'number' && !isNaN(f.position)) ? f.position : idx
        };
      })
      .sort(function (a, b) { return a.position - b.position; });
  }

  // 加载单个功能切片，优先读取独立文件，缺失时自动迁移旧版 data.json 中的同名数据。
  async loadFeatureSlice(featureKey, legacyData) {
    const loadResult = await this.featureConfigManager.load(featureKey);
    if (loadResult.found && this.isPlainObject(loadResult.data)) {
      return this.normalizeFeatureSlice(featureKey, loadResult.data);
    }

    if (this.isPlainObject(legacyData)) {
      const normalizedLegacyData = this.normalizeFeatureSlice(featureKey, legacyData);
      await this.featureConfigManager.save(featureKey, normalizedLegacyData);
      return normalizedLegacyData;
    }

    const defaultFeatureData = this.normalizeFeatureSlice(featureKey, constants.DEFAULT_FEATURE_DATA[featureKey]);
    await this.featureConfigManager.save(featureKey, defaultFeatureData);

    return defaultFeatureData;
  }

  // 根据功能标识归一化对应模块的数据切片。
  normalizeFeatureSlice(featureKey, featureData) {
    if (featureKey === 'fileMarker') {
      return this.normalizeFileMarkerData(featureData);
    }

    if (featureKey === 'anchorGraph') {
      return this.normalizeAnchorGraphData(featureData);
    }

    if (featureKey === 'menuCustomizer') {
      return this.normalizeMenuCustomizerData(featureData);
    }

    if (featureKey === 'commandUriEnhancer') {
      return this.normalizeCommandUriEnhancerData(featureData);
    }

    if (featureKey === 'statusBarEnhancer') {
      return this.normalizeStatusBarEnhancerData(featureData);
    }

    if (featureKey === 'tabBarEnhancer') {
      return this.normalizeTabBarEnhancerData(featureData);
    }

    if (featureKey === 'fileExplorerEnhancer') {
      return this.normalizeFileExplorerEnhancerData(featureData);
    }

    if (featureKey === 'editorEnhancer') {
      return this.normalizeEditorEnhancerData(featureData);
    }

    if (featureKey === 'themeEnhancer') {
      return this.normalizeThemeEnhancerData(featureData);
    }

    return this.isPlainObject(featureData) ? featureData : {};
  }

  // 判断旧版 data.json 中是否仍残留需要迁移的模块切片。
  hasLegacyFeatureSlices(data) {
    const source = this.isPlainObject(data) ? data : {};
    return this.isPlainObject(source.fileMarker)
      || this.isPlainObject(source.anchorGraph)
      || this.isPlainObject(source.menuCustomizer)
      || this.isPlainObject(source.statusBarEnhancer)
      || this.isPlainObject(source.tabBarEnhancer)
      || this.isPlainObject(source.fileExplorerEnhancer)
      || this.isPlainObject(source.editorEnhancer);
  }

  // 返回 Obsidian 实际使用的核心配置文件路径，便于设置页展示。
  getCoreConfigPath() {
    return `${this.plugin.app.vault.configDir}/plugins/${this.plugin.manifest.id}/data.json`;
  }

  // 将导入数据统一归一化为当前插件使用的核心配置与模块配置结构。
  normalizeImportedBundle(bundle) {
    if (!this.isPlainObject(bundle)) {
      throw new Error('导入内容必须是 JSON 对象');
    }

    const hasSeparatedPayload = this.isPlainObject(bundle.coreData) || this.isPlainObject(bundle.featureData);
    const featureSource = hasSeparatedPayload
      ? Object.assign({}, bundle.featureData, {
        fileMarker: bundle.featureData?.fileMarker || bundle.fileMarker,
        anchorGraph: bundle.featureData?.anchorGraph || bundle.anchorGraph,
        menuCustomizer: bundle.featureData?.menuCustomizer || bundle.menuCustomizer,
        commandUriEnhancer: bundle.featureData?.commandUriEnhancer || bundle.commandUriEnhancer,
        statusBarEnhancer: bundle.featureData?.statusBarEnhancer || bundle.statusBarEnhancer,
        tabBarEnhancer: bundle.featureData?.tabBarEnhancer || bundle.tabBarEnhancer,
        fileExplorerEnhancer: bundle.featureData?.fileExplorerEnhancer || bundle.fileExplorerEnhancer,
        editorEnhancer: bundle.featureData?.editorEnhancer || bundle.editorEnhancer,
        themeEnhancer: bundle.featureData?.themeEnhancer || bundle.themeEnhancer
      })
      : bundle;

    const coreSource = hasSeparatedPayload
      ? Object.assign({}, bundle.coreData, {
        features: bundle.coreData?.features || bundle.features
      })
      : bundle;

    return {
      coreData: this.normalizeCoreData(coreSource),
      featureData: this.normalizeFeatureData(featureSource)
    };
  }

  // 判断当前值是否为普通对象，避免数组、空值等被误当成配置对象。
  isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  // 生成包含时间戳的导出文件名，避免连续导出时相互覆盖。
  buildExportFileName() {
    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      '-',
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0')
    ].join('');

    return `${this.plugin.manifest.id}-config-export-${timestamp}.json`;
  }
}

module.exports = {
  PluginDataStore
};
