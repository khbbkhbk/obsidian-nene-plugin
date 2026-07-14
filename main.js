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

// src/modules/anchor-graph-links/constants.js
var require_constants2 = __commonJS({
  "src/modules/anchor-graph-links/constants.js"(exports2, module2) {
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

// src/modules/menu-customizer/constants.js
var require_constants3 = __commonJS({
  "src/modules/menu-customizer/constants.js"(exports2, module2) {
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
          layout: "list",
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
          layout: "list",
          hidden: false,
          forceSubmenu: true,
          commands: [
            "editor:insert-link",
            "editor:insert-embed",
            "editor:insert-table",
            "editor:insert-codeblock",
            "editor:insert-horizontal-rule"
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
    function cloneDefaultGroups(menuType) {
      return JSON.parse(JSON.stringify(DEFAULT_MENU_GROUPS[menuType] || []));
    }
    function buildDefaultMenuCustomizerSettings() {
      const menus = {};
      MENU_TYPE_OPTIONS.forEach((menuType) => {
        menus[menuType.id] = {
          enabled: false,
          groups: cloneDefaultGroups(menuType.id),
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
    module2.exports = {
      DEFAULT_MENU_CUSTOMIZER_SETTINGS,
      DEFAULT_MENU_GROUPS,
      GROUP_LAYOUT_OPTIONS,
      MENU_TYPE_OPTIONS,
      createDefaultMenuCustomizerSettings
    };
  }
});

// src/modules/plugin-data/constants.js
var require_constants4 = __commonJS({
  "src/modules/plugin-data/constants.js"(exports2, module2) {
    "use strict";
    var anchorGraphConstants = require_constants2();
    var fileMarkerConstants = require_constants();
    var menuCustomizerConstants = require_constants3();
    var FEATURE_CONFIG_DIRECTORY_NAME = "configs";
    var FEATURE_EXPORT_DIRECTORY_NAME = "exports";
    var FEATURE_CONFIG_FILE_NAMES = {
      fileMarker: "file-marker",
      anchorGraph: "anchor-graph",
      menuCustomizer: "menu-customizer"
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
        }
      }
    };
    var DEFAULT_FEATURE_DATA = {
      fileMarker: fileMarkerConstants.DEFAULT_FILE_MARKER_SETTINGS,
      anchorGraph: anchorGraphConstants.DEFAULT_ANCHOR_GRAPH_SETTINGS,
      menuCustomizer: menuCustomizerConstants.DEFAULT_MENU_CUSTOMIZER_SETTINGS
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
    var constants = require_constants4();
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
    var constants = require_constants4();
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
      // 将当前核心配置与全部模块配置一次性持久化，供导入和全量重置复用。
      async saveAll() {
        await this.save();
        await this.featureConfigManager.save("fileMarker", this.featureData.fileMarker);
        await this.featureConfigManager.save("anchorGraph", this.featureData.anchorGraph);
        await this.featureConfigManager.save("menuCustomizer", this.featureData.menuCustomizer);
      }
      // 返回当前插件管理的配置文件状态摘要，供设置页展示配置文件入口。
      async getConfigFileStatuses() {
        const adapter = this.plugin.app.vault.adapter;
        const coreConfigPath = this.getCoreConfigPath();
        const fileMarkerPath = this.featureConfigManager.getFeatureConfigPath("fileMarker");
        const anchorGraphPath = this.featureConfigManager.getFeatureConfigPath("anchorGraph");
        const menuCustomizerPath = this.featureConfigManager.getFeatureConfigPath("menuCustomizer");
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
          menuCustomizer: this.normalizeMenuCustomizerData(source.menuCustomizer)
        });
      }
      // 归一化核心配置，只保留 data.json 应继续存储的字段，并移除旧版功能切片。
      normalizeCoreData(data) {
        const source = this.isPlainObject(data) ? data : {};
        const normalizedCoreData = Object.assign({}, source);
        delete normalizedCoreData.fileMarker;
        delete normalizedCoreData.anchorGraph;
        delete normalizedCoreData.menuCustomizer;
        normalizedCoreData.features = this.normalizeFeatures(source.features);
        return normalizedCoreData;
      }
      // 归一化功能配置缓存，避免首次读取时报空。
      normalizeFeatureData(featureData) {
        const source = this.isPlainObject(featureData) ? featureData : {};
        return {
          fileMarker: this.normalizeFileMarkerData(source.fileMarker),
          anchorGraph: this.normalizeAnchorGraphData(source.anchorGraph),
          menuCustomizer: this.normalizeMenuCustomizerData(source.menuCustomizer)
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
            commandOverrides: this.isPlainObject(menuSource.commandOverrides) ? menuSource.commandOverrides : defaultMenuConfig.commandOverrides,
            commandMappings: Array.isArray(menuSource.commandMappings) ? menuSource.commandMappings : defaultMenuConfig.commandMappings
          };
        });
        return {
          menus: normalizedMenus
        };
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
        return this.isPlainObject(featureData) ? featureData : {};
      }
      // 判断旧版 data.json 中是否仍残留需要迁移的模块切片。
      hasLegacyFeatureSlices(data) {
        const source = this.isPlainObject(data) ? data : {};
        return this.isPlainObject(source.fileMarker) || this.isPlainObject(source.anchorGraph) || this.isPlainObject(source.menuCustomizer);
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
          menuCustomizer: bundle.featureData?.menuCustomizer || bundle.menuCustomizer
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
    var constants = require_constants4();
    var featureConfigManager = require_feature_config_manager();
    var store = require_store2();
    module2.exports = Object.assign({}, constants, featureConfigManager, store);
  }
});

// src/modules/plugin-settings/constants.js
var require_constants5 = __commonJS({
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
    var constants = require_constants5();
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
    var constants = require_constants5();
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

// src/modules/anchor-graph-links/index.js
var require_anchor_graph_links = __commonJS({
  "src/modules/anchor-graph-links/index.js"(exports2, module2) {
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

// src/modules/menu-customizer/runtime.js
var require_runtime = __commonJS({
  "src/modules/menu-customizer/runtime.js"(exports2, module2) {
    "use strict";
    var obsidian2 = require("obsidian");
    var constants = require_constants3();
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
        if (!menu) return;
        menu.__neneMenuContext = {
          source: "file-menu",
          fileKind: file instanceof obsidian2.TFolder ? "folder" : file instanceof obsidian2.TFile ? "file" : "abstract"
        };
      }
      // 为编辑区菜单打上上下文标记，便于区分右键菜单与更多选项菜单。
      annotateEditorMenu(menu) {
        if (!menu) return;
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
            return runtime.originalShowAtMouseEvent.call(this, event);
          };
        }
        if (typeof this.originalShowAtPosition === "function") {
          obsidian2.Menu.prototype.showAtPosition = function wrappedShowAtPosition(position) {
            runtime.onBeforeMenuShow(this);
            return runtime.originalShowAtPosition.call(this, position);
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
      // 根据上下文和标题特征识别当前菜单类型。
      detectMenuType(menu) {
        const context = menu.__neneMenuContext || {};
        if (context.fileKind === "folder") return "folder";
        if (context.fileKind === "file") return "file";
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
      // 按配置重排菜单内容，保留原始回调与插件命令节点。
      rebuildMenu(menu, menuType, menuConfig) {
        if (!menu.dom || !Array.isArray(menu.items)) {
          return;
        }
        const collectedEntries = this.collectMenuEntries(menu, menuType);
        const visibleRecognizedEntries = [];
        const unknownEntries = [];
        collectedEntries.forEach((entry) => {
          if (!entry.commandId) {
            unknownEntries.push(entry);
            return;
          }
          const override = menuConfig.commandOverrides?.[entry.commandId];
          this.applyItemOverride(entry.item, override);
          if (override?.hidden === true) {
            return;
          }
          visibleRecognizedEntries.push(entry);
        });
        const recognizedByCommandId = /* @__PURE__ */ new Map();
        visibleRecognizedEntries.forEach((entry) => {
          if (!recognizedByCommandId.has(entry.commandId)) {
            recognizedByCommandId.set(entry.commandId, entry);
          }
        });
        const renderedCommandIds = /* @__PURE__ */ new Set();
        const nextRootItems = [];
        const menuEl = menu.dom;
        menuEl.empty();
        menuConfig.groups.forEach((group) => {
          if (group.hidden) return;
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
            return;
          }
          this.appendSeparator(menuEl);
          if (this.shouldRenderAsSubmenu(group, groupEntries)) {
            const parentItem = this.createSubmenuParent(menu, group, groupEntries, menuType);
            if (parentItem) {
              nextRootItems.push(parentItem);
              groupEntries.forEach((entry) => renderedCommandIds.add(entry.commandId));
              return;
            }
          }
          groupEntries.forEach((entry) => {
            this.prepareRenderedItem(entry.item, entry.commandId, group.layout);
            menuEl.appendChild(entry.item.dom);
            nextRootItems.push(entry.item);
            renderedCommandIds.add(entry.commandId);
          });
        });
        visibleRecognizedEntries.sort((left, right) => left.order - right.order).forEach((entry) => {
          if (renderedCommandIds.has(entry.commandId)) {
            return;
          }
          this.appendSeparator(menuEl);
          this.prepareRenderedItem(entry.item, entry.commandId, "list");
          menuEl.appendChild(entry.item.dom);
          nextRootItems.push(entry.item);
          renderedCommandIds.add(entry.commandId);
        });
        unknownEntries.sort((left, right) => left.order - right.order).forEach((entry) => {
          this.appendSeparator(menuEl);
          this.prepareRenderedItem(entry.item, null, "list");
          menuEl.appendChild(entry.item.dom);
          nextRootItems.push(entry.item);
        });
        this.cleanupSeparators(menuEl);
        this.applyMenuClasses(menuEl, menuType);
        menu.items = nextRootItems;
      }
      // 收集菜单项并尽量解析出稳定命令标识，未知命令保留原始节点顺序。
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
      // 根据用户提供的手动映射，严格识别无显式 commandId 的菜单项。
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
            this.prepareRenderedItem(entry.item, entry.commandId, "list");
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
      prepareRenderedItem(item, commandId, layout) {
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
        }
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

// src/modules/menu-customizer/store.js
var require_store4 = __commonJS({
  "src/modules/menu-customizer/store.js"(exports2, module2) {
    "use strict";
    var constants = require_constants3();
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
        const registeredCommand = this.getRegisteredCommands().find((item) => item.id === normalizedCommandId) || null;
        if (!preferredMapping && !registeredCommand) {
          return null;
        }
        return {
          id: normalizedCommandId,
          label: preferredMapping?.title || registeredCommand?.label || normalizedCommandId,
          icon: registeredCommand?.icon || "",
          aliases: Array.from(new Set(mappings.map((mapping) => mapping.title).filter(Boolean))),
          sections: Array.from(new Set(mappings.map((mapping) => mapping.section).filter(Boolean))),
          source: preferredMapping ? registeredCommand ? "mapped-registered" : "mapped" : "registered",
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
      // 新增一个空分组，供用户后续配置名称、布局与命令。
      async addGroup(menuType) {
        this.ensureMenuConfig(menuType);
        this.settings.menus[menuType].groups.push(this.createGroup(menuType));
        await this.save();
      }
      // 删除指定索引的分组。
      async removeGroup(menuType, groupIndex) {
        this.ensureMenuConfig(menuType);
        this.settings.menus[menuType].groups.splice(groupIndex, 1);
        await this.save();
      }
      // 更新分组属性，统一经过归一化，保证结构稳定。
      async updateGroup(menuType, groupIndex, patch) {
        this.ensureMenuConfig(menuType);
        const currentGroup = this.settings.menus[menuType].groups[groupIndex];
        if (!currentGroup) return;
        this.settings.menus[menuType].groups[groupIndex] = this.normalizeGroup(
          menuType,
          Object.assign({}, currentGroup, patch)
        );
        await this.save();
      }
      // 调整分组顺序，便于控制菜单中的最终呈现顺序。
      async moveGroup(menuType, groupIndex, offset) {
        this.ensureMenuConfig(menuType);
        const groups = this.settings.menus[menuType].groups;
        const targetIndex = groupIndex + offset;
        if (targetIndex < 0 || targetIndex >= groups.length) return;
        const [group] = groups.splice(groupIndex, 1);
        groups.splice(targetIndex, 0, group);
        await this.save();
      }
      // 往指定分组中追加命令，自动去重，避免重复渲染。
      async addCommandToGroup(menuType, groupIndex, commandId) {
        this.ensureMenuConfig(menuType);
        const targetGroup = this.settings.menus[menuType].groups[groupIndex];
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
        if (!targetGroup) return;
        targetGroup.commands.splice(commandIndex, 1);
        await this.save();
      }
      // 调整分组内命令顺序。
      async moveCommandInGroup(menuType, groupIndex, commandIndex, offset) {
        this.ensureMenuConfig(menuType);
        const targetGroup = this.settings.menus[menuType].groups[groupIndex];
        if (!targetGroup) return;
        const targetIndex = commandIndex + offset;
        if (targetIndex < 0 || targetIndex >= targetGroup.commands.length) return;
        const [commandId] = targetGroup.commands.splice(commandIndex, 1);
        targetGroup.commands.splice(targetIndex, 0, commandId);
        await this.save();
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
      // 根据用户提供的 title + section + commandId 映射，严格识别无显式 commandId 的菜单项。
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
        return "";
      }
      // 更新某个命令的显示名称、图标或隐藏状态。
      async updateCommandOverride(menuType, commandId, patch) {
        this.ensureMenuConfig(menuType);
        const normalizedCommandId = typeof commandId === "string" ? commandId.trim() : "";
        if (!normalizedCommandId) return;
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
          commandOverrides: {},
          commandMappings: []
        };
        const source = this.isPlainObject(menuConfig) ? menuConfig : {};
        const commandOverrides = {};
        if (this.isPlainObject(source.commandOverrides)) {
          Object.entries(source.commandOverrides).forEach(([commandId, override]) => {
            const normalizedCommandId = typeof commandId === "string" ? commandId.trim() : "";
            if (!normalizedCommandId) return;
            commandOverrides[normalizedCommandId] = this.normalizeCommandOverride(override);
          });
        }
        return {
          enabled: source.enabled === true,
          groups: Array.isArray(source.groups) ? source.groups.map((group) => this.normalizeGroup(menuType, group)) : defaultMenuConfig.groups.map((group) => this.normalizeGroup(menuType, group)),
          commandOverrides,
          commandMappings: Array.isArray(source.commandMappings) ? source.commandMappings.map((mapping) => this.normalizeCommandMapping(mapping)) : defaultMenuConfig.commandMappings.map((mapping) => this.normalizeCommandMapping(mapping))
        };
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
          if (typeof commandId !== "string") return;
          const normalizedCommandId = commandId.trim();
          if (!normalizedCommandId || seen.has(normalizedCommandId)) return;
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

// src/modules/menu-customizer/view.js
var require_view2 = __commonJS({
  "src/modules/menu-customizer/view.js"(exports2, module2) {
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
          text: "新增命令完全来自 Obsidian 命令注册表；无显式 commandId 的原始菜单项，请在下方“手动映射”中补齐 title、section 与 commandId。"
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
        const sectionEl = containerEl.createDiv({ cls: "nene-menu-customizer-active-section" });
        const sectionHeaderEl = sectionEl.createDiv({ cls: "nene-menu-customizer-panel-card" });
        sectionHeaderEl.createDiv({
          cls: "nene-menu-customizer-section-title",
          text: getMenuTypeName(store, menuType)
        });
        this.renderControlRow(
          sectionHeaderEl,
          "启用当前菜单",
          `仅对 ${getMenuTypeName(store, menuType)} 生效，未开启时保留 Obsidian 原始行为。`,
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
        const groupsCardEl = sectionEl.createDiv({ cls: "nene-menu-customizer-panel-card" });
        const groupsHeaderEl = groupsCardEl.createDiv({ cls: "nene-menu-customizer-card-header" });
        groupsHeaderEl.createDiv({ cls: "nene-menu-customizer-subtitle", text: "分组管理" });
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
        if (menuConfig.groups.length === 0) {
          groupsCardEl.createDiv({
            cls: "nene-menu-customizer-empty",
            text: "当前还没有分组，未命中的命令会按原顺序保留在菜单底部。"
          });
        }
        menuConfig.groups.forEach((group, groupIndex) => {
          this.renderGroupEditor(groupsCardEl, menuType, group, groupIndex, menuConfig.groups.length);
        });
        this.renderMappingsPanel(sectionEl, menuType, menuConfig);
        this.renderOverridesPanel(sectionEl, menuType, menuConfig);
        this.renderResetPanel(sectionEl);
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
          text: "当某个原始右键菜单项没有暴露 commandId 时，在这里填写它的标题、section 和你约定的 commandId。运行时会按 title + section 做严格匹配。"
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
        renderSummaryItem(infoListEl, "可见分组", `${previewModel.groups.length} 个`);
        renderSummaryItem(infoListEl, "未分组命令", `${previewModel.ungroupedItems.length} 个`);
        const surfaceEl = this.previewPaneEl.createDiv({ cls: "nene-menu-customizer-preview-surface" });
        const menuEl = surfaceEl.createDiv({ cls: "nene-menu-customizer-preview-menu" });
        if (!menuConfig.enabled) {
          menuEl.createDiv({
            cls: "nene-menu-customizer-preview-empty",
            text: "当前分页未启用。启用后右键菜单才会按左侧配置重构。"
          });
          return;
        }
        if (previewModel.groups.length === 0 && previewModel.ungroupedItems.length === 0) {
          menuEl.createDiv({
            cls: "nene-menu-customizer-preview-empty",
            text: "当前没有可预览的命令。"
          });
          return;
        }
        previewModel.groups.forEach((group, groupIndex) => {
          if (groupIndex > 0) {
            menuEl.createDiv({ cls: "nene-menu-customizer-preview-separator" });
          }
          this.renderPreviewGroup(menuEl, group);
        });
        if (previewModel.ungroupedItems.length > 0) {
          if (previewModel.groups.length > 0) {
            menuEl.createDiv({ cls: "nene-menu-customizer-preview-separator" });
          }
          const sectionLabelEl = menuEl.createDiv({ cls: "nene-menu-customizer-preview-section-label" });
          sectionLabelEl.setText("未分组命令");
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
        availableCommands.forEach((command) => {
          const override = menuConfig.commandOverrides[command.id] || {};
          commandMap.set(command.id, {
            id: command.id,
            title: override.title || command.label || command.id,
            icon: override.icon || command.icon || "",
            hidden: override.hidden === true
          });
        });
        const groups = menuConfig.groups.filter((group) => group.hidden !== true).map((group) => {
          const items = group.commands.map((commandId) => commandMap.get(commandId) || {
            id: commandId,
            title: menuConfig.commandOverrides[commandId]?.title || commandId,
            icon: menuConfig.commandOverrides[commandId]?.icon || "",
            hidden: menuConfig.commandOverrides[commandId]?.hidden === true
          }).filter((item) => item.hidden !== true);
          items.forEach((item) => usedCommandIds.add(item.id));
          return {
            id: group.id,
            name: group.name,
            icon: group.icon || "",
            layout: group.layout,
            forceSubmenu: group.forceSubmenu === true,
            items
          };
        }).filter((group) => group.items.length > 0);
        const ungroupedItems = availableCommands.map((command) => commandMap.get(command.id)).filter((item) => item && item.hidden !== true && !usedCommandIds.has(item.id));
        return {
          groups,
          ungroupedItems
        };
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

// src/modules/menu-customizer/index.js
var require_menu_customizer = __commonJS({
  "src/modules/menu-customizer/index.js"(exports2, module2) {
    "use strict";
    var constants = require_constants3();
    var runtime = require_runtime();
    var store = require_store4();
    var view = require_view2();
    module2.exports = Object.assign({}, constants, runtime, store, view);
  }
});

// src/modules/settings-tab/index.js
var require_settings_tab = __commonJS({
  "src/modules/settings-tab/index.js"(exports2, module2) {
    "use strict";
    var obsidian2 = require("obsidian");
    var menuCustomizerModule2 = require_menu_customizer();
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
    var MenuCustomizerManagementModal = class extends menuCustomizerModule2.MenuCustomizerManagementModal {
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
        new obsidian2.Setting(contentEl).setName("重置全部配置").setDesc("同时重置 data.json 与所有模块配置文件。功能开关、文件标记、关系图谱和右键菜单设置都会恢复为首次安装状态。").addButton((button) => {
          button.setButtonText("重置全部").setWarning().onClick(() => {
            new ConfirmActionModal(
              this.app,
              "重置全部插件配置",
              "此操作会覆盖当前插件的全部配置文件，包括 data.json、file-marker.json、anchor-graph.json 和 menu-customizer.json。请仅在确认需要恢复初始状态时执行。",
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
var anchorGraphLinksModule = require_anchor_graph_links();
var menuCustomizerModule = require_menu_customizer();
var settingsTabModule = require_settings_tab();
var ObsidianNenePlugin = class extends obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.dataStore = new pluginData.PluginDataStore(this);
    this.pluginSettingsStore = new pluginSettings.PluginSettingsStore(this);
    this.fileMarkerStore = new fileMarker.FileMarkerStore(this);
    this.pluginListEnhancer = new pluginListEnhancerModule.PluginListEnhancer(this);
    this.anchorGraphLinkEnhancer = new anchorGraphLinksModule.AnchorGraphLinkEnhancer(this);
    this.menuCustomizerStore = new menuCustomizerModule.MenuCustomizerStore(this);
    this.menuCustomizerRuntime = new menuCustomizerModule.MenuCustomizerRuntime(this);
  }
  // 暴露只读设置访问入口，兼容后续模块对当前配置的读取。
  get settings() {
    return this.dataStore.getData();
  }
  // 插件加载时执行初始化逻辑。
  async onload() {
    console.log("Loading obsidian-nene-plugin");
    await this.dataStore.load();
    this.pluginSettingsStore.load(this.dataStore.getFeatures());
    this.fileMarkerStore.load(this.dataStore.getFileMarkerData());
    this.menuCustomizerStore.load(this.dataStore.getMenuCustomizerData());
    await this.fileMarkerStore.pruneMissingMarks();
    this.setupFileMarkerView();
    this.setupFileMenu();
    this.setupEditorMenu();
    this.setupVaultEvents();
    this.setupCommandEntries();
    this.setupLayoutEvents();
    this.setupAnchorGraphEvents();
    this.addSettingTab(new settingsTabModule.ObsidianNenePluginSettingTab(this.app, this));
    this.pluginListEnhancer.start();
    this.syncFileMarkerFeatureState();
    this.syncAnchorGraphEnhancerState();
    this.syncMenuCustomizerState();
  }
  // 插件卸载时清理动态资源和已打开视图。
  onunload() {
    console.log("Unloading obsidian-nene-plugin");
    this.pluginListEnhancer.stop();
    this.anchorGraphLinkEnhancer.stop();
    this.menuCustomizerRuntime.stop();
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
  // 返回右键菜单自定义模块当前是否被用户启用。
  isMenuCustomizerEnabled() {
    return this.pluginSettingsStore.isMenuCustomizerEnabled();
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
      menuCustomizerGroupCount: this.menuCustomizerStore.getGroupCount()
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
  syncAnchorGraphEnhancerState() {
    if (this.isAnchorGraphEnabled()) {
      this.anchorGraphLinkEnhancer.start();
      return;
    }
    this.anchorGraphLinkEnhancer.stop();
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
    this.syncFileMarkerFeatureState();
    this.refreshAllFileMarkerViews();
    this.syncAnchorGraphEnhancerState();
    this.syncMenuCustomizerState();
    if (this.isAnchorGraphEnabled()) {
      await this.refreshAnchorGraphLinks(false);
    }
  }
};
module.exports = ObsidianNenePlugin;
