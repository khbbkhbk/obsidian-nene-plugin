'use strict';

var obsidian = require('obsidian');
var around = require('monkey-around').around || require('monkey-around');

// ============================================================
//  方案一：预编译正则与 Wildcard —— checkPathFilter 复用预编译对象
//  方案二：STRICT 模式 Map 化 —— O(1) 查找
//  方案三：Filter 前置过滤 —— 入口短路 + active filter 预过滤
//  方案四：文件级缓存 —— fileStateCache 避免全量重算
//  方案五：DOM 操作分离 —— sort 只计算状态，批量 rAF 操作 DOM
// ============================================================

// 为虚拟元素添加或移除图钉图标。支持 applyDOM = false 仅标记状态。
// @private-api 依赖 Obsidian 内部 PathVirtualElement 结构。
function changeVirtualElementPin(vEl, pin, applyDOM) {
  if (applyDOM === undefined) applyDOM = true;

  if (pin) {
    vEl.info.pinned = true;
    if (applyDOM && !vEl.el.hasClass('tree-item-pinned')) {
      vEl.el.addClass('tree-item-pinned');
      var pinDiv = document.createElement('div');
      pinDiv.addClass('file-explorer-plus');
      pinDiv.addClass('pin-icon');
      obsidian.setIcon(pinDiv, 'pin');
      if (vEl.el.firstChild) {
        vEl.el.firstChild.insertBefore(pinDiv, vEl.el.firstChild.firstChild);
      }
    }
  } else {
    vEl.info.pinned = false;
    if (applyDOM && vEl.el.hasClass('tree-item-pinned')) {
      vEl.el.removeClass('tree-item-pinned');
      var firstChild = vEl.el.firstChild;
      if (firstChild && firstChild.children) {
        var pinIcons = Array.from(firstChild.children).filter(function (el) {
          return el.hasClass('pin-icon');
        });
        pinIcons.forEach(function (icon) {
          if (firstChild) firstChild.removeChild(icon);
        });
      }
    }
  }

  return vEl;
}

// 检查文件或文件夹是否匹配给定的路径过滤器规则（使用预编译匹配器）。
// --- 优化点：使用 filter._regex / filter._matcher 预编译对象，不再每次编译 ---
function checkPathFilter(filter, file) {
  if (!filter.active || filter.pattern === '') return false;

  if (filter.type === 'FILES' && file instanceof obsidian.TFolder) return false;
  if (filter.type === 'DIRECTORIES' && file instanceof obsidian.TFile) return false;

  // STRICT 模式：精确字符串匹配（走 Map 短路后通常不会进入此分支）
  if (filter.patternType === 'STRICT') {
    return file.path === filter.pattern
      || file.path.replace(/\.md$/g, '') === filter.pattern
      || (file.basename || file.name) === filter.pattern;
  }

  // REGEX 模式：使用预编译的正则
  if (filter.patternType === 'REGEX') {
    if (!filter._regex) return false;
    return filter._regex.test(file.path)
      || filter._regex.test(file.path.replace(/\.md$/g, ''))
      || filter._regex.test(file.basename || file.name);
  }

  // WILDCARD 模式：使用预编译的匹配函数
  if (filter.patternType === 'WILDCARD') {
    if (!filter._matcher) return false;
    return filter._matcher(file.path)
      || filter._matcher(file.path.replace(/\.md$/g, ''))
      || filter._matcher(file.basename || file.name);
  }

  return false;
}

// 检查文件或文件夹是否匹配给定的路径过滤器规则（使用预编译匹配器）。
// 与 checkPathFilter 等价，但不检查 filter.active，用于识别被眼睛按钮停用的过滤器。
function checkPathFilterAllowInactive(filter, file) {
  if (!filter || filter.pattern === '') return false;

  if (filter.type === 'FILES' && file instanceof obsidian.TFolder) return false;
  if (filter.type === 'DIRECTORIES' && file instanceof obsidian.TFile) return false;

  // STRICT 模式：精确字符串匹配
  if (filter.patternType === 'STRICT') {
    return file.path === filter.pattern
      || file.path.replace(/\.md$/g, '') === filter.pattern
      || (file.basename || file.name) === filter.pattern;
  }

  // REGEX 模式：使用预编译的正则
  if (filter.patternType === 'REGEX') {
    if (!filter._regex) return false;
    return filter._regex.test(file.path)
      || filter._regex.test(file.path.replace(/\.md$/g, ''))
      || filter._regex.test(file.basename || file.name);
  }

  // WILDCARD 模式：使用预编译的匹配函数
  if (filter.patternType === 'WILDCARD') {
    if (!filter._matcher) return false;
    return filter._matcher(file.path)
      || filter._matcher(file.path.replace(/\.md$/g, ''))
      || filter._matcher(file.basename || file.name);
  }

  return false;
}

