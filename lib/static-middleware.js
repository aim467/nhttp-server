const fs = require('fs');
const path = require('path');
const mime = require('mime');

/**
 * 静态文件中间件
 * 用于提供 CSS、JavaScript 等静态资源
 */
class StaticMiddleware {
  constructor(staticDir) {
    this.staticDir = staticDir;
  }

  /**
   * 处理静态文件请求
   * @param {string} pathname - 请求路径
   * @param {http.ServerResponse} res - 响应对象
   * @returns {boolean} 是否处理了请求
   */
  handle(pathname, res) {
    // 检查是否是静态文件请求
    if (!pathname.startsWith('/static/')) {
      return false;
    }

    // 移除 /static/ 前缀
    const relativePath = pathname.substring(8);
    const fullPath = path.join(this.staticDir, relativePath);

    // 安全检查：确保文件在静态目录内
    if (!fullPath.startsWith(this.staticDir)) {
      this.sendError(res, 403, 'Forbidden');
      return true;
    }

    // 检查文件是否存在
    fs.stat(fullPath, (err, stats) => {
      if (err || !stats.isFile()) {
        this.sendError(res, 404, 'Not Found');
        return;
      }

      // 获取 MIME 类型
      const ext = path.extname(fullPath);
      const mimeType = mime.getType(ext) || 'application/octet-stream';

      // 设置缓存头
      const etag = `"${stats.size}-${stats.mtime.getTime()}"`;
      res.setHeader('ETag', etag);
      res.setHeader('Last-Modified', stats.mtime.toUTCString());
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24小时缓存
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', stats.size);

      // 检查缓存
      const ifNoneMatch = res.req.headers['if-none-match'];
      if (ifNoneMatch === etag) {
        res.writeHead(304);
        res.end();
        return;
      }

      // 发送文件
      res.writeHead(200);
      const stream = fs.createReadStream(fullPath);
      stream.pipe(res);
      
      stream.on('error', () => {
        if (!res.headersSent) {
          this.sendError(res, 500, 'Internal Server Error');
        }
      });
    });

    return true;
  }

  /**
   * 发送错误响应
   */
  sendError(res, statusCode, statusText) {
    if (res.headersSent) return;
    
    res.setHeader('Content-Type', 'text/plain');
    res.writeHead(statusCode);
    res.end(`${statusCode} ${statusText}`);
  }
}

module.exports = StaticMiddleware;