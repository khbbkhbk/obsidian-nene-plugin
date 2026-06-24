import * as esbuild from 'esbuild';
import { watch } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const projectRootPath = resolve(dirname(currentFilePath), '..');
const entryFilePath = resolve(projectRootPath, 'src', 'main.js');
const outputFilePath = resolve(projectRootPath, 'main.js');
const styleSourceDirectoryPath = resolve(projectRootPath, 'src', 'styles');
const styleOutputFilePath = resolve(projectRootPath, 'styles.css');
const isWatchMode = process.argv.includes('--watch');
const generatedStyleBanner = [
  '/* 此文件为构建产物，由 scripts/build.mjs 根据 src/styles/ 下源码自动生成，禁止手改。 */',
  ''
].join('\n');

const sharedBuildOptions = {
  entryPoints: [entryFilePath],
  outfile: outputFilePath,
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['chrome114'],
  external: ['obsidian'],
  charset: 'utf8',
  legalComments: 'none',
  banner: {
    js: "'use strict';\n// 此文件为构建产物，由 scripts/build.mjs 根据 src/ 下源码自动生成，禁止手改。\n"
  }
};

async function runBuild() {
  await buildStyles();

  if (isWatchMode) {
    const buildContext = await esbuild.context(sharedBuildOptions);
    await buildContext.watch();
    const styleWatcher = watchStyles();
    console.log('[obsidian-nene-plugin] watch 模式已启动，修改 src/ 后会自动输出到根目录 main.js 与 styles.css');
    process.on('exit', () => styleWatcher.close());
    return;
  }

  await esbuild.build(sharedBuildOptions);
  console.log('[obsidian-nene-plugin] 已从 src/ 打包生成根目录 main.js 与 styles.css');
}

async function buildStyles() {
  const styleFileNames = await getStyleFileNames();
  const styleContents = await Promise.all(
    styleFileNames.map((fileName) => readFile(resolve(styleSourceDirectoryPath, fileName), 'utf8'))
  );
  const mergedStyles = `${generatedStyleBanner}${styleContents.map((content) => content.trim()).join('\n\n')}\n`;

  await writeFile(styleOutputFilePath, mergedStyles, 'utf8');
  console.log(`[obsidian-nene-plugin] 已从 src/styles 合并生成根目录 styles.css (${styleFileNames.length} 个文件)`);
}

async function getStyleFileNames() {
  const directoryEntries = await readdir(styleSourceDirectoryPath, { withFileTypes: true });
  const styleFileNames = directoryEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.css'))
    .map((entry) => entry.name)
    .sort((leftName, rightName) => leftName.localeCompare(rightName, 'en'));

  if (styleFileNames.length === 0) {
    throw new Error('src/styles 目录下未找到可合并的 CSS 文件');
  }

  return styleFileNames;
}

function watchStyles() {
  let rebuildTimerId = null;

  return watch(styleSourceDirectoryPath, { persistent: true }, (eventType, fileName) => {
    if (!fileName || !String(fileName).endsWith('.css')) {
      return;
    }

    clearTimeout(rebuildTimerId);
    rebuildTimerId = setTimeout(async () => {
      try {
        await buildStyles();
        console.log(`[obsidian-nene-plugin] 检测到样式变更：${String(fileName)} (${eventType})`);
      } catch (error) {
        console.error('[obsidian-nene-plugin] 样式合并失败', error);
      }
    }, 80);
  });
}

runBuild().catch((error) => {
  console.error('[obsidian-nene-plugin] 打包失败', error);
  process.exit(1);
});
