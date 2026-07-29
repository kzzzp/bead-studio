# 豆格 · 拼豆图纸生成器

完全在浏览器本地运行的照片转拼豆图纸工具。支持 MARD 基础 221 色、Lab 色彩匹配、限制颜色数、Floyd–Steinberg 抖动、纯色背景去除、坐标/色号图纸和 PNG/CSV 导出。

## 运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

## 产品规划

- [产品改进路线图](docs/PRODUCT_IMPROVEMENT_ROADMAP.md)：记录后续图纸编辑、多品牌色卡、镜像、真实尺寸打印、构图、工程保存和拼豆执行辅助计划。

## 设计说明

- 上传的图片只在浏览器内解码和处理，不会发送到服务器。
- 色彩匹配使用 CIELAB 欧氏距离，而不是直接比较 RGB。
- 限色采用基于像素权重的贪心调色板选择，再将每个像素映射到所选 MARD 色号。
- 显示色值来自公开色卡资料，是屏幕近似值；不同批次、光照和显示器会造成实物色差。

## 调研参考

- Tezumie/Image-to-Pixel（MIT/Apache-2.0）：抖动和调色板控制的产品思路。
- rgab1508/PixelCraft（MIT）：浏览器 Canvas 导入与像素编辑思路。
- imjasonh/5297038（公开 Gist）：将图片映射到可购买拼豆色卡的早期实现。
- Bead Pattern Lab / MARD 色卡：MARD 基础色号的屏幕近似 HEX 数据。

本项目的转换、界面和导出代码均为独立实现，没有复制上述项目源码。
