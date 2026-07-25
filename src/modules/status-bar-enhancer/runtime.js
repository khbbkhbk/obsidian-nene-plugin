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
    this.statusBarEl = null; // 缓存路径状态栏 DOM 节点，避免重复创建
    this.lastModifiedTimestampEl = null; // 缓存最后修改时间状态栏 DOM 节点
    this.createdTimestampEl = null; // 缓存创建时间状态栏 DOM 节点
  }

  // 挂载最新配置。
  load(settings) {
    this.settings = settings || this.plugin.statusBarEnhancerStore.getSettings();
  }

  // 启动状态栏增强，创建状态栏节点并立刻渲染当前活动文件。
  start() {
    this.ensureStatusBarItems();
    this.renderActiveFilePath();
    this.renderActiveTimestamps();
  }

  // 停止状态栏增强并移除全部状态栏节点。
  stop() {
    if (this.statusBarEl) {
      this.statusBarEl.remove();
      this.statusBarEl = null;
    }

    if (this.lastModifiedTimestampEl) {
      this.lastModifiedTimestampEl.remove();
      this.lastModifiedTimestampEl = null;
    }

    if (this.createdTimestampEl) {
      this.createdTimestampEl.remove();
      this.createdTimestampEl = null;
    }
  }

  // 确保路径与时间戳状态栏节点已创建，重复调用时直接跳过。
  ensureStatusBarItems() {
    if (!this.statusBarEl) {
      this.statusBarEl = this.plugin.addStatusBarItem();
      this.statusBarEl.addClass('mod-clickable');
      this.statusBarEl.addClass('nene-status-bar-enhancer');
      this.statusBarEl.addEventListener('click', () => {
        void this.copyActivePath();
      });
    }

    if (!this.lastModifiedTimestampEl) {
      this.lastModifiedTimestampEl = this.plugin.addStatusBarItem();
      this.lastModifiedTimestampEl.addClass('nene-status-bar-timestamp');
      this.lastModifiedTimestampEl.addEventListener('click', () => {
        void this.cycleTimestampDisplay();
      });
    }

    if (!this.createdTimestampEl) {
      this.createdTimestampEl = this.plugin.addStatusBarItem();
      this.createdTimestampEl.addClass('nene-status-bar-timestamp');
      this.createdTimestampEl.addEventListener('click', () => {
        void this.cycleTimestampDisplay();
      });
    }
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

  // 渲染当前活动文件的时间戳到状态栏。
  renderActiveTimestamps() {
    const activeFile = this.plugin.app.workspace.getActiveFile();
    this.renderTimestamps(activeFile);
  }

  // 根据指定文件刷新两个时间戳状态栏项。
  renderTimestamps(file) {
    this.renderLastModifiedTimestamp(file);
    this.renderCreatedTimestamp(file);
  }

  // 刷新最后修改时间状态栏项，模块未启用或无活动文件时隐藏。
  renderLastModifiedTimestamp(file) {
    if (!this.lastModifiedTimestampEl) {
      return;
    }

    if (!(file instanceof obsidian.TFile) || !this.getLastModifiedEnabled()) {
      this.lastModifiedTimestampEl.hide();
      return;
    }

    const timestampText = obsidian.moment(file.stat.mtime).format(this.getLastModifiedTimestampFormat());
    this.lastModifiedTimestampEl.setText(`${this.getLastModifiedPrepend()}${timestampText}`);
    this.lastModifiedTimestampEl.show();
  }

  // 刷新创建时间状态栏项，模块未启用或无活动文件时隐藏。
  renderCreatedTimestamp(file) {
    if (!this.createdTimestampEl) {
      return;
    }

    if (!(file instanceof obsidian.TFile) || !this.getCreatedEnabled()) {
      this.createdTimestampEl.hide();
      return;
    }

    const timestampText = obsidian.moment(file.stat.ctime).format(this.getCreatedTimestampFormat());
    this.createdTimestampEl.setText(`${this.getCreatedPrepend()}${timestampText}`);
    this.createdTimestampEl.show();
  }

  // 点击时间戳状态栏项时在「仅最后修改时间 → 仅创建时间 → 两者都显示」间循环，
  // 与原插件行为一致，循环结果会作为当前配置持久化到配置文件。
  async cycleTimestampDisplay() {
    if (!this.getCycleOnClickEnabled()) {
      return;
    }

    const store = this.plugin.statusBarEnhancerStore;
    const current = store.getSettings();
    let nextState;

    if (current.lastModifiedEnabled && current.createdEnabled) {
      nextState = { lastModifiedEnabled: true, createdEnabled: false };
    } else if (current.lastModifiedEnabled) {
      nextState = { lastModifiedEnabled: false, createdEnabled: true };
    } else if (current.createdEnabled) {
      nextState = { lastModifiedEnabled: true, createdEnabled: true };
    } else {
      nextState = { lastModifiedEnabled: true, createdEnabled: false };
    }

    try {
      await store.setTimestampDisplayState(nextState.lastModifiedEnabled, nextState.createdEnabled);
      this.load(store.getSettings());
      this.renderActiveTimestamps();
    } catch (error) {
      console.error('[ねね] 状态栏增强切换时间戳显示失败', error);
      new obsidian.Notice('切换时间戳显示失败，请查看控制台日志');
    }
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

  // 返回“是否显示最后修改时间”开关。
  getLastModifiedEnabled() {
    return this.settings?.lastModifiedEnabled !== false;
  }

  // 返回最后修改时间的前缀文本。
  getLastModifiedPrepend() {
    return typeof this.settings?.lastModifiedPrepend === 'string' ? this.settings.lastModifiedPrepend : '';
  }

  // 返回最后修改时间的显示格式。
  getLastModifiedTimestampFormat() {
    return typeof this.settings?.lastModifiedTimestampFormat === 'string' && this.settings.lastModifiedTimestampFormat
      ? this.settings.lastModifiedTimestampFormat
      : ' HH:mm:ss';
  }

  // 返回“是否显示创建时间”开关。
  getCreatedEnabled() {
    return this.settings?.createdEnabled === true;
  }

  // 返回创建时间的前缀文本。
  getCreatedPrepend() {
    return typeof this.settings?.createdPrepend === 'string' ? this.settings.createdPrepend : '';
  }

  // 返回创建时间的显示格式。
  getCreatedTimestampFormat() {
    return typeof this.settings?.createdTimestampFormat === 'string' && this.settings.createdTimestampFormat
      ? this.settings.createdTimestampFormat
      : 'YYYY-MM-DD';
  }

  // 返回“点击循环显示”开关。
  getCycleOnClickEnabled() {
    return this.settings?.cycleOnClickEnabled !== false;
  }
}

module.exports = {
  StatusBarEnhancerRuntime
};
