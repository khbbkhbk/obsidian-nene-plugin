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
  // 重置全局正则的 lastIndex，避免上次 exec 的残留状态影响本次匹配。
  TAG_PATTERN.lastIndex = 0;
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

// 模块级缓存：大文档避免重复构建代码块行号集合。
// 小文档（< 2000 行）直接重建，大文档基于 CodeMirror changeGeneration 做缓存。
var CODE_BLOCK_CACHE_THRESHOLD = 2000;
var _cachedEditor = null;
var _cachedGen = null;
var _cachedSet = null;

/**
 * 构建代码块内行号集合（一次性扫描全文）。
 * 围栏行本身不入集合，其上的标签在代码块之外。
 * @param {object} editor CodeMirror 编辑器实例
 * @returns {Set} 代码块内行号的集合
 */
function buildCodeBlockLines(editor) {
  var lineCount = editor.lineCount();

  // 小文档直接重建，不引入缓存复杂度。
  if (lineCount < CODE_BLOCK_CACHE_THRESHOLD) {
    var smallSet = new Set();
    var sInBlock = false;
    for (var sl = 0; sl < lineCount; sl++) {
      if (isFenceStart(editor, sl)) { sInBlock = !sInBlock; continue; }
      if (sInBlock) smallSet.add(sl);
    }
    return smallSet;
  }

  // 大文档：基于 CodeMirror 文档变更计数器判断是否需要重建。
  var gen;
  try { gen = editor.cm.doc.changeGeneration(); }
  catch (e) { gen = lineCount; }

  if (editor === _cachedEditor && gen === _cachedGen) {
    return _cachedSet;
  }

  var set = new Set();
  var inBlock = false;
  for (var bl = 0; bl < lineCount; bl++) {
    if (isFenceStart(editor, bl)) { inBlock = !inBlock; continue; }
    if (inBlock) set.add(bl);
  }

  _cachedEditor = editor;
  _cachedGen = gen;
  _cachedSet = set;
  return set;
}

/**
 * 判断行内字符位置是否位于行内代码（反引号包裹）中。
 * 注意：三个及以上连续反引号视为代码围栏而非行内代码，整簇跳过；
 * 仅 1~2 个反引号配对视为行内代码。
 * @param {string} line 行文本
 * @param {number} ch 字符位置
 * @returns {boolean} 是否位于行内代码内
 */
function isInInlineCode(line, ch) {
  // 从行首扫描反引号对：位置 ch 位于某一对反引号之间（含开/闭位置）即视为在行内代码内。
  // 未闭合的反引号从起始位置到行尾均视为在内部；闭合反引号之后不属于行内代码。
  let i = 0;
  while (i < line.length) {
    const start = line.indexOf('`', i);
    if (start === -1) break;
    // 光标在开反引号之前：不在当前对（也不在后续任何对）内。
    if (ch < start) return false;

    // 代码围栏（三个及以上连续反引号）不属于行内代码，整簇跳过。
    // 仅当 start+1 与 start+2 均为 '`' 时才视为围栏（避免误判双反引号行内代码）。
    if (start + 2 < line.length && line[start + 1] === '`' && line[start + 2] === '`') {
      let fenceEnd = start + 2;
      while (fenceEnd + 1 < line.length && line[fenceEnd + 1] === '`') {
        fenceEnd++;
      }
      i = fenceEnd + 1;
      continue;
    }

    const end = line.indexOf('`', start + 1);
    if (end === -1) {
      // 未闭合的反引号：从起始位置到行尾均视为在行内代码内。
      return ch >= start;
    }
    // 光标位于开/闭反引号之间（含边界位置）→ 在行内代码内。
    if (ch <= end) return true;
    // 已越过本对反引号，继续查找后续反引号对。
    i = end + 1;
  }
  return false;
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
 * @param {object|null} tag 标签对象（可能为 null：光标处无标签时跳过排除列表检查）
 * @param {object} settings 模块配置
 * @param {object} messages 中文提示文案对象（需包含 tagExcluded / tagInCodeContext）
 * @returns {string|null} 不满足时返回提示文案，满足时返回 null
 */
function getTagConstraintError(editor, cursor, tag, settings, messages) {
  // 排除列表检查依赖标签解析结果：光标处无标签时直接跳过。
  if (tag && isTagExcluded(settings.excludedTags, tag.name)) {
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

  // 若需忽略代码块，先构建代码块内行号集合（一次性扫描，避免逐行重复判断）。
  // 围栏行本身不入集合，其上的标签在代码块之外，与 findSkipTag / shouldAutoClose 逻辑一致。
  const codeBlockLines = settings.ignoreInCodeBlocks ? buildCodeBlockLines(editor) : new Set();

  if (cursorTagInfo.isClosing) {
    // 反向扫描，寻找配对的开标签。
    for (let line = cursorTagInfo.line; line >= 0; line--) {
      const lineText = editor.getLine(line);
      const tags = scanLineTags(lineText).reverse();
      const inCodeBlock = codeBlockLines.has(line);
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
          if (depth === 0) {
            // 补上行号字段：scanLineTags 的标签对象不含 line，调用方定位光标需要。
            return Object.assign({}, tag, { line: line });
          }
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
      const inCodeBlock = codeBlockLines.has(line);
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
          if (depth === 0) {
            // 补上行号字段：scanLineTags 的标签对象不含 line，调用方定位光标需要。
            return Object.assign({}, tag, { line: line });
          }
        } else {
          depth++;
        }
      }
    }
  }

  return null;
}

