'use strict';

const {
  VOID_ELEMENTS
} = require('./constants.js');

/**
 * HTML 标签解析工具。
 *
 * 核心逻辑来源于：
 *  - HTML Tags Autocomplete 插件（0.0.7）的 common.ts：光标关联标签识别、配对标签查找
 *  - Auto Close Tags 插件（1.1.2）的 main.ts：单标签识别、代码块/行内代码检测
 * 在此基础上修复了原插件行级匹配无法处理跨行标签等缺陷。
 */

// 行内标签扫描正则：支持属性与 <hr/> 形式的自闭合标签。
const TAG_PATTERN = /<\/?([\w\d-]+)(?:\s[^<>]*?)?(\/?)>/g;

/**
 * 判断标签是否为单标签（自闭合或 void 元素）。
 * @param {object} tag 标签对象
 * @returns {boolean} 是否为单标签
 */
function isSingleTag(tag) {
  return tag.selfClosing === true || VOID_ELEMENTS.includes(tag.name.toLowerCase());
}

/**
 * 扫描整行文本，返回该行内所有合法的 HTML 标签（按出现顺序）。
 * @param {string} line 行文本
 * @returns {Array<object>} 标签对象数组
 */
function scanLineTags(line) {
  const result = [];
  let match;
  TAG_PATTERN.lastIndex = 0;
  while ((match = TAG_PATTERN.exec(line)) !== null) {
    const full = match[0];
    result.push({
      full,
      name: match[1],
      isClosing: full.startsWith('</'),
      selfClosing: match[2] === '/',
      index: match.index,
      length: full.length
    });
  }
  return result;
}

/**
 * 获取光标关联的 HTML 标签（仅限当前行）。
 *
 * 兼容 includeStart 参数：当光标紧贴标签之前（line[cursor.ch] === '<'）时，
 * 仍将标签视为"光标所在标签"，用于跳转类命令的前向匹配。
 *
 * @param {object} cursor 编辑器光标 {line, ch}
 * @param {object} editor CodeMirror 编辑器实例
 * @param {boolean} includeStart 是否将紧贴标签开始处的光标视为标签内部
 * @returns {object|null} 标签对象，未命中时返回 null
 */
function cursorTag(cursor, editor, includeStart) {
  const line = editor.getLine(cursor.line);
  if (!line || line.length === 0) return null;

  const lineSplit = (line[cursor.ch - 1] === '<' || (includeStart && line[cursor.ch] === '<'))
    ? cursor.ch
    : cursor.ch - 1;
  if (lineSplit < 0) return null;

  const startIndex = line.lastIndexOf('<', lineSplit);
  if (startIndex < 0) return null;
  const endIndex = line.indexOf('>', lineSplit);
  if (endIndex < 0) return null;

  const segment = line.slice(startIndex, endIndex + 1);
  const match = TAG_PATTERN.exec(segment);
  if (match === null) return null;

  // 光标必须位于标签文本内部（含紧贴标签末尾）。
  const tagIndex = startIndex + match.index;
  const tagLength = match[0].length;
  if (tagIndex + tagLength <= lineSplit) return null;

  return {
    full: match[0],
    name: match[1],
    isClosing: match[0].startsWith('</'),
    selfClosing: match[2] === '/',
    index: tagIndex,
    length: tagLength,
    line: cursor.line,
    lineSplit
  };
}

/**
 * 判断光标是否严格位于标签的 '<' 与 '>' 内部。
 * @param {object} cursor 编辑器光标
 * @param {object} tag 标签对象
 * @returns {boolean} 是否位于标签内部
 */
function isCursorInsideTag(cursor, tag) {
  return cursor.ch > tag.index && cursor.ch < tag.index + tag.length;
}

/**
 * 计算标签名末尾位置（'<' 或 '</' 之后标签名最后一个字符之后）。
 * 例如 <div> 与 </div> 的落点均在 'v' 与 '>' 之间。
 * @param {object} tag 标签对象
 * @returns {number} 行内字符位置
 */
function tagNameEndPosition(tag) {
  return tag.index + (tag.isClosing ? 2 : 1) + tag.name.length;
}

/**
 * 判断某一行是否为围栏代码块起始行。
 * @param {object} editor CodeMirror 编辑器实例
 * @param {number} lineNumber 行号
 * @returns {boolean} 是否为围栏代码块起始行
 */
function isFenceStart(editor, lineNumber) {
  const line = editor.getLine(lineNumber).trim();
  return line.startsWith('```') || line.startsWith('~~~');
}

/**
 * 判断指定行是否位于围栏代码块内部（不含起始行本身）。
 * @param {object} editor CodeMirror 编辑器实例
 * @param {number} lineNumber 行号
 * @returns {boolean} 是否位于代码块内
 */