// 判断文件是否被眼睛按钮临时显示（根目录 Set 或子目录历史过滤器命中）。
function isFileTemporarilyRevealed(plugin, file) {
  // 根目录：命中 _eyeRevealedPaths 集合
  if (plugin._eyeRevealedPaths && plugin._eyeRevealedPaths.has(file.path)) return true;

  // 子目录：命中 _eyeToggleHistory 中被停用的隐藏过滤器
  var history = plugin._eyeToggleHistory;
  if (history && history.length > 0) {
    var hidePaths = plugin.fileExplorerEnhancerSettings.hideFilters.paths;
    for (var i = 0; i < history.length; i++) {
      var f = hidePaths[history[i]];
      if (f && checkPathFilterAllowInactive(f, file)) return true;
    }
  }

  return false;
}

// 监听文件重命名事件，自动更新严格模式下的路径规则（含子文件），并同步更新缓存。
function addOnRename(plugin) {
  plugin.registerEvent(
    plugin.app.vault.on('rename', function (file, oldPath) {
      var settings = plugin.fileExplorerEnhancerSettings;
      var newPath = file.path;
      var hasChanged = false;
      var oldPathPrefix = oldPath + '/';
      var isFolder = file instanceof obsidian.TFolder;

      // 更新隐藏选择器的 STRICT 规则：匹配自身或子文件
      for (var i = 0; i < settings.hideFilters.paths.length; i++) {
        var hf = settings.hideFilters.paths[i];
        if (hf.patternType !== 'STRICT' || !hf.pattern) continue;

        if (hf.pattern === oldPath) {
          // 被重命名的文件/文件夹本身
          hf.pattern = newPath;
          hasChanged = true;
        } else if (isFolder && hf.pattern.indexOf(oldPathPrefix) === 0) {
          // 文件夹被重命名时，更新其下所有子文件/子文件夹的 STRICT 规则
          hf.pattern = newPath + '/' + hf.pattern.slice(oldPathPrefix.length);
          hasChanged = true;
        }
      }

      // 更新置顶选择器的 STRICT 规则：同上逻辑
      for (var j = 0; j < settings.pinFilters.paths.length; j++) {
        var pf = settings.pinFilters.paths[j];
        if (pf.patternType !== 'STRICT' || !pf.pattern) continue;

        if (pf.pattern === oldPath) {
          pf.pattern = newPath;
          hasChanged = true;
        } else if (isFolder && pf.pattern.indexOf(oldPathPrefix) === 0) {
          pf.pattern = newPath + '/' + pf.pattern.slice(oldPathPrefix.length);
          hasChanged = true;
        }
      }

      if (hasChanged) {
        plugin.fileExplorerEnhancerStore.updateFileState(file);
        plugin.fileExplorerEnhancerStore.save();
        if (plugin._fileExplorerView) {
          plugin._fileExplorerView.requestSort();
        }
      }
    })
  );
}

// 监听文件删除事件，自动移除对应严格模式下的路径规则（含子文件）。
function addOnDelete(plugin) {
  plugin.registerEvent(
    plugin.app.vault.on('delete', function (file) {
      var settings = plugin.fileExplorerEnhancerSettings;
      var deletedPath = file.path;
      var hasChanged = false;
      var deletedPathPrefix = deletedPath + '/';
      var isFolder = file instanceof obsidian.TFolder;

      // 移除隐藏选择器中匹配的 STRICT 规则（自身 + 子文件）
      var newHidePaths = [];
      for (var i = 0; i < settings.hideFilters.paths.length; i++) {
        var hf = settings.hideFilters.paths[i];
        if (hf.patternType === 'STRICT' && hf.pattern) {
          if (hf.pattern === deletedPath || (isFolder && hf.pattern.indexOf(deletedPathPrefix) === 0)) {
            hasChanged = true;
            continue; // 跳过此项（删除）
          }
        }
        newHidePaths.push(hf);
      }
      settings.hideFilters.paths = newHidePaths;

      // 移除置顶选择器中匹配的 STRICT 规则（自身 + 子文件）
      var newPinPaths = [];
      for (var j = 0; j < settings.pinFilters.paths.length; j++) {
        var pf = settings.pinFilters.paths[j];
        if (pf.patternType === 'STRICT' && pf.pattern) {
          if (pf.pattern === deletedPath || (isFolder && pf.pattern.indexOf(deletedPathPrefix) === 0)) {
            hasChanged = true;
            continue;
          }
        }
        newPinPaths.push(pf);
      }
      settings.pinFilters.paths = newPinPaths;

      if (hasChanged) {
        plugin.fileExplorerEnhancerStore.updateFileState(file);
        plugin.fileExplorerEnhancerStore.save();
        if (plugin._fileExplorerView) {
          plugin._fileExplorerView.requestSort();
        }
      }
    })
  );
}

