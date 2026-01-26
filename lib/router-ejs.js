const fs = require('fs');
const path = require('path');
const url = require('url');
const mime = require('mime');
const chalk = require('chalk');
const archiver = require('archiver');
const zlib = require('zlib');
const { renderDirectory } = require('./renderer-ejs');
const { logRequest } = require('./utils');
const StaticMiddleware = require('./static-middleware');
const ErrorHandler = require('./error-handler');

// 需要压缩的 MIME 类型
const COMPRESSIBLE_TYPES = [
  'text/html',
  'text/plain',
  'text/css',
  'text/javascript',
  'text/xml',
  'application/javascript',
  'application/json',
  'application/xml',
  'application/xml+rss',
  'image/svg+xml'
];

/**
 * 基于 EJS 的路由处理器 - 支持静态文件服务
 */
class EJSRouter {
  constructor(options = {}) {
    this.staticMiddleware = new StaticMiddleware(
      options.staticDir || path.join(__dirname, 'static')
    );
    this.errorHandler = new ErrorHandler({
      showStackTrace: process.env.NODE_ENV === 'development'
    });
  }

  /**
   * 处理 HTTP 请求
   * @param {http.IncomingMessage} req - 请求对象
   * @param {http.ServerResponse} res - 响应对象
   * @param {Object} options - 配置选项
   */
  handleRequest(req, res, options) {
    const startTime = Date.now();
    const { rootDir, compress, cors } = options;
    
    try {
      const parsedUrl = url.parse(req.url, true);
      const pathname = decodeURIComponent(parsedUrl.pathname);
      const query = parsedUrl.query || {};
      
      // 设置 CORS 头
      if (cors) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Range');
      }

      // 处理 OPTIONS 请求
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        logRequest(req, 200, Date.now() - startTime);
        return;
      }