function isInFencedCodeBlock(editor, lineNumber) {
  let count = 0;
  for (let i = 0; i < lineNumber; i++) {
    if (isFenceStart(editor, i)) count++;
  }
  return count % 2 === 1;
}

/**
 * 判断行内字符位置是否位于行内代码（反引号包裹）中。
 * @param {string} line 行文本
 * @param {number} ch 字符位置
 * @returns {boolean} 是否位于行内代码内
 */
function isInInlineCode(line, ch) {
  const start = line.lastIndexOf('`', ch - 1);
  if (start < 0) return false;
  const next = line.indexOf('`', start + 1);
  return next > ch || next < 0;
}

/**
 * 判断标签名是否命中排除标签列表。
 * 匹配时大小写敏感：排除列表中的 'div' 仅影响 <div>，不影响 <DIV>。
 * @param {string} excludedTags 排除标签列表（逗号分隔）
 * @param {string} name 标签名（保持原始大小写）
 * @returns {boolean} 是否被排除
 */
function isTagExcluded(excludedTags, name) {
  const list = String(excludedTags || '').split(',').map(function (item) {
    return item.trim();
  }).filter(Boolean);
  return list.includes(name);
}

/**
 * 根据配置检查标签是否满足命令/补全的执行约束。
 * 单标签需由调用方先行判断并给出细分提示，此处不再处理。
 * @param {object} editor CodeMirror 编辑器实例
 * @param {object} cursor 编辑器光标
 * @param {object} tag 标签对象
 * @param {object} settings 模块配置
 * @param {object} messages 中文提示文案对象（需包含 tagExcluded / tagInCodeContext）
 * @returns {string|null} 不满足时返回提示文案，满足时返回 null
 */
function getTagConstraintError(editor, cursor, tag, settings, messages) {
  if (isTagExcluded(settings.excludedTags, tag.name)) {
    return messages.tagExcluded;
  }
  if (settings.ignoreInCodeBlocks && isInFencedCodeBlock(editor, cursor.line)) {
    return messages.tagInCodeContext;
  }
  if (settings.ignoreInlineCode && isInInlineCode(editor.getLine(cursor.line), cursor.ch)) {
    return messages.tagInCodeContext;
  }
  return null;
}

/**
 * 查找配对标签（全文范围，基于同名标签计数法，支持跨行与嵌套）。
 *
 *  - 开标签：从自身之后正向扫描，同名开标签 depth+1，同名闭标签 depth-1，
 *    depth 减到 0 时即配对闭标签。
 *  - 闭标签：从自身之前反向扫描，同名闭标签 depth+1，同名开标签 depth-1，
 *    depth 减到 0 时即配对开标签。
 *
 * 扫描时会跳过代码块、行内代码、排除标签与单标签（由 options 控制）。
 *
 * @param {object} editor CodeMirror 编辑器实例
 * @param {object} cursorTag 光标标签对象
 * @param {object} options { ignoreInCodeBlocks, ignoreInlineCode, excludedTags }
 * @returns {object|null} 配对标签对象，未找到时返回 null
 */
function findMatchingTag(editor, cursorTagInfo, options) {
  const name = cursorTagInfo.name.toLowerCase();
  const settings = options || {};
  let depth = 1;

  if (cursorTagInfo.isClosing) {
    // 反向扫描，寻找配对的开标签。
    for (let line = cursorTagInfo.line; line >= 0; line--) {
      const lineText = editor.getLine(line);
      const tags = scanLineTags(lineText).reverse();
      const inCodeBlock = settings.ignoreInCodeBlocks && isInFencedCodeBlock(editor, line);
      for (const tag of tags) {
        // 只处理光标标签之前的标签。
        if (line === cursorTagInfo.line && tag.index >= cursorTagInfo.index) continue;
        if (inCodeBlock) continue;
        if (settings.ignoreInlineCode && isInInlineCode(lineText, tag.index)) continue;
        if (isSingleTag(tag)) continue;
        if (settings.excludedTags && isTagExcluded(settings.excludedTags, tag.name)) continue;
        if (tag.name.toLowerCase() !== name) continue;
        if (!tag.isClosing) {
          depth--;
          if (depth === 0) return tag;
        } else {
          depth++;
        }
      }
    }
  } else {
    // 正向扫描，寻找配对的闭标签。
    for (let line = cursorTagInfo.line; line < editor.lineCount(); line++) {
      const lineText = editor.getLine(line);
      const tags = scanLineTags(lineText);
      const inCodeBlock = settings.ignoreInCodeBlocks && isInFencedCodeBlock(editor, line);
      for (const tag of tags) {
        // 只处理光标标签之后的标签。
        if (line === cursorTagInfo.line && tag.index <= cursorTagInfo.index) continue;
        if (inCodeBlock) continue;
        if (settings.ignoreInlineCode && isInInlineCode(lineText, tag.index)) continue;
        if (isSingleTag(tag)) continue;
        if (settings.excludedTags && isTagExcluded(settings.excludedTags, tag.name)) continue;
        if (tag.name.toLowerCase() !== name) continue;
        if (tag.isClosing) {
          depth--;
          if (depth === 0) return tag;
        } else {
          depth++;
        }
      }
    }
  }

  return null;
}

