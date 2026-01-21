const http = require('http');
const chalk = require('chalk');
const { exec } = require('child_process');
const { EJSRouter } = require('./router-ejs');
const { getLocalIPs, logRequest } = require('./utils');
const ErrorHandler = require('./error-handler');

/**
 * 创建并启动 HTTP 服务器
 * @param {Object} options - 服务器配置选项
 * @param {number} options.port - 端口号
 * @param {string} options.rootDir - 根目录
 * @param {boolean} options.open - 是否自动打开浏览器
 * @param {boolean} options.compress - 是否启用压缩
 * @param {boolean} options.cors - 是否启用 CORS
 */
async function createServer(options) {
  const { port, rootDir, open, compress, cors } = options;
  
  const router = new EJSRouter();
  const errorHandler = new ErrorHandler({
    showStackTrace: process.env.NODE_ENV === 'development'
  });
  
  const server = http.createServer((req, res) => {
    try {
      router.handleRequest(req, res, { rootDir, compress, cors });
    } catch (error) {
      errorHandler.handleError(error, req, res);
    }
  });
  
  // 添加请求日志中间件
  server.on('request', (req, res) => {
    const startTime = Date.now();
    const originalEnd = res.end;
    
    res.end = function(...args) {
      const responseTime = Date.now() - startTime;
      const size = res.getHeader('content-length') || 0;
      logRequest(req, res.statusCode, responseTime, size);
      return originalEnd.apply(this, args);
    };
  });

  return new Promise((resolve, reject) => {
    server.listen(port, (err) => {
      if (err) {
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`端口 ${port} 已被占用，请尝试其他端口`));
        } else {
          reject(err);
        }
        return;
      }

      const localIPs = getLocalIPs();
      
      console.log(chalk.green('✅ 服务器启动成功!'));
      console.log();
      console.log(chalk.bold('  本地访问:'));
      console.log(`    ${chalk.cyan(`http://localhost:${port}`)}`);
      console.log(`    ${chalk.cyan(`http://127.0.0.1:${port}`)}`);
      
      if (localIPs.length > 0) {
        console.log(chalk.bold('  网络访问:'));
        localIPs.forEach(ip => {
          console.log(`    ${chalk.cyan(`http://${ip}:${port}`)}`);
        });
      }
      
      console.log();
      console.log(chalk.gray(`  服务目录: ${rootDir}`));
      console.log(chalk.gray('  按 Ctrl+C 停止服务器'));
      console.log();

      if (open) {
        const url = `http://localhost:${port}`;
        console.log(chalk.blue(`🌐 正在打开浏览器: ${url}`));
        
        const command = process.platform === 'win32' ? 'start' : 
                       process.platform === 'darwin' ? 'open' : 'xdg-open';
        
        exec(`${command} ${url}`, (error) => {
          if (error) {
            console.log(chalk.yellow('⚠️  无法自动打开浏览器，请手动访问上述地址'));
          }
        });
      }

      resolve(server);
    });

    // 跟踪所有连接，用于强制关闭
    const connections = new Set();
    
    server.on('connection', (socket) => {
      connections.add(socket);
      socket.on('close', () => {
        connections.delete(socket);
      });
    });

    // 强制关闭函数
    const forceClose = () => {
      console.log(chalk.yellow('\n🛑 正在关闭服务器...'));
      
      // 立即销毁所有连接
      for (const socket of connections) {
        socket.destroy();
      }
      
      server.close(() => {
        console.log(chalk.green('✅ 服务器已关闭'));
        process.exit(0);
      });
      
      // 如果 1 秒内还没关闭，强制退出
      setTimeout(() => {
        console.log(chalk.red('⚠️  强制退出'));
        process.exit(1);
      }, 1000);
    };

    // 信号处理 - 强制关闭
    process.on('SIGINT', forceClose);
    process.on('SIGTERM', forceClose);
  });
}

module.exports = { createServer };
