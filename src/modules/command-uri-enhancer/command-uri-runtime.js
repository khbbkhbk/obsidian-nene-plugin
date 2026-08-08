'use strict';

var obsidian = require('obsidian');
var around = require('monkey-around').around || require('monkey-around');

// 拦截器兜底清理超时（毫秒）：插件市场可能因社区插件功能被禁用等原因无法打开，
// 超过该时间仍未触发任何 Modal.open 时主动移除拦截器，避免影响后续其他弹窗。
var AUTO_OPEN_CLEANUP_TIMEOUT_MS = 10000;

// 市场列表渲染等待超时（毫秒）：插件市场目录需从网络加载，超过该时间仍未渲染出目标插件项时，放弃自动打开详情页。
var MARKET_ITEM_TIMEOUT_MS = 15000;

// 判断 Obsidian 设置面板当前是否处于打开状态。
// 依赖 app.setting 内部 DOM 结构，属于未文档化 API，Obsidian 升级后存在失效风险。
function settingsAreOpen(app) {
  return app.setting.containerEl.parentElement !== null;
}

// 提取市场列表项的名称文本。
// .community-item-name 中除插件名外，还包含 "已安装/最新" 等 .flair 标记与搜索高亮 span，
// 直接读取 textContent 会混入标记文本（例如 "Tray已安装"），导致名称严格比较失败。
// 因此克隆节点并移除 .flair 标记后再取文本，保证与 expectedName 的完全一致比较不受干扰。
// 依赖市场列表项 DOM 结构（.community-item/.community-item-name/.flair），属于未文档化内部结构，
// Obsidian 升级后存在失效风险。
function getMarketItemName(item) {
  const nameEl = item.querySelector('.community-item-name');
  if (!nameEl) {
    return '';
  }
  const clone = nameEl.cloneNode(true);
  clone.querySelectorAll('.flair').forEach((el) => el.remove());
  return clone.textContent.trim();
}

// 在市场列表渲染完成后，点击名称与目标完全一致的插件项，以打开其详情页。
// 遍历 .community-modal-search-results 容器下的直接子项（.community-item），
// 名称采用严格相等比较（大小写敏感）。成功点击返回 true，未找到返回 false。
function tryClickMarketPluginItemByName(contentEl, expectedName) {
  if (!contentEl) {
    return false;
  }
  const resultsContainer = contentEl.querySelector('.community-modal-search-results');
  if (!resultsContainer) {
    return false;
  }
  const items = Array.from(resultsContainer.children);
  for (const item of items) {
    if (getMarketItemName(item) === expectedName) {
      item.click();
      return true;
    }
  }
  return false;
}

// 等待市场列表渲染完成后自动打开目标插件的详情页。
// 优先调用市场内部方法 openPlugin(id) 直接打开详情页；方法不可用或 id 不在市场数据中时，
// 回退为点击搜索结果中名称完全一致的插件项。
// 返回 Promise：成功打开解析 true，超时或市场已关闭时解析 false。
function openPluginDetail(viewer, pluginId, expectedName, timeoutMs) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      // 市场弹窗已关闭时立即停止等待。
      if (!viewer || !viewer.contentEl || !viewer.contentEl.isConnected) {
        clearInterval(timer);
        resolve(false);
        return;
      }

      // 优先调用市场内部方法直接打开详情页。
      // pluginData/openPlugin 属于未文档化 API，Obsidian 升级后存在失效风险。
      if (
        pluginId &&
        Array.isArray(viewer.pluginData) &&
        viewer.pluginData.some((plugin) => plugin && plugin.id === pluginId) &&
        typeof viewer.openPlugin === 'function'
      ) {
        clearInterval(timer);
        try {
          viewer.openPlugin(pluginId);
          resolve(true);
        } catch (error) {
          resolve(false);
        }
        return;
      }

      // 回退方案：点击搜索结果中名称与目标完全一致的插件项。
      if (tryClickMarketPluginItemByName(viewer.contentEl, expectedName)) {
        clearInterval(timer);
        resolve(true);
        return;
      }

      if (Date.now() - startedAt > timeoutMs) {
        clearInterval(timer);
        resolve(false);
      }
    }, 120);
  });
}

