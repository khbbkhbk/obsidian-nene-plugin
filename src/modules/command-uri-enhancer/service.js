'use strict';

var obsidian = require('obsidian');

// 优先使用现代剪贴板 API，失败时回退到传统复制命令。
async function copyTextToClipboard(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textareaEl = document.createElement('textarea');
  textareaEl.value = text;
  textareaEl.style.position = 'fixed';
  textareaEl.style.opacity = '0';
  document.body.appendChild(textareaEl);
  textareaEl.focus();
  textareaEl.select();

  const copied = document.execCommand('copy');
  document.body.removeChild(textareaEl);

  if (!copied) {
    throw new Error('Clipboard copy is not supported');
  }
}

// 定义命令&URI增强服务，负责解析命令目标并执行复制动作。
class CommandUriEnhancerService {
  constructor(plugin) {
    this.plugin = plugin; // 保存插件实例，便于读取当前配置与活跃文件
  }

  // 复制当前目标的库内路径。
  async copyVaultPathFromCommand() {
    await this.copyTargetPath('vault');
  }

  // 复制当前目标的绝对路径。
  async copyFullPathFromCommand() {
    await this.copyTargetPath('full');
  }

  // 复制当前目标的 URI 链接，标题仅保留最后一段名称。
  async copyUriLinkFromCommand() {
    await this.copyTargetPath('uriLink');
  }

  // 根据命令类型解析目标并完成复制。
  async copyTargetPath(pathType) {
    if (!this.plugin.isCommandUriEnhancerEnabled()) {
      this.plugin.commandUriEnhancerStore.clearRecentMenuTarget();
      new obsidian.Notice('命令&URI增强模块当前已关闭，请先在设置页中启用。');
      return;
    }

    const target = this.resolveCommandTarget();
    if (!target) {
      this.plugin.commandUriEnhancerStore.clearRecentMenuTarget();
      new obsidian.Notice('未找到可复制的目标，请先聚焦笔记，或从文件/文件夹右键菜单中触发该命令。');
      return;
    }

    try {
      const targetPath = this.buildTargetPath(target, pathType);
      await copyTextToClipboard(targetPath);
      new obsidian.Notice(
        `${this.getSuccessLabel(pathType)}：\n${targetPath}`,
        2000
      );
    } catch (error) {
      console.error('[ねね] 命令&URI增强复制失败', error);
      new obsidian.Notice(`复制失败：${error.message || '请检查当前平台是否支持该操作'}`);
    } finally {
      this.plugin.commandUriEnhancerStore.clearRecentMenuTarget();
    }
  }

  // 优先使用最近一次文件右键菜单目标，其次回退到当前活动笔记。
  resolveCommandTarget() {
    const menuTarget = this.plugin.commandUriEnhancerStore.getRecentMenuTarget();
    if (menuTarget instanceof obsidian.TFile || menuTarget instanceof obsidian.TFolder) {
      return menuTarget;
    }

    const activeFile = this.plugin.app.workspace.getActiveFile();
    if (activeFile instanceof obsidian.TFile) {
      return activeFile;
    }

    return null;
  }

  // 生成最终需要复制的路径文本。
  buildTargetPath(target, pathType) {
    const shouldAppendTrailingSlash = pathType !== 'uriLink'
      && target instanceof obsidian.TFolder
      && this.plugin.commandUriEnhancerStore.getSettings().addTrailingSlashToFolders === true;

    if (pathType === 'full') {
      return this.getAbsolutePath(target, shouldAppendTrailingSlash);
    }

    if (pathType === 'uriLink') {
      const absolutePath = this.getAbsolutePath(target, false);
      return this.buildUriMarkdownLink(absolutePath);
    }

    let vaultPath = target.path;
    if (shouldAppendTrailingSlash) {
      vaultPath += '/';
    }

    return vaultPath;
  }

  // 返回复制成功后的提示标题。
  getSuccessLabel(pathType) {
    if (pathType === 'full') {
      return '已复制完整路径';
    }

    if (pathType === 'uriLink') {
      return '已复制 URI 链接';
    }

    return '已复制库内路径';
  }

  // 读取当前目标的完整路径，并按需为文件夹追加末尾斜杠。
  getAbsolutePath(target, shouldAppendTrailingSlash) {
    const adapter = this.plugin.app.vault.adapter;
    if (typeof adapter.getFullRealPath !== 'function') {
      throw new Error('当前平台不支持读取完整路径');
    }

    let absolutePath = adapter.getFullRealPath(target.path);
    if (shouldAppendTrailingSlash) {
      absolutePath += '/';
    }

    return absolutePath;
  }

  // 将完整路径转换为 Markdown URI 链接，标题仅保留路径最后一段名称。
  buildUriMarkdownLink(absolutePath) {
    const normalizedPath = this.normalizePathForUri(absolutePath);
    const displayName = this.getPathDisplayName(normalizedPath);
    const uri = `file:///"${normalizedPath}"`;

    if (normalizedPath.includes(' ')) {
      return `[${displayName}](<${uri}>)`;
    }

    return `[${displayName}](${uri})`;
  }

  // 将路径统一改写为正斜杠，并移除首尾空白与包裹引号。
  normalizePathForUri(filePath) {
    if (typeof filePath !== 'string') {
      return '';
    }

    let normalizedPath = filePath.trim().replace(/\\/g, '/');
    if (normalizedPath.startsWith('"')) {
      normalizedPath = normalizedPath.slice(1);
    }
    if (normalizedPath.endsWith('"')) {
      normalizedPath = normalizedPath.slice(0, -1);
    }

    return normalizedPath;
  }

  // 取路径最后一段作为链接标题，并兼容尾部斜杠场景。
  getPathDisplayName(normalizedPath) {
    const trimmedPath = normalizedPath.endsWith('/')
      ? normalizedPath.slice(0, -1)
      : normalizedPath;
    const segments = trimmedPath.split('/').filter(Boolean);

    return segments[segments.length - 1] || trimmedPath || '未命名目标';
  }
}

module.exports = {
  CommandUriEnhancerService
};
