# 月白回响

一个原创二次元幻想风抽卡模拟器。你可以在网页里体验单抽、十连、祈愿演出、保底机制、角色图鉴和抽卡记录。

> 在线试玩：https://agentshan.github.io/moonwhite-echoes/

## 特色

- 幻想风祈愿界面，偏月白、神殿、星辉氛围
- 单抽 / 十连 / UP / 保底模拟
- 24 名原创女性角色，含立绘、稀有度、阵营、元素和角色小传
- 图鉴、角色详情、抽卡记录和本地数据清空
- 纯静态前端，无需后端服务

## 本地运行

```bash
npm run serve
```

然后打开 `http://localhost:4174`。

也可以直接使用 Python 静态服务：

```bash
python3 -m http.server 4174
```

## 部署

这是一个静态网页项目，可以直接部署到 GitHub Pages、Vercel 或 Netlify。

如果使用 GitHub Pages：

1. 将仓库推送到 GitHub
2. 在仓库设置中打开 Pages
3. 选择 `main` 分支和根目录 `/`
4. 等待生成访问链接

## 开发

```bash
npm test
npm run check
```

角色图生成脚本支持查看内置提示词：

```bash
node scripts/generate-character-art.js --dry-run --all
```

## 声明

本项目为原创练习项目，不使用现有商业游戏角色、真实游戏 UI 素材或真实充值功能。抽卡结果仅用于娱乐模拟。

## License

MIT