// 定义命令&URI增强运行时，负责注册 obsidian://goto-plugin URI 协议处理。
// 该运行时承载 URI 协议跳转逻辑，支持 show=config / show=hotkeys 两种附加参数，
// 用于快速定位插件设置或快捷键配置页。
// 协议参数统一按插件显示名称匹配，大小写敏感，匹配不到时给出中文提示。
class CommandUriRuntime {
  constructor(plugin) {
    this.plugin = plugin; // 保存插件实例，便于访问 app 与模块总开关
    this.openUriListener = null; // obsidian://open 扩展的 url-parse 监听器引用
  }

  // 注册插件自定义协议处理器，生命周期由插件统一管理。
  // 包含 goto-plugin（插件定位）与 open（笔记打开扩展）两个协议。
  registerProtocolHandlers() {
    this.registerGotoPluginHandler();
    this.registerOpenProtocolHandler();
  }

  // 注册 goto-plugin 协议处理器。
  // 协议参数为 ?name=<插件名称>，按显示名称匹配，大小写敏感。
  registerGotoPluginHandler() {
    this.plugin.registerObsidianProtocolHandler('goto-plugin', ({ name, show }) => {
      this.plugin.app.workspace.onLayoutReady(() => {
        this.gotoPlugin(name, show);
      });
    });
  }

  // 注册 obsidian://open 扩展协议处理器，在原协议基础上增加 method、block、header 参数。
  // 说明：Obsidian 核心已内置注册 "open" 协议（obsidian://open），同一 action 无法重复注册。
  // 因此改走官方稳定的 url-parse 事件，在核心解析 URL 之前拦截：
  //  - 仅当 URL 携带本模块的扩展参数（method / block / header）时才接管处理并返回 true（阻止核心）；
  //  - 普通 obsidian://open（无扩展参数）原样放行给核心，不影响原生行为。
  registerOpenProtocolHandler() {
    this.openUriListener = (url) => {
      if (!url) {
        return undefined;
      }

      let urlObj;
      try {
        urlObj = new URL(url);
      } catch (error) {
        return undefined;
      }

      // 仅处理 obsidian://open 协议的 URL。
      if (urlObj.protocol !== 'obsidian:' || urlObj.hostname !== 'open') {
        return undefined;
      }

      const params = urlObj.searchParams;
      const file = params.get('file');
      const method = params.get('method');
      const block = params.get('block');
      const header = params.get('header');

      // 无扩展参数时放行给 Obsidian 核心默认处理。
      if (!file || (!method && !block && !header)) {
        return undefined;
      }

      this.plugin.app.workspace.onLayoutReady(() => {
        this.handleOpenUri({ file, method, block, header });
      });
      return true; // 阻止 Obsidian 默认处理，由扩展逻辑接管
    };
    this.plugin.registerEvent(this.plugin.app.workspace.on('url-parse', this.openUriListener));
  }

  // 处理 obsidian://open 扩展 URI：解析 method（打开方式）、block（文本块定位）、header（标题定位）参数。
  async handleOpenUri(params) {
    const { file, method, block, header } = params;

    if (!this.plugin.isCommandUriEnhancerEnabled()) {
      // 模块未启用时，仅执行标准打开逻辑，忽略扩展参数。
      if (file) {
        const decodedFile = decodeURIComponent(file);
        this.plugin.app.workspace.openLinkText(decodedFile, '', false);
      }
      return;
    }

    if (!file) {
      new obsidian.Notice('URI 缺少 file 参数，无法打开笔记');
      return;
    }

    const decodedFile = decodeURIComponent(file);

    // 确定打开方式：未指定时使用 false（当前活动页）
    let openMode = false;
    if (method === 'tab') {
      openMode = 'tab';
    } else if (method === 'window') {
      openMode = 'window';
    } else if (method === 'split') {
      openMode = 'split';
    }

    // 构建带锚点的链接文本
    let linktext = decodedFile;
    let anchorType = null;   // 'block' | 'header'
    let anchorValue = null;

    if (block) {
      linktext = `${decodedFile}#^${block}`;
      anchorType = 'block';
      anchorValue = block;
    } else if (header) {
      const decodedHeader = decodeURIComponent(header);
      linktext = `${decodedFile}#${decodedHeader}`;
      anchorType = 'header';
      anchorValue = decodedHeader;
    }

    // 打开文件并定位
    await this.plugin.app.workspace.openLinkText(linktext, '', openMode);

    // 验证锚点是否存在（延迟确保编辑器就绪）
    if (anchorType) {
      setTimeout(() => this.verifyAnchor(decodedFile, anchorType, anchorValue), 300);
    }
  }

