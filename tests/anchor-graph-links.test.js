'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const Module = require('node:module');

function loadModuleWithObsidianStub(relativeModulePath, obsidianStub) {
  const targetModulePath = path.resolve(__dirname, '..', relativeModulePath);
  const originalLoad = Module._load;

  delete require.cache[targetModulePath];

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'obsidian') {
      return obsidianStub;
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require(targetModulePath);
  } finally {
    Module._load = originalLoad;
  }
}

function createObsidianStub(overrides) {
  class FakeTFile {
    constructor(filePath) {
      this.path = filePath;
      this.extension = 'md';
    }
  }

  return Object.assign({
    Notice: class Notice { },
    TFile: FakeTFile,
    normalizePath: (targetPath) => String(targetPath).replace(/\\/g, '/'),
    requireApiVersion: () => true
  }, overrides);
}

function createMemoryAdapter(initialFiles) {
  const fileMap = new Map(Object.entries(initialFiles || {}));
  const folderSet = new Set();

  return {
    fileMap,
    folderSet,
    async exists(targetPath) {
      return fileMap.has(targetPath) || folderSet.has(targetPath);
    },
    async mkdir(targetPath) {
      folderSet.add(targetPath);
    },
    async read(targetPath) {
      if (!fileMap.has(targetPath)) {
        throw new Error(`File not found: ${targetPath}`);
      }

      return fileMap.get(targetPath);
    },
    async write(targetPath, content) {
      fileMap.set(targetPath, content);
    }
  };
}

function createPluginDataStub(overrides) {
  const adapter = overrides?.adapter || createMemoryAdapter();

  return Object.assign({
    loadData: async () => null,
    saveData: async () => { },
    app: {
      vault: {
        configDir: '.obsidian',
        adapter
      }
    },
    manifest: {
      id: 'obsidian-nene-plugin',
      name: 'obsidian-nene-plugin'
    }
  }, overrides, {
    app: Object.assign({
      vault: {
        configDir: '.obsidian',
        adapter
      }
    }, overrides?.app),
    manifest: Object.assign({
      id: 'obsidian-nene-plugin',
      name: 'obsidian-nene-plugin'
    }, overrides?.manifest)
  });
}

test('插件级数据仓库会按当前模块切片结构补齐默认值', () => {
  const obsidianStub = createObsidianStub();
  const { PluginDataStore } = loadModuleWithObsidianStub('src/modules/plugin-data/store.js', obsidianStub);
  const pluginStub = createPluginDataStub();
  const store = new PluginDataStore(pluginStub);

  const defaultSettings = store.normalizeData({});
  const normalizedSettings = store.normalizeData({
    features: {
      fileMarker: {
        enabled: true
      },
      anchorGraph: {
        enabled: true
      }
    },
    fileMarker: {
      marks: {
        'a.md': {
          path: 'a.md',
          status: 'pending'
        }
      },
      groups: [
        {
          id: 'custom',
          name: '自定义',
          collapsed: true
        }
      ]
    },
    anchorGraph: {
      defaultSettings: {
        htmlEnhancementEnabled: false
      },
      noteOverrides: {
        '未命名.md': {
          mode: 'enabled'
        }
      }
    }
  });

  assert.equal(defaultSettings.features.fileMarker.enabled, false);
  assert.equal(defaultSettings.features.anchorGraph.enabled, false);
  assert.equal(defaultSettings.features.menuCustomizer.enabled, false);
  assert.equal(defaultSettings.fileMarker.groups[0].id, 'ungrouped');
  assert.equal(defaultSettings.anchorGraph.defaultSettings.htmlEnhancementEnabled, true);
  assert.equal(Array.isArray(defaultSettings.menuCustomizer.menus.editor.groups), true);
  assert.equal(normalizedSettings.features.fileMarker.enabled, true);
  assert.equal(normalizedSettings.features.anchorGraph.enabled, true);
  assert.equal(normalizedSettings.features.menuCustomizer.enabled, false);
  assert.equal(normalizedSettings.fileMarker.marks['a.md'].path, 'a.md');
  assert.equal(normalizedSettings.fileMarker.groups[0].id, 'custom');
  assert.equal(normalizedSettings.anchorGraph.defaultSettings.htmlEnhancementEnabled, false);
  assert.equal(normalizedSettings.anchorGraph.noteOverrides['未命名.md'].mode, 'enabled');
  assert.equal(normalizedSettings.menuCustomizer.menus.file.enabled, false);
});

