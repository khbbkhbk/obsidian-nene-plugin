# 源码目录说明

- 本目录用于存放多目录源码，平时开发只改这里。
- 根目录 `main.js` 为构建产物，供 Obsidian 直接加载，不作为日常开发入口。
- 根目录 `main.js` 应由 `src/main.js` 与 `src/modules/` 通过打包生成，禁止手改。
- 如果根目录不存在 `main.js`，需要先执行一次打包，Obsidian 才能正常加载插件。
- 打包命令：

```bash
npm run build
```

- 监听开发命令：

```bash
npm run dev
```
