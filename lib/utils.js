const os = require('os');
const chalk = require('chalk');

/**
 * 格式化字节大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的大小字符串
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
/**
 * 格式化日期
 * @param {Date|string|number} date - 日期对象、字符串或时间戳
 * @returns {string} 格式化后的日期字符串
 */
function formatDate(date) {
  // 确保是 Date 对象
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  
  // 无效日期处理
  if (isNaN(date.getTime())) {
    return '未知日期';
  }
  
  // 统一格式：YYYY-MM-DD HH:mm
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

/**
 * 获取本地 IP 地址
 * @returns {string[]} IP 地址数组
 */
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // 跳过内部地址和 IPv6
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  
  return ips;
}

/**
 * 记录请求日志
 * @param {http.IncomingMessage} req - 请求对象
 * @param {number} statusCode - 状态码
 * @param {number} responseTime - 响应时间（毫秒）
 * @param {number} [size] - 响应大小（字节）
 */
function logRequest(req, statusCode, responseTime, size = 0) {
  const method = req.method;
  const url = req.url;
  const userAgent = req.headers['user-agent'] || '';
  const isBot = /bot|crawler|spider/i.test(userAgent);
  
  // 跳过机器人请求的日志（可选）
  if (isBot && process.env.NODE_ENV !== 'development') {
    return;
  }
  
  let statusColor = chalk.green;
  if (statusCode >= 400) statusColor = chalk.red;
  else if (statusCode >= 300) statusColor = chalk.yellow;
  
  const sizeStr = size > 0 ? formatBytes(size) : '-';
  const timeStr = `${responseTime.toFixed(1)}ms`;
  
  console.log(
    chalk.gray('[') +
    chalk.cyan(method) +
    chalk.gray('] ') +
    chalk.white(url) +
    ' ' +
    statusColor(statusCode) +
    ' ' +
    chalk.gray(timeStr) +
    ' ' +
    chalk.gray(sizeStr)
  );
}

/**
 * 根据文件扩展名获取图标名称
 * @param {string} ext - 文件扩展名
 * @param {boolean} isDirectory - 是否为目录
 * @returns {string} 图标名称
 */
function getFileIcon(ext, isDirectory) {
  if (isDirectory) return 'folder';
  
  const iconMap = {
    // 图片
    '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.gif': 'image',
    '.svg': 'image', '.webp': 'image', '.bmp': 'image', '.ico': 'image',
    
    // 视频
    '.mp4': 'video', '.webm': 'video', '.mov': 'video', '.avi': 'video',
    '.mkv': 'video', '.flv': 'video', '.wmv': 'video',
    
    // 音频
    '.mp3': 'audio', '.wav': 'audio', '.ogg': 'audio', '.m4a': 'audio',
    '.flac': 'audio', '.aac': 'audio',
    
    // 文档
    '.pdf': 'file-text', '.doc': 'file-text', '.docx': 'file-text',
    '.txt': 'file-text', '.md': 'file-text', '.rtf': 'file-text',
    
    // 代码
    '.js': 'code', '.ts': 'code', '.jsx': 'code', '.tsx': 'code',
    '.html': 'code', '.css': 'code', '.scss': 'code', '.less': 'code',
    '.json': 'code', '.xml': 'code', '.yaml': 'code', '.yml': 'code',
    '.py': 'code', '.java': 'code', '.cpp': 'code', '.c': 'code',
    '.go': 'code', '.rs': 'code', '.php': 'code', '.rb': 'code',
    
    // 压缩包
    '.zip': 'archive', '.rar': 'archive', '.7z': 'archive',
    '.tar': 'archive', '.gz': 'archive', '.bz2': 'archive'
  };
  
  return iconMap[ext.toLowerCase()] || 'file';
}

/**
 * 检查文件是否为可预览媒体
 * @param {string} ext - 文件扩展名（含点）
 * @returns {string|null} image|video|audio|pdf 或 null
 */
function getMediaType(ext) {
  const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico'];
  const videoExts = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.flv', '.wmv'];
  const audioExts = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'];
  const pdfExts = ['.pdf'];

  ext = (ext || '').toLowerCase();
  if (ext && ext[0] !== '.') ext = '.' + ext;

  if (imageExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  if (audioExts.includes(ext)) return 'audio';
  if (pdfExts.includes(ext)) return 'pdf';

  return null;
}

const CODE_EXTS = new Set([
  '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.py', '.java', '.c', '.cpp', '.h', '.hpp',
  '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.vue', '.svelte',
  '.html', '.htm', '.css', '.scss', '.less', '.json', '.xml', '.yaml', '.yml',
  '.sh', '.bash', '.zsh', '.sql', '.r', '.lua', '.pl', '.dart'
]);
const TEXT_EXTS = new Set([
  '.txt', '.md', '.markdown', '.log', '.ini', '.conf', '.cfg', '.env', '.gitignore'
]);
const ARCHIVE_EXTS = new Set([
  '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.tgz'
]);

/**
 * 文件分类（用于类型筛选）
 * @param {string} ext - 扩展名（含点）
 * @param {boolean} isDirectory
 * @returns {string} folder|image|video|audio|pdf|code|text|archive|other
 */
function getFileCategory(ext, isDirectory) {
  if (isDirectory) return 'folder';
  const media = getMediaType(ext);
  if (media === 'image') return 'image';
  if (media === 'video') return 'video';
  if (media === 'audio') return 'audio';
  if (media === 'pdf') return 'pdf';

  let e = (ext || '').toLowerCase();
  if (e && e[0] !== '.') e = '.' + e;
  if (CODE_EXTS.has(e)) return 'code';
  if (TEXT_EXTS.has(e)) return 'text';
  if (ARCHIVE_EXTS.has(e)) return 'archive';
  return 'other';
}

module.exports = {
  formatBytes,
  formatDate,
  getLocalIPs,
  logRequest,
  getFileIcon,
  getMediaType,
  getFileCategory
};