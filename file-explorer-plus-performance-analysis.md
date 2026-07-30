# File Explorer Plus 插件性能分析与优化方案

> 基于 Chrome DevTools Performance 火焰图与源码分析
> 分析对象：`plugin:file-explorer-plus` (Obsidian 插件)

---

## 一、问题概述

### 1.1 火焰图关键数据

| 函数 | 自身耗时 | 占比 | 总耗时（含子调用）| 占比 |
|------|---------|------|----------------|------|
| `checkPathFilter` | **3,140 ms** | **73.2%** | 3,176 ms | 74.0% |
| `changeVirtualElementPin` | 279 ms | 6.5% | 575 ms | 13.4% |
| `t.sort`（匿名） | 237 ms | 5.5% | 4,221 ms | 98.3% |

**结论**：`checkPathFilter` 是绝对的性能瓶颈，单次排序操作耗时超过 3 秒，已严重影响 Obsidian 文件树的交互流畅度。

### 1.2 触发场景

- 文件树展开/折叠文件夹
- 切换置顶/隐藏筛选器
- 文件重命名、新增、删除
- 标签元数据变更
- 插件设置修改

每次触发都会调用 `Folder.prototype.sort`，进而对当前文件夹下的**所有子项**执行全量匹配。

---

## 二、根因分析

### 2.1 重复编译正则与 Wildcard（最大元凶）

源码位置：`src/utils.ts` → `checkPathFilter` / `checkTagFilter`

```javascript
if (filter.patternType === "REGEX") {
    const re = new RegExp(filter.pattern);              // ❌ 每次调用都 new
    if (re.test(file.path) || re.test(...) || ...) {
        return true;
    }
} else if (filter.patternType === "WILDCARD") {
    const isMatch2 = index_es_default(filter.pattern);  // ❌ 每次调用都编译
    if (isMatch2(file.path) || isMatch2(...) || ...) {
        return true;
    }
}
```

**问题**：
- `new RegExp()` 和 `wildcardMatch()` 的编译开销极高。
- `sort` 触发时，会遍历 **每个文件 × 每个 filter** 调用一次 `checkPathFilter`。
- 假设 vault 有 1,000 个文件、配置了 10 个 filter，单次排序将触发 **10,000 次正则/通配符编译**。

### 2.2 全量 O(n×m) 暴力扫描

源码位置：`src/main.ts` → `patchFileExplorerFolder` → `sort`

```javascript
let paths = virtualElements.map((el) => el.file);
if (plugin.settings.hideFilters.active) {
    const pathsToHide = plugin.getPathsToHide(paths);   // O(n×m)
    // ...
}
if (plugin.settings.pinFilters.active) {
    const pathsToPin = plugin.getPathsToPin(paths);     // O(n×m)
    // ...
}
```

**问题**：
- 没有任何缓存机制，每次排序都对当前文件夹下所有文件重新计算匹配结果。
- 实际场景中，真正发生变更的文件往往只有 1~2 个，但插件却做了全量重算。

### 2.3 循环内直接操作 DOM

源码位置：`src/utils.ts` → `changeVirtualElementPin`

```javascript
function changeVirtualElementPin(vEl, pin) {
    if (pin && !vEl.el.hasClass("tree-item-pinned")) {
        vEl.el.addClass("tree-item-pinned");            // ❌ 触发 Reflow
        const pinDiv = document.createElement("div");     // ❌ DOM 创建
        // ...
        vEl.el.firstChild.insertBefore(pinDiv, ...);      // ❌ DOM 插入
    } else if (!pin) {
        vEl.el.removeClass("tree-item-pinned");
        // ...
    }
}
```

**问题**：
- `sort` 循环内逐一对每个虚拟元素调用 `changeVirtualElementPin`，执行真实 DOM 操作。
- 频繁的 `addClass` / `removeClass` / `insertBefore` 会导致浏览器**布局重排（Reflow）**和**重绘（Repaint）**。
- 当文件树节点较多时，DOM 操作开销会呈指数级放大。

### 2.4 STRICT 模式未走短路逻辑

`STRICT` 模式本质上是**精确匹配路径**，完全不需要正则引擎。但源码中仍将其与 REGEX/WILDCARD 混在同一套逻辑里处理，没有利用 `Set` / `Map` 做 O(1) 查找。

