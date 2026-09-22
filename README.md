# 东大小游园

与东大有关的小小乐趣。非官方小游戏站，手机与电脑均可访问。

- 主页：https://t-oak-s.github.io/
- 合成东南大学：https://t-oak-s.github.io/merge.html
- 单文件版：下载根目录的 `合成东南大学.html`，在支持脚本的浏览器中打开。其返回主页按钮需要联网，游戏本身无需联网。

## 开发与发布

GitHub 仓库 `T-Oak-S/t-oak-s.github.io` 是当前源码基准。GitHub Pages 从 `main` 根目录发布，不再发布到 Sites。

主页是无脚本静态页面，使用独立的 `home.css`，不读取存档或运行物理引擎。游戏位于 `merge.html`，继续使用根目录原有脚本、样式及校徽资源。

使用 Node.js 24.15 或兼容版本，执行 `npm ci` 后运行 `npm test`。修改游戏后执行 `npm run export` 更新单文件版。测试依赖不参与网页运行。

## 存档兼容

保存键 `merge-seu.save.v1`、版本及域名保持不变，主页与游戏路径调整不需要迁移 GitHub 域名下的存档。原 Sites、其他浏览器、单文件版的记录不会自动迁移。

返回主页前先暂停并等待保存；保存失败时可选择留在游戏或仍然返回。存档需要当前浏览器可用的 localStorage 与 Web Locks；不支持时可游玩但不保证关闭后恢复。

## 验证范围

见 `VALIDATION.md`。DOM 自动化测试不等于真实浏览器、排版或真机触屏验收。
