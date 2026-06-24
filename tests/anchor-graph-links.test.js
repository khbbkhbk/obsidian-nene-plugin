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
    Notice: class Notice {},
    TFile: FakeTFile,
    requireApiVersion: () => true
  }, overrides);
}

test('插件级数据仓库会按当前模块切片结构补齐默认值', () => {
  const obsidianStub = createObsidianStub();
  const { PluginDataStore } = loadModuleWithObsidianStub('src/modules/plugin-data/store.js', obsidianStub);
  const pluginStub = {
    loadData: async () => null,
    saveData: async () => {}
  };
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
    }
  });

  assert.equal(defaultSettings.features.fileMarker.enabled, false);
  assert.equal(defaultSettings.features.anchorGraph.enabled, false);
  assert.equal(defaultSettings.fileMarker.groups[0].id, 'ungrouped');
  assert.equal(normalizedSettings.features.fileMarker.enabled, true);
  assert.equal(normalizedSettings.features.anchorGraph.enabled, true);
  assert.equal(normalizedSettings.fileMarker.marks['a.md'].path, 'a.md');
  assert.equal(normalizedSettings.fileMarker.groups[0].id, 'custom');
});

test('插件级功能设置仓库会持久化文件标记与关系图谱启用状态', async () => {
  const obsidianStub = createObsidianStub();
  const { PluginSettingsStore } = loadModuleWithObsidianStub('src/modules/plugin-settings/store.js', obsidianStub);
  const savedSnapshots = [];
  const pluginStub = {
    dataStore: {
      setFeatures(features) {
        savedSnapshots.push(JSON.parse(JSON.stringify(features)));
      },
      save: async () => {}
    }
  };
  const settingsStore = new PluginSettingsStore(pluginStub);

  settingsStore.load({});
  assert.equal(settingsStore.isFileMarkerEnabled(), false);
  assert.equal(settingsStore.isAnchorGraphEnabled(), false);

  await settingsStore.setFileMarkerEnabled(true);
  await settingsStore.setAnchorGraphEnabled(true);

  assert.equal(settingsStore.isFileMarkerEnabled(), true);
  assert.equal(settingsStore.isAnchorGraphEnabled(), true);
  assert.deepEqual(savedSnapshots.at(-1), {
    fileMarker: {
      enabled: true
    },
    anchorGraph: {
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
