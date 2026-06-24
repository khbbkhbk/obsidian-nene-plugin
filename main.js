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
        this.plugin.dataStore.setFileMarkerData(this.settings);
        await this.plugin.dataStore.save();
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

// src/modules/plugin-data/constants.js
var require_constants2 = __commonJS({
  "src/modules/plugin-data/constants.js"(exports2, module2) {
    "use strict";
    var DEFAULT_PLUGIN_DATA = {
      features: {
        fileMarker: {
          enabled: false
        },
        anchorGraph: {
          enabled: false
        }
      },
      fileMarker: {
        marks: {},
        groups: [
          {
            id: "ungrouped",
            name: "未分组",
            collapsed: false
          }
        ]
      }
    };
    module2.exports = {
      DEFAULT_PLUGIN_DATA
    };
  }
});

// src/modules/plugin-data/store.js
var require_store2 = __commonJS({
  "src/modules/plugin-data/store.js"(exports2, module2) {
    "use strict";
    var constants = require_constants2();
    var PluginDataStore = class {
      constructor(plugin) {
        this.plugin = plugin;
        this.data = this.normalizeData();
      }
      // 加载本地持久化数据，并按当前模块切片结构归一化。
      async load() {
        const rawData = await this.plugin.loadData();
        this.data = this.normalizeData(rawData);
      }
      // 保存当前整份插件数据到本地。
      async save() {
        this.data = this.normalizeData(this.data);
        await this.plugin.saveData(this.data);
      }
      // 返回整份插件数据对象，供主入口按需透传。
      getData() {
        return this.data;
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
        return this.data.fileMarker;
      }
      // 更新文件标记数据切片。
      setFileMarkerData(fileMarkerData) {
        this.data.fileMarker = this.normalizeFileMarkerData(fileMarkerData);
      }
      // 归一化整份插件数据，只接受当前模块切片结构。
      normalizeData(data) {
        const source = data && typeof data === "object" ? data : {};
        return {
          features: this.normalizeFeatures(source.features),
          fileMarker: this.normalizeFileMarkerData(source.fileMarker)
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
          }
        };
      }
      // 归一化文件标记切片的顶层结构，具体业务字段由 file-marker 模块进一步收敛。
      normalizeFileMarkerData(fileMarkerData) {
        const source = fileMarkerData && typeof fileMarkerData === "object" ? fileMarkerData : {};
        const defaultFileMarker = constants.DEFAULT_PLUGIN_DATA.fileMarker;
        return {
          marks: source.marks && typeof source.marks === "object" ? source.marks : defaultFileMarker.marks,
          groups: Array.isArray(source.groups) ? source.groups : defaultFileMarker.groups
        };
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
    var constants = require_constants2();
    var store = require_store2();
    module2.exports = Object.assign({}, constants, store);
  }
});

// src/modules/plugin-settings/constants.js
var require_constants3 = __commonJS({
  "src/modules/plugin-settings/constants.js"(exports2, module2) {
    "use strict";
    var DEFAULT_FEATURE_SETTINGS = {
      fileMarker: {
        enabled: false
      },
      anchorGraph: {
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
    var constants = require_constants3();
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
    var constants = require_constants3();
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

// src/modules/settings-tab/index.js
var require_settings_tab = __commonJS({
  "src/modules/settings-tab/index.js"(exports2, module2) {
    "use strict";
    var obsidian2 = require("obsidian");
    var ObsidianNenePluginSettingTab = class extends obsidian2.PluginSettingTab {
      constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
      }
      // 渲染设置页内容，展示当前功能说明、数据统计与维护操作。
      display() {
        const { containerEl } = this;
        const summary = this.plugin.getSettingsSummary();
        containerEl.empty();
        const anchorGraphStatusLabelMap = {
          active: "已启用",
          degraded: "已降级",
          disabled: "已关闭",
          idle: "待初始化"
        };
        containerEl.createEl("h2", { text: "ねね 设置" });
        containerEl.createEl("p", {
          text: "当前设置页按子功能模块分区展示，便于分别查看状态、执行维护操作与一键启动。"
        });
        this.renderFileMarkerSection(containerEl, summary);
        containerEl.createEl("hr");
        this.renderAnchorGraphSection(containerEl, summary, anchorGraphStatusLabelMap);
        containerEl.createEl("hr");
        this.renderRuleSection(containerEl);
      }
      // 渲染文件标记模块分区，集中展示开关、运行状态与维护操作。
      renderFileMarkerSection(containerEl, summary) {
        containerEl.createEl("h3", { text: "文件标记面板" });
        containerEl.createEl("p", {
          text: summary.fileMarkerEnabled ? summary.fileMarkerViewOpen ? `模块状态：已启用，面板已打开，当前共有 ${summary.markCount} 条文件标记、${summary.groupCount} 个分组。` : `模块状态：已启用，面板未打开，当前已保存 ${summary.markCount} 条文件标记、${summary.groupCount} 个分组。` : `模块状态：未启用，当前已保存 ${summary.markCount} 条文件标记、${summary.groupCount} 个分组。`
        });
        new obsidian2.Setting(containerEl).setName("模块开关").setDesc("首次安装默认关闭。启用后会写入配置，后续再次启用插件时将保持当前状态。").addToggle((toggle) => {
          toggle.setValue(summary.fileMarkerEnabled).onChange(async (value) => {
            await this.plugin.updateFileMarkerEnabled(value);
            new obsidian2.Notice(value ? "已启用文件标记面板" : "已关闭文件标记面板");
            this.display();
          });
        });
        new obsidian2.Setting(containerEl).setName("运行状态").setDesc(summary.fileMarkerEnabled ? summary.fileMarkerViewOpen ? "文件标记面板当前已打开。" : "文件标记面板当前未打开。" : "文件标记面板当前已关闭，请先启用模块。").addButton((button) => {
          button.setButtonText("打开面板").setDisabled(!summary.fileMarkerEnabled).onClick(async () => {
            await this.plugin.startFileMarkerFeature();
            this.display();
          });
        });
        new obsidian2.Setting(containerEl).setName("维护操作").setDesc("立即移除已不存在文件对应的标记记录，并同步刷新文件标记面板。").addButton((button) => {
          button.setButtonText("立即清理").setDisabled(!summary.fileMarkerEnabled).onClick(async () => {
            const hasChanged = await this.plugin.pruneMissingMarkRecords();
            new obsidian2.Notice(hasChanged ? "失效标记已清理" : "当前没有需要清理的失效标记");
            this.display();
          });
        });
      }
      // 渲染关系图谱模块分区，集中展示开关、运行状态与刷新操作。
      renderAnchorGraphSection(containerEl, summary, anchorGraphStatusLabelMap) {
        containerEl.createEl("h3", { text: "关系图谱 HTML 链接增强" });
        containerEl.createEl("p", {
          text: `模块状态：${anchorGraphStatusLabelMap[summary.anchorGraphRuntimeState] || "未知"}，已识别 ${summary.anchorGraphSourceFileCount} 个源文件中的 ${summary.anchorGraphEdgeCount} 条 a.internal-link 正向关系边。`
        });
        new obsidian2.Setting(containerEl).setName("模块开关").setDesc("首次安装默认关闭。启用后会写入配置，后续再次启用插件时将保持当前状态。").addToggle((toggle) => {
          toggle.setValue(summary.anchorGraphEnabled).onChange(async (value) => {
            await this.plugin.updateAnchorGraphEnabled(value);
            new obsidian2.Notice(value ? "已启用关系图谱 HTML 链接增强" : "已关闭关系图谱 HTML 链接增强");
            this.display();
          });
        });
        new obsidian2.Setting(containerEl).setName("运行状态").setDesc(summary.anchorGraphRuntimeMessage).addButton((button) => {
          button.setButtonText("立即刷新").setDisabled(!summary.anchorGraphEnabled).onClick(async () => {
            await this.plugin.refreshAnchorGraphLinks(true);
            this.display();
          });
        });
      }
      // 渲染识别规则说明，帮助用户理解图谱增强的生效范围。
      renderRuleSection(containerEl) {
        containerEl.createEl("h3", { text: "识别规则" });
        const ruleListEl = containerEl.createEl("ul");
        ruleListEl.createEl("li", {
          text: "文件标记面板和关系图谱 HTML 链接增强均默认关闭，需要先在设置页手动启用后才能执行相关操作。"
        });
        ruleListEl.createEl("li", {
          text: "关系图谱会额外识别 class 包含 internal-link，且带有 data-href 或 href 的 HTML a 标签。"
        });
        ruleListEl.createEl("li", {
          text: "图谱增强只向运行时索引注入合成关系边，不会改写任何笔记内容。"
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
var settingsTabModule = require_settings_tab();
var ObsidianNenePlugin = class extends obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.dataStore = new pluginData.PluginDataStore(this);
    this.pluginSettingsStore = new pluginSettings.PluginSettingsStore(this);
    this.fileMarkerStore = new fileMarker.FileMarkerStore(this);
    this.pluginListEnhancer = new pluginListEnhancerModule.PluginListEnhancer(this);
    this.anchorGraphLinkEnhancer = new anchorGraphLinksModule.AnchorGraphLinkEnhancer(this);
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
    await this.fileMarkerStore.pruneMissingMarks();
    this.setupFileMarkerView();
    this.setupFileMenu();
    this.setupVaultEvents();
    this.setupCommandEntries();
    this.setupLayoutEvents();
    this.setupAnchorGraphEvents();
    this.addSettingTab(new settingsTabModule.ObsidianNenePluginSettingTab(this.app, this));
    this.pluginListEnhancer.start();
    this.syncFileMarkerFeatureState();
    this.syncAnchorGraphEnhancerState();
  }
  // 插件卸载时清理动态资源和已打开视图。
  onunload() {
    console.log("Unloading obsidian-nene-plugin");
    this.pluginListEnhancer.stop();
    this.anchorGraphLinkEnhancer.stop();
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
      anchorGraphRuntimeMessage: anchorGraphRuntime.message
    };
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
};
module.exports = ObsidianNenePlugin;
