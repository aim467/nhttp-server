const express = require('express');
const chalk = require('chalk');
const compression = require('compression');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { exec } = require('child_process');
const { getLocalIPs } = require('./utils');
const routes = require('./routes');
const ErrorHandler = require('./error-handler');
const createAuthMiddleware = require('./auth');

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
  const { port, rootDir, open, compress, cors: enableCors } = options;
  
  const app = express();
  
  // 设置全局配置
  app.set('rootDir', rootDir);
  app.set('authEnabled', !!options.auth); // 是否启用了认证模式
  
  // 基础中间件
  // 使用 morgan 记录日志，格式类似原来但更标准
  app.use(morgan(':method :url :status :response-time ms - :res[content-length]'));
  
  if (enableCors) {
    app.use(cors());
  }
  
  if (compress) {
    app.use(compression());
  }
  
  // 认证中间件
  app.use(createAuthMiddleware(options.auth));
  
  // 静态资源服务 (如 styles.css, app.js)
  // 原来的逻辑是 /static/ 开头，这里直接映射
  app.use('/static', express.static(path.join(__dirname, 'static')));
  
  // 核心业务路由
  app.use(routes);
  
  // 错误处理实例
  const errorHandler = new ErrorHandler({
    showStackTrace: process.env.NODE_ENV === 'development'
  });
  
  // 404 处理 (如果没有匹配的路由)
  app.use((req, res, next) => {
    const err = new Error('Not Found');
    err.code = 'ENOENT';
    err.statusCode = 404;
    next(err);
  });

  // 统一错误处理中间件
  app.use((err, req, res, next) => {
    errorHandler.handleError(err, req, res);
  });

  return new Promise((resolve, reject) => {
    const server = app.listen(port, (err) => {
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
      if (options.auth) {
        console.log(chalk.yellow(`  🔒 受保护模式已开启`));
      }
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

    // 优雅关闭逻辑 - 跟踪连接
    const connections = new Set();
    server.on('connection', socket => {
      connections.add(socket);
      socket.on('close', () => connections.delete(socket));
    });

    const forceClose = () => {
      console.log(chalk.yellow('\n🛑 正在关闭服务器...'));
      connections.forEach(socket => socket.destroy());
      server.close(() => {
        console.log(chalk.green('✅ 服务器已关闭'));
        process.exit(0);
      });
      setTimeout(() => {
        console.log(chalk.red('⚠️  强制退出'));
        process.exit(1);
      }, 1000);
    };

    process.on('SIGINT', forceClose);
    process.on('SIGTERM', forceClose);
  });
}

module.exports = { createServer };
