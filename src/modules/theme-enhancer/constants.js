'use strict';

// 主题增强模块默认配置。
const DEFAULT_THEME_ENHANCER_SETTINGS = {
  eyeProtection: false
};

// 护眼模式 CSS：通过 body 上的 .theme-eyeshield 类控制 CSS 变量覆盖。
// 护眼模式不区分深浅，始终叠加在浅色模式之上（保留 .theme-light 选择器，因部分颜色依赖浅色模式的基础变量）。
// 颜色体系参考用户现有的 ObsidianFunctionCustomization.css 豆沙绿配色。
const EYE_SHIELD_CSS = `
/* === ねね 护眼模式 - 豆沙绿 === */

body.theme-eyeshield.theme-light {
  --background-primary: #CFE8CC;
  --background-secondary: #c1e0bc;
  --background-primary-alt: #D6F0D2;
  --background-secondary-alt: #aed4aa;
  --background-modifier-border: #B6CCB3;
  --background-modifier-border-hover: #aed4aa;
  /* --background-modifier-border-focus: #94c98b; */
  /* --background-modifier-hover: #aed4aa; */
  --text-normal: #3B4B3E;
  --text-muted: #6B7B6E;
  --text-faint: #8B9B8E;
  --text-accent: #4A8C5C;
  --interactive-accent: var(--color-accent-1);
  --interactive-accent-hover: var(--color-accent-2);
  --interactive-normal: #c1e0bc;
  --interactive-hover: #aed4aa;
  --background-modifier-form-field: #CFE8CC;
  --divider-color: #B6CCB3;
  --code-background: #c1e0bc;
  /* 保留原配色 */
  --accent-original: hsl(var(--accent-h), var(--accent-s), var(--accent-l));
  --link-external-color: var(--accent-original);
  --link-external-color-hover: hsl(calc(var(--accent-h) - 3), calc(var(--accent-s) * 1.02), calc(var(--accent-l) * 1.15));
  --icon-color-active: var(--accent-original);
  --background-modifier-active-hover: hsla(var(--interactive-accent-hsl), 0.15);
}
`;

// 外观下拉框选择器：Obsidian 设置 → 外观 → 基础颜色
const THEME_DROPDOWN_SELECTOR = 'select.dropdown';

// 护眼模式在下拉框中的标识值（非 Obsidian 官方值，仅用于 DOM 拦截）
const EYE_SHIELD_OPTION_VALUE = '__nene_eyeshield__';

// 护眼模式在下拉框中的显示文本
const EYE_SHIELD_OPTION_TEXT = '护眼模式';

// 注入到 <head> 的 <style> 标签 ID
const EYE_SHIELD_STYLE_ID = 'nene-eye-shield-style';

function normalizeThemeEnhancerSettings(settings) {
  const source = settings || {};
  return {
    eyeProtection: source.eyeProtection === true
  };
}

module.exports = {
  DEFAULT_THEME_ENHANCER_SETTINGS,
  EYE_SHIELD_CSS,
  THEME_DROPDOWN_SELECTOR,
  EYE_SHIELD_OPTION_VALUE,
  EYE_SHIELD_OPTION_TEXT,
  EYE_SHIELD_STYLE_ID,
  normalizeThemeEnhancerSettings
};
