'use strict';

var obsidian = require('obsidian');

const MIN_GRAPH_COMPATIBLE_API_VERSION = '1.4.16';
const STARTUP_FULL_REFRESH_DELAY = 1200;
const STRUCTURE_FULL_REFRESH_DELAY = 3000;
const FULL_REFRESH_BATCH_SIZE = 20;

// 为关系图谱补充 HTML 内部链接识别能力，将 a.internal-link 注入为合成正向链接。
class AnchorGraphLinkEnhancer {
  constructor(plugin) {
    this.plugin = plugin; // 保存插件实例，便于访问 metadataCache 和 vault
    this.syntheticResolvedLinks = {}; // 记录当前插件注入的关系边，便于刷新和卸载时精准回滚
    this.refreshTimer = null; // 保存防抖定时器，避免频繁全量扫描
    this.sourceRefreshTimer = null; // 保存编辑态单文件刷新定时器，避免输入过程中频繁重算
    this.pendingSourceRefresh = null; // 记录最近一次待处理的单文件刷新请求
    this.isRefreshing = false; // 标记当前是否正在执行刷新，避免并发写入 resolvedLinks
    this.pendingFullRefresh = false; // 在刷新过程中若再次请求刷新，则在本轮结束后补一次
    this.pendingNotice = false; // 合并多次手动刷新请求，保证最后一次仍会显示提示
    this.graphButtonObserver = null; // 监听关系图谱视图的 DOM 变化，按需补齐刷新按钮
    this.graphButtonProcessTimer = null; // 保存按钮注入的防抖定时器，避免重复扫描 DOM
    this.styleEl = null; // 保存图谱刷新按钮样式节点，便于卸载时清理
    this.stats = {
      sourceFileCount: 0,
      edgeCount: 0
    };
    this.isStarted = false; // 标记当前是否已完成模块启动，避免重复注册观察器和样式
    this.isCompatibleRuntime = false; // 标记当前运行环境是否允许启用图谱增强
    this.compatibilityWarningShown = false; // 避免重复弹出兼容性降级提示
    this.lastCompatibilityMessage = ''; // 保存最近一次兼容性降级原因，供设置页展示
  }

  // 启动增强器时执行一次全量构建，保证图谱立即可见。
  start() {
    if (!this.isFeatureEnabled()) {
      this.isStarted = false;
      this.isCompatibleRuntime = false;
      return;
    }

    if (this.isStarted) {
      this.processGraphRefreshButtons();
      return;
    }

    this.isCompatibleRuntime = this.ensureCompatibleRuntime(true);
    if (!this.isCompatibleRuntime) {
      return;
    }

    this.isStarted = true;
    this.addGraphRefreshButtonStyles();
    this.setupGraphRefreshButtonObserver();
    this.processGraphRefreshButtons();
    this.scheduleFullRefresh(STARTUP_FULL_REFRESH_DELAY);
  }

