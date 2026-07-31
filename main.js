'use strict';
// 此文件为构建产物，由 scripts/build.mjs 根据 src/ 下源码自动生成，禁止手改。

"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// src/modules/file-marker/constants.js
var require_constants = __commonJS({
  "src/modules/file-marker/constants.js"(exports2, module2) {
    "use strict";
    var FILE_MARKER_VIEW_TYPE = "obsidian-nene-plugin-file-panel";
    var DEFAULT_GROUP_ID = "ungrouped";
    var STATUS_OPTIONS = [
      { value: "pending", label: "未完成", color: "var(--color-red)" },
      { value: "in-progress", label: "进行中", color: "var(--color-orange)" },
      { value: "completed", label: "已完成", color: "var(--color-green)" },
      { value: "paused", label: "已搁置", color: "var(--color-yellow)" }
    ];
    var DEFAULT_FILE_MARKER_SETTINGS = {
      marks: {},
      groups: [
        {
          id: DEFAULT_GROUP_ID,
          name: "未分组",
          collapsed: false
        }
      ]
    };
    var FILE_ICON_MAP = {
      md: "file-text",
      canvas: "layout-dashboard",
      pdf: "file-text",
      txt: "file-text",
      js: "file-code-2",
      ts: "file-code-2",
      jsx: "file-code-2",
      tsx: "file-code-2",
      json: "braces",
      css: "palette",
      scss: "palette",
      less: "palette",
      html: "file-code-2",
      vue: "file-code-2",
      py: "file-code-2",
      java: "file-code-2",
      sql: "database",
      csv: "file-spreadsheet",
      xlsx: "file-spreadsheet",
      png: "image",
      jpg: "image",
      jpeg: "image",
      gif: "image",
      webp: "image",
      svg: "image",
      mp3: "music-4",
      wav: "music-4",
      m4a: "music-4",
      mp4: "video",
      mov: "video",
      webm: "video",
      zip: "archive",
      rar: "archive",
      "7z": "archive"
    };
    module2.exports = {
      DEFAULT_GROUP_ID,
      DEFAULT_FILE_MARKER_SETTINGS,
      FILE_ICON_MAP,
      FILE_MARKER_VIEW_TYPE,
      STATUS_OPTIONS
    };
  }
});

// src/modules/file-marker/store.js
var require_store = __commonJS({
  "src/modules/file-marker/store.js"(exports2, module2) {
    "use strict";
    var obsidian2 = require("obsidian");
    var constants = require_constants();
    var FileMarkerStore = class {
      constructor(plugin) {
        this.plugin = plugin;
        this.settings = this.normalizeSettings();
      }
      // 挂载当前插件数据中的 file-marker 切片，并按本模块规则进一步归一化。
      load(settings) {
        this.settings = this.normalizeSettings(settings);
        this.plugin.dataStore.setFileMarkerData(this.settings);
      }
      // 将最新 file-marker 切片同步到插件级数据仓库并持久化到本地。
      async save() {
        this.settings = this.normalizeSettings(this.settings);
        await this.plugin.dataStore.saveFileMarkerData(this.settings);
      }
      // 返回完整配置对象，便于上层做只读使用。
      getSettings() {
        return this.settings;
      }
      // 返回当前全部分组信息。
      getGroups() {
        return this.settings.groups;
      }
      // 根据状态值获取显示名称。
      getStatusLabel(statusValue) {
        const matchedStatus = constants.STATUS_OPTIONS.find((status) => status.value === statusValue);
        return matchedStatus ? matchedStatus.label : constants.STATUS_OPTIONS[0].label;
      }
      // 根据文件类型返回对应图标，未命中时统一回退到通用文件图标。
      getFileIcon(file) {
        const extension = (file.extension || "").toLowerCase();
        return constants.FILE_ICON_MAP[extension] || "file";
      }
      // 将时间戳格式化为本地时间文本，便于在面板中展示更新时间。
      formatTime(timestamp) {
        if (!timestamp) return "刚刚";
        return new Date(timestamp).toLocaleString("zh-CN", {
          hour12: false
        });
      }
      // 判断状态值是否合法，避免界面读取未知状态。
      isValidStatus(statusValue) {
        return constants.STATUS_OPTIONS.some((status) => status.value === statusValue);
      }
      // 归一化 file-marker 自己的数据结构，避免旧数据或异常数据导致运行时报错。
      normalizeSettings(data) {
        const source = data || constants.DEFAULT_FILE_MARKER_SETTINGS;
        const normalizedMarks = {};
        const marks = source.marks || {};
        Object.entries(marks).forEach(([path, mark]) => {
          if (!path || !mark || typeof mark !== "object") return;
          normalizedMarks[path] = {
            ...mark,
            path,
            status: this.isValidStatus(mark.status) ? mark.status : constants.STATUS_OPTIONS[0].value,
            note: typeof mark.note === "string" ? mark.note : "",
            groupId: typeof mark.groupId === "string" ? mark.groupId : constants.DEFAULT_GROUP_ID,
            updatedAt: typeof mark.updatedAt === "number" ? mark.updatedAt : Date.now()
          };
        });
        const rawGroups = Array.isArray(source.groups) ? source.groups : [];
        const normalizedGroups = [];
        const addedGroupIds = /* @__PURE__ */ new Set();
        rawGroups.forEach((group) => {
          if (!group || typeof group !== "object") return;
          if (typeof group.id !== "string" || !group.id.trim()) return;
          if (typeof group.name !== "string" || !group.name.trim()) return;
          if (addedGroupIds.has(group.id)) return;
          normalizedGroups.push({
            ...group,
            id: group.id,
            name: group.name.trim(),
            collapsed: Boolean(group.collapsed)
          });
          addedGroupIds.add(group.id);
        });
        if (!addedGroupIds.has(constants.DEFAULT_GROUP_ID)) {
          normalizedGroups.unshift({
            id: constants.DEFAULT_GROUP_ID,
            name: "未分组",
            collapsed: false
          });
        }
        return {
          marks: normalizedMarks,
          groups: normalizedGroups
        };
      }
      // 保存单个文件的标记记录。
      async saveMark(file, payload) {
        this.settings.marks[file.path] = {
          path: file.path,
          status: this.isValidStatus(payload.status) ? payload.status : constants.STATUS_OPTIONS[0].value,
          note: typeof payload.note === "string" ? payload.note.trim() : "",
          groupId: this.getGroups().some((group) => group.id === payload.groupId) ? payload.groupId : constants.DEFAULT_GROUP_ID,
          updatedAt: Date.now()
        };
        await this.save();
      }
      // 删除单个文件的标记记录，并返回是否成功删除。
      async removeMark(filePath) {
        if (!this.settings.marks[filePath]) return false;
        delete this.settings.marks[filePath];
        await this.save();
        return true;
      }
      // 新增分组，并返回创建结果对象供上层界面决定提示文案。
      async addGroup(groupName) {
        const normalizedName = groupName.trim();
        if (!normalizedName) {
          return {
            created: false,
            group: this.getGroups().find((group2) => group2.id === constants.DEFAULT_GROUP_ID),
            message: "分组名称不能为空"
          };
        }
        const duplicatedGroup = this.getGroups().find((group2) => group2.name === normalizedName);
        if (duplicatedGroup) {
          return {
            created: false,
            group: duplicatedGroup,
            message: "同名分组已存在"
          };
        }
        const group = {
          id: `group-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          name: normalizedName,
          collapsed: false
        };
        this.settings.groups.push(group);
        await this.save();
        return {
          created: true,
          group,
          message: "分组已新增"
        };
      }
      // 切换指定分组的展开或折叠状态。
      async setGroupCollapsed(groupId, collapsed) {
        const targetGroup = this.getGroups().find((group) => group.id === groupId);
        if (!targetGroup) return false;
        targetGroup.collapsed = collapsed;
        await this.save();
        return true;
      }
      // 一键展开或折叠全部分组。
      async setAllGroupsCollapsed(collapsed) {
        this.getGroups().forEach((group) => {
          group.collapsed = collapsed;
        });
        await this.save();
      }
      // 获取按分组归类后的文件标记数据，供面板渲染使用。
      getGroupedMarkedFiles() {
        const groupedSections = this.getGroups().map((group) => ({
          group,
          items: []
        }));
        const groupedMap = new Map(groupedSections.map((section) => [section.group.id, section]));
        Object.entries(this.settings.marks).forEach(([path, mark]) => {
          const file = this.plugin.app.vault.getAbstractFileByPath(path);
          if (!(file instanceof obsidian2.TFile)) return;
          const targetGroupId = groupedMap.has(mark.groupId) ? mark.groupId : constants.DEFAULT_GROUP_ID;
          groupedMap.get(targetGroupId).items.push({ file, mark });
        });
        groupedSections.forEach((section) => {
          section.items.sort((left, right) => {
            return left.file.basename.localeCompare(right.file.basename, "zh-CN");
          });
        });
        return groupedSections;
      }
      // 在文件被重命名时同步更新标记数据。
      async renameMark(file, oldPath) {
        const existingMark = this.settings.marks[oldPath];
        if (!existingMark) return false;
        delete this.settings.marks[oldPath];
        this.settings.marks[file.path] = Object.assign({}, existingMark, {
          path: file.path,
          updatedAt: Date.now()
        });
        await this.save();
        return true;
      }
      // 在文件被删除时清理对应标记数据。
      async removeMarkByFile(file) {
        return this.removeMark(file.path);
      }
      // 打开指定路径对应的文件，若文件不存在则返回失败结果。
      async openMarkedFile(filePath) {
        const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
        if (!(file instanceof obsidian2.TFile)) {
          return {
            success: false,
            message: "目标文件不存在"
          };
        }
        await this.plugin.app.workspace.getLeaf(true).openFile(file);
        return {
          success: true,
          file
        };
      }
      // 清理已经不存在的文件标记，避免面板中残留失效数据。
      async pruneMissingMarks() {
        let hasChanged = false;
        Object.keys(this.settings.marks).forEach((path) => {
          const file = this.plugin.app.vault.getAbstractFileByPath(path);
          if (file instanceof obsidian2.TFile) return;
          delete this.settings.marks[path];
          hasChanged = true;
        });
        if (hasChanged) {
          await this.save();
        }
        return hasChanged;
      }
    };
    module2.exports = {
      FileMarkerStore
    };
  }
});

// src/modules/file-marker/modals.js
var require_modals = __commonJS({
  "src/modules/file-marker/modals.js"(exports2, module2) {
    "use strict";
    var obsidian2 = require("obsidian");
    var constants = require_constants();
    var GroupNameModal = class extends obsidian2.Modal {
      constructor(app, onSubmit) {
        super(app);
        this.onSubmit = onSubmit;
      }
      // 打开弹窗时渲染输入界面。
      onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("file-marker-modal");
        contentEl.createEl("h2", { text: "新增分组" });
        const formEl = contentEl.createDiv({ cls: "file-marker-modal-form" });
        const fieldEl = formEl.createDiv({ cls: "file-marker-form-field" });
        fieldEl.createEl("label", {
          cls: "file-marker-form-label",
          text: "分组名称"
        });
        const inputEl = fieldEl.createEl("input", {
          cls: "file-marker-text-input",
          type: "text",
          placeholder: "例如：高优先级、待整理"
        });
        inputEl.focus();
        const actionEl = formEl.createDiv({ cls: "file-marker-modal-actions" });
        const cancelButton = actionEl.createEl("button", {
          cls: "mod-muted",
          text: "取消"
        });
        const submitButton = actionEl.createEl("button", {
          cls: "mod-cta",
          text: "保存"
        });
        cancelButton.addEventListener("click", () => {
          this.close();
        });
        submitButton.addEventListener("click", async () => {
          const result = await this.onSubmit(inputEl.value.trim());
          if (result && result.message) {
            new obsidian2.Notice(result.message);
          }
          if (result && result.group) {
            this.close();
          }
        });
        inputEl.addEventListener("keydown", async (event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          submitButton.click();
        });
      }
      // 关闭弹窗时清空内容，避免重复挂载旧节点。
      onClose() {
        this.contentEl.empty();
      }
    };
    var FileMarkerModal = class extends obsidian2.Modal {
      constructor(app, plugin, file) {
        super(app);
        this.plugin = plugin;
        this.file = file;
      }
      // 打开弹窗时构建表单结构。
      onOpen() {
        const existingMark = this.plugin.getMarkRecord(this.file.path);
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("file-marker-modal");
        contentEl.createEl("h2", { text: "文件标记" });
        contentEl.createEl("div", {
          cls: "file-marker-modal-path",
          text: this.file.path
        });
        const formEl = contentEl.createDiv({ cls: "file-marker-modal-form" });
        const statusFieldEl = formEl.createDiv({ cls: "file-marker-form-field" });
        statusFieldEl.createEl("label", {
          cls: "file-marker-form-label",
          text: "状态"
        });
        const statusSelectEl = statusFieldEl.createEl("select", {
          cls: "file-marker-select"
        });
        this.buildStatusOptions(statusSelectEl);
        statusSelectEl.value = existingMark?.status || constants.STATUS_OPTIONS[0].value;
        const groupFieldEl = formEl.createDiv({ cls: "file-marker-form-field" });
        groupFieldEl.createEl("label", {
          cls: "file-marker-form-label",
          text: "分组"
        });
        const groupControlEl = groupFieldEl.createDiv({ cls: "file-marker-inline-controls" });
        const groupSelectEl = groupControlEl.createEl("select", {
          cls: "file-marker-select"
        });
        this.buildGroupOptions(groupSelectEl);
        groupSelectEl.value = existingMark?.groupId || constants.DEFAULT_GROUP_ID;
        const addGroupButton = groupControlEl.createEl("button", {
          cls: "mod-muted",
          text: "新增分组"
        });
        addGroupButton.addEventListener("click", () => {
          new GroupNameModal(this.app, async (groupName) => {
            const result = await this.plugin.createMarkGroup(groupName);
            this.buildGroupOptions(groupSelectEl);
            if (result.group) {
              groupSelectEl.value = result.group.id;
            }
            return result;
          }).open();
        });
        const noteFieldEl = formEl.createDiv({ cls: "file-marker-form-field" });
        noteFieldEl.createEl("label", {
          cls: "file-marker-form-label",
          text: "备注"
        });
        const noteTextareaEl = noteFieldEl.createEl("textarea", {
          cls: "file-marker-textarea",
          placeholder: "填写补充说明、下一步计划或关联信息"
        });
        noteTextareaEl.value = existingMark?.note || "";
        const actionEl = formEl.createDiv({ cls: "file-marker-modal-actions" });
        if (existingMark) {
          const removeButton = actionEl.createEl("button", {
            cls: "mod-warning",
            text: "移除标记"
          });
          removeButton.addEventListener("click", async () => {
            await this.plugin.removeMarkRecord(this.file.path);
            new obsidian2.Notice("已移除文件标记");
            this.close();
          });
        }
        const cancelButton = actionEl.createEl("button", {
          cls: "mod-muted",
          text: "取消"
        });
        const saveButton = actionEl.createEl("button", {
          cls: "mod-cta",
          text: "保存"
        });
        cancelButton.addEventListener("click", () => {
          this.close();
        });
        saveButton.addEventListener("click", async () => {
          await this.plugin.saveMarkRecord(this.file, {
            status: statusSelectEl.value,
            note: noteTextareaEl.value,
            groupId: groupSelectEl.value
          });
          await this.plugin.ensureFileMarkerViewOpen();
          new obsidian2.Notice("文件标记已保存");
          this.close();
        });
      }
      // 关闭弹窗时清空容器内容。
      onClose() {
        this.contentEl.empty();
      }
      // 构建状态下拉框选项。
      buildStatusOptions(selectEl) {
        selectEl.empty();
        constants.STATUS_OPTIONS.forEach((status) => {
          const optionEl = selectEl.createEl("option", { text: status.label });
          optionEl.value = status.value;
        });
      }
      // 构建分组下拉框选项。
      buildGroupOptions(selectEl) {
        selectEl.empty();
        this.plugin.getGroups().forEach((group) => {
          const optionEl = selectEl.createEl("option", { text: group.name });
          optionEl.value = group.id;
        });
      }
    };
    module2.exports = {
      FileMarkerModal,
      GroupNameModal
    };
  }
});

// src/modules/file-marker/view.js
var require_view = __commonJS({
  "src/modules/file-marker/view.js"(exports2, module2) {
    "use strict";
    var obsidian2 = require("obsidian");
    var constants = require_constants();
    var modals = require_modals();
    var FileMarkerView = class extends obsidian2.ItemView {
      constructor(leaf, plugin) {
        super(leaf);
        this.plugin = plugin;
      }
      // 返回视图类型，需与注册时保持一致。
      getViewType() {
        return constants.FILE_MARKER_VIEW_TYPE;
      }
      // 返回侧边栏显示标题。
      getDisplayText() {
        return "文件标记";
      }
      // 返回侧边栏图标名称。
      getIcon() {
        return "tags";
      }
      // 视图打开时执行首次渲染。
      async onOpen() {
        this.render();
      }
      // 视图关闭时清空内容，释放已创建的节点。
      async onClose() {
        this.contentEl.empty();
      }
      // 根据最新数据重新绘制整个面板。
      render() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("file-marker-view");
        const headerEl = contentEl.createDiv({ cls: "file-marker-view-header" });
        headerEl.createEl("div", {
          cls: "file-marker-view-title",
          text: "文件标记"
        });
        const actionEl = headerEl.createDiv({ cls: "file-marker-view-actions" });
        this.createHeaderButton(actionEl, "plus", "新增分组", () => {
          new modals.GroupNameModal(this.app, async (groupName) => {
            return this.plugin.createMarkGroup(groupName);
          }).open();
        });
        this.createHeaderButton(actionEl, "fold-vertical", "全部折叠", async () => {
          await this.plugin.updateAllGroupsCollapsedState(true);
        });
        this.createHeaderButton(actionEl, "unfold-vertical", "全部展开", async () => {
          await this.plugin.updateAllGroupsCollapsedState(false);
        });
        const groupedMarks = this.plugin.getGroupedMarkedFiles();
        if (groupedMarks.every((section) => section.items.length === 0)) {
          const emptyEl = contentEl.createDiv({ cls: "file-marker-empty" });
          emptyEl.createEl("div", { text: "当前还没有文件标记" });
          emptyEl.createEl("small", { text: "在文件管理器中右键任意文件，即可添加标记。" });
          return;
        }
        groupedMarks.forEach((section) => {
          const sectionEl = contentEl.createDiv({ cls: "file-marker-group" });
          const groupHeaderEl = sectionEl.createDiv({ cls: "file-marker-group-header" });
          const toggleEl = groupHeaderEl.createDiv({ cls: "file-marker-group-toggle" });
          obsidian2.setIcon(toggleEl, section.group.collapsed ? "chevron-right" : "chevron-down");
          const titleWrapEl = groupHeaderEl.createDiv({ cls: "file-marker-group-title-wrap" });
          titleWrapEl.createEl("div", {
            cls: "file-marker-group-title",
            text: section.group.name
          });
          titleWrapEl.createEl("div", {
            cls: "file-marker-group-count",
            text: `${section.items.length} 个文件`
          });
          groupHeaderEl.addEventListener("click", async () => {
            await this.plugin.updateGroupCollapsedState(section.group.id, !section.group.collapsed);
          });
          if (section.group.collapsed) return;
          const listEl = sectionEl.createDiv({ cls: "file-marker-group-list" });
          if (section.items.length === 0) {
            listEl.createEl("div", {
              cls: "file-marker-empty-group",
              text: "该分组暂无已标记文件"
            });
            return;
          }
          section.items.forEach(({ file, mark }) => {
            const rowEl = listEl.createDiv({ cls: "file-marker-item" });
            rowEl.setAttribute("tabindex", "0");
            const iconEl = rowEl.createDiv({ cls: "file-marker-item-icon" });
            obsidian2.setIcon(iconEl, this.plugin.getFileIcon(file));
            const bodyEl = rowEl.createDiv({ cls: "file-marker-item-body" });
            const titleEl = bodyEl.createDiv({ cls: "file-marker-item-title" });
            titleEl.createSpan({
              cls: "file-marker-item-name",
              text: file.basename
            });
            const dotEl = titleEl.createSpan({ cls: "file-marker-status-dot" });
            dotEl.setAttribute("data-status", mark.status);
            dotEl.setAttribute("aria-label", this.plugin.getStatusLabel(mark.status));
            bodyEl.createDiv({
              cls: "file-marker-item-path",
              text: file.path
            });
            const metaEl = bodyEl.createDiv({ cls: "file-marker-item-meta" });
            metaEl.createSpan({
              cls: "file-marker-item-status-text",
              text: this.plugin.getStatusLabel(mark.status)
            });
            metaEl.createSpan({
              cls: "file-marker-item-updated",
              text: `更新于 ${this.plugin.formatTime(mark.updatedAt)}`
            });
            if (mark.note) {
              bodyEl.createDiv({
                cls: "file-marker-item-note",
                text: mark.note
              });
            }
            const itemActionEl = rowEl.createDiv({ cls: "file-marker-item-actions" });
            this.createItemButton(itemActionEl, "pencil", "编辑", async (event) => {
              event.stopPropagation();
              this.plugin.openMarkEditor(file);
            });
            this.createItemButton(itemActionEl, "trash-2", "删除", async (event) => {
              event.stopPropagation();
              await this.plugin.removeMarkRecord(file.path);
              new obsidian2.Notice("已删除文件标记");
            });
            rowEl.addEventListener("click", async () => {
              await this.plugin.openMarkedFileByPath(file.path);
            });
            rowEl.addEventListener("keydown", async (event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              await this.plugin.openMarkedFileByPath(file.path);
            });
          });
        });
      }
      // 创建面板头部按钮，统一交互和图标样式。
      createHeaderButton(containerEl, iconName, label, onClick) {
        const buttonEl = containerEl.createEl("button", {
          cls: "clickable-icon file-marker-icon-button"
        });
        buttonEl.setAttribute("aria-label", label);
        buttonEl.setAttribute("title", label);
        obsidian2.setIcon(buttonEl, iconName);
        buttonEl.addEventListener("click", async (event) => {
          event.stopPropagation();
          await onClick(event);
        });
      }
      // 创建单条文件记录的操作按钮。
      createItemButton(containerEl, iconName, label, onClick) {
        const buttonEl = containerEl.createEl("button", {
          cls: "clickable-icon file-marker-icon-button"
        });
        buttonEl.setAttribute("aria-label", label);
        buttonEl.setAttribute("title", label);
        obsidian2.setIcon(buttonEl, iconName);
        buttonEl.addEventListener("click", onClick);
      }
    };
    module2.exports = {
      FileMarkerView
    };
  }
});

// src/modules/file-marker/index.js
var require_file_marker = __commonJS({
  "src/modules/file-marker/index.js"(exports2, module2) {
    "use strict";
    var constants = require_constants();
    var store = require_store();
    var modals = require_modals();
    var view = require_view();
    module2.exports = Object.assign({}, constants, store, modals, view);
  }
});

// src/modules/graph-view-enhancer/constants.js
var require_constants2 = __commonJS({
  "src/modules/graph-view-enhancer/constants.js"(exports2, module2) {
    "use strict";
    var DEFAULT_ANCHOR_GRAPH_SETTINGS = {
      defaultSettings: {
        htmlEnhancementEnabled: true
      },
      noteOverrides: {}
    };
    module2.exports = {
      DEFAULT_ANCHOR_GRAPH_SETTINGS
    };
  }
});

// src/modules/copy-path/constants.js
var require_constants3 = __commonJS({
  "src/modules/copy-path/constants.js"(exports2, module2) {
    "use strict";
    var DEFAULT_COPY_PATH_SETTINGS = {
      addTrailingSlashToFolders: false
    };
    var MENU_TARGET_MAX_AGE = 3e4;
    module2.exports = {
      DEFAULT_COPY_PATH_SETTINGS,
      MENU_TARGET_MAX_AGE
    };
  }
});

// src/modules/context-menu-enhancer/constants.js
var require_constants4 = __commonJS({
  "src/modules/context-menu-enhancer/constants.js"(exports2, module2) {
    "use strict";
    var MENU_TYPE_OPTIONS = [
      { id: "editor", name: "编辑区右键菜单" },
      { id: "moreOptions", name: "编辑区“更多选项”菜单" },
      { id: "file", name: "文件右键菜单" },
      { id: "folder", name: "文件夹右键菜单" }
    ];
    var GROUP_LAYOUT_OPTIONS = [
      { value: "list", label: "列表" },
      { value: "icon-bar", label: "图标栏" },
      { value: "grid", label: "网格" }
    ];
    var BUILTIN_MENU_COMMAND_DATA = [
      { menuType: "editor", commandId: "editor:cut", label: "剪切", title: "剪切", section: "edit", icon: "scissors" },
      { menuType: "editor", commandId: "editor:copy", label: "复制", title: "复制", section: "edit", icon: "copy" },
      { menuType: "editor", commandId: "editor:paste", label: "粘贴", title: "粘贴", section: "edit", icon: "clipboard-check" },
      { menuType: "editor", commandId: "editor:paste-as-plain-text", label: "以纯文本形式粘贴", title: "以纯文本形式粘贴", section: "edit", icon: "clipboard-type" },
      { menuType: "editor", commandId: "editor:select-all", label: "全选", title: "全选", section: "edit", icon: "box-select" },
      { menuType: "editor", commandId: "editor:edit-link", label: "编辑链接", title: "编辑链接", section: "edit", icon: "text-cursor-input" },
      { menuType: "editor", commandId: "editor:toggle-bold", label: "加粗", title: "加粗", section: "format", icon: "bold" },
      { menuType: "editor", commandId: "editor:toggle-italics", label: "斜体", title: "斜体", section: "format", icon: "italic" },
      { menuType: "editor", commandId: "editor:toggle-highlight", label: "高亮", title: "高亮", section: "format", icon: "highlighter" },
      { menuType: "editor", commandId: "editor:toggle-strikethrough", label: "删除线", title: "删除线", section: "format", icon: "strikethrough" },
      { menuType: "editor", commandId: "editor:toggle-code", label: "代码", title: "代码", section: "format", icon: "code" },
      { menuType: "editor", commandId: "editor:insert-link", label: "链接", title: "链接", section: "insert", icon: "link" },
      { menuType: "editor", commandId: "editor:insert-embed", label: "嵌入", title: "嵌入", section: "insert", icon: "sticky-note" },
      { menuType: "editor", commandId: "editor:insert-codeblock", label: "代码块", title: "代码块", section: "insert", icon: "code-2" }
    ];
    var DEFAULT_MENU_GROUPS = {
      editor: [
        {
          id: "editor-quick-actions",
          name: "编辑",
          icon: "mouse-pointer-click",
          layout: "icon-bar",
          hidden: false,
          forceSubmenu: false,
          commands: [
            "editor:edit-link",
            "editor:cut",
            "editor:copy",
            "editor:paste",
            "editor:paste-as-plain-text",
            "editor:select-all"
          ]
        },
        {
          id: "editor-format",
          name: "格式",
          icon: "bold",
          layout: "icon-bar",
          hidden: false,
          forceSubmenu: true,
          commands: [
            "editor:toggle-bold",
            "editor:toggle-italics",
            "editor:toggle-highlight",
            "editor:toggle-strikethrough",
            "editor:toggle-code"
          ]
        },
        {
          id: "editor-insert",
          name: "插入",
          icon: "plus",
          layout: "icon-bar",
          hidden: false,
          forceSubmenu: true,
          commands: [
            "editor:insert-link",
            "editor:insert-embed",
            "editor:insert-codeblock"
          ]
        }
      ],
      moreOptions: [
        {
          id: "more-options-links",
          name: "链接与路径",
          icon: "link",
          layout: "list",
          hidden: false,
          forceSubmenu: true,
          commands: [
            "file-explorer:open-link-view",
            "file-explorer:copy-path",
            "file-explorer:copy-vault-path"
          ]
        }
      ],
      file: [
        {
          id: "file-open-actions",
          name: "打开",
          icon: "file-text",
          layout: "list",
          hidden: false,
          forceSubmenu: true,
          commands: [
            "file-explorer:open",
            "file-explorer:open-in-new-tab",
            "file-explorer:open-to-the-right",
            "file-explorer:open-in-new-window"
          ]
        },
        {
          id: "file-management",
          name: "管理",
          icon: "settings",
          layout: "list",
          hidden: false,
          forceSubmenu: true,
          commands: [
            "file-explorer:rename-file",
            "file-explorer:copy-path",
            "file-explorer:copy-vault-path",
            "file-explorer:delete-file"
          ]
        }
      ],
      folder: [
        {
          id: "folder-create",
          name: "新建",
          icon: "folder-plus",
          layout: "list",
          hidden: false,
          forceSubmenu: true,
          commands: [
            "file-explorer:new-file",
            "file-explorer:new-folder"
          ]
        },
        {
          id: "folder-management",
          name: "管理",
          icon: "settings",
          layout: "list",
          hidden: false,
          forceSubmenu: true,
          commands: [
            "file-explorer:rename-file",
            "file-explorer:copy-path",
            "file-explorer:copy-vault-path",
            "file-explorer:delete-file"
          ]
        }
      ]
    };
    function buildDefaultRootItems(menuType) {
      return cloneDefaultGroups(menuType).map((group) => ({
        id: `${group.id}::root`,
        type: "group",
        groupId: group.id,
        hidden: false
      }));
    }
    function cloneDefaultGroups(menuType) {
      return JSON.parse(JSON.stringify(DEFAULT_MENU_GROUPS[menuType] || []));
    }
    function cloneDefaultRootItems(menuType) {
      return JSON.parse(JSON.stringify(buildDefaultRootItems(menuType)));
    }
    function buildDefaultMenuCustomizerSettings() {
      const menus = {};
      MENU_TYPE_OPTIONS.forEach((menuType) => {
        menus[menuType.id] = {
          enabled: false,
          groups: cloneDefaultGroups(menuType.id),
          rootItems: cloneDefaultRootItems(menuType.id),
          commandOverrides: {},
          commandMappings: []
        };
      });
      return { menus };
    }
    var DEFAULT_MENU_CUSTOMIZER_SETTINGS = buildDefaultMenuCustomizerSettings();
    function createDefaultMenuCustomizerSettings() {
      return JSON.parse(JSON.stringify(DEFAULT_MENU_CUSTOMIZER_SETTINGS));
    }
    function getBuiltinCommandEntries(menuType) {
      return BUILTIN_MENU_COMMAND_DATA.filter((entry) => entry.menuType === menuType).map((entry) => Object.assign({}, entry));
    }
    function getBuiltinCommandMetadata(menuType, commandId) {
      const normalizedCommandId = typeof commandId === "string" ? commandId.trim() : "";
      if (!menuType || !normalizedCommandId) {
        return null;
      }
      const entries = getBuiltinCommandEntries(menuType).filter((entry) => entry.commandId === normalizedCommandId);
      if (entries.length === 0) {
        return null;
      }
      const primaryEntry = entries[0];
      return {
        id: normalizedCommandId,
        label: primaryEntry.label || primaryEntry.title || normalizedCommandId,
        icon: primaryEntry.icon || "",
        aliases: Array.from(new Set(entries.map((entry) => entry.title).filter(Boolean))),
        sections: Array.from(new Set(entries.map((entry) => entry.section).filter(Boolean))),
        source: "builtin",
        canExecute: false
      };
    }
    module2.exports = {
      BUILTIN_MENU_COMMAND_DATA,
      DEFAULT_MENU_CUSTOMIZER_SETTINGS,
      DEFAULT_MENU_GROUPS,
      GROUP_LAYOUT_OPTIONS,
      MENU_TYPE_OPTIONS,
      cloneDefaultRootItems,
      createDefaultMenuCustomizerSettings,
      getBuiltinCommandEntries,
      getBuiltinCommandMetadata
    };
  }
});

// src/modules/status-bar-enhancer/constants.js
var require_constants5 = __commonJS({
  "src/modules/status-bar-enhancer/constants.js"(exports2, module2) {
    "use strict";
    var DEFAULT_STATUS_BAR_ENHANCER_SETTINGS = {
      showFileName: false,
      showIcons: false,
      copyAbsolutePath: true,
      lastModifiedEnabled: true,
      lastModifiedPrepend: "🖋️",
      lastModifiedTimestampFormat: " HH:mm:ss",
      createdEnabled: false,
      createdPrepend: "📘",
      createdTimestampFormat: "YYYY-MM-DD",
      cycleOnClickEnabled: true
    };
    var DEFAULT_ORGANIZER_SETTINGS = {
      elements: {},
      deletedIds: []
    };
    module2.exports = {
      DEFAULT_STATUS_BAR_ENHANCER_SETTINGS,
      DEFAULT_ORGANIZER_SETTINGS
    };
  }
});

// src/modules/status-bar-enhancer/snippets-constants.js
var require_snippets_constants = __commonJS({
  "src/modules/status-bar-enhancer/snippets-constants.js"(exports2, module2) {
    "use strict";
    var DEFAULT_SNIPPETS_SETTINGS = {
      aestheticStyle: false,
      openSnippetFile: true,
      snippetEnabledStatus: true,
      stylingTemplate: ""
    };
    function normalizeSnippetsSettings(settings) {
      const source = settings || DEFAULT_SNIPPETS_SETTINGS;
      return {
        aestheticStyle: source.aestheticStyle === true,
        openSnippetFile: source.openSnippetFile !== false,
        snippetEnabledStatus: source.snippetEnabledStatus === true,
        stylingTemplate: typeof source.stylingTemplate === "string" ? source.stylingTemplate : DEFAULT_SNIPPETS_SETTINGS.stylingTemplate
      };
    }
    module2.exports = {
      DEFAULT_SNIPPETS_SETTINGS,
      normalizeSnippetsSettings
    };
  }
});

// src/modules/tab-bar-enhancer/constants.js
var require_constants6 = __commonJS({
  "src/modules/tab-bar-enhancer/constants.js"(exports2, module2) {
    "use strict";
    var DEFAULT_TAB_BAR_ENHANCER_SETTINGS = {
      debug: false,
      topBarWheelTabSwitch: false,
      skipCssHiddenTabs: true,
      skipUnloadedPluginTabs: true
    };
    module2.exports = {
      DEFAULT_TAB_BAR_ENHANCER_SETTINGS
    };
  }
});

// src/modules/file-explorer-enhancer/constants.js
var require_constants7 = __commonJS({
  "src/modules/file-explorer-enhancer/constants.js"(exports2, module2) {
    "use strict";
    var DEFAULT_FILE_EXPLORER_ENHANCER_SETTINGS = {
      pinFilters: {
        active: false,
        paths: []
      },
      hideFilters: {
        active: false,
        paths: []
      }
    };
    module2.exports = {
      DEFAULT_FILE_EXPLORER_ENHANCER_SETTINGS
    };
  }
});

// src/modules/plugin-data/constants.js
var require_constants8 = __commonJS({
  "src/modules/plugin-data/constants.js"(exports2, module2) {
    "use strict";
    var anchorGraphConstants = require_constants2();
    var copyPathConstants = require_constants3();
    var fileMarkerConstants = require_constants();
    var menuCustomizerConstants = require_constants4();
    var statusBarEnhancerConstants = require_constants5();
    var snippetsConstants = require_snippets_constants();
    var tabBarEnhancerConstants = require_constants6();
    var fileExplorerEnhancerConstants = require_constants7();
    var FEATURE_CONFIG_DIRECTORY_NAME = "configs";
    var FEATURE_EXPORT_DIRECTORY_NAME = "exports";
    var FEATURE_CONFIG_FILE_NAMES = {
      fileMarker: "file-marker",
      anchorGraph: "anchor-graph",
      menuCustomizer: "menu-customizer",
      copyPath: "copy-path",
      statusBarEnhancer: "status-bar-enhancer",
      tabBarEnhancer: "tab-bar-enhancer",
      fileExplorerEnhancer: "file-explorer-enhancer"
    };
    var DEFAULT_PLUGIN_DATA = {
      features: {
        fileMarker: {
          enabled: false
        },
        anchorGraph: {
          enabled: false
        },
        menuCustomizer: {
          enabled: false
        },
        copyPath: {
          enabled: false
        },
        statusBarEnhancer: {
          enabled: false
        },
        tabBarEnhancer: {
          enabled: false
        },
        fileExplorerEnhancer: {
          enabled: false
        }
      }
    };
    var DEFAULT_FEATURE_DATA = {
      fileMarker: fileMarkerConstants.DEFAULT_FILE_MARKER_SETTINGS,
      anchorGraph: anchorGraphConstants.DEFAULT_ANCHOR_GRAPH_SETTINGS,
      menuCustomizer: menuCustomizerConstants.DEFAULT_MENU_CUSTOMIZER_SETTINGS,
      copyPath: copyPathConstants.DEFAULT_COPY_PATH_SETTINGS,
      statusBarEnhancer: Object.assign({}, statusBarEnhancerConstants.DEFAULT_STATUS_BAR_ENHANCER_SETTINGS, {
        organizer: statusBarEnhancerConstants.DEFAULT_ORGANIZER_SETTINGS,
        snippets: snippetsConstants.DEFAULT_SNIPPETS_SETTINGS
      }),
      tabBarEnhancer: tabBarEnhancerConstants.DEFAULT_TAB_BAR_ENHANCER_SETTINGS,
      fileExplorerEnhancer: fileExplorerEnhancerConstants.DEFAULT_FILE_EXPLORER_ENHANCER_SETTINGS
    };
    module2.exports = {
      DEFAULT_FEATURE_DATA,
      DEFAULT_PLUGIN_DATA,
      FEATURE_CONFIG_DIRECTORY_NAME,
      FEATURE_EXPORT_DIRECTORY_NAME,
      FEATURE_CONFIG_FILE_NAMES
    };
  }
});

// src/modules/plugin-data/feature-config-manager.js
var require_feature_config_manager = __commonJS({
  "src/modules/plugin-data/feature-config-manager.js"(exports2, module2) {
    "use strict";
    var obsidian2 = require("obsidian");
    var constants = require_constants8();
    var FeatureConfigManager = class {
      constructor(plugin) {
        this.plugin = plugin;
        this.writeQueue = /* @__PURE__ */ new Map();
        this.configDirectoryPath = obsidian2.normalizePath(
          `${plugin.app.vault.configDir}/plugins/${plugin.manifest.id}/${constants.FEATURE_CONFIG_DIRECTORY_NAME}`
        );
        this.exportDirectoryPath = obsidian2.normalizePath(
          `${plugin.app.vault.configDir}/plugins/${plugin.manifest.id}/${constants.FEATURE_EXPORT_DIRECTORY_NAME}`
        );
      }
      // 初始化配置目录，首次加载时确保 configs 目录存在。
      async initialize() {
        await this.ensureDirectory(this.configDirectoryPath);
      }
      // 读取指定功能的独立配置文件，返回是否存在以及解析后的内容。
      async load(featureKey) {
        const adapter = this.plugin.app.vault.adapter;
        const filePath = this.getFeatureConfigPath(featureKey);
        if (!await adapter.exists(filePath)) {
          return {
            found: false,
            data: null
          };
        }
        try {
          const content = await adapter.read(filePath);
          return {
            found: true,
            data: JSON.parse(content)
          };
        } catch (error) {
          console.error(`[${this.plugin.manifest.name}] 读取功能配置失败 (${featureKey})`, error);
          return {
            found: true,
            data: null
          };
        }
      }
      // 保存指定功能的配置，并通过写入队列避免并发覆盖。
      async save(featureKey, data) {
        return this.enqueueWrite(featureKey, async () => {
          const adapter = this.plugin.app.vault.adapter;
          const filePath = this.getFeatureConfigPath(featureKey);
          const jsonContent = JSON.stringify(data, null, 2);
          await adapter.write(filePath, jsonContent);
        });
      }
      // 返回指定功能的配置文件当前是否已存在。
      async exists(featureKey) {
        return this.plugin.app.vault.adapter.exists(this.getFeatureConfigPath(featureKey));
      }
      // 返回配置目录路径，供设置页展示状态与定位文件。
      getConfigDirectoryPath() {
        return this.configDirectoryPath;
      }
      // 返回配置导出目录路径，供设置页展示导出文件位置。
      getExportDirectoryPath() {
        return this.exportDirectoryPath;
      }
      // 将导出内容写入独立备份文件，并返回实际写入路径。
      async writeExportFile(fileName, content) {
        await this.ensureDirectory(this.exportDirectoryPath);
        const filePath = obsidian2.normalizePath(`${this.exportDirectoryPath}/${fileName}`);
        await this.plugin.app.vault.adapter.write(filePath, content);
        return filePath;
      }
      // 返回某个功能配置文件的完整路径。
      getFeatureConfigPath(featureKey) {
        const fileName = constants.FEATURE_CONFIG_FILE_NAMES[featureKey] || featureKey;
        return obsidian2.normalizePath(`${this.configDirectoryPath}/${fileName}.json`);
      }
      // 将同一功能的写入串行化，保证最后一次保存不会被前一次异步回写覆盖。
      async enqueueWrite(queueKey, writeOperation) {
        const previousTask = this.writeQueue.get(queueKey) || Promise.resolve();
        const nextTask = previousTask.catch(() => {
        }).then(writeOperation).finally(() => {
          if (this.writeQueue.get(queueKey) === nextTask) {
            this.writeQueue.delete(queueKey);
          }
        });
        this.writeQueue.set(queueKey, nextTask);
        return nextTask;
      }
      // 确保指定目录存在，便于首次导出或初始化时统一复用。
      async ensureDirectory(directoryPath) {
        const adapter = this.plugin.app.vault.adapter;
        if (await adapter.exists(directoryPath)) return;
        await adapter.mkdir(directoryPath);
      }
    };
    module2.exports = {
      FeatureConfigManager
    };
  }
});

// src/modules/plugin-data/store.js
var require_store2 = __commonJS({
  "src/modules/plugin-data/store.js"(exports2, module2) {
    "use strict";
    var featureConfigManagerModule = require_feature_config_manager();
    var constants = require_constants8();
    var PluginDataStore = class {
      constructor(plugin) {
        this.plugin = plugin;
        this.featureConfigManager = new featureConfigManagerModule.FeatureConfigManager(plugin);
        this.data = this.normalizeCoreData();
        this.featureData = this.normalizeFeatureData();
      }
      // 加载本地持久化数据，并在需要时将旧版模块切片迁移到独立配置文件。
      async load() {
        const rawData = await this.plugin.loadData();
        this.data = this.normalizeCoreData(rawData);
        await this.featureConfigManager.initialize();
        this.featureData.fileMarker = await this.loadFeatureSlice("fileMarker", rawData?.fileMarker);
        this.featureData.anchorGraph = await this.loadFeatureSlice("anchorGraph", rawData?.anchorGraph);
        this.featureData.menuCustomizer = await this.loadFeatureSlice("menuCustomizer", rawData?.menuCustomizer);
        this.featureData.copyPath = await this.loadFeatureSlice("copyPath", rawData?.copyPath);
        this.featureData.statusBarEnhancer = await this.loadFeatureSlice("statusBarEnhancer", rawData?.statusBarEnhancer);
        this.featureData.tabBarEnhancer = await this.loadFeatureSlice("tabBarEnhancer", rawData?.tabBarEnhancer);
        this.featureData.fileExplorerEnhancer = await this.loadFeatureSlice("fileExplorerEnhancer", rawData?.fileExplorerEnhancer);
        if (this.hasLegacyFeatureSlices(rawData)) {
          await this.save();
        }
      }
      // 保存当前核心配置到 data.json，本方法不再负责落盘模块业务数据。
      async save() {
        this.data = this.normalizeCoreData(this.data);
        await this.plugin.saveData(this.data);
      }
      // 返回整份插件数据快照，兼容上层仍以 settings 读取模块切片的场景。
      getData() {
        return this.normalizeData(Object.assign({}, this.data, this.featureData));
      }
      // 返回插件级功能开关切片。
      getFeatures() {
        return this.data.features;
      }
      // 更新插件级功能开关切片。
      setFeatures(features) {
        this.data.features = this.normalizeFeatures(features);
      }
      // 返回文件标记数据切片。
      getFileMarkerData() {
        return this.featureData.fileMarker;
      }
      // 更新文件标记数据切片缓存。
      setFileMarkerData(fileMarkerData) {
        this.featureData.fileMarker = this.normalizeFileMarkerData(fileMarkerData);
      }
      // 返回关系图谱增强的独立配置切片。
      getAnchorGraphData() {
        return this.featureData.anchorGraph;
      }
      // 更新关系图谱增强的独立配置切片缓存。
      setAnchorGraphData(anchorGraphData) {
        this.featureData.anchorGraph = this.normalizeAnchorGraphData(anchorGraphData);
      }
      // 返回右键菜单自定义的独立配置切片。
      getMenuCustomizerData() {
        return this.featureData.menuCustomizer;
      }
      // 更新右键菜单自定义的独立配置切片缓存。
      setMenuCustomizerData(menuCustomizerData) {
        this.featureData.menuCustomizer = this.normalizeMenuCustomizerData(menuCustomizerData);
      }
      // 返回复制路径模块的独立配置切片。
      getCopyPathData() {
        return this.featureData.copyPath;
      }
      // 更新复制路径模块的独立配置切片缓存。
      setCopyPathData(copyPathData) {
        this.featureData.copyPath = this.normalizeCopyPathData(copyPathData);
      }
      // 返回状态栏增强模块的独立配置切片。
      getStatusBarEnhancerData() {
        return this.featureData.statusBarEnhancer;
      }
      // 更新状态栏增强模块的独立配置切片缓存。
      setStatusBarEnhancerData(statusBarEnhancerData) {
        this.featureData.statusBarEnhancer = this.normalizeStatusBarEnhancerData(statusBarEnhancerData);
      }
      // 返回标签栏增强模块的独立配置切片。
      getTabBarEnhancerData() {
        return this.featureData.tabBarEnhancer;
      }
      // 更新标签栏增强模块的独立配置切片缓存。
      setTabBarEnhancerData(tabBarEnhancerData) {
        this.featureData.tabBarEnhancer = this.normalizeTabBarEnhancerData(tabBarEnhancerData);
      }
      // 返回文件资源管理器增强模块的独立配置切片。
      getFileExplorerEnhancerData() {
        return this.featureData.fileExplorerEnhancer;
      }
      // 更新文件资源管理器增强模块的独立配置切片缓存。
      setFileExplorerEnhancerData(fileExplorerEnhancerData) {
        this.featureData.fileExplorerEnhancer = this.normalizeFileExplorerEnhancerData(fileExplorerEnhancerData);
      }
      // 保存文件标记功能数据到独立配置文件。
      async saveFileMarkerData(fileMarkerData) {
        this.setFileMarkerData(fileMarkerData);
        await this.featureConfigManager.save("fileMarker", this.featureData.fileMarker);
      }
      // 保存关系图谱增强功能数据到独立配置文件。
      async saveAnchorGraphData(anchorGraphData) {
        this.setAnchorGraphData(anchorGraphData);
        await this.featureConfigManager.save("anchorGraph", this.featureData.anchorGraph);
      }
      // 保存右键菜单自定义功能数据到独立配置文件。
      async saveMenuCustomizerData(menuCustomizerData) {
        this.setMenuCustomizerData(menuCustomizerData);
        await this.featureConfigManager.save("menuCustomizer", this.featureData.menuCustomizer);
      }
      // 保存复制路径模块数据到独立配置文件。
      async saveCopyPathData(copyPathData) {
        this.setCopyPathData(copyPathData);
        await this.featureConfigManager.save("copyPath", this.featureData.copyPath);
      }
      // 保存状态栏增强模块数据到独立配置文件。
      async saveStatusBarEnhancerData(statusBarEnhancerData) {
        this.setStatusBarEnhancerData(statusBarEnhancerData);
        await this.featureConfigManager.save("statusBarEnhancer", this.featureData.statusBarEnhancer);
      }
      // 保存标签栏增强模块数据到独立配置文件。
      async saveTabBarEnhancerData(tabBarEnhancerData) {
        this.setTabBarEnhancerData(tabBarEnhancerData);
        await this.featureConfigManager.save("tabBarEnhancer", this.featureData.tabBarEnhancer);
        await this.featureConfigManager.save("fileExplorerEnhancer", this.featureData.fileExplorerEnhancer);
      }
      // 保存文件资源管理器增强模块数据到独立配置文件。
      async saveFileExplorerEnhancerData(fileExplorerEnhancerData) {
        this.setFileExplorerEnhancerData(fileExplorerEnhancerData);
        await this.featureConfigManager.save("fileExplorerEnhancer", this.featureData.fileExplorerEnhancer);
      }
      // 将当前核心配置与全部模块配置一次性持久化，供导入和全量重置复用。
      async saveAll() {
        await this.save();
        await this.featureConfigManager.save("fileMarker", this.featureData.fileMarker);
        await this.featureConfigManager.save("anchorGraph", this.featureData.anchorGraph);
        await this.featureConfigManager.save("menuCustomizer", this.featureData.menuCustomizer);
        await this.featureConfigManager.save("copyPath", this.featureData.copyPath);
        await this.featureConfigManager.save("statusBarEnhancer", this.featureData.statusBarEnhancer);
        await this.featureConfigManager.save("tabBarEnhancer", this.featureData.tabBarEnhancer);
      }
      // 返回当前插件管理的配置文件状态摘要，供设置页展示配置文件入口。
      async getConfigFileStatuses() {
        const adapter = this.plugin.app.vault.adapter;
        const coreConfigPath = this.getCoreConfigPath();
        const fileMarkerPath = this.featureConfigManager.getFeatureConfigPath("fileMarker");
        const anchorGraphPath = this.featureConfigManager.getFeatureConfigPath("anchorGraph");
        const menuCustomizerPath = this.featureConfigManager.getFeatureConfigPath("menuCustomizer");
        const copyPathPath = this.featureConfigManager.getFeatureConfigPath("copyPath");
        const statusBarEnhancerPath = this.featureConfigManager.getFeatureConfigPath("statusBarEnhancer");
        const tabBarEnhancerPath = this.featureConfigManager.getFeatureConfigPath("tabBarEnhancer");
        const fileExplorerEnhancerPath = this.featureConfigManager.getFeatureConfigPath("fileExplorerEnhancer");
        return {
          directoryPath: this.featureConfigManager.getConfigDirectoryPath(),
          exportDirectoryPath: this.featureConfigManager.getExportDirectoryPath(),
          core: {
            key: "core",
            name: "核心配置",
            path: coreConfigPath,
            exists: await adapter.exists(coreConfigPath),
            summary: `保存 ${Object.keys(this.data.features || {}).length} 个功能开关分组`
          },
          fileMarker: {
            key: "fileMarker",
            name: "文件标记配置",
            path: fileMarkerPath,
            exists: await this.featureConfigManager.exists("fileMarker"),
            summary: `当前含 ${Object.keys(this.featureData.fileMarker.marks || {}).length} 条标记、${(this.featureData.fileMarker.groups || []).length} 个分组`
          },
          anchorGraph: {
            key: "anchorGraph",
            name: "关系图谱配置",
            path: anchorGraphPath,
            exists: await this.featureConfigManager.exists("anchorGraph"),
            summary: `当前含 ${Object.keys(this.featureData.anchorGraph.noteOverrides || {}).length} 条笔记覆盖规则`
          },
          menuCustomizer: {
            key: "menuCustomizer",
            name: "右键菜单配置",
            path: menuCustomizerPath,
            exists: await this.featureConfigManager.exists("menuCustomizer"),
            summary: `当前含 ${Object.values(this.featureData.menuCustomizer.menus || {}).reduce((count, menuConfig) => count + (Array.isArray(menuConfig.groups) ? menuConfig.groups.length : 0), 0)} 个分组`
          },
          copyPath: {
            key: "copyPath",
            name: "复制路径配置",
            path: copyPathPath,
            exists: await this.featureConfigManager.exists("copyPath"),
            summary: `文件夹末尾补 /：${this.featureData.copyPath.addTrailingSlashToFolders === true ? "已开启" : "已关闭"}`
          },
          statusBarEnhancer: {
            key: "statusBarEnhancer",
            name: "状态栏增强配置",
            path: statusBarEnhancerPath,
            exists: await this.featureConfigManager.exists("statusBarEnhancer"),
            summary: `显示文件名：${this.featureData.statusBarEnhancer.showFileName === true ? "已开启" : "已关闭"}，显示图标：${this.featureData.statusBarEnhancer.showIcons === true ? "已开启" : "已关闭"}，复制绝对路径：${this.featureData.statusBarEnhancer.copyAbsolutePath !== false ? "已开启" : "已关闭"}，最后修改时间：${this.featureData.statusBarEnhancer.lastModifiedEnabled !== false ? "已开启" : "已关闭"}，创建时间：${this.featureData.statusBarEnhancer.createdEnabled === true ? "已开启" : "已关闭"}`
          },
          tabBarEnhancer: {
            key: "tabBarEnhancer",
            name: "标签栏增强配置",
            path: tabBarEnhancerPath,
            exists: await this.featureConfigManager.exists("tabBarEnhancer"),
            summary: `空白区滚轮切换：${this.featureData.tabBarEnhancer.topBarWheelTabSwitch === true ? "已开启" : "已关闭"}，跳过隐藏标签：${this.featureData.tabBarEnhancer.skipCssHiddenTabs !== false ? "已开启" : "已关闭"}，跳过未加载插件标签：${this.featureData.tabBarEnhancer.skipUnloadedPluginTabs !== false ? "已开启" : "已关闭"}`
          },
          fileExplorerEnhancer: {
            key: "fileExplorerEnhancer",
            name: "文件资源管理器增强配置",
            path: fileExplorerEnhancerPath,
            exists: await this.featureConfigManager.exists("fileExplorerEnhancer"),
            summary: `置顶路径规则：${(this.featureData.fileExplorerEnhancer.pinFilters.paths || []).length} 条，隐藏路径规则：${(this.featureData.fileExplorerEnhancer.hideFilters.paths || []).length} 条`
          }
        };
      }
      // 导出完整配置快照，便于设置页复制、备份和迁移。
      exportConfigurationBundle() {
        return {
          schemaVersion: 1,
          exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
          coreData: this.normalizeCoreData(this.data),
          featureData: this.normalizeFeatureData(this.featureData)
        };
      }
      // 将当前配置导出为独立备份文件，便于用户保留多个版本快照。
      async exportConfigurationBundleToFile() {
        const exportFileName = this.buildExportFileName();
        const exportText = JSON.stringify(this.exportConfigurationBundle(), null, 2);
        const filePath = await this.featureConfigManager.writeExportFile(exportFileName, exportText);
        return {
          fileName: exportFileName,
          filePath
        };
      }
      // 导入完整配置快照，兼容当前导出格式与旧版顶层切片结构。
      async importConfigurationBundle(bundle) {
        const normalizedBundle = this.normalizeImportedBundle(bundle);
        this.data = normalizedBundle.coreData;
        this.featureData = normalizedBundle.featureData;
        await this.saveAll();
        return this.getData();
      }
      // 将指定功能配置恢复为默认值并立即持久化。
      async resetFeatureData(featureKey) {
        const defaultFeatureData = this.normalizeFeatureSlice(featureKey, constants.DEFAULT_FEATURE_DATA[featureKey]);
        if (featureKey === "fileMarker") {
          this.featureData.fileMarker = defaultFeatureData;
        } else if (featureKey === "anchorGraph") {
          this.featureData.anchorGraph = defaultFeatureData;
        } else if (featureKey === "menuCustomizer") {
          this.featureData.menuCustomizer = defaultFeatureData;
        } else if (featureKey === "copyPath") {
          this.featureData.copyPath = defaultFeatureData;
        } else if (featureKey === "statusBarEnhancer") {
          this.featureData.statusBarEnhancer = defaultFeatureData;
        } else if (featureKey === "tabBarEnhancer") {
          this.featureData.tabBarEnhancer = defaultFeatureData;
        } else if (featureKey === "fileExplorerEnhancer") {
          this.featureData.fileExplorerEnhancer = defaultFeatureData;
        }
        await this.featureConfigManager.save(featureKey, defaultFeatureData);
        return defaultFeatureData;
      }
      // 将整个插件配置恢复为默认值，并同步覆盖所有配置文件。
      async resetAllData() {
        this.data = this.normalizeCoreData(constants.DEFAULT_PLUGIN_DATA);
        this.featureData = this.normalizeFeatureData(constants.DEFAULT_FEATURE_DATA);
        await this.saveAll();
        return this.getData();
      }
      // 归一化整份插件数据快照，便于统一输出当前内存中的完整状态。
      normalizeData(data) {
        const source = this.isPlainObject(data) ? data : {};
        const normalizedCoreData = this.normalizeCoreData(source);
        return Object.assign({}, normalizedCoreData, {
          fileMarker: this.normalizeFileMarkerData(source.fileMarker),
          anchorGraph: this.normalizeAnchorGraphData(source.anchorGraph),
          menuCustomizer: this.normalizeMenuCustomizerData(source.menuCustomizer),
          copyPath: this.normalizeCopyPathData(source.copyPath),
          statusBarEnhancer: this.normalizeStatusBarEnhancerData(source.statusBarEnhancer),
          tabBarEnhancer: this.normalizeTabBarEnhancerData(source.tabBarEnhancer),
          fileExplorerEnhancer: this.normalizeFileExplorerEnhancerData(source.fileExplorerEnhancer)
        });
      }
      // 归一化核心配置，只保留 data.json 应继续存储的字段，并移除旧版功能切片。
      normalizeCoreData(data) {
        const source = this.isPlainObject(data) ? data : {};
        const normalizedCoreData = Object.assign({}, source);
        delete normalizedCoreData.fileMarker;
        delete normalizedCoreData.anchorGraph;
        delete normalizedCoreData.menuCustomizer;
        delete normalizedCoreData.copyPath;
        delete normalizedCoreData.statusBarEnhancer;
        delete normalizedCoreData.tabBarEnhancer;
        delete normalizedCoreData.fileExplorerEnhancer;
        normalizedCoreData.features = this.normalizeFeatures(source.features);
        return normalizedCoreData;
      }
      // 归一化功能配置缓存，避免首次读取时报空。
      normalizeFeatureData(featureData) {
        const source = this.isPlainObject(featureData) ? featureData : {};
        return {
          fileMarker: this.normalizeFileMarkerData(source.fileMarker),
          anchorGraph: this.normalizeAnchorGraphData(source.anchorGraph),
          menuCustomizer: this.normalizeMenuCustomizerData(source.menuCustomizer),
          copyPath: this.normalizeCopyPathData(source.copyPath),
          statusBarEnhancer: this.normalizeStatusBarEnhancerData(source.statusBarEnhancer),
          tabBarEnhancer: this.normalizeTabBarEnhancerData(source.tabBarEnhancer),
          fileExplorerEnhancer: this.normalizeFileExplorerEnhancerData(source.fileExplorerEnhancer)
        };
      }
      // 归一化插件级功能开关结构。
      normalizeFeatures(features) {
        return {
          fileMarker: {
            enabled: features?.fileMarker?.enabled === true
          },
          anchorGraph: {
            enabled: features?.anchorGraph?.enabled === true
          },
          menuCustomizer: {
            enabled: features?.menuCustomizer?.enabled === true
          },
          copyPath: {
            enabled: features?.copyPath?.enabled === true
          },
          statusBarEnhancer: {
            enabled: features?.statusBarEnhancer?.enabled === true
          },
          tabBarEnhancer: {
            enabled: features?.tabBarEnhancer?.enabled === true
          },
          fileExplorerEnhancer: {
            enabled: features?.fileExplorerEnhancer?.enabled === true
          }
        };
      }
      // 归一化文件标记切片的顶层结构，具体业务字段由 file-marker 模块进一步收敛。
      normalizeFileMarkerData(fileMarkerData) {
        const source = this.isPlainObject(fileMarkerData) ? fileMarkerData : {};
        const defaultFileMarker = constants.DEFAULT_FEATURE_DATA.fileMarker;
        return Object.assign({}, source, {
          marks: source.marks && typeof source.marks === "object" ? source.marks : defaultFileMarker.marks,
          groups: Array.isArray(source.groups) ? source.groups : defaultFileMarker.groups
        });
      }
      // 归一化关系图谱增强配置结构，保证旧数据迁移后能维持稳定形状。
      normalizeAnchorGraphData(anchorGraphData) {
        const source = this.isPlainObject(anchorGraphData) ? anchorGraphData : {};
        const defaultAnchorGraph = constants.DEFAULT_FEATURE_DATA.anchorGraph;
        const defaultSettings = this.isPlainObject(source.defaultSettings) ? source.defaultSettings : {};
        const noteOverrides = {};
        if (this.isPlainObject(source.noteOverrides)) {
          Object.entries(source.noteOverrides).forEach(([notePath, override]) => {
            if (!notePath || !this.isPlainObject(override)) return;
            noteOverrides[notePath] = Object.assign({}, override, {
              mode: typeof override.mode === "string" && override.mode.trim() ? override.mode.trim() : "inherit"
            });
          });
        }
        return Object.assign({}, source, {
          defaultSettings: Object.assign({}, defaultAnchorGraph.defaultSettings, defaultSettings, {
            htmlEnhancementEnabled: defaultSettings.htmlEnhancementEnabled !== false
          }),
          noteOverrides
        });
      }
      // 归一化右键菜单自定义配置结构，保证首次安装与旧数据迁移后形状稳定。
      normalizeMenuCustomizerData(menuCustomizerData) {
        const source = this.isPlainObject(menuCustomizerData) ? menuCustomizerData : {};
        const defaultMenuCustomizer = constants.DEFAULT_FEATURE_DATA.menuCustomizer;
        const normalizedMenus = {};
        Object.keys(defaultMenuCustomizer.menus || {}).forEach((menuType) => {
          const menuSource = this.isPlainObject(source.menus?.[menuType]) ? source.menus[menuType] : {};
          const defaultMenuConfig = defaultMenuCustomizer.menus[menuType];
          normalizedMenus[menuType] = {
            enabled: menuSource.enabled === true,
            groups: Array.isArray(menuSource.groups) ? menuSource.groups : defaultMenuConfig.groups,
            rootItems: Array.isArray(menuSource.rootItems) ? menuSource.rootItems : defaultMenuConfig.rootItems,
            commandOverrides: this.isPlainObject(menuSource.commandOverrides) ? menuSource.commandOverrides : defaultMenuConfig.commandOverrides,
            commandMappings: Array.isArray(menuSource.commandMappings) ? menuSource.commandMappings : defaultMenuConfig.commandMappings
          };
        });
        return {
          menus: normalizedMenus
        };
      }
      // 归一化复制路径模块配置结构，保证首次安装与旧数据迁移后形状稳定。
      normalizeCopyPathData(copyPathData) {
        const source = this.isPlainObject(copyPathData) ? copyPathData : {};
        const defaultCopyPath = constants.DEFAULT_FEATURE_DATA.copyPath;
        return {
          addTrailingSlashToFolders: source.addTrailingSlashToFolders !== false && defaultCopyPath.addTrailingSlashToFolders !== false
        };
      }
      // 归一化状态栏增强模块配置结构，保证首次安装与旧数据迁移后形状稳定。
      normalizeStatusBarEnhancerData(statusBarEnhancerData) {
        const source = this.isPlainObject(statusBarEnhancerData) ? statusBarEnhancerData : {};
        const defaults = constants.DEFAULT_FEATURE_DATA.statusBarEnhancer;
        return {
          showFileName: source.showFileName === true,
          showIcons: source.showIcons === true,
          copyAbsolutePath: source.copyAbsolutePath !== false,
          lastModifiedEnabled: source.lastModifiedEnabled !== false,
          lastModifiedPrepend: typeof source.lastModifiedPrepend === "string" ? source.lastModifiedPrepend : defaults.lastModifiedPrepend,
          lastModifiedTimestampFormat: typeof source.lastModifiedTimestampFormat === "string" && source.lastModifiedTimestampFormat ? source.lastModifiedTimestampFormat : defaults.lastModifiedTimestampFormat,
          createdEnabled: source.createdEnabled === true,
          createdPrepend: typeof source.createdPrepend === "string" ? source.createdPrepend : defaults.createdPrepend,
          createdTimestampFormat: typeof source.createdTimestampFormat === "string" && source.createdTimestampFormat ? source.createdTimestampFormat : defaults.createdTimestampFormat,
          cycleOnClickEnabled: source.cycleOnClickEnabled !== false,
          organizer: this.isPlainObject(source.organizer) ? {
            elements: this.normalizeOrganizerElements(source.organizer.elements),
            deletedIds: Array.isArray(source.organizer.deletedIds) ? source.organizer.deletedIds.filter(function(id) {
              return typeof id === "string";
            }) : []
          } : {
            elements: {},
            deletedIds: []
          },
          snippets: this.isPlainObject(source.snippets) ? source.snippets : {}
        };
      }
      // 归一化状态栏元素管理（organizer）的元素状态映射表。
      normalizeOrganizerElements(elements) {
        var source = this.isPlainObject(elements) ? elements : {};
        var result = {};
        Object.keys(source).forEach(function(id) {
          var status = source[id];
          if (typeof status !== "object" || status === null) return;
          result[id] = {
            position: typeof status.position === "number" ? status.position : 0,
            visible: status.visible !== false
          };
        });
        return result;
      }
      // 归一化标签栏增强模块配置结构，保证首次安装与旧数据迁移后形状稳定。
      normalizeTabBarEnhancerData(tabBarEnhancerData) {
        const source = this.isPlainObject(tabBarEnhancerData) ? tabBarEnhancerData : {};
        return {
          debug: source.debug === true,
          topBarWheelTabSwitch: source.topBarWheelTabSwitch === true,
          skipCssHiddenTabs: source.skipCssHiddenTabs !== false,
          skipUnloadedPluginTabs: source.skipUnloadedPluginTabs !== false
        };
      }
      // 归一化文件资源管理器增强配置结构，保证首次安装与旧数据迁移后形状稳定。
      normalizeFileExplorerEnhancerData(fileExplorerEnhancerData) {
        var source = this.isPlainObject(fileExplorerEnhancerData) ? fileExplorerEnhancerData : {};
        var defaults = require_constants7().DEFAULT_FILE_EXPLORER_ENHANCER_SETTINGS;
        return {
          pinFilters: {
            active: source.pinFilters && source.pinFilters.active === true,
            paths: Array.isArray(source.pinFilters && source.pinFilters.paths) ? this.normalizePathFilters(source.pinFilters.paths) : defaults.pinFilters.paths
          },
          hideFilters: {
            active: source.hideFilters && source.hideFilters.active === true,
            paths: Array.isArray(source.hideFilters && source.hideFilters.paths) ? this.normalizePathFilters(source.hideFilters.paths) : defaults.hideFilters.paths
          }
        };
      }
      // 归一化路径过滤器数组，保证 position 等字段在持久化时不会丢失。
      normalizePathFilters(filters) {
        return filters.filter(function(f) {
          return f && typeof f === "object" && !Array.isArray(f);
        }).map(function(f, idx) {
          return {
            name: typeof f.name === "string" ? f.name : "",
            active: f.active !== false,
            type: ["FILES", "DIRECTORIES"].indexOf(f.type) !== -1 ? f.type : "FILES",
            pattern: typeof f.pattern === "string" ? f.pattern : "",
            patternType: ["REGEX", "WILDCARD", "STRICT"].indexOf(f.patternType) !== -1 ? f.patternType : "STRICT",
            position: typeof f.position === "number" && !isNaN(f.position) ? f.position : idx
          };
        }).sort(function(a, b) {
          return a.position - b.position;
        });
      }
      // 加载单个功能切片，优先读取独立文件，缺失时自动迁移旧版 data.json 中的同名数据。
      async loadFeatureSlice(featureKey, legacyData) {
        const loadResult = await this.featureConfigManager.load(featureKey);
        if (loadResult.found && this.isPlainObject(loadResult.data)) {
          return this.normalizeFeatureSlice(featureKey, loadResult.data);
        }
        if (this.isPlainObject(legacyData)) {
          const normalizedLegacyData = this.normalizeFeatureSlice(featureKey, legacyData);
          await this.featureConfigManager.save(featureKey, normalizedLegacyData);
          return normalizedLegacyData;
        }
        const defaultFeatureData = this.normalizeFeatureSlice(featureKey, constants.DEFAULT_FEATURE_DATA[featureKey]);
        await this.featureConfigManager.save(featureKey, defaultFeatureData);
        return defaultFeatureData;
      }
      // 根据功能标识归一化对应模块的数据切片。
      normalizeFeatureSlice(featureKey, featureData) {
        if (featureKey === "fileMarker") {
          return this.normalizeFileMarkerData(featureData);
        }
        if (featureKey === "anchorGraph") {
          return this.normalizeAnchorGraphData(featureData);
        }
        if (featureKey === "menuCustomizer") {
          return this.normalizeMenuCustomizerData(featureData);
        }
        if (featureKey === "copyPath") {
          return this.normalizeCopyPathData(featureData);
        }
        if (featureKey === "statusBarEnhancer") {
          return this.normalizeStatusBarEnhancerData(featureData);
        }
        if (featureKey === "tabBarEnhancer") {
          return this.normalizeTabBarEnhancerData(featureData);
        }
        if (featureKey === "fileExplorerEnhancer") {
          return this.normalizeFileExplorerEnhancerData(featureData);
        }
        return this.isPlainObject(featureData) ? featureData : {};
      }
      // 判断旧版 data.json 中是否仍残留需要迁移的模块切片。
      hasLegacyFeatureSlices(data) {
        const source = this.isPlainObject(data) ? data : {};
        return this.isPlainObject(source.fileMarker) || this.isPlainObject(source.anchorGraph) || this.isPlainObject(source.menuCustomizer) || this.isPlainObject(source.copyPath) || this.isPlainObject(source.statusBarEnhancer) || this.isPlainObject(source.tabBarEnhancer) || this.isPlainObject(source.fileExplorerEnhancer);
      }
      // 返回 Obsidian 实际使用的核心配置文件路径，便于设置页展示。
      getCoreConfigPath() {
        return `${this.plugin.app.vault.configDir}/plugins/${this.plugin.manifest.id}/data.json`;
      }
      // 将导入数据统一归一化为当前插件使用的核心配置与模块配置结构。
      normalizeImportedBundle(bundle) {
        if (!this.isPlainObject(bundle)) {
          throw new Error("导入内容必须是 JSON 对象");
        }
        const hasSeparatedPayload = this.isPlainObject(bundle.coreData) || this.isPlainObject(bundle.featureData);
        const featureSource = hasSeparatedPayload ? Object.assign({}, bundle.featureData, {
          fileMarker: bundle.featureData?.fileMarker || bundle.fileMarker,
          anchorGraph: bundle.featureData?.anchorGraph || bundle.anchorGraph,
          menuCustomizer: bundle.featureData?.menuCustomizer || bundle.menuCustomizer,
          copyPath: bundle.featureData?.copyPath || bundle.copyPath,
          statusBarEnhancer: bundle.featureData?.statusBarEnhancer || bundle.statusBarEnhancer,
          tabBarEnhancer: bundle.featureData?.tabBarEnhancer || bundle.tabBarEnhancer,
          fileExplorerEnhancer: bundle.featureData?.fileExplorerEnhancer || bundle.fileExplorerEnhancer
        }) : bundle;
        const coreSource = hasSeparatedPayload ? Object.assign({}, bundle.coreData, {
          features: bundle.coreData?.features || bundle.features
        }) : bundle;
        return {
          coreData: this.normalizeCoreData(coreSource),
          featureData: this.normalizeFeatureData(featureSource)
        };
      }
      // 判断当前值是否为普通对象，避免数组、空值等被误当成配置对象。
      isPlainObject(value) {
        return Boolean(value) && typeof value === "object" && !Array.isArray(value);
      }
      // 生成包含时间戳的导出文件名，避免连续导出时相互覆盖。
      buildExportFileName() {
        const now = /* @__PURE__ */ new Date();
        const timestamp = [
          now.getFullYear(),
          String(now.getMonth() + 1).padStart(2, "0"),
          String(now.getDate()).padStart(2, "0"),
          "-",
          String(now.getHours()).padStart(2, "0"),
          String(now.getMinutes()).padStart(2, "0"),
          String(now.getSeconds()).padStart(2, "0")
        ].join("");
        return `${this.plugin.manifest.id}-config-export-${timestamp}.json`;
      }
    };
    module2.exports = {
      PluginDataStore
    };
  }
});

// src/modules/plugin-data/index.js
var require_plugin_data = __commonJS({
  "src/modules/plugin-data/index.js"(exports2, module2) {
    "use strict";
    var constants = require_constants8();
    var featureConfigManager = require_feature_config_manager();
    var store = require_store2();
    module2.exports = Object.assign({}, constants, featureConfigManager, store);
  }
});

// src/modules/plugin-settings/constants.js
var require_constants9 = __commonJS({
  "src/modules/plugin-settings/constants.js"(exports2, module2) {
    "use strict";
    var DEFAULT_FEATURE_SETTINGS = {
      fileMarker: {
        enabled: false
      },
      anchorGraph: {
        enabled: false
      },
      menuCustomizer: {
        enabled: false
      },
      copyPath: {
        enabled: false
      },
      statusBarEnhancer: {
        enabled: false
      },
      tabBarEnhancer: {
        enabled: false
      },
      fileExplorerEnhancer: {
        enabled: false
      }
    };
    module2.exports = {
      DEFAULT_FEATURE_SETTINGS
    };
  }
});

// src/modules/plugin-settings/store.js
var require_store3 = __commonJS({
  "src/modules/plugin-settings/store.js"(exports2, module2) {
    "use strict";
    var constants = require_constants9();
    var PluginSettingsStore = class {
      constructor(plugin) {
        this.plugin = plugin;
        this.settings = this.normalizeSettings();
      }
      // 挂载插件级数据中的功能开关切片，供后续业务逻辑复用。
      load(settings) {
        this.settings = this.normalizeSettings(settings);
      }
      // 将最新功能开关同步到插件级数据仓库并持久化到本地。
      async save() {
        this.settings = this.normalizeSettings(this.settings);
        this.plugin.dataStore.setFeatures(this.settings);
        await this.plugin.dataStore.save();
      }
      // 返回文件标记模块是否启用，供主入口和设置页统一读取。
      isFileMarkerEnabled() {
        return Boolean(this.settings.fileMarker.enabled);
      }
      // 切换文件标记模块的启用状态，并立即持久化到本地。
      async setFileMarkerEnabled(enabled) {
        this.settings.fileMarker.enabled = Boolean(enabled);
        await this.save();
        return this.isFileMarkerEnabled();
      }
      // 返回关系图谱增强是否启用，供主入口和设置页统一读取。
      isAnchorGraphEnabled() {
        return Boolean(this.settings.anchorGraph.enabled);
      }
      // 切换关系图谱增强的启用状态，并立即持久化到本地。
      async setAnchorGraphEnabled(enabled) {
        this.settings.anchorGraph.enabled = Boolean(enabled);
        await this.save();
        return this.isAnchorGraphEnabled();
      }
      // 返回右键菜单自定义是否启用，供主入口和设置页统一读取。
      isMenuCustomizerEnabled() {
        return Boolean(this.settings.menuCustomizer.enabled);
      }
      // 切换右键菜单自定义的启用状态，并立即持久化到本地。
      async setMenuCustomizerEnabled(enabled) {
        this.settings.menuCustomizer.enabled = Boolean(enabled);
        await this.save();
        return this.isMenuCustomizerEnabled();
      }
      // 返回复制路径模块是否启用，供主入口和设置页统一读取。
      isCopyPathEnabled() {
        return Boolean(this.settings.copyPath.enabled);
      }
      // 切换复制路径模块的启用状态，并立即持久化到本地。
      async setCopyPathEnabled(enabled) {
        this.settings.copyPath.enabled = Boolean(enabled);
        await this.save();
        return this.isCopyPathEnabled();
      }
      // 返回状态栏增强模块是否启用，供主入口和设置页统一读取。
      isStatusBarEnhancerEnabled() {
        return Boolean(this.settings.statusBarEnhancer.enabled);
      }
      // 切换状态栏增强模块的启用状态，并立即持久化到本地。
      async setStatusBarEnhancerEnabled(enabled) {
        this.settings.statusBarEnhancer.enabled = Boolean(enabled);
        await this.save();
        return this.isStatusBarEnhancerEnabled();
      }
      // 返回标签栏增强模块是否启用，供主入口和设置页统一读取。
      isTabBarEnhancerEnabled() {
        return Boolean(this.settings.tabBarEnhancer.enabled);
      }
      // 切换标签栏增强模块的启用状态，并立即持久化到本地。
      async setTabBarEnhancerEnabled(enabled) {
        this.settings.tabBarEnhancer.enabled = Boolean(enabled);
        await this.save();
        return this.isTabBarEnhancerEnabled();
      }
      // 切换文件资源管理器增强模块的启用状态，并立即持久化到本地。
      async setFileExplorerEnhancerEnabled(enabled) {
        this.settings.fileExplorerEnhancer.enabled = Boolean(enabled);
        await this.save();
        return this.isFileExplorerEnhancerEnabled();
      }
      // 返回文件资源管理器增强模块是否启用，供主入口和设置页统一读取。
      isFileExplorerEnhancerEnabled() {
        return Boolean(this.settings.fileExplorerEnhancer.enabled);
      }
      // 返回功能设置对象，供主入口与设置页读取当前切片。
      getSettings() {
        return this.settings;
      }
      // 归一化插件级功能设置结构。
      normalizeSettings(data) {
        const source = data || constants.DEFAULT_FEATURE_SETTINGS;
        return {
          fileMarker: {
            enabled: source.fileMarker?.enabled === true
          },
          anchorGraph: {
            enabled: source.anchorGraph?.enabled === true
          },
          menuCustomizer: {
            enabled: source.menuCustomizer?.enabled === true
          },
          copyPath: {
            enabled: source.copyPath?.enabled === true
          },
          statusBarEnhancer: {
            enabled: source.statusBarEnhancer?.enabled === true
          },
          tabBarEnhancer: {
            enabled: source.tabBarEnhancer?.enabled === true
          },
          fileExplorerEnhancer: {
            enabled: source.fileExplorerEnhancer?.enabled === true
          }
        };
      }
    };
    module2.exports = {
      PluginSettingsStore
    };
  }
});

// src/modules/plugin-settings/index.js
var require_plugin_settings = __commonJS({
  "src/modules/plugin-settings/index.js"(exports2, module2) {
    "use strict";
    var constants = require_constants9();
    var store = require_store3();
    module2.exports = Object.assign({}, constants, store);
  }
});

// src/modules/plugin-list-enhancer/index.js
var require_plugin_list_enhancer = __commonJS({
  "src/modules/plugin-list-enhancer/index.js"(exports2, module2) {
    "use strict";
    var PluginListEnhancer = class {
      constructor(plugin) {
        this.plugin = plugin;
        this.observer = null;
        this.styleEl = null;
      }
      // 启动插件列表增强能力，包括样式注入和 DOM 变化监听。
      start() {
        this.addBaseStyles();
        this.setupMutationObserver();
        this.processPluginList();
      }
      // 停止插件列表增强能力，清理动态注册资源。
      stop() {
        if (this.observer) this.observer.disconnect();
        if (this.styleEl) this.styleEl.remove();
      }
      // 设置 MutationObserver 以监听设置页面中插件列表的 DOM 变化。
      setupMutationObserver() {
        let debounceTimer = null;
        this.observer = new MutationObserver((mutations) => {
          let shouldProcess = false;
          for (const mutation of mutations) {
            if (mutation.type === "childList") {
              const addedNodes = Array.from(mutation.addedNodes);
              const hasRelevantNodes = addedNodes.some((node) => {
                return node instanceof HTMLElement && (node.classList?.contains("community-plugin-item") || node.classList?.contains("setting-item") || node.classList?.contains("vertical-tab-nav-item") || node.querySelector?.(".community-plugin-item, .setting-item, .vertical-tab-nav-item"));
              });
              if (hasRelevantNodes) {
                shouldProcess = true;
                break;
              }
            } else if (mutation.type === "attributes" && mutation.target instanceof HTMLElement && (mutation.target.classList.contains("vertical-tab-nav-item") || mutation.target.classList.contains("setting-item"))) {
              shouldProcess = true;
              break;
            }
          }
          if (!shouldProcess) return;
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            this.processPluginList();
            debounceTimer = null;
          }, 100);
        });
        this.observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class", "style"]
        });
      }
      // 处理第三方插件列表，为原有功能补齐插件标识与启用状态属性。
      processPluginList() {
        const containers = document.querySelectorAll(
          ".installed-plugins-container, .vertical-tab-header-group-items"
        );
        if (containers.length === 0) return;
        const selectors = [
          ".vertical-tab-nav-item",
          ".setting-item:has(.setting-item-name)"
        ];
        const pluginItems = document.querySelectorAll(selectors.join(", "));
        pluginItems.forEach((item) => {
          let pluginId = item.getAttribute("data-plugin-id");
          if (!pluginId) {
            let nameEl = item.querySelector(".setting-item-name");
            if (!nameEl) nameEl = item;
            const pluginName = nameEl.textContent?.trim();
            if (!pluginName) return;
            pluginId = this.findPluginIdByName(pluginName);
            if (pluginId) {
              item.setAttribute("data-plugin-id", pluginId);
              item.setAttribute("data-plugin-name", pluginName);
              item.classList.add("marked-plugin-item");
            }
          }
          if (!pluginId) return;
          const isEnabled = pluginId === this.plugin.manifest.id || this.plugin.app.plugins.enabledPlugins.has(pluginId);
          item.setAttribute("data-plugin-enabled", isEnabled.toString());
        });
      }
      // 根据插件显示名称查找真实插件 ID。
      findPluginIdByName(name) {
        const manifests = this.plugin.app.plugins.manifests;
        for (const [id, manifest] of Object.entries(manifests)) {
          if (manifest.name === name) {
            return id;
          }
        }
        return null;
      }
      // 注入少量基础样式，保持原有插件列表标记功能继续生效。
      addBaseStyles() {
        this.styleEl = document.createElement("style");
        this.styleEl.id = "obsidian-nene-plugin-styles";
        this.styleEl.textContent = `
      .marked-plugin-item[data-plugin-id] {
        position: relative;
        transition: opacity 0.2s ease;
      }

      .marked-plugin-item[data-plugin-enabled="false"] {
        opacity: 0.72;
      }
    `;
        document.head.appendChild(this.styleEl);
      }
    };
    module2.exports = {
      PluginListEnhancer
    };
  }
});

// src/modules/graph-view-enhancer/index.js
var require_graph_view_enhancer = __commonJS({
  "src/modules/graph-view-enhancer/index.js"(exports2, module2) {
    "use strict";
    var obsidian2 = require("obsidian");
    var MIN_GRAPH_COMPATIBLE_API_VERSION = "1.4.16";
    var STARTUP_FULL_REFRESH_DELAY = 1200;
    var STRUCTURE_FULL_REFRESH_DELAY = 3e3;
    var FULL_REFRESH_BATCH_SIZE = 20;
    var AnchorGraphLinkEnhancer = class {
      constructor(plugin) {
        this.plugin = plugin;
        this.syntheticResolvedLinks = {};
        this.refreshTimer = null;
        this.sourceRefreshTimer = null;
        this.pendingSourceRefresh = null;
        this.isRefreshing = false;
        this.pendingFullRefresh = false;
        this.pendingNotice = false;
        this.graphButtonObserver = null;
        this.graphButtonProcessTimer = null;
        this.styleEl = null;
        this.stats = {
          sourceFileCount: 0,
          edgeCount: 0
        };
        this.isStarted = false;
        this.isCompatibleRuntime = false;
        this.compatibilityWarningShown = false;
        this.lastCompatibilityMessage = "";
      }
      // 启动增强器时执行一次全量构建，保证图谱立即可见。
      start() {
        if (!this.isFeatureEnabled()) {
          this.isStarted = false;
          this.isCompatibleRuntime = false;
          return;
        }
        if (this.isStarted) {
          this.processGraphRefreshButtons();
          return;
        }
        this.isCompatibleRuntime = this.ensureCompatibleRuntime(true);
        if (!this.isCompatibleRuntime) {
          return;
        }
        this.isStarted = true;
        this.addGraphRefreshButtonStyles();
        this.setupGraphRefreshButtonObserver();
        this.processGraphRefreshButtons();
        this.scheduleFullRefresh(STARTUP_FULL_REFRESH_DELAY);
      }
      // 停止增强器时回滚注入的关系边，避免影响其他插件或 Obsidian 原生索引。
      stop() {
        this.isStarted = false;
        this.isCompatibleRuntime = false;
        if (this.refreshTimer) {
          window.clearTimeout(this.refreshTimer);
          this.refreshTimer = null;
        }
        if (this.sourceRefreshTimer) {
          window.clearTimeout(this.sourceRefreshTimer);
          this.sourceRefreshTimer = null;
        }
        if (this.graphButtonProcessTimer) {
          window.clearTimeout(this.graphButtonProcessTimer);
          this.graphButtonProcessTimer = null;
        }
        if (this.graphButtonObserver) {
          this.graphButtonObserver.disconnect();
          this.graphButtonObserver = null;
        }
        if (this.styleEl) {
          this.styleEl.remove();
          this.styleEl = null;
        }
        this.pendingSourceRefresh = null;
        this.removeGraphRefreshButtons();
        this.clearSyntheticResolvedLinks();
      }
      // 返回当前已注入的关系图谱统计信息，供设置页展示。
      getStats() {
        return Object.assign({}, this.stats);
      }
      // 返回关系图谱增强的运行时状态，供设置页展示启用、降级与兼容性信息。
      getRuntimeStatus() {
        if (!this.isFeatureEnabled()) {
          return {
            state: "disabled",
            message: "关系图谱 HTML 链接增强已在设置中关闭。"
          };
        }
        if (this.isCompatibleRuntime) {
          return {
            state: "active",
            message: `关系图谱 HTML 链接增强已启用，兼容目标为 Obsidian ${MIN_GRAPH_COMPATIBLE_API_VERSION}+。`
          };
        }
        if (this.lastCompatibilityMessage) {
          return {
            state: "degraded",
            message: this.lastCompatibilityMessage
          };
        }
        return {
          state: "idle",
          message: "关系图谱 HTML 链接增强等待初始化。"
        };
      }
      // 返回默认的结构变化全量刷新延时，统一由主入口复用。
      getStructureRefreshDelay() {
        return STRUCTURE_FULL_REFRESH_DELAY;
      }
      // 计划一次全量刷新，在文件结构变化时重新解析全部 HTML 内部链接。
      scheduleFullRefresh(delay, showNotice) {
        if (!this.ensureCompatibleRuntime(showNotice)) return;
        if (showNotice) {
          this.pendingNotice = true;
        }
        if (this.refreshTimer) {
          window.clearTimeout(this.refreshTimer);
        }
        this.refreshTimer = window.setTimeout(async () => {
          this.refreshTimer = null;
          await this.refreshAll(this.pendingNotice);
        }, typeof delay === "number" ? delay : 400);
      }
      // 在编辑器输入过程中按源文件做防抖刷新，减少“必须保存后才生效”的感知延迟。
      scheduleSourceRefresh(file, content, delay) {
        if (!this.ensureCompatibleRuntime(false)) return;
        if (!(file instanceof obsidian2.TFile) || file.extension !== "md") return;
        this.pendingSourceRefresh = {
          file,
          content
        };
        if (this.sourceRefreshTimer) {
          window.clearTimeout(this.sourceRefreshTimer);
        }
        this.sourceRefreshTimer = window.setTimeout(async () => {
          const pendingRefresh = this.pendingSourceRefresh;
          this.pendingSourceRefresh = null;
          this.sourceRefreshTimer = null;
          if (!pendingRefresh) return;
          await this.refreshSourceFile(pendingRefresh.file, pendingRefresh.content);
        }, typeof delay === "number" ? delay : 240);
      }
      // 手动或启动时执行全量刷新，重建全部 a.internal-link 的关系边。
      async refreshAll(showNotice) {
        if (!this.ensureCompatibleRuntime(showNotice)) return;
        if (showNotice) {
          this.pendingNotice = true;
        }
        if (this.isRefreshing) {
          this.pendingFullRefresh = true;
          return;
        }
        this.isRefreshing = true;
        const shouldShowNotice = this.pendingNotice;
        this.pendingNotice = false;
        try {
          const markdownFiles = this.plugin.app.vault.getMarkdownFiles();
          const nextSyntheticResolvedLinks = await this.buildResolvedLinksSnapshot(markdownFiles);
          this.commitSyntheticResolvedLinks(nextSyntheticResolvedLinks);
          if (shouldShowNotice) {
            new obsidian2.Notice(`关系图谱 HTML 链接已刷新，共注入 ${this.stats.edgeCount} 条关系边`);
          }
        } catch (error) {
          console.error("刷新关系图谱 HTML 链接失败", error);
          if (shouldShowNotice) {
            new obsidian2.Notice("关系图谱 HTML 链接刷新失败，请查看控制台");
          }
        } finally {
          this.isRefreshing = false;
          if (this.pendingFullRefresh) {
            this.pendingFullRefresh = false;
            this.scheduleFullRefresh(0, this.pendingNotice);
          }
        }
      }
      // 在单个 Markdown 文件重新索引后，仅刷新当前源文件对应的合成关系边。
      async refreshSourceFile(file, content) {
        if (!this.ensureCompatibleRuntime(false)) return;
        if (!(file instanceof obsidian2.TFile) || file.extension !== "md") return;
        if (this.isRefreshing) {
          this.pendingFullRefresh = true;
          return;
        }
        this.isRefreshing = true;
        try {
          const resolvedCounts = this.buildResolvedCountsFromContent(content, file.path);
          this.replaceSyntheticResolvedLinksForSource(file.path, resolvedCounts);
        } catch (error) {
          console.error(`刷新文件 ${file.path} 的关系图谱 HTML 链接失败`, error);
        } finally {
          this.isRefreshing = false;
          if (this.pendingFullRefresh) {
            this.pendingFullRefresh = false;
            this.scheduleFullRefresh(0, this.pendingNotice);
          }
        }
      }
      // 从磁盘缓存中读取指定文件内容，再走单文件刷新流程，避免结构变化后立刻全库扫描。
      async refreshSourceFileFromVault(file) {
        if (!this.ensureCompatibleRuntime(false)) return;
        if (!(file instanceof obsidian2.TFile) || file.extension !== "md") return;
        try {
          const content = await this.plugin.app.vault.cachedRead(file);
          await this.refreshSourceFile(file, content);
        } catch (error) {
          console.error(`读取文件 ${file.path} 以刷新关系图谱 HTML 链接失败`, error);
        }
      }
      // 在文件重命名后先迁移当前源文件的合成关系边，再按需安排后台全量刷新。
      async handleSourceFileRename(file, oldPath) {
        if (!this.ensureCompatibleRuntime(false)) return;
        if (typeof oldPath === "string" && oldPath && oldPath !== file.path) {
          this.replaceSyntheticResolvedLinksForSource(oldPath, null);
        }
        await this.refreshSourceFileFromVault(file);
      }
      // 在文件删除后先移除对应源文件的合成关系边，降低后续全量重建前的错误残留。
      removeSourceFileLinks(filePath) {
        if (!this.ensureCompatibleRuntime(false)) return false;
        if (typeof filePath !== "string" || !filePath) return false;
        if (!this.syntheticResolvedLinks[filePath]) {
          return false;
        }
        this.replaceSyntheticResolvedLinksForSource(filePath, null);
        return true;
      }
      // 基于文件内容提取并解析 a.internal-link，返回当前源文件的目标计数字典。
      buildResolvedCountsFromContent(content, sourcePath) {
        const targets = this.extractInternalAnchorTargets(content);
        const resolvedCounts = {};
        targets.forEach((target) => {
          const resolvedPath = this.resolveTargetPath(target, sourcePath);
          if (!resolvedPath) return;
          resolvedCounts[resolvedPath] = (resolvedCounts[resolvedPath] || 0) + 1;
        });
        return resolvedCounts;
      }
      // 提取文本中的 HTML 内部链接，优先使用 data-href，其次回退到 href。
      extractInternalAnchorTargets(content) {
        if (typeof content !== "string" || !content.includes("<a")) return [];
        const anchorTags = this.extractAnchorStartTags(content);
        const targets = [];
        anchorTags.forEach((tagText) => {
          const className = this.readAttribute(tagText, "class");
          if (!className || !/(^|\s)internal-link(\s|$)/.test(className)) return;
          const rawTarget = this.readAttribute(tagText, "data-href") || this.readAttribute(tagText, "href");
          const normalizedTarget = this.normalizeTarget(rawTarget);
          if (!normalizedTarget) return;
          targets.push(normalizedTarget);
        });
        return targets;
      }
      // 逐字符提取 a 起始标签，避免属性值中的 >、< 或换行导致正则提前截断。
      extractAnchorStartTags(content) {
        const anchorTags = [];
        let searchIndex = 0;
        while (searchIndex < content.length) {
          const tagStart = content.indexOf("<", searchIndex);
          if (tagStart === -1) break;
          const tagNameFirstChar = content[tagStart + 1];
          if (!tagNameFirstChar || tagNameFirstChar.toLowerCase() !== "a") {
            searchIndex = tagStart + 1;
            continue;
          }
          const tagNameBoundaryChar = content[tagStart + 2];
          if (tagNameBoundaryChar && /[a-z0-9:_-]/i.test(tagNameBoundaryChar)) {
            searchIndex = tagStart + 1;
            continue;
          }
          let quoteChar = "";
          let tagEnd = -1;
          for (let index = tagStart + 2; index < content.length; index += 1) {
            const currentChar = content[index];
            if (quoteChar) {
              if (currentChar === quoteChar) {
                quoteChar = "";
              }
              continue;
            }
            if (currentChar === '"' || currentChar === "'") {
              quoteChar = currentChar;
              continue;
            }
            if (currentChar === ">") {
              tagEnd = index;
              break;
            }
          }
          if (tagEnd === -1) break;
          anchorTags.push(content.slice(tagStart, tagEnd + 1));
          searchIndex = tagEnd + 1;
        }
        return anchorTags;
      }
      // 从单个 HTML 标签字符串中读取指定属性值。
      readAttribute(tagText, attributeName) {
        const escapedName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const attributeMatch = tagText.match(
          new RegExp(`(?:^|[\\s<])${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\\x60]+))`, "i")
        );
        if (!attributeMatch) return "";
        return attributeMatch[1] || attributeMatch[2] || attributeMatch[3] || "";
      }
      // 规范化目标链接，过滤外链、空值和仅锚点链接。
      normalizeTarget(rawTarget) {
        if (typeof rawTarget !== "string") return "";
        let normalizedTarget = this.decodeHtmlEntities(rawTarget).trim();
        if (!normalizedTarget) return "";
        try {
          normalizedTarget = decodeURIComponent(normalizedTarget);
        } catch (error) {
        }
        if (normalizedTarget.startsWith("#")) return "";
        if (/^[a-z][a-z0-9+.-]*:/i.test(normalizedTarget)) return "";
        return normalizedTarget;
      }
      // 解码常见 HTML 实体，保证 data-href 中的字符能被正确解析。
      decodeHtmlEntities(value) {
        const namedEntities = {
          amp: "&",
          quot: '"',
          apos: "'",
          lt: "<",
          gt: ">",
          nbsp: " "
        };
        return value.replace(/&#x([0-9a-f]+);?/gi, (match, hexCode) => this.decodeHtmlCodePoint(parseInt(hexCode, 16), match)).replace(/&#([0-9]+);?/g, (match, decimalCode) => this.decodeHtmlCodePoint(parseInt(decimalCode, 10), match)).replace(/&([a-z]+);/gi, (match, entityName) => {
          const normalizedName = entityName.toLowerCase();
          return Object.prototype.hasOwnProperty.call(namedEntities, normalizedName) ? namedEntities[normalizedName] : match;
        }).replace(/&#39;/gi, "'");
      }
      // 仅在码点合法时解码数字实体，避免异常值污染链接文本。
      decodeHtmlCodePoint(codePoint, fallbackValue) {
        if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 1114111) {
          return fallbackValue;
        }
        try {
          return String.fromCodePoint(codePoint);
        } catch (error) {
          return fallbackValue;
        }
      }
      // 将链接目标解析为真实文件路径，供关系图谱的 resolvedLinks 使用。
      resolveTargetPath(target, sourcePath) {
        const linkPath = target.split("#")[0].trim();
        if (!linkPath) return "";
        const destination = this.plugin.app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath);
        if (!(destination instanceof obsidian2.TFile)) return "";
        return destination.path;
      }
      // 用新的全量结果替换旧的合成关系边，并同步更新统计信息。
      commitSyntheticResolvedLinks(nextSyntheticResolvedLinks) {
        if (!this.ensureCompatibleRuntime(false)) return;
        this.removeResolvedLinkCounts(this.syntheticResolvedLinks);
        this.addResolvedLinkCounts(nextSyntheticResolvedLinks);
        this.syntheticResolvedLinks = nextSyntheticResolvedLinks;
        this.recalculateStats();
        this.notifyResolvedLinksUpdated();
      }
      // 仅替换单个源文件对应的合成关系边，避免单文件编辑时全量重建。
      replaceSyntheticResolvedLinksForSource(sourcePath, nextResolvedCounts) {
        if (!this.ensureCompatibleRuntime(false)) return;
        const previousResolvedCounts = this.syntheticResolvedLinks[sourcePath];
        if (previousResolvedCounts) {
          this.removeResolvedLinkCounts({
            [sourcePath]: previousResolvedCounts
          });
        }
        if (nextResolvedCounts && Object.keys(nextResolvedCounts).length > 0) {
          this.addResolvedLinkCounts({
            [sourcePath]: nextResolvedCounts
          });
          this.syntheticResolvedLinks[sourcePath] = nextResolvedCounts;
        } else {
          delete this.syntheticResolvedLinks[sourcePath];
        }
        this.recalculateStats();
        this.notifyResolvedLinksUpdated();
      }
      // 从 metadataCache.resolvedLinks 中移除当前插件此前注入的关系边。
      clearSyntheticResolvedLinks() {
        if (!this.hasResolvedLinksStore()) {
          this.syntheticResolvedLinks = {};
          this.recalculateStats();
          return;
        }
        this.removeResolvedLinkCounts(this.syntheticResolvedLinks);
        this.syntheticResolvedLinks = {};
        this.recalculateStats();
        this.notifyResolvedLinksUpdated();
      }
      // 将一批合成关系边累加到 Obsidian 原生 resolvedLinks 中。
      addResolvedLinkCounts(resolvedLinkMap) {
        const resolvedLinks = this.getResolvedLinksStore();
        if (!resolvedLinks) return;
        Object.entries(resolvedLinkMap).forEach(([sourcePath, destinations]) => {
          if (!resolvedLinks[sourcePath]) {
            resolvedLinks[sourcePath] = {};
          }
          Object.entries(destinations).forEach(([destinationPath, count]) => {
            resolvedLinks[sourcePath][destinationPath] = (resolvedLinks[sourcePath][destinationPath] || 0) + count;
          });
        });
      }
      // 从 Obsidian 原生 resolvedLinks 中扣除插件注入的计数，保留其他来源的原始链接。
      removeResolvedLinkCounts(resolvedLinkMap) {
        const resolvedLinks = this.getResolvedLinksStore();
        if (!resolvedLinks) return;
        Object.entries(resolvedLinkMap).forEach(([sourcePath, destinations]) => {
          if (!resolvedLinks[sourcePath]) return;
          Object.entries(destinations).forEach(([destinationPath, count]) => {
            const currentCount = resolvedLinks[sourcePath][destinationPath];
            if (typeof currentCount !== "number") return;
            const nextCount = currentCount - count;
            if (nextCount > 0) {
              resolvedLinks[sourcePath][destinationPath] = nextCount;
            } else {
              delete resolvedLinks[sourcePath][destinationPath];
            }
          });
          if (Object.keys(resolvedLinks[sourcePath]).length === 0) {
            delete resolvedLinks[sourcePath];
          }
        });
      }
      // 返回 Obsidian 的 resolvedLinks 存储对象，必要时按需初始化。
      getResolvedLinksStore() {
        if (!this.hasResolvedLinksStore()) {
          return null;
        }
        return this.plugin.app.metadataCache.resolvedLinks;
      }
      // 重新统计当前已注入的源文件数量与关系边数量。
      recalculateStats() {
        const sourceFileCount = Object.keys(this.syntheticResolvedLinks).length;
        const edgeCount = Object.values(this.syntheticResolvedLinks).reduce((total, destinations) => {
          return total + Object.values(destinations).reduce((subTotal, count) => subTotal + count, 0);
        }, 0);
        this.stats = {
          sourceFileCount,
          edgeCount
        };
      }
      // 主动通知 Obsidian 链接索引已更新，便于图谱等依赖 resolvedLinks 的视图重绘。
      notifyResolvedLinksUpdated() {
        if (typeof this.plugin.app.metadataCache.trigger === "function") {
          this.plugin.app.metadataCache.trigger("resolved");
        }
        this.processGraphRefreshButtons();
      }
      // 返回当前所有已打开的全局图谱与局部图谱叶子，便于统一补按钮与尝试重绘。
      getOpenGraphLeaves() {
        const graphViewTypes = ["graph", "localgraph"];
        const leaves = [];
        graphViewTypes.forEach((viewType) => {
          this.plugin.app.workspace.getLeavesOfType(viewType).forEach((leaf) => {
            leaves.push(leaf);
          });
        });
        return leaves;
      }
      // 监听文档中的视图切换与图谱 DOM 挂载，按需在图谱中补充刷新按钮。
      setupGraphRefreshButtonObserver() {
        let shouldProcess = false;
        this.graphButtonObserver = new MutationObserver((mutations) => {
          shouldProcess = mutations.some((mutation) => {
            if (mutation.type !== "childList") return false;
            return Array.from(mutation.addedNodes).some((node) => {
              return node instanceof HTMLElement;
            });
          });
          if (!shouldProcess) return;
          if (this.graphButtonProcessTimer) {
            window.clearTimeout(this.graphButtonProcessTimer);
          }
          this.graphButtonProcessTimer = window.setTimeout(() => {
            this.graphButtonProcessTimer = null;
            this.processGraphRefreshButtons();
          }, 100);
        });
        this.graphButtonObserver.observe(document.body, {
          childList: true,
          subtree: true
        });
      }
      // 为已打开的关系图谱补充刷新按钮，避免用户必须回到设置页手动刷新。
      processGraphRefreshButtons() {
        if (!this.isFeatureEnabled()) return;
        this.getOpenGraphLeaves().forEach((leaf) => {
          this.ensureGraphRefreshButton(leaf);
        });
      }
      // 在单个关系图谱视图中挂载按钮，复用 Obsidian 图标按钮样式以保持界面一致。
      ensureGraphRefreshButton(leaf) {
        const view = leaf && leaf.view;
        if (!view) return;
        const hostEl = view.contentEl instanceof HTMLElement ? view.contentEl : view.containerEl instanceof HTMLElement ? view.containerEl : null;
        if (!hostEl) return;
        hostEl.classList.add("nene-graph-refresh-host");
        if (hostEl.querySelector(".nene-graph-refresh-button")) return;
        const buttonEl = hostEl.createEl("button", {
          cls: "clickable-icon nene-graph-refresh-button"
        });
        buttonEl.setAttribute("type", "button");
        buttonEl.setAttribute("id", "refresh-html");
        buttonEl.setAttribute("aria-label", "刷新链接");
        buttonEl.setAttribute("title", "刷新链接");
        obsidian2.setIcon(buttonEl, "refresh-cw");
        buttonEl.addEventListener("click", async (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (buttonEl.disabled) return;
          buttonEl.disabled = true;
          buttonEl.classList.add("is-disabled");
          try {
            await this.refreshAll(true);
          } finally {
            buttonEl.disabled = false;
            buttonEl.classList.remove("is-disabled");
          }
        });
      }
      // 清理图谱中动态注入的刷新按钮和宿主样式类，避免插件卸载后残留节点。
      removeGraphRefreshButtons() {
        document.querySelectorAll(".nene-graph-refresh-button").forEach((buttonEl) => {
          buttonEl.remove();
        });
        document.querySelectorAll(".nene-graph-refresh-host").forEach((hostEl) => {
          hostEl.classList.remove("nene-graph-refresh-host");
        });
      }
      // 注入少量样式，让刷新按钮固定显示在图谱视图右上角且兼容桌面端与移动端。
      addGraphRefreshButtonStyles() {
        if (this.styleEl) return;
        this.styleEl = document.createElement("style");
        this.styleEl.id = "obsidian-nene-plugin-graph-refresh-styles";
        this.styleEl.textContent = `
      .nene-graph-refresh-host {
        position: relative;
      }

      .nene-graph-refresh-button {
        position: absolute;
        top: 10px;
        right: 48px;
        z-index: 10;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--background-secondary);
        border: 1px solid var(--background-modifier-border);
        border-radius: var(--radius-s);
      }

      .nene-graph-refresh-button.is-disabled {
        opacity: 0.65;
        pointer-events: none;
      }

      body.is-mobile .nene-graph-refresh-button {
        top: 8px;
        right: 44px;
      }
    `;
        document.head.appendChild(this.styleEl);
      }
      // 检查当前运行环境是否满足图谱增强的最低要求，不满足时直接降级为关闭状态。
      ensureCompatibleRuntime(showNotice) {
        if (!this.isFeatureEnabled()) {
          this.isCompatibleRuntime = false;
          return false;
        }
        if (!obsidian2.requireApiVersion(MIN_GRAPH_COMPATIBLE_API_VERSION)) {
          this.isCompatibleRuntime = false;
          this.warnCompatibility(
            `关系图谱 HTML 链接增强仅在 Obsidian ${MIN_GRAPH_COMPATIBLE_API_VERSION}+ 上启用，当前版本将自动跳过。`,
            showNotice
          );
          return false;
        }
        if (!this.hasResolvedLinksStore()) {
          this.isCompatibleRuntime = false;
          this.warnCompatibility(
            "当前 Obsidian 运行环境未暴露可写的关系图谱链接索引，已跳过 HTML 链接增强。",
            showNotice
          );
          return false;
        }
        this.isCompatibleRuntime = true;
        this.lastCompatibilityMessage = "";
        return true;
      }
      // 返回关系图谱增强是否被用户在设置中启用。
      isFeatureEnabled() {
        if (typeof this.plugin.isAnchorGraphEnabled === "function") {
          return this.plugin.isAnchorGraphEnabled();
        }
        return this.plugin.settings?.features?.anchorGraph?.enabled !== false;
      }
      // 判断当前是否存在可安全写入的 resolvedLinks 存储。
      hasResolvedLinksStore() {
        const metadataCache = this.plugin.app && this.plugin.app.metadataCache;
        if (!metadataCache) return false;
        const resolvedLinks = metadataCache.resolvedLinks;
        return Boolean(
          resolvedLinks && typeof resolvedLinks === "object" && !Array.isArray(resolvedLinks) && typeof metadataCache.getFirstLinkpathDest === "function"
        );
      }
      // 在不兼容环境下给出一次性提示，避免用户误以为功能静默损坏。
      warnCompatibility(message, showNotice) {
        this.lastCompatibilityMessage = message;
        if (this.compatibilityWarningShown) return;
        this.compatibilityWarningShown = true;
        console.warn(message);
        if (!showNotice) return;
        new obsidian2.Notice(message, 6e3);
      }
      // 分批读取全库 Markdown，避免长时间占用主线程导致界面卡顿。
      async buildResolvedLinksSnapshot(markdownFiles) {
        const nextSyntheticResolvedLinks = {};
        for (let index = 0; index < markdownFiles.length; index += 1) {
          const file = markdownFiles[index];
          const content = await this.plugin.app.vault.cachedRead(file);
          const resolvedCounts = this.buildResolvedCountsFromContent(content, file.path);
          if (Object.keys(resolvedCounts).length > 0) {
            nextSyntheticResolvedLinks[file.path] = resolvedCounts;
          }
          if ((index + 1) % FULL_REFRESH_BATCH_SIZE === 0) {
            await this.yieldToMainThread();
          }
        }
        return nextSyntheticResolvedLinks;
      }
      // 在大库扫描过程中主动让出一次事件循环，降低启动和结构变更时的阻塞感。
      async yieldToMainThread() {
        await new Promise((resolve) => {
          window.setTimeout(resolve, 0);
        });
      }
    };
    module2.exports = {
      AnchorGraphLinkEnhancer
    };
  }
});

// src/modules/copy-path/service.js
var require_service = __commonJS({
  "src/modules/copy-path/service.js"(exports2, module2) {
    "use strict";
    var obsidian2 = require("obsidian");
    async function copyTextToClipboard(text) {
      if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(text);
        return;
      }
      const textareaEl = document.createElement("textarea");
      textareaEl.value = text;
      textareaEl.style.position = "fixed";
      textareaEl.style.opacity = "0";
      document.body.appendChild(textareaEl);
      textareaEl.focus();
      textareaEl.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textareaEl);
      if (!copied) {
        throw new Error("Clipboard copy is not supported");
      }
    }
    var CopyPathService = class {
      constructor(plugin) {
        this.plugin = plugin;
      }
      // 复制当前目标的库内路径。
      async copyVaultPathFromCommand() {
        await this.copyTargetPath("vault");
      }
      // 复制当前目标的绝对路径。
      async copyFullPathFromCommand() {
        await this.copyTargetPath("full");
      }
      // 复制当前目标的 URI 链接，标题仅保留最后一段名称。
      async copyUriLinkFromCommand() {
        await this.copyTargetPath("uriLink");
      }
      // 根据命令类型解析目标并完成复制。
      async copyTargetPath(pathType) {
        if (!this.plugin.isCopyPathEnabled()) {
          this.plugin.copyPathStore.clearRecentMenuTarget();
          new obsidian2.Notice("复制路径模块当前已关闭，请先在设置页中启用。");
          return;
        }
        const target = this.resolveCommandTarget();
        if (!target) {
          this.plugin.copyPathStore.clearRecentMenuTarget();
          new obsidian2.Notice("未找到可复制的目标，请先聚焦笔记，或从文件/文件夹右键菜单中触发该命令。");
          return;
        }
        try {
          const targetPath = this.buildTargetPath(target, pathType);
          await copyTextToClipboard(targetPath);
          new obsidian2.Notice(
            `${this.getSuccessLabel(pathType)}：
${targetPath}`,
            2e3
          );
        } catch (error) {
          console.error("[ねね] 复制路径失败", error);
          new obsidian2.Notice(`复制失败：${error.message || "请检查当前平台是否支持该操作"}`);
        } finally {
          this.plugin.copyPathStore.clearRecentMenuTarget();
        }
      }
      // 优先使用最近一次文件右键菜单目标，其次回退到当前活动笔记。
      resolveCommandTarget() {
        const menuTarget = this.plugin.copyPathStore.getRecentMenuTarget();
        if (menuTarget instanceof obsidian2.TFile || menuTarget instanceof obsidian2.TFolder) {
          return menuTarget;
        }
        const activeFile = this.plugin.app.workspace.getActiveFile();
        if (activeFile instanceof obsidian2.TFile) {
          return activeFile;
        }
        return null;
      }
      // 生成最终需要复制的路径文本。
      buildTargetPath(target, pathType) {
        const shouldAppendTrailingSlash = pathType !== "uriLink" && target instanceof obsidian2.TFolder && this.plugin.copyPathStore.getSettings().addTrailingSlashToFolders === true;
        if (pathType === "full") {
          return this.getAbsolutePath(target, shouldAppendTrailingSlash);
        }
        if (pathType === "uriLink") {
          const absolutePath = this.getAbsolutePath(target, false);
          return this.buildUriMarkdownLink(absolutePath);
        }
        let vaultPath = target.path;
        if (shouldAppendTrailingSlash) {
          vaultPath += "/";
        }
        return vaultPath;
      }
      // 返回复制成功后的提示标题。
      getSuccessLabel(pathType) {
        if (pathType === "full") {
          return "已复制完整路径";
        }
        if (pathType === "uriLink") {
          return "已复制 URI 链接";
        }
        return "已复制库内路径";
      }
      // 读取当前目标的完整路径，并按需为文件夹追加末尾斜杠。
      getAbsolutePath(target, shouldAppendTrailingSlash) {
        const adapter = this.plugin.app.vault.adapter;
        if (typeof adapter.getFullRealPath !== "function") {
          throw new Error("当前平台不支持读取完整路径");
        }
        let absolutePath = adapter.getFullRealPath(target.path);
        if (shouldAppendTrailingSlash) {
          absolutePath += "/";
        }
        return absolutePath;
      }
      // 将完整路径转换为 Markdown URI 链接，标题仅保留路径最后一段名称。
      buildUriMarkdownLink(absolutePath) {
        const normalizedPath = this.normalizePathForUri(absolutePath);
        const displayName = this.getPathDisplayName(normalizedPath);
        const uri = `file:///"${normalizedPath}"`;
        if (normalizedPath.includes(" ")) {
          return `[${displayName}](<${uri}>)`;
        }
        return `[${displayName}](${uri})`;
      }
      // 将路径统一改写为正斜杠，并移除首尾空白与包裹引号。
      normalizePathForUri(filePath) {
        if (typeof filePath !== "string") {
          return "";
        }
        let normalizedPath = filePath.trim().replace(/\\/g, "/");
        if (normalizedPath.startsWith('"')) {
          normalizedPath = normalizedPath.slice(1);
        }
        if (normalizedPath.endsWith('"')) {
          normalizedPath = normalizedPath.slice(0, -1);
        }
        return normalizedPath;
      }
      // 取路径最后一段作为链接标题，并兼容尾部斜杠场景。
      getPathDisplayName(normalizedPath) {
        const trimmedPath = normalizedPath.endsWith("/") ? normalizedPath.slice(0, -1) : normalizedPath;
        const segments = trimmedPath.split("/").filter(Boolean);
        return segments[segments.length - 1] || trimmedPath || "未命名目标";
      }
    };
    module2.exports = {
      CopyPathService
    };
  }
});

// src/modules/copy-path/store.js
var require_store4 = __commonJS({
  "src/modules/copy-path/store.js"(exports2, module2) {
    "use strict";
    var constants = require_constants3();
    var CopyPathStore = class {
      constructor(plugin) {
        this.plugin = plugin;
        this.settings = this.normalizeSettings();
        this.lastMenuTarget = null;
        this.lastMenuTargetAt = 0;
      }
      // 挂载从独立配置文件读出的设置切片。
      load(settings) {
        this.settings = this.normalizeSettings(settings);
      }
      // 持久化当前复制路径配置到独立 JSON 文件。
      async save() {
        this.settings = this.normalizeSettings(this.settings);
        this.plugin.dataStore.setCopyPathData(this.settings);
        await this.plugin.dataStore.saveCopyPathData(this.settings);
      }
      // 返回当前完整配置。
      getSettings() {
        return this.settings;
      }
      // 更新“文件夹路径末尾补 /”开关，并立即持久化。
      async setAddTrailingSlashToFolders(enabled) {
        this.settings.addTrailingSlashToFolders = Boolean(enabled);
        await this.save();
        return this.settings.addTrailingSlashToFolders;
      }
      // 记录最近一次文件或文件夹右键菜单的目标对象。
      rememberMenuTarget(file) {
        this.lastMenuTarget = file || null;
        this.lastMenuTargetAt = Date.now();
      }
      // 返回仍处于有效期内的右键菜单目标，过期后自动清空。
      getRecentMenuTarget() {
        if (!this.lastMenuTarget) {
          return null;
        }
        if (Date.now() - this.lastMenuTargetAt > constants.MENU_TARGET_MAX_AGE) {
          this.clearRecentMenuTarget();
          return null;
        }
        return this.lastMenuTarget;
      }
      // 主动清空最近一次菜单目标，避免后续无关命令误用。
      clearRecentMenuTarget() {
        this.lastMenuTarget = null;
        this.lastMenuTargetAt = 0;
      }
      // 归一化复制路径模块的配置结构。
      normalizeSettings(settings) {
        const source = settings || constants.DEFAULT_COPY_PATH_SETTINGS;
        return {
          addTrailingSlashToFolders: source.addTrailingSlashToFolders !== false
        };
      }
    };
    module2.exports = {
      CopyPathStore
    };
  }
});

// src/modules/copy-path/view.js
var require_view2 = __commonJS({
  "src/modules/copy-path/view.js"(exports2, module2) {
    "use strict";
    var obsidian2 = require("obsidian");
    function renderModalHeader(containerEl, title, description) {
      const headerEl = containerEl.createDiv({ cls: "nene-settings-modal-header" });
      headerEl.createDiv({ cls: "nene-settings-modal-title", text: title });
      if (description) {
        headerEl.createEl("p", {
          cls: "nene-settings-modal-description",
          text: description
        });
      }
    }
    function renderDetailItem(containerEl, label, value, codeStyle) {
      const itemEl = containerEl.createDiv({ cls: "nene-settings-detail-item" });
      itemEl.createDiv({ cls: "nene-settings-detail-label", text: label });
      itemEl.createEl(codeStyle ? "code" : "div", {
        cls: "nene-settings-detail-value",
        text: value
      });
    }
    var CopyPathManagementModal = class extends obsidian2.Modal {
      constructor(app, plugin, onSettingsChanged) {
        super(app);
        this.plugin = plugin;
        this.onSettingsChanged = onSettingsChanged;
      }
      // 打开弹窗时渲染复制路径模块详情与配置项。
      onOpen() {
        this.modalEl.addClass("mod-sidebar-layout", "nene-settings-panel-modal");
        this.contentEl.empty();
        this.contentEl.addClass("nene-settings-modal");
        void this.render();
      }
      // 根据当前最新状态渲染复制路径模块管理界面。
      async render() {
        const { contentEl } = this;
        const summary = this.plugin.getSettingsSummary();
        const configSummary = await this.plugin.getConfigManagementSummary();
        contentEl.empty();
        renderModalHeader(
          contentEl,
          "复制路径模块",
          "该模块只注册命令，不会直接向文件或文件夹右键菜单注入入口。若需要出现在右键菜单中，请在“右键菜单自定义”模块中手动添加这些命令。"
        );
        const detailListEl = contentEl.createDiv({ cls: "nene-settings-detail-list" });
        renderDetailItem(detailListEl, "当前状态", summary.copyPathEnabled ? "已启用" : "已关闭");
        renderDetailItem(
          detailListEl,
          "文件夹末尾补 /",
          summary.copyPathTrailingSlashEnabled ? "已开启" : "已关闭"
        );
        renderDetailItem(detailListEl, "配置文件", configSummary.copyPath.path, true);
        new obsidian2.Setting(contentEl).setName("文件夹路径末尾补 /").setDesc("开启后，复制文件夹路径时会自动在末尾追加 /，便于与文件路径区分。").addToggle((toggle) => {
          toggle.setValue(summary.copyPathTrailingSlashEnabled).onChange(async (value) => {
            await this.plugin.updateCopyPathTrailingSlashEnabled(value);
            new obsidian2.Notice(value ? "已开启文件夹路径末尾补 /" : "已关闭文件夹路径末尾补 /");
            await this.onSettingsChanged();
            await this.render();
          });
        });
        const hintEl = contentEl.createDiv({ cls: "nene-settings-hint" });
        hintEl.createDiv({ cls: "nene-settings-hint-title", text: "已注册命令" });
        const listEl = hintEl.createEl("ul");
        listEl.createEl("li", { text: "复制当前目标的库内路径" });
        listEl.createEl("li", { text: "复制当前目标的完整路径" });
        listEl.createEl("li", { text: "复制当前目标的URI链接" });
      }
      // 关闭弹窗时清理内容，避免重复挂载旧节点。
      onClose() {
        this.contentEl.empty();
      }
    };
    module2.exports = {
      CopyPathManagementModal
    };
  }
});

// src/modules/copy-path/index.js
var require_copy_path = __commonJS({
  "src/modules/copy-path/index.js"(exports2, module2) {
    "use strict";
    var constants = require_constants3();
    var service = require_service();
    var store = require_store4();
    var view = require_view2();
    module2.exports = Object.assign({}, constants, service, store, view);
  }
});

// src/modules/status-bar-enhancer/runtime.js
var require_runtime = __commonJS({
  "src/modules/status-bar-enhancer/runtime.js"(exports2, module2) {
    "use strict";
    var obsidian2 = require("obsidian");
    async function copyTextToClipboard(text) {
      if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(text);
        return;
      }
      const textareaEl = document.createElement("textarea");
      textareaEl.value = text;
      textareaEl.style.position = "fixed";
      textareaEl.style.opacity = "0";
      document.body.appendChild(textareaEl);
      textareaEl.focus();
      textareaEl.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textareaEl);
      if (!copied) {
        throw new Error("Clipboard copy is not supported");
      }
    }
    var StatusBarEnhancerRuntime = class {
      constructor(plugin) {
        this.plugin = plugin;
        this.settings = null;
        this.statusBarEl = null;
        this.lastModifiedTimestampEl = null;
        this.createdTimestampEl = null;
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
          this.statusBarEl.addClass("mod-clickable");
          this.statusBarEl.addClass("nene-status-bar-enhancer");
          this.statusBarEl.addEventListener("click", () => {
            void this.copyActivePath();
          });
        }
        if (!this.lastModifiedTimestampEl) {
          this.lastModifiedTimestampEl = this.plugin.addStatusBarItem();
          this.lastModifiedTimestampEl.addClass("nene-status-bar-timestamp");
          this.lastModifiedTimestampEl.addEventListener("click", () => {
            void this.cycleTimestampDisplay();
          });
        }
        if (!this.createdTimestampEl) {
          this.createdTimestampEl = this.plugin.addStatusBarItem();
          this.createdTimestampEl.addClass("nene-status-bar-timestamp");
          this.createdTimestampEl.addEventListener("click", () => {
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
        if (!(file instanceof obsidian2.TFile)) {
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
        if (!(file instanceof obsidian2.TFile) || !this.getLastModifiedEnabled()) {
          this.lastModifiedTimestampEl.hide();
          return;
        }
        const timestampText = obsidian2.moment(file.stat.mtime).format(this.getLastModifiedTimestampFormat());
        this.lastModifiedTimestampEl.setText(`${this.getLastModifiedPrepend()}${timestampText}`);
        this.lastModifiedTimestampEl.show();
      }
      // 刷新创建时间状态栏项，模块未启用或无活动文件时隐藏。
      renderCreatedTimestamp(file) {
        if (!this.createdTimestampEl) {
          return;
        }
        if (!(file instanceof obsidian2.TFile) || !this.getCreatedEnabled()) {
          this.createdTimestampEl.hide();
          return;
        }
        const timestampText = obsidian2.moment(file.stat.ctime).format(this.getCreatedTimestampFormat());
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
          console.error("[ねね] 状态栏增强切换时间戳显示失败", error);
          new obsidian2.Notice("切换时间戳显示失败，请查看控制台日志");
        }
      }
      // 复制当前活动文件路径，供状态栏点击与命令复用。
      async copyActivePath() {
        if (!this.plugin.isStatusBarEnhancerEnabled()) {
          new obsidian2.Notice("状态栏增强当前已关闭，请先在设置页中启用。");
          return;
        }
        const activeFile = this.plugin.app.workspace.getActiveFile();
        if (!(activeFile instanceof obsidian2.TFile)) {
          new obsidian2.Notice("当前没有可复制路径的活动文件");
          return;
        }
        const textToCopy = this.getCopyTargetPath(activeFile);
        try {
          await copyTextToClipboard(textToCopy);
          new obsidian2.Notice("路径已复制到剪贴板");
        } catch (error) {
          console.error("[ねね] 状态栏增强复制路径失败", error);
          new obsidian2.Notice(`复制失败：${error.message || "请检查当前平台是否支持该操作"}`);
        }
      }
      // 返回状态栏当前应显示的路径文本。
      getDisplayPath(file) {
        if (this.getShowFileName()) {
          return file.path;
        }
        return file.parent?.path || "/";
      }
      // 返回当前要复制的路径文本。
      getCopyTargetPath(file) {
        const relativePath = this.getDisplayPath(file);
        if (!this.getCopyAbsolutePath()) {
          return relativePath;
        }
        const adapter = this.plugin.app.vault.adapter;
        if (typeof adapter.getFullRealPath === "function") {
          return adapter.getFullRealPath(relativePath === "/" ? "" : relativePath);
        }
        if (typeof adapter.basePath === "string" && adapter.basePath) {
          return relativePath === "/" ? adapter.basePath : `${adapter.basePath}/${relativePath}`.replace(/\\/g, "/");
        }
        throw new Error("当前平台不支持读取完整路径");
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
        if (part.type === "folder") {
          if (includeIcon) {
            fragment.append("📁 ");
          }
          fragment.append(part.name);
          return fragment;
        }
        if (part.type === "file") {
          if (includeIcon) {
            fragment.append("📄 ");
          }
          fragment.append(part.name);
          return fragment;
        }
        fragment.append(" » ");
        return fragment;
      }
      // 将路径拆成文件夹、文件和分隔符片段。
      getPathParts(filePath, lastPartIsFile) {
        if (filePath === "/") {
          return [{ type: "folder", name: "库根目录" }];
        }
        const parts = String(filePath).split("/").filter((partName) => partName.length > 0);
        const pathParts = [];
        parts.forEach((partName, index) => {
          pathParts.push({
            type: lastPartIsFile && index === parts.length - 1 ? "file" : "folder",
            name: partName
          });
          if (index < parts.length - 1) {
            pathParts.push({ type: "separator" });
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
        return typeof this.settings?.lastModifiedPrepend === "string" ? this.settings.lastModifiedPrepend : "";
      }
      // 返回最后修改时间的显示格式。
      getLastModifiedTimestampFormat() {
        return typeof this.settings?.lastModifiedTimestampFormat === "string" && this.settings.lastModifiedTimestampFormat ? this.settings.lastModifiedTimestampFormat : " HH:mm:ss";
      }
      // 返回“是否显示创建时间”开关。
      getCreatedEnabled() {
        return this.settings?.createdEnabled === true;
      }
      // 返回创建时间的前缀文本。
      getCreatedPrepend() {
        return typeof this.settings?.createdPrepend === "string" ? this.settings.createdPrepend : "";
      }
      // 返回创建时间的显示格式。
      getCreatedTimestampFormat() {
        return typeof this.settings?.createdTimestampFormat === "string" && this.settings.createdTimestampFormat ? this.settings.createdTimestampFormat : "YYYY-MM-DD";
      }
      // 返回“点击循环显示”开关。
      getCycleOnClickEnabled() {
        return this.settings?.cycleOnClickEnabled !== false;
      }
    };
    module2.exports = {
      StatusBarEnhancerRuntime
    };
  }
});

// src/modules/status-bar-enhancer/store.js
var require_store5 = __commonJS({
  "src/modules/status-bar-enhancer/store.js"(exports2, module2) {
    "use strict";
    var constants = require_constants5();
    var snippetsConstants = require_snippets_constants();
    var StatusBarEnhancerStore = class {
      constructor(plugin) {
        this.plugin = plugin;
        this.settings = this.normalizeSettings();
      }
      // 挂载从独立配置文件读出的设置切片。
      load(settings) {
        this.settings = this.normalizeSettings(settings);
      }
      // 持久化当前状态栏增强配置到独立 JSON 文件。
      async save() {
        this.settings = this.normalizeSettings(this.settings);
        this.plugin.dataStore.setStatusBarEnhancerData(this.settings);
        await this.plugin.dataStore.saveStatusBarEnhancerData(this.settings);
      }
      // 返回当前完整配置。
      getSettings() {
        return this.settings;
      }
      // 更新“是否显示文件名”开关。
      async setShowFileName(enabled) {
        this.settings.showFileName = Boolean(enabled);
        await this.save();
        return this.settings.showFileName;
      }
      // 更新“是否显示图标”开关。
      async setShowIcons(enabled) {
        this.settings.showIcons = Boolean(enabled);
        await this.save();
        return this.settings.showIcons;
      }
      // 更新“是否复制绝对路径”开关。
      async setCopyAbsolutePath(enabled) {
        this.settings.copyAbsolutePath = Boolean(enabled);
        await this.save();
        return this.settings.copyAbsolutePath;
      }
      // 更新“是否显示最后修改时间”开关。
      async setLastModifiedEnabled(enabled) {
        this.settings.lastModifiedEnabled = Boolean(enabled);
        await this.save();
        return this.settings.lastModifiedEnabled;
      }
      // 更新最后修改时间的前缀文本。
      async setLastModifiedPrepend(text) {
        this.settings.lastModifiedPrepend = typeof text === "string" ? text : "";
        await this.save();
        return this.settings.lastModifiedPrepend;
      }
      // 更新最后修改时间的显示格式，空值时回退为默认格式。
      async setLastModifiedTimestampFormat(format) {
        const trimmedFormat = typeof format === "string" ? format : "";
        this.settings.lastModifiedTimestampFormat = trimmedFormat ? trimmedFormat : constants.DEFAULT_STATUS_BAR_ENHANCER_SETTINGS.lastModifiedTimestampFormat;
        await this.save();
        return this.settings.lastModifiedTimestampFormat;
      }
      // 更新“是否显示创建时间”开关。
      async setCreatedEnabled(enabled) {
        this.settings.createdEnabled = Boolean(enabled);
        await this.save();
        return this.settings.createdEnabled;
      }
      // 更新创建时间的前缀文本。
      async setCreatedPrepend(text) {
        this.settings.createdPrepend = typeof text === "string" ? text : "";
        await this.save();
        return this.settings.createdPrepend;
      }
      // 更新创建时间的显示格式，空值时回退为默认格式。
      async setCreatedTimestampFormat(format) {
        const trimmedFormat = typeof format === "string" ? format : "";
        this.settings.createdTimestampFormat = trimmedFormat ? trimmedFormat : constants.DEFAULT_STATUS_BAR_ENHANCER_SETTINGS.createdTimestampFormat;
        await this.save();
        return this.settings.createdTimestampFormat;
      }
      // 更新“点击循环显示”开关。
      async setCycleOnClickEnabled(enabled) {
        this.settings.cycleOnClickEnabled = Boolean(enabled);
        await this.save();
        return this.settings.cycleOnClickEnabled;
      }
      // 一次性更新两个时间戳的显示开关，供点击循环复用，避免短时间内重复写入配置文件。
      async setTimestampDisplayState(lastModifiedEnabled, createdEnabled) {
        this.settings.lastModifiedEnabled = Boolean(lastModifiedEnabled);
        this.settings.createdEnabled = Boolean(createdEnabled);
        await this.save();
        return {
          lastModifiedEnabled: this.settings.lastModifiedEnabled,
          createdEnabled: this.settings.createdEnabled
        };
      }
      // 返回当前 organizer 元素状态映射表。
      getOrganizerElements() {
        return this.settings.organizer ? this.settings.organizer.elements : {};
      }
      // 更新 organizer 元素状态映射表并持久化。
      async setOrganizerElements(elements) {
        if (!this.settings.organizer) {
          this.settings.organizer = { elements: {}, deletedIds: [] };
        }
        this.settings.organizer.elements = this.normalizeOrganizerElements(elements);
        await this.save();
        return this.settings.organizer.elements;
      }
      // 返回已删除的孤儿条目 ID 列表。
      getDeletedIds() {
        return this.settings.organizer && Array.isArray(this.settings.organizer.deletedIds) ? this.settings.organizer.deletedIds : [];
      }
      // 更新已删除的孤儿条目 ID 列表并持久化。
      async setDeletedIds(ids) {
        if (!this.settings.organizer) {
          this.settings.organizer = { elements: {}, deletedIds: [] };
        }
        this.settings.organizer.deletedIds = Array.isArray(ids) ? ids.filter(function(id) {
          return typeof id === "string";
        }) : [];
        await this.save();
        return this.settings.organizer.deletedIds;
      }
      // 归一化 organizer 元素状态映射表。
      normalizeOrganizerElements(elements) {
        if (typeof elements !== "object" || elements === null) {
          return {};
        }
        var result = {};
        Object.keys(elements).forEach(function(id) {
          var status = elements[id];
          if (typeof status !== "object" || status === null) return;
          result[id] = {
            position: typeof status.position === "number" ? status.position : 0,
            visible: status.visible !== false
          };
        });
        return result;
      }
      // 归一化状态栏增强模块配置结构（含 organizer 数据）。
      normalizeSettings(settings) {
        const source = settings || constants.DEFAULT_STATUS_BAR_ENHANCER_SETTINGS;
        const defaults = constants.DEFAULT_STATUS_BAR_ENHANCER_SETTINGS;
        return {
          showFileName: source.showFileName === true,
          showIcons: source.showIcons === true,
          copyAbsolutePath: source.copyAbsolutePath !== false,
          lastModifiedEnabled: source.lastModifiedEnabled !== false,
          lastModifiedPrepend: typeof source.lastModifiedPrepend === "string" ? source.lastModifiedPrepend : defaults.lastModifiedPrepend,
          lastModifiedTimestampFormat: typeof source.lastModifiedTimestampFormat === "string" && source.lastModifiedTimestampFormat ? source.lastModifiedTimestampFormat : defaults.lastModifiedTimestampFormat,
          createdEnabled: source.createdEnabled === true,
          createdPrepend: typeof source.createdPrepend === "string" ? source.createdPrepend : defaults.createdPrepend,
          createdTimestampFormat: typeof source.createdTimestampFormat === "string" && source.createdTimestampFormat ? source.createdTimestampFormat : defaults.createdTimestampFormat,
          cycleOnClickEnabled: source.cycleOnClickEnabled !== false,
          organizer: {
            elements: this.normalizeOrganizerElements(
              source.organizer ? source.organizer.elements : void 0
            ),
            deletedIds: source.organizer && Array.isArray(source.organizer.deletedIds) ? source.organizer.deletedIds.filter(function(id) {
              return typeof id === "string";
            }) : []
          },
          snippets: snippetsConstants.normalizeSnippetsSettings(source.snippets)
        };
      }
    };
    module2.exports = {
      StatusBarEnhancerStore
    };
  }
});

// src/modules/status-bar-enhancer/organizer-runtime.js
var require_organizer_runtime = __commonJS({
  "src/modules/status-bar-enhancer/organizer-runtime.js"(exports2, module2) {
    "use strict";
    var IGNORED_CLASSES = [
      "mod-clickable",
      "status-bar-item",
      "nene-status-bar-enhancer",
      "nene-status-bar-timestamp"
    ];
    function getStatusBarElements(statusBar) {
      var elements = [];
      var nameCount = {};
      Array.from(statusBar.children).forEach(function(element) {
        var id = element.getAttribute("data-nene-organizer-id");
        var name, index;
        if (id == null) {
          name = Array.from(element.classList).filter(function(cls) {
            return IGNORED_CLASSES.indexOf(cls) === -1;
          }).join("-");
          index = name in nameCount ? nameCount[name] + 1 : 1;
          id = name + ";" + index;
          element.setAttribute("data-nene-organizer-id", id);
        } else {
          var parsed = parseElementId(id);
          name = parsed.name;
          index = parsed.index;
        }
        nameCount[name] = Math.max(index, name in nameCount ? nameCount[name] : 0);
        elements.push({
          name,
          index,
          id,
          element
        });
      });
      return elements;
    }
    function parseElementId(id) {
      var parts = id.split(";");
      var index = Number.parseInt(parts.pop(), 10);
      var name = parts.join(";");
      return { name, index };
    }
    function fixOrder(statusBar, elementStatus) {
      var elements = getStatusBarElements(statusBar);
      var known = [];
      var orphans = [];
      for (var i = 0; i < elements.length; i++) {
        var element = elements[i];
        if (element.id in elementStatus) {
          var status = elementStatus[element.id];
          known.push([element, status.position]);
          if (status.visible) {
            element.element.removeClass("nene-organizer-element-hidden");
          } else {
            element.element.addClass("nene-organizer-element-hidden");
          }
        } else {
          orphans.push(element.element);
        }
      }
      known.sort(function(a, b) {
        return a[1] - b[1];
      });
      var orderedElements = known.map(function(entry) {
        return entry[0].element;
      });
      var allElements = orderedElements.concat(orphans);
      allElements.forEach(function(element2, idx) {
        element2.style.order = (idx + 1).toString();
      });
    }
    var OrganizerSpooler = class {
      /**
       * @param {Element} statusBar - .status-bar 容器
       * @param {Function} elementStatusProvider - 返回当前元素状态对象 { id: { position, visible } }
       * @param {Function} onFix - 排序修复完成后的回调（可选）
       * @param {Function} onSaveNewElements - 新元素发现后持久化的回调（可选），接收完整元素状态
       */
      constructor(statusBar, elementStatusProvider, onFix, onSaveNewElements) {
        this.statusBar = statusBar;
        this.elementStatusProvider = elementStatusProvider;
        this.onFix = onFix || function() {
        };
        this.onSaveNewElements = onSaveNewElements || function() {
        };
        this.mutex = false;
        this.spooler = null;
        this.observer = null;
        this.observer = new MutationObserver(/* @__PURE__ */ (function(_this) {
          return function(mutations) {
            if (_this.mutex) return;
            var hasAdded = mutations.some(function(m) {
              return m.type === "childList" && m.addedNodes.length > 0;
            });
            if (hasAdded) {
              _this.scheduleFix(0);
            }
          };
        })(this));
      }
      /**
       * 启动 MutationObserver 监听，并立即应用已保存的元素状态（排序与可见性）。
       */
      start() {
        this.observer.observe(this.statusBar, { childList: true });
        this.scheduleFix(0);
      }
      /**
       * 停止监听并清除待执行的排序任务。
       */
      stop() {
        if (this.observer) {
          this.observer.disconnect();
        }
        clearTimeout(this.spooler);
      }
      /**
       * 暂停监听（拖拽操作时调用，避免干扰）。
       */
      disableObserver() {
        this.observer.disconnect();
      }
      /**
       * 恢复监听（拖拽操作结束后调用）。
       */
      enableObserver() {
        this.observer.observe(this.statusBar, { childList: true });
      }
      /**
       * 安排一次排序修复，多次调用会合并为一次。
       * 排序修复后自动检查当前状态栏中的新元素并持久化。
       *
       * @param {number} timeout - 延迟毫秒数，默认 1000
       */
      scheduleFix(timeout) {
        clearTimeout(this.spooler);
        if (typeof timeout !== "number") timeout = 1e3;
        this.spooler = setTimeout(/* @__PURE__ */ (function(_this) {
          return function() {
            if (_this.mutex) {
              _this.scheduleFix();
              return;
            }
            _this.mutex = true;
            _this.disableObserver();
            var elementStatus = _this.elementStatusProvider();
            fixOrder(_this.statusBar, elementStatus);
            _this.discoverAndSaveNewElements(elementStatus);
            _this.onFix();
            _this.enableObserver();
            _this.mutex = false;
          };
        })(this), timeout);
      }
      /**
       * 对比当前状态栏元素与已保存状态，将新元素合并保存。
       * 新元素的 position 继承 fixOrder 已分配的 CSS order 值。
       *
       * @param {object} existingStatus - 排序修复时使用的已保存元素状态
       */
      discoverAndSaveNewElements(existingStatus) {
        var currentElements = getStatusBarElements(this.statusBar);
        var newElements = {};
        currentElements.forEach(function(el) {
          if (!(el.id in existingStatus)) {
            newElements[el.id] = {
              position: parseInt(el.element.style.order || "1", 10),
              visible: true
            };
          }
        });
        var newIds = Object.keys(newElements);
        if (newIds.length === 0) return;
        var merged = {};
        Object.keys(existingStatus).forEach(function(id) {
          merged[id] = existingStatus[id];
        });
        newIds.forEach(function(id) {
          merged[id] = newElements[id];
        });
        this.onSaveNewElements(merged);
      }
    };
    module2.exports = {
      getStatusBarElements,
      parseElementId,
      fixOrder,
      OrganizerSpooler
    };
  }
});

// src/modules/status-bar-enhancer/organizer-view.js
var require_organizer_view = __commonJS({
  "src/modules/status-bar-enhancer/organizer-view.js"(exports2, module2) {
    "use strict";
    var obsidian2 = require("obsidian");
    var organizerRuntime = require_organizer_runtime();
    var dragging = false;
    function renderModalHeader(containerEl, title, description) {
      var headerEl = containerEl.createDiv({ cls: "nene-settings-modal-header" });
      headerEl.createDiv({ cls: "nene-settings-modal-title", text: title });
      if (description) {
        headerEl.createEl("p", {
          cls: "nene-settings-modal-description",
          text: description
        });
      }
    }
    var StatusBarOrganizerModal = class extends obsidian2.Modal {
      constructor(app, plugin, onSettingsChanged) {
        super(app);
        this.plugin = plugin;
        this.onSettingsChanged = onSettingsChanged;
      }
      onOpen() {
        this.modalEl.addClass("mod-sidebar-layout", "nene-settings-panel-modal", "nene-organizer-modal");
        this.contentEl.empty();
        this.contentEl.addClass("nene-settings-modal");
        void this.render();
      }
      /**
       * 根据当前状态栏元素和已保存配置渲染界面。
       */
      async render() {
        var contentEl = this.contentEl;
        contentEl.empty();
        renderModalHeader(
          contentEl,
          "状态栏元素管理",
          '拖动行左侧手柄可调整元素顺序，点击眼睛图标切换显示/隐藏。红色条目表示对应插件已卸载或元素已不存在，可点击垃圾桶删除，之后可通过底部"恢复"按钮还原。'
        );
        var statusBar = this.plugin.getStatusBarElement();
        var savedElements = this.plugin.getOrganizerSettings();
        var deletedIds = this.plugin.getOrganizerDeletedIds();
        if (!statusBar) {
          contentEl.createEl("p", {
            cls: "nene-organizer-empty",
            text: "未检测到状态栏，该功能仅桌面端可用。"
          });
          return;
        }
        var consolidated = this.consolidateElements(statusBar, savedElements, deletedIds);
        var rowsWrapper = contentEl.createDiv({ cls: "nene-organizer-rows-wrapper" });
        var rowsContainer = rowsWrapper.createDiv({ cls: "nene-organizer-rows-container" });
        var nameCollisions = {};
        consolidated.rows.forEach(function(element) {
          if (element.name in nameCollisions) {
            nameCollisions[element.name]++;
          } else {
            nameCollisions[element.name] = 0;
          }
        });
        var self = this;
        consolidated.rows.forEach(function(row) {
          var currentStatus = consolidated.barStatus[row.id];
          var currentExists = consolidated.existsStatus[row.id];
          var entry = document.createElement("div");
          entry.addClass("nene-organizer-row");
          if (!currentExists) entry.addClass("nene-organizer-row-disabled");
          if (!currentStatus.visible) entry.addClass("nene-organizer-row-hidden");
          entry.setAttribute("data-nene-organizer-row-id", row.id);
          row.entry = entry;
          rowsContainer.appendChild(entry);
          var handle = document.createElement("span");
          handle.addClass("nene-organizer-row-handle");
          handle.addEventListener("mousedown", function(event) {
            handleMouseDown(event, self.plugin, consolidated.barStatus, consolidated.existsStatus, rowsWrapper, rowsContainer, consolidated.rows, row);
          });
          entry.appendChild(handle);
          var displayName = row.name.replace(/^plugin-(obsidian-)?/, "").split("-").map(function(x) {
            return x.charAt(0).toUpperCase() + x.slice(1);
          }).join(" ") + (nameCollisions[row.name] ? " (" + row.index + ")" : "");
          var titleSpan = document.createElement("span");
          titleSpan.addClass("nene-organizer-row-title");
          titleSpan.textContent = displayName;
          entry.appendChild(titleSpan);
          var previewSpan = document.createElement("span");
          previewSpan.addClass("nene-organizer-row-preview");
          if (currentExists && row.element) {
            previewSpan.innerHTML = row.element.innerHTML;
          }
          entry.appendChild(previewSpan);
          var actionSpan = document.createElement("span");
          actionSpan.addClass("nene-organizer-row-action");
          actionSpan.onclick = function() {
            if (currentExists) {
              toggleVisibility(self.plugin, consolidated.barStatus, row);
            } else {
              deleteOrphan(self.plugin, deletedIds, row, self);
            }
          };
          obsidian2.setIcon(actionSpan, currentExists ? currentStatus.visible ? "eye" : "eye-off" : "trash-2");
          entry.appendChild(actionSpan);
        });
        if (consolidated.hasDeleted) {
          contentEl.createDiv({ cls: "nene-organizer-restore-area" });
          consolidated.deletedOrphanList.forEach(function(orphan) {
            var displayName = orphan.name.replace(/^plugin-(obsidian-)?/, "").split("-").map(function(x) {
              return x.charAt(0).toUpperCase() + x.slice(1);
            }).join(" ") + (nameCollisions[orphan.name] ? " (" + orphan.index + ")" : "");
            new obsidian2.Setting(contentEl).setName(displayName).setDesc("已删除，对应插件已卸载或元素已不存在").addButton(function(button) {
              button.setButtonText("恢复").onClick(async function() {
                var newDeletedIds = self.plugin.getOrganizerDeletedIds().filter(function(id) {
                  return id !== orphan.id;
                });
                self.plugin.setOrganizerDeletedIds(newDeletedIds);
                new obsidian2.Notice("已恢复：" + displayName);
                await self.render();
              });
            });
          });
          new obsidian2.Setting(contentEl).setName("全部恢复").setDesc("将以上所有删除条目重新显示").addButton(function(button) {
            button.setButtonText("恢复全部").setCta().onClick(async function() {
              self.plugin.setOrganizerDeletedIds([]);
              new obsidian2.Notice("已恢复所有删除的条目");
              await self.render();
            });
          });
        }
      }
      /**
       * 合并已保存设置与实际状态栏元素状态。
       * 新元素自动追加到末尾；已保存但不存在的元素显示为孤儿条目；
       * 被删除（deletedIds）的孤儿条目不显示。
       *
       * @param {Element} statusBar - .status-bar 容器
       * @param {object} savedElements - 已保存的元素状态 { [id]: { position, visible } }
       * @param {string[]} deletedIds - 已被用户删除的条目 ID 列表
       * @returns {{ rows: Array, barStatus: object, existsStatus: object, hasDeleted: boolean }}
       */
      consolidateElements(statusBar, savedElements, deletedIds) {
        var unorderedElements = organizerRuntime.getStatusBarElements(statusBar);
        var currentIds = unorderedElements.map(function(e) {
          return e.id;
        });
        var barStatus = {};
        var existsStatus = {};
        Object.keys(savedElements).forEach(function(id) {
          barStatus[id] = savedElements[id];
          existsStatus[id] = currentIds.indexOf(id) !== -1;
        });
        var newElementsSaved = false;
        unorderedElements.forEach(function(element) {
          if (element.id in barStatus) return;
          var insertPosition = Object.keys(barStatus).length + 1;
          barStatus[element.id] = { position: insertPosition, visible: true };
          existsStatus[element.id] = true;
          newElementsSaved = true;
        });
        if (newElementsSaved) {
          this.plugin.setOrganizerElementStatus(barStatus);
        }
        var visibleOrphans = Object.keys(savedElements).filter(function(id) {
          return !existsStatus[id] && deletedIds.indexOf(id) === -1;
        }).map(function(id) {
          var parsed = organizerRuntime.parseElementId(id);
          return { name: parsed.name, index: parsed.index, id };
        });
        var rows = unorderedElements.concat(visibleOrphans);
        rows.sort(function(a, b) {
          return barStatus[a.id].position - barStatus[b.id].position;
        });
        var deletedOrphanList = Object.keys(savedElements).filter(function(id) {
          return !existsStatus[id] && deletedIds.indexOf(id) !== -1;
        }).map(function(id) {
          var parsed = organizerRuntime.parseElementId(id);
          var status = barStatus[id];
          return {
            name: parsed.name,
            index: parsed.index,
            id,
            position: status ? status.position : 0,
            visible: status ? status.visible : true
          };
        });
        return {
          rows,
          barStatus,
          existsStatus,
          hasDeleted: deletedIds.length > 0,
          deletedOrphanList
        };
      }
      onClose() {
        this.contentEl.empty();
      }
    };
    function toggleVisibility(plugin, barStatus, row) {
      var status = barStatus[row.id];
      status.visible = !status.visible;
      if (status.visible) {
        if (row.element) row.element.removeClass("nene-organizer-element-hidden");
        if (row.entry) row.entry.removeClass("nene-organizer-row-hidden");
        obsidian2.setIcon(row.entry.children[3], "eye");
      } else {
        if (row.element) row.element.addClass("nene-organizer-element-hidden");
        if (row.entry) row.entry.addClass("nene-organizer-row-hidden");
        obsidian2.setIcon(row.entry.children[3], "eye-off");
      }
      plugin.setOrganizerElementStatus(barStatus);
    }
    function deleteOrphan(plugin, deletedIds, row, modalInstance) {
      deletedIds.push(row.id);
      plugin.setOrganizerDeletedIds(deletedIds);
      new obsidian2.Notice("已删除该条目，可通过底部的「恢复」按钮重新显示");
      modalInstance.render();
    }
    function cloneRow(rowsWrapper, barStatus, existsStatus, rowsContainer, event, row) {
      var realEntry = row.entry;
      realEntry.addClass("nene-organizer-row-clone");
      var fauxEntry = document.createElement("div");
      fauxEntry.addClass("nene-organizer-row");
      fauxEntry.addClass("nene-organizer-row-drag");
      if (!existsStatus[row.id]) fauxEntry.addClass("nene-organizer-row-disabled");
      if (!barStatus[row.id].visible) fauxEntry.addClass("nene-organizer-row-hidden");
      rowsWrapper.appendChild(fauxEntry);
      var containerRect = rowsWrapper.getBoundingClientRect();
      fauxEntry.style.left = realEntry.getBoundingClientRect().left - containerRect.left + "px";
      fauxEntry.style.top = realEntry.getBoundingClientRect().top - containerRect.top + "px";
      fauxEntry.style.width = realEntry.offsetWidth + "px";
      Array.from(realEntry.children).forEach(function(child) {
        var fauxSpan = document.createElement("span");
        fauxSpan.className = child.className;
        fauxSpan.innerHTML = child.innerHTML;
        fauxEntry.appendChild(fauxSpan);
      });
      var offsetX = event.clientX - fauxEntry.getBoundingClientRect().left;
      var offsetY = event.clientY - fauxEntry.getBoundingClientRect().top;
      var index = Array.from(rowsContainer.children).indexOf(realEntry);
      return {
        stationaryRow: realEntry,
        movableRow: fauxEntry,
        offsetX: offsetX + containerRect.left,
        offsetY: offsetY + containerRect.top,
        index
      };
    }
    function deleteRowClone(rowsWrapper, stationaryRow, movableRow) {
      stationaryRow.removeClass("nene-organizer-row-clone");
      rowsWrapper.removeChild(movableRow);
    }
    function calculateRowIndex(event, rowsContainer, movableRow, stationaryRow, offsetX, offsetY, index) {
      movableRow.style.left = event.clientX - offsetX + "px";
      movableRow.style.top = event.clientY - offsetY + "px";
      var dist = movableRow.getBoundingClientRect().top - stationaryRow.getBoundingClientRect().top;
      if (Math.abs(dist) > stationaryRow.offsetHeight * 0.75) {
        var dir = dist > 0 ? 1 : -1;
        var newIndex = Math.max(0, Math.min(index + dir, rowsContainer.children.length - 1));
        return newIndex;
      }
      return index;
    }
    function handlePositionChange(barStatus, existsStatus, rowsContainer, rows, row, stationaryRow, newIndex) {
      var passedEntry = rowsContainer.children[newIndex];
      var passedId = passedEntry.getAttribute("data-nene-organizer-row-id");
      var statusBarChangeRequired = existsStatus[row.id] && existsStatus[passedId];
      if (statusBarChangeRequired && row.element) {
        var passedElement = rows.filter(function(x) {
          return x.id === passedId;
        })[0].element;
        var temp = passedElement.style.order;
        passedElement.style.order = row.element.style.order;
        row.element.style.order = temp;
      }
      rowsContainer.removeChild(stationaryRow);
      if (newIndex !== rowsContainer.children.length) {
        rowsContainer.insertBefore(stationaryRow, rowsContainer.children[newIndex]);
      } else {
        rowsContainer.appendChild(stationaryRow);
      }
      Array.from(rowsContainer.children).forEach(function(entry, idx) {
        var id = entry.getAttribute("data-nene-organizer-row-id");
        if (barStatus[id]) {
          barStatus[id].position = idx;
        }
      });
    }
    function handleMouseDown(event, plugin, barStatus, existsStatus, rowsWrapper, rowsContainer, rows, row) {
      if (dragging) return;
      dragging = true;
      event.preventDefault();
      var cloneData = cloneRow(rowsWrapper, barStatus, existsStatus, rowsContainer, event, row);
      var index = cloneData.index;
      function onMouseMove(moveEvent) {
        moveEvent.preventDefault();
        plugin.getOrganizerSpooler().disableObserver();
        var newIndex = calculateRowIndex(moveEvent, rowsContainer, cloneData.movableRow, cloneData.stationaryRow, cloneData.offsetX, cloneData.offsetY, index);
        if (newIndex !== index) {
          handlePositionChange(barStatus, existsStatus, rowsContainer, rows, row, cloneData.stationaryRow, newIndex);
          index = newIndex;
        }
        plugin.getOrganizerSpooler().enableObserver();
      }
      function onMouseUp() {
        deleteRowClone(rowsWrapper, cloneData.stationaryRow, cloneData.movableRow);
        dragging = false;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        plugin.setOrganizerElementStatus(barStatus);
      }
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }
    module2.exports = {
      StatusBarOrganizerModal
    };
  }
});

// src/modules/status-bar-enhancer/view.js
var require_view3 = __commonJS({
  "src/modules/status-bar-enhancer/view.js"(exports2, module2) {
    "use strict";
    var obsidian2 = require("obsidian");
    var organizerView = require_organizer_view();
    function renderModalHeader(containerEl, title, description) {
      const headerEl = containerEl.createDiv({ cls: "nene-settings-modal-header" });
      headerEl.createDiv({ cls: "nene-settings-modal-title", text: title });
      if (description) {
        headerEl.createEl("p", {
          cls: "nene-settings-modal-description",
          text: description
        });
      }
    }
    function renderDetailItem(containerEl, label, value, codeStyle) {
      const itemEl = containerEl.createDiv({ cls: "nene-settings-detail-item" });
      itemEl.createDiv({ cls: "nene-settings-detail-label", text: label });
      itemEl.createEl(codeStyle ? "code" : "div", {
        cls: "nene-settings-detail-value",
        text: value
      });
    }
    function debounceSave(saveTask, delay) {
      let timerId = null;
      return (...args) => {
        window.clearTimeout(timerId);
        timerId = window.setTimeout(() => {
          void saveTask(...args);
        }, delay);
      };
    }
    var StatusBarEnhancerManagementModal = class extends obsidian2.Modal {
      constructor(app, plugin, onSettingsChanged) {
        super(app);
        this.plugin = plugin;
        this.onSettingsChanged = onSettingsChanged;
      }
      // 打开弹窗时渲染状态栏增强模块详情与配置项。
      onOpen() {
        this.modalEl.addClass("mod-sidebar-layout", "nene-settings-panel-modal");
        this.contentEl.empty();
        this.contentEl.addClass("nene-settings-modal");
        void this.render();
      }
      // 根据当前最新状态渲染状态栏增强模块管理界面。
      async render() {
        const { contentEl } = this;
        const summary = this.plugin.getSettingsSummary();
        const configSummary = await this.plugin.getConfigManagementSummary();
        contentEl.empty();
        renderModalHeader(
          contentEl,
          "状态栏增强模块",
          "该模块会在状态栏显示当前活动文件的路径。点击状态栏路径可直接复制；移动端通常不显示状态栏，因此主要用于桌面端。"
        );
        const detailListEl = contentEl.createDiv({ cls: "nene-settings-detail-list" });
        renderDetailItem(detailListEl, "当前状态", summary.statusBarEnhancerEnabled ? "已启用" : "已关闭");
        renderDetailItem(detailListEl, "显示文件名", summary.statusBarEnhancerShowFileName ? "已开启" : "已关闭");
        renderDetailItem(detailListEl, "显示图标", summary.statusBarEnhancerShowIcons ? "已开启" : "已关闭");
        renderDetailItem(detailListEl, "点击复制绝对路径", summary.statusBarEnhancerCopyAbsolutePath ? "已开启" : "已关闭");
        renderDetailItem(detailListEl, "显示最后修改时间", summary.statusBarEnhancerLastModifiedEnabled ? "已开启" : "已关闭");
        renderDetailItem(detailListEl, "显示创建时间", summary.statusBarEnhancerCreatedEnabled ? "已开启" : "已关闭");
        renderDetailItem(detailListEl, "点击循环显示", summary.statusBarEnhancerCycleOnClick ? "已开启" : "已关闭");
        renderDetailItem(detailListEl, "配置文件", configSummary.statusBarEnhancer.path, true);
        new obsidian2.Setting(contentEl).setName("显示文件名").setDesc("在状态栏路径中显示当前文件名。考虑到状态栏长度，建议关闭").addToggle((toggle) => {
          toggle.setValue(summary.statusBarEnhancerShowFileName).onChange(async (value) => {
            await this.plugin.updateStatusBarEnhancerShowFileName(value);
            new obsidian2.Notice(value ? "已开启状态栏文件名显示" : "已关闭状态栏文件名显示");
            await this.onSettingsChanged();
            await this.render();
          });
        });
        new obsidian2.Setting(contentEl).setName("显示图标").setDesc("在状态栏路径中显示文件夹与文件图标。考虑到状态栏长度，建议关闭").addToggle((toggle) => {
          toggle.setValue(summary.statusBarEnhancerShowIcons).onChange(async (value) => {
            await this.plugin.updateStatusBarEnhancerShowIcons(value);
            new obsidian2.Notice(value ? "已开启状态栏图标显示" : "已关闭状态栏图标显示");
            await this.onSettingsChanged();
            await this.render();
          });
        });
        new obsidian2.Setting(contentEl).setName("复制绝对路径").setDesc("切换点击状态栏时所复制的路径类型为绝对路径，默认启用").addToggle((toggle) => {
          toggle.setValue(summary.statusBarEnhancerCopyAbsolutePath).onChange(async (value) => {
            await this.plugin.updateStatusBarEnhancerCopyAbsolutePath(value);
            new obsidian2.Notice(value ? "状态栏点击复制已改为绝对路径" : "状态栏点击复制已改为库内相对路径");
            await this.onSettingsChanged();
            await this.render();
          });
        });
        new obsidian2.Setting(contentEl).setName("最后修改时间").setHeading();
        new obsidian2.Setting(contentEl).setName("显示最后修改时间").setDesc("在状态栏显示当前活动文件的最后修改时间。").addToggle((toggle) => {
          toggle.setValue(summary.statusBarEnhancerLastModifiedEnabled).onChange(async (value) => {
            await this.plugin.updateStatusBarEnhancerLastModifiedEnabled(value);
            new obsidian2.Notice(value ? "已开启最后修改时间显示" : "已关闭最后修改时间显示");
            await this.onSettingsChanged();
            await this.render();
          });
        });
        new obsidian2.Setting(contentEl).setName("最后修改时间前缀").setDesc("显示在最后修改时间之前的文本。").addText((text) => {
          const debouncedSave = debounceSave(async (value) => {
            await this.plugin.updateStatusBarEnhancerLastModifiedPrepend(value);
            await this.onSettingsChanged();
          }, 500);
          text.setPlaceholder("🖋️").setValue(summary.statusBarEnhancerLastModifiedPrepend).onChange(debouncedSave);
        });
        new obsidian2.Setting(contentEl).setName("最后修改时间格式").setDesc("兼容 Moment.js 格式，例如 YYYY-MM-DD HH:mm:ss。").addText((text) => {
          const debouncedSave = debounceSave(async (value) => {
            await this.plugin.updateStatusBarEnhancerLastModifiedTimestampFormat(value);
            await this.onSettingsChanged();
          }, 500);
          text.setPlaceholder(" HH:mm:ss").setValue(summary.statusBarEnhancerLastModifiedTimestampFormat).onChange(debouncedSave);
        });
        new obsidian2.Setting(contentEl).setName("创建时间").setHeading();
        new obsidian2.Setting(contentEl).setName("显示创建时间").setDesc("在状态栏显示当前活动文件的创建时间。").addToggle((toggle) => {
          toggle.setValue(summary.statusBarEnhancerCreatedEnabled).onChange(async (value) => {
            await this.plugin.updateStatusBarEnhancerCreatedEnabled(value);
            new obsidian2.Notice(value ? "已开启创建时间显示" : "已关闭创建时间显示");
            await this.onSettingsChanged();
            await this.render();
          });
        });
        new obsidian2.Setting(contentEl).setName("创建时间前缀").setDesc("显示在创建时间之前的文本。").addText((text) => {
          const debouncedSave = debounceSave(async (value) => {
            await this.plugin.updateStatusBarEnhancerCreatedPrepend(value);
            await this.onSettingsChanged();
          }, 500);
          text.setPlaceholder("📘").setValue(summary.statusBarEnhancerCreatedPrepend).onChange(debouncedSave);
        });
        new obsidian2.Setting(contentEl).setName("创建时间格式").setDesc("兼容 Moment.js 格式，例如 YYYY-MM-DD HH:mm:ss。").addText((text) => {
          const debouncedSave = debounceSave(async (value) => {
            await this.plugin.updateStatusBarEnhancerCreatedTimestampFormat(value);
            await this.onSettingsChanged();
          }, 500);
          text.setPlaceholder("YYYY-MM-DD").setValue(summary.statusBarEnhancerCreatedTimestampFormat).onChange(debouncedSave);
        });
        new obsidian2.Setting(contentEl).setName("交互").setHeading();
        new obsidian2.Setting(contentEl).setName("点击循环显示").setDesc("点击状态栏时间项时，在「仅最后修改时间 → 仅创建时间 → 两者都显示」之间循环，循环结果会保存为当前配置。").addToggle((toggle) => {
          toggle.setValue(summary.statusBarEnhancerCycleOnClick).onChange(async (value) => {
            await this.plugin.updateStatusBarEnhancerCycleOnClickEnabled(value);
            new obsidian2.Notice(value ? "已开启点击循环显示" : "已关闭点击循环显示");
            await this.onSettingsChanged();
            await this.render();
          });
        });
        new obsidian2.Setting(contentEl).setName("状态栏元素管理").setHeading();
        new obsidian2.Setting(contentEl).setName("排序与可见性").setDesc("管理状态栏各元素的位置和显示/隐藏状态，支持拖拽排序。").addButton((button) => {
          button.setButtonText("打开元素管理").onClick(() => {
            var modal = new organizerView.StatusBarOrganizerModal(this.app, this.plugin, async () => {
              await this.render();
            });
            modal.open();
          });
        });
        new obsidian2.Setting(contentEl).setName("Snippets 管理").setHeading();
        const snippetsSettings = this.plugin.snippetsStore.getSettings();
        new obsidian2.Setting(contentEl).setName("玻璃菜单效果").setDesc("将菜单的背景由主题的次要背景色--background-secondary更改为玻璃背景，建议关闭").addToggle((toggle) => {
          toggle.setValue(snippetsSettings.aestheticStyle).onChange(async (value) => {
            await this.plugin.snippetsStore.setAestheticStyle(value);
            new obsidian2.Notice(value ? "已开启毛玻璃菜单效果" : "已关闭毛玻璃菜单效果");
            await this.onSettingsChanged();
            await this.render();
          });
        });
        new obsidian2.Setting(contentEl).setName("自动打开新建CSS片段").setDesc("是否在新建CSS代码片段文件后立即以默认应用程序将其打开，建议启用").addToggle((toggle) => {
          toggle.setValue(snippetsSettings.openSnippetFile).onChange(async (value) => {
            await this.plugin.snippetsStore.setOpenSnippetFile(value);
            new obsidian2.Notice(value ? "已开启自动打开新建CSS片段" : "已关闭自动打开新建CSS片段");
            await this.onSettingsChanged();
            await this.render();
          });
        });
        new obsidian2.Setting(contentEl).setName("设置新建CSS片段的状态").setDesc("是否自动启用新建CSS代码片段，建议启用").addToggle((toggle) => {
          toggle.setValue(snippetsSettings.snippetEnabledStatus).onChange(async (value) => {
            await this.plugin.snippetsStore.setSnippetEnabledStatus(value);
            new obsidian2.Notice(value ? "新建CSS片段将默认启用" : "新建CSS片段将默认关闭");
            await this.onSettingsChanged();
            await this.render();
          });
        });
        const templateSetting = new obsidian2.Setting(contentEl);
        templateSetting.settingEl.setAttribute(
          "style",
          "display: grid; grid-template-columns: 1fr;"
        );
        templateSetting.setName("CSS片段模板").setDesc("设置新建CSS代码片段的默认样式。");
        templateSetting.addTextArea((textarea) => {
          const debouncedSave = debounceSave(async (value) => {
            await this.plugin.snippetsStore.setStylingTemplate(value);
            await this.onSettingsChanged();
          }, 500);
          textarea.inputEl.setAttribute("style", "margin-top: 12px; width: 100%; min-height: 32vh;");
          textarea.inputEl.addClass("nene-css-editor");
          textarea.setValue(snippetsSettings.stylingTemplate).onChange(debouncedSave);
        });
      }
      // 关闭弹窗时清理内容，避免重复挂载旧节点。
      onClose() {
        this.contentEl.empty();
      }
    };
    module2.exports = {
      StatusBarEnhancerManagementModal
    };
  }
});

// src/modules/status-bar-enhancer/snippets-store.js
var require_snippets_store = __commonJS({
  "src/modules/status-bar-enhancer/snippets-store.js"(exports2, module2) {
    "use strict";
    var snippetsConstants = require_snippets_constants();
    var SnippetsStore = class {
      constructor(plugin) {
        this.plugin = plugin;
        this.settings = snippetsConstants.normalizeSnippetsSettings();
      }
      // 从状态栏增强仓库中提取 snippets 配置切片。
      load() {
        const parentSettings = this.plugin.statusBarEnhancerStore.getSettings();
        this.settings = snippetsConstants.normalizeSnippetsSettings(parentSettings.snippets);
      }
      // 返回当前完整配置。
      getSettings() {
        return this.settings;
      }
      // 持久化 snippets 配置到状态栏增强的独立配置文件。
      async save() {
        const parentStore = this.plugin.statusBarEnhancerStore;
        const currentSettings = parentStore.getSettings();
        currentSettings.snippets = snippetsConstants.normalizeSnippetsSettings(this.settings);
        parentStore.settings = parentStore.normalizeSettings(currentSettings);
        await parentStore.save();
      }
      // 更新「毛玻璃效果」开关。
      async setAestheticStyle(enabled) {
        this.settings.aestheticStyle = Boolean(enabled);
        await this.save();
        return this.settings.aestheticStyle;
      }
      // 更新「自动打开新建片段」开关。
      async setOpenSnippetFile(enabled) {
        this.settings.openSnippetFile = Boolean(enabled);
        await this.save();
        return this.settings.openSnippetFile;
      }
      // 更新「新建片段默认启用」开关。
      async setSnippetEnabledStatus(enabled) {
        this.settings.snippetEnabledStatus = Boolean(enabled);
        await this.save();
        return this.settings.snippetEnabledStatus;
      }
      // 更新 CSS 模板文本。
      async setStylingTemplate(text) {
        this.settings.stylingTemplate = typeof text === "string" ? text : "";
        await this.save();
        return this.settings.stylingTemplate;
      }
    };
    module2.exports = {
      SnippetsStore
    };
  }
});

// src/modules/status-bar-enhancer/snippets-runtime.js
var require_snippets_runtime = __commonJS({
  "src/modules/status-bar-enhancer/snippets-runtime.js"(exports2, module2) {
    "use strict";
    var obsidian2 = require("obsidian");
    function registerPantoneIcon() {
      const pantoneIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="0" stroke-linecap="round" stroke-linejoin="round"><path d="M5.764 8l-.295-.73a1 1 0 0 1 .553-1.302l9.272-3.746a1 1 0 0 1 1.301.552l5.62 13.908a1 1 0 0 1-.553 1.302L12.39 21.73a1 1 0 0 1-1.302-.553L11 20.96V21H7a1 1 0 0 1-1-1v-.27l-3.35-1.353a1 1 0 0 1-.552-1.302L5.764 8zM8 19h2.209L8 13.533V19zm-2-6.244l-1.673 4.141L6 17.608v-4.852zm1.698-5.309l4.87 12.054l7.418-2.997l-4.87-12.053l-7.418 2.996zm2.978 2.033a1 1 0 1 1-.749-1.855a1 1 0 0 1 .75 1.855z" fill="currentColor"/></svg>`;
      obsidian2.addIcon("nene-pantone", pantoneIconSvg);
      obsidian2.addIcon("ms-snippet", '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><path d="M7.375 16.781l1.25-1.562L4.601 12l4.024-3.219l-1.25-1.562l-5 4a1 1 0 0 0 0 1.562l5 4zm9.25-9.562l-1.25 1.562L19.399 12l-4.024 3.219l1.25 1.562l5-4a1 1 0 0 0 0-1.562l-5-4zm-1.649-4.003l-4 18l-1.953-.434l4-18z" fill="currentColor"/></svg>');
    }
    function isSnippetEnabled(app, snippet) {
      try {
        if (app.customCss && typeof app.customCss.enabledSnippets !== "undefined") {
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
    function getSnippetPath(app, snippet) {
      try {
        if (app.customCss && typeof app.customCss.getSnippetPath === "function") {
          return app.customCss.getSnippetPath(snippet);
        }
        return "";
      } catch (_e) {
        return "";
      }
    }
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
    function getSnippetsFolder(app) {
      try {
        if (app.customCss && typeof app.customCss.getSnippetsFolder === "function") {
          return app.customCss.getSnippetsFolder();
        }
        return "";
      } catch (_e) {
        return "";
      }
    }
    function setCssEnabledStatus(app, snippet, enabled) {
      try {
        if (app.customCss && typeof app.customCss.setCssEnabledStatus === "function") {
          app.customCss.setCssEnabledStatus(snippet, enabled);
        }
      } catch (_e) {
      }
    }
    function requestLoadSnippets(app) {
      try {
        if (app.customCss && typeof app.customCss.requestLoadSnippets === "function") {
          app.customCss.requestLoadSnippets();
        }
      } catch (_e) {
      }
    }
    var CreateSnippetModal = class extends obsidian2.Modal {
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
        contentEl.createEl("h2", { text: "创建 CSS 片段" });
        var fileNameSetting = new obsidian2.Setting(contentEl);
        var fileNameInput = new obsidian2.TextComponent(fileNameSetting.controlEl);
        fileNameSetting.setName("CSS 片段名称").setDesc("输入新的 CSS 片段文件名（不含 .css 后缀）。");
        var cssContentSetting = new obsidian2.Setting(contentEl);
        cssContentSetting.settingEl.addClass("nene-css-editor-setting");
        var cssContentInput = new obsidian2.TextAreaComponent(cssContentSetting.controlEl);
        cssContentInput.inputEl.addClass("nene-css-editor");
        cssContentSetting.setName("CSS 内容").setDesc("输入 CSS 样式内容。");
        cssContentInput.setValue(this.settings.stylingTemplate || "");
        var selfModal = this;
        new obsidian2.Setting(contentEl).addButton(function(btn) {
          btn.setButtonText("创建片段").onClick(async function() {
            var fileName = fileNameInput.getValue().trim();
            var fileContents = cssContentInput.getValue();
            if (!fileName) {
              new obsidian2.Notice("请输入片段名称");
              return;
            }
            try {
              if (!selfModal.app.customCss) {
                new obsidian2.Notice("无法获取 CSS 片段管理");
                return;
              }
              var snippetsFolder = getSnippetsFolder(selfModal.app);
              if (!snippetsFolder) {
                new obsidian2.Notice("无法获取片段文件夹路径");
                return;
              }
              var existingSnippets = getSnippets(selfModal.app);
              if (existingSnippets.includes(fileName + ".css")) {
                new obsidian2.Notice('"' + fileName + '.css" 已存在。');
                return;
              }
              await selfModal.app.vault.create(
                snippetsFolder + "/" + fileName + ".css",
                fileContents
              );
              if (selfModal.settings?.openSnippetFile !== false) {
                var snippetPath = getSnippetPath(selfModal.app, fileName + ".css");
                if (snippetPath && typeof selfModal.app.openWithDefaultApp === "function") {
                  selfModal.app.openWithDefaultApp(snippetPath);
                }
              }
              if (selfModal.settings?.snippetEnabledStatus) {
                setCssEnabledStatus(selfModal.app, fileName + ".css", true);
              }
              requestLoadSnippets(selfModal.app);
              new obsidian2.Notice('片段 "' + fileName + '.css" 已创建');
              selfModal.close();
            } catch (error) {
              console.error("[ねね] 创建 CSS 片段失败", error);
              new obsidian2.Notice("创建失败：" + (error.message || "未知错误"));
            }
          });
        });
        fileNameInput.inputEl.focus();
      }
      onClose() {
        this.contentEl.empty();
      }
    };
    var SnippetsRenameModal = class extends obsidian2.Modal {
      constructor(app, plugin, oldSnippet, onRenamed) {
        super(app);
        this.plugin = plugin;
        this.oldSnippet = oldSnippet;
        this.onRenamed = onRenamed;
        this.oldBaseName = oldSnippet.replace(/\.css$/i, "");
      }
      onOpen() {
        this.render();
      }
      render() {
        var self = this;
        var contentEl = this.contentEl;
        contentEl.empty();
        contentEl.createEl("h5", { text: "重命名 CSS 片段" });
        var nameInput = new obsidian2.TextComponent(contentEl);
        nameInput.inputEl.addClass("nene-rename-input");
        nameInput.setValue(this.oldBaseName);
        nameInput.inputEl.focus();
        nameInput.inputEl.select();
        var btnContainer = contentEl.createDiv({ cls: "modal-button-container" });
        new obsidian2.ButtonComponent(btnContainer).setButtonText("确定").setCta().onClick(async function() {
          var newName = nameInput.getValue().trim();
          if (!newName) {
            new obsidian2.Notice("请输入新名称");
            return;
          }
          var newSnippet = newName.endsWith(".css") ? newName : newName + ".css";
          if (newSnippet === self.oldSnippet) {
            new obsidian2.Notice("新名称与原名相同");
            return;
          }
          var existingSnippets = getSnippets(self.app);
          if (existingSnippets.includes(newSnippet)) {
            new obsidian2.Notice('"' + newSnippet + '" 已存在。');
            return;
          }
          try {
            var snippetsFolder = getSnippetsFolder(self.app);
            var oldPath = snippetsFolder + "/" + self.oldSnippet;
            var newPath = snippetsFolder + "/" + newSnippet;
            var content = await self.app.vault.adapter.read(oldPath);
            await self.app.vault.adapter.write(newPath, content);
            await self.app.vault.adapter.remove(oldPath);
            var wasEnabled = isSnippetEnabled(self.app, self.oldSnippet);
            if (wasEnabled) {
              setCssEnabledStatus(self.app, self.oldSnippet, false);
            }
            setCssEnabledStatus(self.app, newSnippet, wasEnabled);
            requestLoadSnippets(self.app);
            new obsidian2.Notice('片段已重命名为 "' + newSnippet + '"');
            if (typeof self.onRenamed === "function") {
              self.onRenamed();
            }
            self.close();
          } catch (error) {
            console.error("[ねね] 重命名 CSS 片段失败", error);
            new obsidian2.Notice("重命名失败：" + (error.message || "未知错误"));
          }
        });
        new obsidian2.ButtonComponent(btnContainer).setButtonText("取消").onClick(function() {
          self.close();
        });
      }
      onClose() {
        this.contentEl.empty();
      }
    };
    var SnippetsRuntime = class {
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
        this.statusBarItem.addClass("mod-clickable");
        this.statusBarItem.addClass("nene-snippets-button");
        this.statusBarItem.setAttribute("aria-label", "CSS代码片段管理");
        this.statusBarItem.setAttribute("data-tooltip-position", "top");
        this.statusBarItem.onClickEvent(function(e) {
          this.toggleMenu();
        }.bind(this));
        var iconEl = this.statusBarItem.querySelector(".status-bar-item-icon");
        if (!iconEl) {
          var iconContainer = this.statusBarItem.createSpan({ cls: "status-bar-item-icon" });
          obsidian2.setIcon(iconContainer, "nene-pantone");
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
        var menu = new obsidian2.Menu();
        menu.setUseNativeMenu(false);
        var menuDom = menu.dom;
        menuDom.addClass("MySnippets-statusbar-menu");
        menuDom.style.zIndex = "var(--layer-menu)";
        if (this.settings.aestheticStyle) {
          menuDom.style.backgroundColor = "transparent";
          menuDom.style.backdropFilter = "blur(8px)";
          menuDom.style.webkitBackdropFilter = "blur(8px)";
        }
        currentSnippets.forEach(function(snippet) {
          var snippetPath = getSnippetPath(app, snippet);
          var enabled = isSnippetEnabled(app, snippet);
          menu.addItem(function(item) {
            item.setTitle(snippet);
            var itemDom = item.dom;
            var toggle = new obsidian2.ToggleComponent(itemDom);
            var openBtn = new obsidian2.ButtonComponent(itemDom);
            var renameBtn = new obsidian2.ButtonComponent(itemDom);
            toggle.setValue(enabled).onChange(function() {
              var isOn = customCssEnabled(app, snippet);
              setCssEnabledStatus(app, snippet, !isOn);
            });
            openBtn.setIcon("ms-snippet").setClass("MS-OpenSnippet").onClick(function() {
              app.openWithDefaultApp(snippetPath);
            });
            openBtn.buttonEl.setAttribute("aria-label", "打开CSS代码片段文件");
            openBtn.buttonEl.setAttribute("data-tooltip-position", "top");
            renameBtn.setIcon("pencil").setClass("MS-RenameSnippet").onClick(function() {
              new SnippetsRenameModal(app, self, snippet, function() {
              }).open();
            });
            renameBtn.buttonEl.setAttribute("aria-label", "重命名CSS代码片段");
            renameBtn.buttonEl.setAttribute("data-tooltip-position", "top");
            item.onClick(function(e) {
              e.preventDefault();
              e.stopImmediatePropagation();
            });
          });
        });
        menu.addSeparator();
        menu.addItem(function(actions) {
          actions.setIcon(null);
          actions.setTitle("功能");
          actions.titleEl.style.fontWeight = "700";
          var actionsDom = actions.dom;
          var reloadBtn = new obsidian2.ButtonComponent(actionsDom);
          reloadBtn.setIcon("refresh-cw").setClass("MySnippetsButton").setClass("MS-Reload").onClick(function() {
            requestLoadSnippets(app);
            new obsidian2.Notice("CSS代码片段已重新加载");
          });
          reloadBtn.buttonEl.setAttribute("aria-label", "重载CSS代码片段");
          reloadBtn.buttonEl.setAttribute("data-tooltip-position", "top");
          var folderBtn = new obsidian2.ButtonComponent(actionsDom);
          folderBtn.setIcon("folder-open").setClass("MySnippetsButton").setClass("MS-Folder").onClick(function() {
            if (snippetsFolder && typeof app.openWithDefaultApp === "function") {
              app.openWithDefaultApp(snippetsFolder);
            }
          });
          folderBtn.buttonEl.setAttribute("aria-label", "打开CSS代码片段所在文件夹");
          folderBtn.buttonEl.setAttribute("data-tooltip-position", "top");
          var addBtn = new obsidian2.ButtonComponent(actionsDom);
          addBtn.setIcon("plus-circle").setClass("MySnippetsButton").setClass("MS-Folder").onClick(function() {
            new CreateSnippetModal(app, self, self.settings).open();
          });
          addBtn.buttonEl.setAttribute("aria-label", "新建CSS代码片段");
          addBtn.buttonEl.setAttribute("data-tooltip-position", "top");
        });
        menu.showAtPosition({
          x: window.innerWidth - 15,
          y: window.innerHeight - 37
        });
        this.menuEl = menuDom;
        this._menu = menu;
        setTimeout(function() {
          if (self.menuEl && self.menuEl.parentNode) {
            self._closeHandler = function(e) {
              if (self.menuEl && !self.menuEl.contains(e.target)) {
                self.closeMenu();
              }
            };
            document.addEventListener("mousedown", self._closeHandler, { once: true });
          }
        }, 10);
      }
      // 关闭菜单（利用 Obsidian Menu.close 或手动移除 DOM）。
      closeMenu() {
        if (this._menu && typeof this._menu.close === "function") {
          this._menu.close();
        }
        this._menu = null;
        if (this.menuEl && this.menuEl.parentNode) {
          this.menuEl.parentNode.removeChild(this.menuEl);
        }
        this.menuEl = null;
        if (this._closeHandler) {
          document.removeEventListener("mousedown", this._closeHandler);
          this._closeHandler = null;
        }
      }
    };
    module2.exports = {
      SnippetsRuntime,
      CreateSnippetModal,
      SnippetsRenameModal
    };
  }
});

// src/modules/status-bar-enhancer/index.js
var require_status_bar_enhancer = __commonJS({
  "src/modules/status-bar-enhancer/index.js"(exports2, module2) {
    "use strict";
    var constants = require_constants5();
    var runtime = require_runtime();
    var store = require_store5();
    var view = require_view3();
    var organizerRuntime = require_organizer_runtime();
    var organizerView = require_organizer_view();
    var snippetsConstants = require_snippets_constants();
    var snippetsStore = require_snippets_store();
    var snippetsRuntime = require_snippets_runtime();
    module2.exports = Object.assign({}, constants, runtime, store, view, organizerRuntime, organizerView, snippetsConstants, snippetsStore, snippetsRuntime);
  }
});

// src/modules/tab-bar-enhancer/runtime.js
var require_runtime2 = __commonJS({
  "src/modules/tab-bar-enhancer/runtime.js"(exports2, module2) {
    "use strict";
    var obsidian2 = require("obsidian");
    var TAB_HEADER_SELECTOR = ".workspace-tab-header";
    var TAB_HEADER_CONTAINER_SELECTOR = ".workspace-tab-header-container";
    var TOP_BAR_WHEEL_CLASS = "nene-tab-bar-wheel-switch";
    var DEBUG_HIGHLIGHT_CLASS = "nene-tab-debug-highlight";
    var DEBUG_HIGHLIGHT_YELLOW_CLASS = "nene-tab-debug-yellow";
    var DEBUG_HIGHLIGHT_RED_CLASS = "nene-tab-debug-red";
    var TabBarEnhancerRuntime = class {
      constructor(plugin) {
        this.plugin = plugin;
        this.settings = null;
        this.registeredWindows = /* @__PURE__ */ new Set();
      }
      // 挂载最新配置。
      load(settings) {
        this.settings = settings || this.plugin.tabBarEnhancerStore.getSettings();
      }
      // 启动标签栏增强，同步 body 上的实验性 class；滚轮监听由主入口统一注册。
      start() {
        this.syncTopBarWheelClass(true);
      }
      // 停止标签栏增强，移除 body 上的实验性 class；滚轮监听随插件卸载自动回收。
      stop() {
        document.body.classList.toggle(TOP_BAR_WHEEL_CLASS, false);
      }
      // 根据模块开关与配置同步 body 上的实验性 class，供启停与配置变更时调用。
      syncTopBarWheelClass(moduleEnabled) {
        const shouldEnable = Boolean(moduleEnabled) && this.getTopBarWheelTabSwitch();
        document.body.classList.toggle(TOP_BAR_WHEEL_CLASS, shouldEnable);
      }
      // 为当前全部工作区窗口注册滚轮监听，供布局就绪后调用。
      registerWheelHandlersForExistingWindows() {
        this.getAllWorkspaceWindows().forEach((win) => {
          this.registerWheelHandler(win);
        });
      }
      // 为单个窗口注册滚轮监听，重复注册时直接跳过。
      registerWheelHandler(win) {
        if (!win || this.registeredWindows.has(win)) {
          return;
        }
        this.registeredWindows.add(win);
        this.plugin.registerDomEvent(win, "wheel", (evt) => {
          this.handleWheelEvent(win, evt);
        });
      }
      // 弹出窗口关闭时移除记录，避免缓存持有已销毁的窗口对象。
      unregisterWheelHandler(win) {
        this.registeredWindows.delete(win);
      }
      // 处理滚轮事件，根据滚动方向切换到左邻或右邻标签。
      handleWheelEvent(win, evt) {
        if (!this.plugin.isTabBarEnhancerEnabled()) {
          return;
        }
        const leaf = this.findLeafByWheelEvent(evt);
        if (!leaf) {
          return;
        }
        this.focusElectronWindow(win);
        const skipOptions = {
          skipCssHiddenTabs: this.getSkipCssHiddenTabs(),
          skipUnloadedPluginTabs: this.getSkipUnloadedPluginTabs()
        };
        if (evt.deltaY <= 0) {
          this.gotoSiblingTab(leaf, -1, skipOptions);
        } else {
          this.gotoSiblingTab(leaf, 1, skipOptions);
        }
      }
      // 根据滚轮事件定位所属标签对应的工作区面板，未命中标签区域时返回空值。
      findLeafByWheelEvent(evt) {
        this.logDebug("开始定位滚轮事件对应的标签", evt);
        if (!this.checkIsWheelInTabContainer(evt)) {
          this.logDebug("滚轮事件不在标签区域内，提前返回");
          return null;
        }
        const targetEl = evt.target instanceof Element ? evt.target : null;
        const wheeledTabContainer = targetEl ? targetEl.closest(TAB_HEADER_CONTAINER_SELECTOR) : null;
        if (!wheeledTabContainer) {
          this.logDebug("未找到标签栏容器，提前返回");
          return null;
        }
        if (this.getDebug()) {
          this.highlightElement(wheeledTabContainer, DEBUG_HIGHLIGHT_YELLOW_CLASS);
        }
        const wheeledTabHeader = wheeledTabContainer.find(`${TAB_HEADER_SELECTOR}.is-active`) || wheeledTabContainer.find(TAB_HEADER_SELECTOR);
        if (!wheeledTabHeader) {
          this.logDebug("未找到标签头，提前返回");
          return null;
        }
        if (this.getDebug()) {
          this.highlightElement(wheeledTabHeader, DEBUG_HIGHLIGHT_RED_CLASS);
        }
        const wheeledLeaf = this.getAllLeaves().find(
          (leaf) => leaf.tabHeaderEl && leaf.tabHeaderEl.isEqualNode(wheeledTabHeader)
        );
        if (!wheeledLeaf) {
          this.logDebug("未找到标签头对应的工作区面板，提前返回");
          return null;
        }
        if (this.getDebug()) {
          this.highlightLeaf(wheeledLeaf);
        }
        const wheeledParent = this.getAllWorkspaceParents().find(
          (split) => split.containerEl && split.containerEl.contains(wheeledTabHeader)
        );
        if (!wheeledParent) {
          this.logDebug("未找到标签所在的分栏，提前返回");
          return null;
        }
        const foundLeaf = (wheeledParent.children || []).find(
          (leaf) => leaf instanceof obsidian2.WorkspaceLeaf && leaf.id === wheeledLeaf.id
        );
        this.logDebug("定位完成", foundLeaf);
        return foundLeaf || null;
      }
      // 判断滚轮事件是否发生在标签头或标签栏容器内。
      // 使用 Element 而非 HTMLElement 判定，兼容标签头内 SVG 图标上触发的滚轮事件。
      checkIsWheelInTabContainer(evt) {
        const targetEl = evt.target instanceof Element ? evt.target : null;
        if (!targetEl) {
          return false;
        }
        return Boolean(targetEl.closest(TAB_HEADER_SELECTOR) || targetEl.closest(TAB_HEADER_CONTAINER_SELECTOR));
      }
      // 切换到指定方向的相邻标签，到达边界时循环，并按配置跳过特定标签。
      gotoSiblingTab(argLeaf, direction, skipOptions) {
        const parentSplit = argLeaf.parentSplit;
        if (!parentSplit || !Array.isArray(parentSplit.children)) {
          return;
        }
        const siblingLeaves = parentSplit.children.filter(
          (item) => item instanceof obsidian2.WorkspaceLeaf
        );
        const index = siblingLeaves.findIndex((leaf) => leaf.id === argLeaf.id);
        if (index === -1) {
          return;
        }
        let targetIndex = index;
        let steps = 0;
        const maxSteps = siblingLeaves.length;
        while (steps < maxSteps) {
          targetIndex += direction;
          if (targetIndex < 0) {
            targetIndex = siblingLeaves.length - 1;
          } else if (targetIndex >= siblingLeaves.length) {
            targetIndex = 0;
          }
          steps++;
          if (!this.shouldSkipLeaf(siblingLeaves[targetIndex], skipOptions)) {
            break;
          }
        }
        this.focusLeaf(siblingLeaves[targetIndex]);
      }
      // 判断目标标签是否需要按配置跳过。
      shouldSkipLeaf(leaf, skipOptions) {
        if (skipOptions.skipCssHiddenTabs && this.isTabHeaderHidden(leaf)) {
          return true;
        }
        if (skipOptions.skipUnloadedPluginTabs && this.isUnloadedPluginLeaf(leaf)) {
          return true;
        }
        return false;
      }
      // 判断标签头是否被 CSS 隐藏（自身或祖先节点 display: none）。
      isTabHeaderHidden(leaf) {
        const tabHeaderEl = leaf ? leaf.tabHeaderEl : null;
        if (!tabHeaderEl) {
          return true;
        }
        return !tabHeaderEl.isShown();
      }
      // 判断标签所属插件是否尚未加载，通过 Obsidian 未知视图使用的幽灵图标识别。
      isUnloadedPluginLeaf(leaf) {
        const iconEl = leaf && leaf.tabHeaderEl ? leaf.tabHeaderEl.find("svg") : null;
        return Boolean(iconEl && iconEl.classList.contains("lucide-ghost"));
      }
      // 激活目标面板并处理搜索视图等需要额外聚焦输入框的特殊情况。
      focusLeaf(leaf) {
        if (!leaf) {
          return;
        }
        this.plugin.app.workspace.setActiveLeaf(leaf, { focus: true });
        if (leaf.getViewState().type === "search") {
          const searchInputEl = leaf.view.containerEl.find(".search-input-container input");
          if (searchInputEl) {
            searchInputEl.focus();
          }
        }
      }
      // 聚焦承载标签的 Electron 窗口，平台不支持时静默跳过。
      focusElectronWindow(win) {
        const electronWindow = win ? win.electronWindow : null;
        if (electronWindow && typeof electronWindow.focus === "function") {
          electronWindow.focus();
        }
      }
      // 返回当前全部工作区面板。
      getAllLeaves() {
        const leaves = [];
        this.plugin.app.workspace.iterateAllLeaves((leaf) => {
          leaves.push(leaf);
        });
        return leaves;
      }
      // 返回当前全部工作区窗口对象，按窗口去重。
      getAllWorkspaceWindows() {
        const windows = /* @__PURE__ */ new Set();
        this.plugin.app.workspace.iterateAllLeaves((leaf) => {
          const container = leaf.getContainer();
          if (container && container.win) {
            windows.add(container.win);
          }
        });
        return Array.from(windows);
      }
      // 返回当前全部工作区分栏，按对象去重。
      getAllWorkspaceParents() {
        const parents = /* @__PURE__ */ new Set();
        this.plugin.app.workspace.iterateAllLeaves((leaf) => {
          if (leaf.parentSplit) {
            parents.add(leaf.parentSplit);
          }
        });
        return Array.from(parents);
      }
      // 调试模式下短暂高亮指定元素，便于确认滚轮命中的标签区域。
      highlightElement(el, colorClass) {
        el.addClass(DEBUG_HIGHLIGHT_CLASS, colorClass);
        window.setTimeout(() => {
          el.removeClass(DEBUG_HIGHLIGHT_CLASS, colorClass);
        }, 300);
      }
      // 调试模式下短暂高亮整个面板，平台不支持时静默跳过。
      highlightLeaf(leaf) {
        if (typeof leaf.highlight === "function" && typeof leaf.unhighlight === "function") {
          leaf.highlight();
          window.setTimeout(() => leaf.unhighlight(), 300);
        }
      }
      // 仅在调试模式开启时输出控制台日志。
      logDebug(...args) {
        if (this.getDebug()) {
          console.debug("[ねね] 标签栏增强", ...args);
        }
      }
      // 返回“空白标签区滚轮切换”开关。
      getTopBarWheelTabSwitch() {
        return this.settings?.topBarWheelTabSwitch === true;
      }
      // 返回“跳过 CSS 隐藏的标签”开关。
      getSkipCssHiddenTabs() {
        return this.settings?.skipCssHiddenTabs !== false;
      }
      // 返回“跳过未加载插件的标签”开关。
      getSkipUnloadedPluginTabs() {
        return this.settings?.skipUnloadedPluginTabs !== false;
      }
      // 返回“调试模式”开关。
      getDebug() {
        return this.settings?.debug === true;
      }
    };
    module2.exports = {
      TabBarEnhancerRuntime
    };
  }
});

// src/modules/tab-bar-enhancer/store.js
var require_store6 = __commonJS({
  "src/modules/tab-bar-enhancer/store.js"(exports2, module2) {
    "use strict";
    var constants = require_constants6();
    var TabBarEnhancerStore = class {
      constructor(plugin) {
        this.plugin = plugin;
        this.settings = this.normalizeSettings();
      }
      // 挂载从独立配置文件读出的设置切片。
      load(settings) {
        this.settings = this.normalizeSettings(settings);
      }
      // 持久化当前标签栏增强配置到独立 JSON 文件。
      async save() {
        this.settings = this.normalizeSettings(this.settings);
        this.plugin.dataStore.setTabBarEnhancerData(this.settings);
        await this.plugin.dataStore.saveTabBarEnhancerData(this.settings);
      }
      // 返回当前完整配置。
      getSettings() {
        return this.settings;
      }
      // 更新“空白标签区滚轮切换”开关。
      async setTopBarWheelTabSwitch(enabled) {
        this.settings.topBarWheelTabSwitch = Boolean(enabled);
        await this.save();
        return this.settings.topBarWheelTabSwitch;
      }
      // 更新“跳过 CSS 隐藏的标签”开关。
      async setSkipCssHiddenTabs(enabled) {
        this.settings.skipCssHiddenTabs = Boolean(enabled);
        await this.save();
        return this.settings.skipCssHiddenTabs;
      }
      // 更新“跳过未加载插件的标签”开关。
      async setSkipUnloadedPluginTabs(enabled) {
        this.settings.skipUnloadedPluginTabs = Boolean(enabled);
        await this.save();
        return this.settings.skipUnloadedPluginTabs;
      }
      // 更新“调试模式”开关。
      async setDebug(enabled) {
        this.settings.debug = Boolean(enabled);
        await this.save();
        return this.settings.debug;
      }
      // 归一化标签栏增强模块配置结构。
      normalizeSettings(settings) {
        const source = settings || constants.DEFAULT_TAB_BAR_ENHANCER_SETTINGS;
        return {
          debug: source.debug === true,
          topBarWheelTabSwitch: source.topBarWheelTabSwitch === true,
          skipCssHiddenTabs: source.skipCssHiddenTabs !== false,
          skipUnloadedPluginTabs: source.skipUnloadedPluginTabs !== false
        };
      }
    };
    module2.exports = {
      TabBarEnhancerStore
    };
  }
});

// src/modules/tab-bar-enhancer/view.js
var require_view4 = __commonJS({
  "src/modules/tab-bar-enhancer/view.js"(exports2, module2) {
    "use strict";
    var obsidian2 = require("obsidian");
    function renderModalHeader(containerEl, title, description) {
      const headerEl = containerEl.createDiv({ cls: "nene-settings-modal-header" });
      headerEl.createDiv({ cls: "nene-settings-modal-title", text: title });
      if (description) {
        headerEl.createEl("p", {
          cls: "nene-settings-modal-description",
          text: description
        });
      }
    }
    function renderDetailItem(containerEl, label, value, codeStyle) {
      const itemEl = containerEl.createDiv({ cls: "nene-settings-detail-item" });
      itemEl.createDiv({ cls: "nene-settings-detail-label", text: label });
      itemEl.createEl(codeStyle ? "code" : "div", {
        cls: "nene-settings-detail-value",
        text: value
      });
    }
    var TabBarEnhancerManagementModal = class extends obsidian2.Modal {
      constructor(app, plugin, onSettingsChanged) {
        super(app);
        this.plugin = plugin;
        this.onSettingsChanged = onSettingsChanged;
      }
      // 打开弹窗时渲染标签栏增强模块详情与配置项。
      onOpen() {
        this.modalEl.addClass("mod-sidebar-layout", "nene-settings-panel-modal");
        this.contentEl.empty();
        this.contentEl.addClass("nene-settings-modal");
        void this.render();
      }
      // 根据当前最新状态渲染标签栏增强模块管理界面。
      async render() {
        const { contentEl } = this;
        const summary = this.plugin.getSettingsSummary();
        const configSummary = await this.plugin.getConfigManagementSummary();
        contentEl.empty();
        renderModalHeader(
          contentEl,
          "标签栏增强模块",
          "该模块支持在标签头或标签栏上滚动鼠标滚轮切换标签：向上滚动切换到左侧标签，向下滚动切换到右侧标签，到达边界后循环。仅面向桌面端。"
        );
        const detailListEl = contentEl.createDiv({ cls: "nene-settings-detail-list" });
        renderDetailItem(detailListEl, "当前状态", summary.tabBarEnhancerEnabled ? "已启用" : "已关闭");
        renderDetailItem(detailListEl, "空白标签区滚轮切换", summary.tabBarEnhancerTopBarWheel ? "已开启" : "已关闭");
        renderDetailItem(detailListEl, "跳过 CSS 隐藏的标签", summary.tabBarEnhancerSkipCssHiddenTabs ? "已开启" : "已关闭");
        renderDetailItem(detailListEl, "跳过未加载插件的标签", summary.tabBarEnhancerSkipUnloadedPluginTabs ? "已开启" : "已关闭");
        renderDetailItem(detailListEl, "调试模式", summary.tabBarEnhancerDebug ? "已开启" : "已关闭");
        renderDetailItem(detailListEl, "配置文件", configSummary.tabBarEnhancer.path, true);
        new obsidian2.Setting(contentEl).setName("空白标签区滚轮切换（实验性）").setDesc("允许在标签栏的空白区域滚动滚轮切换标签。注意：当窗口框架样式为“隐藏”时，开启后该空白区域将无法用于拖拽移动窗口。").addToggle((toggle) => {
          toggle.setValue(summary.tabBarEnhancerTopBarWheel).onChange(async (value) => {
            await this.plugin.updateTabBarEnhancerTopBarWheel(value);
            new obsidian2.Notice(value ? "已开启空白标签区滚轮切换" : "已关闭空白标签区滚轮切换");
            await this.onSettingsChanged();
            await this.render();
          });
        });
        new obsidian2.Setting(contentEl).setName("跳过 CSS 隐藏的标签").setDesc("切换标签时跳过被 CSS 隐藏（display: none）的标签头。").addToggle((toggle) => {
          toggle.setValue(summary.tabBarEnhancerSkipCssHiddenTabs).onChange(async (value) => {
            await this.plugin.updateTabBarEnhancerSkipCssHiddenTabs(value);
            new obsidian2.Notice(value ? "切换时将跳过 CSS 隐藏的标签" : "切换时不再跳过 CSS 隐藏的标签");
            await this.onSettingsChanged();
            await this.render();
          });
        });
        new obsidian2.Setting(contentEl).setName("跳过未加载插件的标签").setDesc("切换标签时跳过所属插件尚未加载的标签。").addToggle((toggle) => {
          toggle.setValue(summary.tabBarEnhancerSkipUnloadedPluginTabs).onChange(async (value) => {
            await this.plugin.updateTabBarEnhancerSkipUnloadedPluginTabs(value);
            new obsidian2.Notice(value ? "切换时将跳过未加载插件的标签" : "切换时不再跳过未加载插件的标签");
            await this.onSettingsChanged();
            await this.render();
          });
        });
        new obsidian2.Setting(contentEl).setName("调试模式").setDesc("在控制台输出调试日志，并短暂高亮滚轮命中的标签元素，仅排查问题时开启。").addToggle((toggle) => {
          toggle.setValue(summary.tabBarEnhancerDebug).onChange(async (value) => {
            await this.plugin.updateTabBarEnhancerDebug(value);
            new obsidian2.Notice(value ? "已开启标签栏增强调试模式" : "已关闭标签栏增强调试模式");
            await this.onSettingsChanged();
            await this.render();
          });
        });
      }
      // 关闭弹窗时清理内容，避免重复挂载旧节点。
      onClose() {
        this.contentEl.empty();
      }
    };
    module2.exports = {
      TabBarEnhancerManagementModal
    };
  }
});

// src/modules/tab-bar-enhancer/index.js
var require_tab_bar_enhancer = __commonJS({
  "src/modules/tab-bar-enhancer/index.js"(exports2, module2) {
    "use strict";
    var constants = require_constants6();
    var runtime = require_runtime2();
    var store = require_store6();
    var view = require_view4();
    module2.exports = Object.assign({}, constants, runtime, store, view);
  }
});

// src/modules/context-menu-enhancer/runtime.js
var require_runtime3 = __commonJS({
  "src/modules/context-menu-enhancer/runtime.js"(exports2, module2) {
    "use strict";
    var obsidian2 = require("obsidian");
    var constants = require_constants4();
    var MenuCustomizerRuntime = class {
      constructor(plugin) {
        this.plugin = plugin;
        this.settings = constants.createDefaultMenuCustomizerSettings();
        this.originalShowAtMouseEvent = null;
        this.originalShowAtPosition = null;
        this.isPatched = false;
      }
      // 挂载最新配置，供显示菜单前即时读取。
      load(settings) {
        this.settings = settings || constants.createDefaultMenuCustomizerSettings();
      }
      // 启动菜单拦截。
      start() {
        if (this.isPatched) {
          return;
        }
        this.patchMenuMethods();
      }
      // 停止菜单拦截并恢复原始方法。
      stop() {
        if (this.originalShowAtMouseEvent) {
          obsidian2.Menu.prototype.showAtMouseEvent = this.originalShowAtMouseEvent;
        }
        if (this.originalShowAtPosition) {
          obsidian2.Menu.prototype.showAtPosition = this.originalShowAtPosition;
        }
        this.originalShowAtMouseEvent = null;
        this.originalShowAtPosition = null;
        this.isPatched = false;
      }
      // 为文件或文件夹菜单打上上下文标记，提升识别稳定性。
      annotateFileMenu(menu, file) {
        if (!menu) {
          return;
        }
        menu.__neneMenuContext = {
          source: "file-menu",
          fileKind: file instanceof obsidian2.TFolder ? "folder" : file instanceof obsidian2.TFile ? "file" : "abstract"
        };
      }
      // 为编辑区菜单打上上下文标记，便于区分右键菜单与更多选项菜单。
      annotateEditorMenu(menu) {
        if (!menu) {
          return;
        }
        menu.__neneMenuContext = {
          source: "editor-menu"
        };
      }
      // 拦截菜单显示方法，在真正显示前先重构 DOM。
      patchMenuMethods() {
        const runtime = this;
        this.originalShowAtMouseEvent = obsidian2.Menu.prototype.showAtMouseEvent;
        this.originalShowAtPosition = obsidian2.Menu.prototype.showAtPosition;
        if (typeof this.originalShowAtMouseEvent === "function") {
          obsidian2.Menu.prototype.showAtMouseEvent = function wrappedShowAtMouseEvent(event) {
            runtime.onBeforeMenuShow(this);
            const result = runtime.originalShowAtMouseEvent.call(this, event);
            runtime.onAfterMenuShow(this);
            return result;
          };
        }
        if (typeof this.originalShowAtPosition === "function") {
          obsidian2.Menu.prototype.showAtPosition = function wrappedShowAtPosition(position) {
            runtime.onBeforeMenuShow(this);
            const result = runtime.originalShowAtPosition.call(this, position);
            runtime.onAfterMenuShow(this);
            return result;
          };
        }
        this.isPatched = true;
      }
      // 在菜单显示前应用当前配置，失败时自动回退到原始菜单。
      onBeforeMenuShow(menu) {
        if (!menu || menu.__neneSkipCustomize || menu.__neneMenuCustomized) {
          return;
        }
        const menuType = this.detectMenuType(menu);
        if (!menuType) {
          return;
        }
        const menuConfig = this.settings.menus?.[menuType];
        if (!menuConfig || menuConfig.enabled !== true) {
          return;
        }
        try {
          this.rebuildMenu(menu, menuType, menuConfig);
          menu.__neneMenuCustomized = true;
        } catch (error) {
          console.error("[ねね] 右键菜单重构失败", error);
        }
      }
      // 在 Obsidian 完成真实菜单渲染后，再包装图标组/网格组，避免被内部重排抹平。
      onAfterMenuShow(menu) {
        if (!menu?.dom || menu.__neneSkipCustomize !== true && menu.__neneMenuCustomized !== true) {
          return;
        }
        window.requestAnimationFrame(() => {
          this.wrapRenderedGroups(menu);
        });
      }
      // 根据上下文和标题特征识别当前菜单类型。
      detectMenuType(menu) {
        const context = menu.__neneMenuContext || {};
        if (context.fileKind === "folder") {
          return "folder";
        }
        if (context.fileKind === "file") {
          return "file";
        }
        const entries = this.collectMenuEntries(menu, null);
        const titles = entries.map((entry) => entry.title);
        const normalizedTitleSet = new Set(titles.map((title) => this.normalizeText(title)));
        const hasEditSection = entries.some((entry) => entry.section === "edit");
        if (hasEditSection && (normalizedTitleSet.has(this.normalizeText("剪切")) || normalizedTitleSet.has(this.normalizeText("Cut")) || normalizedTitleSet.has(this.normalizeText("复制")) || normalizedTitleSet.has(this.normalizeText("Copy")))) {
          return "editor";
        }
        if (context.source === "editor-menu") {
          return "moreOptions";
        }
        if (normalizedTitleSet.has(this.normalizeText("新建笔记")) || normalizedTitleSet.has(this.normalizeText("New note")) || normalizedTitleSet.has(this.normalizeText("新建文件夹")) || normalizedTitleSet.has(this.normalizeText("New folder"))) {
          return "folder";
        }
        if (normalizedTitleSet.has(this.normalizeText("打开")) || normalizedTitleSet.has(this.normalizeText("Open")) || normalizedTitleSet.has(this.normalizeText("打开链接")) || normalizedTitleSet.has(this.normalizeText("Open link")) || normalizedTitleSet.has(this.normalizeText("重命名")) || normalizedTitleSet.has(this.normalizeText("Rename"))) {
          return "file";
        }
        return null;
      }
      // 按配置重排菜单内容；根级结构严格按设置渲染，未配置项统一后置。
      rebuildMenu(menu, menuType, menuConfig) {
        if (!menu.dom || !Array.isArray(menu.items)) {
          return;
        }
        const collectedEntries = this.collectMenuEntries(menu, menuType);
        const recognizedByCommandId = /* @__PURE__ */ new Map();
        const orderedConfiguredCommandIds = this.getOrderedConfiguredCommandIds(menuConfig);
        const nextRootItems = [];
        const renderedCommandIds = /* @__PURE__ */ new Set();
        const menuEl = menu.dom;
        collectedEntries.forEach((entry) => {
          if (!entry.commandId) {
            return;
          }
          const override = menuConfig.commandOverrides?.[entry.commandId];
          this.applyItemOverride(entry.item, override);
          if (override?.hidden === true || recognizedByCommandId.has(entry.commandId)) {
            return;
          }
          recognizedByCommandId.set(entry.commandId, entry);
        });
        menuEl.empty();
        let hasConfiguredContent = false;
        const groupsById = new Map(menuConfig.groups.map((group) => [group.id, group]));
        menuConfig.rootItems.forEach((rootItem) => {
          if (rootItem.type === "separator") {
            if (rootItem.hidden === true) {
              return;
            }
            this.appendSeparator(menuEl);
            return;
          }
          if (rootItem.type === "group") {
            const group = groupsById.get(rootItem.groupId);
            const rendered = this.renderConfiguredGroup(
              menu,
              menuEl,
              group,
              recognizedByCommandId,
              renderedCommandIds,
              nextRootItems,
              menuType,
              menuConfig
            );
            hasConfiguredContent = hasConfiguredContent || rendered;
            return;
          }
          if (rootItem.type === "command") {
            if (rootItem.hidden === true) {
              return;
            }
            const rendered = this.renderConfiguredCommand(
              menu,
              menuEl,
              menuType,
              rootItem.commandId,
              recognizedByCommandId,
              renderedCommandIds,
              nextRootItems,
              menuConfig
            );
            hasConfiguredContent = hasConfiguredContent || rendered;
          }
        });
        const leftoverEntries = collectedEntries.filter((entry) => {
          if (!entry.commandId) {
            return true;
          }
          const override = menuConfig.commandOverrides?.[entry.commandId];
          if (override?.hidden === true) {
            return false;
          }
          if (renderedCommandIds.has(entry.commandId)) {
            return false;
          }
          if (orderedConfiguredCommandIds.has(entry.commandId)) {
            return false;
          }
          return true;
        }).sort((left, right) => left.order - right.order);
        if (hasConfiguredContent && leftoverEntries.length > 0) {
          this.appendSeparator(menuEl);
        }
        leftoverEntries.forEach((entry) => {
          this.prepareRenderedItem(entry.item, entry.commandId, "list", null, null, "nene-tail");
          menuEl.appendChild(entry.item.dom);
          nextRootItems.push(entry.item);
          if (entry.commandId) {
            renderedCommandIds.add(entry.commandId);
          }
        });
        this.cleanupSeparators(menuEl);
        this.applyMenuClasses(menuEl, menuType);
        menu.items = nextRootItems;
      }
      // 收集菜单项并尽量解析出稳定命令标识。
      collectMenuEntries(menu, menuType) {
        const items = Array.isArray(menu.items) ? menu.items : [];
        return items.map((item, order) => {
          if (!item || !item.dom) {
            return null;
          }
          const title = this.getItemTitle(item);
          const section = this.getItemSection(item);
          const explicitCommandId = this.getExplicitCommandId(item);
          const commandId = explicitCommandId || this.resolveCommandId(title, section, menuType);
          return {
            item,
            title,
            section,
            order,
            commandId
          };
        }).filter(Boolean);
      }
      // 返回已被“排序结构”显式配置过的命令集合。
      getOrderedConfiguredCommandIds(menuConfig) {
        const commandIds = /* @__PURE__ */ new Set();
        menuConfig.groups.forEach((group) => {
          group.commands.forEach((commandId) => commandIds.add(commandId));
        });
        menuConfig.rootItems.forEach((item) => {
          if (item.type === "command" && item.commandId) {
            commandIds.add(item.commandId);
          }
        });
        return commandIds;
      }
      // 渲染根级分组。
      renderConfiguredGroup(menu, menuEl, group, recognizedByCommandId, renderedCommandIds, nextRootItems, menuType, menuConfig) {
        if (!group || group.hidden === true) {
          return false;
        }
        const groupEntries = [];
        group.commands.forEach((commandId) => {
          if (renderedCommandIds.has(commandId)) {
            return;
          }
          const override = menuConfig.commandOverrides?.[commandId];
          if (override?.hidden === true) {
            return;
          }
          const entry = recognizedByCommandId.get(commandId) || this.createSyntheticCommandEntry(menu, menuType, commandId, override);
          if (!entry) {
            return;
          }
          groupEntries.push(entry);
        });
        if (groupEntries.length === 0) {
          return false;
        }
        if (this.shouldRenderAsSubmenu(group, groupEntries)) {
          const parentItem = this.createSubmenuParent(menu, group, groupEntries, menuType);
          if (!parentItem) {
            return false;
          }
          this.prepareRenderedItem(parentItem, null, "list", null, null, "nene-configured");
          menuEl.appendChild(parentItem.dom);
          nextRootItems.push(parentItem);
          groupEntries.forEach((entry) => renderedCommandIds.add(entry.commandId));
          return true;
        }
        groupEntries.forEach((entry) => {
          this.prepareRenderedItem(
            entry.item,
            entry.commandId,
            group.layout,
            group.id,
            group.layout,
            "nene-configured"
          );
          menuEl.appendChild(entry.item.dom);
          nextRootItems.push(entry.item);
          renderedCommandIds.add(entry.commandId);
        });
        return true;
      }
      // 渲染根级单命令。
      renderConfiguredCommand(menu, menuEl, menuType, commandId, recognizedByCommandId, renderedCommandIds, nextRootItems, menuConfig) {
        if (!commandId || renderedCommandIds.has(commandId)) {
          return false;
        }
        const override = menuConfig.commandOverrides?.[commandId];
        if (override?.hidden === true) {
          return false;
        }
        const entry = recognizedByCommandId.get(commandId) || this.createSyntheticCommandEntry(menu, menuType, commandId, override);
        if (!entry) {
          return false;
        }
        this.prepareRenderedItem(entry.item, entry.commandId, "list", null, null, "nene-configured");
        menuEl.appendChild(entry.item.dom);
        nextRootItems.push(entry.item);
        renderedCommandIds.add(entry.commandId);
        return true;
      }
      // 返回菜单项当前标题文本。
      getItemTitle(item) {
        if (item.titleEl && typeof item.titleEl.textContent === "string") {
          return item.titleEl.textContent.trim();
        }
        const titleEl = item.dom?.querySelector(".menu-item-title");
        return typeof titleEl?.textContent === "string" ? titleEl.textContent.trim() : "";
      }
      // 返回菜单项的分区标识。
      getItemSection(item) {
        if (typeof item.section === "string" && item.section.trim()) {
          return item.section.trim();
        }
        const domSection = item.dom?.getAttribute("data-section");
        return typeof domSection === "string" ? domSection.trim() : "";
      }
      // 读取菜单项内部可能已存在的命令 ID，兼容第三方插件命令。
      getExplicitCommandId(item) {
        const candidates = [
          item.commandId,
          item.id,
          item.command?.id,
          item.command?.commandId,
          item.dom?.dataset?.commandId,
          typeof item.dom?.getAttribute === "function" ? item.dom.getAttribute("data-command-id") : ""
        ];
        for (const candidate of candidates) {
          if (typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
          }
        }
        return "";
      }
      // 根据“手动映射 + 初始内置数据”严格识别无显式 commandId 的菜单项。
      resolveCommandId(title, section, menuType) {
        if (!menuType) {
          return "";
        }
        return this.plugin.menuCustomizerStore?.resolveMappedCommandId(menuType, title, section) || "";
      }
      // 判断当前菜单分组是否应该渲染为子菜单。
      shouldRenderAsSubmenu(group, groupEntries) {
        if (group.layout === "icon-bar" || group.layout === "grid") {
          return false;
        }
        return group.forceSubmenu === true || groupEntries.length > 1;
      }
      // 应用标题与图标覆盖配置。
      applyItemOverride(item, override) {
        if (!override) {
          return;
        }
        if (override.title) {
          if (typeof item.setTitle === "function") {
            item.setTitle(override.title);
          }
          if (item.titleEl) {
            item.titleEl.setText?.(override.title);
            if (typeof item.titleEl.textContent === "string") {
              item.titleEl.textContent = override.title;
            }
          }
        }
        if (override.icon) {
          const iconEl = item.dom?.querySelector(".menu-item-icon");
          if (iconEl) {
            iconEl.empty?.();
            obsidian2.setIcon(iconEl, override.icon);
          } else if (typeof item.setIcon === "function") {
            item.setIcon(override.icon);
          }
        }
      }
      // 创建子菜单父项，并将命令节点直接移动到子菜单 DOM 中。
      createSubmenuParent(menu, group, groupEntries, menuType) {
        let parentItem = null;
        menu.addItem((item) => {
          parentItem = item;
          item.setTitle(group.name || "未命名分组");
          if (group.icon && typeof item.setIcon === "function") {
            item.setIcon(group.icon);
          }
          if (typeof item.setSubmenu !== "function") {
            return;
          }
          const submenu = item.setSubmenu();
          submenu.__neneSkipCustomize = true;
          submenu.__neneMenuContext = {
            source: "nene-submenu",
            menuType
          };
          submenu.items = [];
          submenu.dom.empty();
          groupEntries.forEach((entry) => {
            this.prepareRenderedItem(entry.item, entry.commandId, "list", null, null, "nene-submenu");
            submenu.items.push(entry.item);
            submenu.dom.appendChild(entry.item.dom);
          });
        });
        if (!parentItem || typeof parentItem.setSubmenu !== "function") {
          parentItem?.dom?.remove();
          return null;
        }
        parentItem.dom.classList.add("nene-menu-submenu-parent");
        return parentItem;
      }
      // 为不存在于原始右键菜单中的命令创建可执行的菜单项。
      createSyntheticCommandEntry(menu, menuType, commandId, override) {
        const metadata = this.plugin.menuCustomizerStore?.getCommandMetadata(menuType, commandId);
        if (!metadata || metadata.canExecute !== true) {
          return null;
        }
        let syntheticItem = null;
        menu.addItem((item) => {
          syntheticItem = item;
          item.setTitle(override?.title || metadata.label || commandId);
          if (override?.icon) {
            item.setIcon(override.icon);
          } else if (metadata.icon) {
            item.setIcon(metadata.icon);
          }
          item.onClick(() => {
            this.executeRegisteredCommand(commandId);
          });
        });
        if (!syntheticItem || !syntheticItem.dom) {
          return null;
        }
        if (Array.isArray(metadata.sections) && metadata.sections.length > 0) {
          syntheticItem.dom.setAttribute("data-section", metadata.sections[0]);
        }
        syntheticItem.commandId = commandId;
        return {
          item: syntheticItem,
          title: override?.title || metadata.label || commandId,
          section: Array.isArray(metadata.sections) ? metadata.sections[0] || "" : "",
          order: Number.MAX_SAFE_INTEGER,
          commandId
        };
      }
      // 执行命令注册表中的命令，失败时提示用户。
      executeRegisteredCommand(commandId) {
        const executor = this.plugin.app?.commands?.executeCommandById;
        if (typeof executor !== "function") {
          new obsidian2.Notice(`当前环境无法执行命令：${commandId}`);
          return;
        }
        try {
          const executed = executor.call(this.plugin.app.commands, commandId);
          if (executed === false) {
            new obsidian2.Notice(`命令未执行：${commandId}`);
          }
        } catch (error) {
          console.error("[ねね] 执行右键菜单命令失败", commandId, error);
          new obsidian2.Notice(`命令执行失败：${commandId}`);
        }
      }
      // 给已渲染的菜单项打上布局类与命令标识类，供样式层复用。
      prepareRenderedItem(item, commandId, layout, groupId, groupLayout, sectionName) {
        if (!item?.dom) {
          return;
        }
        const layoutClassNames = [
          "nene-menu-item--icon-bar",
          "nene-menu-item--grid"
        ];
        layoutClassNames.forEach((className) => item.dom.classList.remove(className));
        item.dom.classList.add("nene-menu-item");
        if (layout === "icon-bar") {
          item.dom.classList.add("nene-menu-item--icon-bar");
        } else if (layout === "grid") {
          item.dom.classList.add("nene-menu-item--grid");
        }
        if (typeof item.dom.setAttribute === "function") {
          item.dom.setAttribute("data-nene-command-id", commandId || "");
          if (groupId) {
            item.dom.setAttribute("data-nene-group-id", groupId);
          } else {
            item.dom.removeAttribute("data-nene-group-id");
          }
          if (groupLayout) {
            item.dom.setAttribute("data-nene-group-layout", groupLayout);
          } else {
            item.dom.removeAttribute("data-nene-group-layout");
          }
          if (sectionName) {
            item.dom.setAttribute("data-section", sectionName);
          }
        }
        if (sectionName) {
          item.section = sectionName;
        }
      }
      // 在真实菜单 DOM 上把连续的图标组/网格组重新包成独立容器。
      wrapRenderedGroups(menu) {
        const menuEl = menu?.dom;
        if (!menuEl) {
          return;
        }
        this.unwrapRenderedGroups(menuEl);
        const children = Array.from(menuEl.children);
        let activeGroupId = "";
        let activeLayout = "";
        let activeNodes = [];
        const flushGroup = () => {
          if (activeNodes.length === 0 || !activeGroupId || !this.shouldWrapGroupLayout(activeLayout)) {
            activeGroupId = "";
            activeLayout = "";
            activeNodes = [];
            return;
          }
          const wrapperEl = document.createElement("div");
          wrapperEl.className = `nene-menu-group-wrapper nene-menu-group-wrapper--${activeLayout}`;
          wrapperEl.setAttribute("data-nene-group-id", activeGroupId);
          menuEl.insertBefore(wrapperEl, activeNodes[0]);
          activeNodes.forEach((node) => {
            wrapperEl.appendChild(node);
          });
          activeGroupId = "";
          activeLayout = "";
          activeNodes = [];
        };
        children.forEach((childEl) => {
          if (!childEl.classList.contains("menu-item")) {
            flushGroup();
            return;
          }
          const groupId = childEl.getAttribute("data-nene-group-id") || "";
          const groupLayout = childEl.getAttribute("data-nene-group-layout") || "";
          if (!groupId || !this.shouldWrapGroupLayout(groupLayout)) {
            flushGroup();
            return;
          }
          if (!activeGroupId || activeGroupId === groupId && activeLayout === groupLayout) {
            activeGroupId = groupId;
            activeLayout = groupLayout;
            activeNodes.push(childEl);
            return;
          }
          flushGroup();
          activeGroupId = groupId;
          activeLayout = groupLayout;
          activeNodes.push(childEl);
        });
        flushGroup();
      }
      // 清理旧的分组包装层，避免重复包裹。
      unwrapRenderedGroups(menuEl) {
        const wrappers = Array.from(menuEl.querySelectorAll(":scope > .nene-menu-group-wrapper"));
        wrappers.forEach((wrapperEl) => {
          while (wrapperEl.firstChild) {
            menuEl.insertBefore(wrapperEl.firstChild, wrapperEl);
          }
          wrapperEl.remove();
        });
      }
      // 只有图标组与网格组需要外层容器。
      shouldWrapGroupLayout(layout) {
        return layout === "icon-bar" || layout === "grid";
      }
      // 为菜单根节点添加类型与布局类，替代原有复杂的 :has CSS。
      applyMenuClasses(menuEl, menuType) {
        const rootClassNames = [
          "nene-menu-customizer-menu",
          "nene-menu-type--editor",
          "nene-menu-type--moreOptions",
          "nene-menu-type--file",
          "nene-menu-type--folder",
          "nene-menu-layout--icon-bar",
          "nene-menu-layout--grid"
        ];
        rootClassNames.forEach((className) => menuEl.classList.remove(className));
        menuEl.classList.add("nene-menu-customizer-menu", `nene-menu-type--${menuType}`);
        const iconBarItems = menuEl.querySelectorAll(".nene-menu-item--icon-bar");
        const gridItems = menuEl.querySelectorAll(".nene-menu-item--grid");
        if (iconBarItems.length > 0) {
          menuEl.classList.add("nene-menu-layout--icon-bar");
          menuEl.setAttribute("data-nene-icon-bar-count", String(iconBarItems.length));
        } else {
          menuEl.removeAttribute("data-nene-icon-bar-count");
        }
        if (gridItems.length > 0) {
          menuEl.classList.add("nene-menu-layout--grid");
        }
      }
      // 仅在需要时补一个分隔符，避免连续空分隔。
      appendSeparator(menuEl) {
        const lastChild = menuEl.lastElementChild;
        if (!lastChild) {
          return;
        }
        if (lastChild.classList.contains("menu-separator")) {
          return;
        }
        const separatorEl = document.createElement("div");
        separatorEl.className = "menu-separator";
        menuEl.appendChild(separatorEl);
      }
      // 清理首尾与连续分隔符，确保最终菜单结构干净。
      cleanupSeparators(menuEl) {
        const children = Array.from(menuEl.children);
        let previousWasSeparator = true;
        children.forEach((childEl) => {
          const currentIsSeparator = childEl.classList.contains("menu-separator");
          if (currentIsSeparator && previousWasSeparator) {
            childEl.remove();
            return;
          }
          previousWasSeparator = currentIsSeparator;
        });
        const lastChild = menuEl.lastElementChild;
        if (lastChild?.classList.contains("menu-separator")) {
          lastChild.remove();
        }
      }
      // 统一做标题归一化，降低中英文与空白差异带来的识别误差。
      normalizeText(value) {
        return typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, " ") : "";
      }
    };
    module2.exports = {
      MenuCustomizerRuntime
    };
  }
});

// src/modules/context-menu-enhancer/store.js
var require_store7 = __commonJS({
  "src/modules/context-menu-enhancer/store.js"(exports2, module2) {
    "use strict";
    var constants = require_constants4();
    var MenuCustomizerStore = class {
      constructor(plugin) {
        this.plugin = plugin;
        this.settings = this.normalizeSettings();
      }
      // 挂载从独立配置文件读出的设置切片。
      load(settings) {
        this.settings = this.normalizeSettings(settings);
      }
      // 持久化当前右键菜单配置到独立 JSON 文件。
      async save() {
        this.settings = this.normalizeSettings(this.settings);
        this.plugin.dataStore.setMenuCustomizerData(this.settings);
        await this.plugin.dataStore.saveMenuCustomizerData(this.settings);
        if (this.plugin.menuCustomizerRuntime && typeof this.plugin.menuCustomizerRuntime.load === "function") {
          this.plugin.menuCustomizerRuntime.load(this.settings);
        }
      }
      // 返回当前完整的右键菜单配置。
      getSettings() {
        return this.settings;
      }
      // 返回指定菜单类型的配置，不存在时回退到默认值。
      getMenuConfig(menuType) {
        return this.settings.menus[menuType] || this.normalizeMenuConfig(menuType);
      }
      // 返回按根级结构顺序排序后的分组列表，保证设置页展示顺序与运行时一致。
      getOrderedGroups(menuType) {
        const menuConfig = this.getMenuConfig(menuType);
        const groupsById = new Map(menuConfig.groups.map((group) => [group.id, group]));
        const orderedGroups = [];
        const seenGroupIds = /* @__PURE__ */ new Set();
        menuConfig.rootItems.forEach((item) => {
          if (item.type !== "group") {
            return;
          }
          const group = groupsById.get(item.groupId);
          if (!group || seenGroupIds.has(group.id)) {
            return;
          }
          seenGroupIds.add(group.id);
          orderedGroups.push(group);
        });
        menuConfig.groups.forEach((group) => {
          if (seenGroupIds.has(group.id)) {
            return;
          }
          seenGroupIds.add(group.id);
          orderedGroups.push(group);
        });
        return orderedGroups;
      }
      // 返回指定菜单类型的根级结构项，供设置页与运行时共用。
      getMenuRootItems(menuType) {
        return this.getMenuConfig(menuType).rootItems.slice();
      }
      // 返回设置页可展示的菜单类型列表。
      getMenuTypeOptions() {
        return constants.MENU_TYPE_OPTIONS.slice();
      }
      // 返回设置页可选的布局类型列表。
      getLayoutOptions() {
        return constants.GROUP_LAYOUT_OPTIONS.slice();
      }
      // 返回指定菜单类型下的手动映射列表。
      getMenuCommandMappings(menuType) {
        return this.getMenuConfig(menuType).commandMappings.slice();
      }
      // 返回当前 Obsidian 已注册的全部命令，供新增菜单命令时校验和选择。
      getRegisteredCommands() {
        const commandRegistry = this.plugin.app?.commands?.commands;
        if (!commandRegistry || typeof commandRegistry !== "object") {
          return [];
        }
        return Object.values(commandRegistry).filter((command) => command && typeof command.id === "string" && command.id.trim()).map((command) => ({
          id: command.id.trim(),
          label: typeof command.name === "string" && command.name.trim() ? command.name.trim() : command.id.trim(),
          icon: typeof command.icon === "string" ? command.icon.trim() : "",
          aliases: [],
          sections: [],
          source: "registered",
          canExecute: true
        })).sort((left, right) => left.label.localeCompare(right.label, "zh-CN"));
      }
      // 判断某个命令是否存在于当前命令注册表。
      isRegisteredCommand(commandId) {
        const normalizedCommandId = typeof commandId === "string" ? commandId.trim() : "";
        if (!normalizedCommandId) {
          return false;
        }
        return this.getRegisteredCommands().some((command) => command.id === normalizedCommandId);
      }
      // 返回某个命令在指定菜单类型下的元信息，优先采用手动映射中的真实菜单标题。
      getCommandMetadata(menuType, commandId) {
        const normalizedCommandId = typeof commandId === "string" ? commandId.trim() : "";
        if (!normalizedCommandId) {
          return null;
        }
        const mappings = this.getCommandMappingsForCommand(menuType, normalizedCommandId);
        const preferredMapping = mappings.find((mapping) => mapping.title) || null;
        const builtinMetadata = constants.getBuiltinCommandMetadata(menuType, normalizedCommandId);
        const registeredCommand = this.getRegisteredCommands().find((item) => item.id === normalizedCommandId) || null;
        if (!preferredMapping && !builtinMetadata && !registeredCommand) {
          return null;
        }
        return {
          id: normalizedCommandId,
          label: preferredMapping?.title || builtinMetadata?.label || registeredCommand?.label || normalizedCommandId,
          icon: builtinMetadata?.icon || registeredCommand?.icon || "",
          aliases: Array.from(new Set([
            ...mappings.map((mapping) => mapping.title),
            ...builtinMetadata?.aliases || []
          ].filter(Boolean))),
          sections: Array.from(new Set([
            ...mappings.map((mapping) => mapping.section),
            ...builtinMetadata?.sections || []
          ].filter(Boolean))),
          source: preferredMapping ? registeredCommand ? "mapped-registered" : builtinMetadata ? "mapped-builtin" : "mapped" : builtinMetadata ? registeredCommand ? "builtin-registered" : "builtin" : "registered",
          canExecute: Boolean(registeredCommand)
        };
      }
      // 返回当前菜单类型可供新增的具体命令列表，完全来自 Obsidian 命令注册表。
      getAddableCommands() {
        return this.getRegisteredCommands();
      }
      // 返回指定菜单类型当前“可配置”的命令集合，仅包含已配置或已映射的命令。
      getAvailableCommands(menuType) {
        const commandIds = /* @__PURE__ */ new Set();
        const menuConfig = this.getMenuConfig(menuType);
        menuConfig.groups.forEach((group) => {
          group.commands.forEach((commandId) => commandIds.add(commandId));
        });
        menuConfig.rootItems.forEach((item) => {
          if (item.type === "command" && item.commandId) {
            commandIds.add(item.commandId);
          }
        });
        Object.keys(menuConfig.commandOverrides).forEach((commandId) => commandIds.add(commandId));
        menuConfig.commandMappings.forEach((mapping) => {
          if (mapping.commandId) {
            commandIds.add(mapping.commandId);
          }
        });
        return Array.from(commandIds).map((commandId) => {
          const metadata = this.getCommandMetadata(menuType, commandId);
          return {
            id: commandId,
            label: metadata?.label || commandId,
            icon: metadata?.icon || "",
            aliases: metadata?.aliases || [],
            sections: metadata?.sections || [],
            source: metadata?.source || "configured",
            canExecute: metadata?.canExecute === true
          };
        }).sort((left, right) => left.label.localeCompare(right.label, "zh-CN"));
      }
      // 返回指定命令在设置页中应展示的名称。
      getCommandLabel(menuType, commandId) {
        const metadata = this.getCommandMetadata(menuType, commandId);
        return metadata?.label || commandId;
      }
      // 返回模块中已启用的菜单数量，供设置页摘要显示。
      getEnabledMenuCount() {
        return constants.MENU_TYPE_OPTIONS.filter((menuType) => {
          return this.getMenuConfig(menuType.id).enabled;
        }).length;
      }
      // 返回全部分组数量，供设置页摘要显示。
      getGroupCount() {
        return constants.MENU_TYPE_OPTIONS.reduce((count, menuType) => {
          return count + this.getMenuConfig(menuType.id).groups.length;
        }, 0);
      }
      // 切换某个菜单类型的启用状态。
      async setMenuEnabled(menuType, enabled) {
        this.ensureMenuConfig(menuType);
        this.settings.menus[menuType].enabled = Boolean(enabled);
        await this.save();
        return this.getMenuConfig(menuType).enabled;
      }
      // 新增一个空分组，并自动挂到根级结构末尾。
      async addGroup(menuType) {
        this.ensureMenuConfig(menuType);
        const menuConfig = this.settings.menus[menuType];
        const group = this.createGroup(menuType);
        menuConfig.groups.push(group);
        menuConfig.rootItems.push(this.createRootItem("group", { groupId: group.id }));
        this.alignGroupOrderWithRootItems(menuConfig);
        await this.save();
      }
      // 删除指定索引的分组，并同步移除对应的根级结构引用。
      async removeGroup(menuType, groupIndex) {
        this.ensureMenuConfig(menuType);
        const menuConfig = this.settings.menus[menuType];
        const targetGroup = menuConfig.groups[groupIndex];
        if (!targetGroup) {
          return;
        }
        menuConfig.groups.splice(groupIndex, 1);
        menuConfig.rootItems = menuConfig.rootItems.filter((item) => {
          return item.type !== "group" || item.groupId !== targetGroup.id;
        });
        this.alignGroupOrderWithRootItems(menuConfig);
        await this.save();
      }
      // 更新分组属性，统一经过归一化，保证结构稳定。
      async updateGroup(menuType, groupIndex, patch) {
        this.ensureMenuConfig(menuType);
        const menuConfig = this.settings.menus[menuType];
        const currentGroup = menuConfig.groups[groupIndex];
        if (!currentGroup) {
          return;
        }
        menuConfig.groups[groupIndex] = this.normalizeGroup(
          menuType,
          Object.assign({}, currentGroup, patch)
        );
        this.alignGroupOrderWithRootItems(menuConfig);
        await this.save();
      }
      // 调整分组在根级结构中的顺序，保证设置页与运行时顺序一致。
      async moveGroup(menuType, groupIndex, offset) {
        this.ensureMenuConfig(menuType);
        const menuConfig = this.settings.menus[menuType];
        const targetGroup = menuConfig.groups[groupIndex];
        if (!targetGroup) {
          return;
        }
        const rootItemIndex = this.getGroupRootItemIndex(menuConfig, targetGroup.id);
        if (rootItemIndex === -1) {
          return;
        }
        if (!this.moveArrayItem(menuConfig.rootItems, rootItemIndex, offset)) {
          return;
        }
        this.alignGroupOrderWithRootItems(menuConfig);
        await this.save();
      }
      // 往指定分组中追加命令，自动去重，避免重复渲染。
      async addCommandToGroup(menuType, groupIndex, commandId) {
        this.ensureMenuConfig(menuType);
        const menuConfig = this.settings.menus[menuType];
        const targetGroup = menuConfig.groups[groupIndex];
        const normalizedCommandId = typeof commandId === "string" ? commandId.trim() : "";
        if (!targetGroup || !normalizedCommandId) {
          return {
            success: false,
            reason: "empty"
          };
        }
        if (!this.getCommandMetadata(menuType, normalizedCommandId)) {
          return {
            success: false,
            reason: "missing"
          };
        }
        if (targetGroup.commands.includes(normalizedCommandId)) {
          return {
            success: false,
            reason: "duplicate"
          };
        }
        targetGroup.commands.push(normalizedCommandId);
        await this.save();
        return {
          success: true,
          reason: "added"
        };
      }
      // 从分组中移除某个命令。
      async removeCommandFromGroup(menuType, groupIndex, commandIndex) {
        this.ensureMenuConfig(menuType);
        const targetGroup = this.settings.menus[menuType].groups[groupIndex];
        if (!targetGroup) {
          return;
        }
        targetGroup.commands.splice(commandIndex, 1);
        await this.save();
      }
      // 调整分组内命令顺序。
      async moveCommandInGroup(menuType, groupIndex, commandIndex, offset) {
        this.ensureMenuConfig(menuType);
        const targetGroup = this.settings.menus[menuType].groups[groupIndex];
        if (!targetGroup) {
          return;
        }
        if (!this.moveArrayItem(targetGroup.commands, commandIndex, offset)) {
          return;
        }
        await this.save();
      }
      // 新增一个与分组并列的根级命令。
      async addRootCommand(menuType, commandId) {
        this.ensureMenuConfig(menuType);
        const menuConfig = this.settings.menus[menuType];
        const normalizedCommandId = typeof commandId === "string" ? commandId.trim() : "";
        if (!normalizedCommandId) {
          return {
            success: false,
            reason: "empty"
          };
        }
        if (!this.getCommandMetadata(menuType, normalizedCommandId)) {
          return {
            success: false,
            reason: "missing"
          };
        }
        if (menuConfig.rootItems.some((item) => item.type === "command" && item.commandId === normalizedCommandId)) {
          return {
            success: false,
            reason: "duplicate"
          };
        }
        menuConfig.rootItems.push(this.createRootItem("command", { commandId: normalizedCommandId }));
        await this.save();
        return {
          success: true,
          reason: "added"
        };
      }
      // 新增一个根级分隔线。
      async addRootSeparator(menuType) {
        this.ensureMenuConfig(menuType);
        this.settings.menus[menuType].rootItems.push(this.createRootItem("separator"));
        await this.save();
      }
      // 删除根级结构中的命令或分隔线；分组应通过“删除分组”操作处理。
      async removeRootItem(menuType, itemIndex) {
        this.ensureMenuConfig(menuType);
        const menuConfig = this.settings.menus[menuType];
        const targetItem = menuConfig.rootItems[itemIndex];
        if (!targetItem || targetItem.type === "group") {
          return false;
        }
        menuConfig.rootItems.splice(itemIndex, 1);
        await this.save();
        return true;
      }
      // 调整根级结构项顺序。
      async moveRootItem(menuType, itemIndex, offset) {
        this.ensureMenuConfig(menuType);
        const menuConfig = this.settings.menus[menuType];
        if (!this.moveArrayItem(menuConfig.rootItems, itemIndex, offset)) {
          return false;
        }
        this.alignGroupOrderWithRootItems(menuConfig);
        await this.save();
        return true;
      }
      // 更新根级结构项属性，目前主要用于命令/分隔线的隐藏状态。
      async updateRootItem(menuType, itemIndex, patch) {
        this.ensureMenuConfig(menuType);
        const menuConfig = this.settings.menus[menuType];
        const currentItem = menuConfig.rootItems[itemIndex];
        if (!currentItem || currentItem.type === "group") {
          return false;
        }
        menuConfig.rootItems[itemIndex] = this.normalizeRootItem(
          menuType,
          Object.assign({}, currentItem, patch),
          new Set(menuConfig.groups.map((group) => group.id))
        );
        await this.save();
        return true;
      }
      // 新增一条手动命令映射，用于补齐无 commandId 的原始菜单项识别。
      async addCommandMapping(menuType) {
        this.ensureMenuConfig(menuType);
        this.settings.menus[menuType].commandMappings.push(this.createCommandMapping());
        await this.save();
      }
      // 更新手动命令映射。
      async updateCommandMapping(menuType, mappingIndex, patch) {
        this.ensureMenuConfig(menuType);
        const currentMapping = this.settings.menus[menuType].commandMappings[mappingIndex];
        if (!currentMapping) {
          return;
        }
        this.settings.menus[menuType].commandMappings[mappingIndex] = this.normalizeCommandMapping(
          Object.assign({}, currentMapping, patch)
        );
        await this.save();
      }
      // 删除手动命令映射。
      async removeCommandMapping(menuType, mappingIndex) {
        this.ensureMenuConfig(menuType);
        this.settings.menus[menuType].commandMappings.splice(mappingIndex, 1);
        await this.save();
      }
      // 根据“手动映射 + 初始内置数据”严格识别无显式 commandId 的菜单项。
      resolveMappedCommandId(menuType, title, section) {
        const normalizedTitle = this.normalizeText(title);
        const normalizedSection = this.normalizeText(section);
        if (!menuType || !normalizedTitle) {
          return "";
        }
        for (const mapping of this.getMenuCommandMappings(menuType)) {
          if (!mapping.title || !mapping.commandId) {
            continue;
          }
          if (this.normalizeText(mapping.title) !== normalizedTitle) {
            continue;
          }
          const mappingSection = this.normalizeText(mapping.section);
          if (mappingSection && mappingSection !== normalizedSection) {
            continue;
          }
          return mapping.commandId;
        }
        for (const builtinEntry of constants.getBuiltinCommandEntries(menuType)) {
          if (!builtinEntry.title || !builtinEntry.commandId) {
            continue;
          }
          if (this.normalizeText(builtinEntry.title) !== normalizedTitle) {
            continue;
          }
          const builtinSection = this.normalizeText(builtinEntry.section);
          if (builtinSection && builtinSection !== normalizedSection) {
            continue;
          }
          return builtinEntry.commandId;
        }
        return "";
      }
      // 更新某个命令的显示名称、图标或隐藏状态。
      async updateCommandOverride(menuType, commandId, patch) {
        this.ensureMenuConfig(menuType);
        const normalizedCommandId = typeof commandId === "string" ? commandId.trim() : "";
        if (!normalizedCommandId) {
          return;
        }
        const currentOverride = this.settings.menus[menuType].commandOverrides[normalizedCommandId] || {};
        const nextOverride = this.normalizeCommandOverride(Object.assign({}, currentOverride, patch));
        if (!nextOverride.title && !nextOverride.icon && nextOverride.hidden !== true) {
          delete this.settings.menus[menuType].commandOverrides[normalizedCommandId];
        } else {
          this.settings.menus[menuType].commandOverrides[normalizedCommandId] = nextOverride;
        }
        await this.save();
      }
      // 生成默认分组对象。
      createGroup(menuType) {
        return {
          id: `${menuType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: "新分组",
          icon: "",
          layout: "list",
          hidden: false,
          forceSubmenu: false,
          commands: []
        };
      }
      // 生成默认根级结构项。
      createRootItem(type, payload) {
        const source = this.isPlainObject(payload) ? payload : {};
        const id = typeof source.id === "string" && source.id.trim() ? source.id.trim() : `root-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        if (type === "group") {
          return {
            id,
            type: "group",
            groupId: typeof source.groupId === "string" ? source.groupId.trim() : "",
            hidden: false
          };
        }
        if (type === "command") {
          return {
            id,
            type: "command",
            commandId: typeof source.commandId === "string" ? source.commandId.trim() : "",
            hidden: source.hidden === true
          };
        }
        return {
          id,
          type: "separator",
          hidden: source.hidden === true
        };
      }
      // 生成默认手动映射对象。
      createCommandMapping() {
        return {
          title: "",
          section: "",
          commandId: ""
        };
      }
      // 归一化整个菜单自定义配置结构。
      normalizeSettings(settings) {
        const defaultSettings = constants.createDefaultMenuCustomizerSettings();
        const source = this.isPlainObject(settings) ? settings : {};
        const normalizedMenus = {};
        constants.MENU_TYPE_OPTIONS.forEach((menuType) => {
          normalizedMenus[menuType.id] = this.normalizeMenuConfig(menuType.id, source.menus?.[menuType.id]);
        });
        return Object.assign({}, defaultSettings, {
          menus: normalizedMenus
        });
      }
      // 归一化单个菜单类型的配置。
      normalizeMenuConfig(menuType, menuConfig) {
        const defaultSettings = constants.createDefaultMenuCustomizerSettings();
        const defaultMenuConfig = defaultSettings.menus[menuType] || {
          enabled: false,
          groups: [],
          rootItems: constants.cloneDefaultRootItems(menuType),
          commandOverrides: {},
          commandMappings: []
        };
        const source = this.isPlainObject(menuConfig) ? menuConfig : {};
        const commandOverrides = {};
        const groups = Array.isArray(source.groups) ? source.groups.map((group) => this.normalizeGroup(menuType, group)) : defaultMenuConfig.groups.map((group) => this.normalizeGroup(menuType, group));
        if (this.isPlainObject(source.commandOverrides)) {
          Object.entries(source.commandOverrides).forEach(([commandId, override]) => {
            const normalizedCommandId = typeof commandId === "string" ? commandId.trim() : "";
            if (!normalizedCommandId) {
              return;
            }
            commandOverrides[normalizedCommandId] = this.normalizeCommandOverride(override);
          });
        }
        const normalizedConfig = {
          enabled: source.enabled === true,
          groups,
          rootItems: this.normalizeRootItems(
            menuType,
            Array.isArray(source.rootItems) ? source.rootItems : defaultMenuConfig.rootItems,
            groups
          ),
          commandOverrides,
          commandMappings: Array.isArray(source.commandMappings) ? source.commandMappings.map((mapping) => this.normalizeCommandMapping(mapping)) : defaultMenuConfig.commandMappings.map((mapping) => this.normalizeCommandMapping(mapping))
        };
        this.alignGroupOrderWithRootItems(normalizedConfig);
        return normalizedConfig;
      }
      // 归一化分组配置，清理非法布局值与空命令。
      normalizeGroup(menuType, group) {
        const source = this.isPlainObject(group) ? group : {};
        const normalizedLayout = constants.GROUP_LAYOUT_OPTIONS.some((layout) => layout.value === source.layout) ? source.layout : "list";
        return {
          id: typeof source.id === "string" && source.id.trim() ? source.id.trim() : `${menuType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: typeof source.name === "string" && source.name.trim() ? source.name.trim() : "未命名分组",
          icon: typeof source.icon === "string" ? source.icon.trim() : "",
          layout: normalizedLayout,
          hidden: source.hidden === true,
          forceSubmenu: source.forceSubmenu === true,
          commands: this.normalizeCommandList(source.commands)
        };
      }
      // 归一化单个根级结构项。
      normalizeRootItem(menuType, item, validGroupIds) {
        const source = this.isPlainObject(item) ? item : {};
        const type = typeof source.type === "string" ? source.type.trim() : "";
        if (type === "group") {
          const groupId = typeof source.groupId === "string" ? source.groupId.trim() : "";
          if (!groupId || !validGroupIds.has(groupId)) {
            return null;
          }
          return this.createRootItem("group", {
            id: source.id,
            groupId
          });
        }
        if (type === "command") {
          const commandId = typeof source.commandId === "string" ? source.commandId.trim() : "";
          if (!commandId) {
            return null;
          }
          return this.createRootItem("command", {
            id: source.id,
            commandId,
            hidden: source.hidden === true
          });
        }
        if (type === "separator") {
          return this.createRootItem("separator", {
            id: source.id,
            hidden: source.hidden === true
          });
        }
        return null;
      }
      // 归一化根级结构列表，并自动补齐缺失的分组引用。
      normalizeRootItems(menuType, rootItems, groups) {
        const source = Array.isArray(rootItems) ? rootItems : [];
        const validGroupIds = new Set(groups.map((group) => group.id));
        const normalizedItems = [];
        const seenGroupIds = /* @__PURE__ */ new Set();
        source.forEach((item) => {
          const normalizedItem = this.normalizeRootItem(menuType, item, validGroupIds);
          if (!normalizedItem) {
            return;
          }
          if (normalizedItem.type === "group") {
            if (seenGroupIds.has(normalizedItem.groupId)) {
              return;
            }
            seenGroupIds.add(normalizedItem.groupId);
          }
          normalizedItems.push(normalizedItem);
        });
        groups.forEach((group) => {
          if (seenGroupIds.has(group.id)) {
            return;
          }
          seenGroupIds.add(group.id);
          normalizedItems.push(this.createRootItem("group", {
            id: `${group.id}::root`,
            groupId: group.id
          }));
        });
        if (normalizedItems.length === 0 && groups.length === 0) {
          return constants.cloneDefaultRootItems(menuType).filter((item) => item.type !== "group");
        }
        return normalizedItems;
      }
      // 归一化单条手动命令映射。
      normalizeCommandMapping(mapping) {
        const source = this.isPlainObject(mapping) ? mapping : {};
        return {
          title: typeof source.title === "string" ? source.title.trim() : "",
          section: typeof source.section === "string" ? source.section.trim() : "",
          commandId: typeof source.commandId === "string" ? source.commandId.trim() : ""
        };
      }
      // 归一化命令覆盖结构，避免空字符串污染存储。
      normalizeCommandOverride(override) {
        const source = this.isPlainObject(override) ? override : {};
        return {
          title: typeof source.title === "string" ? source.title.trim() : "",
          icon: typeof source.icon === "string" ? source.icon.trim() : "",
          hidden: source.hidden === true
        };
      }
      // 清理命令列表，去掉空值并自动去重。
      normalizeCommandList(commands) {
        if (!Array.isArray(commands)) {
          return [];
        }
        const dedupedCommands = [];
        const seen = /* @__PURE__ */ new Set();
        commands.forEach((commandId) => {
          if (typeof commandId !== "string") {
            return;
          }
          const normalizedCommandId = commandId.trim();
          if (!normalizedCommandId || seen.has(normalizedCommandId)) {
            return;
          }
          seen.add(normalizedCommandId);
          dedupedCommands.push(normalizedCommandId);
        });
        return dedupedCommands;
      }
      // 返回指定菜单类型下对应该命令的全部映射。
      getCommandMappingsForCommand(menuType, commandId) {
        const normalizedCommandId = typeof commandId === "string" ? commandId.trim() : "";
        if (!normalizedCommandId) {
          return [];
        }
        return this.getMenuCommandMappings(menuType).filter((mapping) => mapping.commandId === normalizedCommandId);
      }
      // 确保指定菜单类型的配置对象存在。
      ensureMenuConfig(menuType) {
        if (this.settings.menus[menuType]) {
          return;
        }
        this.settings.menus[menuType] = this.normalizeMenuConfig(menuType);
      }
      // 根据根级结构顺序同步分组数组顺序，避免设置页展示错位。
      alignGroupOrderWithRootItems(menuConfig) {
        if (!menuConfig || !Array.isArray(menuConfig.groups) || !Array.isArray(menuConfig.rootItems)) {
          return;
        }
        const groupOrderMap = /* @__PURE__ */ new Map();
        menuConfig.rootItems.forEach((item, index) => {
          if (item.type === "group" && !groupOrderMap.has(item.groupId)) {
            groupOrderMap.set(item.groupId, index);
          }
        });
        menuConfig.groups = menuConfig.groups.map((group, index) => ({ group, index })).sort((left, right) => {
          const leftOrder = groupOrderMap.has(left.group.id) ? groupOrderMap.get(left.group.id) : Number.MAX_SAFE_INTEGER;
          const rightOrder = groupOrderMap.has(right.group.id) ? groupOrderMap.get(right.group.id) : Number.MAX_SAFE_INTEGER;
          return leftOrder === rightOrder ? left.index - right.index : leftOrder - rightOrder;
        }).map((entry) => entry.group);
      }
      // 返回指定分组在根级结构中的位置。
      getGroupRootItemIndex(menuConfig, groupId) {
        return menuConfig.rootItems.findIndex((item) => item.type === "group" && item.groupId === groupId);
      }
      // 通用数组位移工具，返回是否移动成功。
      moveArrayItem(list, currentIndex, offset) {
        if (!Array.isArray(list)) {
          return false;
        }
        const targetIndex = currentIndex + offset;
        if (currentIndex < 0 || currentIndex >= list.length || targetIndex < 0 || targetIndex >= list.length) {
          return false;
        }
        const [item] = list.splice(currentIndex, 1);
        list.splice(targetIndex, 0, item);
        return true;
      }
      // 统一做标题归一化，降低空白与大小写差异带来的识别误差。
      normalizeText(value) {
        return typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, " ") : "";
      }
      // 判断当前值是否为普通对象，避免数组或空值被误当成配置对象。
      isPlainObject(value) {
        return Boolean(value) && typeof value === "object" && !Array.isArray(value);
      }
    };
    module2.exports = {
      MenuCustomizerStore
    };
  }
});

// src/modules/context-menu-enhancer/view.js
var require_view5 = __commonJS({
  "src/modules/context-menu-enhancer/view.js"(exports2, module2) {
    "use strict";
    var obsidian2 = require("obsidian");
    function renderMenuCustomizerHeader(containerEl, title, description) {
      const headerEl = containerEl.createDiv({ cls: "nene-settings-modal-header" });
      headerEl.createDiv({ cls: "nene-settings-modal-title", text: title });
      if (description) {
        headerEl.createEl("p", {
          cls: "nene-settings-modal-description",
          text: description
        });
      }
    }
    function renderSummaryItem(containerEl, label, value, codeStyle) {
      const itemEl = containerEl.createDiv({ cls: "nene-settings-detail-item" });
      itemEl.createDiv({ cls: "nene-settings-detail-label", text: label });
      itemEl.createEl(codeStyle ? "code" : "div", {
        cls: "nene-settings-detail-value",
        text: value
      });
    }
    function getMenuTypeName(store, menuType) {
      return store.getMenuTypeOptions().find((item) => item.id === menuType)?.name || menuType;
    }
    var MenuCustomizerConfirmModal = class extends obsidian2.Modal {
      constructor(app, title, description, onConfirm) {
        super(app);
        this.title = title;
        this.description = description;
        this.onConfirm = onConfirm;
      }
      // 打开弹窗时渲染说明与确认按钮。
      onOpen() {
        const { contentEl } = this;
        this.modalEl.addClass("mod-sidebar-layout", "nene-settings-panel-modal");
        contentEl.empty();
        contentEl.addClass("nene-settings-modal");
        renderMenuCustomizerHeader(contentEl, this.title, this.description);
        const actionEl = contentEl.createDiv({ cls: "nene-settings-modal-actions" });
        const cancelButtonEl = actionEl.createEl("button", { text: "取消" });
        const confirmButtonEl = actionEl.createEl("button", {
          cls: "mod-warning",
          text: "确认"
        });
        cancelButtonEl.addEventListener("click", () => this.close());
        confirmButtonEl.addEventListener("click", async () => {
          confirmButtonEl.disabled = true;
          try {
            await this.onConfirm();
            this.close();
          } finally {
            confirmButtonEl.disabled = false;
          }
        });
      }
      // 关闭弹窗时清空内容，避免重复挂载旧 DOM。
      onClose() {
        this.contentEl.empty();
      }
    };
    var MenuCustomizerManagementModal = class extends obsidian2.Modal {
      constructor(app, plugin, onSettingsChanged) {
        super(app);
        this.plugin = plugin;
        this.onSettingsChanged = onSettingsChanged;
        this.activeMenuType = plugin.menuCustomizerStore.getMenuTypeOptions()[0]?.id || "editor";
        this.previewPaneEl = null;
        this.summaryPaneEl = null;
      }
      // 打开弹窗时渲染最新配置。
      onOpen() {
        this.modalEl.addClass(
          "mod-sidebar-layout",
          "nene-settings-panel-modal",
          "nene-menu-customizer-panel-modal"
        );
        this.contentEl.empty();
        this.contentEl.addClass("nene-settings-modal", "nene-menu-customizer-modal");
        void this.render();
      }
      // 根据当前状态重绘整个右键菜单管理界面。
      async render() {
        const { contentEl } = this;
        const store = this.plugin.menuCustomizerStore;
        const menuTypeOptions = store.getMenuTypeOptions();
        if (!menuTypeOptions.some((item) => item.id === this.activeMenuType)) {
          this.activeMenuType = menuTypeOptions[0]?.id || "editor";
        }
        contentEl.empty();
        renderMenuCustomizerHeader(
          contentEl,
          "右键菜单自定义",
          ""
        );
        this.summaryPaneEl = contentEl.createDiv({ cls: "nene-menu-customizer-summary" });
        await this.renderSummaryPanel();
        const shellEl = contentEl.createDiv({ cls: "nene-menu-customizer-shell" });
        const settingsPaneEl = shellEl.createDiv({ cls: "nene-menu-customizer-settings-pane" });
        this.previewPaneEl = shellEl.createDiv({ cls: "nene-menu-customizer-preview-pane" });
        this.renderMenuTypeTabs(settingsPaneEl, menuTypeOptions);
        this.renderActiveMenuSettings(settingsPaneEl);
        this.renderPreviewPanel();
      }
      // 渲染顶部摘要，集中展示模块状态与配置文件路径。
      async renderSummaryPanel() {
        const summary = this.plugin.getSettingsSummary();
        const configSummary = await this.plugin.getConfigManagementSummary();
        if (!this.summaryPaneEl) {
          return;
        }
        this.summaryPaneEl.empty();
        const detailListEl = this.summaryPaneEl.createDiv({ cls: "nene-settings-detail-list" });
        renderSummaryItem(detailListEl, "模块状态", summary.menuCustomizerEnabled ? "已启用" : "已关闭");
        renderSummaryItem(detailListEl, "已启用菜单", `${summary.menuCustomizerMenuCount} 个`);
        renderSummaryItem(detailListEl, "分组数量", `${summary.menuCustomizerGroupCount} 个`);
        renderSummaryItem(detailListEl, "配置文件", configSummary.menuCustomizer.path, true);
        const noteEl = this.summaryPaneEl.createDiv({ cls: "nene-menu-customizer-note" });
        noteEl.createEl("strong", { text: "说明：" });
        noteEl.createSpan({
          text: "新增命令完全来自 Obsidian 命令注册表；无显式 commandId 的原始菜单项会先查“初始内置数据”，你仍可在“手动映射”里补充或覆盖。"
        });
      }
      // 渲染四个菜单类型的分页切换标签。
      renderMenuTypeTabs(containerEl, menuTypeOptions) {
        const tabsEl = containerEl.createDiv({ cls: "nene-menu-customizer-tabs" });
        menuTypeOptions.forEach((menuType) => {
          const menuConfig = this.plugin.menuCustomizerStore.getMenuConfig(menuType.id);
          const tabButtonEl = tabsEl.createEl("button", {
            cls: `nene-menu-customizer-tab${menuType.id === this.activeMenuType ? " is-active" : ""}`,
            text: menuType.name
          });
          if (menuConfig.enabled) {
            tabButtonEl.createSpan({
              cls: "nene-menu-customizer-tab-badge",
              text: "启用中"
            });
          }
          tabButtonEl.addEventListener("click", () => {
            if (this.activeMenuType === menuType.id) {
              return;
            }
            this.activeMenuType = menuType.id;
            void this.render();
          });
        });
      }
      // 渲染当前选中菜单类型的设置区。
      renderActiveMenuSettings(containerEl) {
        const store = this.plugin.menuCustomizerStore;
        const menuType = this.activeMenuType;
        const menuConfig = store.getMenuConfig(menuType);
        const orderedGroups = typeof store.getOrderedGroups === "function" ? store.getOrderedGroups(menuType) : menuConfig.groups;
        const sectionEl = containerEl.createDiv({ cls: "nene-menu-customizer-active-section" });
        const sectionHeaderEl = sectionEl.createDiv({ cls: "nene-menu-customizer-panel-card" });
        sectionHeaderEl.createDiv({
          cls: "nene-menu-customizer-section-title",
          text: ""
        });
        this.renderControlRow(
          sectionHeaderEl,
          "启用当前菜单",
          ``,
          (controlsEl) => {
            const toggleEl = this.createSwitchControl(controlsEl, menuConfig.enabled, async (checked) => {
              await store.setMenuEnabled(menuType, checked);
              new obsidian2.Notice(checked ? `已启用 ${getMenuTypeName(store, menuType)}` : `已关闭 ${getMenuTypeName(store, menuType)}`);
              await this.onSettingsChanged();
              await this.renderSummaryPanel();
              this.renderPreviewPanel();
            });
            toggleEl.classList.add("nene-menu-customizer-inline-switch");
          }
        );
        this.renderMenuStructurePanel(sectionEl, menuType, menuConfig);
        const groupsCardEl = sectionEl.createDiv({ cls: "nene-menu-customizer-panel-card" });
        const groupsHeaderEl = groupsCardEl.createDiv({ cls: "nene-menu-customizer-card-header" });
        groupsHeaderEl.createDiv({ cls: "nene-menu-customizer-subtitle", text: "分组编辑" });
        const addGroupButtonEl = groupsHeaderEl.createEl("button", {
          cls: "mod-cta",
          text: "添加分组"
        });
        addGroupButtonEl.addEventListener("click", async () => {
          await store.addGroup(menuType);
          await this.onSettingsChanged();
          await this.renderSummaryPanel();
          await this.render();
        });
        if (orderedGroups.length === 0) {
          groupsCardEl.createDiv({
            cls: "nene-menu-customizer-empty",
            text: "当前还没有分组。你可以先创建分组，也可以只在上方配置根级命令和分隔线。"
          });
        }
        orderedGroups.forEach((group, groupIndex) => {
          this.renderGroupEditor(groupsCardEl, menuType, group, groupIndex, orderedGroups.length);
        });
        this.renderMappingsPanel(sectionEl, menuType, menuConfig);
        this.renderOverridesPanel(sectionEl, menuType, menuConfig);
        this.renderResetPanel(sectionEl);
      }
      // 渲染根级菜单结构，支持与分组并列的命令和分隔线。
      renderMenuStructurePanel(containerEl, menuType, menuConfig) {
        const store = this.plugin.menuCustomizerStore;
        const structureCardEl = containerEl.createDiv({ cls: "nene-menu-customizer-panel-card" });
        const headerEl = structureCardEl.createDiv({ cls: "nene-menu-customizer-card-header" });
        headerEl.createDiv({ cls: "nene-menu-customizer-subtitle", text: "菜单顺序" });
        headerEl.createSpan({
          cls: "nene-menu-customizer-meta-pill",
          text: `${Array.isArray(menuConfig.rootItems) ? menuConfig.rootItems.length : 0} 项`
        });
        structureCardEl.createDiv({
          cls: "nene-menu-customizer-note",
          text: "这里控制菜单第一层的最终顺序。分组、并列命令、分隔线都按这里排列；未在这里配置的原始菜单项会按出现顺序统一后置。"
        });
        if (!Array.isArray(menuConfig.rootItems) || menuConfig.rootItems.length === 0) {
          structureCardEl.createDiv({
            cls: "nene-menu-customizer-empty",
            text: "当前还没有根级结构项。"
          });
        } else {
          menuConfig.rootItems.forEach((rootItem, itemIndex) => {
            this.renderRootItemRow(structureCardEl, menuType, menuConfig, rootItem, itemIndex);
          });
        }
        const addableCommands = store.getAddableCommands(menuType);
        let addType = "command";
        let selectedCommandId = addableCommands[0]?.id || "";
        let manualCommandId = "";
        this.renderControlRow(
          structureCardEl,
          "新增根级项",
          "支持新增与分组并列的命令或分隔线。命令可从注册表选择，也可手动输入已在内置数据或手动映射中可识别的 commandId。",
          (controlsEl) => {
            this.createSelectInput(
              controlsEl,
              [
                { value: "command", label: "命令" },
                { value: "separator", label: "分隔线" }
              ],
              addType,
              async (value) => {
                addType = value;
              }
            );
            this.createSelectInput(
              controlsEl,
              addableCommands.map((command) => ({
                value: command.id,
                label: `${command.label} (${command.id})`
              })),
              selectedCommandId,
              async (value) => {
                selectedCommandId = value;
              }
            );
            this.createTextInput(controlsEl, "或手动输入 commandId", "", async (value) => {
              manualCommandId = value;
            });
            const addButtonEl = controlsEl.createEl("button", {
              cls: "mod-cta",
              text: "添加到根级"
            });
            addButtonEl.addEventListener("click", async () => {
              if (addType === "separator") {
                await store.addRootSeparator(menuType);
                new obsidian2.Notice("已添加根级分隔线");
                await this.onSettingsChanged();
                await this.render();
                return;
              }
              const commandId = (manualCommandId || selectedCommandId || "").trim();
              if (!commandId) {
                new obsidian2.Notice("请先选择或输入命令 ID");
                return;
              }
              const result = await store.addRootCommand(menuType, commandId);
              if (!result.success) {
                if (result.reason === "missing") {
                  new obsidian2.Notice(`命令不存在，无法添加：${commandId}`);
                } else if (result.reason === "duplicate") {
                  new obsidian2.Notice("该命令已经在根级结构中");
                } else {
                  new obsidian2.Notice("命令为空，无法添加");
                }
                return;
              }
              new obsidian2.Notice(`已添加根级命令：${store.getCommandLabel(menuType, commandId)}`);
              await this.onSettingsChanged();
              await this.render();
            });
          }
        );
      }
      // 渲染单条根级结构项。
      renderRootItemRow(containerEl, menuType, menuConfig, rootItem, itemIndex) {
        const store = this.plugin.menuCustomizerStore;
        const rowEl = containerEl.createDiv({ cls: "nene-menu-customizer-structure-row" });
        const infoEl = rowEl.createDiv({ cls: "nene-menu-customizer-structure-info" });
        if (rootItem.type === "group") {
          const group = menuConfig.groups.find((item) => item.id === rootItem.groupId);
          let labelEl = infoEl.createDiv({
            cls: "nene-menu-customizer-command-label",
            text: group ? `分组：${group.name}` : `分组：${rootItem.groupId}`
          });
          infoEl.createEl("span", {
            cls: "nene-menu-customizer-command-id",
            text: rootItem.groupId
          });
          let metaEl = labelEl.createDiv({ cls: "nene-menu-customizer-group-summary-meta" });
          metaEl.createSpan({
            cls: "nene-menu-customizer-meta-pill",
            text: "分组"
          });
          if (group?.hidden) {
            metaEl.createSpan({
              cls: "nene-menu-customizer-meta-pill is-muted",
              text: "已隐藏"
            });
          }
        } else if (rootItem.type === "command") {
          let labelEl = infoEl.createDiv({
            cls: "nene-menu-customizer-command-label",
            text: store.getCommandLabel(menuType, rootItem.commandId)
          });
          infoEl.createEl("span", {
            cls: "nene-menu-customizer-command-id",
            text: rootItem.commandId
          });
          labelEl.createSpan({
            cls: "nene-menu-customizer-meta-pill",
            text: "根级命令"
          });
          if (rootItem.hidden) {
            infoEl.createSpan({
              cls: "nene-menu-customizer-meta-pill is-muted",
              text: "已隐藏"
            });
          }
        } else {
          let labelEl = infoEl.createDiv({
            cls: "nene-menu-customizer-command-label",
            text: "分隔线"
          });
          infoEl.createEl("span", {
            cls: "nene-menu-customizer-command-id",
            text: rootItem.id
          });
          labelEl.createSpan({
            cls: "nene-menu-customizer-meta-pill",
            text: "分隔线"
          });
          if (rootItem.hidden) {
            infoEl.createSpan({
              cls: "nene-menu-customizer-meta-pill is-muted",
              text: "已隐藏"
            });
          }
        }
        const actionEl = rowEl.createDiv({ cls: "nene-menu-customizer-command-actions" });
        this.createIconButton(actionEl, "arrow-up", "上移", itemIndex === 0, async () => {
          await store.moveRootItem(menuType, itemIndex, -1);
          await this.onSettingsChanged();
          await this.render();
        });
        this.createIconButton(
          actionEl,
          "arrow-down",
          "下移",
          itemIndex === menuConfig.rootItems.length - 1,
          async () => {
            await store.moveRootItem(menuType, itemIndex, 1);
            await this.onSettingsChanged();
            await this.render();
          }
        );
        if (rootItem.type !== "group") {
          this.createSwitchControl(actionEl, rootItem.hidden === true, async (checked) => {
            await store.updateRootItem(menuType, itemIndex, { hidden: checked });
            this.renderPreviewPanel();
          }, "隐藏");
          this.createIconButton(actionEl, "trash", "删除", false, async () => {
            await store.removeRootItem(menuType, itemIndex);
            await this.onSettingsChanged();
            await this.render();
          }, true);
        }
      }
      // 渲染单个分组编辑器，使用现代折叠结构避免长列表过长。
      renderGroupEditor(containerEl, menuType, group, groupIndex, totalGroups) {
        const store = this.plugin.menuCustomizerStore;
        const groupDetailsEl = containerEl.createEl("details", {
          cls: "nene-menu-customizer-group-card"
        });
        if (groupIndex === 0) {
          groupDetailsEl.open = true;
        }
        const summaryEl = groupDetailsEl.createEl("summary", {
          cls: "nene-menu-customizer-group-summary"
        });
        summaryEl.createDiv({
          cls: "nene-menu-customizer-group-summary-title",
          text: group.name || `分组 ${groupIndex + 1}`
        });
        const metaEl = summaryEl.createDiv({ cls: "nene-menu-customizer-group-summary-meta" });
        metaEl.createSpan({
          cls: "nene-menu-customizer-meta-pill",
          text: `${group.commands.length} 个命令`
        });
        metaEl.createSpan({
          cls: "nene-menu-customizer-meta-pill",
          text: group.layout === "icon-bar" ? "图标栏" : group.layout === "grid" ? "网格" : "列表"
        });
        if (group.forceSubmenu) {
          metaEl.createSpan({
            cls: "nene-menu-customizer-meta-pill",
            text: "强制子菜单"
          });
        }
        if (group.hidden) {
          metaEl.createSpan({
            cls: "nene-menu-customizer-meta-pill is-muted",
            text: "已隐藏"
          });
        }
        const bodyEl = groupDetailsEl.createDiv({ cls: "nene-menu-customizer-group-body" });
        this.renderControlRow(
          bodyEl,
          "基础信息",
          group.id,
          (controlsEl) => {
            this.createTextInput(controlsEl, "分组名称", group.name, async (value) => {
              await store.updateGroup(menuType, groupIndex, { name: value });
              this.renderPreviewPanel();
            });
            this.createTextInput(controlsEl, "图标（可选）", group.icon || "", async (value) => {
              await store.updateGroup(menuType, groupIndex, { icon: value });
              this.renderPreviewPanel();
            });
            const moveControlsEl = controlsEl.createDiv({ cls: "nene-menu-customizer-inline-actions" });
            this.createIconButton(moveControlsEl, "arrow-up", "上移分组", groupIndex === 0, async () => {
              await store.moveGroup(menuType, groupIndex, -1);
              await this.onSettingsChanged();
              await this.render();
            });
            this.createIconButton(moveControlsEl, "arrow-down", "下移分组", groupIndex === totalGroups - 1, async () => {
              await store.moveGroup(menuType, groupIndex, 1);
              await this.onSettingsChanged();
              await this.render();
            });
            this.createIconButton(moveControlsEl, "trash", "删除分组", false, async () => {
              await store.removeGroup(menuType, groupIndex);
              await this.onSettingsChanged();
              await this.renderSummaryPanel();
              await this.render();
            }, true);
          }
        );
        this.renderControlRow(
          bodyEl,
          "布局与行为",
          "列表布局中的多命令分组默认折叠为子菜单。",
          (controlsEl) => {
            this.createSelectInput(
              controlsEl,
              store.getLayoutOptions(),
              group.layout,
              async (value) => {
                await store.updateGroup(menuType, groupIndex, { layout: value });
                await this.onSettingsChanged();
                this.renderPreviewPanel();
              }
            );
            this.createSwitchControl(controlsEl, group.hidden === true, async (checked) => {
              await store.updateGroup(menuType, groupIndex, { hidden: checked });
              this.renderPreviewPanel();
            }, "隐藏分组");
            this.createSwitchControl(controlsEl, group.forceSubmenu === true, async (checked) => {
              await store.updateGroup(menuType, groupIndex, { forceSubmenu: checked });
              this.renderPreviewPanel();
            }, "强制子菜单");
          }
        );
        const commandsSectionEl = bodyEl.createDiv({ cls: "nene-menu-customizer-command-list" });
        commandsSectionEl.createDiv({ cls: "nene-menu-customizer-mini-title", text: "命令顺序" });
        if (group.commands.length === 0) {
          commandsSectionEl.createDiv({
            cls: "nene-menu-customizer-empty",
            text: "当前分组还没有命令。"
          });
        }
        group.commands.forEach((commandId, commandIndex) => {
          const commandRowEl = commandsSectionEl.createDiv({ cls: "nene-menu-customizer-command-row" });
          const contentEl = commandRowEl.createDiv({ cls: "nene-menu-customizer-command-content" });
          contentEl.createDiv({
            cls: "nene-menu-customizer-command-label",
            text: store.getCommandLabel(menuType, commandId)
          });
          contentEl.createEl("code", {
            cls: "nene-menu-customizer-command-id",
            text: commandId
          });
          const actionEl = commandRowEl.createDiv({ cls: "nene-menu-customizer-command-actions" });
          this.createIconButton(actionEl, "arrow-up", "上移命令", commandIndex === 0, async () => {
            await store.moveCommandInGroup(menuType, groupIndex, commandIndex, -1);
            await this.onSettingsChanged();
            await this.render();
          });
          this.createIconButton(actionEl, "arrow-down", "下移命令", commandIndex === group.commands.length - 1, async () => {
            await store.moveCommandInGroup(menuType, groupIndex, commandIndex, 1);
            await this.onSettingsChanged();
            await this.render();
          });
          this.createIconButton(actionEl, "x", "移除命令", false, async () => {
            await store.removeCommandFromGroup(menuType, groupIndex, commandIndex);
            await this.onSettingsChanged();
            await this.render();
          });
        });
        const addableCommands = store.getAddableCommands(menuType);
        let selectedCommandId = addableCommands[0]?.id || "";
        let manualCommandId = "";
        this.renderControlRow(
          bodyEl,
          "添加命令",
          `下拉列表完全来自当前 Obsidian 命令注册表，共 ${addableCommands.length} 条。手动输入时，已注册命令可新增到菜单；已在“手动映射”中登记的未注册命令，也可加入分组以控制原始菜单项。`,
          (controlsEl) => {
            const selectOptions = addableCommands.map((command) => ({
              value: command.id,
              label: `${command.label} (${command.id})`
            }));
            this.createSelectInput(
              controlsEl,
              selectOptions,
              selectedCommandId,
              async (value) => {
                selectedCommandId = value;
              }
            );
            this.createTextInput(controlsEl, "或手动输入命令 ID", "", async (value) => {
              manualCommandId = value;
            });
            const addButtonEl = controlsEl.createEl("button", {
              cls: "mod-cta",
              text: "添加"
            });
            addButtonEl.addEventListener("click", async () => {
              const commandId = (manualCommandId || selectedCommandId || "").trim();
              if (!commandId) {
                new obsidian2.Notice("请先选择或输入命令 ID");
                return;
              }
              const result = await store.addCommandToGroup(menuType, groupIndex, commandId);
              if (!result.success) {
                if (result.reason === "missing") {
                  new obsidian2.Notice(`命令不存在，无法添加：${commandId}`);
                } else if (result.reason === "duplicate") {
                  new obsidian2.Notice("该命令已经在当前分组中");
                } else {
                  new obsidian2.Notice("命令为空，无法添加");
                }
                return;
              }
              const commandLabel = store.getCommandLabel(menuType, commandId);
              new obsidian2.Notice(`已添加命令：${commandLabel}`);
              await this.onSettingsChanged();
              await this.render();
            });
          }
        );
      }
      // 渲染手动命令映射面板，用于补齐无显式 commandId 的原始菜单项识别。
      renderMappingsPanel(containerEl, menuType, menuConfig) {
        const store = this.plugin.menuCustomizerStore;
        const mappingsCardEl = containerEl.createEl("details", {
          cls: "nene-menu-customizer-panel-card nene-menu-customizer-collapsible-card"
        });
        const summaryEl = mappingsCardEl.createEl("summary", {
          cls: "nene-menu-customizer-card-header"
        });
        summaryEl.createDiv({ cls: "nene-menu-customizer-subtitle", text: "手动映射" });
        summaryEl.createSpan({
          cls: "nene-menu-customizer-meta-pill",
          text: `${menuConfig.commandMappings.length} 条`
        });
        const bodyEl = mappingsCardEl.createDiv({ cls: "nene-menu-customizer-mappings" });
        bodyEl.createDiv({
          cls: "nene-menu-customizer-note",
          text: "当某个原始右键菜单项没有暴露 commandId 时，运行时会先查初始内置数据；这里填写的 title、section 和 commandId 会优先于内置数据生效。"
        });
        if (menuConfig.commandMappings.length === 0) {
          bodyEl.createDiv({
            cls: "nene-menu-customizer-empty",
            text: "当前菜单还没有手动映射。"
          });
        }
        menuConfig.commandMappings.forEach((mapping, mappingIndex) => {
          const rowEl = bodyEl.createDiv({ cls: "nene-menu-customizer-mapping-row" });
          const infoEl = rowEl.createDiv({ cls: "nene-menu-customizer-mapping-info" });
          infoEl.createDiv({
            cls: "nene-menu-customizer-command-label",
            text: mapping.title || "未填写标题"
          });
          infoEl.createEl("code", {
            cls: "nene-menu-customizer-command-id",
            text: mapping.commandId || "未填写 commandId"
          });
          const metaEl = infoEl.createDiv({ cls: "nene-menu-customizer-group-summary-meta" });
          metaEl.createSpan({
            cls: "nene-menu-customizer-meta-pill",
            text: mapping.section ? `section: ${mapping.section}` : "section 未填写"
          });
          metaEl.createSpan({
            cls: `nene-menu-customizer-meta-pill${store.isRegisteredCommand(mapping.commandId) ? "" : " is-muted"}`,
            text: store.isRegisteredCommand(mapping.commandId) ? "已注册，可新增执行" : "未注册，仅识别原始项"
          });
          const controlsEl = rowEl.createDiv({ cls: "nene-menu-customizer-mapping-controls" });
          this.createTextInput(controlsEl, "菜单标题", mapping.title || "", async (value) => {
            await store.updateCommandMapping(menuType, mappingIndex, { title: value });
            await this.onSettingsChanged();
            await this.render();
          });
          this.createTextInput(controlsEl, "section（如 action）", mapping.section || "", async (value) => {
            await store.updateCommandMapping(menuType, mappingIndex, { section: value });
            await this.onSettingsChanged();
            await this.render();
          });
          this.createTextInput(controlsEl, "commandId", mapping.commandId || "", async (value) => {
            await store.updateCommandMapping(menuType, mappingIndex, { commandId: value });
            await this.onSettingsChanged();
            await this.render();
          });
          const actionEl = controlsEl.createDiv({ cls: "nene-menu-customizer-command-actions" });
          this.createIconButton(actionEl, "trash", "删除映射", false, async () => {
            await store.removeCommandMapping(menuType, mappingIndex);
            await this.onSettingsChanged();
            await this.render();
          }, true);
        });
        const footerEl = bodyEl.createDiv({ cls: "nene-menu-customizer-mapping-footer" });
        const addButtonEl = footerEl.createEl("button", {
          cls: "mod-cta",
          text: "添加映射"
        });
        addButtonEl.addEventListener("click", async () => {
          await store.addCommandMapping(menuType);
          await this.onSettingsChanged();
          await this.render();
        });
      }
      // 渲染命令覆盖面板。
      renderOverridesPanel(containerEl, menuType, menuConfig) {
        const store = this.plugin.menuCustomizerStore;
        const overridesCardEl = containerEl.createEl("details", {
          cls: "nene-menu-customizer-panel-card nene-menu-customizer-collapsible-card"
        });
        const summaryEl = overridesCardEl.createEl("summary", {
          cls: "nene-menu-customizer-card-header"
        });
        summaryEl.createDiv({ cls: "nene-menu-customizer-subtitle", text: "命令覆盖" });
        const commandIds = new Set(store.getAvailableCommands(menuType).map((command) => command.id));
        menuConfig.groups.forEach((group) => {
          group.commands.forEach((commandId) => commandIds.add(commandId));
        });
        menuConfig.commandMappings.forEach((mapping) => {
          if (mapping.commandId) {
            commandIds.add(mapping.commandId);
          }
        });
        Object.keys(menuConfig.commandOverrides).forEach((commandId) => commandIds.add(commandId));
        summaryEl.createSpan({
          cls: "nene-menu-customizer-meta-pill",
          text: `${commandIds.size} 项`
        });
        const bodyEl = overridesCardEl.createDiv({ cls: "nene-menu-customizer-overrides" });
        Array.from(commandIds).sort((left, right) => store.getCommandLabel(menuType, left).localeCompare(store.getCommandLabel(menuType, right), "zh-CN")).forEach((commandId) => {
          const override = menuConfig.commandOverrides[commandId] || {};
          const rowEl = bodyEl.createDiv({ cls: "nene-menu-customizer-override-row" });
          const titleEl = rowEl.createDiv({ cls: "nene-menu-customizer-override-title" });
          titleEl.createDiv({
            cls: "nene-menu-customizer-command-label",
            text: store.getCommandLabel(menuType, commandId)
          });
          titleEl.createEl("code", {
            cls: "nene-menu-customizer-command-id",
            text: commandId
          });
          const controlsEl = rowEl.createDiv({ cls: "nene-menu-customizer-override-controls" });
          this.createTextInput(controlsEl, "自定义标题", override.title || "", async (value) => {
            await store.updateCommandOverride(menuType, commandId, { title: value });
            this.renderPreviewPanel();
          });
          this.createTextInput(controlsEl, "自定义图标", override.icon || "", async (value) => {
            await store.updateCommandOverride(menuType, commandId, { icon: value });
            this.renderPreviewPanel();
          });
          this.createSwitchControl(controlsEl, override.hidden === true, async (checked) => {
            await store.updateCommandOverride(menuType, commandId, { hidden: checked });
            this.renderPreviewPanel();
          }, "隐藏命令");
        });
      }
      // 渲染底部重置卡片。
      renderResetPanel(containerEl) {
        const resetCardEl = containerEl.createDiv({ cls: "nene-menu-customizer-panel-card" });
        this.renderControlRow(
          resetCardEl,
          "重置右键菜单配置",
          "仅重置右键菜单自定义模块的独立配置文件，不影响其他模块与总开关。",
          (controlsEl) => {
            const resetButtonEl = controlsEl.createEl("button", {
              cls: "mod-warning",
              text: "重置 menu-customizer"
            });
            resetButtonEl.addEventListener("click", () => {
              new MenuCustomizerConfirmModal(
                this.app,
                "重置右键菜单配置",
                "此操作会将右键菜单模块的分组、排序、重命名、隐藏与子菜单配置全部恢复为默认值。",
                async () => {
                  await this.plugin.resetFeatureConfiguration("menuCustomizer");
                  new obsidian2.Notice("右键菜单配置已重置");
                  await this.onSettingsChanged();
                  await this.render();
                }
              ).open();
            });
          }
        );
      }
      // 渲染右侧预览区，模拟最终菜单结构。
      renderPreviewPanel() {
        if (!this.previewPaneEl) {
          return;
        }
        const store = this.plugin.menuCustomizerStore;
        const menuType = this.activeMenuType;
        const menuConfig = store.getMenuConfig(menuType);
        const previewModel = this.buildPreviewModel(menuType, menuConfig);
        this.previewPaneEl.empty();
        const previewHeaderEl = this.previewPaneEl.createDiv({ cls: "nene-menu-customizer-preview-header" });
        previewHeaderEl.createDiv({ cls: "nene-menu-customizer-subtitle", text: "菜单预览" });
        previewHeaderEl.createDiv({
          cls: `nene-menu-customizer-preview-status${menuConfig.enabled ? " is-active" : ""}`,
          text: menuConfig.enabled ? "当前菜单已启用" : "当前菜单未启用"
        });
        const infoListEl = this.previewPaneEl.createDiv({ cls: "nene-settings-detail-list" });
        renderSummaryItem(infoListEl, "当前分页", getMenuTypeName(store, menuType));
        renderSummaryItem(infoListEl, "根级结构", `${previewModel.rootItems.length} 项`);
        renderSummaryItem(infoListEl, "未配置后置", `${previewModel.ungroupedItems.length} 项`);
        const surfaceEl = this.previewPaneEl.createDiv({ cls: "nene-menu-customizer-preview-surface" });
        const menuEl = surfaceEl.createDiv({ cls: "nene-menu-customizer-preview-menu" });
        if (!menuConfig.enabled) {
          menuEl.createDiv({
            cls: "nene-menu-customizer-preview-empty",
            text: "当前分页未启用。启用后右键菜单才会按左侧配置重构。"
          });
          return;
        }
        if (previewModel.rootItems.length === 0 && previewModel.ungroupedItems.length === 0) {
          menuEl.createDiv({
            cls: "nene-menu-customizer-preview-empty",
            text: "当前没有可预览的命令。"
          });
          return;
        }
        previewModel.rootItems.forEach((item) => {
          if (item.type === "separator") {
            menuEl.createDiv({ cls: "nene-menu-customizer-preview-separator" });
            return;
          }
          if (item.type === "group") {
            this.renderPreviewGroup(menuEl, item.group);
            return;
          }
          this.renderPreviewMenuItem(menuEl, item.command);
        });
        if (previewModel.ungroupedItems.length > 0) {
          if (previewModel.rootItems.length > 0) {
            menuEl.createDiv({ cls: "nene-menu-customizer-preview-separator" });
          }
          const sectionLabelEl = menuEl.createDiv({ cls: "nene-menu-customizer-preview-section-label" });
          sectionLabelEl.setText("未配置命令");
          previewModel.ungroupedItems.forEach((item) => {
            this.renderPreviewMenuItem(menuEl, item);
          });
        }
      }
      // 构建预览模型，尽量贴近运行时最终显示结果。
      buildPreviewModel(menuType, menuConfig) {
        const store = this.plugin.menuCustomizerStore;
        const availableCommands = store.getAvailableCommands(menuType);
        const commandMap = /* @__PURE__ */ new Map();
        const usedCommandIds = /* @__PURE__ */ new Set();
        const orderedCommandIds = /* @__PURE__ */ new Set();
        const groupsById = new Map(menuConfig.groups.map((group) => [group.id, group]));
        availableCommands.forEach((command) => {
          const override = menuConfig.commandOverrides[command.id] || {};
          commandMap.set(command.id, {
            id: command.id,
            title: override.title || command.label || command.id,
            icon: override.icon || command.icon || "",
            hidden: override.hidden === true
          });
        });
        menuConfig.groups.forEach((group) => {
          group.commands.forEach((commandId) => orderedCommandIds.add(commandId));
        });
        menuConfig.rootItems.forEach((item) => {
          if (item.type === "command" && item.commandId) {
            orderedCommandIds.add(item.commandId);
          }
        });
        const rootItems = this.cleanupPreviewRootItems(menuConfig.rootItems.map((rootItem) => {
          if (rootItem.type === "separator") {
            return rootItem.hidden === true ? null : { type: "separator" };
          }
          if (rootItem.type === "group") {
            const group = groupsById.get(rootItem.groupId);
            if (!group || group.hidden === true) {
              return null;
            }
            const items = group.commands.map((commandId) => commandMap.get(commandId) || {
              id: commandId,
              title: menuConfig.commandOverrides[commandId]?.title || commandId,
              icon: menuConfig.commandOverrides[commandId]?.icon || "",
              hidden: menuConfig.commandOverrides[commandId]?.hidden === true
            }).filter((item) => item.hidden !== true);
            if (items.length === 0) {
              return null;
            }
            items.forEach((item) => usedCommandIds.add(item.id));
            return {
              type: "group",
              group: {
                id: group.id,
                name: group.name,
                icon: group.icon || "",
                layout: group.layout,
                forceSubmenu: group.forceSubmenu === true,
                items
              }
            };
          }
          if (rootItem.type === "command") {
            const command = commandMap.get(rootItem.commandId) || {
              id: rootItem.commandId,
              title: menuConfig.commandOverrides[rootItem.commandId]?.title || rootItem.commandId,
              icon: menuConfig.commandOverrides[rootItem.commandId]?.icon || "",
              hidden: menuConfig.commandOverrides[rootItem.commandId]?.hidden === true
            };
            if (rootItem.hidden === true || command.hidden === true) {
              return null;
            }
            usedCommandIds.add(command.id);
            return {
              type: "command",
              command
            };
          }
          return null;
        }).filter(Boolean));
        const ungroupedItems = availableCommands.map((command) => commandMap.get(command.id)).filter((item) => item && item.hidden !== true && !usedCommandIds.has(item.id) && !orderedCommandIds.has(item.id));
        return {
          rootItems,
          ungroupedItems
        };
      }
      // 清理预览中的首尾与连续分隔线，让预览更接近运行时最终结果。
      cleanupPreviewRootItems(items) {
        const cleanedItems = [];
        let previousWasSeparator = true;
        items.forEach((item) => {
          const currentIsSeparator = item.type === "separator";
          if (currentIsSeparator && previousWasSeparator) {
            return;
          }
          cleanedItems.push(item);
          previousWasSeparator = currentIsSeparator;
        });
        if (cleanedItems[cleanedItems.length - 1]?.type === "separator") {
          cleanedItems.pop();
        }
        return cleanedItems;
      }
      // 渲染单个预览分组。
      renderPreviewGroup(containerEl, group) {
        if (group.layout === "icon-bar") {
          const blockEl = containerEl.createDiv({ cls: "nene-menu-customizer-preview-block" });
          this.renderPreviewBlockTitle(blockEl, group);
          const iconBarEl = blockEl.createDiv({ cls: "nene-menu-customizer-preview-icon-bar" });
          group.items.forEach((item) => {
            const chipEl = iconBarEl.createDiv({ cls: "nene-menu-customizer-preview-icon-chip" });
            if (item.icon) {
              const iconEl = chipEl.createSpan({ cls: "nene-menu-customizer-preview-icon" });
              obsidian2.setIcon(iconEl, item.icon);
            }
            chipEl.title = item.title;
          });
          return;
        }
        if (group.layout === "grid") {
          const blockEl = containerEl.createDiv({ cls: "nene-menu-customizer-preview-block" });
          this.renderPreviewBlockTitle(blockEl, group);
          const gridEl = blockEl.createDiv({ cls: "nene-menu-customizer-preview-grid" });
          group.items.forEach((item) => {
            const cardEl = gridEl.createDiv({ cls: "nene-menu-customizer-preview-grid-item" });
            if (item.icon) {
              const iconEl = cardEl.createSpan({ cls: "nene-menu-customizer-preview-icon" });
              obsidian2.setIcon(iconEl, item.icon);
            }
            cardEl.createDiv({
              cls: "nene-menu-customizer-preview-grid-title",
              text: item.title
            });
          });
          return;
        }
        if (group.forceSubmenu || group.items.length > 1) {
          const submenuEl = containerEl.createDiv({ cls: "nene-menu-customizer-preview-submenu" });
          const parentItemEl = submenuEl.createDiv({ cls: "nene-menu-customizer-preview-item is-parent" });
          this.appendPreviewItemContent(parentItemEl, {
            title: group.name,
            icon: group.icon
          });
          parentItemEl.createSpan({
            cls: "nene-menu-customizer-preview-arrow",
            text: "›"
          });
          const childMenuEl = submenuEl.createDiv({ cls: "nene-menu-customizer-preview-submenu-panel" });
          group.items.forEach((item) => {
            this.renderPreviewMenuItem(childMenuEl, item);
          });
          return;
        }
        group.items.forEach((item) => {
          this.renderPreviewMenuItem(containerEl, item);
        });
      }
      // 渲染预览块标题。
      renderPreviewBlockTitle(containerEl, group) {
        const titleEl = containerEl.createDiv({ cls: "nene-menu-customizer-preview-section-label" });
        if (group.icon) {
          const iconEl = titleEl.createSpan({ cls: "nene-menu-customizer-preview-icon" });
          obsidian2.setIcon(iconEl, group.icon);
        }
        titleEl.createSpan({ text: group.name });
      }
      // 渲染普通预览菜单项。
      renderPreviewMenuItem(containerEl, item) {
        const itemEl = containerEl.createDiv({ cls: "nene-menu-customizer-preview-item" });
        this.appendPreviewItemContent(itemEl, item);
      }
      // 渲染预览菜单项公共内容。
      appendPreviewItemContent(containerEl, item) {
        const iconEl = containerEl.createSpan({ cls: "nene-menu-customizer-preview-icon" });
        if (item.icon) {
          obsidian2.setIcon(iconEl, item.icon);
        }
        containerEl.createSpan({
          cls: "nene-menu-customizer-preview-title",
          text: item.title
        });
      }
      // 渲染一行紧凑设置控件。
      renderControlRow(containerEl, title, description, renderControls) {
        const rowEl = containerEl.createDiv({ cls: "nene-menu-customizer-control-row" });
        const infoEl = rowEl.createDiv({ cls: "nene-menu-customizer-control-info" });
        infoEl.createDiv({ cls: "nene-menu-customizer-control-title", text: title });
        if (description) {
          infoEl.createDiv({
            cls: "nene-menu-customizer-control-desc",
            text: description
          });
        }
        const controlsEl = rowEl.createDiv({ cls: "nene-menu-customizer-control-actions" });
        renderControls(controlsEl);
      }
      // 创建输入框控件。
      createTextInput(containerEl, placeholder, value, onInput) {
        const inputEl = containerEl.createEl("input", {
          cls: "nene-menu-customizer-text-input",
          type: "text"
        });
        inputEl.placeholder = placeholder;
        inputEl.value = value || "";
        inputEl.addEventListener("input", async () => {
          await onInput(inputEl.value);
        });
        return inputEl;
      }
      // 创建下拉框控件。
      createSelectInput(containerEl, options, selectedValue, onChange) {
        const selectEl = containerEl.createEl("select", {
          cls: "nene-menu-customizer-select"
        });
        options.forEach((option) => {
          const normalizedOption = typeof option === "string" ? { value: option, label: option } : option;
          const optionEl = selectEl.createEl("option", {
            text: normalizedOption.label
          });
          optionEl.value = normalizedOption.value;
        });
        if (selectedValue) {
          selectEl.value = selectedValue;
        }
        selectEl.addEventListener("change", async () => {
          await onChange(selectEl.value);
        });
        return selectEl;
      }
      // 创建开关控件。
      createSwitchControl(containerEl, checked, onChange, labelText) {
        const wrapperEl = containerEl.createDiv({ cls: "nene-menu-customizer-switch" });
        const inputEl = wrapperEl.createEl("input", {
          type: "checkbox"
        });
        inputEl.checked = Boolean(checked);
        const labelEl = wrapperEl.createSpan({
          cls: "nene-menu-customizer-switch-label",
          text: labelText || (checked ? "已开启" : "已关闭")
        });
        inputEl.addEventListener("change", async () => {
          if (!labelText) {
            labelEl.setText(inputEl.checked ? "已开启" : "已关闭");
          }
          await onChange(inputEl.checked);
        });
        return wrapperEl;
      }
      // 创建统一风格的小图标按钮，减少重复代码。
      createIconButton(containerEl, iconName, tooltip, disabled, onClick, isDanger) {
        const buttonEl = containerEl.createEl("button", {
          cls: `clickable-icon${isDanger ? " mod-warning" : ""}`
        });
        obsidian2.setIcon(buttonEl, iconName);
        buttonEl.ariaLabel = tooltip;
        buttonEl.disabled = Boolean(disabled);
        buttonEl.addEventListener("click", async () => {
          if (buttonEl.disabled) {
            return;
          }
          await onClick();
        });
      }
      // 关闭弹窗时清理 DOM。
      onClose() {
        this.contentEl.empty();
      }
    };
    module2.exports = {
      MenuCustomizerManagementModal
    };
  }
});

// src/modules/context-menu-enhancer/index.js
var require_context_menu_enhancer = __commonJS({
  "src/modules/context-menu-enhancer/index.js"(exports2, module2) {
    "use strict";
    var constants = require_constants4();
    var runtime = require_runtime3();
    var store = require_store7();
    var view = require_view5();
    module2.exports = Object.assign({}, constants, runtime, store, view);
  }
});

// node_modules/wildcard-match/build/index.js
var require_build = __commonJS({
  "node_modules/wildcard-match/build/index.js"(exports2, module2) {
    "use strict";
    function escapeRegExpChar(char) {
      if (char === "-" || char === "^" || char === "$" || char === "+" || char === "." || char === "(" || char === ")" || char === "|" || char === "[" || char === "]" || char === "{" || char === "}" || char === "*" || char === "?" || char === "\\") {
        return "\\".concat(char);
      } else {
        return char;
      }
    }
    function escapeRegExpString(str) {
      var result = "";
      for (var i = 0; i < str.length; i++) {
        result += escapeRegExpChar(str[i]);
      }
      return result;
    }
    function transform(pattern, separator) {
      if (separator === void 0) {
        separator = true;
      }
      if (Array.isArray(pattern)) {
        var regExpPatterns = pattern.map(function(p) {
          return "^".concat(transform(p, separator), "$");
        });
        return "(?:".concat(regExpPatterns.join("|"), ")");
      }
      var separatorSplitter = "";
      var separatorMatcher = "";
      var wildcard = ".";
      if (separator === true) {
        separatorSplitter = "/";
        separatorMatcher = "[/\\\\]";
        wildcard = "[^/\\\\]";
      } else if (separator) {
        separatorSplitter = separator;
        separatorMatcher = escapeRegExpString(separatorSplitter);
        if (separatorMatcher.length > 1) {
          separatorMatcher = "(?:".concat(separatorMatcher, ")");
          wildcard = "((?!".concat(separatorMatcher, ").)");
        } else {
          wildcard = "[^".concat(separatorMatcher, "]");
        }
      }
      var requiredSeparator = separator ? "".concat(separatorMatcher, "+?") : "";
      var optionalSeparator = separator ? "".concat(separatorMatcher, "*?") : "";
      var segments = separator ? pattern.split(separatorSplitter) : [pattern];
      var result = "";
      for (var s = 0; s < segments.length; s++) {
        var segment = segments[s];
        var nextSegment = segments[s + 1];
        var currentSeparator = "";
        if (!segment && s > 0) {
          continue;
        }
        if (separator) {
          if (s === segments.length - 1) {
            currentSeparator = optionalSeparator;
          } else if (nextSegment !== "**") {
            currentSeparator = requiredSeparator;
          } else {
            currentSeparator = "";
          }
        }
        if (separator && segment === "**") {
          if (currentSeparator) {
            result += s === 0 ? "" : s === segments.length - 1 ? "(?:".concat(requiredSeparator, "|$)") : requiredSeparator;
            result += "(?:".concat(wildcard, "*?").concat(currentSeparator, ")*?");
          }
          continue;
        }
        for (var c = 0; c < segment.length; c++) {
          var char = segment[c];
          if (char === "\\") {
            if (c < segment.length - 1) {
              result += escapeRegExpChar(segment[c + 1]);
              c++;
            }
          } else if (char === "?") {
            result += wildcard;
          } else if (char === "*") {
            result += "".concat(wildcard, "*?");
          } else {
            result += escapeRegExpChar(char);
          }
        }
        result += currentSeparator;
      }
      return result;
    }
    function isMatch(regexp, sample) {
      if (typeof sample !== "string") {
        throw new TypeError("Sample must be a string, but ".concat(typeof sample, " given"));
      }
      return regexp.test(sample);
    }
    function wildcardMatch(pattern, options) {
      if (typeof pattern !== "string" && !Array.isArray(pattern)) {
        throw new TypeError("The first argument must be a single pattern string or an array of patterns, but ".concat(typeof pattern, " given"));
      }
      if (typeof options === "string" || typeof options === "boolean") {
        options = { separator: options };
      }
      if (arguments.length === 2 && !(typeof options === "undefined" || typeof options === "object" && options !== null && !Array.isArray(options))) {
        throw new TypeError("The second argument must be an options object or a string/boolean separator, but ".concat(typeof options, " given"));
      }
      options = options || {};
      if (options.separator === "\\") {
        throw new Error("\\ is not a valid separator because it is used for escaping. Try setting the separator to `true` instead");
      }
      var regexpPattern = transform(pattern, options.separator);
      var regexp = new RegExp("^".concat(regexpPattern, "$"), options.flags);
      var fn = isMatch.bind(null, regexp);
      fn.options = options;
      fn.pattern = pattern;
      fn.regexp = regexp;
      return fn;
    }
    module2.exports = wildcardMatch;
  }
});

// src/modules/file-explorer-enhancer/store.js
var require_store8 = __commonJS({
  "src/modules/file-explorer-enhancer/store.js"(exports2, module2) {
    "use strict";
    var constants = require_constants7();
    var obsidian2 = require("obsidian");
    var FileExplorerEnhancerStore = class {
      constructor(plugin) {
        this.plugin = plugin;
        this.settings = this.normalizeSettings();
        this.strictHidePaths = /* @__PURE__ */ new Map();
        this.strictPinPaths = /* @__PURE__ */ new Map();
        this.fileStateCache = /* @__PURE__ */ new Map();
        this.cacheVersion = 0;
      }
      // 挂载插件数据仓库中的文件资源管理器增强切片，并预编译匹配器 + 构建 STRICT Map。
      // 首次加载时回写磁盘，确保旧数据补全 position 等归一化字段。
      load(settings) {
        this.settings = this.normalizeSettings(settings);
        this.plugin.dataStore.setFileExplorerEnhancerData(this.settings);
        this.plugin.dataStore.saveFileExplorerEnhancerData(this.settings);
        this.compileAllFilters();
        this.buildStrictMaps();
        this.invalidateCache();
      }
      // 将最新数据同步到插件级数据仓库并持久化，之后重建编译缓存。
      async save() {
        this.settings = this.normalizeSettings(this.settings);
        this.compileAllFilters();
        this.buildStrictMaps();
        this.invalidateCache();
        await this.plugin.dataStore.saveFileExplorerEnhancerData(this.settings);
      }
      // 返回完整配置对象。
      getSettings() {
        return this.settings;
      }
      // --------------------------------
      //  预编译优化：将 RegExp / wildcard 编译从「每次匹配」转移到「filter 变更时」
      // --------------------------------
      // 遍历所有激活的过滤器规则，预编译 _regex 与 _matcher 并挂载到 filter 对象上。
      // 无效 filter 或 STRICT 模式（走 Map 查找）不编译。
      compileAllFilters() {
        var allPathFilters = this.settings.pinFilters.paths.concat(this.settings.hideFilters.paths);
        for (var i = 0; i < allPathFilters.length; i++) {
          var f = allPathFilters[i];
          delete f._regex;
          delete f._matcher;
          if (!f.active || !f.pattern) continue;
          if (f.patternType === "STRICT") continue;
          if (f.patternType === "REGEX") {
            try {
              f._regex = new RegExp(f.pattern);
            } catch (e) {
              f._regex = null;
            }
          } else if (f.patternType === "WILDCARD") {
            try {
              var wcmatch = require_build();
              var fn = typeof wcmatch === "function" ? wcmatch : wcmatch.default;
              f._matcher = fn(f.pattern);
            } catch (e) {
              f._matcher = null;
            }
          }
        }
      }
      // --------------------------------
      //  STRICT 模式 Map 化：将精确匹配路径存入 Set，实现 O(1) 查找
      // --------------------------------
      buildStrictMaps() {
        this.strictHidePaths.clear();
        this.strictPinPaths.clear();
        var hidePaths = this.settings.hideFilters.paths;
        for (var i = 0; i < hidePaths.length; i++) {
          var f = hidePaths[i];
          if (f.active && f.patternType === "STRICT" && f.pattern) {
            this.strictHidePaths.set(f.pattern, true);
          }
        }
        var pinPaths = this.settings.pinFilters.paths;
        for (var j = 0; j < pinPaths.length; j++) {
          var f2 = pinPaths[j];
          if (f2.active && f2.patternType === "STRICT" && f2.pattern) {
            this.strictPinPaths.set(f2.pattern, true);
          }
        }
      }
      // O(1) 检查文件是否被 STRICT 模式隐藏。
      checkStrictHide(file) {
        return this.strictHidePaths.has(file.path) || this.strictHidePaths.has(file.path.replace(/\.md$/g, "")) || this.strictHidePaths.has(file.basename || file.name);
      }
      // O(1) 检查文件是否被 STRICT 模式置顶。
      checkStrictPin(file) {
        return this.strictPinPaths.has(file.path) || this.strictPinPaths.has(file.path.replace(/\.md$/g, "")) || this.strictPinPaths.has(file.basename || file.name);
      }
      // --------------------------------
      //  文件状态缓存：避免每次全量重算
      // --------------------------------
      // 使全部缓存失效，settings 变更或 filter 变更时调用。
      invalidateCache() {
        this.cacheVersion++;
        this.fileStateCache.clear();
      }
      // 获取文件状态（pinned / hidden），优先读缓存。
      getFileState(file) {
        var cached = this.fileStateCache.get(file.path);
        if (cached && cached.version === this.cacheVersion) {
          return cached;
        }
        var state = {
          pinned: false,
          hidden: false,
          version: this.cacheVersion
        };
        if (this.settings.hideFilters.active) {
          state.hidden = this.computeShouldHide(file);
        }
        if (this.settings.pinFilters.active) {
          state.pinned = this.computeShouldPin(file);
        }
        this.fileStateCache.set(file.path, state);
        return state;
      }
      // 计算文件是否需要隐藏（不走缓存）。
      computeShouldHide(file) {
        if (this.checkStrictHide(file)) return true;
        return this.settings.hideFilters.paths.some(function(f) {
          if (!f.active || f.patternType === "STRICT") return false;
          return quickCheckPathFilter(f, file);
        });
      }
      // 计算文件是否需要置顶（不走缓存）。
      computeShouldPin(file) {
        if (this.checkStrictPin(file)) return true;
        return this.settings.pinFilters.paths.some(function(f) {
          if (!f.active || f.patternType === "STRICT") return false;
          return quickCheckPathFilter(f, file);
        });
      }
      // 更新单个文件的状态缓存，rename / delete / metadata change 时调用。
      updateFileState(file) {
        this.fileStateCache.delete(file.path);
        this.fileStateCache.delete(file.path.replace(/\.md$/g, ""));
      }
      // --------------------------------
      //  归一化
      // --------------------------------
      normalizeSettings(data) {
        var source = data && typeof data === "object" && !Array.isArray(data) ? data : {};
        var defaults = constants.DEFAULT_FILE_EXPLORER_ENHANCER_SETTINGS;
        return {
          pinFilters: {
            active: source.pinFilters && source.pinFilters.active === true,
            paths: Array.isArray(source.pinFilters && source.pinFilters.paths) ? this.normalizePathFilters(source.pinFilters.paths) : defaults.pinFilters.paths
          },
          hideFilters: {
            active: source.hideFilters && source.hideFilters.active === true,
            paths: Array.isArray(source.hideFilters && source.hideFilters.paths) ? this.normalizePathFilters(source.hideFilters.paths) : defaults.hideFilters.paths
          }
        };
      }
      normalizePathFilters(filters) {
        return filters.filter(function(f) {
          return f && typeof f === "object" && !Array.isArray(f);
        }).map(function(f, idx) {
          return {
            name: typeof f.name === "string" ? f.name : "",
            active: f.active !== false,
            type: ["FILES", "DIRECTORIES", "FILES_AND_DIRECTORIES"].indexOf(f.type) !== -1 ? f.type : "FILES_AND_DIRECTORIES",
            pattern: typeof f.pattern === "string" ? f.pattern : "",
            patternType: ["REGEX", "WILDCARD", "STRICT"].indexOf(f.patternType) !== -1 ? f.patternType : "STRICT",
            position: typeof f.position === "number" && !isNaN(f.position) ? f.position : idx
          };
        }).sort(function(a, b) {
          return a.position - b.position;
        });
      }
    };
    function quickCheckPathFilter(filter, file) {
      if (!filter.active || filter.pattern === "") return false;
      if (filter.type === "FILES" && file instanceof obsidian2.TFolder) return false;
      if (filter.type === "DIRECTORIES" && file instanceof obsidian2.TFile) return false;
      if (filter.patternType === "REGEX") {
        if (!filter._regex) return false;
        return filter._regex.test(file.path) || filter._regex.test(file.path.replace(/\.md$/g, "")) || filter._regex.test(file.basename || file.name);
      } else if (filter.patternType === "WILDCARD") {
        if (!filter._matcher) return false;
        return filter._matcher(file.path) || filter._matcher(file.path.replace(/\.md$/g, "")) || filter._matcher(file.basename || file.name);
      }
      return false;
    }
    module2.exports = {
      FileExplorerEnhancerStore,
      quickCheckPathFilter
    };
  }
});

// node_modules/monkey-around/index.js
var require_monkey_around = __commonJS({
  "node_modules/monkey-around/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.serialize = exports2.after = exports2.dedupe = exports2.around = void 0;
    function around(obj, factories) {
      const removers = Object.keys(factories).map((key) => around1(obj, key, factories[key]));
      return removers.length === 1 ? removers[0] : function() {
        removers.forEach((r) => r());
      };
    }
    exports2.around = around;
    function around1(obj, method, createWrapper) {
      const original = obj[method], hadOwn = obj.hasOwnProperty(method);
      let current = createWrapper(original);
      if (original)
        Object.setPrototypeOf(current, original);
      Object.setPrototypeOf(wrapper, current);
      obj[method] = wrapper;
      return remove;
      function wrapper(...args) {
        if (current === original && obj[method] === wrapper)
          remove();
        return current.apply(this, args);
      }
      function remove() {
        if (obj[method] === wrapper) {
          if (hadOwn)
            obj[method] = original;
          else
            delete obj[method];
        }
        if (current === original)
          return;
        current = original;
        Object.setPrototypeOf(wrapper, original || Function);
      }
    }
    function dedupe(key, oldFn, newFn) {
      check[key] = key;
      return check;
      function check(...args) {
        return (oldFn[key] === key ? oldFn : newFn).apply(this, args);
      }
    }
    exports2.dedupe = dedupe;
    function after(promise, cb) {
      return promise.then(cb, cb);
    }
    exports2.after = after;
    function serialize(asyncFunction) {
      let lastRun = Promise.resolve();
      function wrapper(...args) {
        return lastRun = new Promise((res, rej) => {
          after(lastRun, () => {
            asyncFunction.apply(this, args).then(res, rej);
          });
        });
      }
      wrapper.after = function() {
        return lastRun = new Promise((res, rej) => {
          after(lastRun, res);
        });
      };
      return wrapper;
    }
    exports2.serialize = serialize;
  }
});

// src/modules/file-explorer-enhancer/runtime.js
var require_runtime4 = __commonJS({
  "src/modules/file-explorer-enhancer/runtime.js"(exports2, module2) {
    "use strict";
    var obsidian2 = require("obsidian");
    var around = require_monkey_around().around || require_monkey_around();
    function changeVirtualElementPin(vEl, pin, applyDOM) {
      if (applyDOM === void 0) applyDOM = true;
      if (pin) {
        vEl.info.pinned = true;
        if (applyDOM && !vEl.el.hasClass("tree-item-pinned")) {
          vEl.el.addClass("tree-item-pinned");
          var pinDiv = document.createElement("div");
          pinDiv.addClass("file-explorer-plus");
          pinDiv.addClass("pin-icon");
          obsidian2.setIcon(pinDiv, "pin");
          if (vEl.el.firstChild) {
            vEl.el.firstChild.insertBefore(pinDiv, vEl.el.firstChild.firstChild);
          }
        }
      } else {
        vEl.info.pinned = false;
        if (applyDOM && vEl.el.hasClass("tree-item-pinned")) {
          vEl.el.removeClass("tree-item-pinned");
          var firstChild = vEl.el.firstChild;
          if (firstChild && firstChild.children) {
            var pinIcons = Array.from(firstChild.children).filter(function(el) {
              return el.hasClass("pin-icon");
            });
            pinIcons.forEach(function(icon) {
              if (firstChild) firstChild.removeChild(icon);
            });
          }
        }
      }
      return vEl;
    }
    function checkPathFilter(filter, file) {
      if (!filter.active || filter.pattern === "") return false;
      if (filter.type === "FILES" && file instanceof obsidian2.TFolder) return false;
      if (filter.type === "DIRECTORIES" && file instanceof obsidian2.TFile) return false;
      if (filter.patternType === "STRICT") {
        return file.path === filter.pattern || file.path.replace(/\.md$/g, "") === filter.pattern || (file.basename || file.name) === filter.pattern;
      }
      if (filter.patternType === "REGEX") {
        if (!filter._regex) return false;
        return filter._regex.test(file.path) || filter._regex.test(file.path.replace(/\.md$/g, "")) || filter._regex.test(file.basename || file.name);
      }
      if (filter.patternType === "WILDCARD") {
        if (!filter._matcher) return false;
        return filter._matcher(file.path) || filter._matcher(file.path.replace(/\.md$/g, "")) || filter._matcher(file.basename || file.name);
      }
      return false;
    }
    function checkPathFilterAllowInactive(filter, file) {
      if (!filter || filter.pattern === "") return false;
      if (filter.type === "FILES" && file instanceof obsidian2.TFolder) return false;
      if (filter.type === "DIRECTORIES" && file instanceof obsidian2.TFile) return false;
      if (filter.patternType === "STRICT") {
        return file.path === filter.pattern || file.path.replace(/\.md$/g, "") === filter.pattern || (file.basename || file.name) === filter.pattern;
      }
      if (filter.patternType === "REGEX") {
        if (!filter._regex) return false;
        return filter._regex.test(file.path) || filter._regex.test(file.path.replace(/\.md$/g, "")) || filter._regex.test(file.basename || file.name);
      }
      if (filter.patternType === "WILDCARD") {
        if (!filter._matcher) return false;
        return filter._matcher(file.path) || filter._matcher(file.path.replace(/\.md$/g, "")) || filter._matcher(file.basename || file.name);
      }
      return false;
    }
    function isFileTemporarilyRevealed(plugin, file) {
      if (plugin._eyeRevealedPaths && plugin._eyeRevealedPaths.has(file.path)) return true;
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
    function addOnRename(plugin) {
      plugin.registerEvent(
        plugin.app.vault.on("rename", function(file, oldPath) {
          var settings = plugin.fileExplorerEnhancerSettings;
          var newPath = file.path;
          var hasChanged = false;
          var oldPathPrefix = oldPath + "/";
          var isFolder = file instanceof obsidian2.TFolder;
          for (var i = 0; i < settings.hideFilters.paths.length; i++) {
            var hf = settings.hideFilters.paths[i];
            if (hf.patternType !== "STRICT" || !hf.pattern) continue;
            if (hf.pattern === oldPath) {
              hf.pattern = newPath;
              hasChanged = true;
            } else if (isFolder && hf.pattern.indexOf(oldPathPrefix) === 0) {
              hf.pattern = newPath + "/" + hf.pattern.slice(oldPathPrefix.length);
              hasChanged = true;
            }
          }
          for (var j = 0; j < settings.pinFilters.paths.length; j++) {
            var pf = settings.pinFilters.paths[j];
            if (pf.patternType !== "STRICT" || !pf.pattern) continue;
            if (pf.pattern === oldPath) {
              pf.pattern = newPath;
              hasChanged = true;
            } else if (isFolder && pf.pattern.indexOf(oldPathPrefix) === 0) {
              pf.pattern = newPath + "/" + pf.pattern.slice(oldPathPrefix.length);
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
    function addOnDelete(plugin) {
      plugin.registerEvent(
        plugin.app.vault.on("delete", function(file) {
          var settings = plugin.fileExplorerEnhancerSettings;
          var deletedPath = file.path;
          var hasChanged = false;
          var deletedPathPrefix = deletedPath + "/";
          var isFolder = file instanceof obsidian2.TFolder;
          var newHidePaths = [];
          for (var i = 0; i < settings.hideFilters.paths.length; i++) {
            var hf = settings.hideFilters.paths[i];
            if (hf.patternType === "STRICT" && hf.pattern) {
              if (hf.pattern === deletedPath || isFolder && hf.pattern.indexOf(deletedPathPrefix) === 0) {
                hasChanged = true;
                continue;
              }
            }
            newHidePaths.push(hf);
          }
          settings.hideFilters.paths = newHidePaths;
          var newPinPaths = [];
          for (var j = 0; j < settings.pinFilters.paths.length; j++) {
            var pf = settings.pinFilters.paths[j];
            if (pf.patternType === "STRICT" && pf.pattern) {
              if (pf.pattern === deletedPath || isFolder && pf.pattern.indexOf(deletedPathPrefix) === 0) {
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
    function cacheFileMenuTarget(plugin) {
      plugin.registerEvent(
        plugin.app.workspace.on("file-menu", function(menu, path) {
          plugin.fileExplorerEnhancerStore._lastMenuTarget = path;
        })
      );
    }
    function addCommands(plugin) {
      plugin.addCommand({
        id: "pin-or-unpin-file-or-folder",
        name: "置顶/取消置顶文件或文件夹",
        callback: function() {
          var target = plugin.fileExplorerEnhancerStore._lastMenuTarget;
          if (!target) target = plugin.app.workspace.getActiveFile();
          if (!target) {
            new obsidian2.Notice("没有可操作的目标");
            return;
          }
          var settings = plugin.fileExplorerEnhancerSettings;
          var type = target instanceof obsidian2.TFile ? "FILES" : "DIRECTORIES";
          var index = settings.pinFilters.paths.findIndex(function(filter) {
            return filter.patternType === "STRICT" && filter.type === type && filter.pattern === target.path;
          });
          if (index === -1 || !settings.pinFilters.paths[index].active) {
            if (index === -1) {
              settings.pinFilters.paths.push({ name: "", active: true, type, pattern: target.path, patternType: "STRICT" });
            } else {
              settings.pinFilters.paths[index].active = true;
            }
            new obsidian2.Notice("已置顶：" + target.path);
          } else {
            settings.pinFilters.paths.splice(index, 1);
            new obsidian2.Notice("已取消置顶：" + target.path);
          }
          plugin.fileExplorerEnhancerStore.save();
          if (settings.pinFilters.active && plugin._fileExplorerView) {
            plugin._fileExplorerView.requestSort();
          }
        }
      });
      plugin.addCommand({
        id: "hide-file-or-folder",
        name: "隐藏文件或文件夹",
        callback: function() {
          var target = plugin.fileExplorerEnhancerStore._lastMenuTarget;
          if (!target) target = plugin.app.workspace.getActiveFile();
          if (!target) {
            new obsidian2.Notice("没有可操作的目标");
            return;
          }
          var settings = plugin.fileExplorerEnhancerSettings;
          var type = target instanceof obsidian2.TFile ? "FILES" : "DIRECTORIES";
          var index = settings.hideFilters.paths.findIndex(function(filter) {
            return filter.patternType === "STRICT" && filter.type === type && filter.pattern === target.path;
          });
          if (index === -1) {
            settings.hideFilters.paths.push({ name: "", active: true, type, pattern: target.path, patternType: "STRICT" });
            new obsidian2.Notice("已隐藏：" + target.path);
          } else {
            if (!settings.hideFilters.paths[index].active) {
              settings.hideFilters.paths[index].active = true;
              new obsidian2.Notice("已隐藏：" + target.path);
            }
          }
          plugin.fileExplorerEnhancerStore.save();
          if (settings.hideFilters.active && plugin._fileExplorerView) {
            plugin._fileExplorerView.requestSort();
          }
        }
      });
    }
    function patchFileExplorerFolder(plugin, fileExplorerView) {
      var leaf = plugin.app.workspace.getLeaf(true);
      var tmpFolder = new obsidian2.TFolder(obsidian2.Vault, "");
      var Folder = fileExplorerView.createFolderDom(tmpFolder).constructor;
      plugin.register(
        around(Folder.prototype, {
          sort: function(old) {
            return function() {
              var store = plugin.fileExplorerEnhancerStore;
              var settings = plugin.fileExplorerEnhancerSettings;
              old.call(this);
              if (!plugin.isFileExplorerEnhancerEnabled()) return;
              if (!this.hiddenVChildren) {
                this.hiddenVChildren = [];
              }
              var virtualElements = this.vChildren.children;
              var hiddenVChildren = [];
              var pinnedVChildren = [];
              var unpinnedVChildren = [];
              var revealedVChildren = [];
              for (var i = 0; i < virtualElements.length; i++) {
                var vEl = virtualElements[i];
                var state = store.getFileState(vEl.file);
                var isRevealed = isFileTemporarilyRevealed(plugin, vEl.file);
                if (settings.hideFilters.active && state.hidden && !isRevealed) {
                  vEl.info.hidden = true;
                  hiddenVChildren.push(vEl);
                } else {
                  vEl.info.hidden = false;
                  if (isRevealed) {
                    changeVirtualElementPin(vEl, false, false);
                    revealedVChildren.push(vEl);
                  } else if (settings.pinFilters.active && state.pinned) {
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
                var normalVisible = unpinnedVChildren.map(function(v) {
                  return changeVirtualElementPin(v, false, false);
                });
                var pinnedCleared = pinnedVChildren.map(function(v) {
                  return changeVirtualElementPin(v, false, false);
                });
                var revealedCleared = revealedVChildren.map(function(v) {
                  return changeVirtualElementPin(v, false, false);
                });
                this.vChildren.setChildren(pinnedCleared.concat(normalVisible).concat(revealedCleared));
              }
              var rafId = this.__feRafId;
              if (rafId) cancelAnimationFrame(rafId);
              this.__feRafId = requestAnimationFrame(function() {
                var allEls = this.vChildren.children;
                for (var k = 0; k < allEls.length; k++) {
                  var v = allEls[k];
                  var isRevealed2 = isFileTemporarilyRevealed(plugin, v.file);
                  if (isRevealed2 && !v.el.hasClass("nene-eye-revealed")) {
                    v.el.addClass("nene-eye-revealed");
                  } else if (!isRevealed2 && v.el.hasClass("nene-eye-revealed")) {
                    v.el.removeClass("nene-eye-revealed");
                  }
                  if (v.info.pinned && !v.el.hasClass("tree-item-pinned")) {
                    v.el.addClass("tree-item-pinned");
                    var pinDiv = document.createElement("div");
                    pinDiv.addClass("file-explorer-plus");
                    pinDiv.addClass("pin-icon");
                    obsidian2.setIcon(pinDiv, "pin");
                    if (v.el.firstChild) {
                      v.el.firstChild.insertBefore(pinDiv, v.el.firstChild.firstChild);
                    }
                  } else if (!v.info.pinned && v.el.hasClass("tree-item-pinned")) {
                    v.el.removeClass("tree-item-pinned");
                    var fc = v.el.firstChild;
                    if (fc && fc.children) {
                      var icons = Array.from(fc.children).filter(function(e) {
                        return e.hasClass("pin-icon");
                      });
                      icons.forEach(function(icon) {
                        if (fc) fc.removeChild(icon);
                      });
                    }
                  }
                }
                var hiddenEls = this.hiddenVChildren || [];
                for (var h = 0; h < hiddenEls.length; h++) {
                  var hv = hiddenEls[h];
                  if (hv.el.hasClass("nene-eye-revealed")) {
                    hv.el.removeClass("nene-eye-revealed");
                  }
                }
              }.bind(this));
            };
          }
        })
      );
      leaf.detach();
    }
    function getPathsToPin(plugin, paths) {
      var store = plugin.fileExplorerEnhancerStore;
      var settings = plugin.fileExplorerEnhancerSettings;
      var nonStrictActiveFilters = [];
      for (var i = 0; i < settings.pinFilters.paths.length; i++) {
        var f = settings.pinFilters.paths[i];
        if (f.active && f.patternType !== "STRICT") nonStrictActiveFilters.push(f);
      }
      if (store.strictPinPaths.size === 0 && nonStrictActiveFilters.length === 0) return [];
      return paths.filter(function(path) {
        if (!path) return false;
        if (store.checkStrictPin(path)) return true;
        return nonStrictActiveFilters.some(function(filter) {
          return checkPathFilter(filter, path);
        });
      });
    }
    function getPathsToHide(plugin, paths) {
      var store = plugin.fileExplorerEnhancerStore;
      var settings = plugin.fileExplorerEnhancerSettings;
      var nonStrictActiveFilters = [];
      for (var i = 0; i < settings.hideFilters.paths.length; i++) {
        var f = settings.hideFilters.paths[i];
        if (f.active && f.patternType !== "STRICT") nonStrictActiveFilters.push(f);
      }
      if (store.strictHidePaths.size === 0 && nonStrictActiveFilters.length === 0) return [];
      return paths.filter(function(path) {
        if (!path) return false;
        if (store.checkStrictHide(path)) return true;
        return nonStrictActiveFilters.some(function(filter) {
          return checkPathFilter(filter, path);
        });
      });
    }
    function unloadFileExplorerEnhancer(plugin, fileExplorerView) {
      for (var key in fileExplorerView.fileItems) {
        if (fileExplorerView.fileItems.hasOwnProperty(key)) {
          var vEl = fileExplorerView.fileItems[key];
          if (vEl.__feRafId) cancelAnimationFrame(vEl.__feRafId);
          fileExplorerView.fileItems[key] = changeVirtualElementPin(vEl, false);
          if (vEl.el.hasClass("nene-eye-revealed")) {
            vEl.el.removeClass("nene-eye-revealed");
          }
        }
      }
      fileExplorerView.requestSort();
    }
    function refreshCompiledState(plugin) {
      plugin.fileExplorerEnhancerStore.compileAllFilters();
      plugin.fileExplorerEnhancerStore.buildStrictMaps();
      plugin.fileExplorerEnhancerStore.invalidateCache();
    }
    function injectEyeButtons(plugin, view) {
      var navHeader = view.containerEl.querySelector(".nav-header");
      if (!navHeader) return;
      var buttonsContainer = navHeader.querySelector(".nav-buttons-container");
      if (!buttonsContainer) return;
      if (buttonsContainer.querySelector(".nene-eye-toggle-button")) return;
      var eyeBtn = document.createElement("button");
      eyeBtn.className = "clickable-icon nav-action-button nene-eye-toggle-button";
      eyeBtn.setAttribute("type", "button");
      eyeBtn.setAttribute("aria-label", "");
      obsidian2.setIcon(eyeBtn, "eye");
      eyeBtn.disabled = true;
      eyeBtn.addEventListener("click", function() {
        handleEyeClick(plugin);
      });
      var restoreBtn = document.createElement("button");
      restoreBtn.className = "clickable-icon nav-action-button nene-eye-restore-button";
      restoreBtn.setAttribute("type", "button");
      restoreBtn.setAttribute("aria-label", "");
      obsidian2.setIcon(restoreBtn, "rotate-ccw");
      restoreBtn.disabled = true;
      restoreBtn.addEventListener("click", function() {
        handleRestoreClick(plugin);
      });
      buttonsContainer.appendChild(eyeBtn);
      buttonsContainer.appendChild(restoreBtn);
      plugin._eyeToggleBtn = eyeBtn;
      plugin._eyeRestoreBtn = restoreBtn;
      updateEyeButtonState(plugin);
      updateRestoreButtonState(plugin);
    }
    function removeEyeButtons() {
      var eyeBtn = document.querySelector(".nene-eye-toggle-button");
      var restoreBtn = document.querySelector(".nene-eye-restore-button");
      if (eyeBtn && eyeBtn.parentNode) eyeBtn.parentNode.removeChild(eyeBtn);
      if (restoreBtn && restoreBtn.parentNode) restoreBtn.parentNode.removeChild(restoreBtn);
    }
    function updateEyeButtonState(plugin) {
      var btn = plugin._eyeToggleBtn;
      if (!btn) return;
      clearEyeTargetHighlight(plugin);
      var dirPath = getTargetDirectory(plugin);
      if (dirPath === null) {
        obsidian2.setIcon(btn, "eye");
        btn.disabled = true;
        btn.setAttribute("aria-label", "无可用目录");
        return;
      }
      if (dirPath === "") {
        btn.addClass("nene-eye-root-mode");
      } else {
        highlightEyeTargetInFileList(plugin, dirPath);
      }
      if (hasHiddenFilesInDir(plugin, dirPath)) {
        obsidian2.setIcon(btn, "eye-off");
        btn.disabled = false;
        btn.setAttribute("aria-label", "显示当前目录下的隐藏文件");
      } else {
        obsidian2.setIcon(btn, "eye");
        btn.disabled = true;
        btn.setAttribute("aria-label", "当前目录无隐藏文件");
      }
      updateRestoreButtonState(plugin);
    }
    function clearEyeTargetHighlight(plugin) {
      var btn = plugin._eyeToggleBtn;
      if (btn) btn.removeClass("nene-eye-root-mode");
      var prevHighlight = document.querySelectorAll(".tree-item-self.nene-eye-target-bg");
      for (var i = 0; i < prevHighlight.length; i++) {
        prevHighlight[i].removeClass("nene-eye-target-bg");
      }
    }
    function highlightEyeTargetInFileList(plugin, dirPath) {
      var view = plugin._fileExplorerView;
      if (!view || !view.fileItems) return;
      var keys = Object.keys(view.fileItems);
      for (var i = 0; i < keys.length; i++) {
        var vEl = view.fileItems[keys[i]];
        if (!vEl || !vEl.file) continue;
        if (vEl.file.path === dirPath) {
          var targetSelf = vEl.el.querySelector(".tree-item-self");
          if (targetSelf) targetSelf.addClass("nene-eye-target-bg");
          return;
        }
      }
    }
    function updateRestoreButtonState(plugin) {
      var btn = plugin._eyeRestoreBtn;
      if (!btn) return;
      var history = plugin._eyeToggleHistory || [];
      var hasRevealed = plugin._eyeRevealedPaths && plugin._eyeRevealedPaths.size > 0;
      if (history.length > 0 || hasRevealed) {
        obsidian2.setIcon(btn, "rotate-ccw");
        btn.disabled = false;
        btn.setAttribute("aria-label", "恢复所有临时显示的隐藏文件");
      } else {
        obsidian2.setIcon(btn, "rotate-ccw");
        btn.disabled = true;
        btn.setAttribute("aria-label", "无需恢复");
      }
    }
    function hasHiddenFilesInDir(plugin, dirPath) {
      var settings = plugin.fileExplorerEnhancerSettings;
      var hidePaths = settings.hideFilters.paths;
      var activeFilters = [];
      for (var i = 0; i < hidePaths.length; i++) {
        var f = hidePaths[i];
        if (f.active && f.pattern) {
          activeFilters.push(f);
        }
      }
      if (activeFilters.length === 0) return false;
      var isRoot = dirPath === "";
      var dirPrefix = isRoot ? "" : dirPath.endsWith("/") ? dirPath : dirPath + "/";
      var allFiles = plugin.app.vault.getAllLoadedFiles();
      for (var j = 0; j < allFiles.length; j++) {
        var file = allFiles[j];
        if (isRoot) {
          if (file.path.indexOf("/") !== -1) continue;
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
    function handleEyeClick(plugin) {
      var dirPath = getTargetDirectory(plugin);
      if (dirPath === null) return;
      var isRoot = dirPath === "";
      if (isRoot) {
        if (!plugin._eyeRevealedPaths) plugin._eyeRevealedPaths = /* @__PURE__ */ new Set();
        var settings = plugin.fileExplorerEnhancerSettings;
        var hidePaths = settings.hideFilters.paths;
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
          if (file.path.indexOf("/") !== -1) continue;
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
      var dirPrefix = dirPath.endsWith("/") ? dirPath : dirPath + "/";
      var settings2 = plugin.fileExplorerEnhancerSettings;
      var hidePaths2 = settings2.hideFilters.paths;
      if (!plugin._eyeToggleHistory) plugin._eyeToggleHistory = [];
      var allFiles2 = plugin.app.vault.getAllLoadedFiles();
      var hasChanges = false;
      for (var i = 0; i < hidePaths2.length; i++) {
        var f2 = hidePaths2[i];
        if (!f2.active || !f2.pattern) continue;
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
    function handleRestoreClick(plugin) {
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
      var hadRevealed = plugin._eyeRevealedPaths && plugin._eyeRevealedPaths.size > 0;
      plugin._eyeRevealedPaths = null;
      plugin._lastFocusedFile = null;
      if (hadRevealed || history && history.length > 0) {
        if (plugin._fileExplorerView) {
          plugin._fileExplorerView.requestSort();
        }
      }
      updateEyeButtonState(plugin);
      updateRestoreButtonState(plugin);
    }
    function getTargetDirectory(plugin) {
      var lastFile = plugin._lastFocusedFile;
      if (lastFile) {
        if (lastFile instanceof obsidian2.TFolder) {
          return normalizeRootPath(lastFile.path);
        }
        if (lastFile instanceof obsidian2.TFile) {
          return lastFile.parent ? normalizeRootPath(lastFile.parent.path) : "";
        }
      }
      var activeFile = plugin.app.workspace.getActiveFile();
      if (activeFile && activeFile.parent) {
        return normalizeRootPath(activeFile.parent.path);
      }
      return "";
    }
    function normalizeRootPath(path) {
      if (path === "/" || path === "\\") return "";
      return path;
    }
    function setupFileExplorerFocusTracking(plugin) {
      if (!plugin._fileExplorerView) return;
      var containerEl = plugin._fileExplorerView.containerEl;
      if (!containerEl) return;
      if (plugin._eyeFocusTrackingBound) return;
      plugin._eyeFocusTrackingBound = true;
      containerEl.addEventListener("click", function(event) {
        var treeItem = event.target.closest(".tree-item");
        if (!treeItem) {
          plugin._lastFocusedFile = null;
          updateEyeButtonState(plugin);
          return;
        }
        var fileItems = plugin._fileExplorerView.fileItems;
        if (!fileItems) return;
        var innerEl = treeItem.querySelector(".tree-item-self .tree-item-inner");
        if (!innerEl) return;
        var title = innerEl.textContent || "";
        var filePath = "";
        var keys = Object.keys(fileItems);
        for (var i = 0; i < keys.length; i++) {
          var vEl = fileItems[keys[i]];
          if (!vEl || !vEl.file) continue;
          var fName = vEl.file.name || vEl.file.basename || "";
          if (fName === title) {
            filePath = vEl.file.path;
            plugin._lastFocusedFile = vEl.file;
            break;
          }
        }
        updateEyeButtonState(plugin);
      });
      if (!plugin._eyeLeafChangeBound) {
        plugin._eyeLeafChangeBound = true;
        plugin.registerEvent(
          plugin.app.workspace.on("active-leaf-change", function() {
            plugin._lastFocusedFile = null;
            updateEyeButtonState(plugin);
          })
        );
      }
    }
    module2.exports = {
      addCommands,
      addOnRename,
      addOnDelete,
      cacheFileMenuTarget,
      checkPathFilter,
      changeVirtualElementPin,
      patchFileExplorerFolder,
      getPathsToPin,
      getPathsToHide,
      unloadFileExplorerEnhancer,
      refreshCompiledState,
      injectEyeButtons,
      removeEyeButtons,
      setupFileExplorerFocusTracking,
      updateEyeButtonState
    };
  }
});

// node_modules/@popperjs/core/dist/cjs/popper.js
var require_popper = __commonJS({
  "node_modules/@popperjs/core/dist/cjs/popper.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    function getWindow(node) {
      if (node == null) {
        return window;
      }
      if (node.toString() !== "[object Window]") {
        var ownerDocument = node.ownerDocument;
        return ownerDocument ? ownerDocument.defaultView || window : window;
      }
      return node;
    }
    function isElement(node) {
      var OwnElement = getWindow(node).Element;
      return node instanceof OwnElement || node instanceof Element;
    }
    function isHTMLElement(node) {
      var OwnElement = getWindow(node).HTMLElement;
      return node instanceof OwnElement || node instanceof HTMLElement;
    }
    function isShadowRoot(node) {
      if (typeof ShadowRoot === "undefined") {
        return false;
      }
      var OwnElement = getWindow(node).ShadowRoot;
      return node instanceof OwnElement || node instanceof ShadowRoot;
    }
    var max = Math.max;
    var min = Math.min;
    var round = Math.round;
    function getUAString() {
      var uaData = navigator.userAgentData;
      if (uaData != null && uaData.brands && Array.isArray(uaData.brands)) {
        return uaData.brands.map(function(item) {
          return item.brand + "/" + item.version;
        }).join(" ");
      }
      return navigator.userAgent;
    }
    function isLayoutViewport() {
      return !/^((?!chrome|android).)*safari/i.test(getUAString());
    }
    function getBoundingClientRect(element, includeScale, isFixedStrategy) {
      if (includeScale === void 0) {
        includeScale = false;
      }
      if (isFixedStrategy === void 0) {
        isFixedStrategy = false;
      }
      var clientRect = element.getBoundingClientRect();
      var scaleX = 1;
      var scaleY = 1;
      if (includeScale && isHTMLElement(element)) {
        scaleX = element.offsetWidth > 0 ? round(clientRect.width) / element.offsetWidth || 1 : 1;
        scaleY = element.offsetHeight > 0 ? round(clientRect.height) / element.offsetHeight || 1 : 1;
      }
      var _ref = isElement(element) ? getWindow(element) : window, visualViewport = _ref.visualViewport;
      var addVisualOffsets = !isLayoutViewport() && isFixedStrategy;
      var x = (clientRect.left + (addVisualOffsets && visualViewport ? visualViewport.offsetLeft : 0)) / scaleX;
      var y = (clientRect.top + (addVisualOffsets && visualViewport ? visualViewport.offsetTop : 0)) / scaleY;
      var width = clientRect.width / scaleX;
      var height = clientRect.height / scaleY;
      return {
        width,
        height,
        top: y,
        right: x + width,
        bottom: y + height,
        left: x,
        x,
        y
      };
    }
    function getWindowScroll(node) {
      var win = getWindow(node);
      var scrollLeft = win.pageXOffset;
      var scrollTop = win.pageYOffset;
      return {
        scrollLeft,
        scrollTop
      };
    }
    function getHTMLElementScroll(element) {
      return {
        scrollLeft: element.scrollLeft,
        scrollTop: element.scrollTop
      };
    }
    function getNodeScroll(node) {
      if (node === getWindow(node) || !isHTMLElement(node)) {
        return getWindowScroll(node);
      } else {
        return getHTMLElementScroll(node);
      }
    }
    function getNodeName(element) {
      return element ? (element.nodeName || "").toLowerCase() : null;
    }
    function getDocumentElement(element) {
      return ((isElement(element) ? element.ownerDocument : (
        // $FlowFixMe[prop-missing]
        element.document
      )) || window.document).documentElement;
    }
    function getWindowScrollBarX(element) {
      return getBoundingClientRect(getDocumentElement(element)).left + getWindowScroll(element).scrollLeft;
    }
    function getComputedStyle(element) {
      return getWindow(element).getComputedStyle(element);
    }
    function isScrollParent(element) {
      var _getComputedStyle = getComputedStyle(element), overflow = _getComputedStyle.overflow, overflowX = _getComputedStyle.overflowX, overflowY = _getComputedStyle.overflowY;
      return /auto|scroll|overlay|hidden/.test(overflow + overflowY + overflowX);
    }
    function isElementScaled(element) {
      var rect = element.getBoundingClientRect();
      var scaleX = round(rect.width) / element.offsetWidth || 1;
      var scaleY = round(rect.height) / element.offsetHeight || 1;
      return scaleX !== 1 || scaleY !== 1;
    }
    function getCompositeRect(elementOrVirtualElement, offsetParent, isFixed) {
      if (isFixed === void 0) {
        isFixed = false;
      }
      var isOffsetParentAnElement = isHTMLElement(offsetParent);
      var offsetParentIsScaled = isHTMLElement(offsetParent) && isElementScaled(offsetParent);
      var documentElement = getDocumentElement(offsetParent);
      var rect = getBoundingClientRect(elementOrVirtualElement, offsetParentIsScaled, isFixed);
      var scroll = {
        scrollLeft: 0,
        scrollTop: 0
      };
      var offsets = {
        x: 0,
        y: 0
      };
      if (isOffsetParentAnElement || !isOffsetParentAnElement && !isFixed) {
        if (getNodeName(offsetParent) !== "body" || // https://github.com/popperjs/popper-core/issues/1078
        isScrollParent(documentElement)) {
          scroll = getNodeScroll(offsetParent);
        }
        if (isHTMLElement(offsetParent)) {
          offsets = getBoundingClientRect(offsetParent, true);
          offsets.x += offsetParent.clientLeft;
          offsets.y += offsetParent.clientTop;
        } else if (documentElement) {
          offsets.x = getWindowScrollBarX(documentElement);
        }
      }
      return {
        x: rect.left + scroll.scrollLeft - offsets.x,
        y: rect.top + scroll.scrollTop - offsets.y,
        width: rect.width,
        height: rect.height
      };
    }
    function getLayoutRect(element) {
      var clientRect = getBoundingClientRect(element);
      var width = element.offsetWidth;
      var height = element.offsetHeight;
      if (Math.abs(clientRect.width - width) <= 1) {
        width = clientRect.width;
      }
      if (Math.abs(clientRect.height - height) <= 1) {
        height = clientRect.height;
      }
      return {
        x: element.offsetLeft,
        y: element.offsetTop,
        width,
        height
      };
    }
    function getParentNode(element) {
      if (getNodeName(element) === "html") {
        return element;
      }
      return (
        // this is a quicker (but less type safe) way to save quite some bytes from the bundle
        // $FlowFixMe[incompatible-return]
        // $FlowFixMe[prop-missing]
        element.assignedSlot || // step into the shadow DOM of the parent of a slotted node
        element.parentNode || // DOM Element detected
        (isShadowRoot(element) ? element.host : null) || // ShadowRoot detected
        // $FlowFixMe[incompatible-call]: HTMLElement is a Node
        getDocumentElement(element)
      );
    }
    function getScrollParent(node) {
      if (["html", "body", "#document"].indexOf(getNodeName(node)) >= 0) {
        return node.ownerDocument.body;
      }
      if (isHTMLElement(node) && isScrollParent(node)) {
        return node;
      }
      return getScrollParent(getParentNode(node));
    }
    function listScrollParents(element, list) {
      var _element$ownerDocumen;
      if (list === void 0) {
        list = [];
      }
      var scrollParent = getScrollParent(element);
      var isBody = scrollParent === ((_element$ownerDocumen = element.ownerDocument) == null ? void 0 : _element$ownerDocumen.body);
      var win = getWindow(scrollParent);
      var target = isBody ? [win].concat(win.visualViewport || [], isScrollParent(scrollParent) ? scrollParent : []) : scrollParent;
      var updatedList = list.concat(target);
      return isBody ? updatedList : (
        // $FlowFixMe[incompatible-call]: isBody tells us target will be an HTMLElement here
        updatedList.concat(listScrollParents(getParentNode(target)))
      );
    }
    function isTableElement(element) {
      return ["table", "td", "th"].indexOf(getNodeName(element)) >= 0;
    }
    function getTrueOffsetParent(element) {
      if (!isHTMLElement(element) || // https://github.com/popperjs/popper-core/issues/837
      getComputedStyle(element).position === "fixed") {
        return null;
      }
      return element.offsetParent;
    }
    function getContainingBlock(element) {
      var isFirefox = /firefox/i.test(getUAString());
      var isIE = /Trident/i.test(getUAString());
      if (isIE && isHTMLElement(element)) {
        var elementCss = getComputedStyle(element);
        if (elementCss.position === "fixed") {
          return null;
        }
      }
      var currentNode = getParentNode(element);
      if (isShadowRoot(currentNode)) {
        currentNode = currentNode.host;
      }
      while (isHTMLElement(currentNode) && ["html", "body"].indexOf(getNodeName(currentNode)) < 0) {
        var css = getComputedStyle(currentNode);
        if (css.transform !== "none" || css.perspective !== "none" || css.contain === "paint" || ["transform", "perspective"].indexOf(css.willChange) !== -1 || isFirefox && css.willChange === "filter" || isFirefox && css.filter && css.filter !== "none") {
          return currentNode;
        } else {
          currentNode = currentNode.parentNode;
        }
      }
      return null;
    }
    function getOffsetParent(element) {
      var window2 = getWindow(element);
      var offsetParent = getTrueOffsetParent(element);
      while (offsetParent && isTableElement(offsetParent) && getComputedStyle(offsetParent).position === "static") {
        offsetParent = getTrueOffsetParent(offsetParent);
      }
      if (offsetParent && (getNodeName(offsetParent) === "html" || getNodeName(offsetParent) === "body" && getComputedStyle(offsetParent).position === "static")) {
        return window2;
      }
      return offsetParent || getContainingBlock(element) || window2;
    }
    var top = "top";
    var bottom = "bottom";
    var right = "right";
    var left = "left";
    var auto = "auto";
    var basePlacements = [top, bottom, right, left];
    var start = "start";
    var end = "end";
    var clippingParents = "clippingParents";
    var viewport = "viewport";
    var popper = "popper";
    var reference = "reference";
    var variationPlacements = /* @__PURE__ */ basePlacements.reduce(function(acc, placement) {
      return acc.concat([placement + "-" + start, placement + "-" + end]);
    }, []);
    var placements = /* @__PURE__ */ [].concat(basePlacements, [auto]).reduce(function(acc, placement) {
      return acc.concat([placement, placement + "-" + start, placement + "-" + end]);
    }, []);
    var beforeRead = "beforeRead";
    var read = "read";
    var afterRead = "afterRead";
    var beforeMain = "beforeMain";
    var main = "main";
    var afterMain = "afterMain";
    var beforeWrite = "beforeWrite";
    var write = "write";
    var afterWrite = "afterWrite";
    var modifierPhases = [beforeRead, read, afterRead, beforeMain, main, afterMain, beforeWrite, write, afterWrite];
    function order(modifiers) {
      var map = /* @__PURE__ */ new Map();
      var visited = /* @__PURE__ */ new Set();
      var result = [];
      modifiers.forEach(function(modifier) {
        map.set(modifier.name, modifier);
      });
      function sort(modifier) {
        visited.add(modifier.name);
        var requires = [].concat(modifier.requires || [], modifier.requiresIfExists || []);
        requires.forEach(function(dep) {
          if (!visited.has(dep)) {
            var depModifier = map.get(dep);
            if (depModifier) {
              sort(depModifier);
            }
          }
        });
        result.push(modifier);
      }
      modifiers.forEach(function(modifier) {
        if (!visited.has(modifier.name)) {
          sort(modifier);
        }
      });
      return result;
    }
    function orderModifiers(modifiers) {
      var orderedModifiers = order(modifiers);
      return modifierPhases.reduce(function(acc, phase) {
        return acc.concat(orderedModifiers.filter(function(modifier) {
          return modifier.phase === phase;
        }));
      }, []);
    }
    function debounce(fn) {
      var pending;
      return function() {
        if (!pending) {
          pending = new Promise(function(resolve) {
            Promise.resolve().then(function() {
              pending = void 0;
              resolve(fn());
            });
          });
        }
        return pending;
      };
    }
    function mergeByName(modifiers) {
      var merged = modifiers.reduce(function(merged2, current) {
        var existing = merged2[current.name];
        merged2[current.name] = existing ? Object.assign({}, existing, current, {
          options: Object.assign({}, existing.options, current.options),
          data: Object.assign({}, existing.data, current.data)
        }) : current;
        return merged2;
      }, {});
      return Object.keys(merged).map(function(key) {
        return merged[key];
      });
    }
    function getViewportRect(element, strategy) {
      var win = getWindow(element);
      var html = getDocumentElement(element);
      var visualViewport = win.visualViewport;
      var width = html.clientWidth;
      var height = html.clientHeight;
      var x = 0;
      var y = 0;
      if (visualViewport) {
        width = visualViewport.width;
        height = visualViewport.height;
        var layoutViewport = isLayoutViewport();
        if (layoutViewport || !layoutViewport && strategy === "fixed") {
          x = visualViewport.offsetLeft;
          y = visualViewport.offsetTop;
        }
      }
      return {
        width,
        height,
        x: x + getWindowScrollBarX(element),
        y
      };
    }
    function getDocumentRect(element) {
      var _element$ownerDocumen;
      var html = getDocumentElement(element);
      var winScroll = getWindowScroll(element);
      var body = (_element$ownerDocumen = element.ownerDocument) == null ? void 0 : _element$ownerDocumen.body;
      var width = max(html.scrollWidth, html.clientWidth, body ? body.scrollWidth : 0, body ? body.clientWidth : 0);
      var height = max(html.scrollHeight, html.clientHeight, body ? body.scrollHeight : 0, body ? body.clientHeight : 0);
      var x = -winScroll.scrollLeft + getWindowScrollBarX(element);
      var y = -winScroll.scrollTop;
      if (getComputedStyle(body || html).direction === "rtl") {
        x += max(html.clientWidth, body ? body.clientWidth : 0) - width;
      }
      return {
        width,
        height,
        x,
        y
      };
    }
    function contains(parent, child) {
      var rootNode = child.getRootNode && child.getRootNode();
      if (parent.contains(child)) {
        return true;
      } else if (rootNode && isShadowRoot(rootNode)) {
        var next = child;
        do {
          if (next && parent.isSameNode(next)) {
            return true;
          }
          next = next.parentNode || next.host;
        } while (next);
      }
      return false;
    }
    function rectToClientRect(rect) {
      return Object.assign({}, rect, {
        left: rect.x,
        top: rect.y,
        right: rect.x + rect.width,
        bottom: rect.y + rect.height
      });
    }
    function getInnerBoundingClientRect(element, strategy) {
      var rect = getBoundingClientRect(element, false, strategy === "fixed");
      rect.top = rect.top + element.clientTop;
      rect.left = rect.left + element.clientLeft;
      rect.bottom = rect.top + element.clientHeight;
      rect.right = rect.left + element.clientWidth;
      rect.width = element.clientWidth;
      rect.height = element.clientHeight;
      rect.x = rect.left;
      rect.y = rect.top;
      return rect;
    }
    function getClientRectFromMixedType(element, clippingParent, strategy) {
      return clippingParent === viewport ? rectToClientRect(getViewportRect(element, strategy)) : isElement(clippingParent) ? getInnerBoundingClientRect(clippingParent, strategy) : rectToClientRect(getDocumentRect(getDocumentElement(element)));
    }
    function getClippingParents(element) {
      var clippingParents2 = listScrollParents(getParentNode(element));
      var canEscapeClipping = ["absolute", "fixed"].indexOf(getComputedStyle(element).position) >= 0;
      var clipperElement = canEscapeClipping && isHTMLElement(element) ? getOffsetParent(element) : element;
      if (!isElement(clipperElement)) {
        return [];
      }
      return clippingParents2.filter(function(clippingParent) {
        return isElement(clippingParent) && contains(clippingParent, clipperElement) && getNodeName(clippingParent) !== "body";
      });
    }
    function getClippingRect(element, boundary, rootBoundary, strategy) {
      var mainClippingParents = boundary === "clippingParents" ? getClippingParents(element) : [].concat(boundary);
      var clippingParents2 = [].concat(mainClippingParents, [rootBoundary]);
      var firstClippingParent = clippingParents2[0];
      var clippingRect = clippingParents2.reduce(function(accRect, clippingParent) {
        var rect = getClientRectFromMixedType(element, clippingParent, strategy);
        accRect.top = max(rect.top, accRect.top);
        accRect.right = min(rect.right, accRect.right);
        accRect.bottom = min(rect.bottom, accRect.bottom);
        accRect.left = max(rect.left, accRect.left);
        return accRect;
      }, getClientRectFromMixedType(element, firstClippingParent, strategy));
      clippingRect.width = clippingRect.right - clippingRect.left;
      clippingRect.height = clippingRect.bottom - clippingRect.top;
      clippingRect.x = clippingRect.left;
      clippingRect.y = clippingRect.top;
      return clippingRect;
    }
    function getBasePlacement(placement) {
      return placement.split("-")[0];
    }
    function getVariation(placement) {
      return placement.split("-")[1];
    }
    function getMainAxisFromPlacement(placement) {
      return ["top", "bottom"].indexOf(placement) >= 0 ? "x" : "y";
    }
    function computeOffsets(_ref) {
      var reference2 = _ref.reference, element = _ref.element, placement = _ref.placement;
      var basePlacement = placement ? getBasePlacement(placement) : null;
      var variation = placement ? getVariation(placement) : null;
      var commonX = reference2.x + reference2.width / 2 - element.width / 2;
      var commonY = reference2.y + reference2.height / 2 - element.height / 2;
      var offsets;
      switch (basePlacement) {
        case top:
          offsets = {
            x: commonX,
            y: reference2.y - element.height
          };
          break;
        case bottom:
          offsets = {
            x: commonX,
            y: reference2.y + reference2.height
          };
          break;
        case right:
          offsets = {
            x: reference2.x + reference2.width,
            y: commonY
          };
          break;
        case left:
          offsets = {
            x: reference2.x - element.width,
            y: commonY
          };
          break;
        default:
          offsets = {
            x: reference2.x,
            y: reference2.y
          };
      }
      var mainAxis = basePlacement ? getMainAxisFromPlacement(basePlacement) : null;
      if (mainAxis != null) {
        var len = mainAxis === "y" ? "height" : "width";
        switch (variation) {
          case start:
            offsets[mainAxis] = offsets[mainAxis] - (reference2[len] / 2 - element[len] / 2);
            break;
          case end:
            offsets[mainAxis] = offsets[mainAxis] + (reference2[len] / 2 - element[len] / 2);
            break;
        }
      }
      return offsets;
    }
    function getFreshSideObject() {
      return {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      };
    }
    function mergePaddingObject(paddingObject) {
      return Object.assign({}, getFreshSideObject(), paddingObject);
    }
    function expandToHashMap(value, keys) {
      return keys.reduce(function(hashMap, key) {
        hashMap[key] = value;
        return hashMap;
      }, {});
    }
    function detectOverflow(state, options) {
      if (options === void 0) {
        options = {};
      }
      var _options = options, _options$placement = _options.placement, placement = _options$placement === void 0 ? state.placement : _options$placement, _options$strategy = _options.strategy, strategy = _options$strategy === void 0 ? state.strategy : _options$strategy, _options$boundary = _options.boundary, boundary = _options$boundary === void 0 ? clippingParents : _options$boundary, _options$rootBoundary = _options.rootBoundary, rootBoundary = _options$rootBoundary === void 0 ? viewport : _options$rootBoundary, _options$elementConte = _options.elementContext, elementContext = _options$elementConte === void 0 ? popper : _options$elementConte, _options$altBoundary = _options.altBoundary, altBoundary = _options$altBoundary === void 0 ? false : _options$altBoundary, _options$padding = _options.padding, padding = _options$padding === void 0 ? 0 : _options$padding;
      var paddingObject = mergePaddingObject(typeof padding !== "number" ? padding : expandToHashMap(padding, basePlacements));
      var altContext = elementContext === popper ? reference : popper;
      var popperRect = state.rects.popper;
      var element = state.elements[altBoundary ? altContext : elementContext];
      var clippingClientRect = getClippingRect(isElement(element) ? element : element.contextElement || getDocumentElement(state.elements.popper), boundary, rootBoundary, strategy);
      var referenceClientRect = getBoundingClientRect(state.elements.reference);
      var popperOffsets2 = computeOffsets({
        reference: referenceClientRect,
        element: popperRect,
        strategy: "absolute",
        placement
      });
      var popperClientRect = rectToClientRect(Object.assign({}, popperRect, popperOffsets2));
      var elementClientRect = elementContext === popper ? popperClientRect : referenceClientRect;
      var overflowOffsets = {
        top: clippingClientRect.top - elementClientRect.top + paddingObject.top,
        bottom: elementClientRect.bottom - clippingClientRect.bottom + paddingObject.bottom,
        left: clippingClientRect.left - elementClientRect.left + paddingObject.left,
        right: elementClientRect.right - clippingClientRect.right + paddingObject.right
      };
      var offsetData = state.modifiersData.offset;
      if (elementContext === popper && offsetData) {
        var offset2 = offsetData[placement];
        Object.keys(overflowOffsets).forEach(function(key) {
          var multiply = [right, bottom].indexOf(key) >= 0 ? 1 : -1;
          var axis = [top, bottom].indexOf(key) >= 0 ? "y" : "x";
          overflowOffsets[key] += offset2[axis] * multiply;
        });
      }
      return overflowOffsets;
    }
    var DEFAULT_OPTIONS = {
      placement: "bottom",
      modifiers: [],
      strategy: "absolute"
    };
    function areValidElements() {
      for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }
      return !args.some(function(element) {
        return !(element && typeof element.getBoundingClientRect === "function");
      });
    }
    function popperGenerator(generatorOptions) {
      if (generatorOptions === void 0) {
        generatorOptions = {};
      }
      var _generatorOptions = generatorOptions, _generatorOptions$def = _generatorOptions.defaultModifiers, defaultModifiers2 = _generatorOptions$def === void 0 ? [] : _generatorOptions$def, _generatorOptions$def2 = _generatorOptions.defaultOptions, defaultOptions = _generatorOptions$def2 === void 0 ? DEFAULT_OPTIONS : _generatorOptions$def2;
      return function createPopper2(reference2, popper2, options) {
        if (options === void 0) {
          options = defaultOptions;
        }
        var state = {
          placement: "bottom",
          orderedModifiers: [],
          options: Object.assign({}, DEFAULT_OPTIONS, defaultOptions),
          modifiersData: {},
          elements: {
            reference: reference2,
            popper: popper2
          },
          attributes: {},
          styles: {}
        };
        var effectCleanupFns = [];
        var isDestroyed = false;
        var instance = {
          state,
          setOptions: function setOptions(setOptionsAction) {
            var options2 = typeof setOptionsAction === "function" ? setOptionsAction(state.options) : setOptionsAction;
            cleanupModifierEffects();
            state.options = Object.assign({}, defaultOptions, state.options, options2);
            state.scrollParents = {
              reference: isElement(reference2) ? listScrollParents(reference2) : reference2.contextElement ? listScrollParents(reference2.contextElement) : [],
              popper: listScrollParents(popper2)
            };
            var orderedModifiers = orderModifiers(mergeByName([].concat(defaultModifiers2, state.options.modifiers)));
            state.orderedModifiers = orderedModifiers.filter(function(m) {
              return m.enabled;
            });
            runModifierEffects();
            return instance.update();
          },
          // Sync update – it will always be executed, even if not necessary. This
          // is useful for low frequency updates where sync behavior simplifies the
          // logic.
          // For high frequency updates (e.g. `resize` and `scroll` events), always
          // prefer the async Popper#update method
          forceUpdate: function forceUpdate() {
            if (isDestroyed) {
              return;
            }
            var _state$elements = state.elements, reference3 = _state$elements.reference, popper3 = _state$elements.popper;
            if (!areValidElements(reference3, popper3)) {
              return;
            }
            state.rects = {
              reference: getCompositeRect(reference3, getOffsetParent(popper3), state.options.strategy === "fixed"),
              popper: getLayoutRect(popper3)
            };
            state.reset = false;
            state.placement = state.options.placement;
            state.orderedModifiers.forEach(function(modifier) {
              return state.modifiersData[modifier.name] = Object.assign({}, modifier.data);
            });
            for (var index = 0; index < state.orderedModifiers.length; index++) {
              if (state.reset === true) {
                state.reset = false;
                index = -1;
                continue;
              }
              var _state$orderedModifie = state.orderedModifiers[index], fn = _state$orderedModifie.fn, _state$orderedModifie2 = _state$orderedModifie.options, _options = _state$orderedModifie2 === void 0 ? {} : _state$orderedModifie2, name = _state$orderedModifie.name;
              if (typeof fn === "function") {
                state = fn({
                  state,
                  options: _options,
                  name,
                  instance
                }) || state;
              }
            }
          },
          // Async and optimistically optimized update – it will not be executed if
          // not necessary (debounced to run at most once-per-tick)
          update: debounce(function() {
            return new Promise(function(resolve) {
              instance.forceUpdate();
              resolve(state);
            });
          }),
          destroy: function destroy() {
            cleanupModifierEffects();
            isDestroyed = true;
          }
        };
        if (!areValidElements(reference2, popper2)) {
          return instance;
        }
        instance.setOptions(options).then(function(state2) {
          if (!isDestroyed && options.onFirstUpdate) {
            options.onFirstUpdate(state2);
          }
        });
        function runModifierEffects() {
          state.orderedModifiers.forEach(function(_ref) {
            var name = _ref.name, _ref$options = _ref.options, options2 = _ref$options === void 0 ? {} : _ref$options, effect2 = _ref.effect;
            if (typeof effect2 === "function") {
              var cleanupFn = effect2({
                state,
                name,
                instance,
                options: options2
              });
              var noopFn = function noopFn2() {
              };
              effectCleanupFns.push(cleanupFn || noopFn);
            }
          });
        }
        function cleanupModifierEffects() {
          effectCleanupFns.forEach(function(fn) {
            return fn();
          });
          effectCleanupFns = [];
        }
        return instance;
      };
    }
    var passive = {
      passive: true
    };
    function effect$2(_ref) {
      var state = _ref.state, instance = _ref.instance, options = _ref.options;
      var _options$scroll = options.scroll, scroll = _options$scroll === void 0 ? true : _options$scroll, _options$resize = options.resize, resize = _options$resize === void 0 ? true : _options$resize;
      var window2 = getWindow(state.elements.popper);
      var scrollParents = [].concat(state.scrollParents.reference, state.scrollParents.popper);
      if (scroll) {
        scrollParents.forEach(function(scrollParent) {
          scrollParent.addEventListener("scroll", instance.update, passive);
        });
      }
      if (resize) {
        window2.addEventListener("resize", instance.update, passive);
      }
      return function() {
        if (scroll) {
          scrollParents.forEach(function(scrollParent) {
            scrollParent.removeEventListener("scroll", instance.update, passive);
          });
        }
        if (resize) {
          window2.removeEventListener("resize", instance.update, passive);
        }
      };
    }
    var eventListeners = {
      name: "eventListeners",
      enabled: true,
      phase: "write",
      fn: function fn() {
      },
      effect: effect$2,
      data: {}
    };
    function popperOffsets(_ref) {
      var state = _ref.state, name = _ref.name;
      state.modifiersData[name] = computeOffsets({
        reference: state.rects.reference,
        element: state.rects.popper,
        strategy: "absolute",
        placement: state.placement
      });
    }
    var popperOffsets$1 = {
      name: "popperOffsets",
      enabled: true,
      phase: "read",
      fn: popperOffsets,
      data: {}
    };
    var unsetSides = {
      top: "auto",
      right: "auto",
      bottom: "auto",
      left: "auto"
    };
    function roundOffsetsByDPR(_ref, win) {
      var x = _ref.x, y = _ref.y;
      var dpr = win.devicePixelRatio || 1;
      return {
        x: round(x * dpr) / dpr || 0,
        y: round(y * dpr) / dpr || 0
      };
    }
    function mapToStyles(_ref2) {
      var _Object$assign2;
      var popper2 = _ref2.popper, popperRect = _ref2.popperRect, placement = _ref2.placement, variation = _ref2.variation, offsets = _ref2.offsets, position = _ref2.position, gpuAcceleration = _ref2.gpuAcceleration, adaptive = _ref2.adaptive, roundOffsets = _ref2.roundOffsets, isFixed = _ref2.isFixed;
      var _offsets$x = offsets.x, x = _offsets$x === void 0 ? 0 : _offsets$x, _offsets$y = offsets.y, y = _offsets$y === void 0 ? 0 : _offsets$y;
      var _ref3 = typeof roundOffsets === "function" ? roundOffsets({
        x,
        y
      }) : {
        x,
        y
      };
      x = _ref3.x;
      y = _ref3.y;
      var hasX = offsets.hasOwnProperty("x");
      var hasY = offsets.hasOwnProperty("y");
      var sideX = left;
      var sideY = top;
      var win = window;
      if (adaptive) {
        var offsetParent = getOffsetParent(popper2);
        var heightProp = "clientHeight";
        var widthProp = "clientWidth";
        if (offsetParent === getWindow(popper2)) {
          offsetParent = getDocumentElement(popper2);
          if (getComputedStyle(offsetParent).position !== "static" && position === "absolute") {
            heightProp = "scrollHeight";
            widthProp = "scrollWidth";
          }
        }
        offsetParent = offsetParent;
        if (placement === top || (placement === left || placement === right) && variation === end) {
          sideY = bottom;
          var offsetY = isFixed && offsetParent === win && win.visualViewport ? win.visualViewport.height : (
            // $FlowFixMe[prop-missing]
            offsetParent[heightProp]
          );
          y -= offsetY - popperRect.height;
          y *= gpuAcceleration ? 1 : -1;
        }
        if (placement === left || (placement === top || placement === bottom) && variation === end) {
          sideX = right;
          var offsetX = isFixed && offsetParent === win && win.visualViewport ? win.visualViewport.width : (
            // $FlowFixMe[prop-missing]
            offsetParent[widthProp]
          );
          x -= offsetX - popperRect.width;
          x *= gpuAcceleration ? 1 : -1;
        }
      }
      var commonStyles = Object.assign({
        position
      }, adaptive && unsetSides);
      var _ref4 = roundOffsets === true ? roundOffsetsByDPR({
        x,
        y
      }, getWindow(popper2)) : {
        x,
        y
      };
      x = _ref4.x;
      y = _ref4.y;
      if (gpuAcceleration) {
        var _Object$assign;
        return Object.assign({}, commonStyles, (_Object$assign = {}, _Object$assign[sideY] = hasY ? "0" : "", _Object$assign[sideX] = hasX ? "0" : "", _Object$assign.transform = (win.devicePixelRatio || 1) <= 1 ? "translate(" + x + "px, " + y + "px)" : "translate3d(" + x + "px, " + y + "px, 0)", _Object$assign));
      }
      return Object.assign({}, commonStyles, (_Object$assign2 = {}, _Object$assign2[sideY] = hasY ? y + "px" : "", _Object$assign2[sideX] = hasX ? x + "px" : "", _Object$assign2.transform = "", _Object$assign2));
    }
    function computeStyles(_ref5) {
      var state = _ref5.state, options = _ref5.options;
      var _options$gpuAccelerat = options.gpuAcceleration, gpuAcceleration = _options$gpuAccelerat === void 0 ? true : _options$gpuAccelerat, _options$adaptive = options.adaptive, adaptive = _options$adaptive === void 0 ? true : _options$adaptive, _options$roundOffsets = options.roundOffsets, roundOffsets = _options$roundOffsets === void 0 ? true : _options$roundOffsets;
      var commonStyles = {
        placement: getBasePlacement(state.placement),
        variation: getVariation(state.placement),
        popper: state.elements.popper,
        popperRect: state.rects.popper,
        gpuAcceleration,
        isFixed: state.options.strategy === "fixed"
      };
      if (state.modifiersData.popperOffsets != null) {
        state.styles.popper = Object.assign({}, state.styles.popper, mapToStyles(Object.assign({}, commonStyles, {
          offsets: state.modifiersData.popperOffsets,
          position: state.options.strategy,
          adaptive,
          roundOffsets
        })));
      }
      if (state.modifiersData.arrow != null) {
        state.styles.arrow = Object.assign({}, state.styles.arrow, mapToStyles(Object.assign({}, commonStyles, {
          offsets: state.modifiersData.arrow,
          position: "absolute",
          adaptive: false,
          roundOffsets
        })));
      }
      state.attributes.popper = Object.assign({}, state.attributes.popper, {
        "data-popper-placement": state.placement
      });
    }
    var computeStyles$1 = {
      name: "computeStyles",
      enabled: true,
      phase: "beforeWrite",
      fn: computeStyles,
      data: {}
    };
    function applyStyles(_ref) {
      var state = _ref.state;
      Object.keys(state.elements).forEach(function(name) {
        var style = state.styles[name] || {};
        var attributes = state.attributes[name] || {};
        var element = state.elements[name];
        if (!isHTMLElement(element) || !getNodeName(element)) {
          return;
        }
        Object.assign(element.style, style);
        Object.keys(attributes).forEach(function(name2) {
          var value = attributes[name2];
          if (value === false) {
            element.removeAttribute(name2);
          } else {
            element.setAttribute(name2, value === true ? "" : value);
          }
        });
      });
    }
    function effect$1(_ref2) {
      var state = _ref2.state;
      var initialStyles = {
        popper: {
          position: state.options.strategy,
          left: "0",
          top: "0",
          margin: "0"
        },
        arrow: {
          position: "absolute"
        },
        reference: {}
      };
      Object.assign(state.elements.popper.style, initialStyles.popper);
      state.styles = initialStyles;
      if (state.elements.arrow) {
        Object.assign(state.elements.arrow.style, initialStyles.arrow);
      }
      return function() {
        Object.keys(state.elements).forEach(function(name) {
          var element = state.elements[name];
          var attributes = state.attributes[name] || {};
          var styleProperties = Object.keys(state.styles.hasOwnProperty(name) ? state.styles[name] : initialStyles[name]);
          var style = styleProperties.reduce(function(style2, property) {
            style2[property] = "";
            return style2;
          }, {});
          if (!isHTMLElement(element) || !getNodeName(element)) {
            return;
          }
          Object.assign(element.style, style);
          Object.keys(attributes).forEach(function(attribute) {
            element.removeAttribute(attribute);
          });
        });
      };
    }
    var applyStyles$1 = {
      name: "applyStyles",
      enabled: true,
      phase: "write",
      fn: applyStyles,
      effect: effect$1,
      requires: ["computeStyles"]
    };
    function distanceAndSkiddingToXY(placement, rects, offset2) {
      var basePlacement = getBasePlacement(placement);
      var invertDistance = [left, top].indexOf(basePlacement) >= 0 ? -1 : 1;
      var _ref = typeof offset2 === "function" ? offset2(Object.assign({}, rects, {
        placement
      })) : offset2, skidding = _ref[0], distance = _ref[1];
      skidding = skidding || 0;
      distance = (distance || 0) * invertDistance;
      return [left, right].indexOf(basePlacement) >= 0 ? {
        x: distance,
        y: skidding
      } : {
        x: skidding,
        y: distance
      };
    }
    function offset(_ref2) {
      var state = _ref2.state, options = _ref2.options, name = _ref2.name;
      var _options$offset = options.offset, offset2 = _options$offset === void 0 ? [0, 0] : _options$offset;
      var data = placements.reduce(function(acc, placement) {
        acc[placement] = distanceAndSkiddingToXY(placement, state.rects, offset2);
        return acc;
      }, {});
      var _data$state$placement = data[state.placement], x = _data$state$placement.x, y = _data$state$placement.y;
      if (state.modifiersData.popperOffsets != null) {
        state.modifiersData.popperOffsets.x += x;
        state.modifiersData.popperOffsets.y += y;
      }
      state.modifiersData[name] = data;
    }
    var offset$1 = {
      name: "offset",
      enabled: true,
      phase: "main",
      requires: ["popperOffsets"],
      fn: offset
    };
    var hash$1 = {
      left: "right",
      right: "left",
      bottom: "top",
      top: "bottom"
    };
    function getOppositePlacement(placement) {
      return placement.replace(/left|right|bottom|top/g, function(matched) {
        return hash$1[matched];
      });
    }
    var hash = {
      start: "end",
      end: "start"
    };
    function getOppositeVariationPlacement(placement) {
      return placement.replace(/start|end/g, function(matched) {
        return hash[matched];
      });
    }
    function computeAutoPlacement(state, options) {
      if (options === void 0) {
        options = {};
      }
      var _options = options, placement = _options.placement, boundary = _options.boundary, rootBoundary = _options.rootBoundary, padding = _options.padding, flipVariations = _options.flipVariations, _options$allowedAutoP = _options.allowedAutoPlacements, allowedAutoPlacements = _options$allowedAutoP === void 0 ? placements : _options$allowedAutoP;
      var variation = getVariation(placement);
      var placements$1 = variation ? flipVariations ? variationPlacements : variationPlacements.filter(function(placement2) {
        return getVariation(placement2) === variation;
      }) : basePlacements;
      var allowedPlacements = placements$1.filter(function(placement2) {
        return allowedAutoPlacements.indexOf(placement2) >= 0;
      });
      if (allowedPlacements.length === 0) {
        allowedPlacements = placements$1;
      }
      var overflows = allowedPlacements.reduce(function(acc, placement2) {
        acc[placement2] = detectOverflow(state, {
          placement: placement2,
          boundary,
          rootBoundary,
          padding
        })[getBasePlacement(placement2)];
        return acc;
      }, {});
      return Object.keys(overflows).sort(function(a, b) {
        return overflows[a] - overflows[b];
      });
    }
    function getExpandedFallbackPlacements(placement) {
      if (getBasePlacement(placement) === auto) {
        return [];
      }
      var oppositePlacement = getOppositePlacement(placement);
      return [getOppositeVariationPlacement(placement), oppositePlacement, getOppositeVariationPlacement(oppositePlacement)];
    }
    function flip(_ref) {
      var state = _ref.state, options = _ref.options, name = _ref.name;
      if (state.modifiersData[name]._skip) {
        return;
      }
      var _options$mainAxis = options.mainAxis, checkMainAxis = _options$mainAxis === void 0 ? true : _options$mainAxis, _options$altAxis = options.altAxis, checkAltAxis = _options$altAxis === void 0 ? true : _options$altAxis, specifiedFallbackPlacements = options.fallbackPlacements, padding = options.padding, boundary = options.boundary, rootBoundary = options.rootBoundary, altBoundary = options.altBoundary, _options$flipVariatio = options.flipVariations, flipVariations = _options$flipVariatio === void 0 ? true : _options$flipVariatio, allowedAutoPlacements = options.allowedAutoPlacements;
      var preferredPlacement = state.options.placement;
      var basePlacement = getBasePlacement(preferredPlacement);
      var isBasePlacement = basePlacement === preferredPlacement;
      var fallbackPlacements = specifiedFallbackPlacements || (isBasePlacement || !flipVariations ? [getOppositePlacement(preferredPlacement)] : getExpandedFallbackPlacements(preferredPlacement));
      var placements2 = [preferredPlacement].concat(fallbackPlacements).reduce(function(acc, placement2) {
        return acc.concat(getBasePlacement(placement2) === auto ? computeAutoPlacement(state, {
          placement: placement2,
          boundary,
          rootBoundary,
          padding,
          flipVariations,
          allowedAutoPlacements
        }) : placement2);
      }, []);
      var referenceRect = state.rects.reference;
      var popperRect = state.rects.popper;
      var checksMap = /* @__PURE__ */ new Map();
      var makeFallbackChecks = true;
      var firstFittingPlacement = placements2[0];
      for (var i = 0; i < placements2.length; i++) {
        var placement = placements2[i];
        var _basePlacement = getBasePlacement(placement);
        var isStartVariation = getVariation(placement) === start;
        var isVertical = [top, bottom].indexOf(_basePlacement) >= 0;
        var len = isVertical ? "width" : "height";
        var overflow = detectOverflow(state, {
          placement,
          boundary,
          rootBoundary,
          altBoundary,
          padding
        });
        var mainVariationSide = isVertical ? isStartVariation ? right : left : isStartVariation ? bottom : top;
        if (referenceRect[len] > popperRect[len]) {
          mainVariationSide = getOppositePlacement(mainVariationSide);
        }
        var altVariationSide = getOppositePlacement(mainVariationSide);
        var checks = [];
        if (checkMainAxis) {
          checks.push(overflow[_basePlacement] <= 0);
        }
        if (checkAltAxis) {
          checks.push(overflow[mainVariationSide] <= 0, overflow[altVariationSide] <= 0);
        }
        if (checks.every(function(check) {
          return check;
        })) {
          firstFittingPlacement = placement;
          makeFallbackChecks = false;
          break;
        }
        checksMap.set(placement, checks);
      }
      if (makeFallbackChecks) {
        var numberOfChecks = flipVariations ? 3 : 1;
        var _loop = function _loop2(_i2) {
          var fittingPlacement = placements2.find(function(placement2) {
            var checks2 = checksMap.get(placement2);
            if (checks2) {
              return checks2.slice(0, _i2).every(function(check) {
                return check;
              });
            }
          });
          if (fittingPlacement) {
            firstFittingPlacement = fittingPlacement;
            return "break";
          }
        };
        for (var _i = numberOfChecks; _i > 0; _i--) {
          var _ret = _loop(_i);
          if (_ret === "break") break;
        }
      }
      if (state.placement !== firstFittingPlacement) {
        state.modifiersData[name]._skip = true;
        state.placement = firstFittingPlacement;
        state.reset = true;
      }
    }
    var flip$1 = {
      name: "flip",
      enabled: true,
      phase: "main",
      fn: flip,
      requiresIfExists: ["offset"],
      data: {
        _skip: false
      }
    };
    function getAltAxis(axis) {
      return axis === "x" ? "y" : "x";
    }
    function within(min$1, value, max$1) {
      return max(min$1, min(value, max$1));
    }
    function withinMaxClamp(min2, value, max2) {
      var v = within(min2, value, max2);
      return v > max2 ? max2 : v;
    }
    function preventOverflow(_ref) {
      var state = _ref.state, options = _ref.options, name = _ref.name;
      var _options$mainAxis = options.mainAxis, checkMainAxis = _options$mainAxis === void 0 ? true : _options$mainAxis, _options$altAxis = options.altAxis, checkAltAxis = _options$altAxis === void 0 ? false : _options$altAxis, boundary = options.boundary, rootBoundary = options.rootBoundary, altBoundary = options.altBoundary, padding = options.padding, _options$tether = options.tether, tether = _options$tether === void 0 ? true : _options$tether, _options$tetherOffset = options.tetherOffset, tetherOffset = _options$tetherOffset === void 0 ? 0 : _options$tetherOffset;
      var overflow = detectOverflow(state, {
        boundary,
        rootBoundary,
        padding,
        altBoundary
      });
      var basePlacement = getBasePlacement(state.placement);
      var variation = getVariation(state.placement);
      var isBasePlacement = !variation;
      var mainAxis = getMainAxisFromPlacement(basePlacement);
      var altAxis = getAltAxis(mainAxis);
      var popperOffsets2 = state.modifiersData.popperOffsets;
      var referenceRect = state.rects.reference;
      var popperRect = state.rects.popper;
      var tetherOffsetValue = typeof tetherOffset === "function" ? tetherOffset(Object.assign({}, state.rects, {
        placement: state.placement
      })) : tetherOffset;
      var normalizedTetherOffsetValue = typeof tetherOffsetValue === "number" ? {
        mainAxis: tetherOffsetValue,
        altAxis: tetherOffsetValue
      } : Object.assign({
        mainAxis: 0,
        altAxis: 0
      }, tetherOffsetValue);
      var offsetModifierState = state.modifiersData.offset ? state.modifiersData.offset[state.placement] : null;
      var data = {
        x: 0,
        y: 0
      };
      if (!popperOffsets2) {
        return;
      }
      if (checkMainAxis) {
        var _offsetModifierState$;
        var mainSide = mainAxis === "y" ? top : left;
        var altSide = mainAxis === "y" ? bottom : right;
        var len = mainAxis === "y" ? "height" : "width";
        var offset2 = popperOffsets2[mainAxis];
        var min$1 = offset2 + overflow[mainSide];
        var max$1 = offset2 - overflow[altSide];
        var additive = tether ? -popperRect[len] / 2 : 0;
        var minLen = variation === start ? referenceRect[len] : popperRect[len];
        var maxLen = variation === start ? -popperRect[len] : -referenceRect[len];
        var arrowElement = state.elements.arrow;
        var arrowRect = tether && arrowElement ? getLayoutRect(arrowElement) : {
          width: 0,
          height: 0
        };
        var arrowPaddingObject = state.modifiersData["arrow#persistent"] ? state.modifiersData["arrow#persistent"].padding : getFreshSideObject();
        var arrowPaddingMin = arrowPaddingObject[mainSide];
        var arrowPaddingMax = arrowPaddingObject[altSide];
        var arrowLen = within(0, referenceRect[len], arrowRect[len]);
        var minOffset = isBasePlacement ? referenceRect[len] / 2 - additive - arrowLen - arrowPaddingMin - normalizedTetherOffsetValue.mainAxis : minLen - arrowLen - arrowPaddingMin - normalizedTetherOffsetValue.mainAxis;
        var maxOffset = isBasePlacement ? -referenceRect[len] / 2 + additive + arrowLen + arrowPaddingMax + normalizedTetherOffsetValue.mainAxis : maxLen + arrowLen + arrowPaddingMax + normalizedTetherOffsetValue.mainAxis;
        var arrowOffsetParent = state.elements.arrow && getOffsetParent(state.elements.arrow);
        var clientOffset = arrowOffsetParent ? mainAxis === "y" ? arrowOffsetParent.clientTop || 0 : arrowOffsetParent.clientLeft || 0 : 0;
        var offsetModifierValue = (_offsetModifierState$ = offsetModifierState == null ? void 0 : offsetModifierState[mainAxis]) != null ? _offsetModifierState$ : 0;
        var tetherMin = offset2 + minOffset - offsetModifierValue - clientOffset;
        var tetherMax = offset2 + maxOffset - offsetModifierValue;
        var preventedOffset = within(tether ? min(min$1, tetherMin) : min$1, offset2, tether ? max(max$1, tetherMax) : max$1);
        popperOffsets2[mainAxis] = preventedOffset;
        data[mainAxis] = preventedOffset - offset2;
      }
      if (checkAltAxis) {
        var _offsetModifierState$2;
        var _mainSide = mainAxis === "x" ? top : left;
        var _altSide = mainAxis === "x" ? bottom : right;
        var _offset = popperOffsets2[altAxis];
        var _len = altAxis === "y" ? "height" : "width";
        var _min = _offset + overflow[_mainSide];
        var _max = _offset - overflow[_altSide];
        var isOriginSide = [top, left].indexOf(basePlacement) !== -1;
        var _offsetModifierValue = (_offsetModifierState$2 = offsetModifierState == null ? void 0 : offsetModifierState[altAxis]) != null ? _offsetModifierState$2 : 0;
        var _tetherMin = isOriginSide ? _min : _offset - referenceRect[_len] - popperRect[_len] - _offsetModifierValue + normalizedTetherOffsetValue.altAxis;
        var _tetherMax = isOriginSide ? _offset + referenceRect[_len] + popperRect[_len] - _offsetModifierValue - normalizedTetherOffsetValue.altAxis : _max;
        var _preventedOffset = tether && isOriginSide ? withinMaxClamp(_tetherMin, _offset, _tetherMax) : within(tether ? _tetherMin : _min, _offset, tether ? _tetherMax : _max);
        popperOffsets2[altAxis] = _preventedOffset;
        data[altAxis] = _preventedOffset - _offset;
      }
      state.modifiersData[name] = data;
    }
    var preventOverflow$1 = {
      name: "preventOverflow",
      enabled: true,
      phase: "main",
      fn: preventOverflow,
      requiresIfExists: ["offset"]
    };
    var toPaddingObject = function toPaddingObject2(padding, state) {
      padding = typeof padding === "function" ? padding(Object.assign({}, state.rects, {
        placement: state.placement
      })) : padding;
      return mergePaddingObject(typeof padding !== "number" ? padding : expandToHashMap(padding, basePlacements));
    };
    function arrow(_ref) {
      var _state$modifiersData$;
      var state = _ref.state, name = _ref.name, options = _ref.options;
      var arrowElement = state.elements.arrow;
      var popperOffsets2 = state.modifiersData.popperOffsets;
      var basePlacement = getBasePlacement(state.placement);
      var axis = getMainAxisFromPlacement(basePlacement);
      var isVertical = [left, right].indexOf(basePlacement) >= 0;
      var len = isVertical ? "height" : "width";
      if (!arrowElement || !popperOffsets2) {
        return;
      }
      var paddingObject = toPaddingObject(options.padding, state);
      var arrowRect = getLayoutRect(arrowElement);
      var minProp = axis === "y" ? top : left;
      var maxProp = axis === "y" ? bottom : right;
      var endDiff = state.rects.reference[len] + state.rects.reference[axis] - popperOffsets2[axis] - state.rects.popper[len];
      var startDiff = popperOffsets2[axis] - state.rects.reference[axis];
      var arrowOffsetParent = getOffsetParent(arrowElement);
      var clientSize = arrowOffsetParent ? axis === "y" ? arrowOffsetParent.clientHeight || 0 : arrowOffsetParent.clientWidth || 0 : 0;
      var centerToReference = endDiff / 2 - startDiff / 2;
      var min2 = paddingObject[minProp];
      var max2 = clientSize - arrowRect[len] - paddingObject[maxProp];
      var center = clientSize / 2 - arrowRect[len] / 2 + centerToReference;
      var offset2 = within(min2, center, max2);
      var axisProp = axis;
      state.modifiersData[name] = (_state$modifiersData$ = {}, _state$modifiersData$[axisProp] = offset2, _state$modifiersData$.centerOffset = offset2 - center, _state$modifiersData$);
    }
    function effect(_ref2) {
      var state = _ref2.state, options = _ref2.options;
      var _options$element = options.element, arrowElement = _options$element === void 0 ? "[data-popper-arrow]" : _options$element;
      if (arrowElement == null) {
        return;
      }
      if (typeof arrowElement === "string") {
        arrowElement = state.elements.popper.querySelector(arrowElement);
        if (!arrowElement) {
          return;
        }
      }
      if (!contains(state.elements.popper, arrowElement)) {
        return;
      }
      state.elements.arrow = arrowElement;
    }
    var arrow$1 = {
      name: "arrow",
      enabled: true,
      phase: "main",
      fn: arrow,
      effect,
      requires: ["popperOffsets"],
      requiresIfExists: ["preventOverflow"]
    };
    function getSideOffsets(overflow, rect, preventedOffsets) {
      if (preventedOffsets === void 0) {
        preventedOffsets = {
          x: 0,
          y: 0
        };
      }
      return {
        top: overflow.top - rect.height - preventedOffsets.y,
        right: overflow.right - rect.width + preventedOffsets.x,
        bottom: overflow.bottom - rect.height + preventedOffsets.y,
        left: overflow.left - rect.width - preventedOffsets.x
      };
    }
    function isAnySideFullyClipped(overflow) {
      return [top, right, bottom, left].some(function(side) {
        return overflow[side] >= 0;
      });
    }
    function hide(_ref) {
      var state = _ref.state, name = _ref.name;
      var referenceRect = state.rects.reference;
      var popperRect = state.rects.popper;
      var preventedOffsets = state.modifiersData.preventOverflow;
      var referenceOverflow = detectOverflow(state, {
        elementContext: "reference"
      });
      var popperAltOverflow = detectOverflow(state, {
        altBoundary: true
      });
      var referenceClippingOffsets = getSideOffsets(referenceOverflow, referenceRect);
      var popperEscapeOffsets = getSideOffsets(popperAltOverflow, popperRect, preventedOffsets);
      var isReferenceHidden = isAnySideFullyClipped(referenceClippingOffsets);
      var hasPopperEscaped = isAnySideFullyClipped(popperEscapeOffsets);
      state.modifiersData[name] = {
        referenceClippingOffsets,
        popperEscapeOffsets,
        isReferenceHidden,
        hasPopperEscaped
      };
      state.attributes.popper = Object.assign({}, state.attributes.popper, {
        "data-popper-reference-hidden": isReferenceHidden,
        "data-popper-escaped": hasPopperEscaped
      });
    }
    var hide$1 = {
      name: "hide",
      enabled: true,
      phase: "main",
      requiresIfExists: ["preventOverflow"],
      fn: hide
    };
    var defaultModifiers$1 = [eventListeners, popperOffsets$1, computeStyles$1, applyStyles$1];
    var createPopper$1 = /* @__PURE__ */ popperGenerator({
      defaultModifiers: defaultModifiers$1
    });
    var defaultModifiers = [eventListeners, popperOffsets$1, computeStyles$1, applyStyles$1, offset$1, flip$1, preventOverflow$1, arrow$1, hide$1];
    var createPopper = /* @__PURE__ */ popperGenerator({
      defaultModifiers
    });
    exports2.applyStyles = applyStyles$1;
    exports2.arrow = arrow$1;
    exports2.computeStyles = computeStyles$1;
    exports2.createPopper = createPopper;
    exports2.createPopperLite = createPopper$1;
    exports2.defaultModifiers = defaultModifiers;
    exports2.detectOverflow = detectOverflow;
    exports2.eventListeners = eventListeners;
    exports2.flip = flip$1;
    exports2.hide = hide$1;
    exports2.offset = offset$1;
    exports2.popperGenerator = popperGenerator;
    exports2.popperOffsets = popperOffsets$1;
    exports2.preventOverflow = preventOverflow$1;
  }
});

// src/modules/file-explorer-enhancer/view.js
var require_view6 = __commonJS({
  "src/modules/file-explorer-enhancer/view.js"(exports2, module2) {
    "use strict";
    var obsidian2 = require("obsidian");
    var runtime = require_runtime4();
    var createPopper = require_popper().createPopper;
    function wrapAround(value, size) {
      return (value % size + size) % size;
    }
    function Suggest(owner, containerEl, scope) {
      this.owner = owner;
      this.containerEl = containerEl;
      this.values = [];
      this.suggestions = [];
      this.selectedItem = 0;
      var self = this;
      containerEl.addEventListener("click", function(event) {
        var el = event.target.closest(".suggestion-item");
        if (!el) return;
        event.preventDefault();
        var item = self.suggestions.indexOf(el);
        self.setSelectedItem(item, false);
        self.useSelectedItem(event);
      });
      containerEl.addEventListener("mousemove", function(event) {
        var el = event.target.closest(".suggestion-item");
        if (!el) return;
        var item = self.suggestions.indexOf(el);
        self.setSelectedItem(item, false);
      });
      scope.register([], "ArrowUp", function(event) {
        if (!event.isComposing) {
          self.setSelectedItem(self.selectedItem - 1, true);
          return false;
        }
      });
      scope.register([], "ArrowDown", function(event) {
        if (!event.isComposing) {
          self.setSelectedItem(self.selectedItem + 1, true);
          return false;
        }
      });
      scope.register([], "Enter", function(event) {
        if (!event.isComposing) {
          self.useSelectedItem(event);
          return false;
        }
      });
    }
    Suggest.prototype.setSuggestions = function(values) {
      this.containerEl.empty();
      var suggestionEls = [];
      for (var i = 0; i < values.length; i++) {
        var suggestionEl = this.containerEl.createDiv("suggestion-item");
        this.owner.renderSuggestion(values[i], suggestionEl);
        suggestionEls.push(suggestionEl);
      }
      this.values = values;
      this.suggestions = suggestionEls;
      this.setSelectedItem(0, false);
    };
    Suggest.prototype.useSelectedItem = function(event) {
      var currentValue = this.values[this.selectedItem];
      if (currentValue) {
        this.owner.selectSuggestion(currentValue, event);
      }
    };
    Suggest.prototype.setSelectedItem = function(selectedIndex, scrollIntoView) {
      var normalizedIndex = wrapAround(selectedIndex, this.suggestions.length);
      var prevSelected = this.suggestions[this.selectedItem];
      var selected = this.suggestions[normalizedIndex];
      if (prevSelected) prevSelected.removeClass("is-selected");
      if (selected) selected.addClass("is-selected");
      this.selectedItem = normalizedIndex;
      if (scrollIntoView && selected) {
        selected.scrollIntoView(false);
      }
    };
    function TextInputSuggest(app, inputEl) {
      this.app = app;
      this.inputEl = inputEl;
      this.scope = new obsidian2.Scope();
      this.suggestEl = document.createElement("div");
      this.suggestEl.className = "suggestion-container";
      var suggestion = document.createElement("div");
      suggestion.className = "suggestion";
      this.suggestEl.appendChild(suggestion);
      this.suggest = new Suggest(this, suggestion, this.scope);
      var self = this;
      this.scope.register([], "Escape", function() {
        self.close();
      });
      this.inputEl.addEventListener("input", function() {
        self.onInputChanged();
      });
      this.inputEl.addEventListener("focus", function() {
        self.onInputChanged();
      });
      this.inputEl.addEventListener("blur", function() {
        self.close();
      });
      this.suggestEl.addEventListener("mousedown", function(event) {
        event.preventDefault();
      });
    }
    TextInputSuggest.prototype.onInputChanged = function() {
      var inputStr = this.inputEl.value;
      var suggestions = this.getSuggestions(inputStr).slice(0, 10);
      if (suggestions.length > 0) {
        this.suggest.setSuggestions(suggestions);
        this.open(this.app.dom.appContainerEl, this.inputEl);
      }
    };
    TextInputSuggest.prototype.open = function(container, inputEl) {
      var self = this;
      this.app.keymap.pushScope(this.scope);
      this.suggestEl.style.maxWidth = "none";
      container.appendChild(this.suggestEl);
      this.popper = createPopper(inputEl, this.suggestEl, {
        placement: "bottom-start",
        modifiers: [
          {
            name: "sameWidth",
            enabled: true,
            fn: function(_a) {
              var state = _a.state;
              var instance = _a.instance;
              var searchContainer = inputEl.closest(".search-input-container");
              var targetWidth = searchContainer ? searchContainer.getBoundingClientRect().width + "px" : state.rects.reference.width + "px";
              if (state.styles.popper.width === targetWidth) return;
              state.styles.popper.width = targetWidth;
              instance.update();
            },
            phase: "beforeWrite",
            requires: ["computeStyles"]
          }
        ]
      });
    };
    TextInputSuggest.prototype.close = function() {
      this.app.keymap.popScope(this.scope);
      this.suggest.setSuggestions([]);
      if (this.popper) {
        this.popper.destroy();
      }
      if (this.suggestEl.parentNode) {
        this.suggestEl.detach();
      }
    };
    function PathSuggest(app, inputEl) {
      TextInputSuggest.call(this, app, inputEl);
    }
    PathSuggest.prototype = Object.create(TextInputSuggest.prototype);
    PathSuggest.prototype.constructor = PathSuggest;
    PathSuggest.prototype.getSuggestions = function(inputStr) {
      var abstractFiles = this.app.vault.getAllLoadedFiles();
      var paths = [];
      var lowerCaseInputStr = inputStr.toLowerCase();
      for (var i = 0; i < abstractFiles.length; i++) {
        var path = abstractFiles[i];
        if (path.path.toLowerCase().indexOf(lowerCaseInputStr) !== -1) {
          paths.push(path);
        }
      }
      return paths;
    };
    PathSuggest.prototype.renderSuggestion = function(file, el) {
      el.setText(file.path);
    };
    PathSuggest.prototype.selectSuggestion = function(file) {
      this.inputEl.value = file.path;
      this.inputEl.dispatchEvent(new Event("input"));
      this.close();
    };
    function PathsActivatedModal(plugin, actionType) {
      obsidian2.Modal.call(this, plugin.app);
      this.plugin = plugin;
      this.actionType = actionType;
    }
    PathsActivatedModal.prototype = Object.create(obsidian2.Modal.prototype);
    PathsActivatedModal.prototype.constructor = PathsActivatedModal;
    PathsActivatedModal.prototype.onOpen = function() {
      var contentEl = this.contentEl;
      contentEl.empty();
      contentEl.addClasses(["file-explorer-plus", "filters-activated-modal"]);
      contentEl.addClass("nene-settings-modal");
      var headerEl = contentEl.createDiv({ cls: "nene-settings-modal-header" });
      var titleText = this.actionType === "PIN" ? "查看由选择器置顶的文件或文件夹" : "查看由选择器隐藏的文件或文件夹";
      headerEl.createDiv({ cls: "nene-settings-modal-title", text: titleText });
      var self = this;
      var files = this.app.vault.getAllLoadedFiles();
      var pathFilters = this.actionType === "HIDE" ? this.plugin.fileExplorerEnhancerSettings.hideFilters.paths : this.plugin.fileExplorerEnhancerSettings.pinFilters.paths;
      var pathsActivated = this.actionType === "HIDE" ? runtime.getPathsToHide(this.plugin, files) : runtime.getPathsToPin(this.plugin, files);
      pathsActivated = pathsActivated.map(function(file) {
        var activatedNames = pathFilters.filter(function(filter) {
          return runtime.checkPathFilter(filter, file);
        }).map(function(filter) {
          return filter.name && filter.name !== "" ? filter.name : filter.pattern;
        });
        file._filtersActivated = activatedNames.join(", ");
        return file;
      });
      if (pathsActivated.length === 0) {
        contentEl.createEl("p", {
          cls: "nene-settings-modal-description",
          text: "当前没有匹配任何文件或文件夹。"
        });
        return;
      }
      var data = [["路径", "类型", "匹配的过滤器"]];
      for (var i = 0; i < pathsActivated.length; i++) {
        var pathFile = pathsActivated[i];
        var row = [];
        if (pathFile instanceof obsidian2.TFile) {
          var link = contentEl.createEl("a");
          link.addEventListener("click", /* @__PURE__ */ (function(pf) {
            return function() {
              self.app.workspace.getLeaf("tab").openFile(pf);
            };
          })(pathFile));
          link.textContent = pathFile.path;
          row.push(link);
        } else {
          row.push(pathFile.path);
        }
        if (pathFile instanceof obsidian2.TFile) {
          row.push("文件");
        } else if (pathFile instanceof obsidian2.TFolder) {
          row.push("文件夹");
        } else {
          row.push("未知");
        }
        row.push(pathFile._filtersActivated || "");
        data.push(row);
      }
      var table = generateTable(data);
      contentEl.appendChild(table);
    };
    PathsActivatedModal.prototype.onClose = function() {
      this.contentEl.empty();
    };
    function cloneFilterRow(rowsContainer, stationaryRow, event) {
      stationaryRow.addClass("nene-filter-row-clone");
      var fauxRow = document.createElement("div");
      fauxRow.className = stationaryRow.className + " nene-filter-row-drag";
      fauxRow.innerHTML = stationaryRow.innerHTML;
      rowsContainer.appendChild(fauxRow);
      var containerRect = rowsContainer.getBoundingClientRect();
      fauxRow.style.left = stationaryRow.getBoundingClientRect().left - containerRect.left + "px";
      fauxRow.style.top = stationaryRow.getBoundingClientRect().top - containerRect.top + "px";
      fauxRow.style.width = stationaryRow.offsetWidth + "px";
      var offsetX = event.clientX - fauxRow.getBoundingClientRect().left;
      var offsetY = event.clientY - fauxRow.getBoundingClientRect().top;
      var currentIndex = Array.from(rowsContainer.children).indexOf(stationaryRow);
      return {
        stationaryRow,
        movableRow: fauxRow,
        offsetX: offsetX + containerRect.left,
        offsetY: offsetY + containerRect.top,
        index: currentIndex
      };
    }
    function deleteFilterRowClone(stationaryRow, movableRow) {
      stationaryRow.removeClass("nene-filter-row-clone");
      if (movableRow.parentNode) {
        movableRow.parentNode.removeChild(movableRow);
      }
      var targets = document.querySelectorAll(".nene-filter-row-drop-target");
      for (var t = 0; t < targets.length; t++) {
        targets[t].removeClass("nene-filter-row-drop-target");
      }
    }
    function calculateFilterRowIndex(event, rowsContainer, movableRow, stationaryRow, offsetX, offsetY, index) {
      movableRow.style.left = event.clientX - offsetX + "px";
      movableRow.style.top = event.clientY - offsetY + "px";
      var dist = movableRow.getBoundingClientRect().top - stationaryRow.getBoundingClientRect().top;
      var dir = dist > 0 ? 1 : -1;
      if (Math.abs(dist) > stationaryRow.offsetHeight * 0.75) {
        var newIndex = Math.max(0, Math.min(index + dir, rowsContainer.children.length - 1));
        var prevTargets = rowsContainer.querySelectorAll(".nene-filter-row-drop-target");
        for (var p = 0; p < prevTargets.length; p++) {
          prevTargets[p].removeClass("nene-filter-row-drop-target");
        }
        var targetRow = rowsContainer.children[newIndex];
        if (targetRow) {
          targetRow.addClass("nene-filter-row-drop-target");
        }
        return newIndex;
      }
      return index;
    }
    function swapFilterRowPosition(rowsContainer, stationaryRow, newIndex) {
      rowsContainer.removeChild(stationaryRow);
      if (newIndex >= rowsContainer.children.length) {
        rowsContainer.appendChild(stationaryRow);
      } else {
        rowsContainer.insertBefore(stationaryRow, rowsContainer.children[newIndex]);
      }
    }
    function handleFilterDragStart(event, plugin, actionType, rowsContainer, stationaryRow, index) {
      if (filterDragLock) return;
      filterDragLock = true;
      event.preventDefault();
      var cloneData = cloneFilterRow(rowsContainer, stationaryRow, event);
      var currentIndex = cloneData.index;
      function onMouseMove(moveEvent) {
        moveEvent.preventDefault();
        var newIndex = calculateFilterRowIndex(
          moveEvent,
          rowsContainer,
          cloneData.movableRow,
          cloneData.stationaryRow,
          cloneData.offsetX,
          cloneData.offsetY,
          currentIndex
        );
        if (newIndex !== currentIndex) {
          swapFilterRowPosition(rowsContainer, cloneData.stationaryRow, newIndex);
          currentIndex = newIndex;
        }
      }
      function onMouseUp() {
        deleteFilterRowClone(cloneData.stationaryRow, cloneData.movableRow);
        filterDragLock = false;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        var list = actionType === "PIN" ? plugin.fileExplorerEnhancerSettings.pinFilters.paths : plugin.fileExplorerEnhancerSettings.hideFilters.paths;
        var children = Array.from(rowsContainer.children);
        var newOrder = [];
        for (var k = 0; k < children.length; k++) {
          var origIndex = parseInt(children[k].getAttribute("data-nene-filter-row-index"), 10);
          newOrder.push(list[origIndex]);
        }
        for (var m = 0; m < newOrder.length; m++) {
          newOrder[m].position = m;
        }
        list.length = 0;
        for (var m = 0; m < newOrder.length; m++) {
          list.push(newOrder[m]);
        }
        plugin.fileExplorerEnhancerStore.save();
        if (plugin._fileExplorerView) {
          plugin._fileExplorerView.requestSort();
        }
        var typeTextMap = { FILES_AND_DIRECTORIES: "文件与文件夹", FILES: "文件", DIRECTORIES: "文件夹" };
        var modeTextMap = { WILDCARD: "通配符", REGEX: "正则表达式", STRICT: "严格模式" };
        for (var n = 0; n < children.length; n++) {
          children[n].setAttribute("data-nene-filter-row-index", String(n));
          var f = list[n];
          var inputs = children[n].querySelectorAll(".nene-filter-text-display");
          if (inputs.length >= 4) {
            inputs[0].value = f.pattern || "(空)";
            inputs[1].value = f.name || "";
            inputs[2].value = typeTextMap[f.type] || f.type;
            inputs[3].value = modeTextMap[f.patternType] || f.patternType;
          }
        }
      }
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }
    function PathFilterListModal(plugin, actionType, onChanged) {
      obsidian2.Modal.call(this, plugin.app);
      this.plugin = plugin;
      this.actionType = actionType;
      this.onChanged = onChanged || null;
    }
    PathFilterListModal.prototype = Object.create(obsidian2.Modal.prototype);
    PathFilterListModal.prototype.constructor = PathFilterListModal;
    PathFilterListModal.prototype.getFilters = function() {
      return this.actionType === "PIN" ? this.plugin.fileExplorerEnhancerSettings.pinFilters.paths : this.plugin.fileExplorerEnhancerSettings.hideFilters.paths;
    };
    PathFilterListModal.prototype.onOpen = function() {
      this.modalEl.addClass("mod-sidebar-layout", "nene-settings-panel-modal");
      var contentEl = this.contentEl;
      contentEl.empty();
      contentEl.addClass("nene-settings-modal");
      var titleText = this.actionType === "PIN" ? "置顶路径过滤器" : "隐藏路径过滤器";
      var headerEl = contentEl.createDiv({ cls: "nene-settings-modal-header" });
      headerEl.createDiv({ cls: "nene-settings-modal-title", text: titleText });
      this.renderFilterList(contentEl);
    };
    var filterDragLock = false;
    PathFilterListModal.prototype.renderFilterList = function(containerEl) {
      var filters = this.getFilters();
      var self = this;
      var plugin = this.plugin;
      var actionType = this.actionType;
      if (filters.length === 0) {
        var emptyEl = containerEl.createDiv({ cls: "nene-settings-modal-description" });
        emptyEl.createEl("p", { text: "当前没有路径过滤器规则。" });
        return;
      }
      var typeTextMap = { FILES_AND_DIRECTORIES: "文件与文件夹", FILES: "文件", DIRECTORIES: "文件夹" };
      var modeTextMap = { WILDCARD: "通配符", REGEX: "正则表达式", STRICT: "严格模式" };
      var obsidian3 = require("obsidian");
      function getCurrentFilter(idx) {
        var currentFilters = actionType === "PIN" ? plugin.fileExplorerEnhancerSettings.pinFilters.paths : plugin.fileExplorerEnhancerSettings.hideFilters.paths;
        return currentFilters[idx];
      }
      var headerRow = containerEl.createDiv({ cls: "nene-filter-table-header" });
      headerRow.createSpan({ cls: "nene-filter-col-drag" });
      headerRow.createSpan({ cls: "nene-filter-col-selector", text: "选择器" });
      headerRow.createSpan({ cls: "nene-filter-col-name", text: "名称" });
      headerRow.createSpan({ cls: "nene-filter-col-type", text: "文件类型" });
      headerRow.createSpan({ cls: "nene-filter-col-mode", text: "匹配模式" });
      headerRow.createSpan({ cls: "nene-filter-col-toggle" });
      headerRow.createSpan({ cls: "nene-filter-col-btn" });
      headerRow.createSpan({ cls: "nene-filter-col-btn" });
      headerRow.createSpan({ cls: "nene-filter-col-btn" });
      var rowsContainer = containerEl.createDiv({ cls: "nene-filter-rows-container" });
      var rowRefs = [];
      for (var i = 0; i < filters.length; i++) {
        (function(index) {
          var f = getCurrentFilter(index);
          var patternText = f.pattern || "(空)";
          var nameText = f.name || "";
          var typeText = typeTextMap[f.type] || f.type;
          var modeText = modeTextMap[f.patternType] || f.patternType;
          var setting = new obsidian3.Setting(rowsContainer);
          setting.settingEl.addClass("nene-filter-setting-row");
          setting.settingEl.setAttribute("data-nene-filter-row-index", String(index));
          setting.addText(function(text) {
            text.setValue(patternText).setDisabled(true);
            text.inputEl.addClass("nene-filter-text-display");
          });
          setting.addText(function(text) {
            text.setValue(nameText).setDisabled(true);
            text.inputEl.addClass("nene-filter-text-display");
          });
          setting.addText(function(text) {
            text.setValue(typeText).setDisabled(true);
            text.inputEl.addClass("nene-filter-text-display");
          });
          setting.addText(function(text) {
            text.setValue(modeText).setDisabled(true);
            text.inputEl.addClass("nene-filter-text-display");
          });
          setting.addToggle(function(toggle) {
            toggle.setTooltip("启用").setValue(f.active).onChange(function(isActive) {
              var cur = getCurrentFilter(index);
              cur.active = isActive;
              plugin.fileExplorerEnhancerStore.save();
              if (plugin._fileExplorerView) {
                plugin._fileExplorerView.requestSort();
              }
            });
          });
          setting.addExtraButton(function(button) {
            button.setIcon("search").setTooltip("查看当前规则生效的文件与文件夹").onClick(function() {
              new SingleFilterActivatedModal(plugin, getCurrentFilter(index), actionType).open();
            });
          });
          setting.addExtraButton(function(button) {
            button.setIcon("pencil").setTooltip("编辑").onClick(function() {
              new NewPathFilterModal(plugin, actionType, index, function() {
                self.onOpen();
              }).open();
            });
          });
          setting.addExtraButton(function(button) {
            button.setIcon("cross").setTooltip("删除").onClick(function() {
              var list = actionType === "PIN" ? plugin.fileExplorerEnhancerSettings.pinFilters.paths : plugin.fileExplorerEnhancerSettings.hideFilters.paths;
              list.splice(index, 1);
              plugin.fileExplorerEnhancerStore.save();
              if (plugin._fileExplorerView) {
                plugin._fileExplorerView.requestSort();
              }
              self.onOpen();
            });
          });
          var controlEl = setting.settingEl.querySelector(".setting-item-control");
          var dragHandle = controlEl.createSpan({ cls: "nene-filter-drag-handle" });
          obsidian3.setIcon(dragHandle, "grip-vertical");
          controlEl.insertBefore(dragHandle, controlEl.firstChild);
          rowRefs.push({ el: setting.settingEl, index });
          setting.settingEl._filterIndex = index;
          dragHandle.addEventListener("mousedown", function(event) {
            handleFilterDragStart(event, plugin, actionType, rowsContainer, setting.settingEl, index);
            event.preventDefault();
          });
        })(i);
      }
    };
    PathFilterListModal.prototype.onClose = function() {
      if (this.onChanged) this.onChanged();
      this.contentEl.empty();
    };
    function FileExplorerManagerModal(plugin) {
      obsidian2.Modal.call(this, plugin.app);
      this.plugin = plugin;
    }
    FileExplorerManagerModal.prototype = Object.create(obsidian2.Modal.prototype);
    FileExplorerManagerModal.prototype.constructor = FileExplorerManagerModal;
    FileExplorerManagerModal.prototype.onOpen = function() {
      var contentEl = this.contentEl;
      contentEl.empty();
      contentEl.addClass("nene-settings-modal");
      var headerEl = contentEl.createDiv({ cls: "nene-settings-modal-header" });
      headerEl.createDiv({ cls: "nene-settings-modal-title", text: "文件列表管理" });
      var plugin = this.plugin;
      var settings = plugin.fileExplorerEnhancerStore.getSettings();
      var self = this;
      var pinSectionEl = contentEl.createDiv({ cls: "nene-settings-subsection" });
      pinSectionEl.createEl("h4", { text: "置顶选择器" });
      new obsidian2.Setting(pinSectionEl).setName("启用置顶选择器").addToggle(function(toggle) {
        toggle.setValue(settings.pinFilters.active).onChange(async function(value) {
          settings.pinFilters.active = value;
          await plugin.fileExplorerEnhancerStore.save();
          if (plugin._fileExplorerView) plugin._fileExplorerView.requestSort();
          self.onOpen();
        });
      });
      new obsidian2.Setting(pinSectionEl).setName("路径过滤器").setDesc(getFilterDesc(settings.pinFilters.paths)).addButton(function(button) {
        button.setButtonText("查看列表").onClick(function() {
          new PathFilterListModal(plugin, "PIN", function() {
            self.onOpen();
          }).open();
        });
      }).addButton(function(button) {
        button.setButtonText("新建").setCta().onClick(function() {
          new NewPathFilterModal(plugin, "PIN", -1, function() {
            self.onOpen();
          }).open();
        });
      });
      var hideSectionEl = contentEl.createDiv({ cls: "nene-settings-subsection" });
      hideSectionEl.createEl("h4", { text: "隐藏选择器" });
      new obsidian2.Setting(hideSectionEl).setName("启用隐藏选择器").addToggle(function(toggle) {
        toggle.setValue(settings.hideFilters.active).onChange(async function(value) {
          settings.hideFilters.active = value;
          await plugin.fileExplorerEnhancerStore.save();
          if (plugin._fileExplorerView) plugin._fileExplorerView.requestSort();
          self.onOpen();
        });
      });
      new obsidian2.Setting(hideSectionEl).setName("路径过滤器").setDesc(getFilterDesc(settings.hideFilters.paths)).addButton(function(button) {
        button.setButtonText("查看列表").onClick(function() {
          new PathFilterListModal(plugin, "HIDE", function() {
            self.onOpen();
          }).open();
        });
      }).addButton(function(button) {
        button.setButtonText("新建").setCta().onClick(function() {
          new NewPathFilterModal(plugin, "HIDE", -1, function() {
            self.onOpen();
          }).open();
        });
      });
    };
    FileExplorerManagerModal.prototype.onClose = function() {
      this.contentEl.empty();
    };
    function NewPathFilterModal(plugin, actionType, editIndex, onSaved) {
      obsidian2.Modal.call(this, plugin.app);
      this.plugin = plugin;
      this.actionType = actionType;
      this.editIndex = editIndex >= 0 ? editIndex : -1;
      this.onSaved = onSaved || null;
    }
    NewPathFilterModal.prototype = Object.create(obsidian2.Modal.prototype);
    NewPathFilterModal.prototype.constructor = NewPathFilterModal;
    NewPathFilterModal.prototype.onOpen = function() {
      this.modalEl.addClass("nene-new-filter-modal");
      var contentEl = this.contentEl;
      contentEl.empty();
      var self = this;
      var plugin = this.plugin;
      var actionType = this.actionType;
      var isEditing = this.editIndex >= 0;
      var existingFilter = null;
      if (isEditing) {
        var filtersList = actionType === "PIN" ? plugin.fileExplorerEnhancerSettings.pinFilters.paths : plugin.fileExplorerEnhancerSettings.hideFilters.paths;
        existingFilter = filtersList[self.editIndex];
      }
      var tempFilter = {
        name: existingFilter ? existingFilter.name : "",
        active: true,
        type: existingFilter ? existingFilter.type : "FILES",
        pattern: existingFilter ? existingFilter.pattern : "",
        patternType: existingFilter ? existingFilter.patternType : "STRICT"
      };
      var bodyEl = contentEl.createDiv({ cls: "nene-new-filter-body" });
      var titleText = isEditing ? actionType === "PIN" ? "编辑置顶路径过滤器" : "编辑隐藏路径过滤器" : actionType === "PIN" ? "新建置顶路径过滤器" : "新建隐藏路径过滤器";
      bodyEl.createEl("h3", { text: titleText });
      var setting = new obsidian2.Setting(bodyEl);
      setting.settingEl.addClass("nene-new-filter-setting");
      setting.addText(function(text) {
        text.setPlaceholder("名称（可选）").setValue(tempFilter.name).onChange(function(v) {
          tempFilter.name = v;
        });
      }).addSearch(function(text) {
        new PathSuggest(plugin.app, text.inputEl);
        text.setPlaceholder("路径规则（可选）").setValue(tempFilter.pattern).onChange(function(v) {
          tempFilter.pattern = v;
        });
      }).addDropdown(function(dropdown) {
        dropdown.addOptions({
          FILES: "文件",
          DIRECTORIES: "文件夹"
        }).setValue(tempFilter.type).onChange(function(v) {
          tempFilter.type = v;
        });
      }).addDropdown(function(dropdown) {
        dropdown.addOptions({
          WILDCARD: "通配符",
          REGEX: "正则表达式",
          STRICT: "严格模式"
        }).setValue(tempFilter.patternType).onChange(function(v) {
          tempFilter.patternType = v;
        });
      });
      var footerEl = contentEl.createDiv({ cls: "nene-new-filter-footer" });
      var cancelBtn = footerEl.createEl("button", { text: "取消" });
      cancelBtn.addEventListener("click", function() {
        self.close();
      });
      var confirmBtn = footerEl.createEl("button", { cls: "mod-cta", text: isEditing ? "保存" : "确认" });
      confirmBtn.addEventListener("click", function() {
        var filtersList2 = actionType === "PIN" ? plugin.fileExplorerEnhancerSettings.pinFilters.paths : plugin.fileExplorerEnhancerSettings.hideFilters.paths;
        var newFilter = {
          name: tempFilter.name,
          active: isEditing ? existingFilter.active : tempFilter.active,
          type: tempFilter.type,
          pattern: tempFilter.pattern,
          patternType: tempFilter.patternType,
          position: isEditing ? existingFilter.position : filtersList2.length
        };
        if (isEditing) {
          filtersList2[self.editIndex] = newFilter;
          new obsidian2.Notice("路径过滤器已更新");
        } else {
          filtersList2.push(newFilter);
          new obsidian2.Notice("路径过滤器已添加");
        }
        plugin.fileExplorerEnhancerStore.save();
        if (tempFilter.active && plugin._fileExplorerView) {
          plugin._fileExplorerView.requestSort();
        }
        if (self.onSaved) self.onSaved();
        self.close();
      });
    };
    NewPathFilterModal.prototype.onClose = function() {
      this.contentEl.empty();
    };
    function generateTable(data) {
      var table = document.createElement("table");
      var thead = document.createElement("thead");
      var tbody = document.createElement("tbody");
      table.appendChild(thead);
      table.appendChild(tbody);
      for (var i = 0; i < data.length; i++) {
        var row = data[i];
        var tableRow = document.createElement("tr");
        if (i === 0) {
          thead.appendChild(tableRow);
        } else {
          tbody.appendChild(tableRow);
        }
        for (var j = 0; j < row.length; j++) {
          var cell;
          if (i === 0) {
            cell = document.createElement("th");
            cell.textContent = data[i][j];
          } else {
            cell = document.createElement("td");
            if (typeof data[i][j] === "string") {
              cell.textContent = data[i][j];
            } else {
              cell.appendChild(data[i][j]);
            }
          }
          tableRow.appendChild(cell);
        }
      }
      return table;
    }
    function SingleFilterActivatedModal(plugin, filter, actionType) {
      obsidian2.Modal.call(this, plugin.app);
      this.plugin = plugin;
      this.filter = filter;
      this.actionType = actionType;
    }
    SingleFilterActivatedModal.prototype = Object.create(obsidian2.Modal.prototype);
    SingleFilterActivatedModal.prototype.constructor = SingleFilterActivatedModal;
    SingleFilterActivatedModal.prototype.onOpen = function() {
      this.modalEl.addClass("mod-sidebar-layout");
      var contentEl = this.contentEl;
      contentEl.empty();
      contentEl.addClasses(["file-explorer-plus", "filters-activated-modal"]);
      var actionText = this.actionType === "PIN" ? "置顶" : "隐藏";
      var titleText = "「" + (this.filter.name || this.filter.pattern || "未命名") + "」规则生效的" + actionText + "列表";
      contentEl.createEl("h3", { text: titleText });
      var allFiles = this.plugin.app.vault.getAllLoadedFiles();
      var matched = [];
      var checkFn = require_runtime4().checkPathFilter;
      for (var i = 0; i < allFiles.length; i++) {
        if (checkFn(this.filter, allFiles[i])) {
          matched.push(allFiles[i]);
        }
      }
      if (matched.length === 0) {
        contentEl.createEl("p", { text: "当前没有匹配的文件或文件夹。" });
        return;
      }
      var table = document.createElement("table");
      var thead = document.createElement("thead");
      var tbody = document.createElement("tbody");
      table.appendChild(thead);
      table.appendChild(tbody);
      var headerRow = document.createElement("tr");
      var thPath = document.createElement("th");
      thPath.textContent = "路径";
      headerRow.appendChild(thPath);
      var thType = document.createElement("th");
      thType.textContent = "类型";
      headerRow.appendChild(thType);
      var thFilter = document.createElement("th");
      thFilter.textContent = "过滤器";
      headerRow.appendChild(thFilter);
      thead.appendChild(headerRow);
      var self = this;
      var filterDisplay = this.filter.name || this.filter.pattern;
      for (var j = 0; j < matched.length; j++) {
        var file = matched[j];
        var row = document.createElement("tr");
        var tdPath = document.createElement("td");
        if (file instanceof obsidian2.TFile) {
          var link = document.createElement("a");
          link.textContent = file.path;
          link.addEventListener("click", /* @__PURE__ */ (function(f) {
            return function() {
              self.plugin.app.workspace.getLeaf("tab").openFile(f);
            };
          })(file));
          tdPath.appendChild(link);
        } else {
          tdPath.textContent = file.path;
        }
        row.appendChild(tdPath);
        var tdType = document.createElement("td");
        tdType.textContent = file instanceof obsidian2.TFile ? "文件" : "文件夹";
        row.appendChild(tdType);
        var tdFilter = document.createElement("td");
        tdFilter.textContent = filterDisplay;
        row.appendChild(tdFilter);
        tbody.appendChild(row);
      }
      contentEl.appendChild(table);
      var actionEl = contentEl.createDiv({ cls: "nene-settings-modal-actions" });
      var closeBtn = actionEl.createEl("button", { text: "关闭" });
      closeBtn.addEventListener("click", function() {
        self.close();
      });
    };
    SingleFilterActivatedModal.prototype.onClose = function() {
      this.contentEl.empty();
    };
    function getFilterDesc(filters) {
      if (!filters || filters.length === 0) {
        return "当前 0 条规则。";
      }
      var activeCount = filters.filter(function(f) {
        return f.active;
      }).length;
      return "当前 " + filters.length + " 条规则，" + activeCount + " 条启用。";
    }
    module2.exports = {
      PathSuggest,
      PathFilterListModal,
      PathsActivatedModal,
      NewPathFilterModal,
      FileExplorerManagerModal,
      SingleFilterActivatedModal
    };
  }
});

// src/modules/file-explorer-enhancer/index.js
var require_file_explorer_enhancer = __commonJS({
  "src/modules/file-explorer-enhancer/index.js"(exports2, module2) {
    "use strict";
    var constants = require_constants7();
    var store = require_store8();
    var runtime = require_runtime4();
    var view = require_view6();
    module2.exports = {
      DEFAULT_FILE_EXPLORER_ENHANCER_SETTINGS: constants.DEFAULT_FILE_EXPLORER_ENHANCER_SETTINGS,
      FileExplorerEnhancerStore: store.FileExplorerEnhancerStore,
      PathSuggest: view.PathSuggest,
      PathFilterListModal: view.PathFilterListModal,
      PathsActivatedModal: view.PathsActivatedModal,
      NewPathFilterModal: view.NewPathFilterModal,
      FileExplorerManagerModal: view.FileExplorerManagerModal,
      addCommands: runtime.addCommands,
      addOnRename: runtime.addOnRename,
      addOnDelete: runtime.addOnDelete,
      cacheFileMenuTarget: runtime.cacheFileMenuTarget,
      checkPathFilter: runtime.checkPathFilter,
      changeVirtualElementPin: runtime.changeVirtualElementPin,
      patchFileExplorerFolder: runtime.patchFileExplorerFolder,
      getPathsToPin: runtime.getPathsToPin,
      getPathsToHide: runtime.getPathsToHide,
      unloadFileExplorerEnhancer: runtime.unloadFileExplorerEnhancer,
      refreshCompiledState: runtime.refreshCompiledState,
      injectEyeButtons: runtime.injectEyeButtons,
      removeEyeButtons: runtime.removeEyeButtons,
      setupFileExplorerFocusTracking: runtime.setupFileExplorerFocusTracking,
      updateEyeButtonState: runtime.updateEyeButtonState
    };
  }
});

// src/modules/settings-tab/index.js
var require_settings_tab = __commonJS({
  "src/modules/settings-tab/index.js"(exports2, module2) {
    "use strict";
    var obsidian2 = require("obsidian");
    var copyPathModule2 = require_copy_path();
    var menuCustomizerModule = require_context_menu_enhancer();
    var statusBarEnhancerModule2 = require_status_bar_enhancer();
    var tabBarEnhancerModule2 = require_tab_bar_enhancer();
    var fileExplorerEnhancerModule2 = require_file_explorer_enhancer();
    async function copyTextToClipboard(text) {
      if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(text);
        return;
      }
      const textareaEl = document.createElement("textarea");
      textareaEl.value = text;
      textareaEl.style.position = "fixed";
      textareaEl.style.opacity = "0";
      document.body.appendChild(textareaEl);
      textareaEl.focus();
      textareaEl.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textareaEl);
      if (!copied) {
        throw new Error("Clipboard copy is not supported");
      }
    }
    function renderModalHeader(containerEl, title, description) {
      const headerEl = containerEl.createDiv({ cls: "nene-settings-modal-header" });
      headerEl.createDiv({ cls: "nene-settings-modal-title", text: title });
      if (description) {
        headerEl.createEl("p", {
          cls: "nene-settings-modal-description",
          text: description
        });
      }
    }
    function renderDetailItem(containerEl, label, value, codeStyle) {
      const itemEl = containerEl.createDiv({ cls: "nene-settings-detail-item" });
      itemEl.createDiv({ cls: "nene-settings-detail-label", text: label });
      itemEl.createEl(codeStyle ? "code" : "div", {
        cls: "nene-settings-detail-value",
        text: value
      });
    }
    var ConfigurationExportModal = class extends obsidian2.Modal {
      constructor(app, exportedText) {
        super(app);
        this.exportedText = exportedText;
      }
      // 打开弹窗时渲染只读文本与复制按钮。
      onOpen() {
        const { contentEl } = this;
        this.modalEl.addClass("mod-sidebar-layout", "nene-settings-panel-modal");
        contentEl.empty();
        contentEl.addClass("nene-settings-modal");
        renderModalHeader(
          contentEl,
          "导出插件配置",
          "以下内容包含当前核心配置与模块配置，可直接复制保存，或用于后续导入恢复。"
        );
        const textareaEl = contentEl.createEl("textarea", {
          cls: "nene-settings-json-textarea"
        });
        textareaEl.value = this.exportedText;
        textareaEl.readOnly = true;
        const actionEl = contentEl.createDiv({ cls: "nene-settings-modal-actions" });
        const copyButtonEl = actionEl.createEl("button", {
          cls: "mod-cta",
          text: "复制内容"
        });
        const closeButtonEl = actionEl.createEl("button", {
          text: "关闭"
        });
        copyButtonEl.addEventListener("click", async () => {
          try {
            await copyTextToClipboard(this.exportedText);
            new obsidian2.Notice("配置内容已复制到剪贴板");
          } catch (error) {
            console.error("复制导出配置失败", error);
            new obsidian2.Notice("复制失败，请手动全选文本后复制");
          }
        });
        closeButtonEl.addEventListener("click", () => {
          this.close();
        });
      }
      // 关闭弹窗时清理内容，避免重复挂载旧节点。
      onClose() {
        this.contentEl.empty();
      }
    };
    var ConfigurationImportModal = class extends obsidian2.Modal {
      constructor(app, onSubmit) {
        super(app);
        this.onSubmit = onSubmit;
      }
      // 打开弹窗时渲染输入框与确认按钮。
      onOpen() {
        const { contentEl } = this;
        this.modalEl.addClass("mod-sidebar-layout", "nene-settings-panel-modal");
        contentEl.empty();
        contentEl.addClass("nene-settings-modal");
        renderModalHeader(
          contentEl,
          "导入插件配置",
          "请粘贴此前导出的 JSON 文本。导入后会立即覆盖当前插件配置，请确认内容来源可信。"
        );
        const textareaEl = contentEl.createEl("textarea", {
          cls: "nene-settings-json-textarea"
        });
        textareaEl.placeholder = "在此粘贴导出的配置 JSON";
        const actionEl = contentEl.createDiv({ cls: "nene-settings-modal-actions" });
        const cancelButtonEl = actionEl.createEl("button", {
          text: "取消"
        });
        const submitButtonEl = actionEl.createEl("button", {
          cls: "mod-warning",
          text: "导入并覆盖"
        });
        cancelButtonEl.addEventListener("click", () => {
          this.close();
        });
        submitButtonEl.addEventListener("click", async () => {
          const rawText = textareaEl.value.trim();
          if (!rawText) {
            new obsidian2.Notice("请先粘贴需要导入的配置 JSON");
            return;
          }
          submitButtonEl.disabled = true;
          try {
            await this.onSubmit(rawText);
            new obsidian2.Notice("插件配置已导入");
            this.close();
          } catch (error) {
            console.error("导入插件配置失败", error);
            new obsidian2.Notice(`导入失败：${error.message || "请检查 JSON 格式"}`);
          } finally {
            submitButtonEl.disabled = false;
          }
        });
      }
      // 关闭弹窗时清理内容，避免重复挂载旧节点。
      onClose() {
        this.contentEl.empty();
      }
    };
    var ConfirmActionModal = class extends obsidian2.Modal {
      constructor(app, title, description, confirmText, onConfirm) {
        super(app);
        this.title = title;
        this.description = description;
        this.confirmText = confirmText;
        this.onConfirm = onConfirm;
      }
      // 打开弹窗时渲染说明文本与确认按钮。
      onOpen() {
        const { contentEl } = this;
        this.modalEl.addClass("mod-sidebar-layout", "nene-settings-panel-modal");
        contentEl.empty();
        contentEl.addClass("nene-settings-modal");
        renderModalHeader(contentEl, this.title, this.description);
        const actionEl = contentEl.createDiv({ cls: "nene-settings-modal-actions" });
        const cancelButtonEl = actionEl.createEl("button", {
          text: "取消"
        });
        const confirmButtonEl = actionEl.createEl("button", {
          cls: "mod-warning",
          text: this.confirmText
        });
        cancelButtonEl.addEventListener("click", () => {
          this.close();
        });
        confirmButtonEl.addEventListener("click", async () => {
          confirmButtonEl.disabled = true;
          try {
            await this.onConfirm();
            this.close();
          } finally {
            confirmButtonEl.disabled = false;
          }
        });
      }
      // 关闭弹窗时清理内容，避免重复挂载旧节点。
      onClose() {
        this.contentEl.empty();
      }
    };
    var FileMarkerManagementModal = class extends obsidian2.Modal {
      constructor(app, plugin, onSettingsChanged) {
        super(app);
        this.plugin = plugin;
        this.onSettingsChanged = onSettingsChanged;
      }
      // 打开弹窗时渲染模块详情与维护操作。
      onOpen() {
        this.modalEl.addClass("mod-sidebar-layout", "nene-settings-panel-modal");
        this.contentEl.empty();
        this.contentEl.addClass("nene-settings-modal");
        void this.render();
      }
      // 根据当前最新状态渲染文件标记模块管理界面。
      async render() {
        const { contentEl } = this;
        const summary = this.plugin.getSettingsSummary();
        const configSummary = await this.plugin.getConfigManagementSummary();
        contentEl.empty();
        renderModalHeader(
          contentEl,
          "文件标记模块",
          "这里集中放置文件标记模块的具体管理动作，主设置页只保留启用状态与入口。"
        );
        const detailListEl = contentEl.createDiv({ cls: "nene-settings-detail-list" });
        renderDetailItem(detailListEl, "当前状态", summary.fileMarkerEnabled ? "已启用" : "已关闭");
        renderDetailItem(detailListEl, "标记数量", `${summary.markCount} 条`);
        renderDetailItem(detailListEl, "分组数量", `${summary.groupCount} 个`);
        renderDetailItem(detailListEl, "配置文件", configSummary.fileMarker.path, true);
        new obsidian2.Setting(contentEl).setName("打开文件标记面板").setDesc(summary.fileMarkerEnabled ? "在右侧侧边栏打开文件标记面板。" : "模块当前未启用，请先回到设置页开启。").addButton((button) => {
          button.setButtonText("打开面板").setDisabled(!summary.fileMarkerEnabled).onClick(async () => {
            await this.plugin.startFileMarkerFeature();
          });
        });
        new obsidian2.Setting(contentEl).setName("清理失效标记").setDesc("立即移除已不存在文件对应的标记记录，并同步刷新文件标记面板。").addButton((button) => {
          button.setButtonText("立即清理").onClick(async () => {
            const hasChanged = await this.plugin.pruneMissingMarkRecords();
            new obsidian2.Notice(hasChanged ? "失效标记已清理" : "当前没有需要清理的失效标记");
            await this.onSettingsChanged();
            await this.render();
          });
        });
        new obsidian2.Setting(contentEl).setName("重置模块配置").setDesc("将文件标记模块的数据文件恢复为默认值，不影响关系图谱设置与核心开关。").addButton((button) => {
          button.setButtonText("重置 file-marker").setWarning().onClick(() => {
            new ConfirmActionModal(
              this.app,
              "重置文件标记配置",
              "此操作会将文件标记的 marks 与 groups 恢复为默认值，当前已有的标记记录将被覆盖。",
              "确认重置",
              async () => {
                await this.plugin.resetFeatureConfiguration("fileMarker");
                new obsidian2.Notice("文件标记配置已重置");
                await this.onSettingsChanged();
                await this.render();
              }
            ).open();
          });
        });
      }
      // 关闭弹窗时清理内容，避免重复挂载旧节点。
      onClose() {
        this.contentEl.empty();
      }
    };
    var AnchorGraphManagementModal = class extends obsidian2.Modal {
      constructor(app, plugin, onSettingsChanged) {
        super(app);
        this.plugin = plugin;
        this.onSettingsChanged = onSettingsChanged;
      }
      // 打开弹窗时渲染模块详情与维护操作。
      onOpen() {
        this.modalEl.addClass("mod-sidebar-layout", "nene-settings-panel-modal");
        this.contentEl.empty();
        this.contentEl.addClass("nene-settings-modal");
        void this.render();
      }
      // 根据当前最新状态渲染关系图谱模块管理界面。
      async render() {
        const { contentEl } = this;
        const summary = this.plugin.getSettingsSummary();
        const configSummary = await this.plugin.getConfigManagementSummary();
        contentEl.empty();
        renderModalHeader(
          contentEl,
          "关系图谱模块",
          "这里集中放置关系图谱增强模块的具体管理动作，主设置页只保留启用状态与入口。"
        );
        const detailListEl = contentEl.createDiv({ cls: "nene-settings-detail-list" });
        renderDetailItem(detailListEl, "当前状态", summary.anchorGraphEnabled ? "已启用" : "已关闭");
        renderDetailItem(detailListEl, "运行状态", summary.anchorGraphRuntimeMessage);
        renderDetailItem(detailListEl, "已识别源文件", `${summary.anchorGraphSourceFileCount} 个`);
        renderDetailItem(detailListEl, "已注入关系边", `${summary.anchorGraphEdgeCount} 条`);
        renderDetailItem(detailListEl, "配置文件", configSummary.anchorGraph.path, true);
        new obsidian2.Setting(contentEl).setName("立即刷新关系图谱").setDesc(summary.anchorGraphEnabled ? "重新扫描并注入当前可识别的 HTML 内部链接关系。" : "模块当前未启用，请先回到设置页开启。").addButton((button) => {
          button.setButtonText("立即刷新").setDisabled(!summary.anchorGraphEnabled).onClick(async () => {
            await this.plugin.refreshAnchorGraphLinks(true);
            await this.onSettingsChanged();
            await this.render();
          });
        });
        new obsidian2.Setting(contentEl).setName("重置模块配置").setDesc("将关系图谱增强模块的数据文件恢复为默认值，不影响文件标记设置与核心开关。").addButton((button) => {
          button.setButtonText("重置 anchor-graph").setWarning().onClick(() => {
            new ConfirmActionModal(
              this.app,
              "重置关系图谱配置",
              "此操作会将关系图谱增强的默认设置与笔记覆盖规则恢复为默认值。",
              "确认重置",
              async () => {
                await this.plugin.resetFeatureConfiguration("anchorGraph");
                new obsidian2.Notice("关系图谱配置已重置");
                await this.onSettingsChanged();
                await this.render();
              }
            ).open();
          });
        });
      }
      // 关闭弹窗时清理内容，避免重复挂载旧节点。
      onClose() {
        this.contentEl.empty();
      }
    };
    var MenuCustomizerManagementModal = class extends menuCustomizerModule.MenuCustomizerManagementModal {
    };
    var CopyPathManagementModal = class extends copyPathModule2.CopyPathManagementModal {
    };
    var StatusBarEnhancerManagementModal = class extends statusBarEnhancerModule2.StatusBarEnhancerManagementModal {
    };
    var TabBarEnhancerManagementModal = class extends tabBarEnhancerModule2.TabBarEnhancerManagementModal {
    };
    var ConfigManagementModal = class extends obsidian2.Modal {
      constructor(app, plugin, onSettingsChanged) {
        super(app);
        this.plugin = plugin;
        this.onSettingsChanged = onSettingsChanged;
      }
      // 打开弹窗时渲染配置文件管理界面。
      onOpen() {
        this.modalEl.addClass("mod-sidebar-layout", "nene-settings-panel-modal");
        this.contentEl.empty();
        this.contentEl.addClass("nene-settings-modal");
        void this.render();
      }
      // 根据当前最新状态渲染配置文件管理界面。
      async render() {
        const { contentEl } = this;
        const configSummary = await this.plugin.getConfigManagementSummary();
        contentEl.empty();
        renderModalHeader(
          contentEl,
          "配置文件管理",
          ""
        );
        const detailListEl = contentEl.createDiv({ cls: "nene-settings-detail-list" });
        renderDetailItem(detailListEl, "核心配置", `${configSummary.core.exists ? "已存在" : "未发现"}，${configSummary.core.summary}`);
        renderDetailItem(detailListEl, "文件标记配置", `${configSummary.fileMarker.exists ? "已存在" : "未发现"}，${configSummary.fileMarker.summary}`);
        renderDetailItem(detailListEl, "关系图谱配置", `${configSummary.anchorGraph.exists ? "已存在" : "未发现"}，${configSummary.anchorGraph.summary}`);
        renderDetailItem(detailListEl, "右键菜单配置", `${configSummary.menuCustomizer.exists ? "已存在" : "未发现"}，${configSummary.menuCustomizer.summary}`);
        renderDetailItem(detailListEl, "复制路径配置", `${configSummary.copyPath.exists ? "已存在" : "未发现"}，${configSummary.copyPath.summary}`);
        renderDetailItem(detailListEl, "状态栏增强配置", `${configSummary.statusBarEnhancer.exists ? "已存在" : "未发现"}，${configSummary.statusBarEnhancer.summary}`);
        renderDetailItem(detailListEl, "标签栏增强配置", `${configSummary.tabBarEnhancer.exists ? "已存在" : "未发现"}，${configSummary.tabBarEnhancer.summary}`);
        renderDetailItem(detailListEl, "配置目录", configSummary.directoryPath, true);
        renderDetailItem(detailListEl, "导出目录", configSummary.exportDirectoryPath, true);
        new obsidian2.Setting(contentEl).setName("查看导出 JSON").setDesc("").addButton((button) => {
          button.setButtonText("查看内容").onClick(() => {
            new ConfigurationExportModal(this.app, this.plugin.exportConfigurationBundle()).open();
          });
        });
        new obsidian2.Setting(contentEl).setName("导出到独立文件").setDesc("将当前完整配置导出为独立备份文件，自动写入插件目录下的 exports 子目录。").addButton((button) => {
          button.setButtonText("导出文件").onClick(async () => {
            const exportResult = await this.plugin.exportConfigurationBundleToFile();
            new obsidian2.Notice(`配置已导出到 ${exportResult.fileName}`);
            await this.render();
          });
        });
        new obsidian2.Setting(contentEl).setName("复制配置目录路径").setDesc("复制 configs 目录路径").addButton((button) => {
          button.setButtonText("复制路径").onClick(async () => {
            try {
              await copyTextToClipboard(configSummary.directoryPath);
              new obsidian2.Notice("配置目录路径已复制");
            } catch (error) {
              console.error("复制配置目录路径失败", error);
              new obsidian2.Notice("复制失败，请手动查看上方路径");
            }
          });
        });
        new obsidian2.Setting(contentEl).setName("导入配置").setDesc("粘贴此前导出的 JSON 文本后，立即覆盖当前插件配置。导入后设置页与运行时状态会自动同步。").addButton((button) => {
          button.setButtonText("导入 JSON").onClick(() => {
            new ConfigurationImportModal(this.app, async (rawText) => {
              await this.plugin.importConfigurationBundle(rawText);
              await this.onSettingsChanged();
              await this.render();
            }).open();
          });
        });
        new obsidian2.Setting(contentEl).setName("重置全部配置").setDesc("同时重置 data.json 与所有模块配置文件。功能开关、文件标记、关系图谱、右键菜单、复制路径、状态栏增强和标签栏增强设置都会恢复为首次安装状态。").addButton((button) => {
          button.setButtonText("重置全部").setWarning().onClick(() => {
            new ConfirmActionModal(
              this.app,
              "重置全部插件配置",
              "此操作会覆盖当前插件的全部配置文件，包括 data.json、file-marker.json、anchor-graph.json、menu-customizer.json、copy-path.json、status-bar-enhancer.json 和 tab-bar-enhancer.json。请仅在确认需要恢复初始状态时执行。",
              "确认全部重置",
              async () => {
                await this.plugin.resetAllConfiguration();
                new obsidian2.Notice("插件全部配置已重置");
                await this.onSettingsChanged();
                await this.render();
              }
            ).open();
          });
        });
      }
      // 关闭弹窗时清理内容，避免重复挂载旧节点。
      onClose() {
        this.contentEl.empty();
      }
    };
    var ObsidianNenePluginSettingTab = class extends obsidian2.PluginSettingTab {
      constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
      }
      // 渲染设置页内容，主页面只保留模块开启状态与管理入口。
      async display() {
        const { containerEl } = this;
        const summary = this.plugin.getSettingsSummary();
        containerEl.empty();
        containerEl.addClass("nene-settings-tab");
        const headerEl = containerEl.createDiv({ cls: "nene-settings-header" });
        headerEl.createDiv({ cls: "nene-settings-title", text: "ねね 设置" });
        headerEl.createEl("p", {
          cls: "nene-settings-description",
          text: ""
        });
        const featureGroupEl = containerEl.createDiv({ cls: "nene-settings-group" });
        featureGroupEl.createDiv({ cls: "nene-settings-group-title", text: "功能模块" });
        this.renderFileMarkerSection(featureGroupEl, summary);
        this.renderAnchorGraphSection(featureGroupEl, summary);
        this.renderMenuCustomizerSection(featureGroupEl, summary);
        this.renderCopyPathSection(featureGroupEl, summary);
        this.renderStatusBarEnhancerSection(featureGroupEl, summary);
        this.renderTabBarEnhancerSection(featureGroupEl, summary);
        this.renderCorePluginEnhancerSection(featureGroupEl, summary);
        const managementGroupEl = containerEl.createDiv({ cls: "nene-settings-group" });
        managementGroupEl.createDiv({ cls: "nene-settings-group-title", text: "配置管理" });
        this.renderConfigManagementEntry(managementGroupEl);
        this.renderRuleSection(managementGroupEl);
      }
      // 渲染文件标记模块分区，仅保留状态概览、开关与弹窗入口。
      renderFileMarkerSection(containerEl, summary) {
        new obsidian2.Setting(containerEl).setName("文件标记面板").setDesc(
          summary.fileMarkerEnabled ? summary.fileMarkerViewOpen ? `已启用，面板已打开，当前共有 ${summary.markCount} 条标记、${summary.groupCount} 个分组。` : `已启用，面板未打开，当前已保存 ${summary.markCount} 条标记、${summary.groupCount} 个分组。` : `未启用，当前已保存 ${summary.markCount} 条标记、${summary.groupCount} 个分组。`
        ).addToggle((toggle) => {
          toggle.setValue(summary.fileMarkerEnabled).onChange(async (value) => {
            await this.plugin.updateFileMarkerEnabled(value);
            new obsidian2.Notice(value ? "已启用文件标记面板" : "已关闭文件标记面板");
            await this.display();
          });
        }).addButton((button) => {
          button.setButtonText("管理").onClick(() => {
            new FileMarkerManagementModal(this.app, this.plugin, async () => {
              await this.display();
            }).open();
          });
        });
      }
      // 渲染关系图谱模块分区，仅保留状态概览、开关与弹窗入口。
      renderAnchorGraphSection(containerEl, summary) {
        const runtimeStateLabelMap = {
          active: "运行中",
          degraded: "已降级",
          disabled: "已关闭",
          idle: "待初始化"
        };
        new obsidian2.Setting(containerEl).setName("关系图谱 HTML 链接增强").setDesc(
          `${runtimeStateLabelMap[summary.anchorGraphRuntimeState] || "未知"}，已识别 ${summary.anchorGraphSourceFileCount} 个源文件中的 ${summary.anchorGraphEdgeCount} 条关系边。`
        ).addToggle((toggle) => {
          toggle.setValue(summary.anchorGraphEnabled).onChange(async (value) => {
            await this.plugin.updateAnchorGraphEnabled(value);
            new obsidian2.Notice(value ? "已启用关系图谱 HTML 链接增强" : "已关闭关系图谱 HTML 链接增强");
            await this.display();
          });
        }).addButton((button) => {
          button.setButtonText("管理").onClick(() => {
            new AnchorGraphManagementModal(this.app, this.plugin, async () => {
              await this.display();
            }).open();
          });
        });
      }
      // 渲染右键菜单自定义模块分区，仅保留状态概览、开关与弹窗入口。
      renderMenuCustomizerSection(containerEl, summary) {
        new obsidian2.Setting(containerEl).setName("右键菜单自定义").setDesc(
          summary.menuCustomizerEnabled ? `已启用，当前共有 ${summary.menuCustomizerMenuCount} 个菜单类型开启自定义，配置了 ${summary.menuCustomizerGroupCount} 个分组。` : `未启用，已保存 ${summary.menuCustomizerGroupCount} 个分组配置，启用后会在菜单显示前重构右键菜单。`
        ).addToggle((toggle) => {
          toggle.setValue(summary.menuCustomizerEnabled).onChange(async (value) => {
            await this.plugin.updateMenuCustomizerEnabled(value);
            new obsidian2.Notice(value ? "已启用右键菜单自定义" : "已关闭右键菜单自定义");
            await this.display();
          });
        }).addButton((button) => {
          button.setButtonText("管理").onClick(() => {
            new MenuCustomizerManagementModal(this.app, this.plugin, async () => {
              await this.display();
            }).open();
          });
        });
      }
      // 渲染复制路径模块分区，仅保留状态概览、开关与弹窗入口。
      renderCopyPathSection(containerEl, summary) {
        new obsidian2.Setting(containerEl).setName("复制路径").setDesc(
          summary.copyPathEnabled ? summary.copyPathTrailingSlashEnabled ? "已启用，文件夹路径复制时会自动在末尾追加 /。模块只注册命令，不会直接向右键菜单添加入口。" : "已启用，当前不会为文件夹路径自动补 /。模块只注册命令，不会直接向右键菜单添加入口。" : "未启用。启用后会注册中文命令，并可被“右键菜单自定义”模块自动探测并手动加入菜单。"
        ).addToggle((toggle) => {
          toggle.setValue(summary.copyPathEnabled).onChange(async (value) => {
            await this.plugin.updateCopyPathEnabled(value);
            new obsidian2.Notice(value ? "已启用复制路径模块" : "已关闭复制路径模块");
            await this.display();
          });
        }).addButton((button) => {
          button.setButtonText("管理").onClick(() => {
            new CopyPathManagementModal(this.app, this.plugin, async () => {
              await this.display();
            }).open();
          });
        });
      }
      // 渲染状态栏增强模块分区，仅保留状态概览、开关与弹窗入口。
      renderStatusBarEnhancerSection(containerEl, summary) {
        new obsidian2.Setting(containerEl).setName("状态栏增强").setDesc(
          summary.statusBarEnhancerEnabled ? `已启用，当前${summary.statusBarEnhancerShowFileName ? "显示文件名" : "不显示文件名"}、${summary.statusBarEnhancerShowIcons ? "显示图标" : "不显示图标"}，点击状态栏时复制${summary.statusBarEnhancerCopyAbsolutePath ? "绝对路径" : "库内相对路径"}。状态栏元素管理已记录 ${summary.statusBarEnhancerOrganizerElementCount} 个元素。` : "未启用。启用后会在状态栏显示当前活动文件路径，并支持点击状态栏路径直接复制。"
        ).addToggle((toggle) => {
          toggle.setValue(summary.statusBarEnhancerEnabled).onChange(async (value) => {
            await this.plugin.updateStatusBarEnhancerEnabled(value);
            new obsidian2.Notice(value ? "已启用状态栏增强模块" : "已关闭状态栏增强模块");
            await this.display();
          });
        }).addButton((button) => {
          button.setButtonText("管理").onClick(() => {
            new StatusBarEnhancerManagementModal(this.app, this.plugin, async () => {
              await this.display();
            }).open();
          });
        });
      }
      // 渲染标签栏增强模块分区，仅保留状态概览、开关与弹窗入口。
      renderTabBarEnhancerSection(containerEl, summary) {
        new obsidian2.Setting(containerEl).setName("标签栏增强").setDesc(
          summary.tabBarEnhancerEnabled ? `已启用，空白区滚轮切换${summary.tabBarEnhancerTopBarWheel ? "已开启" : "已关闭"}，跳过 CSS 隐藏标签${summary.tabBarEnhancerSkipCssHiddenTabs ? "已开启" : "已关闭"}，跳过未加载插件标签${summary.tabBarEnhancerSkipUnloadedPluginTabs ? "已开启" : "已关闭"}。` : "未启用。启用后可在标签头上滚动鼠标滚轮切换标签，仅桌面端可用。"
        ).addToggle((toggle) => {
          toggle.setValue(summary.tabBarEnhancerEnabled).onChange(async (value) => {
            await this.plugin.updateTabBarEnhancerEnabled(value);
            new obsidian2.Notice(value ? "已启用标签栏增强模块" : "已关闭标签栏增强模块");
            await this.display();
          });
        }).addButton((button) => {
          button.setButtonText("管理").onClick(() => {
            new TabBarEnhancerManagementModal(this.app, this.plugin, async () => {
              await this.display();
            }).open();
          });
        });
      }
      // 渲染配置管理入口，仅保留总览描述与弹窗入口。
      renderConfigManagementEntry(containerEl) {
        new obsidian2.Setting(containerEl).setName("配置文件管理").setDesc("查看配置文件状态、导出到独立文件、导入 JSON 以及重置全部配置。").addButton((button) => {
          button.setButtonText("打开管理窗口").onClick(() => {
            new ConfigManagementModal(this.app, this.plugin, async () => {
              await this.display();
            }).open();
          });
        });
      }
      // 渲染识别规则说明，帮助用户理解当前模块的生效范围。
      renderRuleSection(containerEl) {
        const hintEl = containerEl.createDiv({ cls: "nene-settings-hint" });
        hintEl.createDiv({ cls: "nene-settings-hint-title", text: "说明" });
        const listEl = hintEl.createEl("ul");
        listEl.createEl("li", {
          text: "关系图谱会额外识别 class 包含 internal-link，且带有 data-href 或 href 的 HTML a 标签。"
        });
        listEl.createEl("li", {
          text: "右键菜单自定义基于 Obsidian v1.4.16 的菜单结构设计，启用后会保留原始命令回调，但会重新组织 DOM 顺序。"
        });
        listEl.createEl("li", {
          text: "复制路径模块默认不直接向右键菜单注入入口，只注册命令；如需显示在右键菜单中，可通过“右键菜单自定义”手动添加。"
        });
        listEl.createEl("li", {
          text: "状态栏增强模块主要面向桌面端；移动端通常不显示状态栏，因此只会保留配置，不会实际显示路径。"
        });
        listEl.createEl("li", {
          text: "标签栏增强模块仅面向桌面端，依赖若干未文档化的内部接口实现滚轮切换标签，后续 Obsidian 版本存在失效风险。"
        });
        listEl.createEl("li", {
          text: '文件列表增强模块仅面向桌面端，通过路径规则对文件资源管理器中的文件/文件夹进行置顶与隐藏。右键菜单命令可配合"右键菜单自定义"模块手动配置。'
        });
      }
      // 渲染核心插件增强分区，包含文件列表子模块（二级窗口管理置顶/隐藏选择器）。
      renderCorePluginEnhancerSection(containerEl, summary) {
        var plugin = this.plugin;
        var self = this;
        containerEl.createDiv({ cls: "nene-settings-group-title", text: "核心插件增强" });
        new obsidian2.Setting(containerEl).setName("文件列表").setDesc(
          summary.fileExplorerEnhancerEnabled ? "已启用。可通过路径规则对文件资源管理器中的文件/文件夹进行置顶与隐藏管理。" : "未启用。启用后可对文件资源管理器中的文件/文件夹进行置顶与隐藏。"
        ).addToggle(function(toggle) {
          toggle.setValue(summary.fileExplorerEnhancerEnabled).onChange(async function(value) {
            await plugin.updateFileExplorerEnhancerEnabled(value);
            new obsidian2.Notice(value ? "已启用文件列表增强模块" : "已关闭文件列表增强模块");
            await self.display();
          }.bind({ plugin }));
        }).addButton(function(button) {
          button.setButtonText("管理").setDisabled(!summary.fileExplorerEnhancerEnabled).onClick(function() {
            new fileExplorerEnhancerModule2.FileExplorerManagerModal(plugin).open();
          });
        });
      }
    };
    module2.exports = {
      ObsidianNenePluginSettingTab
    };
  }
});

// src/main.js
var obsidian = require("obsidian");
var fileMarker = require_file_marker();
var pluginData = require_plugin_data();
var pluginSettings = require_plugin_settings();
var pluginListEnhancerModule = require_plugin_list_enhancer();
var graphViewEnhancerModule = require_graph_view_enhancer();
var copyPathModule = require_copy_path();
var statusBarEnhancerModule = require_status_bar_enhancer();
var tabBarEnhancerModule = require_tab_bar_enhancer();
var contextMenuEnhancerModule = require_context_menu_enhancer();
var settingsTabModule = require_settings_tab();
var fileExplorerEnhancerModule = require_file_explorer_enhancer();
var ObsidianNenePlugin = class extends obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.dataStore = new pluginData.PluginDataStore(this);
    this.pluginSettingsStore = new pluginSettings.PluginSettingsStore(this);
    this.fileMarkerStore = new fileMarker.FileMarkerStore(this);
    this.pluginListEnhancer = new pluginListEnhancerModule.PluginListEnhancer(this);
    this.anchorGraphLinkEnhancer = new graphViewEnhancerModule.AnchorGraphLinkEnhancer(this);
    this.copyPathStore = new copyPathModule.CopyPathStore(this);
    this.copyPathService = new copyPathModule.CopyPathService(this);
    this.statusBarEnhancerStore = new statusBarEnhancerModule.StatusBarEnhancerStore(this);
    this.statusBarEnhancerRuntime = new statusBarEnhancerModule.StatusBarEnhancerRuntime(this);
    this.organizerSpooler = null;
    this.tabBarEnhancerStore = new tabBarEnhancerModule.TabBarEnhancerStore(this);
    this.tabBarEnhancerRuntime = new tabBarEnhancerModule.TabBarEnhancerRuntime(this);
    this.menuCustomizerStore = new contextMenuEnhancerModule.MenuCustomizerStore(this);
    this.menuCustomizerRuntime = new contextMenuEnhancerModule.MenuCustomizerRuntime(this);
    this.snippetsStore = new statusBarEnhancerModule.SnippetsStore(this);
    this.snippetsRuntime = new statusBarEnhancerModule.SnippetsRuntime(this);
    this.fileExplorerEnhancerStore = new fileExplorerEnhancerModule.FileExplorerEnhancerStore(this);
    this._fileExplorerView = null;
    this._lastFocusedFile = null;
    this._eyeToggleHistory = [];
  }
  // 暴露只读设置访问入口，兼容后续模块对当前配置的读取。
  get settings() {
    return this.dataStore.getData();
  }
  // 暴露文件资源管理器增强模块设置，供 runtime 直接读写。
  get fileExplorerEnhancerSettings() {
    return this.fileExplorerEnhancerStore.getSettings();
  }
  // 插件加载时执行初始化逻辑。
  async onload() {
    console.log("Loading obsidian-nene-plugin");
    await this.dataStore.load();
    this.pluginSettingsStore.load(this.dataStore.getFeatures());
    this.fileMarkerStore.load(this.dataStore.getFileMarkerData());
    this.menuCustomizerStore.load(this.dataStore.getMenuCustomizerData());
    this.copyPathStore.load(this.dataStore.getCopyPathData());
    this.statusBarEnhancerStore.load(this.dataStore.getStatusBarEnhancerData());
    this.tabBarEnhancerStore.load(this.dataStore.getTabBarEnhancerData());
    this.snippetsStore.load();
    this.fileExplorerEnhancerStore.load(this.dataStore.getFileExplorerEnhancerData());
    this.initializeOrganizerSpooler();
    await this.fileMarkerStore.pruneMissingMarks();
    this.setupFileMarkerView();
    this.setupFileMenu();
    this.setupEditorMenu();
    this.setupStatusBarEnhancerEvents();
    this.setupTabBarEnhancerEvents();
    this.setupVaultEvents();
    this.setupCommandEntries();
    this.setupLayoutEvents();
    this.setupAnchorGraphEvents();
    this.setupFileExplorerEnhancer();
    this.addSettingTab(new settingsTabModule.ObsidianNenePluginSettingTab(this.app, this));
    this.pluginListEnhancer.start();
    this.syncFileMarkerFeatureState();
    this.syncAnchorGraphEnhancerState();
    this.syncStatusBarEnhancerState();
    this.syncTabBarEnhancerState();
    this.syncFileExplorerEnhancerState();
    this.syncMenuCustomizerState();
  }
  // 插件卸载时清理动态资源和已打开视图。
  onunload() {
    console.log("Unloading obsidian-nene-plugin");
    this.pluginListEnhancer.stop();
    this.anchorGraphLinkEnhancer.stop();
    this.statusBarEnhancerRuntime.stop();
    this.snippetsRuntime.stop();
    if (this.organizerSpooler) {
      this.organizerSpooler.stop();
    }
    this.tabBarEnhancerRuntime.stop();
    this.menuCustomizerRuntime.stop();
    this.fileExplorerEnhancerUnload();
    this.app.workspace.getLeavesOfType(fileMarker.FILE_MARKER_VIEW_TYPE).forEach((leaf) => {
      leaf.detach();
    });
  }
  // 注册侧边栏视图，用于集中展示所有文件标记。
  /* ------------------------------ */
  /* 主入口装配 */
  /* ------------------------------ */
  // 注册侧边栏视图，用于集中展示所有文件标记。
  setupFileMarkerView() {
    this.registerView(fileMarker.FILE_MARKER_VIEW_TYPE, (leaf) => {
      return new fileMarker.FileMarkerView(leaf, this);
    });
  }
  // 注册文件资源管理器右键菜单项。
  setupFileMenu() {
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        this.menuCustomizerRuntime.annotateFileMenu(menu, file);
        this.copyPathStore.rememberMenuTarget(file);
        if (!this.isFileMarkerEnabled()) return;
        if (!(file instanceof obsidian.TFile)) return;
        const hasMark = Boolean(this.getMarkRecord(file.path));
        menu.addItem((item) => {
          item.setTitle(hasMark ? "编辑文件标记" : "添加文件标记").setIcon("tag").onClick(() => {
            this.openMarkEditor(file);
          });
        });
      })
    );
  }
  // 注册编辑区右键菜单上下文标记，便于运行时区分编辑菜单与更多选项菜单。
  setupEditorMenu() {
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu) => {
        this.menuCustomizerRuntime.annotateEditorMenu(menu);
      })
    );
  }
  // 注册状态栏增强所需的工作区事件，保证切换文件与改名时状态栏立即刷新。
  setupStatusBarEnhancerEvents() {
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        this.statusBarEnhancerRuntime.renderFilePath(file);
        this.statusBarEnhancerRuntime.renderTimestamps(file);
      })
    );
    this.registerEvent(
      this.app.vault.on("rename", (file) => {
        if (file instanceof obsidian.TFile && file === this.app.workspace.getActiveFile()) {
          this.statusBarEnhancerRuntime.renderFilePath(file);
          this.statusBarEnhancerRuntime.renderTimestamps(file);
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof obsidian.TFile && file === this.app.workspace.getActiveFile()) {
          this.statusBarEnhancerRuntime.renderLastModifiedTimestamp(file);
        }
      })
    );
  }
  // 注册标签栏增强所需的滚轮监听，布局就绪后为全部窗口挂载，并跟踪弹出窗口的开关。
  setupTabBarEnhancerEvents() {
    this.app.workspace.onLayoutReady(() => {
      this.tabBarEnhancerRuntime.registerWheelHandlersForExistingWindows();
      this.registerEvent(
        this.app.workspace.on("window-open", (workspaceWindow) => {
          this.tabBarEnhancerRuntime.registerWheelHandler(workspaceWindow.win);
        })
      );
      this.registerEvent(
        this.app.workspace.on("window-close", (workspaceWindow) => {
          this.tabBarEnhancerRuntime.unregisterWheelHandler(workspaceWindow.win);
        })
      );
    });
  }
  // 注册文件系统事件，保证文件改名或删除后标记数据同步更新。
  setupVaultEvents() {
    this.registerEvent(
      this.app.vault.on("rename", async (file, oldPath) => {
        if (!(file instanceof obsidian.TFile)) return;
        const hasChanged = await this.fileMarkerStore.renameMark(file, oldPath);
        if (hasChanged) {
          this.refreshAllFileMarkerViews();
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", async (file) => {
        if (!(file instanceof obsidian.TFile)) return;
        const hasChanged = await this.fileMarkerStore.removeMarkByFile(file);
        if (hasChanged) {
          this.refreshAllFileMarkerViews();
        }
      })
    );
  }
  // 注册命令入口，便于用户通过命令面板快速打开文件标记视图。
  setupCommandEntries() {
    this.addCommand({
      id: "open-file-marker-view",
      name: "打开文件标记面板",
      callback: async () => {
        await this.startFileMarkerFeature();
      }
    });
    this.addCommand({
      id: "refresh-anchor-graph-links",
      name: "刷新关系图谱 HTML 链接",
      callback: async () => {
        await this.refreshAnchorGraphLinks(true);
      }
    });
    this.addCommand({
      id: "copy-vault-path",
      name: "复制当前目标的库内路径",
      callback: async () => {
        await this.copyPathService.copyVaultPathFromCommand();
      }
    });
    this.addCommand({
      id: "copy-full-path",
      name: "复制当前目标的完整路径",
      callback: async () => {
        await this.copyPathService.copyFullPathFromCommand();
      }
    });
    this.addCommand({
      id: "copy-uri-link",
      name: "复制当前目标的URI链接",
      callback: async () => {
        await this.copyPathService.copyUriLinkFromCommand();
      }
    });
  }
  // 注册布局变化监听，保留原有插件列表增强能力。
  setupLayoutEvents() {
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        this.pluginListEnhancer.processPluginList();
        this.anchorGraphLinkEnhancer.processGraphRefreshButtons();
      })
    );
  }
  // 注册关系图谱 HTML 链接刷新事件，兼顾单文件更新和结构变化后的全量重建。
  setupAnchorGraphEvents() {
    this.registerEvent(
      this.app.workspace.on("editor-change", (editor, view) => {
        if (!this.isAnchorGraphEnabled()) return;
        const file = view && view.file instanceof obsidian.TFile ? view.file : this.app.workspace.getActiveFile();
        if (!(file instanceof obsidian.TFile) || file.extension !== "md") return;
        this.anchorGraphLinkEnhancer.scheduleSourceRefresh(file, editor.getValue(), 240);
      })
    );
    this.registerEvent(
      this.app.metadataCache.on("changed", async (file, data) => {
        if (!this.isAnchorGraphEnabled()) return;
        await this.anchorGraphLinkEnhancer.refreshSourceFile(file, data);
      })
    );
    this.registerEvent(
      this.app.vault.on("create", async (file) => {
        if (!this.isAnchorGraphEnabled()) return;
        if (!(file instanceof obsidian.TFile)) return;
        await this.anchorGraphLinkEnhancer.refreshSourceFileFromVault(file);
        this.anchorGraphLinkEnhancer.scheduleFullRefresh(this.anchorGraphLinkEnhancer.getStructureRefreshDelay());
      })
    );
    this.registerEvent(
      this.app.vault.on("rename", async (file, oldPath) => {
        if (!this.isAnchorGraphEnabled()) return;
        if (!(file instanceof obsidian.TFile)) return;
        await this.anchorGraphLinkEnhancer.handleSourceFileRename(file, oldPath);
        this.anchorGraphLinkEnhancer.scheduleFullRefresh(this.anchorGraphLinkEnhancer.getStructureRefreshDelay());
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (!this.isAnchorGraphEnabled()) return;
        if (!(file instanceof obsidian.TFile)) return;
        this.anchorGraphLinkEnhancer.removeSourceFileLinks(file.path);
        this.anchorGraphLinkEnhancer.scheduleFullRefresh(this.anchorGraphLinkEnhancer.getStructureRefreshDelay());
      })
    );
  }
  /* ------------------------------ */
  /* 只读代理 */
  /* ------------------------------ */
  // 返回指定路径的标记记录，未命中时返回空值。
  getMarkRecord(filePath) {
    return this.fileMarkerStore.getSettings().marks[filePath] || null;
  }
  // 返回当前全部分组信息。
  getGroups() {
    return this.fileMarkerStore.getGroups();
  }
  // 根据状态值获取显示名称。
  getStatusLabel(statusValue) {
    return this.fileMarkerStore.getStatusLabel(statusValue);
  }
  // 根据文件类型返回图标名称。
  getFileIcon(file) {
    return this.fileMarkerStore.getFileIcon(file);
  }
  // 返回格式化后的更新时间文本。
  formatTime(timestamp) {
    return this.fileMarkerStore.formatTime(timestamp);
  }
  // 返回按分组整理后的文件标记数据。
  getGroupedMarkedFiles() {
    return this.fileMarkerStore.getGroupedMarkedFiles();
  }
  // 返回关系图谱增强当前是否被用户启用。
  isAnchorGraphEnabled() {
    return this.pluginSettingsStore.isAnchorGraphEnabled();
  }
  // 返回文件资源管理器增强模块是否已启用。
  isFileExplorerEnhancerEnabled() {
    return this.pluginSettingsStore.isFileExplorerEnhancerEnabled();
  }
  // 返回右键菜单自定义模块当前是否被用户启用。
  isMenuCustomizerEnabled() {
    return this.pluginSettingsStore.isMenuCustomizerEnabled();
  }
  // 返回复制路径模块当前是否被用户启用。
  isCopyPathEnabled() {
    return this.pluginSettingsStore.isCopyPathEnabled();
  }
  // 返回状态栏增强模块当前是否被用户启用。
  isStatusBarEnhancerEnabled() {
    return this.pluginSettingsStore.isStatusBarEnhancerEnabled();
  }
  // 返回标签栏增强模块当前是否被用户启用。
  isTabBarEnhancerEnabled() {
    return this.pluginSettingsStore.isTabBarEnhancerEnabled();
  }
  // 返回当前文件标记数量，供设置页与后续状态摘要复用。
  getMarkCount() {
    return Object.keys(this.fileMarkerStore.getSettings().marks).length;
  }
  // 返回文件标记模块当前是否被用户启用。
  isFileMarkerEnabled() {
    return this.pluginSettingsStore.isFileMarkerEnabled();
  }
  // 返回文件标记面板当前是否已在工作区打开。
  isFileMarkerViewOpen() {
    return this.app.workspace.getLeavesOfType(fileMarker.FILE_MARKER_VIEW_TYPE).length > 0;
  }
  // 返回设置页所需的数据摘要，统一管理展示字段。
  getSettingsSummary() {
    const anchorGraphStats = this.anchorGraphLinkEnhancer.getStats();
    const anchorGraphRuntime = this.anchorGraphLinkEnhancer.getRuntimeStatus();
    return {
      markCount: this.getMarkCount(),
      groupCount: this.getGroups().length,
      fileMarkerEnabled: this.isFileMarkerEnabled(),
      fileMarkerViewOpen: this.isFileMarkerViewOpen(),
      anchorGraphSourceFileCount: anchorGraphStats.sourceFileCount,
      anchorGraphEdgeCount: anchorGraphStats.edgeCount,
      anchorGraphEnabled: this.isAnchorGraphEnabled(),
      anchorGraphRuntimeState: anchorGraphRuntime.state,
      anchorGraphRuntimeMessage: anchorGraphRuntime.message,
      menuCustomizerEnabled: this.isMenuCustomizerEnabled(),
      menuCustomizerMenuCount: this.menuCustomizerStore.getEnabledMenuCount(),
      menuCustomizerGroupCount: this.menuCustomizerStore.getGroupCount(),
      copyPathEnabled: this.isCopyPathEnabled(),
      copyPathTrailingSlashEnabled: this.copyPathStore.getSettings().addTrailingSlashToFolders === true,
      statusBarEnhancerEnabled: this.isStatusBarEnhancerEnabled(),
      statusBarEnhancerShowFileName: this.statusBarEnhancerStore.getSettings().showFileName === true,
      statusBarEnhancerShowIcons: this.statusBarEnhancerStore.getSettings().showIcons === true,
      statusBarEnhancerCopyAbsolutePath: this.statusBarEnhancerStore.getSettings().copyAbsolutePath !== false,
      statusBarEnhancerLastModifiedEnabled: this.statusBarEnhancerStore.getSettings().lastModifiedEnabled !== false,
      statusBarEnhancerLastModifiedPrepend: this.statusBarEnhancerStore.getSettings().lastModifiedPrepend,
      statusBarEnhancerLastModifiedTimestampFormat: this.statusBarEnhancerStore.getSettings().lastModifiedTimestampFormat,
      statusBarEnhancerCreatedEnabled: this.statusBarEnhancerStore.getSettings().createdEnabled === true,
      statusBarEnhancerCreatedPrepend: this.statusBarEnhancerStore.getSettings().createdPrepend,
      statusBarEnhancerCreatedTimestampFormat: this.statusBarEnhancerStore.getSettings().createdTimestampFormat,
      statusBarEnhancerCycleOnClick: this.statusBarEnhancerStore.getSettings().cycleOnClickEnabled !== false,
      statusBarEnhancerOrganizerElementCount: Object.keys(this.statusBarEnhancerStore.getOrganizerElements()).length,
      tabBarEnhancerEnabled: this.isTabBarEnhancerEnabled(),
      tabBarEnhancerTopBarWheel: this.tabBarEnhancerStore.getSettings().topBarWheelTabSwitch === true,
      tabBarEnhancerSkipCssHiddenTabs: this.tabBarEnhancerStore.getSettings().skipCssHiddenTabs !== false,
      tabBarEnhancerSkipUnloadedPluginTabs: this.tabBarEnhancerStore.getSettings().skipUnloadedPluginTabs !== false,
      tabBarEnhancerDebug: this.tabBarEnhancerStore.getSettings().debug === true,
      fileExplorerEnhancerEnabled: this.isFileExplorerEnhancerEnabled(),
      fileExplorerEnhancerPinFilterCount: (this.fileExplorerEnhancerStore.getSettings().pinFilters.paths || []).length,
      fileExplorerEnhancerHideFilterCount: (this.fileExplorerEnhancerStore.getSettings().hideFilters.paths || []).length
    };
  }
  // 返回设置页所需的配置文件状态摘要，便于展示导入导出与重置入口。
  async getConfigManagementSummary() {
    return this.dataStore.getConfigFileStatuses();
  }
  /* ------------------------------ */
  /* 写操作代理 */
  /* ------------------------------ */
  // 打开文件标记编辑弹窗。
  openMarkEditor(file) {
    new fileMarker.FileMarkerModal(this.app, this, file).open();
  }
  // 保存单个文件的标记记录，并刷新视图。
  async saveMarkRecord(file, payload) {
    await this.fileMarkerStore.saveMark(file, payload);
    this.refreshAllFileMarkerViews();
  }
  // 删除单个文件的标记记录，并刷新视图。
  async removeMarkRecord(filePath) {
    const hasChanged = await this.fileMarkerStore.removeMark(filePath);
    if (hasChanged) {
      this.refreshAllFileMarkerViews();
    }
    return hasChanged;
  }
  // 新增分组，并在保存后刷新视图。
  async createMarkGroup(groupName) {
    const result = await this.fileMarkerStore.addGroup(groupName);
    this.refreshAllFileMarkerViews();
    return result;
  }
  // 切换指定分组的展开或折叠状态。
  async updateGroupCollapsedState(groupId, collapsed) {
    const hasChanged = await this.fileMarkerStore.setGroupCollapsed(groupId, collapsed);
    if (hasChanged) {
      this.refreshAllFileMarkerViews();
    }
    return hasChanged;
  }
  // 一键展开或折叠全部分组。
  async updateAllGroupsCollapsedState(collapsed) {
    await this.fileMarkerStore.setAllGroupsCollapsed(collapsed);
    this.refreshAllFileMarkerViews();
  }
  // 打开指定路径对应的文件，不存在时提示用户。
  async openMarkedFileByPath(filePath) {
    const result = await this.fileMarkerStore.openMarkedFile(filePath);
    if (!result.success && result.message) {
      new obsidian.Notice(result.message);
    }
    return result;
  }
  // 清理已经不存在的文件标记，并在有变更时刷新文件标记视图。
  async pruneMissingMarkRecords() {
    const hasChanged = await this.fileMarkerStore.pruneMissingMarks();
    if (hasChanged) {
      this.refreshAllFileMarkerViews();
    }
    return hasChanged;
  }
  // 更新文件标记模块开关，并根据当前设置立即同步启停状态。
  async updateFileMarkerEnabled(enabled) {
    const nextEnabled = await this.pluginSettingsStore.setFileMarkerEnabled(enabled);
    this.syncFileMarkerFeatureState();
    return nextEnabled;
  }
  // 一键启动文件标记模块，确保右侧面板已创建并处于可见状态。
  async startFileMarkerFeature() {
    if (!this.isFileMarkerEnabled()) {
      new obsidian.Notice("文件标记面板当前已关闭，请先在设置页中启用。");
      return;
    }
    await this.ensureFileMarkerViewOpen();
  }
  // 更新关系图谱增强开关，并根据当前设置立即同步启停状态。
  async updateAnchorGraphEnabled(enabled) {
    const nextEnabled = await this.pluginSettingsStore.setAnchorGraphEnabled(enabled);
    this.syncAnchorGraphEnhancerState();
    return nextEnabled;
  }
  // 更新右键菜单自定义开关，并根据当前设置立即同步运行时状态。
  async updateMenuCustomizerEnabled(enabled) {
    const nextEnabled = await this.pluginSettingsStore.setMenuCustomizerEnabled(enabled);
    this.syncMenuCustomizerState();
    return nextEnabled;
  }
  // 更新复制路径模块开关。
  async updateCopyPathEnabled(enabled) {
    return this.pluginSettingsStore.setCopyPathEnabled(enabled);
  }
  // 更新复制路径模块的文件夹末尾斜杠配置。
  async updateCopyPathTrailingSlashEnabled(enabled) {
    return this.copyPathStore.setAddTrailingSlashToFolders(enabled);
  }
  // 更新状态栏增强模块开关，并立即同步状态栏显示状态。
  async updateStatusBarEnhancerEnabled(enabled) {
    const nextEnabled = await this.pluginSettingsStore.setStatusBarEnhancerEnabled(enabled);
    this.syncStatusBarEnhancerState();
    return nextEnabled;
  }
  // 更新状态栏增强的“显示文件名”配置，并立即刷新状态栏。
  async updateStatusBarEnhancerShowFileName(enabled) {
    const nextValue = await this.statusBarEnhancerStore.setShowFileName(enabled);
    this.syncStatusBarEnhancerState();
    return nextValue;
  }
  // 更新状态栏增强的“显示图标”配置，并立即刷新状态栏。
  async updateStatusBarEnhancerShowIcons(enabled) {
    const nextValue = await this.statusBarEnhancerStore.setShowIcons(enabled);
    this.syncStatusBarEnhancerState();
    return nextValue;
  }
  // 更新状态栏增强的“复制绝对路径”配置。
  async updateStatusBarEnhancerCopyAbsolutePath(enabled) {
    return this.statusBarEnhancerStore.setCopyAbsolutePath(enabled);
  }
  // 更新状态栏增强的“显示最后修改时间”配置，并立即刷新状态栏。
  async updateStatusBarEnhancerLastModifiedEnabled(enabled) {
    const nextValue = await this.statusBarEnhancerStore.setLastModifiedEnabled(enabled);
    this.syncStatusBarEnhancerState();
    return nextValue;
  }
  // 更新状态栏增强的最后修改时间前缀，并立即刷新状态栏。
  async updateStatusBarEnhancerLastModifiedPrepend(text) {
    const nextValue = await this.statusBarEnhancerStore.setLastModifiedPrepend(text);
    this.syncStatusBarEnhancerState();
    return nextValue;
  }
  // 更新状态栏增强的最后修改时间格式，并立即刷新状态栏。
  async updateStatusBarEnhancerLastModifiedTimestampFormat(format) {
    const nextValue = await this.statusBarEnhancerStore.setLastModifiedTimestampFormat(format);
    this.syncStatusBarEnhancerState();
    return nextValue;
  }
  // 更新状态栏增强的“显示创建时间”配置，并立即刷新状态栏。
  async updateStatusBarEnhancerCreatedEnabled(enabled) {
    const nextValue = await this.statusBarEnhancerStore.setCreatedEnabled(enabled);
    this.syncStatusBarEnhancerState();
    return nextValue;
  }
  // 更新状态栏增强的创建时间前缀，并立即刷新状态栏。
  async updateStatusBarEnhancerCreatedPrepend(text) {
    const nextValue = await this.statusBarEnhancerStore.setCreatedPrepend(text);
    this.syncStatusBarEnhancerState();
    return nextValue;
  }
  // 更新状态栏增强的创建时间格式，并立即刷新状态栏。
  async updateStatusBarEnhancerCreatedTimestampFormat(format) {
    const nextValue = await this.statusBarEnhancerStore.setCreatedTimestampFormat(format);
    this.syncStatusBarEnhancerState();
    return nextValue;
  }
  // 更新状态栏增强的“点击循环显示”配置，并立即同步运行时设置。
  async updateStatusBarEnhancerCycleOnClickEnabled(enabled) {
    const nextValue = await this.statusBarEnhancerStore.setCycleOnClickEnabled(enabled);
    this.syncStatusBarEnhancerState();
    return nextValue;
  }
  /* ------------------------------ */
  /* 状态栏元素管理代理 */
  /* ------------------------------ */
  // 初始化状态栏元素管理 Spooler，查找 .status-bar 容器并创建监听器。
  initializeOrganizerSpooler() {
    var statusBar = document.getElementsByClassName("status-bar")[0];
    if (!statusBar) {
      console.warn("[ねね] 未找到状态栏容器，状态栏元素管理不可用");
      return;
    }
    var self = this;
    this.organizerSpooler = new statusBarEnhancerModule.OrganizerSpooler(
      statusBar,
      function() {
        return self.statusBarEnhancerStore.getOrganizerElements();
      },
      function() {
      },
      function(allElements) {
        self.statusBarEnhancerStore.setOrganizerElements(allElements);
      }
    );
  }
  // 返回 .status-bar 容器 DOM 元素。
  getStatusBarElement() {
    return document.getElementsByClassName("status-bar")[0] || null;
  }
  // 返回当前 organizer 元素状态映射表。
  getOrganizerSettings() {
    return this.statusBarEnhancerStore.getOrganizerElements();
  }
  // 保存 organizer 元素状态映射表。
  async setOrganizerElementStatus(elements) {
    return this.statusBarEnhancerStore.setOrganizerElements(elements);
  }
  // 返回 organizer Spooler 实例。
  getOrganizerSpooler() {
    return this.organizerSpooler;
  }
  // 返回已删除的孤儿条目 ID 列表。
  getOrganizerDeletedIds() {
    return this.statusBarEnhancerStore.getDeletedIds();
  }
  // 保存已删除的孤儿条目 ID 列表。
  async setOrganizerDeletedIds(ids) {
    return this.statusBarEnhancerStore.setDeletedIds(ids);
  }
  // 更新标签栏增强模块开关，并立即同步实验性 class 的挂载状态。
  async updateTabBarEnhancerEnabled(enabled) {
    const nextEnabled = await this.pluginSettingsStore.setTabBarEnhancerEnabled(enabled);
    this.syncTabBarEnhancerState();
    return nextEnabled;
  }
  // 更新标签栏增强的“空白标签区滚轮切换”配置，并立即同步实验性 class。
  async updateTabBarEnhancerTopBarWheel(enabled) {
    const nextValue = await this.tabBarEnhancerStore.setTopBarWheelTabSwitch(enabled);
    this.syncTabBarEnhancerState();
    return nextValue;
  }
  // 更新标签栏增强的“跳过 CSS 隐藏的标签”配置，并立即重载运行时设置。
  async updateTabBarEnhancerSkipCssHiddenTabs(enabled) {
    const nextValue = await this.tabBarEnhancerStore.setSkipCssHiddenTabs(enabled);
    this.syncTabBarEnhancerState();
    return nextValue;
  }
  // 更新标签栏增强的“跳过未加载插件的标签”配置，并立即重载运行时设置。
  async updateTabBarEnhancerSkipUnloadedPluginTabs(enabled) {
    const nextValue = await this.tabBarEnhancerStore.setSkipUnloadedPluginTabs(enabled);
    this.syncTabBarEnhancerState();
    return nextValue;
  }
  // 更新标签栏增强的“调试模式”配置，并立即重载运行时设置。
  async updateTabBarEnhancerDebug(enabled) {
    const nextValue = await this.tabBarEnhancerStore.setDebug(enabled);
    this.syncTabBarEnhancerState();
    return nextValue;
  }
  // 更新文件资源管理器增强模块开关，并立即同步启停状态。
  async updateFileExplorerEnhancerEnabled(enabled) {
    const nextEnabled = await this.pluginSettingsStore.setFileExplorerEnhancerEnabled(enabled);
    this.syncFileExplorerEnhancerState();
    return nextEnabled;
  }
  // 手动刷新关系图谱 HTML 链接识别结果，供图谱刷新按钮与命令面板调用。
  async refreshAnchorGraphLinks(showNotice) {
    if (!this.isAnchorGraphEnabled()) {
      if (showNotice) {
        new obsidian.Notice("关系图谱 HTML 链接增强当前已关闭，请先在设置页中启用。");
      }
      return;
    }
    await this.anchorGraphLinkEnhancer.refreshAll(Boolean(showNotice));
  }
  // 一键启动关系图谱 HTML 链接增强，必要时先启用开关后再执行一次刷新。
  async startAnchorGraphFeature() {
    await this.refreshAnchorGraphLinks(true);
  }
  // 导出当前全部配置为 JSON 字符串，供设置页复制或备份。
  exportConfigurationBundle() {
    return JSON.stringify(this.dataStore.exportConfigurationBundle(), null, 2);
  }
  // 导出当前全部配置到独立备份文件，并返回写入结果。
  async exportConfigurationBundleToFile() {
    return this.dataStore.exportConfigurationBundleToFile();
  }
  // 导入用户提供的配置 JSON，并在完成后同步运行时状态与已打开视图。
  async importConfigurationBundle(rawText) {
    const parsedBundle = JSON.parse(rawText);
    await this.dataStore.importConfigurationBundle(parsedBundle);
    await this.reloadRuntimeStateFromDataStore();
  }
  // 将指定功能配置重置为默认值，并同步当前运行时状态。
  async resetFeatureConfiguration(featureKey) {
    await this.dataStore.resetFeatureData(featureKey);
    await this.reloadRuntimeStateFromDataStore();
  }
  // 将整个插件配置重置为默认值，并同步当前运行时状态。
  async resetAllConfiguration() {
    await this.dataStore.resetAllData();
    await this.reloadRuntimeStateFromDataStore();
  }
  /* ------------------------------ */
  /* 视图控制 */
  /* ------------------------------ */
  // 激活文件标记面板，若面板尚未创建则自动在右侧侧边栏打开。
  async ensureFileMarkerViewOpen() {
    if (!this.isFileMarkerEnabled()) {
      new obsidian.Notice("文件标记面板当前已关闭，请先在设置页中启用。");
      return;
    }
    let leaf = this.app.workspace.getLeavesOfType(fileMarker.FILE_MARKER_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false);
      await leaf.setViewState({
        type: fileMarker.FILE_MARKER_VIEW_TYPE,
        active: true
      });
    }
    await this.app.workspace.revealLeaf(leaf);
    if (leaf.view instanceof fileMarker.FileMarkerView) {
      leaf.view.render();
    }
  }
  // 刷新所有已打开的文件标记视图，保证界面能实时反映最新数据。
  refreshAllFileMarkerViews() {
    this.app.workspace.getLeavesOfType(fileMarker.FILE_MARKER_VIEW_TYPE).forEach((leaf) => {
      if (leaf.view instanceof fileMarker.FileMarkerView) {
        leaf.view.render();
      }
    });
  }
  // 根据当前设置同步文件标记模块的启停状态，关闭时回收已打开面板。
  syncFileMarkerFeatureState() {
    if (this.isFileMarkerEnabled()) {
      return;
    }
    this.app.workspace.getLeavesOfType(fileMarker.FILE_MARKER_VIEW_TYPE).forEach((leaf) => {
      leaf.detach();
    });
  }
  // 根据当前设置同步关系图谱增强模块的启停状态，供启动和设置切换共用。
  // 始终先执行 stop() 清理可能残留的旧会话合成链接数据（如上次崩溃退出未正常卸载），再按需启动。
  syncAnchorGraphEnhancerState() {
    this.anchorGraphLinkEnhancer.stop();
    if (this.isAnchorGraphEnabled()) {
      this.anchorGraphLinkEnhancer.start();
    }
  }
  // 根据当前设置同步状态栏增强模块的启停状态，并在启用时刷新当前活动文件路径。
  syncStatusBarEnhancerState() {
    this.statusBarEnhancerRuntime.load(this.statusBarEnhancerStore.getSettings());
    this.snippetsRuntime.load(this.snippetsStore.getSettings());
    if (this.isStatusBarEnhancerEnabled()) {
      this.statusBarEnhancerRuntime.start();
      this.snippetsRuntime.start();
      if (this.organizerSpooler) {
        this.organizerSpooler.start();
      }
    } else {
      this.statusBarEnhancerRuntime.stop();
      this.snippetsRuntime.stop();
      if (this.organizerSpooler) {
        this.organizerSpooler.stop();
      }
    }
  }
  // 根据当前设置同步标签栏增强模块的启停状态，并挂载或移除实验性 class。
  syncTabBarEnhancerState() {
    this.tabBarEnhancerRuntime.load(this.tabBarEnhancerStore.getSettings());
    if (this.isTabBarEnhancerEnabled()) {
      this.tabBarEnhancerRuntime.start();
      return;
    }
    this.tabBarEnhancerRuntime.stop();
  }
  // 装配文件资源管理器增强：缓存右键目标、注册命令、监听布局变化挂载 monkey-patch。
  setupFileExplorerEnhancer() {
    var self = this;
    self.registerEvent(
      self.app.workspace.on("file-menu", function(menu, file) {
        self.fileExplorerEnhancerStore._lastMenuTarget = file;
      })
    );
    fileExplorerEnhancerModule.addCommands(self);
    self.registerEvent(
      self.app.workspace.on("layout-change", function() {
        if (self.isFileExplorerEnhancerEnabled() && !self._fileExplorerView) {
          self.attachFileExplorerPatch();
        }
      })
    );
  }
  // 挂载文件资源管理器增强的 monkey-patch，在视图就绪时调用。
  attachFileExplorerPatch() {
    var self = this;
    var fileExplorerLeaves = self.app.workspace.getLeavesOfType("file-explorer");
    if (fileExplorerLeaves.length > 0 && !self._fileExplorerView) {
      var view = fileExplorerLeaves[0].view;
      self._fileExplorerView = view;
      self.fileExplorerEnhancerStore.load(self.dataStore.getFileExplorerEnhancerData());
      fileExplorerEnhancerModule.patchFileExplorerFolder(self, view);
      fileExplorerEnhancerModule.addOnRename(self);
      fileExplorerEnhancerModule.addOnDelete(self);
      fileExplorerEnhancerModule.setupFileExplorerFocusTracking(self);
      fileExplorerEnhancerModule.injectEyeButtons(self, view);
      view.requestSort();
    }
  }
  // 卸载文件资源管理器增强的 monkey-patch，恢复原始排序。
  fileExplorerEnhancerUnload(skipCommands) {
    if (!this._fileExplorerView) return;
    fileExplorerEnhancerModule.unloadFileExplorerEnhancer(this, this._fileExplorerView);
    fileExplorerEnhancerModule.removeEyeButtons();
    this._fileExplorerView.requestSort();
    this._fileExplorerView = null;
    this._lastFocusedFile = null;
    this._eyeToggleHistory = [];
    this._eyeRevealedPaths = null;
    this._eyeFocusTrackingBound = false;
    this._eyeLeafChangeBound = false;
    this._eyeToggleBtn = null;
    this._eyeRestoreBtn = null;
  }
  // 根据当前设置同步文件资源管理器增强模块的启停状态。
  syncFileExplorerEnhancerState() {
    if (this.isFileExplorerEnhancerEnabled()) {
      this.attachFileExplorerPatch();
      return;
    }
    this.fileExplorerEnhancerUnload(true);
  }
  // 根据当前设置同步右键菜单模块的启停状态，并在启用时刷新运行时配置。
  syncMenuCustomizerState() {
    this.menuCustomizerRuntime.load(this.menuCustomizerStore.getSettings());
    if (this.isMenuCustomizerEnabled()) {
      this.menuCustomizerRuntime.start();
      return;
    }
    this.menuCustomizerRuntime.stop();
  }
  // 在导入或重置配置后重载各仓库状态，确保设置页、面板与图谱行为立即同步。
  async reloadRuntimeStateFromDataStore() {
    this.pluginSettingsStore.load(this.dataStore.getFeatures());
    this.fileMarkerStore.load(this.dataStore.getFileMarkerData());
    this.menuCustomizerStore.load(this.dataStore.getMenuCustomizerData());
    this.copyPathStore.load(this.dataStore.getCopyPathData());
    this.statusBarEnhancerStore.load(this.dataStore.getStatusBarEnhancerData());
    this.tabBarEnhancerStore.load(this.dataStore.getTabBarEnhancerData());
    this.fileExplorerEnhancerStore.load(this.dataStore.getFileExplorerEnhancerData());
    this.snippetsStore.load();
    this.syncFileMarkerFeatureState();
    this.refreshAllFileMarkerViews();
    this.syncAnchorGraphEnhancerState();
    this.syncStatusBarEnhancerState();
    this.syncTabBarEnhancerState();
    this.syncMenuCustomizerState();
    if (this.isAnchorGraphEnabled()) {
      await this.refreshAnchorGraphLinks(false);
    }
  }
};
module.exports = ObsidianNenePlugin;