// 注册右键菜单目标缓存事件。
function cacheFileMenuTarget(plugin) {
  plugin.registerEvent(
    plugin.app.workspace.on('file-menu', function (menu, path) {
      plugin.fileExplorerEnhancerStore._lastMenuTarget = path;
    })
  );
}

// 注册两个 Obsidian 命令：置顶/取消置顶、隐藏。
function addCommands(plugin) {
  plugin.addCommand({
    id: 'pin-or-unpin-file-or-folder',
    name: '置顶/取消置顶文件或文件夹',
    callback: function () {
      var target = plugin.fileExplorerEnhancerStore._lastMenuTarget;
      if (!target) target = plugin.app.workspace.getActiveFile();
      if (!target) { new obsidian.Notice('没有可操作的目标'); return; }

      var settings = plugin.fileExplorerEnhancerSettings;
      var type = target instanceof obsidian.TFile ? 'FILES' : 'DIRECTORIES';
      var index = settings.pinFilters.paths.findIndex(function (filter) {
        return filter.patternType === 'STRICT' && filter.type === type && filter.pattern === target.path;
      });

      if (index === -1 || !settings.pinFilters.paths[index].active) {
        if (index === -1) {
          settings.pinFilters.paths.push({ name: '', active: true, type: type, pattern: target.path, patternType: 'STRICT' });
        } else {
          settings.pinFilters.paths[index].active = true;
        }
        new obsidian.Notice('已置顶：' + target.path);
      } else {
        settings.pinFilters.paths.splice(index, 1);
        new obsidian.Notice('已取消置顶：' + target.path);
      }

      plugin.fileExplorerEnhancerStore.save();
      if (settings.pinFilters.active && plugin._fileExplorerView) {
        plugin._fileExplorerView.requestSort();
      }
    }
  });

  plugin.addCommand({
    id: 'hide-file-or-folder',
    name: '隐藏文件或文件夹',
    callback: function () {
      var target = plugin.fileExplorerEnhancerStore._lastMenuTarget;
      if (!target) target = plugin.app.workspace.getActiveFile();
      if (!target) { new obsidian.Notice('没有可操作的目标'); return; }

      var settings = plugin.fileExplorerEnhancerSettings;
      var type = target instanceof obsidian.TFile ? 'FILES' : 'DIRECTORIES';
      var index = settings.hideFilters.paths.findIndex(function (filter) {
        return filter.patternType === 'STRICT' && filter.type === type && filter.pattern === target.path;
      });

      if (index === -1) {
        settings.hideFilters.paths.push({ name: '', active: true, type: type, pattern: target.path, patternType: 'STRICT' });
        new obsidian.Notice('已隐藏：' + target.path);
      } else {
        if (!settings.hideFilters.paths[index].active) {
          settings.hideFilters.paths[index].active = true;
          new obsidian.Notice('已隐藏：' + target.path);
        }
      }

      plugin.fileExplorerEnhancerStore.save();
      if (settings.hideFilters.active && plugin._fileExplorerView) {
        plugin._fileExplorerView.requestSort();
      }
    }
  });
}

