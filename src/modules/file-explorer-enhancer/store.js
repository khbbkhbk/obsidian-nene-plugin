'use strict';

var constants = require('./constants');
var obsidian = require('obsidian');

// 定义文件资源管理器增强模块的数据仓库，负责读写路径过滤器配置。
// 同时管理预编译缓存、STRICT 模式索引 Map 和文件状态缓存。
class FileExplorerEnhancerStore {
  constructor(plugin) {
    this.plugin = plugin;
    this.settings = this.normalizeSettings();
    // STRICT 模式 O(1) 查找 Map
    this.strictHidePaths = new Map();
    this.strictPinPaths = new Map();
    // 文件状态缓存：key = filePath, value = { pinned, hidden, version }
    this.fileStateCache = new Map();
    this.cacheVersion = 0;
  }

  // 挂载插件数据仓库中的文件资源管理器增强切片，并预编译匹配器 + 构建 STRICT Map。
  // 首次加载时回写磁盘，确保旧数据补全 position 等归一化字段。
  load(settings) {
    this.settings = this.normalizeSettings(settings);
    this.plugin.dataStore.setFileExplorerEnhancerData(this.settings);
    this.plugin.dataStore.saveFileExplorerEnhancerData(this.settings);
    this.compileAllFilters();
    this.buildStrictMaps();
    this.invalidateCache();
  }

  // 将最新数据同步到插件级数据仓库并持久化，之后重建编译缓存。
  async save() {
    this.settings = this.normalizeSettings(this.settings);
    this.compileAllFilters();
    this.buildStrictMaps();
    this.invalidateCache();
    await this.plugin.dataStore.saveFileExplorerEnhancerData(this.settings);
  }

  // 返回完整配置对象。
  getSettings() {
    return this.settings;
  }

  // --------------------------------
  //  预编译优化：将 RegExp / wildcard 编译从「每次匹配」转移到「filter 变更时」
  // --------------------------------

  // 遍历所有激活的过滤器规则，预编译 _regex 与 _matcher 并挂载到 filter 对象上。
  // 无效 filter 或 STRICT 模式（走 Map 查找）不编译。
  compileAllFilters() {
    var allPathFilters = this.settings.pinFilters.paths.concat(this.settings.hideFilters.paths);
    for (var i = 0; i < allPathFilters.length; i++) {
      var f = allPathFilters[i];
      // 清除上一次编译残留
      delete f._regex;
      delete f._matcher;

      if (!f.active || !f.pattern) continue;
      if (f.patternType === 'STRICT') continue; // STRICT 走 Map 短路，无需编译

      if (f.patternType === 'REGEX') {
        try {
          f._regex = new RegExp(f.pattern);
        } catch (e) {
          f._regex = null;
        }
      } else if (f.patternType === 'WILDCARD') {
        try {
          var wcmatch = require('wildcard-match');
          var fn = (typeof wcmatch === 'function') ? wcmatch : wcmatch.default;
          f._matcher = fn(f.pattern);
        } catch (e) {
          f._matcher = null;
        }
      }
    }
  }

  // --------------------------------
  //  STRICT 模式 Map 化：将精确匹配路径存入 Set，实现 O(1) 查找
  // --------------------------------

  buildStrictMaps() {
    this.strictHidePaths.clear();
    this.strictPinPaths.clear();

    var hidePaths = this.settings.hideFilters.paths;
    for (var i = 0; i < hidePaths.length; i++) {
      var f = hidePaths[i];
      if (f.active && f.patternType === 'STRICT' && f.pattern) {
        this.strictHidePaths.set(f.pattern, true);
      }
    }

    var pinPaths = this.settings.pinFilters.paths;
    for (var j = 0; j < pinPaths.length; j++) {
      var f2 = pinPaths[j];
      if (f2.active && f2.patternType === 'STRICT' && f2.pattern) {
        this.strictPinPaths.set(f2.pattern, true);
      }
    }
  }

  // O(1) 检查文件是否被 STRICT 模式隐藏。
  checkStrictHide(file) {
    return this.strictHidePaths.has(file.path)
      || this.strictHidePaths.has(file.path.replace(/\.md$/g, ''))
      || this.strictHidePaths.has(file.basename || file.name);
  }