---

## 三、优化方案

### 3.1 方案一：预编译正则与 Wildcard（立竿见影）

**目标**：将编译开销从"每次匹配"转移到"filter 创建/修改时"，消除重复编译。

**实现方式**：

在设置加载或 filter 变更时，为每个 filter 预编译匹配器：

```typescript
// settings.ts 或插件加载逻辑中
function compileFilters(filters: Filter[]) {
    filters.forEach(f => {
        if (!f.active || !f.pattern) {
            f._matcher = null;
            return;
        }
        if (f.patternType === 'REGEX') {
            try {
                f._regex = new RegExp(f.pattern);
            } catch {
                f._regex = null;
            }
        } else if (f.patternType === 'WILDCARD') {
            f._matcher = wildcardMatch(f.pattern);
        } else {
            f._matcher = null; // STRICT 走单独逻辑
        }
    });
}

// 在 loadSettings / onChange / saveSettings 后调用
compileFilters(this.settings.pinFilters.paths);
compileFilters(this.settings.pinFilters.tags);
compileFilters(this.settings.hideFilters.paths);
compileFilters(this.settings.hideFilters.tags);
```

改造后的 `checkPathFilter`：

```typescript
function checkPathFilter(filter, file) {
    if (!filter.active || filter.pattern === "") return false;
    if (filter.type == "FILES" && file instanceof TFolder) return false;
    if (filter.type == "DIRECTORIES" && file instanceof TFile) return false;

    if (filter.patternType === "REGEX") {
        if (!filter._regex) return false;
        return filter._regex.test(file.path) 
            || filter._regex.test(file.path.replace(/\.md$/g, ""))
            || filter._regex.test(file.basename || file.name);
    } else if (filter.patternType === "WILDCARD") {
        if (!filter._matcher) return false;
        return filter._matcher(file.path)
            || filter._matcher(file.path.replace(/\.md$/g, ""))
            || filter._matcher(file.basename || file.name);
    } else { // STRICT
        const target = file.path.replace(/\.md$/g, "");
        return file.path === filter.pattern 
            || target === filter.pattern 
            || (file.basename || file.name) === filter.pattern;
    }
}
```

**预期收益**：消除 90% 以上的 `RegExp` / `wildcardMatch` 编译开销，该函数耗时预计下降 **80%~95%**。

---

### 3.2 方案二：STRICT 模式走 Map 短路（O(1) 查找）

**目标**：将精确匹配从线性扫描升级为哈希查找。

**实现方式**：

```typescript
class FileExplorerPlusPlugin extends Plugin {
    private strictHidePaths: Set<string> = new Set();
    private strictPinPaths: Set<string> = new Set();

    rebuildStrictMaps() {
        this.strictHidePaths.clear();
        this.strictPinPaths.clear();

        this.settings.hideFilters.paths
            .filter(f => f.active && f.patternType === 'STRICT')
            .forEach(f => this.strictHidePaths.add(f.pattern));

        this.settings.pinFilters.paths
            .filter(f => f.active && f.patternType === 'STRICT')
            .forEach(f => this.strictPinPaths.add(f.pattern));
    }

    checkStrictHide(file: TAbstractFile): boolean {
        return this.strictHidePaths.has(file.path) 
            || this.strictHidePaths.has(file.path.replace(/\.md$/, ''))
            || this.strictHidePaths.has(file.name);
    }
}
```

在 `getPathsToHide` / `getPathsToPin` 中优先查 Map：

```typescript
getPathsToHide(paths) {
    return paths.filter(path => {
        if (!path) return false;
        // 先走 O(1) STRICT 短路
        if (this.checkStrictHide(path)) return true;
        // 再走预编译的 REGEX / WILDCARD
        return this.settings.hideFilters.paths.some(f => 
            f.patternType !== 'STRICT' && checkPathFilter(f, path)
        ) || this.settings.hideFilters.tags.some(f => checkTagFilter(f, path));
    });
}
```

**预期收益**：STRICT 模式匹配从 O(m) 降至 O(1)，若用户大量使用右键菜单创建的 STRICT 规则，收益极为显著。

---

### 3.3 方案三：文件级缓存（增量更新）

