const path = require('path');
const fs = require('fs');
const { resolveSafePath } = require('./directory');

/**
 * 校验单层文件/目录名（禁止路径分隔与穿越）
 * @param {string} name
 * @returns {boolean}
 */
function isSafeEntryName(name) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 255) return false;
  if (trimmed === '.' || trimmed === '..') return false;
  if (/[\/\\]/.test(trimmed)) return false;
  if (trimmed.includes('\0')) return false;
  return true;
}

/**
 * 仅认证模式下开放写操作
 */
function requireAuthMode(req, res) {
  if (!req.app.get('authEnabled')) {
    res.status(403).json({
      success: false,
      error: '此功能仅在认证模式下可用'
    });
    return false;
  }
  return true;
}

/**
 * 将 URL 路径规范为以 / 开头的 posix 路径
 */
function normalizeUrlPath(pathname) {
  let p = pathname || '/';
  if (!p.startsWith('/')) p = '/' + p;
  return path.posix.normalize(p).replace(/\\/g, '/');
}

/**
 * 解析目标路径并确保其位于 rootDir 内；返回本地绝对路径
 */
function resolveTarget(rootDir, urlPath) {
  const normalized = normalizeUrlPath(urlPath);
  if (normalized === '/') {
    const err = new Error('不能对根目录执行此操作');
    err.statusCode = 400;
    throw err;
  }
  return { normalized, fullPath: resolveSafePath(rootDir, normalized) };
}

/**
 * 创建目录
 * @param {string} rootDir
 * @param {string} parentPath - 父目录 URL 路径
 * @param {string} name - 新目录名
 */
async function mkdir(rootDir, parentPath, name) {
  if (!isSafeEntryName(name)) {
    const err = new Error('非法的文件夹名称');
    err.statusCode = 400;
    throw err;
  }

  const parentNorm = normalizeUrlPath(parentPath || '/');
  const parentFull = resolveSafePath(rootDir, parentNorm);
  const parentStat = await fs.promises.stat(parentFull);
  if (!parentStat.isDirectory()) {
    const err = new Error('父路径不是目录');
    err.statusCode = 400;
    throw err;
  }

  const targetFull = path.join(parentFull, name.trim());
  // 纵深防御：确保拼接后仍在 root 下
  resolveSafePath(rootDir, path.posix.join(parentNorm, name.trim()));

  if (fs.existsSync(targetFull)) {
    const err = new Error('同名文件或文件夹已存在');
    err.statusCode = 409;
    throw err;
  }

  await fs.promises.mkdir(targetFull);
  return {
    name: name.trim(),
    href: path.posix.join(parentNorm, name.trim())
  };
}

/**
 * 重命名（仅改名称，不跨目录移动）
 * @param {string} rootDir
 * @param {string} urlPath - 原文件/目录 URL 路径
 * @param {string} newName
 */
async function rename(rootDir, urlPath, newName) {
  if (!isSafeEntryName(newName)) {
    const err = new Error('非法的新名称');
    err.statusCode = 400;
    throw err;
  }

  const { normalized, fullPath } = resolveTarget(rootDir, urlPath);
  await fs.promises.stat(fullPath); // ENOENT → 上层处理

  const parentUrl = path.posix.dirname(normalized);
  const destName = newName.trim();
  const destFull = path.join(path.dirname(fullPath), destName);
  const destUrl = parentUrl === '/' ? '/' + destName : path.posix.join(parentUrl, destName);
  resolveSafePath(rootDir, destUrl);

  if (fs.existsSync(destFull)) {
    const err = new Error('目标名称已存在');
    err.statusCode = 409;
    throw err;
  }

  await fs.promises.rename(fullPath, destFull);
  return {
    name: destName,
    href: destUrl,
    oldPath: normalized
  };
}

/**
 * 删除文件或目录（目录递归删除）
 * @param {string} rootDir
 * @param {string} urlPath
 */
async function remove(rootDir, urlPath) {
  const { normalized, fullPath } = resolveTarget(rootDir, urlPath);
  const stat = await fs.promises.stat(fullPath);

  await fs.promises.rm(fullPath, { recursive: true, force: false });
  return {
    path: normalized,
    wasDirectory: stat.isDirectory()
  };
}

module.exports = {
  isSafeEntryName,
  requireAuthMode,
  normalizeUrlPath,
  mkdir,
  rename,
  remove
};
