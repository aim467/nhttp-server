const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const multer = require('multer');
const { renderDirectory } = require('./renderer-ejs');
const { resolveSafePath, readDirectory, buildDirectoryPayload, searchFiles } = require('./directory');
const { requireAuthMode, mkdir, rename, remove } = require('./file-ops');
const { isThumbnailable, sendThumbnail } = require('./thumbnails');
const { getMediaType } = require('./utils');

// 配置 multer 存储
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const rootDir = path.resolve(req.app.get('rootDir'));
    const referer = req.get('referer') || req.get('referrer');
    let currentPath = '/';

    if (referer) {
      try {
        const url = new URL(referer);
        currentPath = url.pathname || '/';
      } catch (e) {}
    }

    let uploadPath = req.body.uploadPath || currentPath;

    if (!uploadPath.startsWith('/')) {
      uploadPath = '/' + uploadPath;
    }

    const normalizedUploadPath = path.posix.normalize(uploadPath).replace(/\\/g, '/');
    const normalizedCurrentPath = path.posix.normalize(currentPath).replace(/\\/g, '/');
    const basePath = normalizedCurrentPath.endsWith('/') ? normalizedCurrentPath : normalizedCurrentPath + '/';

    if (!(normalizedUploadPath === normalizedCurrentPath || normalizedUploadPath.startsWith(basePath))) {
      return cb(new Error('非法路径'));
    }

    const safePath = path.normalize(normalizedUploadPath).replace(/^(\.\.[\/\\])+/, '');
    const targetDir = path.resolve(path.join(rootDir, safePath));

    if (!fs.existsSync(targetDir)) {
      return cb(new Error('目标目录不存在'));
    }

    let rootRealPath;
    let targetRealPath;

    try {
      rootRealPath = fs.realpathSync(rootDir);
      targetRealPath = fs.realpathSync(targetDir);
    } catch (e) {
      return cb(e);
    }

    const rootWithSep = rootRealPath.endsWith(path.sep) ? rootRealPath : rootRealPath + path.sep;

    if (!(targetRealPath === rootRealPath || targetRealPath.startsWith(rootWithSep))) {
      return cb(new Error('非法路径'));
    }

    cb(null, targetRealPath);
  },
  filename: function (req, file, cb) {
    // 处理中文文件名
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, originalName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB 限制
  }
});

