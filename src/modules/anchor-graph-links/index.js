'use strict';

var obsidian = require('obsidian');

// 为关系图谱补充 HTML 内部链接识别能力，将 a.internal-link 注入为合成正向链接。
class AnchorGraphLinkEnhancer {
  constructor(plugin) {
    this.plugin = plugin; // 保存插件实例，便于访问 metadataCache 和 vault
    this.syntheticResolvedLinks = {}; // 记录当前插件注入的关系边，便于刷新和卸载时精准回滚
    this.refreshTimer = null; // 保存防抖定时器，避免频繁全量扫描
    this.isRefreshing = false; // 标记当前是否正在执行刷新，避免并发写入 resolvedLinks
    this.pendingFullRefresh = false; // 在刷新过程中若再次请求刷新，则在本轮结束后补一次
    this.pendingNotice = false; // 合并多次手动刷新请求，保证最后一次仍会显示提示
    this.stats = {
      sourceFileCount: 0,
      edgeCount: 0
    };
  }

  // 启动增强器时执行一次全量构建，保证图谱立即可见。
  start() {
    this.scheduleFullRefresh(0);
  }

  // 停止增强器时回滚注入的关系边，避免影响其他插件或 Obsidian 原生索引。
  stop() {
    if (this.refreshTimer) {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    this.clearSyntheticResolvedLinks();
  }

  // 返回当前已注入的关系图谱统计信息，供设置页展示。
  getStats() {
    return Object.assign({}, this.stats);
  }

  // 计划一次全量刷新，在文件结构变化时重新解析全部 HTML 内部链接。
  scheduleFullRefresh(delay, showNotice) {
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

  // 手动或启动时执行全量刷新，重建全部 a.internal-link 的关系边。
  async refreshAll(showNotice) {
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
      const nextSyntheticResolvedLinks = {};
      const markdownFiles = this.plugin.app.vault.getMarkdownFiles();

      for (const file of markdownFiles) {
        const content = await this.plugin.app.vault.cachedRead(file);
        const resolvedCounts = this.buildResolvedCountsFromContent(content, file.path);
        if (Object.keys(resolvedCounts).length > 0) {
          nextSyntheticResolvedLinks[file.path] = resolvedCounts;
        }
      }

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

    const anchorTags = content.match(/<a\b[^>]*>/gi) || [];
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

  // 从单个 HTML 标签字符串中读取指定属性值。
  readAttribute(tagText, attributeName) {
    const escapedName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const attributeMatch = tagText.match(new RegExp(`${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
    if (!attributeMatch) return '';

    return attributeMatch[1] || attributeMatch[2] || '';
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
    return value
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, '\'')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>');
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
    this.removeResolvedLinkCounts(this.syntheticResolvedLinks);
    this.addResolvedLinkCounts(nextSyntheticResolvedLinks);
    this.syntheticResolvedLinks = nextSyntheticResolvedLinks;
    this.recalculateStats();
    this.notifyResolvedLinksUpdated();
  }

  // 仅替换单个源文件对应的合成关系边，避免单文件编辑时全量重建。
  replaceSyntheticResolvedLinksForSource(sourcePath, nextResolvedCounts) {
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
    this.removeResolvedLinkCounts(this.syntheticResolvedLinks);
    this.syntheticResolvedLinks = {};
    this.recalculateStats();
    this.notifyResolvedLinksUpdated();
  }

  // 将一批合成关系边累加到 Obsidian 原生 resolvedLinks 中。
  addResolvedLinkCounts(resolvedLinkMap) {
    const resolvedLinks = this.getResolvedLinksStore();

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
    if (!this.plugin.app.metadataCache.resolvedLinks) {
      this.plugin.app.metadataCache.resolvedLinks = {};
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
  }
}

module.exports = {
  AnchorGraphLinkEnhancer
};
