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
        :root {
            --explorer-bg: #f5f5f7;
            --explorer-header-bg: #f9fafb;
            --explorer-border: #e5e5ea;
            --explorer-hover: #ffffff;
            --explorer-selected: #e5f0ff;
            --explorer-text: #111827;
            --explorer-text-secondary: #6b7280;
            --explorer-accent: #0a84ff;
            --radius-card: 8px;
            --radius-control: 6px;
        }
        
        [data-theme="dark"] {
            --explorer-bg: #000000;
            --explorer-header-bg: #050509;
            --explorer-border: #2c2c2e;
            --explorer-hover: #1c1c1e;
            --explorer-selected: #0a84ff;
            --explorer-text: #f2f2f7;
            --explorer-text-secondary: #8e8e93;
            --explorer-accent: #0a84ff;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", sans-serif;
            background: var(--explorer-bg);
            color: var(--explorer-text);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .error-container {
            background: var(--explorer-hover);
            border: 1px solid var(--explorer-border);
            border-radius: var(--radius-card);
            padding: 48px 32px;
            max-width: 420px;
            width: 100%;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }
        
        [data-theme="dark"] .error-container {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }
        
        .error-icon {
            font-size: 48px;
            margin-bottom: 16px;
            opacity: 0.6;
        }
        
        .error-code {
            font-size: 64px;
            font-weight: 700;
            line-height: 1;
            margin-bottom: 8px;
            letter-spacing: -2px;
            color: var(--explorer-text);
        }
        
        .error-title {
            font-size: 18px;
            font-weight: 600;
            color: var(--explorer-text);
            margin-bottom: 8px;
        }
        
        .error-message {
            font-size: 14px;
            color: var(--explorer-text-secondary);
            margin-bottom: 24px;
            line-height: 1.5;
        }
        
        .action-buttons {
            display: flex;
            gap: 8px;
            justify-content: center;
            flex-wrap: wrap;
        }
        
        .btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 16px;
            font-size: 13px;
            font-weight: 500;
            border-radius: var(--radius-control);
            border: 1px solid var(--explorer-border);
            cursor: pointer;
            text-decoration: none;
            transition: all 0.15s ease;
            background: var(--explorer-bg);
            color: var(--explorer-text);
        }
        
        .btn:hover {
            background: var(--explorer-hover);
            border-color: var(--explorer-accent);
        }
        
        .btn-primary {
            background: var(--explorer-accent);
            color: #ffffff;
            border-color: var(--explorer-accent);
        }
        
        .btn-primary:hover {
            background: #0080ff;
            border-color: #0080ff;
        }
        
        .btn-icon {
            width: 14px;
            height: 14px;
        }
        
        .error-details {
            background: var(--explorer-bg);
            border: 1px solid var(--explorer-border);
            border-left: 3px solid var(--explorer-accent);
            padding: 12px;
            margin: 20px 0;
            border-radius: var(--radius-control);
            text-align: left;
            font-family: "Consolas", "Monaco", "Courier New", monospace;
            font-size: 12px;
            white-space: pre-wrap;
            word-break: break-all;
            color: var(--explorer-text-secondary);
            max-height: 150px;
            overflow-y: auto;
        }
        
        @media (max-width: 480px) {
            .error-container {
                padding: 32px 24px;
            }
            
            .error-code {
                font-size: 48px;
            }
            
            .btn {
                flex: 1;
                justify-content: center;
            }
        }
    </style>
</head>
<body>
    <div class="error-container">
        <div class="error-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
        </div>
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
            <button class="btn btn-primary" onclick="window.history.back()">
                <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
                返回
            </button>
            <button class="btn" onclick="window.location.href='/'">
                <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                </svg>
                首页
            </button>
            <button class="btn" onclick="window.location.reload()">
                <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                刷新
            </button>
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
