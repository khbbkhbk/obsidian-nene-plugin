'use strict';

// 定义 Snippets 管理模块的默认配置，沿用 MySnippets 原设置项并做汉化。
const DEFAULT_SNIPPETS_SETTINGS = {
  aestheticStyle: false,
  openSnippetFile: true,
  snippetEnabledStatus: false,
  stylingTemplate: ''
};

// 归一化 Snippets 模块配置结构，缺失字段回退为默认值。
function normalizeSnippetsSettings(settings) {
  const source = settings || DEFAULT_SNIPPETS_SETTINGS;
  return {
    aestheticStyle: source.aestheticStyle === true,
    openSnippetFile: source.openSnippetFile !== false,
    snippetEnabledStatus: source.snippetEnabledStatus === true,
    stylingTemplate: typeof source.stylingTemplate === 'string'
      ? source.stylingTemplate
      : DEFAULT_SNIPPETS_SETTINGS.stylingTemplate
  };
}

module.exports = {
  DEFAULT_SNIPPETS_SETTINGS,
  normalizeSnippetsSettings
};
