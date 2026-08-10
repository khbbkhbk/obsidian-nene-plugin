'use strict';

var obsidian = require('obsidian');

/* ---------- 自定义图标：调色盘 ---------- */

// 注册 MySnippets 原有的 pantone-line 图标。
function registerPantoneIcon() {
  const pantoneIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="0" stroke-linecap="round" stroke-linejoin="round"><path d="M5.764 8l-.295-.73a1 1 0 0 1 .553-1.302l9.272-3.746a1 1 0 0 1 1.301.552l5.62 13.908a1 1 0 0 1-.553 1.302L12.39 21.73a1 1 0 0 1-1.302-.553L11 20.96V21H7a1 1 0 0 1-1-1v-.27l-3.35-1.353a1 1 0 0 1-.552-1.302L5.764 8zM8 19h2.209L8 13.533V19zm-2-6.244l-1.673 4.141L6 17.608v-4.852zm1.698-5.309l4.87 12.054l7.418-2.997l-4.87-12.053l-7.418 2.996zm2.978 2.033a1 1 0 1 1-.749-1.855a1 1 0 0 1 .75 1.855z" fill="currentColor"/></svg>`;
  obsidian.addIcon('nene-pantone', pantoneIconSvg);
  // ms-snippet：用于菜单中打开片段按钮
  obsidian.addIcon('ms-snippet', '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><path d="M7.375 16.781l1.25-1.562L4.601 12l4.024-3.219l-1.25-1.562l-5 4a1 1 0 0 0 0 1.562l5 4zm9.25-9.562l-1.25 1.562L19.399 12l-4.024 3.219l1.25 1.562l5-4a1 1 0 0 0 0-1.562l-5-4zm-1.649-4.003l-4 18l-1.953-.434l4-18z" fill="currentColor"/></svg>');
}

/* ---------- 工具函数 ---------- */

// 判断某 CSS 片段是否已启用。
function isSnippetEnabled(app, snippet) {
  try {
    if (app.customCss && typeof app.customCss.enabledSnippets !== 'undefined') {
      if (app.customCss.enabledSnippets instanceof Set) {
        return app.customCss.enabledSnippets.has(snippet);
      }
      if (Array.isArray(app.customCss.enabledSnippets)) {
        return app.customCss.enabledSnippets.includes(snippet);
      }
    }
    return false;
  } catch (_e) {
    return false;
  }
}

// 获取所有 CSS 片段列表。
function getSnippets(app) {
  try {
    if (app.customCss && Array.isArray(app.customCss.snippets)) {
      return app.customCss.snippets.slice();
    }
    return [];
  } catch (_e) {
    return [];
  }
}

// 获取某个片段的完整路径。
function getSnippetPath(app, snippet) {
  try {
    if (app.customCss && typeof app.customCss.getSnippetPath === 'function') {
      return app.customCss.getSnippetPath(snippet);
    }
    return '';
  } catch (_e) {
    return '';
  }
}

// 安全读取当前启用状态，用于 ToggleComponent.onChange 回调。
function customCssEnabled(app, snippet) {
  try {
    if (app.customCss && app.customCss.enabledSnippets) {
      if (app.customCss.enabledSnippets instanceof Set) {
        return app.customCss.enabledSnippets.has(snippet);
      }
      return app.customCss.enabledSnippets.includes(snippet);
    }
    return false;
  } catch (_e) {
    return false;
  }
}

// 获取 snippets 文件夹路径。
function getSnippetsFolder(app) {
  try {
    if (app.customCss && typeof app.customCss.getSnippetsFolder === 'function') {
      return app.customCss.getSnippetsFolder();
    }
    return '';
  } catch (_e) {
    return '';
  }
}

// 切换片段启停。
function setCssEnabledStatus(app, snippet, enabled) {
  try {
    if (app.customCss && typeof app.customCss.setCssEnabledStatus === 'function') {
      app.customCss.setCssEnabledStatus(snippet, enabled);
    }
  } catch (_e) {
    // 静默失败
  }
}

// 重新加载所有 CSS 片段。
function requestLoadSnippets(app) {
  try {
    if (app.customCss && typeof app.customCss.requestLoadSnippets === 'function') {
      app.customCss.requestLoadSnippets();
    }
  } catch (_e) {
    // 静默失败
  }
}

/* ---------- 创建片段弹窗 ---------- */

class CreateSnippetModal extends obsidian.Modal {
  constructor(app, plugin, settings) {
    super(app);
    this.plugin = plugin;
    this.settings = settings;
  }

  onOpen() {
    this.render();
  }

  render() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: '创建 CSS 片段' });

    // 文件标题输入
    var fileNameSetting = new obsidian.Setting(contentEl);
    var fileNameInput = new obsidian.TextComponent(fileNameSetting.controlEl);
    fileNameSetting
      .setName('CSS 片段名称')
      .setDesc('输入新的 CSS 片段文件名（不含 .css 后缀）。');

    // CSS 内容输入
    var cssContentSetting = new obsidian.Setting(contentEl);
    cssContentSetting.settingEl.addClass('nene-css-editor-setting');
    var cssContentInput = new obsidian.TextAreaComponent(cssContentSetting.controlEl);
    cssContentInput.inputEl.addClass('nene-css-editor');
    cssContentSetting
      .setName('CSS 内容')
      .setDesc('输入 CSS 样式内容。');
    cssContentInput.setValue(this.settings.stylingTemplate || '');

    // 创建按钮
    var selfModal = this;
    new obsidian.Setting(contentEl).addButton(function (btn) {
      btn.setButtonText('创建片段').onClick(async function () {
        var fileName = fileNameInput.getValue().trim();
        // 过滤路径穿越和非法文件名字符
        fileName = fileName.replace(/[/\\:*?"<>|]/g, '-').replace(/\.\./g, '--');
        var fileContents = cssContentInput.getValue();

        if (!fileName) {
          new obsidian.Notice('请输入片段名称');
          return;
        }

        try {
          if (!selfModal.app.customCss) {
            new obsidian.Notice('无法获取 CSS 片段管理');
            return;
          }

          var snippetsFolder = getSnippetsFolder(selfModal.app);
          if (!snippetsFolder) {
            new obsidian.Notice('无法获取片段文件夹路径');
            return;
          }

          var existingSnippets = getSnippets(selfModal.app);
          if (existingSnippets.includes(fileName + '.css')) {
            new obsidian.Notice('"' + fileName + '.css" 已存在。');
            return;
          }

          await selfModal.app.vault.create(
            snippetsFolder + '/' + fileName + '.css',
            fileContents
          );

          if (selfModal.settings?.openSnippetFile !== false) {
            var snippetPath = getSnippetPath(selfModal.app, fileName + '.css');
            if (snippetPath && typeof selfModal.app.openWithDefaultApp === 'function') {
              selfModal.app.openWithDefaultApp(snippetPath);
            }
          }

          if (selfModal.settings?.snippetEnabledStatus) {
            setCssEnabledStatus(selfModal.app, fileName + '.css', true);
          }

          requestLoadSnippets(selfModal.app);
          new obsidian.Notice('片段 "' + fileName + '.css" 已创建');
          selfModal.close();
        } catch (error) {
          console.error('[ねね] 创建 CSS 片段失败', error);
          new obsidian.Notice('创建失败：' + (error.message || '未知错误'));
        }
      });
    });

    fileNameInput.inputEl.focus();
  }

  onClose() {
    this.contentEl.empty();
  }
}

/* ---------- 重命名片段弹窗 ---------- */

class SnippetsRenameModal extends obsidian.Modal {
  constructor(app, plugin, oldSnippet, onRenamed) {
    super(app);
    this.plugin = plugin;
    this.oldSnippet = oldSnippet; // 完整文件名，如 "theme.css"
    this.onRenamed = onRenamed;
    this.oldBaseName = oldSnippet.replace(/\.css$/i, '');
  }

  onOpen() {
    this.render();
  }

  render() {
    var self = this;
    var contentEl = this.contentEl;
    contentEl.empty();

    contentEl.createEl('h5', { text: '重命名 CSS 片段' });

    var nameInput = new obsidian.TextComponent(contentEl);
    nameInput.inputEl.addClass('nene-rename-input');
    nameInput.setValue(this.oldBaseName);
    nameInput.inputEl.focus();
    nameInput.inputEl.select();

    var btnContainer = contentEl.createDiv({ cls: 'modal-button-container' });
    new obsidian.ButtonComponent(btnContainer)
      .setButtonText('确定')
      .setCta()
      .onClick(async function () {
        var newName = nameInput.getValue().trim();
        if (!newName) {
          new obsidian.Notice('请输入新名称');
          return;
        }

        var newSnippet = newName.endsWith('.css') ? newName : newName + '.css';
        if (newSnippet === self.oldSnippet) {
          new obsidian.Notice('新名称与原名相同');
          return;
        }

        // 检查是否已存在同名片段
        var existingSnippets = getSnippets(self.app);
        if (existingSnippets.includes(newSnippet)) {
          new obsidian.Notice('"' + newSnippet + '" 已存在。');
          return;
        }

        // 新名称路径穿越校验：防止片段名包含目录分隔符或上级引用
        if (/[\/\\]/.test(newName.replace(/\.css$/i, ''))) {
          new obsidian.Notice('片段名称不能包含路径分隔符');
          return;
        }

        try {
          var snippetsFolder = getSnippetsFolder(self.app);
          var oldPath = snippetsFolder + '/' + self.oldSnippet;
          var newPath = snippetsFolder + '/' + newSnippet;

          // 优先使用官方 rename API，确保触发 vault 事件；不存在时回退到 write+remove
          if (typeof self.app.vault.adapter.rename === 'function') {
            await self.app.vault.adapter.rename(oldPath, newPath);
          } else {
            // 读取旧文件内容
            var content = await self.app.vault.adapter.read(oldPath);
            // 写入新文件
            await self.app.vault.adapter.write(newPath, content);
            // 删除旧文件
            await self.app.vault.adapter.remove(oldPath);
          }

          // 如果原片段已启用，启用新片段
          var wasEnabled = isSnippetEnabled(self.app, self.oldSnippet);
          if (wasEnabled) {
            setCssEnabledStatus(self.app, self.oldSnippet, false);
          }
          setCssEnabledStatus(self.app, newSnippet, wasEnabled);

          requestLoadSnippets(self.app);
          new obsidian.Notice('片段已重命名为 "' + newSnippet + '"');

          if (typeof self.onRenamed === 'function') {
            self.onRenamed();
          }
          self.close();
        } catch (error) {
          console.error('[ねね] 重命名 CSS 片段失败', error);
          new obsidian.Notice('重命名失败：' + (error.message || '未知错误'));
        }
      });

    new obsidian.ButtonComponent(btnContainer)
      .setButtonText('取消')
      .onClick(function () {
        self.close();
      });
  }

  onClose() {
    this.contentEl.empty();
  }
}

/* ---------- Snippets 运行时 ---------- */

class SnippetsRuntime {
  constructor(plugin) {
    this.plugin = plugin;
    this.settings = null;
    this.statusBarItem = null;
    this.menuEl = null;
    this.pantoneIconRegistered = false;
  }

  // 挂载最新配置。
  load(settings) {
    this.settings = settings || {};
  }

  // 启动：注册图标 + 创建状态栏按钮。
  start() {
    if (!this.pantoneIconRegistered) {
      registerPantoneIcon();
      this.pantoneIconRegistered = true;
    }
    this.ensureStatusBarItem();
  }

  // 停止：移除状态栏按钮和相关事件。
  stop() {
    if (this.statusBarItem) {
      this.statusBarItem.remove();
      this.statusBarItem = null;
    }
    this.closeMenu();
  }

  // 创建状态栏按钮，确保只创建一次。
  ensureStatusBarItem() {
    if (this.statusBarItem) return;

    this.statusBarItem = this.plugin.addStatusBarItem();
    this.statusBarItem.addClass('mod-clickable');
    this.statusBarItem.addClass('nene-snippets-button');
    this.statusBarItem.setAttribute('aria-label', 'CSS代码片段管理');
    this.statusBarItem.setAttribute('data-tooltip-position', 'top');
    this.statusBarItem.onClickEvent(function (e) {
      this.toggleMenu();
    }.bind(this));

    // 用 Obsidian setIcon 设置调色盘图标
    var iconEl = this.statusBarItem.querySelector('.status-bar-item-icon');
    if (!iconEl) {
      var iconContainer = this.statusBarItem.createSpan({ cls: 'status-bar-item-icon' });
      obsidian.setIcon(iconContainer, 'nene-pantone');
    }
  }

  // 切换菜单显示状态。
  toggleMenu() {
    if (this.menuEl && this.menuEl.parentNode) {
      this.closeMenu();
      return;
    }
    this.showMenu();
  }

  // 显示 Snippets 管理菜单，沿用原 MySnippets Menu API + 样式排版。
  showMenu() {
    var app = this.plugin.app;
    var self = this;
    var currentSnippets = getSnippets(app);
    var snippetsFolder = getSnippetsFolder(app);

    var menu = new obsidian.Menu();
    menu.setUseNativeMenu(false);

    var menuDom = menu.dom;
    menuDom.addClass('MySnippets-statusbar-menu');
    menuDom.style.zIndex = 'var(--layer-menu)';

    // 毛玻璃效果
    if (this.settings.aestheticStyle) {
      menuDom.style.backgroundColor = 'transparent';
      menuDom.style.backdropFilter = 'blur(8px)';
      menuDom.style.webkitBackdropFilter = 'blur(8px)';
    }

    // 逐一渲染每个 CSS 片段
    currentSnippets.forEach(function (snippet) {
      var snippetPath = getSnippetPath(app, snippet);
      var enabled = isSnippetEnabled(app, snippet);

      menu.addItem(function (item) {
        item.setTitle(snippet);

        var itemDom = item.dom;
        var toggle = new obsidian.ToggleComponent(itemDom);
        var openBtn = new obsidian.ButtonComponent(itemDom);
        var renameBtn = new obsidian.ButtonComponent(itemDom);

        toggle
          .setValue(enabled)
          .onChange(function () {
            var isOn = customCssEnabled(app, snippet);
            setCssEnabledStatus(app, snippet, !isOn);
          });

        openBtn
          .setIcon('ms-snippet')
          .setClass('MS-OpenSnippet')
          .onClick(function () {
            app.openWithDefaultApp(snippetPath);
          });
        openBtn.buttonEl.setAttribute('aria-label', '打开CSS代码片段文件');
        openBtn.buttonEl.setAttribute('data-tooltip-position', 'top');

        // 新增：重命名按钮
        renameBtn
          .setIcon('pencil')
          .setClass('MS-RenameSnippet')
          .onClick(function () {
            new SnippetsRenameModal(app, self, snippet, function () { }).open();
          });
        renameBtn.buttonEl.setAttribute('aria-label', '重命名CSS代码片段');
        renameBtn.buttonEl.setAttribute('data-tooltip-position', 'top');

        // 阻止 item 自身的 onClick 冒泡
        item.onClick(function (e) {
          e.preventDefault();
          e.stopImmediatePropagation();
        });
      });
    });

    // 分隔线
    menu.addSeparator();

    // 底部操作栏（单行 item，放 3 个按钮）
    menu.addItem(function (actions) {
      actions.setIcon(null);
      actions.setTitle('功能');
      actions.titleEl.style.fontWeight = '700';

      var actionsDom = actions.dom;

      // 刷新按钮：使用 refresh-cw 图标
      var reloadBtn = new obsidian.ButtonComponent(actionsDom);
      reloadBtn
        .setIcon('refresh-cw')
        .setClass('MySnippetsButton')
        .setClass('MS-Reload')
        .onClick(function () {
          requestLoadSnippets(app);
          new obsidian.Notice('CSS代码片段已重新加载');
        });
      reloadBtn.buttonEl.setAttribute('aria-label', '重载CSS代码片段');
      reloadBtn.buttonEl.setAttribute('data-tooltip-position', 'top');

      // 打开文件夹按钮
      var folderBtn = new obsidian.ButtonComponent(actionsDom);
      folderBtn
        .setIcon('folder-open')
        .setClass('MySnippetsButton')
        .setClass('MS-Folder')
        .onClick(function () {
          if (snippetsFolder && typeof app.openWithDefaultApp === 'function') {
            app.openWithDefaultApp(snippetsFolder);
          }
        });
      folderBtn.buttonEl.setAttribute('aria-label', '打开CSS代码片段所在文件夹');
      folderBtn.buttonEl.setAttribute('data-tooltip-position', 'top');

      // 新建片段按钮
      var addBtn = new obsidian.ButtonComponent(actionsDom);
      addBtn
        .setIcon('plus-circle')
        .setClass('MySnippetsButton')
        .setClass('MS-Folder')
        .onClick(function () {
          new CreateSnippetModal(app, self, self.settings).open();
        });
      addBtn.buttonEl.setAttribute('aria-label', '新建CSS代码片段');
      addBtn.buttonEl.setAttribute('data-tooltip-position', 'top');
    });

    menu.showAtPosition({
      x: window.innerWidth - 15,
      y: window.innerHeight - 37
    });

    this.menuEl = menuDom;
    this._menu = menu;

    // 点击外部关闭（Obsidian Menu 自身会处理，这里做保险）
    setTimeout(function () {
      if (self.menuEl && self.menuEl.parentNode) {
        self._closeHandler = function (e) {
          if (self.menuEl && !self.menuEl.contains(e.target)) {
            self.closeMenu();
          }
        };
        document.addEventListener('mousedown', self._closeHandler, { once: true });
      }
    }, 10);
  }

  // 关闭菜单（利用 Obsidian Menu.close 或手动移除 DOM）。
  closeMenu() {
    if (this._menu && typeof this._menu.close === 'function') {
      this._menu.close();
    }
    this._menu = null;
    if (this.menuEl && this.menuEl.parentNode) {
      this.menuEl.parentNode.removeChild(this.menuEl);
    }
    this.menuEl = null;
    if (this._closeHandler) {
      document.removeEventListener('mousedown', this._closeHandler);
      this._closeHandler = null;
    }
  }
}

module.exports = {
  SnippetsRuntime,
  CreateSnippetModal,
  SnippetsRenameModal
};
