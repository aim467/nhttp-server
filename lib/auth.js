const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const ejs = require('ejs');
const chalk = require('chalk');
const crypto = require('crypto');

const AUTH_COOKIE_NAME = 'nhttp_auth_token';
const COOKIE_SECRET = process.env.NHTTP_COOKIE_SECRET || crypto.randomBytes(32).toString('hex');

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
        // 允许访问静态资源（CSS、JS、字体等），登录页需要这些文件才能正常渲染
        if (req.path.startsWith('/static/')) {
            return next();
        }
        
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
                if (password == authCode) {
                    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
                    res.cookie(AUTH_COOKIE_NAME, authCode, { 
                        signed: true,
                        httpOnly: true,
                        secure: isSecure,
                        maxAge: 7 * 24 * 60 * 60 * 1000,
                        sameSite: 'lax'
                    });
                    
                    return res.redirect(redirect || '/');
                } else {
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