test('插件级数据仓库会将旧版 data.json 中的模块数据迁移到独立配置文件', async () => {
  const obsidianStub = createObsidianStub();
  const { PluginDataStore } = loadModuleWithObsidianStub('src/modules/plugin-data/store.js', obsidianStub);
  const adapter = createMemoryAdapter();
  let savedCoreData = null;
  const pluginStub = createPluginDataStub({
    adapter,
    loadData: async () => ({
      features: {
        fileMarker: {
          enabled: false
        },
        anchorGraph: {
          enabled: true
        }
      },
      fileMarker: {
        marks: {},
        groups: [
          {
            id: 'ungrouped',
            name: '未分组',
            collapsed: true
          }
        ]
      },
      anchorGraph: {
        defaultSettings: {
          htmlEnhancementEnabled: true
        },
        noteOverrides: {
          '未命名.md': {
            mode: 'enabled'
          }
        }
      }
    }),
    saveData: async (data) => {
      savedCoreData = data;
    }
  });
  const store = new PluginDataStore(pluginStub);

  await store.load();

  assert.deepEqual(savedCoreData, {
    features: {
      fileMarker: {
        enabled: false
      },
      anchorGraph: {
        enabled: true
      },
      menuCustomizer: {
        enabled: false
      }
    }
  });

  const fileMarkerPath = store.featureConfigManager.getFeatureConfigPath('fileMarker');
  const anchorGraphPath = store.featureConfigManager.getFeatureConfigPath('anchorGraph');

  assert.equal(adapter.folderSet.has('.obsidian/plugins/obsidian-nene-plugin/configs'), true);
  assert.equal(adapter.fileMap.has(fileMarkerPath), true);
  assert.equal(adapter.fileMap.has(anchorGraphPath), true);
  assert.equal(JSON.parse(adapter.fileMap.get(fileMarkerPath)).groups[0].collapsed, true);
  assert.equal(JSON.parse(adapter.fileMap.get(anchorGraphPath)).noteOverrides['未命名.md'].mode, 'enabled');
  assert.equal(store.getAnchorGraphData().defaultSettings.htmlEnhancementEnabled, true);
});