// 对文件资源管理器的排序方法进行 monkey-patch，实现置顶与隐藏逻辑。
// --- 优化点：文件级缓存 + DOM 操作分离（只计算状态，rAF 批量更新 DOM）---
// @private-api 依赖 FileExplorerFolder 内部原型链。
function patchFileExplorerFolder(plugin, fileExplorerView) {
  var leaf = plugin.app.workspace.getLeaf(true);
  // @ts-expect-error
  var tmpFolder = new obsidian.TFolder(obsidian.Vault, '');
  var Folder = fileExplorerView.createFolderDom(tmpFolder).constructor;

  plugin.register(
    around(Folder.prototype, {
      sort: function (old) {
        return function () {
          var store = plugin.fileExplorerEnhancerStore;
          var settings = plugin.fileExplorerEnhancerSettings;

          old.call(this);

          // 模块关闭时跳过所有置顶/隐藏逻辑，确保 monkey-patch 不持续生效
          if (!plugin.isFileExplorerEnhancerEnabled()) return;

          if (!this.hiddenVChildren) {
            this.hiddenVChildren = [];
          }

          var virtualElements = this.vChildren.children;

          // 状态计算阶段：只读缓存或计算，不操作 DOM
          var hiddenVChildren = [];
          var pinnedVChildren = [];
          var unpinnedVChildren = [];
          var revealedVChildren = []; // 根目录 eye 按钮临时显示的文件

          for (var i = 0; i < virtualElements.length; i++) {
            var vEl = virtualElements[i];
            var state = store.getFileState(vEl.file);

            // 检查是否被眼睛按钮临时显示（根目录 Set 或子目录历史过滤器）
            var isRevealed = isFileTemporarilyRevealed(plugin, vEl.file);

            if (settings.hideFilters.active && state.hidden && !isRevealed) {
              vEl.info.hidden = true;
              hiddenVChildren.push(vEl);
            } else {
              vEl.info.hidden = false;

              if (isRevealed) {
                // 眼睛按钮临时显示：清除置顶标记，追加到列表末尾
                changeVirtualElementPin(vEl, false, false);
                revealedVChildren.push(vEl);
              } else if (settings.pinFilters.active && state.pinned) {
                // 仅标记状态，不操作 DOM
                changeVirtualElementPin(vEl, true, false);
                pinnedVChildren.push(vEl);
              } else {
                changeVirtualElementPin(vEl, false, false);
                unpinnedVChildren.push(vEl);
              }
            }
          }

          this.hiddenVChildren = hiddenVChildren;

          if (settings.pinFilters.active) {
            this.vChildren.setChildren(pinnedVChildren.concat(unpinnedVChildren).concat(revealedVChildren));
          } else {
            // 置顶关闭时统一清除图钉图标，眼睛显示项追加到末尾
            var normalVisible = unpinnedVChildren.map(function (v) { return changeVirtualElementPin(v, false, false); });
            var pinnedCleared = pinnedVChildren.map(function (v) { return changeVirtualElementPin(v, false, false); });
            var revealedCleared = revealedVChildren.map(function (v) { return changeVirtualElementPin(v, false, false); });
            this.vChildren.setChildren(pinnedCleared.concat(normalVisible).concat(revealedCleared));
          }

          // DOM 批量更新阶段：通过 requestAnimationFrame 合并在同一帧
          var rafId = this.__feRafId;
          if (rafId) cancelAnimationFrame(rafId);
          this.__feRafId = requestAnimationFrame(function () {
            var allEls = this.vChildren.children;
            for (var k = 0; k < allEls.length; k++) {
              var v = allEls[k];

              // 眼睛按钮临时显示项：添加半透明样式，其余项移除
              var isRevealed = isFileTemporarilyRevealed(plugin, v.file);
              if (isRevealed && !v.el.hasClass('nene-eye-revealed')) {
                v.el.addClass('nene-eye-revealed');
              } else if (!isRevealed && v.el.hasClass('nene-eye-revealed')) {
                v.el.removeClass('nene-eye-revealed');
              }

              if (v.info.pinned && !v.el.hasClass('tree-item-pinned')) {
                v.el.addClass('tree-item-pinned');
                var pinDiv = document.createElement('div');
                pinDiv.addClass('file-explorer-plus');
                pinDiv.addClass('pin-icon');
                obsidian.setIcon(pinDiv, 'pin');
                if (v.el.firstChild) {
                  v.el.firstChild.insertBefore(pinDiv, v.el.firstChild.firstChild);
                }
              } else if (!v.info.pinned && v.el.hasClass('tree-item-pinned')) {
                v.el.removeClass('tree-item-pinned');
                var fc = v.el.firstChild;
                if (fc && fc.children) {
                  var icons = Array.from(fc.children).filter(function (e) { return e.hasClass('pin-icon'); });
                  icons.forEach(function (icon) { if (fc) fc.removeChild(icon); });
                }
              }
            }

            // 隐藏项不在 vChildren 中，单独清理残留的临时显示样式类
            var hiddenEls = this.hiddenVChildren || [];
            for (var h = 0; h < hiddenEls.length; h++) {
              var hv = hiddenEls[h];
              if (hv.el.hasClass('nene-eye-revealed')) {
                hv.el.removeClass('nene-eye-revealed');
              }
            }
          }.bind(this));
        };
      }
    })
  );

  leaf.detach();
}

// 返回需要置顶的文件（用于 PathsActivatedModal 展示，使用优化的匹配路径）。
function getPathsToPin(plugin, paths) {
  var store = plugin.fileExplorerEnhancerStore;
  var settings = plugin.fileExplorerEnhancerSettings;

  // 活性预过滤：提前收集非 STRICT 的活跃过滤器
  var nonStrictActiveFilters = [];
  for (var i = 0; i < settings.pinFilters.paths.length; i++) {
    var f = settings.pinFilters.paths[i];
    if (f.active && f.patternType !== 'STRICT') nonStrictActiveFilters.push(f);
  }

  // 入门短路：没有任何活跃的置顶规则时直接返回空数组
  if (store.strictPinPaths.size === 0 && nonStrictActiveFilters.length === 0) return [];

  return paths.filter(function (path) {
    if (!path) return false;

    // O(1) STRICT 短路
    if (store.checkStrictPin(path)) return true;

    // 预编译匹配
    return nonStrictActiveFilters.some(function (filter) {
      return checkPathFilter(filter, path);
    });
  });
}

