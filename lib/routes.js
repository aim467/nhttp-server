const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { renderDirectory } = require('./renderer-ejs');

// 使用正则匹配所有路径，避免 Express 5/path-to-regexp 的语法问题
router.get(/(.*)/, async (req, res, next) => {
  try {
    const rootDir = req.app.get('rootDir');
    // decodeURIComponent 处理中文路径
    // req.params[0] 包含正则捕获组的内容，如果是根路径可能为 undefined 或空字符串
    const pathname = decodeURIComponent(req.params[0] || '/');
    
    // 安全检查：防止目录穿越
    const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(rootDir, safePath);

    // 确保请求路径在根目录内
    if (!fullPath.startsWith(rootDir)) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }

    const stats = await fs.promises.stat(fullPath);

    if (stats.isDirectory()) {
      // 处理目录
      if (req.query.download === '1') {
        // 目录打包下载
        const dirName = path.basename(fullPath) || 'archive';
        res.attachment(`${dirName}.zip`);
        
        const archive = archiver('zip', { zlib: { level: 9 } });
        
        archive.on('error', err => next(err));
        archive.pipe(res);
        
        archive.directory(fullPath, dirName);
        archive.finalize();
      } else {
        // 检查目录下是否存在 index.html
        const indexPath = path.join(fullPath, 'index.html');
        try {
          const indexStats = await fs.promises.stat(indexPath);
          if (indexStats.isFile()) {
            return res.sendFile(indexPath);
          }
        } catch (e) {
          // index.html 不存在，继续渲染目录
        }

        // 读取目录内容
        const entries = await fs.promises.readdir(fullPath, { withFileTypes: true });
        
        // 并发获取文件详情
        const files = await Promise.all(entries.map(async entry => {
          const entryPath = path.join(fullPath, entry.name);
          try {
            const stat = await fs.promises.stat(entryPath);
            return {
              name: entry.name,
              isDirectory: entry.isDirectory(),
              size: stat.size,
              mtime: stat.mtime,
              ext: entry.isDirectory() ? '' : path.extname(entry.name)
            };
          } catch (e) {
            // 文件可能无法访问，返回默认值
            return {
              name: entry.name,
              isDirectory: entry.isDirectory(),
              size: 0,
              mtime: new Date(),
              ext: entry.isDirectory() ? '' : path.extname(entry.name)
            };
          }
        }));

        // 排序：目录在前，然后按名称排序
        files.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });

        // 渲染页面
        const html = renderDirectory(pathname, files, req.socket.localPort);
        res.send(html);
      }
    } else if (stats.isFile()) {
      // 文件服务：Express sendFile 自动处理 Range, Caching, Content-Type
      res.sendFile(fullPath, { dotfiles: 'allow' });
    } else {
      // 这里的 else 其实很难到达，因为 fs.stat 已经通过了
      next();
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      // 404 Not Found
      const notFoundErr = new Error('Not Found');
      notFoundErr.code = 'ENOENT';
      notFoundErr.statusCode = 404;
      return next(notFoundErr);
    }
    next(err);
  }
});

module.exports = router;