test('插件级数据仓库支持导出、导入与重置独立配置文件', async () => {
  const obsidianStub = createObsidianStub();
  const { PluginDataStore } = loadModuleWithObsidianStub('src/modules/plugin-data/store.js', obsidianStub);
  const adapter = createMemoryAdapter();
  const savedCoreSnapshots = [];
  const pluginStub = createPluginDataStub({
    adapter,
    saveData: async (data) => {
      savedCoreSnapshots.push(JSON.parse(JSON.stringify(data)));
    }
  });
  const store = new PluginDataStore(pluginStub);

  await store.load();

  await store.importConfigurationBundle({
    coreData: {
      features: {
        fileMarker: {
          enabled: true
        },
        anchorGraph: {
          enabled: false
        },
        menuCustomizer: {
          enabled: true
        }
      }
    },
    featureData: {
      fileMarker: {
        marks: {
          'demo.md': {
            path: 'demo.md',
            status: 'pending',
            note: '需要跟进',
            groupId: 'ungrouped',
            updatedAt: 123
          }
        },
        groups: [
          {
            id: 'ungrouped',
            name: '未分组',
            collapsed: true
          }
        ]
      },
      anchorGraph: {
        defaultSettings: {
          htmlEnhancementEnabled: false
        },
        noteOverrides: {
          'demo.md': {
            mode: 'enabled'
          }
        }
      },
      menuCustomizer: {
        menus: {
          editor: {
            enabled: true,
            groups: [
              {
                id: 'editor-custom',
                name: '编辑快捷区',
                icon: 'scissors',
                layout: 'icon-bar',
                hidden: false,
                forceSubmenu: false,
                commands: ['editor:cut', 'editor:copy']
              }
            ],
            commandOverrides: {
              'editor:copy': {
                title: '复制文本',
                icon: 'copy',
                hidden: false
              }
            }
          }
        }
      }
    }
  });

  const exportedBundle = store.exportConfigurationBundle();
  const fileMarkerPath = store.featureConfigManager.getFeatureConfigPath('fileMarker');
  const anchorGraphPath = store.featureConfigManager.getFeatureConfigPath('anchorGraph');
  const exportFileResult = await store.exportConfigurationBundleToFile();

  assert.equal(exportedBundle.schemaVersion, 1);
  assert.equal(exportedBundle.coreData.features.fileMarker.enabled, true);
  assert.equal(exportedBundle.coreData.features.menuCustomizer.enabled, true);
  assert.equal(exportedBundle.featureData.fileMarker.marks['demo.md'].note, '需要跟进');
  assert.equal(exportedBundle.featureData.menuCustomizer.menus.editor.commandOverrides['editor:copy'].title, '复制文本');
  assert.equal(JSON.parse(adapter.fileMap.get(fileMarkerPath)).groups[0].collapsed, true);
  assert.equal(JSON.parse(adapter.fileMap.get(anchorGraphPath)).defaultSettings.htmlEnhancementEnabled, false);
  assert.equal(exportFileResult.fileName.endsWith('.json'), true);
  assert.equal(exportFileResult.filePath.includes('/exports/'), true);
  assert.equal(JSON.parse(adapter.fileMap.get(exportFileResult.filePath)).featureData.fileMarker.marks['demo.md'].path, 'demo.md');

  await store.resetFeatureData('fileMarker');
  assert.deepEqual(store.getFileMarkerData().marks, {});
  assert.equal(store.getFileMarkerData().groups[0].id, 'ungrouped');

  await store.resetAllData();
  assert.equal(store.getFeatures().fileMarker.enabled, false);
  assert.equal(store.getFeatures().anchorGraph.enabled, false);
  assert.equal(store.getFeatures().menuCustomizer.enabled, false);
  assert.equal(store.getAnchorGraphData().defaultSettings.htmlEnhancementEnabled, true);
  assert.deepEqual(savedCoreSnapshots.at(-1), {
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
  });
});

test('插件级功能设置仓库会持久化文件标记、关系图谱与右键菜单启用状态', async () => {
  const obsidianStub = createObsidianStub();
  const { PluginSettingsStore } = loadModuleWithObsidianStub('src/modules/plugin-settings/store.js', obsidianStub);
  const savedSnapshots = [];
  const pluginStub = {
    dataStore: {
      setFeatures(features) {
        savedSnapshots.push(JSON.parse(JSON.stringify(features)));
      },
      save: async () => { }
    }
  };
  const settingsStore = new PluginSettingsStore(pluginStub);

  settingsStore.load({});
  assert.equal(settingsStore.isFileMarkerEnabled(), false);
  assert.equal(settingsStore.isAnchorGraphEnabled(), false);
  assert.equal(settingsStore.isMenuCustomizerEnabled(), false);

  await settingsStore.setFileMarkerEnabled(true);
  await settingsStore.setAnchorGraphEnabled(true);
  await settingsStore.setMenuCustomizerEnabled(true);

  assert.equal(settingsStore.isFileMarkerEnabled(), true);
  assert.equal(settingsStore.isAnchorGraphEnabled(), true);
  assert.equal(settingsStore.isMenuCustomizerEnabled(), true);
  assert.deepEqual(savedSnapshots.at(-1), {
    fileMarker: {
      enabled: true
    },
    anchorGraph: {
      enabled: true
    },
    menuCustomizer: {
      enabled: true
    }
  });
});