// 返回需要隐藏的文件（用于 PathsActivatedModal 展示，使用优化的匹配路径）。
function getPathsToHide(plugin, paths) {
  var store = plugin.fileExplorerEnhancerStore;
  var settings = plugin.fileExplorerEnhancerSettings;

  var nonStrictActiveFilters = [];
  for (var i = 0; i < settings.hideFilters.paths.length; i++) {
    var f = settings.hideFilters.paths[i];
    if (f.active && f.patternType !== 'STRICT') nonStrictActiveFilters.push(f);
  }

  // 入门短路：没有任何活跃的隐藏规则时直接返回空数组
  if (store.strictHidePaths.size === 0 && nonStrictActiveFilters.length === 0) return [];

  return paths.filter(function (path) {
    if (!path) return false;

    // O(1) STRICT 短路
    if (store.checkStrictHide(path)) return true;

    // 预编译匹配
    return nonStrictActiveFilters.some(function (filter) {
      return checkPathFilter(filter, path);
    });
  });
}

// 卸载时清理所有图钉图标并恢复排序。
function unloadFileExplorerEnhancer(plugin, fileExplorerView) {
  // 清理残留的 rAF
  for (var key in fileExplorerView.fileItems) {
    if (fileExplorerView.fileItems.hasOwnProperty(key)) {
      var vEl = fileExplorerView.fileItems[key];
      if (vEl.__feRafId) cancelAnimationFrame(vEl.__feRafId);
      fileExplorerView.fileItems[key] = changeVirtualElementPin(vEl, false);
      // 清理临时显示样式类
      if (vEl.el.hasClass('nene-eye-revealed')) {
        vEl.el.removeClass('nene-eye-revealed');
      }
    }
  }
  fileExplorerView.requestSort();
}

// 手动触发 filter 预编译和 STRICT Map 重建（供外部在 filter 变更后调用）。
function refreshCompiledState(plugin) {
  plugin.fileExplorerEnhancerStore.compileAllFilters();
  plugin.fileExplorerEnhancerStore.buildStrictMaps();
  plugin.fileExplorerEnhancerStore.invalidateCache();
}

// ============================================================
//  眼睛按钮与恢复按钮 —— 工具栏注入
// ============================================================

// 向文件资源管理器顶部工具栏注入眼睛按钮与恢复按钮。
function injectEyeButtons(plugin, view) {
  var navHeader = view.containerEl.querySelector('.nav-header');
  if (!navHeader) return;

  var buttonsContainer = navHeader.querySelector('.nav-buttons-container');
  if (!buttonsContainer) return;

  // 防重复注入
  if (buttonsContainer.querySelector('.nene-eye-toggle-button')) return;

  // 眼睛按钮
  var eyeBtn = document.createElement('button');
  eyeBtn.className = 'clickable-icon nav-action-button nene-eye-toggle-button';
  eyeBtn.setAttribute('type', 'button');
  eyeBtn.setAttribute('aria-label', '');
  obsidian.setIcon(eyeBtn, 'eye');
  eyeBtn.disabled = true;

  eyeBtn.addEventListener('click', function () {
    handleEyeClick(plugin);
  });

  // 恢复按钮
  var restoreBtn = document.createElement('button');
  restoreBtn.className = 'clickable-icon nav-action-button nene-eye-restore-button';
  restoreBtn.setAttribute('type', 'button');
  restoreBtn.setAttribute('aria-label', '');
  obsidian.setIcon(restoreBtn, 'rotate-ccw');
  restoreBtn.disabled = true;

  restoreBtn.addEventListener('click', function () {
    handleRestoreClick(plugin);
  });

  buttonsContainer.appendChild(eyeBtn);
  buttonsContainer.appendChild(restoreBtn);

  // 缓存按钮引用以便后续状态刷新
  plugin._eyeToggleBtn = eyeBtn;
  plugin._eyeRestoreBtn = restoreBtn;

  updateEyeButtonState(plugin);
  updateRestoreButtonState(plugin);
}

// 移除两个按钮。
function removeEyeButtons() {
  var eyeBtn = document.querySelector('.nene-eye-toggle-button');
  var restoreBtn = document.querySelector('.nene-eye-restore-button');
  if (eyeBtn && eyeBtn.parentNode) eyeBtn.parentNode.removeChild(eyeBtn);
  if (restoreBtn && restoreBtn.parentNode) restoreBtn.parentNode.removeChild(restoreBtn);
}