**目标**：避免每次排序都对所有文件重新计算 pin/hide 状态。

**实现方式**：

```typescript
interface FileState {
    pinned: boolean;
    hidden: boolean;
    lastChecked: number;
}

class FileExplorerPlusPlugin extends Plugin {
    private fileStateCache: Map<string, FileState> = new Map();
    private cacheVersion = 0;

    // 设置变更时递增版本号，使旧缓存失效
    invalidateCache() {
        this.cacheVersion++;
        this.fileStateCache.clear();
    }

    getFileState(file: TAbstractFile): FileState {
        const cached = this.fileStateCache.get(file.path);
        if (cached) return cached;

        const state: FileState = {
            pinned: this.shouldPin(file),
            hidden: this.shouldHide(file),
            lastChecked: this.cacheVersion
        };
        this.fileStateCache.set(file.path, state);
        return state;
    }

    // 在 rename / delete / metadata changed 时只更新单个文件
    updateFileState(file: TAbstractFile) {
        this.fileStateCache.delete(file.path);
        this.fileStateCache.delete(file.path.replace(/\.md$/, ''));
    }
}
```

在 `sort` 中使用缓存：

```typescript
sort(old) {
    return function(...args) {
        old.call(this, ...args);

        const virtualElements = this.vChildren.children;
        const visible: any[] = [];
        const hidden: any[] = [];
        const pinned: any[] = [];
        const normal: any[] = [];

        for (const vEl of virtualElements) {
            const state = plugin.getFileState(vEl.file);

            if (state.hidden) {
                vEl.info.hidden = true;
                hidden.push(vEl);
            } else {
                vEl.info.hidden = false;
                visible.push(vEl);

                if (state.pinned) {
                    vEl.info.pinned = true;
                    pinned.push(vEl);
                } else {
                    vEl.info.pinned = false;
                    normal.push(vEl);
                }
            }
        }

        this.hiddenVChildren = hidden;

        // 批量更新 DOM，而非在循环中逐个操作
        const result = [...pinned, ...normal];
        this.vChildren.setChildren(result);

        // 批量应用 pin 样式（可放到 requestAnimationFrame 中）
        requestAnimationFrame(() => {
            pinned.forEach(vEl => changeVirtualElementPin(vEl, true));
            normal.forEach(vEl => changeVirtualElementPin(vEl, false));
        });
    };
}
```

**预期收益**：
- 日常操作（如展开单个文件夹）只需计算新增可见文件，其余文件直接读缓存。
- 排序耗时从 O(n×m) 降至接近 O(n)。

---

### 3.4 方案四：DOM 操作与排序逻辑分离

**目标**：消除循环内的 DOM 操作导致的 Reflow。

**实现方式**：

1. **排序阶段只计算状态**，不触碰 DOM。
2. **批量更新阶段统一操作 DOM**。

```typescript
// 改造 changeVirtualElementPin，使其支持"只计算、不操作"
function changeVirtualElementPin(vEl, pin, applyDOM = true) {
    if (!applyDOM) {
        vEl.info.pinned = pin;
        return vEl;
    }
    // 原有 DOM 操作逻辑...
}

// 在 sort 中先批量计算
const toPin: any[] = [];
const toUnpin: any[] = [];

virtualElements.forEach(vEl => {
    if (shouldPin) toPin.push(vEl);
    else toUnpin.push(vEl);
});

// 统一应用（利用 DocumentFragment 或 requestAnimationFrame）
requestAnimationFrame(() => {
    toPin.forEach(vEl => changeVirtualElementPin(vEl, true));
    toUnpin.forEach(vEl => changeVirtualElementPin(vEl, false));
});
```

**预期收益**：减少浏览器重排次数，DOM 相关耗时下降 **50%~70%**。

---

### 3.5 方案五：Filter 前置过滤

**目标**：减少无效 filter 的遍历。

**实现方式**：