  // 校验文本块或标题锚点是否在目标文件中存在，不存在则给出 toast 提示。
  verifyAnchor(filePath, anchorType, anchorValue) {
    const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof obsidian.TFile)) {
      return;
    }

    const cache = this.plugin.app.metadataCache.getFileCache(file);
    if (!cache) {
      // 缓存尚未就绪，延迟重试一次
      setTimeout(() => {
        const retryCache = this.plugin.app.metadataCache.getFileCache(file);
        if (retryCache) {
          this.checkAnchorInCache(filePath, anchorType, anchorValue, retryCache);
        }
      }, 500);
      return;
    }

    this.checkAnchorInCache(filePath, anchorType, anchorValue, cache);
  }

  // 在文件元数据缓存中查找锚点，未找到时 toast 提示。
  checkAnchorInCache(filePath, anchorType, anchorValue, cache) {
    let found = false;

    if (anchorType === 'block' && cache.blocks) {
      found = Object.prototype.hasOwnProperty.call(cache.blocks, anchorValue);
    } else if (anchorType === 'header' && cache.headings) {
      found = cache.headings.some((h) => h.heading === anchorValue);
    }

    if (!found) {
      const label = anchorType === 'block'
        ? `文本块 "${anchorValue}"`
        : `标题 "${anchorValue}"`;
      new obsidian.Notice(`${label} 不存在，链接失败`);
    }
  }

  // 按 manifest 的 name 字段精确匹配插件 id（大小写敏感），匹配不到时返回 null。
  resolvePluginId(name) {
    return this.findPluginIdByName(name);
  }

  // 在已安装第三方插件与核心插件清单中，按 manifest 的 name 字段精确查找插件 id。
  // 名称匹配采用严格相等比较，大小写敏感；仅接受 manifest.name，插件 id 不会被匹配。
  findPluginIdByName(name) {
    const app = this.plugin.app;

    // 1. 在已安装第三方插件清单中查找（含尚未启用但已安装的插件）。
    const thirdPartyEntry = Object.entries(app.plugins.manifests || {}).find(
      ([, manifest]) => manifest && manifest.name === name
    );
    if (thirdPartyEntry) {
      return thirdPartyEntry[0];
    }

    // 2. 在核心插件清单中查找，同样以 manifest 的 name 字段为准。
    const coreEntry = Object.entries(app.internalPlugins.plugins || {}).find(
      ([, corePlugin]) => corePlugin &&
        corePlugin.instance &&
        corePlugin.instance.manifest &&
        corePlugin.instance.manifest.name === name
    );
    if (coreEntry) {
      return coreEntry[0];
    }

    return null;
  }

  // goto-plugin URI 主分发逻辑：
  // - name + show=hotkeys → 打开快捷键设置页并过滤该插件命令
  // - name + show=config  → 打开该插件的设置页
  // - 其他情况            → 打开社区插件市场并定位已安装插件（无 name 时仅打开市场）
  gotoPlugin(name, show) {
    if (!this.plugin.isCommandUriEnhancerEnabled()) {
      new obsidian.Notice('命令&URI增强模块当前已关闭，请先在设置页中启用。');
      return;
    }

    if (name && show === 'hotkeys') {
      this.showHotkeysFor(name);
      return;
    }

    if (name && show === 'config') {
      if (!this.showConfigFor(name)) {
        this.plugin.app.setting.close();
      }
      return;
    }

    // 默认行为：打开社区插件市场定位插件。仅对已安装插件有效，
    // 未安装时直接拦截并提示，避免进入市场却无法定位到目标插件。
    if (name && !this.findPluginIdByName(name)) {
      new obsidian.Notice(`未找到插件 "${name}"：请确认名称拼写正确、插件已安装。`);
      return;
    }

    // 打开社区插件市场，市场内部按插件名称搜索定位。
    const pluginsTab = this.showSettings('community-plugins');
    if (!pluginsTab) {
      new obsidian.Notice('未找到"第三方插件"设置页：请确认已启用社区插件功能。');
      return;
    }

    // 拦截插件市场 Modal 的 open 时机，注入需要定位的插件名称。
    // setAutoOpen/autoload 属于未文档化 API，Obsidian 升级后存在失效风险。
    let remove = null;
    const cleanupTimer = setTimeout(() => {
      if (remove) {
        remove();
      }
    }, AUTO_OPEN_CLEANUP_TIMEOUT_MS);

    const runtime = this;
    remove = around(obsidian.Modal.prototype, {
      open(old) {
        return function open(...args) {
          remove();
          clearTimeout(cleanupTimer);
          if (name) {
            this.autoload = name;
            if (typeof this.setAutoOpen === 'function') {
              this.setAutoOpen(name);
            }
            // 市场列表渲染完成后，优先调用市场内部方法直接打开插件详情页，
            // 方法不可用或 id 不在市场数据中时，回退为点击搜索结果中名称完全一致的插件项。
            const viewer = this;
            const pluginId = runtime.resolvePluginId(name);
            openPluginDetail(viewer, pluginId, name, MARKET_ITEM_TIMEOUT_MS).then((opened) => {
              if (!opened) {
                new obsidian.Notice(`已定位到 "${name}" 的搜索结果，但未自动打开详情页。`);
              }
            });
          }
          return old.apply(this, args);
        };
      }
    });

    // 点击"第三方插件"设置页中的浏览按钮，打开社区插件市场。
    const browseButtonEl = pluginsTab.containerEl && pluginsTab.containerEl.find('.mod-cta');
    if (browseButtonEl) {
      browseButtonEl.click();
    } else {
      remove();
      clearTimeout(cleanupTimer);
      new obsidian.Notice('未找到"浏览"按钮，请手动打开社区插件市场。');
    }
  }

  // 打开设置面板并切换到指定标签页，返回标签页实例；切换失败时返回 false。
  showSettings(id) {
    const app = this.plugin.app;
    if (!settingsAreOpen(app)) {
      app.setting.open();
    }

    if (id) {
      if (app.setting.activeTab && app.setting.activeTab.id !== id) {
        app.setting.openTabById(id);
      }
      return app.setting.activeTab && app.setting.activeTab.id === id
        ? app.setting.activeTab
        : false;
    }

    return null;
  }

  // 打开快捷键设置页，并把"插件id:"前缀填入搜索框以过滤该插件命令。
  // 搜索框字段与 updateHotkeyVisibility 均为未文档化 API。
  showHotkeysFor(name) {
    const id = this.resolvePluginId(name);
    if (!id) {
      new obsidian.Notice(`未找到插件 "${name}"：请确认名称拼写正确、插件已安装并启用。`);
      return;
    }

    const tab = this.showSettings('hotkeys');
    const inputEl = tab && (tab.searchInputEl || (tab.searchComponent && tab.searchComponent.inputEl));
    if (tab && inputEl && typeof tab.updateHotkeyVisibility === 'function') {
      inputEl.value = `${id}:`;
      tab.updateHotkeyVisibility();
    }
  }

  // 打开指定插件的设置页；插件不存在或没有设置页时给出中文提示。
  showConfigFor(name) {
    const id = this.resolvePluginId(name);
    if (id && this.showSettings(id)) {
      return true;
    }

    new obsidian.Notice(`未找到插件 "${name}"：请确认名称拼写正确、插件已安装并启用。`);
    return false;
  }
}

module.exports = {
  CommandUriRuntime
};