// 刷新眼睛按钮图标与禁用态，并同步更新当前获取目标的高亮标记。
function updateEyeButtonState(plugin) {
  var btn = plugin._eyeToggleBtn;
  if (!btn) return;

  // 先清除之前的高亮标记
  clearEyeTargetHighlight(plugin);

  var dirPath = getTargetDirectory(plugin);

  // 注意：dirPath 可能为空字符串 ''（表示库根目录），不能用 !dirPath 来判断
  if (dirPath === null) {
    obsidian.setIcon(btn, 'eye');
    btn.disabled = true;
    btn.setAttribute('aria-label', '无可用目录');
    return;
  }

  if (dirPath === '') {
    // 根目录：眼睛按钮变高亮色
    btn.addClass('nene-eye-root-mode');
  } else {
    // 非根目录：在文件列表中高亮对应的文件/文件夹
    highlightEyeTargetInFileList(plugin, dirPath);
  }

  if (hasHiddenFilesInDir(plugin, dirPath)) {
    obsidian.setIcon(btn, 'eye-off');
    btn.disabled = false;
    btn.setAttribute('aria-label', '显示当前目录下的隐藏文件');
  } else {
    obsidian.setIcon(btn, 'eye');
    btn.disabled = true;
    btn.setAttribute('aria-label', '当前目录无隐藏文件');
  }

  updateRestoreButtonState(plugin);
}

// 清除眼睛按钮和目标文件列表项的高亮标记。
function clearEyeTargetHighlight(plugin) {
  var btn = plugin._eyeToggleBtn;
  if (btn) btn.removeClass('nene-eye-root-mode');

  // 清除所有文件列表项上的高亮
  var prevHighlight = document.querySelectorAll('.tree-item-self.nene-eye-target-bg');
  for (var i = 0; i < prevHighlight.length; i++) {
    prevHighlight[i].removeClass('nene-eye-target-bg');
  }
}

// 在文件列表中找到匹配路径的 .tree-item-self 并高亮。
function highlightEyeTargetInFileList(plugin, dirPath) {
  var view = plugin._fileExplorerView;
  if (!view || !view.fileItems) return;

  var keys = Object.keys(view.fileItems);
  for (var i = 0; i < keys.length; i++) {
    var vEl = view.fileItems[keys[i]];
    if (!vEl || !vEl.file) continue;
    // 目标是非根目录：匹配文件夹自身路径或文件所在父目录
    if (vEl.file.path === dirPath) {
      var targetSelf = vEl.el.querySelector('.tree-item-self');
      if (targetSelf) targetSelf.addClass('nene-eye-target-bg');
      return;
    }
  }
}

// 刷新恢复按钮图标与禁用态。
function updateRestoreButtonState(plugin) {
  var btn = plugin._eyeRestoreBtn;
  if (!btn) return;

  var history = plugin._eyeToggleHistory || [];
  var hasRevealed = plugin._eyeRevealedPaths && plugin._eyeRevealedPaths.size > 0;

  if (history.length > 0 || hasRevealed) {
    obsidian.setIcon(btn, 'rotate-ccw');
    btn.disabled = false;
    btn.setAttribute('aria-label', '恢复所有临时显示的隐藏文件');
  } else {
    obsidian.setIcon(btn, 'rotate-ccw');
    btn.disabled = true;
    btn.setAttribute('aria-label', '无需恢复');
  }
}

// 检测目录下（含子目录）是否存在被隐藏规则命中的文件。
// 根目录：只检查直接子节点（路径中不含 '/'），避免将整个库的隐藏文件都计入。
function hasHiddenFilesInDir(plugin, dirPath) {
  var settings = plugin.fileExplorerEnhancerSettings;
  var hidePaths = settings.hideFilters.paths;

  // 收集所有激活的隐藏规则
  var activeFilters = [];
  for (var i = 0; i < hidePaths.length; i++) {
    var f = hidePaths[i];
    if (f.active && f.pattern) {
      activeFilters.push(f);
    }
  }

  if (activeFilters.length === 0) return false;

  var isRoot = dirPath === '';
  var dirPrefix = isRoot ? '' : (dirPath.endsWith('/') ? dirPath : dirPath + '/');

  var allFiles = plugin.app.vault.getAllLoadedFiles();
  for (var j = 0; j < allFiles.length; j++) {
    var file = allFiles[j];
    // 根目录：仅检查直接子节点（路径中不含 '/'，避免匹配全库）
    // 已通过 eye 按钮临时显示的文件不计入
    if (isRoot) {
      if (file.path.indexOf('/') !== -1) continue;
      if (plugin._eyeRevealedPaths && plugin._eyeRevealedPaths.has(file.path)) continue;
    } else {
      if (file.path !== dirPath && file.path.indexOf(dirPrefix) !== 0) continue;
    }
    for (var k = 0; k < activeFilters.length; k++) {
      if (checkPathFilter(activeFilters[k], file)) {
        return true;
      }
    }
  }

  return false;
}