```typescript
getPathsToHide(paths) {
    // 提前过滤掉未启用的 filter
    const activeHidePathFilters = this.settings.hideFilters.paths.filter(f => f.active);
    const activeHideTagFilters = this.settings.hideFilters.tags.filter(f => f.active);

    if (activeHidePathFilters.length === 0 && activeHideTagFilters.length === 0) {
        return []; // 短路：没有任何隐藏规则时直接返回
    }

    return paths.filter(path => {
        if (!path) return false;
        return activeHidePathFilters.some(f => checkPathFilter(f, path))
            || activeHideTagFilters.some(f => checkTagFilter(f, path));
    });
}
```

---

## 四、实施优先级与预期收益

| 优先级 | 方案 | 改动量 | 预期性能提升 | 说明 |
|--------|------|--------|-------------|------|
| P0 | 3.1 预编译正则/Wildcard | 小 | **5~10x** | 只改 `checkPathFilter` 和设置加载逻辑，收益最大 |
| P0 | 3.2 STRICT 模式 Map 化 | 小 | **2~5x** | 若用户多使用右键菜单创建规则，收益极高 |
| P1 | 3.5 Filter 前置过滤 | 极小 | **10%~30%** | 一行代码的短路优化 |
| P1 | 3.3 文件级缓存 | 中 | **2~3x** | 对日常交互体验提升明显 |
| P2 | 3.4 DOM 操作分离 | 中 | **30%~50%** | 主要优化渲染卡顿，对总耗时影响次之 |

**综合预期**：实施 P0 + P1 方案后，单次排序耗时预计从 **3,140ms** 降至 **100~300ms**；全部实施后，可降至 **50ms 以内**。

---

## 五、改造检查清单

- [ ] 在 `Filter` 类型定义中增加 `_regex?: RegExp` 和 `_matcher?: Function` 字段
- [ ] 在 `loadSettings` / `saveSettings` / filter 增删改时调用 `compileFilters()`
- [ ] 改造 `checkPathFilter` 和 `checkTagFilter`，使用预编译对象
- [ ] 为 STRICT 模式维护 `Set<string>`，在 `getPathsToHide/Pin` 中优先匹配
- [ ] 增加 `fileStateCache: Map<string, FileState>`，在文件事件回调中增量更新
- [ ] 改造 `sort` 方法，将 DOM 操作抽离到 `requestAnimationFrame` 批量执行
- [ ] 在 `getPathsToHide/Pin` 入口处增加 active filter 的短路判断
- [ ] 使用 DevTools Performance 重新录制火焰图，验证优化效果

---

## 六、附录：关键源码引用

### 6.1 原 `checkPathFilter`（问题代码）

```javascript
// src/utils.ts
function checkPathFilter(filter, file) {
    if (!filter.active || filter.pattern === "") return false;
    if (filter.type == "FILES" && file instanceof TFolder) return false;
    if (filter.type == "DIRECTORIES" && file instanceof TFile) return false;

    if (filter.patternType === "REGEX") {
        const re = new RegExp(filter.pattern);              // ❌ 重复编译
        if (re.test(file.path) || ...) return true;
    } else if (filter.patternType === "WILDCARD") {
        const isMatch2 = index_es_default(filter.pattern);  // ❌ 重复编译
        if (isMatch2(file.path) || ...) return true;
    } else {
        if (file.path === filter.pattern || ...) return true;
    }
    return false;
}
```

### 6.2 原 `sort` 补丁（问题代码）

```javascript
// src/main.ts → patchFileExplorerFolder
sort(old) {
    return function(...args) {
        old.call(this, ...args);
        let virtualElements = this.vChildren.children;
        let paths = virtualElements.map((el) => el.file);

        if (plugin.settings.hideFilters.active) {
            const pathsToHide = plugin.getPathsToHide(paths); // ❌ 全量计算
            // ...
        }

        virtualElements = this.vChildren.children;
        paths = virtualElements.map((el) => el.file);

        if (plugin.settings.pinFilters.active) {
            const pathsToPin = plugin.getPathsToPin(paths);     // ❌ 全量计算
            for (let vEl of virtualElements) {
                if (pathsToPinLookUp[vEl.file.path]) {
                    vEl = changeVirtualElementPin(vEl, true);   // ❌ 循环内 DOM 操作
                    // ...
                }
            }
        }
        this.vChildren.setChildren(virtualElements);
    };
}
```

---

*文档生成时间：2026-07-30*
*分析依据：Chrome DevTools Performance 火焰图 + 插件 bundle 源码*