  // 停止增强器时回滚注入的关系边，避免影响其他插件或 Obsidian 原生索引。
  stop() {
    this.isStarted = false;
    this.isCompatibleRuntime = false;

    if (this.refreshTimer) {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (this.sourceRefreshTimer) {
      window.clearTimeout(this.sourceRefreshTimer);
      this.sourceRefreshTimer = null;
    }

    if (this.graphButtonProcessTimer) {
      window.clearTimeout(this.graphButtonProcessTimer);
      this.graphButtonProcessTimer = null;
    }

    if (this.graphButtonObserver) {
      this.graphButtonObserver.disconnect();
      this.graphButtonObserver = null;
    }

    if (this.styleEl) {
      this.styleEl.remove();
      this.styleEl = null;
    }

    this.pendingSourceRefresh = null;
    this.removeGraphRefreshButtons();
    this.clearSyntheticResolvedLinks();
  }

  // 返回当前已注入的关系图谱统计信息，供设置页展示。
  getStats() {
    return Object.assign({}, this.stats);
  }

  // 返回关系图谱增强的运行时状态，供设置页展示启用、降级与兼容性信息。
  getRuntimeStatus() {
    if (!this.isFeatureEnabled()) {
      return {
        state: 'disabled',
        message: '关系图谱 HTML 链接增强已在设置中关闭。'
      };
    }

    if (this.isCompatibleRuntime) {
      return {
        state: 'active',
        message: `关系图谱 HTML 链接增强已启用，兼容目标为 Obsidian ${MIN_GRAPH_COMPATIBLE_API_VERSION}+。`
      };
    }

    if (this.lastCompatibilityMessage) {
      return {
        state: 'degraded',
        message: this.lastCompatibilityMessage
      };
    }

    return {
      state: 'idle',
      message: '关系图谱 HTML 链接增强等待初始化。'
    };
  }

  // 返回默认的结构变化全量刷新延时，统一由主入口复用。
  getStructureRefreshDelay() {
    return STRUCTURE_FULL_REFRESH_DELAY;
  }

  // 计划一次全量刷新，在文件结构变化时重新解析全部 HTML 内部链接。
  scheduleFullRefresh(delay, showNotice) {
    if (!this.ensureCompatibleRuntime(showNotice)) return;

    if (showNotice) {
      this.pendingNotice = true;
    }

    if (this.refreshTimer) {
      window.clearTimeout(this.refreshTimer);
    }

    this.refreshTimer = window.setTimeout(async () => {
      this.refreshTimer = null;
      await this.refreshAll(this.pendingNotice);
    }, typeof delay === 'number' ? delay : 400);
  }

  // 在编辑器输入过程中按源文件做防抖刷新，减少“必须保存后才生效”的感知延迟。
  scheduleSourceRefresh(file, content, delay) {
    if (!this.ensureCompatibleRuntime(false)) return;
    if (!(file instanceof obsidian.TFile) || file.extension !== 'md') return;

    this.pendingSourceRefresh = {
      file,
      content
    };

    if (this.sourceRefreshTimer) {
      window.clearTimeout(this.sourceRefreshTimer);
    }

    this.sourceRefreshTimer = window.setTimeout(async () => {
      const pendingRefresh = this.pendingSourceRefresh;
      this.pendingSourceRefresh = null;
      this.sourceRefreshTimer = null;

      if (!pendingRefresh) return;
      await this.refreshSourceFile(pendingRefresh.file, pendingRefresh.content);
    }, typeof delay === 'number' ? delay : 240);
  }

  // 手动或启动时执行全量刷新，重建全部 a.internal-link 的关系边。
  async refreshAll(showNotice) {
    if (!this.ensureCompatibleRuntime(showNotice)) return;

    if (showNotice) {
      this.pendingNotice = true;
    }

    if (this.isRefreshing) {
      this.pendingFullRefresh = true;
      return;
    }

    this.isRefreshing = true;
    const shouldShowNotice = this.pendingNotice;
    this.pendingNotice = false;

    try {
      const markdownFiles = this.plugin.app.vault.getMarkdownFiles();
      const nextSyntheticResolvedLinks = await this.buildResolvedLinksSnapshot(markdownFiles);

      this.commitSyntheticResolvedLinks(nextSyntheticResolvedLinks);

      if (shouldShowNotice) {
        new obsidian.Notice(`关系图谱 HTML 链接已刷新，共注入 ${this.stats.edgeCount} 条关系边`);
      }
    } catch (error) {
      console.error('刷新关系图谱 HTML 链接失败', error);
      if (shouldShowNotice) {
        new obsidian.Notice('关系图谱 HTML 链接刷新失败，请查看控制台');
      }
    } finally {
      this.isRefreshing = false;

      if (this.pendingFullRefresh) {
        this.pendingFullRefresh = false;
        this.scheduleFullRefresh(0, this.pendingNotice);
      }
    }
  }

  // 在单个 Markdown 文件重新索引后，仅刷新当前源文件对应的合成关系边。
  async refreshSourceFile(file, content) {
    if (!this.ensureCompatibleRuntime(false)) return;
    if (!(file instanceof obsidian.TFile) || file.extension !== 'md') return;

    if (this.isRefreshing) {
      this.pendingFullRefresh = true;
      return;
    }

    this.isRefreshing = true;

    try {
      const resolvedCounts = this.buildResolvedCountsFromContent(content, file.path);
      this.replaceSyntheticResolvedLinksForSource(file.path, resolvedCounts);
    } catch (error) {
      console.error(`刷新文件 ${file.path} 的关系图谱 HTML 链接失败`, error);
    } finally {
      this.isRefreshing = false;

      if (this.pendingFullRefresh) {
        this.pendingFullRefresh = false;
        this.scheduleFullRefresh(0, this.pendingNotice);
      }
    }
  }

  // 从磁盘缓存中读取指定文件内容，再走单文件刷新流程，避免结构变化后立刻全库扫描。
  async refreshSourceFileFromVault(file) {
    if (!this.ensureCompatibleRuntime(false)) return;
    if (!(file instanceof obsidian.TFile) || file.extension !== 'md') return;

    try {
      const content = await this.plugin.app.vault.cachedRead(file);
      await this.refreshSourceFile(file, content);
    } catch (error) {
      console.error(`读取文件 ${file.path} 以刷新关系图谱 HTML 链接失败`, error);
    }
  }

  // 在文件重命名后先迁移当前源文件的合成关系边，再按需安排后台全量刷新。
  async handleSourceFileRename(file, oldPath) {
    if (!this.ensureCompatibleRuntime(false)) return;
    if (typeof oldPath === 'string' && oldPath && oldPath !== file.path) {
      this.replaceSyntheticResolvedLinksForSource(oldPath, null);
    }

    await this.refreshSourceFileFromVault(file);
  }

  // 在文件删除后先移除对应源文件的合成关系边，降低后续全量重建前的错误残留。
  removeSourceFileLinks(filePath) {
    if (!this.ensureCompatibleRuntime(false)) return false;
    if (typeof filePath !== 'string' || !filePath) return false;

    if (!this.syntheticResolvedLinks[filePath]) {
      return false;
    }

    this.replaceSyntheticResolvedLinksForSource(filePath, null);
    return true;
  }

  // 基于文件内容提取并解析 a.internal-link，返回当前源文件的目标计数字典。
  buildResolvedCountsFromContent(content, sourcePath) {
    const targets = this.extractInternalAnchorTargets(content);
    const resolvedCounts = {};

    targets.forEach((target) => {
      const resolvedPath = this.resolveTargetPath(target, sourcePath);
      if (!resolvedPath) return;

      resolvedCounts[resolvedPath] = (resolvedCounts[resolvedPath] || 0) + 1;
    });

    return resolvedCounts;
  }

  // 提取文本中的 HTML 内部链接，优先使用 data-href，其次回退到 href。
  extractInternalAnchorTargets(content) {
    if (typeof content !== 'string' || !content.includes('<a')) return [];

    const anchorTags = this.extractAnchorStartTags(content);
    const targets = [];

    anchorTags.forEach((tagText) => {
      const className = this.readAttribute(tagText, 'class');
      if (!className || !/(^|\s)internal-link(\s|$)/.test(className)) return;

      const rawTarget = this.readAttribute(tagText, 'data-href') || this.readAttribute(tagText, 'href');
      const normalizedTarget = this.normalizeTarget(rawTarget);
      if (!normalizedTarget) return;

      targets.push(normalizedTarget);
    });

    return targets;
  }

  // 逐字符提取 a 起始标签，避免属性值中的 >、< 或换行导致正则提前截断。
  extractAnchorStartTags(content) {
    const anchorTags = [];
    let searchIndex = 0;

    while (searchIndex < content.length) {
      const tagStart = content.indexOf('<', searchIndex);
      if (tagStart === -1) break;

      const tagNameFirstChar = content[tagStart + 1];
      if (!tagNameFirstChar || tagNameFirstChar.toLowerCase() !== 'a') {
        searchIndex = tagStart + 1;
        continue;
      }

      const tagNameBoundaryChar = content[tagStart + 2];
      if (tagNameBoundaryChar && /[a-z0-9:_-]/i.test(tagNameBoundaryChar)) {
        searchIndex = tagStart + 1;
        continue;
      }

      let quoteChar = '';
      let tagEnd = -1;

      for (let index = tagStart + 2; index < content.length; index += 1) {
        const currentChar = content[index];

        if (quoteChar) {
          if (currentChar === quoteChar) {
            quoteChar = '';
          }
          continue;
        }

        if (currentChar === '"' || currentChar === '\'') {
          quoteChar = currentChar;
          continue;
        }

        if (currentChar === '>') {
          tagEnd = index;
          break;
        }
      }

      if (tagEnd === -1) break;

      anchorTags.push(content.slice(tagStart, tagEnd + 1));
      searchIndex = tagEnd + 1;
    }

    return anchorTags;
  }

  // 从单个 HTML 标签字符串中读取指定属性值。
  readAttribute(tagText, attributeName) {
    const escapedName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const attributeMatch = tagText.match(
      new RegExp(`(?:^|[\\s<])${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\\x60]+))`, 'i')
    );
    if (!attributeMatch) return '';

    return attributeMatch[1] || attributeMatch[2] || attributeMatch[3] || '';
  }

  // 规范化目标链接，过滤外链、空值和仅锚点链接。
  normalizeTarget(rawTarget) {
    if (typeof rawTarget !== 'string') return '';

    let normalizedTarget = this.decodeHtmlEntities(rawTarget).trim();
    if (!normalizedTarget) return '';

    try {
      normalizedTarget = decodeURIComponent(normalizedTarget);
    } catch (error) {
      // 若链接中包含未编码百分号，则保留原值继续解析，避免合法中文链接被误判为失败。
    }

    if (normalizedTarget.startsWith('#')) return '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(normalizedTarget)) return '';

    return normalizedTarget;
  }

  // 解码常见 HTML 实体，保证 data-href 中的字符能被正确解析。
  decodeHtmlEntities(value) {
    const namedEntities = {
      amp: '&',
      quot: '"',
      apos: '\'',
      lt: '<',
      gt: '>',
      nbsp: ' '
    };

    return value
      .replace(/&#x([0-9a-f]+);?/gi, (match, hexCode) => this.decodeHtmlCodePoint(parseInt(hexCode, 16), match))
      .replace(/&#([0-9]+);?/g, (match, decimalCode) => this.decodeHtmlCodePoint(parseInt(decimalCode, 10), match))
      .replace(/&([a-z]+);/gi, (match, entityName) => {
        const normalizedName = entityName.toLowerCase();
        return Object.prototype.hasOwnProperty.call(namedEntities, normalizedName)
          ? namedEntities[normalizedName]
          : match;
      })
      .replace(/&#39;/gi, '\'');
  }

  // 仅在码点合法时解码数字实体，避免异常值污染链接文本。
  decodeHtmlCodePoint(codePoint, fallbackValue) {
    if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10FFFF) {
      return fallbackValue;
    }

    try {
      return String.fromCodePoint(codePoint);
    } catch (error) {
      return fallbackValue;
    }
  }

  // 将链接目标解析为真实文件路径，供关系图谱的 resolvedLinks 使用。
  resolveTargetPath(target, sourcePath) {
    const linkPath = target.split('#')[0].trim();
    if (!linkPath) return '';

    const destination = this.plugin.app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath);
    if (!(destination instanceof obsidian.TFile)) return '';

    return destination.path;
  }

  // 用新的全量结果替换旧的合成关系边，并同步更新统计信息。
  commitSyntheticResolvedLinks(nextSyntheticResolvedLinks) {
    if (!this.ensureCompatibleRuntime(false)) return;

    this.removeResolvedLinkCounts(this.syntheticResolvedLinks);
    this.addResolvedLinkCounts(nextSyntheticResolvedLinks);
    this.syntheticResolvedLinks = nextSyntheticResolvedLinks;
    this.recalculateStats();
    this.notifyResolvedLinksUpdated();
  }

  // 仅替换单个源文件对应的合成关系边，避免单文件编辑时全量重建。
  replaceSyntheticResolvedLinksForSource(sourcePath, nextResolvedCounts) {
    if (!this.ensureCompatibleRuntime(false)) return;

    const previousResolvedCounts = this.syntheticResolvedLinks[sourcePath];
    if (previousResolvedCounts) {
      this.removeResolvedLinkCounts({
        [sourcePath]: previousResolvedCounts
      });
    }

    if (nextResolvedCounts && Object.keys(nextResolvedCounts).length > 0) {
      this.addResolvedLinkCounts({
        [sourcePath]: nextResolvedCounts
      });
      this.syntheticResolvedLinks[sourcePath] = nextResolvedCounts;
    } else {
      delete this.syntheticResolvedLinks[sourcePath];
    }

    this.recalculateStats();
    this.notifyResolvedLinksUpdated();
  }

  // 从 metadataCache.resolvedLinks 中移除当前插件此前注入的关系边。
  clearSyntheticResolvedLinks() {
    if (!this.hasResolvedLinksStore()) {
      this.syntheticResolvedLinks = {};
      this.recalculateStats();
      return;
    }

    this.removeResolvedLinkCounts(this.syntheticResolvedLinks);
    this.syntheticResolvedLinks = {};
    this.recalculateStats();
    this.notifyResolvedLinksUpdated();
  }

  // 将一批合成关系边累加到 Obsidian 原生 resolvedLinks 中。
  addResolvedLinkCounts(resolvedLinkMap) {
    const resolvedLinks = this.getResolvedLinksStore();
    if (!resolvedLinks) return;

    Object.entries(resolvedLinkMap).forEach(([sourcePath, destinations]) => {
      if (!resolvedLinks[sourcePath]) {
        resolvedLinks[sourcePath] = {};
      }

      Object.entries(destinations).forEach(([destinationPath, count]) => {
        resolvedLinks[sourcePath][destinationPath] = (resolvedLinks[sourcePath][destinationPath] || 0) + count;
      });
    });
  }

  // 从 Obsidian 原生 resolvedLinks 中扣除插件注入的计数，保留其他来源的原始链接。
  removeResolvedLinkCounts(resolvedLinkMap) {
    const resolvedLinks = this.getResolvedLinksStore();
    if (!resolvedLinks) return;

    Object.entries(resolvedLinkMap).forEach(([sourcePath, destinations]) => {
      if (!resolvedLinks[sourcePath]) return;

      Object.entries(destinations).forEach(([destinationPath, count]) => {
        const currentCount = resolvedLinks[sourcePath][destinationPath];
        if (typeof currentCount !== 'number') return;

        const nextCount = currentCount - count;
        if (nextCount > 0) {
          resolvedLinks[sourcePath][destinationPath] = nextCount;
        } else {
          delete resolvedLinks[sourcePath][destinationPath];
        }
      });

      if (Object.keys(resolvedLinks[sourcePath]).length === 0) {
        delete resolvedLinks[sourcePath];
      }
    });
  }

  // 返回 Obsidian 的 resolvedLinks 存储对象，必要时按需初始化。
  getResolvedLinksStore() {
    if (!this.hasResolvedLinksStore()) {
      return null;
    }

    return this.plugin.app.metadataCache.resolvedLinks;
  }

  // 重新统计当前已注入的源文件数量与关系边数量。
  recalculateStats() {
    const sourceFileCount = Object.keys(this.syntheticResolvedLinks).length;
    const edgeCount = Object.values(this.syntheticResolvedLinks).reduce((total, destinations) => {
      return total + Object.values(destinations).reduce((subTotal, count) => subTotal + count, 0);
    }, 0);

    this.stats = {
      sourceFileCount,
      edgeCount
    };
  }

  // 主动通知 Obsidian 链接索引已更新，便于图谱等依赖 resolvedLinks 的视图重绘。
  notifyResolvedLinksUpdated() {
    if (typeof this.plugin.app.metadataCache.trigger === 'function') {
      this.plugin.app.metadataCache.trigger('resolved');
    }

    this.processGraphRefreshButtons();
  }

  // 返回当前所有已打开的全局图谱与局部图谱叶子，便于统一补按钮与尝试重绘。
  getOpenGraphLeaves() {
    const graphViewTypes = ['graph', 'localgraph'];
    const leaves = [];

    graphViewTypes.forEach((viewType) => {
      this.plugin.app.workspace.getLeavesOfType(viewType).forEach((leaf) => {
        leaves.push(leaf);
      });
    });

    return leaves;
  }

  // 监听文档中的视图切换与图谱 DOM 挂载，按需在图谱中补充刷新按钮。
  setupGraphRefreshButtonObserver() {
    let shouldProcess = false;

    this.graphButtonObserver = new MutationObserver((mutations) => {
      shouldProcess = mutations.some((mutation) => {
        if (mutation.type !== 'childList') return false;

        return Array.from(mutation.addedNodes).some((node) => {
          return node instanceof HTMLElement;
        });
      });

      if (!shouldProcess) return;

      if (this.graphButtonProcessTimer) {
        window.clearTimeout(this.graphButtonProcessTimer);
      }

      this.graphButtonProcessTimer = window.setTimeout(() => {
        this.graphButtonProcessTimer = null;
        this.processGraphRefreshButtons();
      }, 100);
    });

    this.graphButtonObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // 为已打开的关系图谱补充刷新按钮，避免用户必须回到设置页手动刷新。
  processGraphRefreshButtons() {
    if (!this.isFeatureEnabled()) return;

    this.getOpenGraphLeaves().forEach((leaf) => {
      this.ensureGraphRefreshButton(leaf);
    });
  }

  // 在单个关系图谱视图中挂载按钮，复用 Obsidian 图标按钮样式以保持界面一致。
  ensureGraphRefreshButton(leaf) {
    const view = leaf && leaf.view;
    if (!view) return;

    const hostEl = view.contentEl instanceof HTMLElement
      ? view.contentEl
      : (view.containerEl instanceof HTMLElement ? view.containerEl : null);
    if (!hostEl) return;

    hostEl.classList.add('nene-graph-refresh-host');

    if (hostEl.querySelector('.nene-graph-refresh-button')) return;

    const buttonEl = hostEl.createEl('button', {
      cls: 'clickable-icon nene-graph-refresh-button'
    });
    buttonEl.setAttribute('type', 'button');
    buttonEl.setAttribute('id', 'refresh-html');
    buttonEl.setAttribute('aria-label', '刷新链接');
    buttonEl.setAttribute('title', '刷新链接');
    obsidian.setIcon(buttonEl, 'refresh-cw');

    buttonEl.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (buttonEl.disabled) return;

      buttonEl.disabled = true;
      buttonEl.classList.add('is-disabled');

      try {
        await this.refreshAll(true);
      } finally {
        buttonEl.disabled = false;
        buttonEl.classList.remove('is-disabled');
      }
    });
  }

  // 清理图谱中动态注入的刷新按钮和宿主样式类，避免插件卸载后残留节点。
  removeGraphRefreshButtons() {
    document.querySelectorAll('.nene-graph-refresh-button').forEach((buttonEl) => {
      buttonEl.remove();
    });

    document.querySelectorAll('.nene-graph-refresh-host').forEach((hostEl) => {
      hostEl.classList.remove('nene-graph-refresh-host');
    });
  }

  // 注入少量样式，让刷新按钮固定显示在图谱视图右上角且兼容桌面端与移动端。
  addGraphRefreshButtonStyles() {
    if (this.styleEl) return;

    this.styleEl = document.createElement('style');
    this.styleEl.id = 'obsidian-nene-plugin-graph-refresh-styles';
    this.styleEl.textContent = `
      .nene-graph-refresh-host {
        position: relative;
      }

      .nene-graph-refresh-button {
        position: absolute;
        top: 10px;
        right: 48px;
        z-index: 10;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--background-secondary);
        border: 1px solid var(--background-modifier-border);
        border-radius: var(--radius-s);
      }

      .nene-graph-refresh-button.is-disabled {
        opacity: 0.65;
        pointer-events: none;
      }

      body.is-mobile .nene-graph-refresh-button {
        top: 8px;
        right: 44px;
      }
    `;

    document.head.appendChild(this.styleEl);
  }

  // 检查当前运行环境是否满足图谱增强的最低要求，不满足时直接降级为关闭状态。
  ensureCompatibleRuntime(showNotice) {
    if (!this.isFeatureEnabled()) {
      this.isCompatibleRuntime = false;
      return false;
    }

    if (!obsidian.requireApiVersion(MIN_GRAPH_COMPATIBLE_API_VERSION)) {
      this.isCompatibleRuntime = false;
      this.warnCompatibility(
        `关系图谱 HTML 链接增强仅在 Obsidian ${MIN_GRAPH_COMPATIBLE_API_VERSION}+ 上启用，当前版本将自动跳过。`,
        showNotice
      );
      return false;
    }

    if (!this.hasResolvedLinksStore()) {
      this.isCompatibleRuntime = false;
      this.warnCompatibility(
        '当前 Obsidian 运行环境未暴露可写的关系图谱链接索引，已跳过 HTML 链接增强。',
        showNotice
      );
      return false;
    }

    this.isCompatibleRuntime = true;
    this.lastCompatibilityMessage = '';
    return true;
  }

  // 返回关系图谱增强是否被用户在设置中启用。
  isFeatureEnabled() {
    if (typeof this.plugin.isAnchorGraphEnabled === 'function') {
      return this.plugin.isAnchorGraphEnabled();
    }

    return this.plugin.settings?.features?.anchorGraph?.enabled !== false;
  }

  // 判断当前是否存在可安全写入的 resolvedLinks 存储。
  hasResolvedLinksStore() {
    const metadataCache = this.plugin.app && this.plugin.app.metadataCache;
    if (!metadataCache) return false;

    const resolvedLinks = metadataCache.resolvedLinks;
    return Boolean(
      resolvedLinks
      && typeof resolvedLinks === 'object'
      && !Array.isArray(resolvedLinks)
      && typeof metadataCache.getFirstLinkpathDest === 'function'
    );
  }

  // 在不兼容环境下给出一次性提示，避免用户误以为功能静默损坏。
  warnCompatibility(message, showNotice) {
    this.lastCompatibilityMessage = message;
    if (this.compatibilityWarningShown) return;

    this.compatibilityWarningShown = true;
    console.warn(message);
    if (!showNotice) return;

    new obsidian.Notice(message, 6000);
  }

  // 分批读取全库 Markdown，避免长时间占用主线程导致界面卡顿。
  async buildResolvedLinksSnapshot(markdownFiles) {
    const nextSyntheticResolvedLinks = {};

    for (let index = 0; index < markdownFiles.length; index += 1) {
      const file = markdownFiles[index];
      const content = await this.plugin.app.vault.cachedRead(file);
      const resolvedCounts = this.buildResolvedCountsFromContent(content, file.path);
      if (Object.keys(resolvedCounts).length > 0) {
        nextSyntheticResolvedLinks[file.path] = resolvedCounts;
      }

      if ((index + 1) % FULL_REFRESH_BATCH_SIZE === 0) {
        await this.yieldToMainThread();
      }
    }

    return nextSyntheticResolvedLinks;
  }

  // 在大库扫描过程中主动让出一次事件循环，降低启动和结构变更时的阻塞感。
  async yieldToMainThread() {
    await new Promise((resolve) => {
      window.setTimeout(resolve, 0);
    });
  }
}

module.exports = {
  AnchorGraphLinkEnhancer
};
