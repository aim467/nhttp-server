# nhttp-server

> 轻量级 Node.js 静态文件服务器，提供现代化的目录渲染、文件图标、图片/视频预览等功能

## 特性

- 🚀 **零配置启动** - 一键启动静态文件服务器
- 🎨 **现代化界面** - 美观的目录浏览界面，支持列表/网格视图切换
- 📱 **响应式设计** - 完美适配桌面和移动设备
- 🖼️ **媒体预览** - 支持图片、视频、音频的在线预览
- 📁 **智能图标** - 根据文件类型显示对应图标
- ⚡ **高性能** - 支持缓存、Range 请求、压缩等优化
- 🔧 **灵活配置** - 支持端口、目录、CORS 等多种配置选项

## 安装

### 全局安装

```bash
npm install -g nhttp-server
```

### 本地开发

```bash
git clone <repository-url>
cd nhttp-server
npm install
npm link  # 创建全局链接
```

## 使用方法

### 基本用法

```bash
# 在当前目录启动服务器
nhttp-server

# 指定目录和端口
nhttp-server -p 9000 ./public

# 启动后自动打开浏览器
nhttp-server --open

# 启用压缩和 CORS
nhttp-server --compress --cors
```

### 命令行选项

| 选项 | 描述 | 默认值 |
|------|------|--------|
| `[directory]` | 要服务的目录 | 当前目录 |
| `-p, --port <number>` | 指定端口 | 8000 |
| `-d, --directory <path>` | 指定根目录 | 当前目录 |
| `-o, --open` | 启动后自动打开浏览器 | false |
| `--no-browser` | 明确不打开浏览器 | - |
| `--compress` | 启用 gzip/brotli 压缩 | false |
| `--cors` | 启用 CORS | false |
| `-v, --version` | 显示版本号 | - |
| `-h, --help` | 显示帮助信息 | - |

### 使用示例

```bash
# 基本使用
nhttp-server

# 指定端口和目录
nhttp-server -p 3000 ./dist

# 开发模式（自动打开浏览器，启用 CORS）
nhttp-server --open --cors

# 生产模式（启用压缩）
nhttp-server --compress -p 80

# 服务特定目录
nhttp-server ~/Documents/photos --open
```

## 功能特性

### 目录浏览

- **现代化界面**：清晰的文件列表，支持面包屑导航
- **视图切换**：支持列表视图和网格视图
- **智能排序**：按名称、大小、修改时间排序
- **文件图标**：根据文件类型显示对应的图标

### 媒体预览

- **图片预览**：点击图片文件可在模态框中预览
- **视频播放**：支持 MP4、WebM 等格式的在线播放
- **音频播放**：支持 MP3、WAV 等格式的在线播放

### 性能优化

- **缓存支持**：支持 ETag 和 Last-Modified 缓存
- **Range 请求**：支持断点续传，适合大文件下载
- **压缩传输**：可选的 gzip/brotli 压缩
- **静态资源优化**：合理的缓存策略

### 安全特性

- **路径安全**：防止目录穿越攻击
- **CORS 支持**：可选的跨域资源共享
- **访问日志**：详细的请求日志记录

## 键盘快捷键

在目录浏览页面中，支持以下快捷键：

- `V` - 切换视图（列表/网格）
- `S` - 切换排序方式
- `R` - 刷新页面
- `ESC` - 关闭媒体预览模态框

## 支持的文件类型

### 图片格式
- PNG, JPG, JPEG, GIF, SVG, WebP, BMP, ICO

### 视频格式
- MP4, WebM, MOV, AVI, MKV, FLV, WMV

### 音频格式
- MP3, WAV, OGG, M4A, FLAC, AAC

### 文档格式
- PDF, DOC, DOCX, TXT, MD, RTF

### 代码文件
- JS, TS, JSX, TSX, HTML, CSS, SCSS, LESS
- JSON, XML, YAML, YML
- Python, Java, C++, C, Go, Rust, PHP, Ruby

### 压缩包
- ZIP, RAR, 7Z, TAR, GZ, BZ2

## 开发

### 项目结构

```
nhttp-server/
├── bin/
│   └── nhttp-server.js    # CLI 启动脚本
├── lib/
│   ├── server.js          # HTTP 服务器
│   ├── router.js          # 路由处理
│   ├── renderer.js        # 目录渲染
│   └── utils.js           # 工具函数
├── package.json
├── README.md
└── project.md             # 设计文档
```

### 本地开发

```bash
# 克隆项目
git clone <repository-url>
cd nhttp-server

# 安装依赖
npm install

# 创建全局链接
npm link

# 测试
nhttp-server --help
```

### 技术栈

- **Node.js** 16+ - 运行环境
- **Commander.js** - CLI 参数解析
- **Chalk** - 终端彩色输出
- **mime** - MIME 类型识别
- **原生 HTTP 模块** - 轻量级实现

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 更新日志

### v1.0.0
- 初始版本发布
- 基本的静态文件服务功能
- 现代化的目录浏览界面
- 媒体文件预览功能
- 响应式设计支持