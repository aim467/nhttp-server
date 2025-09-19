# nhttp-server 设计文档

> 轻量级 Node.js 静态文件服务器，类似 `python -m http.server`，但提供更现代化的目录渲染、文件图标、图片/视频预览等功能。

---

## 目录

1. 项目概述
2. 功能需求
3. CLI 设计
4. 技术栈与依赖
5. 项目结构
6. 请求处理流程
7. 目录渲染与 UI 设计
8. 图标与文件类型映射
9. 日志与终端输出
10. 安全与缓存策略
11. 可选/后续功能


---

## 1. 项目概述

`nhttp-server` 是一个基于 Node.js 的轻量级静态文件服务器，目标是：

* 在本地快速启动静态文件服务器用于开发或临时共享文件。
* 提供比 `python -m http.server` 更好的 UI/UX（目录缩略图、图标、预览、响应式界面）。
* 保持零配置即可使用，同时支持常见自定义参数（端口、根目录、自动打开浏览器等）。

## 2. 功能需求

### 必要功能

* 启动静态服务器，默认端口 `8000`。
* 支持通过 `-p` / `--port` 指定端口。
* 支持通过命令参数指定根目录（默认 `process.cwd()`）。
* 目录列表渲染：显示文件名、大小、修改时间、图标。
* 图片/视频/音频预览（内嵌 `<img>`、`<video>`、`<audio>`）。
* 支持 `index.html` 优先渲染（目录存在 index 时直接返回）。

### 推荐功能（迭代）

* 列表/网格视图切换。
* 缩略图（图片的缩略图缓存，目录大量图片时提升性能）。
* 自动打开浏览器（`--open`）。
* 终端彩色日志（`chalk`）。
* 支持 gzip/brotli 压缩。
* ETag / Last-Modified 缓存支持。
* 简单的访问控制（后续版本开发）。

## 3. CLI 设计

### 命令格式

```bash
nhttp-server [options] [directory]
```

### 支持参数

* `-p, --port <number>`: 指定端口，默认 `8000`。
* `-d, --directory <path>`: 指定根目录（可用位置参数替代），如果不指定，则默认为当前目录。
* `-o, --open`: 启动后自动打开默认浏览器。
* `--no-browser`: 明确不打开浏览器（可作为反向选项）。
* `--compress`: 启用 gzip/brotli（可选）。
* `-v, --version`: 输出版本号。
* `-h, --help`: 帮助信息。

### 示例

```bash
# 在当前目录启动，端口 8000
nhttp-server

# 指定端口与目录并自动打开浏览器
nhttp-server -p 9000 ./public --open

# 启用压缩功能
nhttp-server --compress
```

## 4. 技术栈与依赖

* Node.js 16+
* 内置模块：`http`, `fs`, `path`, `url`。
* 建议第三方包：

  * `mime`：MIME 类型识别
  * `commander`：CLI 解析
  * `chalk`：终端彩色输出
  * `fs-extra`：文件操作增强（可选）
  * `etag`：ETag 生成（可选）

尽量保持依赖精简以方便全局安装与快速启动。

## 5. 项目结构

```
project-root/
├─ bin/
│  └─ nhttp-server.js      # CLI 启动脚本（可执行）
├─ lib/
│  ├─ server.js            # HTTP server 启动与配置
│  ├─ router.js            # 路由 & 请求处理（文件/目录）
│  ├─ renderer.js          # 目录渲染模板逻辑
│  ├─ utils.js             # 工具函数（日志、mime、格式化）
├─ public/                 # 前端静态资源（目录页样式/脚本/图标）
│  ├─ style.css
│  ├─ script.js
│  └─ icons/
├─ package.json
└─ README.md
```

## 6. 请求处理流程

1. **解析请求**：解析 URL 路径，解码并拼接为本地文件路径，确保路径安全（防止目录穿越）。
2. **检查文件系统**：使用 `fs.stat` 判断目标是否存在以及类型（文件/目录）。
3. **文件处理**：

   * 设置 `Content-Type`（根据 `mime`）
   * 支持 Range 请求（视频断点续传，后续添加）
   * 支持压缩（根据 `Accept-Encoding` 可返回 gzip 或 brotli）
4. **目录处理**：

   * 如果目录下存在 `index.html`，直接返回该文件。
   * 否则列出目录：读取目录，收集每项的 `name`, `isDirectory`, `size`, `mtime`, `ext`。
   * 渲染模板（`renderer.js`）返回 HTML 页面。
5. **错误处理**：返回自定义 404/500 页面。

## 7. 目录渲染与 UI 设计

目录页面应具备：

* 标题栏：显示当前路径、返回上级按钮。
* 列表区/网格区：文件项显示图标/缩略图、文件名、大小、修改时间。
* 工具栏：视图切换、排序（按名称/时间/大小）、刷新按钮。
* 点击图片打开弹窗预览（可放大与下载）。

### UI 风格建议

* 参考 VSCode Explorer，配色淡雅，清晰的层次感。
* 响应式设计：移动端同样能用（列改为单列展示）。
* 使用内嵌 JS 实现局部交互（切换视图、排序），避免依赖大型前端框架。

## 8. 图标与文件类型映射

建议用一套小图标（SVG）放在 `public/icons/`：

| 类型        | 后缀示例                            | 图标（文件名）       |
| --------- | ------------------------------- | ------------- |
| 文件夹       | —                               | folder.svg    |
| HTML / 文本 | .html .htm .txt .md .json       | file-text.svg |
| 图片        | .png .jpg .jpeg .gif .svg .webp | image.svg     |
| 视频        | .mp4 .webm .mov                 | video.svg     |
| 音频        | .mp3 .wav .ogg                  | audio.svg     |
| 压缩包       | .zip .tar .gz .rar              | archive.svg   |
| 代码文件      | .js .ts .java .py .go .rb       | code.svg      |
| 其他        | —                               | file.svg      |

后端根据文件扩展名选择对应图标，前端也可根据 MIME 类型二次判断。


## 9. 日志与终端输出

* 启动时输出：

  ```
  🚀 nhttp-server started:
    http://localhost:8000
    Serving: /Users/you/project
  ```
* 请求日志格式：`[方法] 路径 状态 响应时间 大小`，例如：

  ```
  [GET] /index.html 200 2.34ms 2.1KB
  [GET] /images/logo.png 200 15.6ms 45KB
  [GET] /nonexistent 404 1.1ms -
  ```
* 可选：启用 `--log` 保存到文件。

## 10. 安全与缓存策略

* **路径安全**：必须对请求路径做 `path.normalize` 并禁止访问上层目录（`..`）以防目录穿越攻击。
* **缓存**：支持 `Last-Modified` 与 `ETag`，对于静态文件返回 304 减少带宽。
* **CORS**：提供一个开关（开发时有用）。

## 11. 可选/后续功能（目前暂不考虑）

* WebSocket + LiveReload：文件变化自动刷新浏览器（适合前端开发）。
* 缩略图生成缓存：对于大量图片目录，提高浏览列表效率。
* 简单认证系统：密码保护、会话管理、IP 白名单。
* 文件管理功能：上传/删除文件的 Web 界面。
* 多用户权限控制：不同用户不同访问权限。
* 访问日志与审计：详细的访问记录和安全事件日志。
* 打包为单文件可执行（`pkg` / `nexe`）。
* 集成 TLS（支持 https，开发自签名证书或使用 `--cert` 指定证书）。

