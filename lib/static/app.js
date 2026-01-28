// 主入口文件 - 加载所有模块
// 依赖顺序：explorer -> preview -> upload

// ============ 全局初始化 ============

document.addEventListener('DOMContentLoaded', function() {
    // 初始化文件浏览器
    window.windowsExplorer = new WindowsExplorer();
    window.explorerInstance = window.windowsExplorer;
    
    // 显示快捷键提示
    const shortcutsToast = document.getElementById('shortcutsToast');
    if (shortcutsToast) {
        setTimeout(() => {
            const toast = new bootstrap.Toast(shortcutsToast);
            toast.show();
        }, 1500);
    }
    
    // 初始化文件上传器
    if (typeof FileUploader !== 'undefined') {
        window.fileUploader = new FileUploader();
    }
});

// 全局错误处理
window.addEventListener('error', function(e) {
    console.error('应用错误:', e.error);
    if (window.windowsExplorer) {
        window.windowsExplorer.showToast('错误', '应用遇到了一个错误', 'danger');
    }
});

// ============ 全局函数 - 供模板调用 ============

// 文件预览功能
window.previewFile = function(href, mediaType, name) {
    // 获取文件信息
    const fileItem = document.querySelector(`[data-href="${href}"]`);
    const size = fileItem?.dataset.size || '-';
    const date = fileItem?.dataset.date || '-';
    
    // 文本文件使用浮窗预览
    if (!mediaType || mediaType === 'text' || isTextFile(name)) {
        openFilePreview(href, name, size, date);
    } else if (mediaType === 'image') {
        // 图片使用 Viewer.js
        const img = document.querySelector(`[data-viewer-image="${href}"]`)?.querySelector('.viewer-image');
        if (img) {
            const fileList = document.getElementById('fileList');
            const viewer = new Viewer(fileList);
            const index = Array.from(fileList.querySelectorAll('.viewer-image')).indexOf(img);
            viewer.view(index);
        }
    } else if (mediaType === 'video') {
        showVideoWithXGPlayer(href, name);
    } else if (mediaType === 'audio') {
        showMediaPreview(href, mediaType, name);
    } else {
        // 其他类型尝试浮窗预览
        openFilePreview(href, name, size, date);
    }
};

// 文件下载功能
window.downloadFile = function(href, name) {
    const link = document.createElement('a');
    link.href = href;
    link.download = name;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if (window.windowsExplorer) {
        window.windowsExplorer.showToast('开始下载', `正在下载 ${name}`);
    }
};

// 分享文件
window.shareFileQr = function(href, name) {
    if (window.explorerInstance) {
        window.explorerInstance.shareFile(href, name);
    }
};

// 判断是否为文本文件（供 previewFile 使用）
function isTextFile(filename) {
    const textExtensions = [
        'txt', 'md', 'json', 'xml', 'html', 'htm', 'css', 'js', 'ts', 'jsx', 'tsx',
        'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'rb', 'php', 'swift', 'kt',
        'vue', 'svelte', 'ini', 'conf', 'log', 'sql', 'sh', 'bash', 'zsh', 'yaml', 'yml',
        'r', 'lua', 'perl', 'pl', 'dart', 'ex', 'exs', 'elm', 'clj', 'scm', 'lisp'
    ];
    const ext = filename.split('.').pop().toLowerCase();
    return textExtensions.includes(ext);
}