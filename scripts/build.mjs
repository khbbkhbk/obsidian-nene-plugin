import * as esbuild from 'esbuild';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const projectRootPath = resolve(dirname(currentFilePath), '..');
const entryFilePath = resolve(projectRootPath, 'src', 'main.js');
const outputFilePath = resolve(projectRootPath, 'main.js');
const isWatchMode = process.argv.includes('--watch');

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
  if (isWatchMode) {
    const buildContext = await esbuild.context(sharedBuildOptions);
    await buildContext.watch();
    console.log('[obsidian-nene-plugin] watch 模式已启动，修改 src/ 后会自动输出到根目录 main.js');
    return;
  }

  await esbuild.build(sharedBuildOptions);
  console.log('[obsidian-nene-plugin] 已从 src/ 打包生成根目录 main.js');
}

runBuild().catch((error) => {
  console.error('[obsidian-nene-plugin] 打包失败', error);
  process.exit(1);
});
