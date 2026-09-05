const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const os = require('os');
const { formatBytes, formatDate, getFileIcon, getMediaType, getFileCategory } = require('./utils');

/**
 * 获取服务器的内网 IP 地址
 * 优先返回 192.168.x.x 或 10.x.x.x 等内网地址
 */
function getServerIPs() {
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
 * 基于 EJS 的渲染器 - 模板和代码分离版本
 */
class EJSRenderer {
  constructor() {
    this.templateCache = new Map();
    this.templatesDir = path.join(__dirname, 'templates');
    
    // EJS 配置
    this.ejsOptions = {
      cache: true,
      filename: 'directory.ejs',
      rmWhitespace: true
    };
  }

  /**
   * 加载模板文件
   * @param {string} templateName - 模板名称
   * @returns {Function} 编译后的模板函数
   */
  loadTemplate(templateName) {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName);
    }

    const templatePath = path.join(this.templatesDir, templateName);
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`模板文件不存在: ${templatePath}`);
    }

    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const compiledTemplate = ejs.compile(templateContent, {
      ...this.ejsOptions,
      filename: templatePath
    });

    this.templateCache.set(templateName, compiledTemplate);
    return compiledTemplate;
  }

  /**
   * 渲染目录页面
   * @param {string} pathname - 当前路径
   * @param {Array} files - 文件列表
   * @param {number} port - 服务器端口
   * @param {boolean} authEnabled - 是否启用认证模式
   * @returns {string} HTML 字符串
   */
  renderDirectory(pathname, files, port = 3000, authEnabled = false) {
    const title = pathname === '/' ? '根目录' : pathname;
    const parentPath = pathname === '/' ? null : path.dirname(pathname);
    // 生成面包屑导航
    const breadcrumb = this.generateBreadcrumb(pathname);
    
    // 处理文件列表
    const fileItems = files.map(file => {
      const icon = getFileIcon(file.ext, file.isDirectory);
      const mediaType = getMediaType(file.ext);
      const category = getFileCategory(file.ext, file.isDirectory);
      const href = path.posix.join(pathname, file.name);
      // 获取文件图标 emoji
      const iconEmoji = this.getIconEmoji(file.ext, file.isDirectory);
      return {
        ...file,
        icon,
        iconEmoji,
        mediaType,
        category,
        href,
        thumbHref: mediaType === 'image' ? href + '?thumb=1' : null,
        formattedSize: file.isDirectory ? '-' : formatBytes(file.size),
        formattedDate: formatDate(file.mtime),
      };
    });

    // 加载并渲染模板
    const template = this.loadTemplate('directory.ejs');
    
    // 获取服务器内网 IP 用于二维码分享
    const serverIPs = getServerIPs();
    
    return template({
      title,
      pathname,
      parentPath,
      breadcrumb,
      fileItems,
      totalFiles: files.length,
      serverIPs,
      currentPort: port,
      authEnabled
    });
  }

  /**
   * 生成面包屑导航
   * @param {string} pathname - 当前路径
   * @returns {string} HTML 面包屑
   */
  generateBreadcrumb(pathname) {
    if (pathname === '/') {
      return '<a href="/">根目录</a>';
    }

    const parts = pathname.split('/').filter(Boolean);
    let breadcrumb = '<a href="/">根目录</a>';
    let currentPath = '';

    parts.forEach((part, index) => {
      currentPath += '/' + part;
      if (index === parts.length - 1) {
        breadcrumb += ` / <span class="current">${part}</span>`;
      } else {
        breadcrumb += ` / <a href="${currentPath}">${part}</a>`;
      }
    });

    return breadcrumb;
  }

  /**
   * 获取文件图标 emoji
   * @param {string} ext - 文件扩展名
   * @param {boolean} isDirectory - 是否为目录
   * @returns {string} emoji 图标
   */
  getIconEmoji(ext, isDirectory) {
    if (isDirectory) return '📁';
    
    const iconMap = {
      // 图片
      '.png': '🖼️', '.jpg': '🖼️', '.jpeg': '🖼️', '.gif': '🖼️', 
      '.svg': '🖼️', '.webp': '🖼️', '.bmp': '🖼️', '.ico': '🖼️',
      
      // 视频
      '.mp4': '🎬', '.avi': '🎬', '.mov': '🎬', '.wmv': '🎬',
      '.flv': '🎬', '.webm': '🎬', '.mkv': '🎬',
      
      // 音频
      '.mp3': '🎵', '.wav': '🎵', '.flac': '🎵', '.aac': '🎵',
      '.ogg': '🎵', '.wma': '🎵',
      
      // 文档
      '.pdf': '📄', '.doc': '📄', '.docx': '📄', '.txt': '📄',
      '.rtf': '📄', '.odt': '📄',
      
      // 表格
      '.xls': '📊', '.xlsx': '📊', '.csv': '📊', '.ods': '📊',
      
      // 演示文稿
      '.ppt': '📊', '.pptx': '📊', '.odp': '📊',
      
      // 代码
      '.js': '📜', '.ts': '📜', '.html': '📜', '.css': '📜',
      '.json': '📜', '.xml': '📜', '.py': '📜', '.java': '📜',
      '.cpp': '📜', '.c': '📜', '.php': '📜', '.rb': '📜',
      '.go': '📜', '.rs': '📜', '.swift': '📜', '.kt': '📜',
      
      // 压缩包
      '.zip': '📦', '.rar': '📦', '.7z': '📦', '.tar': '📦',
      '.gz': '📦', '.bz2': '📦', '.xz': '📦',
      
      // 可执行文件
      '.exe': '⚙️', '.msi': '⚙️', '.deb': '⚙️', '.rpm': '⚙️',
      '.dmg': '⚙️', '.pkg': '⚙️', '.app': '⚙️'
    };

    return iconMap[ext.toLowerCase()] || '📄';
  }

  /**
   * 清除模板缓存
   */
  clearCache() {
    this.templateCache.clear();
  }

  /**
   * 设置开发模式（禁用缓存）
   * @param {boolean} isDev - 是否为开发模式
   */
  setDevelopmentMode(isDev) {
    if (isDev) {
      this.ejsOptions.cache = false;
      this.clearCache();
    } else {
      this.ejsOptions.cache = true;
    }
  }
}

// 创建单例实例
const renderer = new EJSRenderer();

/**
 * 渲染目录页面（兼容接口）
 * @param {string} pathname - 当前路径
 * @param {Array} files - 文件列表
 * @param {number} port - 服务器端口
 * @param {boolean} authEnabled - 是否启用认证模式
 * @returns {string} HTML 字符串
 */
function renderDirectory(pathname, files, port = 3000, authEnabled = false) {
  return renderer.renderDirectory(pathname, files, port, authEnabled);
}

module.exports = {
  EJSRenderer,
  renderDirectory,
  renderer
};