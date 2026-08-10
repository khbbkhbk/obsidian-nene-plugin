'use strict';

var constants = require('./constants');

// 主题增强运行时：负责往 Obsidian 外观设置的下拉框中注入"护眼模式"选项，
// 并管理 body class 与护眼 CSS 的注入/移除。
class ThemeEnhancerRuntime {
  constructor(plugin, store) {
    this.plugin = plugin;
    this.store = store;
    this.styleEl = null;
    this.optionInjected = false;
    this._bodyObserver = null;
    this._dropdownSelectEl = null;
    this._themeChangeBound = false;
  }

  // 加载最新配置。
  load(settings) {
    this.settings = settings || {};
  }

  // 启动：注入下拉框选项 + 监听主题变化 + 恢复护眼状态。
  start() {
    this.setupDropdownInjection();
    this.setupThemeChangeListener();

    // 恢复之前的护眼状态
    if (this.settings.eyeProtection) {
      this.applyEyeProtection();
    }
  }

  // 停止：移除下拉框选项、body class、CSS 样式、监听器。
  // 若护眼模式已开启，运行时回退到浅色，但保留配置文件中的护眼状态，
  // 便于再次启用模块或重新启用插件时恢复到配置所记录的主题色。
  stop() {
    this.removeEyeProtection();
    this.removeDropdownOption();
    this.teardownBodyObserver();
    this.teardownThemeChangeListener();

    if (this.settings.eyeProtection) {
      this.plugin.app.vault.setConfig('theme', 'moonstone');
    }
  }

  /* ---------- 下拉框注入 ---------- */

