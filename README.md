# jmind — 本地优先的思维导图工具

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub Pages](https://img.shields.io/badge/GitHub-Pages-blue.svg)](https://pages.github.com/)

一个轻量级、纯前端的在线思维导图工具。所有数据存储在浏览器本地，无需注册登录，开箱即用。

## ✨ 功能特性

### 核心编辑
- **可视化画布** — 基于 Canvas 的流畅渲染，支持无限缩放和平移
- **拖拽排序** — 拖拽节点到目标位置，支持作为子节点或兄弟节点插入
- **节点操作** — 添加子节点/兄弟节点、删除、编辑文本、折叠/展开
- **右键菜单** — 丰富的上下文操作菜单
- **节点颜色** — 自定义节点颜色，支持多种预设配色

### 效率工具
- **撤销 / 重做** — 完整的操作历史记录（Ctrl+Z / Ctrl+Y）
- **节点搜索** — 实时搜索并高亮匹配节点（Ctrl+F）
- **复制 / 粘贴** — 复制节点子树，粘贴为目标节点的子节点（Ctrl+C / Ctrl+V）
- **节点复制** — 快速创建节点副本（Ctrl+D）
- **自动保存** — 编辑后 2 秒自动保存，离开页面时自动保存
- **适应画布** — 一键缩放至全部内容可见

### 导入导出
- **导出 .jmind** — JSON 格式的思维导图文件，可跨设备迁移
- **导出 PNG** — 2 倍高清图片导出，适合分享和演示
- **导入文件** — 支持导入 .jmind / .json 格式文件
- **数据备份** — 设置页可一键导出全部本地数据

### 界面体验
- **多主题** — 浅色、深色、绿色、粉色、蓝色五种主题
- **响应式** — 支持桌面端和移动端触摸操作
- **快捷键** — 丰富的键盘快捷键，提升编辑效率
- **状态栏** — 实时显示节点数量和缩放比例

## 🚀 快速开始

### 在线使用
访问 [https://jidanpirate.github.io/jmind/](https://jidanpirate.github.io/jmind/) 即可直接使用，无需安装。

### 本地运行
```bash
# 克隆仓库
git clone https://github.com/jidanpirate/jmind.git
cd jmind

# 方式一：直接用浏览器打开 index.html
# 方式二：启动本地服务器（推荐）
python3 -m http.server 8080
# 然后访问 http://localhost:8080
```

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Tab` | 添加子节点 |
| `Enter` | 添加兄弟节点 |
| `Delete` / `Backspace` | 删除选中节点 |
| `F2` | 编辑节点文本 |
| `Space` | 折叠/展开节点 |
| `Ctrl+Z` | 撤销 |
| `Ctrl+Y` / `Ctrl+Shift+Z` | 重做 |
| `Ctrl+S` | 保存 |
| `Ctrl+F` | 搜索节点 |
| `Ctrl+C` | 复制节点 |
| `Ctrl+V` | 粘贴节点 |
| `Ctrl+D` | 复制节点为副本 |
| `+` / `=` | 放大 |
| `-` | 缩小 |
| `0` | 适应画布 |
| `Esc` | 关闭菜单/搜索/取消编辑 |
| 双击节点 | 编辑文本 |
| 右键节点 | 打开上下文菜单 |

## 📁 项目结构

```
jmind/
├── index.html          # 首页（最近文件列表）
├── editor.html         # 思维导图编辑器
├── settings.html       # 设置页面
├── css/
│   ├── common.css      # 共享样式（主题变量、导航、按钮、Toast）
│   ├── index.css       # 首页样式
│   ├── editor.css      # 编辑器样式
│   └── settings.css    # 设置页样式
├── js/
│   ├── storage.js      # 本地存储管理（文件 CRUD、设置）
│   ├── mindmap.js      # 数据模型、节点操作、撤销历史、剪贴板
│   ├── layout.js       # 树状布局引擎
│   ├── renderer.js     # Canvas 渲染器、命中检测、PNG 导出
│   ├── editor-app.js   # 编辑器主逻辑（事件、快捷键、工具栏）
│   ├── index-app.js    # 首页逻辑
│   └── settings-app.js # 设置页逻辑
├── .nojekyll           # GitHub Pages 配置（禁用 Jekyll）
├── .gitignore
└── README.md
```

## 🛠️ 技术栈

- **纯原生 HTML / CSS / JavaScript** — 无框架依赖，无构建步骤
- **Canvas 2D API** — 高性能节点和连线渲染
- **localStorage** — 本地数据持久化
- **CSS 自定义属性** — 主题系统实现

## 📄 文件格式

`.jmind` 文件为 JSON 格式，结构如下：

```json
{
  "format": "jmind",
  "version": "1.1",
  "created": "2026-01-01T00:00:00.000Z",
  "modified": "2026-01-01T00:00:00.000Z",
  "root": {
    "id": "node-1-abc",
    "text": "中心主题",
    "color": "#E8825A",
    "collapsed": false,
    "children": [
      {
        "id": "node-2-def",
        "text": "分支 1",
        "color": "#5B9BD5",
        "collapsed": false,
        "children": []
      }
    ]
  }
}
```

## 🔒 隐私说明

- 所有思维导图数据仅存储在你的浏览器本地（localStorage）
- 不会向任何服务器上传或同步数据
- 清除浏览器数据将导致文件丢失，请定期使用"导出备份"功能
- 建议定期导出重要的思维导图文件

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📝 变更日志

### v1.1.0
- 新增：撤销/重做功能
- 新增：节点搜索（Ctrl+F）
- 新增：复制/粘贴/复制节点
- 新增：导出 PNG 高清图片
- 新增：自动保存（2秒延迟 + 离开页面保存）
- 新增：节点颜色自定义
- 新增：数据备份导出
- 优化：代码模块化拆分（CSS/JS 分离）
- 优化：统一主题系统，支持深色模式
- 优化：保存状态指示器

### v1.0.0
- 初始版本
- 基础思维导图编辑功能
- 本地存储、导入导出
- 拖拽排序、缩放平移
- 多主题支持

## 📄 License

本项目基于 [MIT License](LICENSE) 开源。
