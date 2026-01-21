const chalk = require('chalk');
const { logRequest } = require('./utils');

/**
 * 错误处理中间件
 */
class ErrorHandler {
    constructor(options = {}) {
        this.options = {
            logErrors: true,
            showStackTrace: process.env.NODE_ENV === 'development',
            ...options
        };
    }

    /**
     * 处理错误
     */
    handleError(error, req, res) {
        const statusCode = this.getStatusCode(error);
        const errorMessage = this.getErrorMessage(error);
        
        // 记录错误日志
        if (this.options.logErrors) {
            this.logError(error, req, statusCode);
        }

        // 发送错误响应
        this.sendErrorResponse(error, req, res, statusCode, errorMessage);
    }

    /**
     * 获取HTTP状态码
     */
    getStatusCode(error) {
        if (error.statusCode) {
            return error.statusCode;
        }
        
        if (error.code === 'ENOENT') {
            return 404;
        }
        
        if (error.code === 'EACCES') {
            return 403;
        }
        
        return 500;
    }

    /**
     * 获取错误消息
     */
    getErrorMessage(error) {
        const statusCode = this.getStatusCode(error);
        
        switch (statusCode) {
            case 400:
                return error.message || '错误的请求';
            case 403:
                return '没有权限访问此资源';
            case 404:
                return '文件或目录不存在';
            case 500:
                return '服务器内部错误';
            default:
                return error.message || '未知错误';
        }
    }

    /**
     * 记录错误日志
     */
    logError(error, req, statusCode) {
        const timestamp = new Date().toISOString();
        const method = req.method;
        const url = req.url;
        const userAgent = req.headers['user-agent'] || '';
        const referer = req.headers['referer'] || '';
        
        // 错误日志格式
        const errorLog = [
            chalk.red('🚨 错误发生:'),
            chalk.gray(`时间: ${timestamp}`),
            chalk.gray(`方法: ${method}`),
            chalk.gray(`URL: ${url}`),
            chalk.gray(`状态码: ${statusCode}`),
            chalk.gray(`错误信息: ${error.message}`),
            chalk.gray(`用户代理: ${userAgent}`),
            chalk.gray(`来源: ${referer}`)
        ].join('\n  ');

        console.error('\n' + errorLog + '\n');

        // 记录堆栈跟踪（仅在开发环境）
        if (this.options.showStackTrace && error.stack) {
            console.error(chalk.gray('堆栈跟踪:'));
            console.error(chalk.gray(error.stack));
            console.error('');
        }

        // 同时记录到请求日志
        logRequest(req, statusCode, 0, 0);
    }

    /**
     * 发送错误响应
     */
    sendErrorResponse(error, req, res, statusCode, errorMessage) {
        // 设置响应头
        res.statusCode = statusCode;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        
        // 根据请求的Accept头决定响应格式
        const accept = req.headers['accept'] || '';
        
        if (accept.includes('application/json')) {
            this.sendJsonError(res, statusCode, errorMessage, error);
        } else {
            this.sendHtmlError(res, statusCode, errorMessage, error);
        }
    }

    /**
     * 发送JSON格式错误响应
     */
    sendJsonError(res, statusCode, errorMessage, error) {
        const response = {
            error: {
                code: statusCode,
                message: errorMessage,
                timestamp: new Date().toISOString()
            }
        };

        // 开发环境下包含更多信息
        if (this.options.showStackTrace) {
            response.error.stack = error.stack;
        }

        res.end(JSON.stringify(response, null, 2));
    }

    /**
     * 发送HTML格式错误响应
     */
    sendHtmlError(res, statusCode, errorMessage, error) {
        const title = this.getErrorTitle(statusCode);
        const showDetails = this.options.showStackTrace;
        
        const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${statusCode} - ${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .error-container {
            background: white;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            margin-top: 50px;
        }
        .error-code {
            font-size: 4rem;
            font-weight: bold;
            color: #e74c3c;
            margin: 0;
        }
        .error-title {
            font-size: 1.5rem;
            color: #2c3e50;
            margin: 10px 0;
        }
        .error-message {
            color: #7f8c8d;
            margin: 20px 0;
            font-size: 1.1rem;
        }
        .error-details {
            background: #f8f9fa;
            border-left: 4px solid #e74c3c;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
            font-family: monospace;
            white-space: pre-wrap;
            word-break: break-all;
        }
        .action-buttons {
            margin-top: 30px;
        }
        .btn {
            display: inline-block;
            padding: 10px 20px;
            background: #3498db;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin-right: 10px;
            border: none;
            cursor: pointer;
            font-size: 14px;
        }
        .btn:hover {
            background: #2980b9;
        }
        .btn-secondary {
            background: #95a5a6;
        }
        .btn-secondary:hover {
            background: #7f8c8d;
        }
    </style>
</head>
<body>
    <div class="error-container">
        <h1 class="error-code">${statusCode}</h1>
        <h2 class="error-title">${title}</h2>
        <p class="error-message">${errorMessage}</p>
        
        ${showDetails ? `
        <div class="error-details">
            <strong>错误详情:</strong><br>
            ${error.message || '无详细错误信息'}
            ${error.stack ? `<br><br><strong>堆栈跟踪:</strong><br>${this.escapeHtml(error.stack)}` : ''}
        </div>
        ` : ''}
        
        <div class="action-buttons">
            <button class="btn" onclick="window.history.back()">返回上一页</button>
            <button class="btn btn-secondary" onclick="window.location.href='/'">返回首页</button>
            <button class="btn" onclick="window.location.reload()">刷新页面</button>
        </div>
    </div>
</body>
</html>`;

        res.end(html);
    }

    /**
     * 获取错误标题
     */
    getErrorTitle(statusCode) {
        const titles = {
            400: '错误的请求',
            403: '禁止访问',
            404: '页面未找到',
            500: '服务器错误',
            502: '错误的网关',
            503: '服务不可用'
        };
        
        return titles[statusCode] || '错误';
    }

    /**
     * HTML转义
     */
    escapeHtml(text) {
        return text
            .replace(/&/g, '&')
            .replace(/</g, '<')
            .replace(/>/g, '>')
            .replace(/"/g, '"')
            .replace(/'/g, '&#039;');
    }

}

module.exports = ErrorHandler;
