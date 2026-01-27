#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const path = require('path');
const { createServer } = require('../lib/server');
const { version } = require('../package.json');

program
  .name('nhttp-server')
  .description('轻量级 Node.js 静态文件服务器')
  .version(version)
  .argument('[directory]', '要服务的目录', process.cwd())
  .option('-p, --port <number>', '指定端口', '8000')
  .option('-d, --directory <path>', '指定根目录')
  .option('-a, --auth <code...>', '指定访问授权码（开启受保护模式）')
  .option('-o, --open', '启动后自动打开浏览器', false)
  .option('--no-browser', '明确不打开浏览器')
  .option('--compress', '启用 gzip/brotli 压缩', false)
  .option('--cors', '启用 CORS', false)
  .action((directory, options) => {
    const rootDir = options.directory || directory;
    const port = parseInt(options.port, 10);
    
    if (isNaN(port) || port < 1 || port > 65535) {
      console.error(chalk.red('❌ 端口必须是 1-65535 之间的数字'));
      process.exit(1);
    }

    const resolvedDir = path.resolve(rootDir);
    
    console.log(chalk.blue('🚀 启动 nhttp-server...'));
    console.log(chalk.gray(`   版本: ${version}`));
    console.log(chalk.gray(`   目录: ${resolvedDir}`));
    console.log(chalk.gray(`   端口: ${port}`));
    
    createServer({
      port,
      rootDir: resolvedDir,
      auth: options.auth,
      open: options.open && options.browser !== false,
      compress: options.compress,
      cors: options.cors
    }).catch(error => {
      console.error(chalk.red('❌ 服务器启动失败:'), error.message);
      process.exit(1);
    });
  });

program.parse();