// 眼睛按钮点击：
// - 根目录：收集直接子节点中被隐藏的文件，注入 _eyeRevealedPaths，不修改过滤器
// - 子目录：停用当前目录下所有匹配的隐藏规则（原有逻辑）
function handleEyeClick(plugin) {
  var dirPath = getTargetDirectory(plugin);
  if (dirPath === null) return;

  var isRoot = dirPath === '';

  // ---------- 根目录：只显示直接子节点中的隐藏项，不修改过滤器 ----------
  if (isRoot) {
    if (!plugin._eyeRevealedPaths) plugin._eyeRevealedPaths = new Set();

    var settings = plugin.fileExplorerEnhancerSettings;
    var hidePaths = settings.hideFilters.paths;

    // 收集所有激活的隐藏规则
    var activeFilters = [];
    for (var fi = 0; fi < hidePaths.length; fi++) {
      var f = hidePaths[fi];
      if (f.active && f.pattern) {
        activeFilters.push(f);
      }
    }

    if (activeFilters.length === 0) return;

    var allFiles = plugin.app.vault.getAllLoadedFiles();
    var newlyRevealed = [];

    for (var fj = 0; fj < allFiles.length; fj++) {
      var file = allFiles[fj];
      // 只处理根目录直接子节点
      if (file.path.indexOf('/') !== -1) continue;

      for (var fk = 0; fk < activeFilters.length; fk++) {
        if (checkPathFilter(activeFilters[fk], file)) {
          if (!plugin._eyeRevealedPaths.has(file.path)) {
            plugin._eyeRevealedPaths.add(file.path);
            newlyRevealed.push(file.path);
          }
          break;
        }
      }
    }

    if (newlyRevealed.length > 0) {
      if (plugin._fileExplorerView) {
        plugin._fileExplorerView.requestSort();
      }
    }

    updateEyeButtonState(plugin);
    updateRestoreButtonState(plugin);
    return;
  }

  // ---------- 子目录：原有逻辑（停用匹配的隐藏规则） ----------
  var dirPrefix = dirPath.endsWith('/') ? dirPath : dirPath + '/';

  var settings2 = plugin.fileExplorerEnhancerSettings;
  var hidePaths2 = settings2.hideFilters.paths;

  if (!plugin._eyeToggleHistory) plugin._eyeToggleHistory = [];

  var allFiles2 = plugin.app.vault.getAllLoadedFiles();
  var hasChanges = false;

  for (var i = 0; i < hidePaths2.length; i++) {
    var f2 = hidePaths2[i];
    if (!f2.active || !f2.pattern) continue;

    // 判断该规则是否影响目标目录下的任何文件
    var affectsDir = false;
    for (var j = 0; j < allFiles2.length; j++) {
      var file2 = allFiles2[j];
      if (file2.path === dirPath || file2.path.indexOf(dirPrefix) === 0) {
        if (checkPathFilter(f2, file2)) {
          affectsDir = true;
          break;
        }
      }
    }

    if (affectsDir) {
      f2.active = false;
      hasChanges = true;
      // 去重记录
      if (plugin._eyeToggleHistory.indexOf(i) === -1) {
        plugin._eyeToggleHistory.push(i);
      }
    }
  }

  if (hasChanges) {
    plugin.fileExplorerEnhancerStore.save();
    if (plugin._fileExplorerView) {
      plugin._fileExplorerView.requestSort();
    }
  }

  updateEyeButtonState(plugin);
  updateRestoreButtonState(plugin);
}

// 恢复按钮点击：重新启用所有被眼睛按钮停用的隐藏规则，并清空记录。
// 同时清除 _eyeRevealedPaths（根目录 eye 显示的临时项），使 eye 按钮目标回退到当前活跃笔记所在目录。
function handleRestoreClick(plugin) {
  // 子目录 eye 恢复：重新启用被停用的过滤器
  var history = plugin._eyeToggleHistory;
  if (history && history.length > 0) {
    var settings = plugin.fileExplorerEnhancerSettings;
    var hidePaths = settings.hideFilters.paths;
    var hasChanges = false;

    for (var i = 0; i < history.length; i++) {
      var idx = history[i];
      if (idx >= 0 && idx < hidePaths.length) {
        hidePaths[idx].active = true;
        hasChanges = true;
      }
    }

    plugin._eyeToggleHistory = [];

    if (hasChanges) {
      plugin.fileExplorerEnhancerStore.save();
    }
  }

  // 根目录 eye 恢复：清除临时显示的文件路径集合
  var hadRevealed = plugin._eyeRevealedPaths && plugin._eyeRevealedPaths.size > 0;
  plugin._eyeRevealedPaths = null;

  // 清除上一次聚焦的文件，使 eye 按钮的目标重置为当前活跃笔记
  plugin._lastFocusedFile = null;

  if (hadRevealed || (history && history.length > 0)) {
    if (plugin._fileExplorerView) {
      plugin._fileExplorerView.requestSort();
    }
  }

  updateEyeButtonState(plugin);
  updateRestoreButtonState(plugin);
}

