# Logo 与 Slogan 上线规格

本次按用户最终选择，仅展示亲子托星 Logo 与 **Small steps. Shared growth.**，不采用中文产品名。浏览器、主屏幕及无障碍图片说明使用功能描述 **Family Habit Planner**，不将 Slogan 当作主屏幕名称。

`src/shared-web/brand.js` 保存文案、图形路径及原生 Canvas 绘制方法。图形由已选中的蓝色亲子与金色星星概念重新绘成确定性矢量，供两端入口与成长海报共用；不是第三方图标库素材，也没有商标无冲突保证。

最终资源位于 `src/shared-web/public/assets/brand/`：

- `parent-star-v1.svg`：透明矢量标记，适配深浅色背景。
- `icon-32-v1.png`：浏览器图标。
- `icon-180-v1.png`：Apple touch icon，白底、不预裁圆角。
- `icon-192-v1.png`、`icon-512-v1.png`：PWA any/maskable 图标，白底与安全留白。
- `app-v1.webmanifest`：两端同源各自安装，名称 Family Habit Planner。

两端 Vite 使用共享 public 目录，构建产物通过后端已有 `/assets` 挂载发布。字体许可证也移入该目录。资源文件名含版本号，变更图形时须递增版本并更新引用，以避免主屏幕旧缓存；已安装应用的标题和图标何时刷新由系统控制。

重新导出图标：`node scripts/build-brand-assets.mjs`，默认使用本机 Chrome；CI 可设置 `PLAYWRIGHT_BROWSER=chromium`。输入和输出均相对于脚本自身位置定位，与启动目录无关。

图片工具记录：曾使用内置 imagegen 对原 PNG 尝试透明提取，提示词要求保留蓝色大人/孩子及金星、去掉 Family Plan 文字与白底、无光晕和纹理。输出边缘出现杂点，未作为最终资源；最终上线为项目原生矢量与浏览器确定性导出 PNG，无图片模型生成的文字。

验收覆盖双端登录/绑定入口、深浅色与 320/390/834 宽度、实际 favicon/touch/manifest PNG、海报矢量图形及 Slogan 的 PNG 导出。未调整认证接口、会话存储键、计时/专注、奖励或数据库结构。

## 内置 imagegen 尝试的完整提示词（输出未采用）

> Use case: background-extraction. Edit target is the supplied parent-star Family Plan logo concept. Produce the same standalone icon mark on a genuinely transparent background. Remove ALL the text 'Family Plan' and the white canvas; keep ONLY the existing large parent on the left and smaller child on the right reaching toward the single rounded golden star above them. Preserve their original silhouette, scale relationship, poses, negative spaces and blue/gold colors as faithfully as possible. Clean solid cobalt blue #0071E3 figures and warm golden #FFB547 star; crisp flat edges, no gradients, glow, shadows, grain, halo, white outline or extra shapes. No lettering or words at all. Center just this mark in a square image, preserving proportions, with about 12 percent transparent clear margin on every side. The image is to be used as the app's real logo in light and dark interfaces.