      // 只支持 GET 和 HEAD 方法
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        this.sendError(res, 405, 'Method Not Allowed', '不支持的请求方法');
        logRequest(req, 405, Date.now() - startTime);
        return;
      }

      // 尝试处理静态文件请求
      res.req = req; // 为静态中间件提供 req 对象
      if (this.staticMiddleware.handle(pathname, res)) {
        logRequest(req, res.statusCode || 200, Date.now() - startTime);
        return;
      }

      // 处理普通文件/目录请求
      this.handleFileSystemRequest(req, res, pathname, rootDir, compress, startTime, query);

    } catch (error) {
      this.errorHandler.handleError(error, req, res);
    }
  }

  /**
   * 处理文件系统请求
   */
  handleFileSystemRequest(req, res, pathname, rootDir, compress, startTime, query = {}) {
    // 安全检查：防止目录穿越攻击
    const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(rootDir, safePath);
    
    // 确保请求路径在根目录内
    if (!fullPath.startsWith(rootDir)) {
      this.sendError(res, 403, 'Forbidden', '访问被拒绝');
      logRequest(req, 403, Date.now() - startTime);
      return;
    }

    // 检查文件/目录是否存在
    fs.stat(fullPath, (err, stats) => {
      if (err) {
        this.errorHandler.handleError(err, req, res);
        return;
      }

      if (stats.isDirectory()) {
        this.handleDirectory(req, res, fullPath, pathname, startTime, query);
      } else if (stats.isFile()) {
        this.handleFile(req, res, fullPath, stats, compress, startTime, query);
      } else {
        this.sendError(res, 404, 'Not Found', '不支持的文件类型');
        logRequest(req, 404, Date.now() - startTime);
      }
    });
  }

  /**
   * 处理目录请求
   */
  handleDirectory(req, res, fullPath, pathname, startTime, query = {}) {
    if (query && query.download === '1') {
      this.sendDirectoryAsZip(req, res, fullPath, pathname, startTime);
      return;
    }

    // 检查是否存在 index.html
    const indexPath = path.join(fullPath, 'index.html');
    
    fs.stat(indexPath, (err, stats) => {
      if (!err && stats.isFile()) {
        // 存在 index.html，直接返回
        this.handleFile(req, res, indexPath, stats, false, startTime);
        return;
      }

      // 读取目录内容
      fs.readdir(fullPath, { withFileTypes: true }, (err, entries) => {
        if (err) {
          this.errorHandler.handleError(err, req, res);
          return;
        }

        // 获取文件详细信息
        const filePromises = entries.map(entry => {
          return new Promise((resolve) => {
            const entryPath = path.join(fullPath, entry.name);
            
            fs.stat(entryPath, (err, stats) => {
              if (err) {
                resolve({
                  name: entry.name,
                  isDirectory: entry.isDirectory(),
                  size: 0,
                  mtime: new Date(),
                  ext: entry.isDirectory() ? '' : path.extname(entry.name)
                });
                return;
              }

              resolve({
                name: entry.name,
                isDirectory: entry.isDirectory(),
                size: stats.size,
                mtime: stats.mtime,
                ext: entry.isDirectory() ? '' : path.extname(entry.name)
              });
            });
          });
        });

        Promise.all(filePromises).then(files => {
          // 排序：目录在前，然后按名称排序
          files.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
          });

          try {
            // 获取服务器端口
            const port = req.socket.server.address().port;
            const html = renderDirectory(pathname, files, port);
            
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Content-Length', Buffer.byteLength(html));
            res.writeHead(200);
            res.end(html);
            
            logRequest(req, 200, Date.now() - startTime, Buffer.byteLength(html));
          } catch (renderError) {
            console.error(chalk.red('模板渲染错误:'), renderError);
            this.sendError(res, 500, 'Internal Server Error', '模板渲染失败');
            logRequest(req, 500, Date.now() - startTime);
          }
        });
      });
    });
  }

  /**
   * 处理文件请求
   */
  handleFile(req, res, fullPath, stats, compress, startTime, query = {}) {
    const ext = path.extname(fullPath);
    const mimeType = mime.getType(ext) || 'application/octet-stream';
    const isDownload = query && query.download === '1';

    // 设置缓存头
    const etag = `"${stats.size}-${stats.mtime.getTime()}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Last-Modified', stats.mtime.toUTCString());
    res.setHeader('Cache-Control', 'public, max-age=3600');

    // 检查缓存
    const ifNoneMatch = req.headers['if-none-match'];
    const ifModifiedSince = req.headers['if-modified-since'];

    if (ifNoneMatch === etag ||
        (ifModifiedSince && new Date(ifModifiedSince) >= stats.mtime)) {
      res.writeHead(304);
      res.end();
      logRequest(req, 304, Date.now() - startTime);
      return;
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Accept-Ranges', 'bytes');

    if (isDownload) {
      const fileName = path.basename(fullPath);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(fileName)}"`
      );
    }

    // 处理 Range 请求（用于视频等大文件的断点续传）
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;

      if (start >= stats.size || end >= stats.size) {
        res.setHeader('Content-Range', `bytes */${stats.size}`);
        res.writeHead(416);
        res.end();
        logRequest(req, 416, Date.now() - startTime);
        return;
      }

      const chunksize = (end - start) + 1;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stats.size}`);
      res.setHeader('Content-Length', chunksize);
      res.writeHead(206);

      if (req.method === 'HEAD') {
        res.end();
        logRequest(req, 206, Date.now() - startTime);
        return;
      }

      const stream = fs.createReadStream(fullPath, { start, end });
      stream.pipe(res);
      stream.on('end', () => {
        logRequest(req, 206, Date.now() - startTime, chunksize);
      });
      return;
    }


    // 处理压缩
    let transformStream = null;
    let contentEncoding = null;

    if (compress && this.shouldCompress(mimeType)) {
      const acceptEncoding = req.headers['accept-encoding'] || '';

      if (acceptEncoding.includes('gzip')) {
        contentEncoding = 'gzip';
        transformStream = zlib.createGzip();
      } else if (acceptEncoding.includes('deflate')) {
        contentEncoding = 'deflate';
        transformStream = zlib.createDeflate();
      }
    }

    // 设置 Content-Encoding header（必须在 writeHead 之前）
    if (contentEncoding) {
      res.setHeader('Content-Encoding', contentEncoding);
    }

    res.writeHead(200);

    if (req.method === 'HEAD') {
      res.end();
      logRequest(req, 200, Date.now() - startTime);
      return;
    }

    // 创建文件流
    const stream = fs.createReadStream(fullPath);

    // 根据是否需要压缩选择不同的管道
    if (transformStream) {
      stream.pipe(transformStream).pipe(res);
    } else {
      stream.pipe(res);
    }

    stream.on('error', (err) => {
      console.error(chalk.red('文件读取错误:'), err);
      if (!res.headersSent) {
        this.sendError(res, 500, 'Internal Server Error', '文件读取失败');
      }
      logRequest(req, 500, Date.now() - startTime);
    });

    stream.on('end', () => {
      logRequest(req, 200, Date.now() - startTime, stats.size);
    });
  }

  /**
   * 判断是否应该对响应进行压缩
   */
  shouldCompress(mimeType) {
    return COMPRESSIBLE_TYPES.some(type => {
      if (type.endsWith('/')) {
        // 前缀匹配，如 'text/' 匹配所有 text/* 类型
        return mimeType.startsWith(type);
      }
      return mimeType === type;
    });
  }

  /**
   * 将目录打包为 ZIP 并返回
   */
  sendDirectoryAsZip(req, res, fullPath, pathname, startTime) {
    const dirName = path.basename(fullPath) || 'archive';
    const zipName = `${dirName}.zip`;

    const disposition = `attachment; filename="${encodeURIComponent(zipName)}"`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', disposition);
    res.setHeader('Cache-Control', 'no-cache');

    if (req.method === 'HEAD') {
      res.writeHead(200);
      res.end();
      logRequest(req, 200, Date.now() - startTime);
      return;
    }

    res.writeHead(200);

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => {
      console.error(chalk.red('目录压缩错误:'), err);
      if (!res.headersSent) {
        this.sendError(res, 500, 'Internal Server Error', '目录压缩失败');
      } else {
        res.end();
      }
      logRequest(req, 500, Date.now() - startTime);
    });

    archive.on('end', () => {
      logRequest(req, 200, Date.now() - startTime);
    });

    archive.pipe(res);
    archive.directory(fullPath, dirName);
    archive.finalize();
  }

  /**
   * 发送错误响应
   */
  sendError(res, statusCode, statusText, message) {
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${statusCode} ${statusText}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
               margin: 0; padding: 40px; background: #f5f5f5; color: #333; }
        .container { max-width: 600px; margin: 0 auto; background: white; 
                    padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #e74c3c; margin: 0 0 20px 0; }
        p { margin: 0 0 20px 0; line-height: 1.6; }
        .back { color: #3498db; text-decoration: none; }
        .back:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${statusCode} ${statusText}</h1>
        <p>${message}</p>
        <a href="/" class="back">← 返回首页</a>
    </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(html));
    res.writeHead(statusCode);
    res.end(html);
  }
}

// 创建路由器实例
const router = new EJSRouter();

/**
 * 处理请求的函数 - 兼容原有接口
 */
function handleRequest(req, res, options) {
  router.handleRequest(req, res, options);
}

module.exports = { 
  handleRequest,
  EJSRouter
};
