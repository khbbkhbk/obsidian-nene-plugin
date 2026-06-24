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
      anchorGraph: {
        enabled: false
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

  assert.equal(defaultSettings.features.anchorGraph.enabled, true);
  assert.equal(defaultSettings.fileMarker.groups[0].id, 'ungrouped');
  assert.equal(normalizedSettings.features.anchorGraph.enabled, false);
  assert.equal(normalizedSettings.fileMarker.marks['a.md'].path, 'a.md');
  assert.equal(normalizedSettings.fileMarker.groups[0].id, 'custom');
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
