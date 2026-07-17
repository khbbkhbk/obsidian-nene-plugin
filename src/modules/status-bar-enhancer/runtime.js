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

// 定义状态栏增强运行时，负责状态栏渲染、点击复制与事件订阅。
class StatusBarEnhancerRuntime {
  constructor(plugin) {
    this.plugin = plugin; // 保存插件实例，便于读取配置与工作区状态
    this.settings = null; // 缓存最近一次加载的配置
    this.statusBarEl = null; // 缓存状态栏 DOM 节点，避免重复创建
  }

  // 挂载最新配置。
  load(settings) {
    this.settings = settings || this.plugin.statusBarEnhancerStore.getSettings();
  }

  // 启动状态栏增强，创建状态栏节点并立刻渲染当前活动文件。
  start() {
    if (this.statusBarEl) {
      this.renderActiveFilePath();
      return;
    }

    this.statusBarEl = this.plugin.addStatusBarItem();
    this.statusBarEl.addClass('mod-clickable');
    this.statusBarEl.addClass('nene-status-bar-enhancer');
    this.statusBarEl.addEventListener('click', () => {
      void this.copyActivePath();
    });
    this.renderActiveFilePath();
  }

  // 停止状态栏增强并移除状态栏节点。
  stop() {
    if (!this.statusBarEl) {
      return;
    }

    this.statusBarEl.remove();
    this.statusBarEl = null;
  }

  // 渲染当前活动文件的路径到状态栏。
  renderActiveFilePath() {
    if (!this.statusBarEl) {
      return;
    }

    const activeFile = this.plugin.app.workspace.getActiveFile();
    this.renderFilePath(activeFile);
  }

  // 根据指定文件刷新状态栏内容；没有活动文件时清空显示。
  renderFilePath(file) {
    if (!this.statusBarEl) {
      return;
    }

    this.statusBarEl.empty();

    if (!(file instanceof obsidian.TFile)) {
      return;
    }

    const pathToDisplay = this.getDisplayPath(file);
    const fragment = this.convertPathToHtmlFragment(
      pathToDisplay,
      this.getShowFileName(),
      this.getShowIcons()
    );
    this.statusBarEl.appendChild(fragment);
  }

  // 复制当前活动文件路径，供状态栏点击与命令复用。
  async copyActivePath() {
    if (!this.plugin.isStatusBarEnhancerEnabled()) {
      new obsidian.Notice('状态栏增强当前已关闭，请先在设置页中启用。');
      return;
    }

    const activeFile = this.plugin.app.workspace.getActiveFile();
    if (!(activeFile instanceof obsidian.TFile)) {
      new obsidian.Notice('当前没有可复制路径的活动文件');
      return;
    }

    const textToCopy = this.getCopyTargetPath(activeFile);

    try {
      await copyTextToClipboard(textToCopy);
      new obsidian.Notice('路径已复制到剪贴板');
    } catch (error) {
      console.error('[ねね] 状态栏增强复制路径失败', error);
      new obsidian.Notice(`复制失败：${error.message || '请检查当前平台是否支持该操作'}`);
    }
  }

  // 返回状态栏当前应显示的路径文本。
  getDisplayPath(file) {
    if (this.getShowFileName()) {
      return file.path;
    }

    return file.parent?.path || '/';
  }

  // 返回当前要复制的路径文本。
  getCopyTargetPath(file) {
    const relativePath = this.getDisplayPath(file);
    if (!this.getCopyAbsolutePath()) {
      return relativePath;
    }

    const adapter = this.plugin.app.vault.adapter;
    if (typeof adapter.getFullRealPath === 'function') {
      return adapter.getFullRealPath(relativePath === '/' ? '' : relativePath);
    }

    if (typeof adapter.basePath === 'string' && adapter.basePath) {
      return relativePath === '/'
        ? adapter.basePath
        : `${adapter.basePath}/${relativePath}`.replace(/\\/g, '/');
    }

    throw new Error('当前平台不支持读取完整路径');
  }

  // 将路径文本转换为状态栏可直接挂载的片段。
  convertPathToHtmlFragment(filePath, pathContainsFileName, includeIcons) {
    const fragment = document.createDocumentFragment();
    const pathParts = this.getPathParts(filePath, pathContainsFileName);
    pathParts.forEach((part) => {
      fragment.appendChild(this.getNodeForPathPart(part, includeIcons));
    });
    return fragment;
  }

  // 根据路径片段类型生成对应文本节点。
  getNodeForPathPart(part, includeIcon) {
    const fragment = document.createDocumentFragment();

    if (part.type === 'folder') {
      if (includeIcon) {
        fragment.append('📁 ');
      }
      fragment.append(part.name);
      return fragment;
    }

    if (part.type === 'file') {
      if (includeIcon) {
        fragment.append('📄 ');
      }
      fragment.append(part.name);
      return fragment;
    }

    fragment.append(' » ');
    return fragment;
  }

  // 将路径拆成文件夹、文件和分隔符片段。
  getPathParts(filePath, lastPartIsFile) {
    if (filePath === '/') {
      return [{ type: 'folder', name: '库根目录' }];
    }

    const parts = String(filePath)
      .split('/')
      .filter((partName) => partName.length > 0);
    const pathParts = [];

    parts.forEach((partName, index) => {
      pathParts.push({
        type: lastPartIsFile && index === parts.length - 1 ? 'file' : 'folder',
        name: partName
      });

      if (index < parts.length - 1) {
        pathParts.push({ type: 'separator' });
      }
    });

    return pathParts;
  }

  // 返回“是否显示文件名”开关。
  getShowFileName() {
    return this.settings?.showFileName === true;
  }

  // 返回“是否显示图标”开关。
  getShowIcons() {
    return this.settings?.showIcons === true;
  }

  // 返回“是否复制绝对路径”开关。
  getCopyAbsolutePath() {
    return this.settings?.copyAbsolutePath !== false;
  }
}

module.exports = {
  StatusBarEnhancerRuntime
};