/**
 * 查找向左/向右跳转的最近目标标签（跳过标签命令）。
 *
 * 规则（与产品规格一致）：
 *  - 支持跳转至单标签与双标签；
 *  - 允许目标与当前标签同名，但绝不跳转至当前标签自身的匹配标签；
 *  - 优先跳转至开始标签（单标签与开始标签同级），无开始标签时退化为最近的闭合标签；
 *  - 在同类候选中取距离光标最近的标签（左跳取最靠右者，右跳取最靠左者）；
 *  - 约束跟随设置：忽略代码块、行内代码、排除列表中的标签。
 *
 * @param {object} editor CodeMirror 编辑器实例
 * @param {object} currentTag 光标所在标签对象（需含 line / index / isClosing）
 * @param {string} direction 'left' 向左跳过 / 'right' 向右跳过
 * @param {object} options { ignoreInCodeBlocks, ignoreInlineCode, excludedTags }
 * @returns {object|null} 目标标签对象（含 line 与全局 offset 字段），无目标时返回 null
 */
function findSkipTag(editor, currentTag, direction, options) {
  const settings = options || {};

  // 计算当前标签的全局字符偏移（文档头 → 光标标签起始），用于比较跳转距离。
  let cursorOffset = 0;
  for (let line = 0; line < currentTag.line; line++) {
    cursorOffset += editor.getLine(line).length + 1;
  }
  cursorOffset += currentTag.index;

  // 当前标签的匹配对：向左跳时若当前为闭合标签、向右跳时若当前为开始标签，
  // 其匹配标签位于搜索方向，需排除（绝不跳转至自身的匹配标签）。
  const pair = findMatchingTag(editor, currentTag, settings);

  // 若需忽略代码块，先构建代码块内行号集合（一次性扫描，避免逐行重复判断）。
  const codeBlockLines = settings.ignoreInCodeBlocks ? buildCodeBlockLines(editor) : new Set();

  // 高优先级候选：开始标签与单标签；低优先级候选：闭合标签。
  const high = [];
  const low = [];
  let offset = 0;
  for (let line = 0; line < editor.lineCount(); line++) {
    const text = editor.getLine(line);
    const tags = scanLineTags(text);
    const inCodeBlock = codeBlockLines.has(line);
    for (let i = 0; i < tags.length; i++) {
      const t = tags[i];
      const tOffset = offset + t.index;
      // 跳过当前标签自身。
      if (line === currentTag.line && t.index === currentTag.index) continue;
      // 仅收集搜索方向一侧的标签。
      if (direction === 'left' && tOffset >= cursorOffset) continue;
      if (direction === 'right' && tOffset <= cursorOffset) continue;
      // 约束过滤：代码块、行内代码、排除列表。
      if (inCodeBlock) continue;
      if (settings.ignoreInlineCode && isInInlineCode(text, t.index)) continue;
      if (settings.excludedTags && isTagExcluded(settings.excludedTags, t.name)) continue;
      // 排除当前标签自身的匹配标签。
      if (pair && line === pair.line && t.index === pair.index) continue;
      const candidate = Object.assign({}, t, { line, offset: tOffset });
      if (isSingleTag(t) || !t.isClosing) high.push(candidate);
      else low.push(candidate);
    }
    offset += text.length + 1;
  }

  const candidates = high.length ? high : low;
  if (candidates.length === 0) return null;

  // 同类候选中取距离光标最近的标签。
  if (direction === 'left') {
    candidates.sort(function (a, b) { return b.offset - a.offset; });
  } else {
    candidates.sort(function (a, b) { return a.offset - b.offset; });
  }
  return candidates[0];
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

  // 若需忽略代码块，先构建代码块内行号集合（一次性扫描，避免逐行重复判断）。
  // 围栏行本身不入集合，其上的标签在代码块之外，与 findSkipTag 逻辑一致。
  var codeBlockLines = settings.ignoreInCodeBlocks ? buildCodeBlockLines(editor) : new Set();

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
    var inCodeBlock = codeBlockLines.has(line);
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
  console.log('[DEBUG shouldAutoClose]', '光标=' + tag.line + ':' + tag.index, '标签=<' + name + '>',
    'initialDepth=' + initialDepth, '忽略代码块=' + settings.ignoreInCodeBlocks,
    '代码块集合=', Array.from(codeBlockLines));
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
    var inCodeBlock2 = codeBlockLines.has(line2);
    for (var j = 0; j < tags2.length; j++) {
      var t2 = tags2[j];
      var t2Name = t2.name.toLowerCase();
      if (inCodeBlock2) {
        if (t2Name === name) console.log('[DEBUG] 行' + line2 + ' 同名标签被代码块过滤', t2.isClosing ? '</' + t2.name + '>' : '<' + t2.name + '>');
        continue;
      }
      if (settings.ignoreInlineCode && isInInlineCode(lineText2, t2.index)) continue;
      if (isSingleTag(t2)) continue;
      if (settings.excludedTags && isTagExcluded(settings.excludedTags, t2.name)) continue;
      if (t2Name !== name) continue;
      if (t2.isClosing) {
        depth--;
        console.log('[DEBUG] 行' + line2 + ' 命中闭标签 depth→' + depth);
      } else {
        depth++;
        console.log('[DEBUG] 行' + line2 + ' 命中开标签 depth→' + depth);
      }

      // 前面已平衡：depth <= 0 即光标标签确定被闭合 → 不触发。
      if (initialDepth === 0 && depth <= 0) return false;
      // 前面有未闭合标签：depth < initialDepth 才确定闭合，等于时为歧义。
      if (initialDepth > 0 && depth < initialDepth) return false;
    }
  }

  // 未找到确定配对 → 应触发补全。
  console.log('[DEBUG] 步骤2扫描完 depth=' + depth + ' initialDepth=' + initialDepth + ' → 返回true');
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
  findSkipTag,
  shouldAutoClose
};