// 文件上传路由（仅在 auth 模式下可用）
router.post('/upload', (req, res, next) => {
  // 检查是否启用了认证模式
  const authEnabled = req.app.get('authEnabled');
  if (!authEnabled) {
    return res.status(403).json({ 
      success: false, 
      error: '上传功能仅在认证模式下可用' 
    });
  }
  next();
}, upload.array('files', 100), (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: '没有选择文件' 
      });
    }
    
    const uploadedFiles = files.map(f => ({
      name: Buffer.from(f.originalname, 'latin1').toString('utf8'),
      size: f.size,
      path: f.path
    }));
    
    res.json({ 
      success: true, 
      message: `成功上传 ${files.length} 个文件`,
      files: uploadedFiles
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ---------- 文件管理 API（仅认证模式）----------

router.post('/api/mkdir', async (req, res, next) => {
  try {
    if (!requireAuthMode(req, res)) return;
    const parentPath = req.body.path || '/';
    const name = req.body.name;
    const result = await mkdir(req.app.get('rootDir'), parentPath, name);
    res.json({ success: true, message: '文件夹已创建', ...result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    if (err.code === 'ENOENT') {
      return res.status(404).json({ success: false, error: '父目录不存在' });
    }
    if (err.code === 'EEXIST') {
      return res.status(409).json({ success: false, error: '同名文件或文件夹已存在' });
    }
    next(err);
  }
});

router.post('/api/rename', async (req, res, next) => {
  try {
    if (!requireAuthMode(req, res)) return;
    const targetPath = req.body.path;
    const newName = req.body.newName;
    if (!targetPath) {
      return res.status(400).json({ success: false, error: '缺少 path 参数' });
    }
    const result = await rename(req.app.get('rootDir'), targetPath, newName);
    res.json({ success: true, message: '重命名成功', ...result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    if (err.code === 'ENOENT') {
      return res.status(404).json({ success: false, error: '文件或文件夹不存在' });
    }
    if (err.code === 'EEXIST') {
      return res.status(409).json({ success: false, error: '目标名称已存在' });
    }
    next(err);
  }
});

router.post('/api/delete', async (req, res, next) => {
  try {
    if (!requireAuthMode(req, res)) return;
    const targetPath = req.body.path;
    if (!targetPath) {
      return res.status(400).json({ success: false, error: '缺少 path 参数' });
    }
    const result = await remove(req.app.get('rootDir'), targetPath);
    res.json({ success: true, message: '删除成功', ...result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    if (err.code === 'ENOENT') {
      return res.status(404).json({ success: false, error: '文件或文件夹不存在' });
    }
    next(err);
  }
});

// 目录数据接口（JSON），供前端局部刷新使用，避免从 DOM 反解数据
// 必须注册在下面的通配路由 /(.*)/ 之前，否则会被其拦截
router.get('/api/list', async (req, res, next) => {
  try {
    const rootDir = req.app.get('rootDir');

    // 若磁盘上确实存在名为 api/list 的资源，让位给静态文件路由，避免遮蔽真实文件
    if (fs.existsSync(path.join(rootDir, 'api', 'list'))) {
      return next();
    }

    // Express 已对 query 解码，此处不可再解码，否则造成双重解码绕过
    const pathname = req.query.path || '/';
    const fullPath = resolveSafePath(rootDir, pathname);

    const stats = await fs.promises.stat(fullPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({
        success: false,
        error: '指定路径不是目录'
      });
    }

    const files = await readDirectory(fullPath);
    res.json({
      success: true,
      ...buildDirectoryPayload(pathname, files)
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      const notFoundErr = new Error('Not Found');
      notFoundErr.code = 'ENOENT';
      notFoundErr.statusCode = 404;
      return next(notFoundErr);
    }
    next(err);
  }
});

// 递归搜索（名称 + 类型），必须在通配路由之前
router.get('/api/search', async (req, res, next) => {
  try {
    const rootDir = req.app.get('rootDir');

    if (fs.existsSync(path.join(rootDir, 'api', 'search'))) {
      return next();
    }

    const pathname = req.query.path || '/';
    const query = (req.query.q || '').trim();
    const type = (req.query.type || 'all').toLowerCase();
    const recursive = req.query.recursive !== '0' && req.query.recursive !== 'false';

    if (!query && (!type || type === 'all')) {
      return res.status(400).json({
        success: false,
        error: '请提供搜索关键词或类型筛选'
      });
    }

    resolveSafePath(rootDir, pathname);

    const result = await searchFiles(rootDir, pathname, {
      query,
      type,
      recursive,
      maxDepth: parseInt(req.query.depth, 10) || 8,
      maxResults: parseInt(req.query.limit, 10) || 200
    });

    res.json({
      success: true,
      path: pathname,
      query,
      type,
      recursive,
      total: result.items.length,
      truncated: result.truncated,
      scanned: result.scanned,
      items: result.items
    });
  } catch (err) {
    if (err.statusCode === 403) {
      return next(err);
    }
    if (err.code === 'ENOENT') {
      const notFoundErr = new Error('Not Found');
      notFoundErr.code = 'ENOENT';
      notFoundErr.statusCode = 404;
      return next(notFoundErr);
    }
    next(err);
  }
});

// 使用正则匹配所有路径，避免 Express 5/path-to-regexp 的语法问题
router.get(/(.*)/, async (req, res, next) => {
  try {
    const rootDir = req.app.get('rootDir');
    // req.params[0] 包含正则捕获组的内容，如果是根路径可能为 undefined 或空字符串
    // 注意：Express 已对 params 解过码，不可再调 decodeURIComponent，否则双重解码绕过
    const pathname = req.params[0] || '/';

    // 安全检查：防止目录穿越（含前缀比对，避免同前缀兄弟目录被误判为合法）
    const fullPath = resolveSafePath(rootDir, pathname);

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

        // 读取目录内容（与 /api/list 共用同一实现，保证两条链路排序与字段一致）
        const files = await readDirectory(fullPath);

        // 渲染页面
        const authEnabled = req.app.get('authEnabled');
        const html = renderDirectory(pathname, files, req.socket.localPort, authEnabled);
        res.send(html);
      }
    } else if (stats.isFile()) {
      // 缩略图：?thumb=1 走缓存缩放图，减轻网格视图带宽
      const ext = path.extname(fullPath);
      if (req.query.thumb === '1' && getMediaType(ext) === 'image' && isThumbnailable(ext)) {
        return sendThumbnail(fullPath, res, next);
      }

      // 强制下载（二维码分享「下载」模式）
      if (req.query.download === '1') {
        return res.download(fullPath);
      }

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
