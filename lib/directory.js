const fs = require('fs');
const path = require('path');
const { formatBytes, formatDate, getFileIcon, getMediaType, getFileCategory } = require('./utils');

/**
 * 将 URL 路径解析为本地文件系统路径，并确保不会逃出根目录
 *
 * 重要：调用方必须传入**已解码**的路径。Express 5 对 req.params 与 req.query
 * 均已做过一次 decodeURIComponent，若此处再解码一次会造成双重解码绕过
 * （实测 /%252e%252e 会被解成 /..）。因此本函数不再解码。
 *
 * URL 路径（如 /foo/bar）经 normalize 后仍为绝对路径形式，与 rootDir 拼接后
 * 必定落在 rootDir 之下；此处再做一次前缀比对作为纵深防御。
 *
 * @param {string} rootDir - 服务器根目录（应为 path.resolve 后的绝对路径）
 * @param {string} pathname - 已解码的 URL 路径
 * @returns {string} 安全的本地绝对路径
 * @throws {Error} 路径非法时抛出 statusCode = 403 的错误
 */
function resolveSafePath(rootDir, pathname) {
  const normalized = path.normalize(pathname || '/').replace(/^(\.\.[\/\\])+/, '');
  const fullPath = path.join(rootDir, normalized);

  // 比较时补上分隔符，避免 /root 与 /root-evil 这类同前缀兄弟目录被误判为合法
  const rootWithSep = rootDir.endsWith(path.sep) ? rootDir : rootDir + path.sep;

  if (fullPath !== rootDir && !fullPath.startsWith(rootWithSep)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }

  return fullPath;
}

/**
 * 读取目录内容并按「目录优先、其次名称」排序
 *
 * 供 EJS 目录渲染与 /api/list 接口共用，保证两条链路的排序与字段完全一致。
 *
 * @param {string} fullPath - 目录的本地绝对路径
 * @returns {Promise<Array<{name:string,isDirectory:boolean,size:number,mtime:Date,ext:string}>>} 目录项列表
 */
async function readDirectory(fullPath) {
  const entries = await fs.promises.readdir(fullPath, { withFileTypes: true });

  // 并发获取文件详情
  const files = await Promise.all(entries.map(async entry => {
    const entryPath = path.join(fullPath, entry.name);
    const ext = entry.isDirectory() ? '' : path.extname(entry.name);
    try {
      const stat = await fs.promises.stat(entryPath);
      return {
        name: entry.name,
        isDirectory: entry.isDirectory(),
        size: stat.size,
        mtime: stat.mtime,
        ext
      };
    } catch (e) {
      // 文件可能无法访问（权限不足、符号链接断裂等），返回默认值而不是让整个目录失败
      return {
        name: entry.name,
        isDirectory: entry.isDirectory(),
        size: 0,
        mtime: new Date(),
        ext
      };
    }
  }));

  // 排序：目录在前，然后按名称排序
  files.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });

  return files;
}

/**
 * 组装目录数据（供 /api/list 返回 JSON）
 *
 * 在原始字段之上补充前端渲染所需的派生字段（链接、格式化尺寸/时间、图标、媒体类型），
 * 这样前端无需再维护一份图标映射表，也不必从 DOM 反解 data-* 属性。
 *
 * @param {string} pathname - 当前 URL 路径
 * @param {Array} files - readDirectory() 返回的原始列表
 * @returns {{path:string,total:number,items:Array}} 目录数据
 */
function buildDirectoryPayload(pathname, files) {
  const items = files.map(file => ({
    name: file.name,
    isDirectory: file.isDirectory,
    size: file.size,
    // Date 经 JSON 序列化后为 ISO 字符串，前端用 new Date(mtime) 还原
    mtime: file.mtime,
    ext: file.ext,
    href: path.posix.join(pathname, file.name),
    formattedSize: file.isDirectory ? '-' : formatBytes(file.size),
    formattedDate: formatDate(file.mtime),
    icon: getFileIcon(file.ext, file.isDirectory),
    mediaType: getMediaType(file.ext),
    category: getFileCategory(file.ext, file.isDirectory)
  }));

  return {
    path: pathname,
    total: items.length,
    items
  };
}

/**
 * 在目录树中按名称 / 类型搜索
 *
 * @param {string} rootDir - 服务器根目录
 * @param {string} startPathname - 起始 URL 路径
 * @param {{query?:string, type?:string, recursive?:boolean, maxDepth?:number, maxResults?:number}} options
 * @returns {Promise<{items:Array, truncated:boolean, scanned:number}>}
 */
async function searchFiles(rootDir, startPathname, options = {}) {
  const query = (options.query || '').trim().toLowerCase();
  const type = (options.type || 'all').toLowerCase();
  const recursive = options.recursive !== false;
  const maxDepth = Math.min(Math.max(Number(options.maxDepth) || 8, 1), 16);
  const maxResults = Math.min(Math.max(Number(options.maxResults) || 200, 1), 500);

  const startFull = resolveSafePath(rootDir, startPathname || '/');
  const items = [];
  let scanned = 0;
  let truncated = false;

  async function walk(dirFull, urlPath, depth) {
    if (truncated || items.length >= maxResults) return;

    let entries;
    try {
      entries = await readDirectory(dirFull);
    } catch (e) {
      return;
    }

    for (const file of entries) {
      if (items.length >= maxResults) {
        truncated = true;
        break;
      }

      scanned += 1;
      const href = path.posix.join(urlPath, file.name);
      const category = getFileCategory(file.ext, file.isDirectory);
      const nameOk = !query || file.name.toLowerCase().includes(query);
      const typeOk = !type || type === 'all' || category === type;

      if (nameOk && typeOk) {
        items.push({
          name: file.name,
          isDirectory: file.isDirectory,
          size: file.size,
          mtime: file.mtime,
          ext: file.ext,
          href,
          parentPath: urlPath,
          formattedSize: file.isDirectory ? '-' : formatBytes(file.size),
          formattedDate: formatDate(file.mtime),
          icon: getFileIcon(file.ext, file.isDirectory),
          mediaType: getMediaType(file.ext),
          category
        });
      }

      if (recursive && file.isDirectory && depth + 1 < maxDepth && items.length < maxResults) {
        await walk(path.join(dirFull, file.name), href, depth + 1);
      }
    }
  }

  await walk(startFull, startPathname === '/' ? '/' : startPathname.replace(/\/$/, '') || '/', 0);

  if (items.length >= maxResults) truncated = true;

  return { items, truncated, scanned };
}

module.exports = {
  resolveSafePath,
  readDirectory,
  buildDirectoryPayload,
  searchFiles
};
