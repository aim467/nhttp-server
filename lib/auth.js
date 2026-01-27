const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const ejs = require('ejs');
const chalk = require('chalk');

const AUTH_COOKIE_NAME = 'nhttp_auth_token';
const COOKIE_SECRET = 'nhttp-server-secret-key-2024';

/**
 * 创建认证中间件
 * @param {string} authCode - 授权码
 * @returns {express.Router} Express Router
 */
function createAuthMiddleware(authCode) {
    const router = express.Router();

    // 如果未指定授权码，直接放行
    if (!authCode) {
        return (req, res, next) => next();
    }

    // 启用 Cookie 解析
    router.use(cookieParser(COOKIE_SECRET));

    // 解析表单数据
    router.use(express.urlencoded({ extended: false }));

    // 认证检查逻辑
    router.use((req, res, next) => {
        // 允许访问静态资源（如果有的话，目前 login.ejs 使用 CDN）
        // 这里假设 /static 目录下的文件不需要认证（如果是本地服务的话）
        // 但为了安全起见，我们默认拦截所有请求
        
        // 检查 Cookie 中的 Token 是否匹配
        if (req.signedCookies[AUTH_COOKIE_NAME] === authCode) {
            // 已认证
            
            // 如果用户访问登录页面，直接重定向到首页
            if (req.path === '/login') {
                return res.redirect('/');
            }
            
            // 添加登出路由
            if (req.path === '/logout') {
                res.clearCookie(AUTH_COOKIE_NAME);
                return res.redirect('/login');
            }
            
            return next();
        }

        // 未认证

        // 处理登录页面请求
        if (req.path === '/login') {
            if (req.method === 'GET') {
                const templatePath = path.join(__dirname, 'templates', 'login.ejs');
                const template = fs.readFileSync(templatePath, 'utf8');
                const html = ejs.render(template, { 
                    error: null, 
                    redirect: req.query.redirect || '/' 
                });
                return res.send(html);
            }
            //
            if (req.method === 'POST') {
                const { password, redirect } = req.body;
                console.log(chalk.yellow(`[Auth] 登录请求: ${password}, redirect: ${redirect}`));
                console.log(chalk.yellow(`authCode: ${authCode}`));
                if (password == authCode) {
                    console.log(chalk.green(`[Auth] 登录成功: ${password}`));
                    // 认证成功，设置 Cookie
                    // 有效期 7 天，HttpOnly，Signed
                    res.cookie(AUTH_COOKIE_NAME, authCode, { 
                        signed: true,
                        httpOnly: true,
                        maxAge: 7 * 24 * 60 * 60 * 1000,
                        sameSite: 'lax' // 允许从外部链接跳转过来
                    });
                    
                    return res.redirect(redirect || '/');
                } else {
                    // 认证失败
                    const templatePath = path.join(__dirname, 'templates', 'login.ejs');
                    const template = fs.readFileSync(templatePath, 'utf8');
                    const html = ejs.render(template, { 
                        error: '密码错误，请重试', 
                        redirect: redirect || '/' 
                    });
                    return res.send(html);
                }
            }
        }

        // 拦截其他所有请求，重定向到登录页
        const redirectUrl = req.originalUrl;
        return res.redirect(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
    });

    return router;
}

module.exports = createAuthMiddleware;