  // O(1) 检查文件是否被 STRICT 模式置顶。
  checkStrictPin(file) {
    return this.strictPinPaths.has(file.path)
      || this.strictPinPaths.has(file.path.replace(/\.md$/g, ''))
      || this.strictPinPaths.has(file.basename || file.name);
  }

  // --------------------------------
  //  文件状态缓存：避免每次全量重算
  // --------------------------------

  // 使全部缓存失效，settings 变更或 filter 变更时调用。
  invalidateCache() {
    this.cacheVersion++;
    this.fileStateCache.clear();
  }

  // 获取文件状态（pinned / hidden），优先读缓存。
  getFileState(file) {
    var cached = this.fileStateCache.get(file.path);
    if (cached && cached.version === this.cacheVersion) {
      return cached;
    }

    var state = {
      pinned: false,
      hidden: false,
      version: this.cacheVersion
    };

    if (this.settings.hideFilters.active) {
      state.hidden = this.computeShouldHide(file);
    }
    if (this.settings.pinFilters.active) {
      state.pinned = this.computeShouldPin(file);
    }

    this.fileStateCache.set(file.path, state);
    return state;
  }

  // 计算文件是否需要隐藏（不走缓存）。
  computeShouldHide(file) {
    if (this.checkStrictHide(file)) return true;

    return this.settings.hideFilters.paths.some(function (f) {
      if (!f.active || f.patternType === 'STRICT') return false;
      return quickCheckPathFilter(f, file);
    });
  }

  // 计算文件是否需要置顶（不走缓存）。
  computeShouldPin(file) {
    if (this.checkStrictPin(file)) return true;

    return this.settings.pinFilters.paths.some(function (f) {
      if (!f.active || f.patternType === 'STRICT') return false;
      return quickCheckPathFilter(f, file);
    });
  }

  // 更新单个文件的状态缓存，rename / delete / metadata change 时调用。
  updateFileState(file) {
    this.fileStateCache.delete(file.path);
    this.fileStateCache.delete(file.path.replace(/\.md$/g, ''));
  }

  // --------------------------------
  //  归一化
  // --------------------------------

  normalizeSettings(data) {
    var source = (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};
    var defaults = constants.DEFAULT_FILE_EXPLORER_ENHANCER_SETTINGS;

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

  normalizePathFilters(filters) {
    return filters
      .filter(function (f) { return f && typeof f === 'object' && !Array.isArray(f); })
      .map(function (f, idx) {
        return {
          name: typeof f.name === 'string' ? f.name : '',
          active: f.active !== false,
          type: ['FILES', 'DIRECTORIES', 'FILES_AND_DIRECTORIES'].indexOf(f.type) !== -1
            ? f.type
            : 'FILES_AND_DIRECTORIES',
          pattern: typeof f.pattern === 'string' ? f.pattern : '',
          patternType: ['REGEX', 'WILDCARD', 'STRICT'].indexOf(f.patternType) !== -1
            ? f.patternType
            : 'STRICT',
          position: (typeof f.position === 'number' && !isNaN(f.position)) ? f.position : idx
        };
      })
      .sort(function (a, b) { return a.position - b.position; });
  }
}

// -----------------------------------------------
//  轻量版 checkPathFilter —— 使用预编译 _regex / _matcher
//  不检查 STRICT（STRICT 已在调用方通过 Map 短路）
// -----------------------------------------------

function quickCheckPathFilter(filter, file) {
  if (!filter.active || filter.pattern === '') return false;

  if (filter.type === 'FILES' && file instanceof obsidian.TFolder) return false;
  if (filter.type === 'DIRECTORIES' && file instanceof obsidian.TFile) return false;

  if (filter.patternType === 'REGEX') {
    if (!filter._regex) return false;
    return filter._regex.test(file.path)
      || filter._regex.test(file.path.replace(/\.md$/g, ''))
      || filter._regex.test(file.basename || file.name);
  } else if (filter.patternType === 'WILDCARD') {
    if (!filter._matcher) return false;
    return filter._matcher(file.path)
      || filter._matcher(file.path.replace(/\.md$/g, ''))
      || filter._matcher(file.basename || file.name);
  }

  return false;
}

module.exports = {
  FileExplorerEnhancerStore: FileExplorerEnhancerStore,
  quickCheckPathFilter: quickCheckPathFilter
};
