const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const THUMB_SIZE = 240;
const CACHE_DIR = path.join(os.tmpdir(), 'nhttp-thumbs');

let sharp = null;
try {
  sharp = require('sharp');
} catch (e) {
  sharp = null;
}

const IMAGE_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tif', '.tiff'
]);

// SVG / ICO 本身很小或格式特殊，直接回退原图
const PASSTHROUGH_EXTS = new Set(['.svg', '.ico']);

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * 根据源文件绝对路径 + mtime + size 生成缓存键
 */
function cacheKey(fullPath, stat) {
  const raw = `${fullPath}|${stat.mtimeMs}|${stat.size}|${THUMB_SIZE}`;
  return crypto.createHash('sha1').update(raw).digest('hex');
}

function cachePath(key) {
  return path.join(CACHE_DIR, `${key}.jpg`);
}

/**
 * 判断扩展名是否支持缩略图生成
 * @param {string} ext
 * @returns {boolean}
 */
function isThumbnailable(ext) {
  const e = (ext || '').toLowerCase();
  return IMAGE_EXTS.has(e) || PASSTHROUGH_EXTS.has(e);
}

/**
 * 生成或读取缓存的缩略图，写入响应
 * @param {string} fullPath - 源文件绝对路径
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function sendThumbnail(fullPath, res, next) {
  try {
    const ext = path.extname(fullPath).toLowerCase();
    const stat = await fs.promises.stat(fullPath);

    // 透传小图 / 特殊格式
    if (PASSTHROUGH_EXTS.has(ext) || !sharp || !IMAGE_EXTS.has(ext)) {
      return res.sendFile(fullPath, {
        maxAge: '1d',
        headers: { 'Cache-Control': 'public, max-age=86400' }
      });
    }

    // 小于 80KB 的图直接当缩略图，避免重复编码
    if (stat.size < 80 * 1024) {
      return res.sendFile(fullPath, {
        maxAge: '1d',
        headers: { 'Cache-Control': 'public, max-age=86400' }
      });
    }

    ensureCacheDir();
    const key = cacheKey(fullPath, stat);
    const outPath = cachePath(key);

    if (!fs.existsSync(outPath)) {
      await sharp(fullPath)
        .rotate()
        .resize(THUMB_SIZE, THUMB_SIZE, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 72, mozjpeg: true })
        .toFile(outPath);
    }

    res.type('image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.sendFile(outPath);
  } catch (err) {
    // 缩略图失败时回退原图，避免网格空白
    try {
      return res.sendFile(fullPath, {
        maxAge: '1d',
        headers: { 'Cache-Control': 'public, max-age=86400' }
      });
    } catch (e) {
      next(err);
    }
  }
}

module.exports = {
  isThumbnailable,
  sendThumbnail,
  THUMB_SIZE,
  CACHE_DIR
};