/**
 * 判断是否应为光标处开标签触发自动补全。
 *
 * 分两步：
 *  1. 正向扫描（文档头 → 光标标签之前），统计同名标签的未闭合数量（initialDepth）。
 *     开标签 +1，闭标签 -1，最终值即为"光标标签之前有多少未闭合的同名标签"。
 *  2. 以 initialDepth + 1 为起点（叠加上光标标签本身），向后扫描（光标标签之后 → 文档尾）。
 *     开标签 +1，闭标签 -1。
 *     - 当 initialDepth === 0（前面已平衡）：depth <= 0 即表示光标标签确定被闭合 → 不触发。
 *     - 当 initialDepth > 0（前面有未闭合标签）：depth < initialDepth 才确定被闭合；
 *       depth === initialDepth 为歧义（闭标签可能配对的是外层未闭合标签）→ 仍触发。
 *
 * 扫描过程中跟随设置跳过代码块、行内代码、排除标签与单标签内的标签。
 *
 * @param {object} editor CodeMirror 编辑器实例
 * @param {object} tag 光标标签对象
 * @param {object} options { ignoreInCodeBlocks, ignoreInlineCode, excludedTags }
 * @returns {boolean} 是否应触发自动补全
 */
function shouldAutoClose(editor, tag, options) {
  var settings = options || {};
  var name = tag.name.toLowerCase();

  // ---- 步骤 1：正向扫描，统计光标标签之前同名标签的未闭合数量 ----
  var initialDepth = 0;
  for (var line = 0; line <= tag.line; line++) {
    var lineText = editor.getLine(line);
    var tags = scanLineTags(lineText);
    if (line === tag.line) {
      // 当前行仅保留光标标签之前的标签（不包含自身）。
      tags = tags.filter(function (t) {
        return t.index + t.length <= tag.index;
      });
    }
    var inCodeBlock = settings.ignoreInCodeBlocks && isInFencedCodeBlock(editor, line);
    for (var i = 0; i < tags.length; i++) {
      var t = tags[i];
      if (inCodeBlock) continue;
      if (settings.ignoreInlineCode && isInInlineCode(lineText, t.index)) continue;
      if (isSingleTag(t)) continue;
      if (settings.excludedTags && isTagExcluded(settings.excludedTags, t.name)) continue;
      if (t.name.toLowerCase() !== name) continue;
      if (t.isClosing) {
        initialDepth--;
      } else {
        initialDepth++;
      }
    }
  }

  // ---- 步骤 2：向后扫描，判断光标标签是否已存在配对闭标签 ----
  var depth = initialDepth + 1; // 叠加上光标标签自身
  for (var line2 = tag.line; line2 < editor.lineCount(); line2++) {
    var lineText2 = editor.getLine(line2);
    var tags2 = scanLineTags(lineText2);
    if (line2 === tag.line) {
      // 当前行仅保留光标标签之后的标签（不包含自身）。
      tags2 = tags2.filter(function (t) {
        return t.index > tag.index;
      });
    }
    var inCodeBlock2 = settings.ignoreInCodeBlocks && isInFencedCodeBlock(editor, line2);
    for (var j = 0; j < tags2.length; j++) {
      var t2 = tags2[j];
      if (inCodeBlock2) continue;
      if (settings.ignoreInlineCode && isInInlineCode(lineText2, t2.index)) continue;
      if (isSingleTag(t2)) continue;
      if (settings.excludedTags && isTagExcluded(settings.excludedTags, t2.name)) continue;
      if (t2.name.toLowerCase() !== name) continue;
      if (t2.isClosing) {
        depth--;
      } else {
        depth++;
      }

      // 前面已平衡：depth <= 0 即光标标签确定被闭合 → 不触发。
      if (initialDepth === 0 && depth <= 0) return false;
      // 前面有未闭合标签：depth < initialDepth 才确定闭合，等于时为歧义。
      if (initialDepth > 0 && depth < initialDepth) return false;
    }
  }

  // 未找到确定配对 → 应触发补全。
  return true;
}

module.exports = {
  scanLineTags,
  cursorTag,
  isCursorInsideTag,
  tagNameEndPosition,
  isFenceStart,
  isInFencedCodeBlock,
  isInInlineCode,
  isSingleTag,
  isTagExcluded,
  getTagConstraintError,
  findMatchingTag,
  shouldAutoClose
};