  // 通过 MutationObserver 监听 body，在设置面板渲染后自动注入护眼选项。
  setupDropdownInjection() {
    var self = this;

    // 先尝试立即注入（可能设置面板已打开）
    if (self.tryInjectOption()) {
      return;
    }

    // 设置全局 MutationObserver，等待外观下拉框出现
    self._bodyObserver = new MutationObserver(function () {
      if (self.tryInjectOption()) {
        self.teardownBodyObserver();
      }
    });

    self._bodyObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // 尝试查找外观下拉框并注入"护眼模式"选项，成功返回 true。
  tryInjectOption() {
    if (this.optionInjected) {
      return true;
    }

    var selectEl = this.findThemeDropdown();
    if (!selectEl) {
      return false;
    }

    this.injectOption(selectEl);
    return true;
  }

  // 在页面中查找 Obsidian 外观设置中的基础颜色下拉框。
  findThemeDropdown() {
    var dropdowns = document.querySelectorAll(constants.THEME_DROPDOWN_SELECTOR);

    for (var i = 0; i < dropdowns.length; i++) {
      var options = dropdowns[i].querySelectorAll('option');
      var hasObsidian = false;
      var hasMoonstone = false;

      for (var j = 0; j < options.length; j++) {
        if (options[j].value === 'obsidian') {
          hasObsidian = true;
        }
        if (options[j].value === 'moonstone') {
          hasMoonstone = true;
        }
      }

      if (hasObsidian && hasMoonstone) {
        return dropdowns[i];
      }
    }

    return null;
  }

  // 向目标 select 元素追加"护眼模式"<option> 并绑定 change 事件。
  injectOption(selectEl) {
    var self = this;
    self._dropdownSelectEl = selectEl;

    // 创建 option 元素
    var option = document.createElement('option');
    option.value = constants.EYE_SHIELD_OPTION_VALUE;
    option.textContent = constants.EYE_SHIELD_OPTION_TEXT;
    selectEl.appendChild(option);

    self.optionInjected = true;

    // 监听下拉框 change 事件
    selectEl.addEventListener('change', function () {
      self.handleDropdownChange(selectEl);
    });

    // 同步当前 option 选中状态
    self.syncDropdownSelection(selectEl);
  }

  // 从下拉框中移除"护眼模式"选项。
  removeDropdownOption() {
    if (!this.optionInjected) {
      return;
    }

    var selectEl = this.findThemeDropdown();
    if (!selectEl) {
      this.optionInjected = false;
      this._dropdownSelectEl = null;
      return;
    }

    var option = selectEl.querySelector('option[value="' + constants.EYE_SHIELD_OPTION_VALUE + '"]');
    if (option) {
      option.remove();
    }

    this.optionInjected = false;
    this._dropdownSelectEl = null;
  }

  // 根据当前护眼状态与底层主题同步下拉框选中项。
  syncDropdownSelection(selectEl) {
    if (this.settings.eyeProtection) {
      selectEl.value = constants.EYE_SHIELD_OPTION_VALUE;
      return;
    }

    // 非护眼状态：同步 Obsidian 底层主题对应的下拉选项
    var currentTheme = this.plugin.app.vault.getConfig('theme');
    if (currentTheme === 'obsidian' || currentTheme === 'moonstone' || currentTheme === 'system') {
      selectEl.value = currentTheme;
    }
  }

  // 下拉框 change 事件处理：拦截护眼模式选项的选中。
  handleDropdownChange(selectEl) {
    var self = this;
    var value = selectEl.value;

    if (value === constants.EYE_SHIELD_OPTION_VALUE) {
      // 用户选中了"护眼模式"
      // 底层主题设为浅色，再叠加护眼 CSS
      self.plugin.app.vault.setConfig('theme', 'moonstone');
      // 延迟检查：setConfig 是异步的，css-change 事件稍后触发
      self.store.setEyeProtection(true);
      self.applyEyeProtection();
    } else {
      // 用户切换到了其他主题
      if (self.settings.eyeProtection) {
        self.store.setEyeProtection(false);
        self.removeEyeProtectionCSS();
        document.body.classList.remove('theme-eyeshield');
      }
    }
  }

  /* ---------- body class 与 CSS 样式管理 ---------- */

  // 应用护眼模式：确保底层为浅色主题 + 注入 CSS + body 添加 class。
  applyEyeProtection() {
    // 护眼配色基于浅色主题叠加，恢复时强制底层基础主题为浅色
    this.plugin.app.vault.setConfig('theme', 'moonstone');
    this.applyEyeProtectionCSS();
    document.body.classList.add('theme-eyeshield');
  }

  // 移除护眼模式：移除 CSS + body 移除 class。
  removeEyeProtection() {
    this.removeEyeProtectionCSS();
    document.body.classList.remove('theme-eyeshield');
  }

  // 向 <head> 注入护眼 CSS <style> 标签。
  applyEyeProtectionCSS() {
    if (this.styleEl) {
      return; // 已注入
    }

    var style = document.createElement('style');
    style.id = constants.EYE_SHIELD_STYLE_ID;
    style.textContent = constants.EYE_SHIELD_CSS;
    document.head.appendChild(style);
    this.styleEl = style;
  }

  // 从 <head> 移除护眼 CSS <style> 标签。
  removeEyeProtectionCSS() {
    if (this.styleEl && this.styleEl.parentNode) {
      this.styleEl.parentNode.removeChild(this.styleEl);
    }
    this.styleEl = null;
  }

  /* ---------- 主题变化监听 ---------- */

  // 监听 Obsidian 的 css-change 事件，处理外部主题切换。
  setupThemeChangeListener() {
    var self = this;

    if (self._themeChangeBound) {
      return;
    }

    self._themeChangeRef = self.plugin.app.vault.on('css-change', function () {
      self.onExternalThemeChange();
    });
    self.plugin.registerEvent(self._themeChangeRef);
    self._themeChangeBound = true;
  }

  // 外部主题变化回调：如果护眼模式下用户通过其他途径切换主题，需关闭护眼。
  onExternalThemeChange() {
    if (!this.settings.eyeProtection) {
      return;
    }

    var currentTheme = this.plugin.app.vault.getConfig('theme');

    // 如果底层主题被改为非浅色，则关闭护眼模式
    if (currentTheme !== 'moonstone') {
      this.store.setEyeProtection(false);
      this.removeEyeProtection();
      this.syncDropdownIfPossible();
    }
  }

  // 同步下拉框选中状态（如果下拉框可用）。
  syncDropdownIfPossible() {
    var selectEl = this._dropdownSelectEl || this.findThemeDropdown();
    if (selectEl && this.settings.eyeProtection) {
      selectEl.value = constants.EYE_SHIELD_OPTION_VALUE;
    }
  }

  /* ---------- 清理 ---------- */

  // 销毁 body MutationObserver。
  teardownBodyObserver() {
    if (this._bodyObserver) {
      this._bodyObserver.disconnect();
      this._bodyObserver = null;
    }
  }

  // 销毁主题变化监听，真正移除注册的事件引用，避免模块反复开关时累积监听器。
  teardownThemeChangeListener() {
    if (this._themeChangeRef) {
      this.plugin.app.vault.offref(this._themeChangeRef);
      this._themeChangeRef = null;
    }
    this._themeChangeBound = false;
  }
}

module.exports = {
  ThemeEnhancerRuntime
};