test('关系图谱增强会根据运行环境兼容性进行启用或降级', () => {
  const incompatibleObsidianStub = createObsidianStub({
    requireApiVersion: () => false
  });
  const { AnchorGraphLinkEnhancer: IncompatibleEnhancer } = loadModuleWithObsidianStub(
    'src/modules/anchor-graph-links/index.js',
    incompatibleObsidianStub
  );
  const incompatiblePlugin = {
    isAnchorGraphEnabled: () => true,
    app: {
      metadataCache: {
        resolvedLinks: {},
        getFirstLinkpathDest: () => null
      }
    }
  };
  const incompatibleEnhancer = new IncompatibleEnhancer(incompatiblePlugin);

  assert.equal(incompatibleEnhancer.ensureCompatibleRuntime(false), false);
  assert.equal(incompatibleEnhancer.getRuntimeStatus().state, 'degraded');
  assert.match(incompatibleEnhancer.getRuntimeStatus().message, /1\.4\.16\+/);

  const compatibleObsidianStub = createObsidianStub({
    requireApiVersion: () => true
  });
  const { AnchorGraphLinkEnhancer: CompatibleEnhancer } = loadModuleWithObsidianStub(
    'src/modules/anchor-graph-links/index.js',
    compatibleObsidianStub
  );
  const compatiblePlugin = {
    isAnchorGraphEnabled: () => true,
    app: {
      metadataCache: {
        resolvedLinks: {},
        getFirstLinkpathDest: () => null
      }
    }
  };
  const compatibleEnhancer = new CompatibleEnhancer(compatiblePlugin);

  assert.equal(compatibleEnhancer.ensureCompatibleRuntime(false), true);
  assert.equal(compatibleEnhancer.getRuntimeStatus().state, 'active');
});

test('HTML 内部链接提取可兼容属性值中的特殊字符与复杂写法', () => {
  const obsidianStub = createObsidianStub();
  const { AnchorGraphLinkEnhancer } = loadModuleWithObsidianStub(
    'src/modules/anchor-graph-links/index.js',
    obsidianStub
  );
  const enhancer = new AnchorGraphLinkEnhancer({
    isAnchorGraphEnabled: () => true,
    app: {
      metadataCache: {
        resolvedLinks: {},
        getFirstLinkpathDest: () => null
      }
    }
  });

  const content = [
    '<span style="cursor: pointer; font-weight: var(--bold-weight)" title="Programming Languages"><a data-tooltip-position="top" aria-label="后端开发 > ^oqhc5p" data-href="后端开发#^oqhc5p" href="后端开发#^oqhc5p" class="internal-link" target="_blank" rel="noopener">服务器端语言</a></span>',
    '<a class="internal-link extra-link" data-href="Topic &amp; Tools#^block" title="1 < 2 &quot;quoted&quot;" data-note="&#x4F60;&#22909;">Entity Link</a>',
    '<a class=\'internal-link\' aria-label=\'Alpha > Beta\' data-href=\'Single Quote Target#^block\'>Single Quote</a>',
    '<a\n class=internal-link\n data-href=PlainTarget\n title="line break > still works"\n>Plain Target</a>',
    '<a class="external-link" href="https://example.com?a=1&amp;b=2">External</a>',
    '<a class="internal-link" data-href="#local-only">Local Only</a>',
    '<abbr data-href="Ignored">Not A Link</abbr>'
  ].join('\n');

  assert.deepEqual(enhancer.extractInternalAnchorTargets(content), [
    '后端开发#^oqhc5p',
    'Topic & Tools#^block',
    'Single Quote Target#^block',
    'PlainTarget'
  ]);
});

test('大仓库快照构建会按批次让出主线程，避免长时间阻塞', async () => {
  const obsidianStub = createObsidianStub();
  const { AnchorGraphLinkEnhancer } = loadModuleWithObsidianStub(
    'src/modules/anchor-graph-links/index.js',
    obsidianStub
  );

  class TestEnhancer extends AnchorGraphLinkEnhancer {
    constructor(plugin) {
      super(plugin);
      this.yieldCount = 0;
    }

    buildResolvedCountsFromContent(content, sourcePath) {
      return content
        ? { [`${sourcePath}#dest`]: 1 }
        : {};
    }

    async yieldToMainThread() {
      this.yieldCount += 1;
    }
  }

  const markdownFiles = Array.from({ length: 45 }, (_, index) => ({
    path: `note-${index + 1}.md`
  }));
  const pluginStub = {
    isAnchorGraphEnabled: () => true,
    app: {
      vault: {
        cachedRead: async (file) => (file.path.endsWith('5.md') ? '' : '<a class="internal-link" data-href="Target"></a>')
      },
      metadataCache: {
        resolvedLinks: {},
        getFirstLinkpathDest: () => null
      }
    }
  };
  const enhancer = new TestEnhancer(pluginStub);

  const snapshot = await enhancer.buildResolvedLinksSnapshot(markdownFiles);

  assert.equal(enhancer.yieldCount, 2);
  assert.equal(Object.keys(snapshot).length, 40);
});