// 确定眼睛按钮操作的目标目录。返回空字符串 '' 表示库根目录。
function getTargetDirectory(plugin) {
  // 优先：文件列表中最后点击的文件/文件夹
  var lastFile = plugin._lastFocusedFile;
  if (lastFile) {
    if (lastFile instanceof obsidian.TFolder) {
      return normalizeRootPath(lastFile.path);
    }
    if (lastFile instanceof obsidian.TFile) {
      return lastFile.parent ? normalizeRootPath(lastFile.parent.path) : '';
    }
  }

  // 回退：活动笔记所在目录
  var activeFile = plugin.app.workspace.getActiveFile();
  if (activeFile && activeFile.parent) {
    return normalizeRootPath(activeFile.parent.path);
  }

  // 无活跃笔记也没有聚焦文件时，默认回退到根目录
  return '';
}

// 将 Obsidian 可能的根目录表示归一化为空字符串。
function normalizeRootPath(path) {
  if (path === '/' || path === '\\') return '';
  return path;
}

// 监听文件资源管理器内的点击事件，缓存最近聚焦的文件/文件夹。
function setupFileExplorerFocusTracking(plugin) {
  if (!plugin._fileExplorerView) return;

  var containerEl = plugin._fileExplorerView.containerEl;
  if (!containerEl) return;

  // 防重复绑定
  if (plugin._eyeFocusTrackingBound) return;
  plugin._eyeFocusTrackingBound = true;

  containerEl.addEventListener('click', function (event) {
    var treeItem = event.target.closest('.tree-item');
    if (!treeItem) {
      // 点击空白区域：清除聚焦文件引用，使 eye 按钮回退到活跃笔记所在目录
      // 这样在根目录空白区点击时，能正确检测到根目录下的隐藏文件
      plugin._lastFocusedFile = null;
      updateEyeButtonState(plugin);
      return;
    }

    // 通过 fileItems 反查对应的 TAbstractFile
    var fileItems = plugin._fileExplorerView.fileItems;
    if (!fileItems) return;

    var innerEl = treeItem.querySelector('.tree-item-self .tree-item-inner');
    if (!innerEl) return;

    var title = innerEl.textContent || '';
    var filePath = '';

    // 遍历 fileItems 按标题匹配找到对应文件
    var keys = Object.keys(fileItems);
    for (var i = 0; i < keys.length; i++) {
      var vEl = fileItems[keys[i]];
      if (!vEl || !vEl.file) continue;
      var fName = vEl.file.name || vEl.file.basename || '';
      if (fName === title) {
        // 进一步通过层级确认（同一路径下的标题可能重复）
        filePath = vEl.file.path;
        plugin._lastFocusedFile = vEl.file;
        break;
      }
    }

    updateEyeButtonState(plugin);
  });

  // 监听活跃标签页切换，确保 eye 按钮状态随活跃笔记变化而刷新
  if (!plugin._eyeLeafChangeBound) {
    plugin._eyeLeafChangeBound = true;
    plugin.registerEvent(
      plugin.app.workspace.on('active-leaf-change', function () {
        // 清除上一次在文件列表中的点击缓存，
        // 使 eye 按钮的目标跟随当前活跃笔记所在目录
        plugin._lastFocusedFile = null;
        updateEyeButtonState(plugin);
      })
    );
  }
}

module.exports = {
  addCommands: addCommands,
  addOnRename: addOnRename,
  addOnDelete: addOnDelete,
  cacheFileMenuTarget: cacheFileMenuTarget,
  checkPathFilter: checkPathFilter,
  changeVirtualElementPin: changeVirtualElementPin,
  patchFileExplorerFolder: patchFileExplorerFolder,
  getPathsToPin: getPathsToPin,
  getPathsToHide: getPathsToHide,
  unloadFileExplorerEnhancer: unloadFileExplorerEnhancer,
  refreshCompiledState: refreshCompiledState,
  injectEyeButtons: injectEyeButtons,
  removeEyeButtons: removeEyeButtons,
  setupFileExplorerFocusTracking: setupFileExplorerFocusTracking,
  updateEyeButtonState: updateEyeButtonState
};
