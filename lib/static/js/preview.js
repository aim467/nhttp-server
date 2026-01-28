// ============ 文件预览功能 ============

// 全局变量用于存储当前播放器实例
let currentXGPlayer = null;

// 文件预览状态管理
const filePreviewState = {
    currentHref: null,
    currentName: null,
    currentEncoding: 'auto',
    isWrapped: true,
    content: null,
    detectedEncoding: null
};

// 媒体预览功能
function showMediaPreview(href, mediaType, fileName) {
    const modalElement = document.getElementById('mediaModal');
    if (!modalElement) return;

    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
    const modalBody = document.getElementById('modalBody');
    const modalLabel = document.getElementById('mediaModalLabel');
    
    if (modalLabel) {
        modalLabel.textContent = fileName;
    }
    
    if (mediaType === 'image') {
        modalBody.innerHTML = `<img src="${href}" alt="${fileName}" class="img-fluid">`;
        modal.show();
    } else if (mediaType === 'video') {
        // 使用 XGPlayer 播放视频
        showVideoWithXGPlayer(href, fileName);
    } else if (mediaType === 'audio') {
        modalBody.innerHTML = `<div class="text-center p-4">
                     <i class="bi bi-music-note-beamed display-1 text-info mb-3"></i>
                     <h5 class="text-white mb-3">${fileName}</h5>
                     <audio controls class="w-100">
                       <source src="${href}">
                       您的浏览器不支持音频播放。
                     </audio>
                   </div>`;
        modal.show();
    }
}

// XGPlayer 视频播放函数
function showVideoWithXGPlayer(videoUrl, fileName) {
    const modalElement = document.getElementById('mediaModal');
    const modalBody = document.getElementById('modalBody');
    const xgPlayerContainer = document.getElementById('xgPlayerContainer');
    const modalLabel = document.getElementById('mediaModalLabel');
    
    if (!modalElement || !modalBody || !xgPlayerContainer) return;
    
    // 清理之前的内容
    modalBody.innerHTML = '';
    modalBody.appendChild(xgPlayerContainer);
    xgPlayerContainer.style.display = 'block';
    xgPlayerContainer.innerHTML = '';
    
    // 设置模态框标题
    if (modalLabel) {
        modalLabel.textContent = fileName;
    }
    
    // 销毁之前的播放器实例
    if (currentXGPlayer) {
        try {
            currentXGPlayer.destroy();
        } catch (e) {
            console.warn('销毁播放器时出错:', e);
        }
        currentXGPlayer = null;
    }
    
    // 检查 XGPlayer 是否可用
    if (typeof Player === 'undefined') {
        console.error('XGPlayer 未加载');
        modalBody.innerHTML = `<div class="text-center p-4">
            <p class="text-danger">视频播放器加载失败，请刷新页面重试</p>
            <video controls class="w-100" style="max-height: 70vh;">
                <source src="${videoUrl}">
                您的浏览器不支持视频播放。
            </video>
        </div>`;
        const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
        modal.show();
        return;
    }
    
    try {
        // 创建新的 XGPlayer 实例
        currentXGPlayer = new Player({
            id: 'xgPlayerContainer',
            url: videoUrl,
            width: '100%',
            height: '500px',
            autoplay: false,
            volume: 0.8,
            poster: '',
            playsinline: true,
            fluid: true,
            videoInit: true,
            controls: {
                mode: 'normal'
            },
            // 添加更多配置选项
            lang: 'zh-cn',
            pip: true,
            screenShot: true,
            rotate: true,
            plugins: []
        });
        
        // 显示模态框
        const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
        modal.show();
        
        // 监听模态框关闭事件，销毁播放器
        modalElement.addEventListener('hidden.bs.modal', function() {
            if (currentXGPlayer) {
                try {
                    currentXGPlayer.destroy();
                } catch (e) {
                    console.warn('销毁播放器时出错:', e);
                }
                currentXGPlayer = null;
            }
            xgPlayerContainer.style.display = 'none';
            xgPlayerContainer.innerHTML = '';
        }, { once: true });
        
    } catch (error) {
        console.error('创建 XGPlayer 实例时出错:', error);
        // 降级到原生 video 标签
        modalBody.innerHTML = `<div class="text-center p-4">
            <p class="text-warning mb-3">使用备用播放器</p>
            <video controls class="w-100" style="max-height: 70vh;">
                <source src="${videoUrl}">
                您的浏览器不支持视频播放。
            </video>
        </div>`;
        const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
        modal.show();
    }
}

// 打开文件预览浮窗
function openFilePreview(href, name, size, date) {
    const popup = document.getElementById('filePreviewPopup');
    const overlay = document.getElementById('previewOverlay');
    
    if (!popup || !overlay) return;
    
    // 保存状态
    filePreviewState.currentHref = href;
    filePreviewState.currentName = name;
    filePreviewState.currentEncoding = 'auto';
    filePreviewState.isWrapped = true;
    filePreviewState.content = null;
    filePreviewState.detectedEncoding = null;
    
    // 更新标题和信息
    document.getElementById('previewFileName').textContent = name;
    document.getElementById('previewFileSize').innerHTML = `<i class="bi bi-hdd me-1"></i>${size || '-'}`;
    document.getElementById('previewFileDate').innerHTML = `<i class="bi bi-calendar me-1"></i>${date || '-'}`;
    document.getElementById('previewFileEncoding').innerHTML = `<i class="bi bi-keyboard me-1"></i>检测中...`;
    
    // 根据扩展名判断文件类型
    const ext = name.split('.').pop().toLowerCase();
    const typeInfo = getFileTypeInfo(ext);
    document.getElementById('previewFileType').innerHTML = `<i class="bi bi-file-earmark me-1"></i>${typeInfo}`;
    
    // 重置控件状态
    document.getElementById('encodingSelect').value = 'auto';
    document.getElementById('previewLineCount').textContent = '0 行';
    
    // 显示加载状态
    document.getElementById('previewContent').innerHTML = `
        <div class="text-center text-muted p-4">
            <div class="spinner-border spinner-border-sm me-2" role="status"></div>
            <span>加载中...</span>
        </div>
    `;
    
    document.getElementById('previewStatus').innerHTML = '';
    
    // 显示浮窗和遮罩
    popup.style.display = 'flex';
    overlay.style.display = 'block';
    
    // 禁止背景滚动
    document.body.style.overflow = 'hidden';
    
    // 加载文件内容
    loadFileContent(href);
}

// 加载文件内容
async function loadFileContent(href, encoding = 'auto') {
    try {
        const response = await fetch(href);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const blob = await response.blob();
        const fileSize = blob.size;
        
        // 检查文件大小
        const MAX_PREVIEW_SIZE = 5 * 1024 * 1024; // 5MB
        if (fileSize > MAX_PREVIEW_SIZE) {
            showPreviewError('文件过大', `文件大小 ${formatFileSize(fileSize)} 超过预览限制 (5MB)。请下载后查看。`);
            return;
        }
        
        // 获取文本内容
        const arrayBuffer = await blob.arrayBuffer();
        
        // 检测编码
        let detectedEncoding = encoding;
        if (encoding === 'auto') {
            detectedEncoding = detectEncoding(arrayBuffer);
            filePreviewState.detectedEncoding = detectedEncoding;
        }
        

        // 解码文本
        const decoder = new TextDecoder(detectedEncoding);
        let content = decoder.decode(arrayBuffer, { stream: false });
        
        // 处理二进制数据导致的乱码
        if (containsBinary(content)) {
            if (detectedEncoding !== 'UTF-8') {
                // 尝试 UTF-8
                try {
                    const utf8Content = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer);
                    if (!containsBinary(utf8Content)) {
                        content = utf8Content;
                        detectedEncoding = 'UTF-8';
                        filePreviewState.detectedEncoding = 'UTF-8';
                    }
                } catch (e) {
                    console.warn('UTF-8 解码失败:', e);
                }
            }
            
            if (containsBinary(content)) {
                showPreviewError('无法预览', '文件可能包含二进制数据，无法以文本形式显示。');
                return;
            }
        }
        
        filePreviewState.content = content;
        filePreviewState.currentEncoding = detectedEncoding;
        
        // 更新编码显示
        document.getElementById('previewFileEncoding').innerHTML = 
            `<i class="bi bi-keyboard me-1"></i>${detectedEncoding}`;
        
        // 渲染内容
        renderPreviewContent(content, fileSize);
        
    } catch (error) {
        console.error('加载文件失败:', error);
        showPreviewError('加载失败', error.message);
    }
}

// 检测编码
function detectEncoding(arrayBuffer) {
    // BOM 检测
    const view = new Uint8Array(arrayBuffer);
    
    // UTF-8 BOM
    if (view.length >= 3 && view[0] === 0xEF && view[1] === 0xBB && view[2] === 0xBF) {
        return 'UTF-8';
    }
    
    // UTF-16 LE BOM
    if (view.length >= 2 && view[0] === 0xFF && view[1] === 0xFE) {
        return 'UTF-16LE';
    }
    
    // UTF-16 BE BOM
    if (view.length >= 2 && view[0] === 0xFE && view[1] === 0xFF) {
        return 'UTF-16BE';
    }
    
    // 简单的字节序列分析
    const encodingProba = analyzeEncodingProba(view);
    return encodingProba;
}

// 分析字节序列，推测编码
function analyzeEncodingProba(view) {
    let invalidUtf8Sequence = 0;
    let validUtf8Sequence = 0;
    let hasHighBytes = false;
    let likelyUtf8 = true;
    
    for (let i = 0; i < view.length; i++) {
        const byte = view[i];
        
        if (byte >= 0x80) {
            hasHighBytes = true;
            
            // 检查是否是有效的 UTF-8 起始字节和 continuation 字节
            if ((byte & 0xC0) === 0x80) {
                // Continuation byte，不单独计数，在后面验证
                continue;
            }
            
            // 分析 UTF-8 多字节序列
            let expectedContinuation = 0;
            let isValidStart = true;
            
            if ((byte & 0xE0) === 0xC0) {
                // 2字节序列: 110xxxxx 10xxxxxx
                expectedContinuation = 1;
                // 检查字节范围
                if (byte > 0xDF) isValidStart = false;
            } else if ((byte & 0xF0) === 0xE0) {
                // 3字节序列: 1110xxxx 10xxxxxx 10xxxxxx
                expectedContinuation = 2;
                // 检查特殊情况
                if (byte === 0xE0) {
                    // 0xE0: 后续字节应该是 0xA0-0xBF
                    if (i + 1 < view.length && view[i + 1] < 0xA0) isValidStart = false;
                } else if (byte === 0xED) {
                    // 0xED: 后续字节应该是 0x80-0x9F ( surrogate range)
                    if (i + 1 < view.length && view[i + 1] > 0x9F) isValidStart = false;
                }
            } else if ((byte & 0xF8) === 0xF0) {
                // 4字节序列: 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
                expectedContinuation = 3;
                // 检查字节范围
                if (byte > 0xF4) isValidStart = false;
                if (byte === 0xF0 && i + 1 < view.length && view[i + 1] < 0x90) isValidStart = false;
                if (byte === 0xF4 && i + 1 < view.length && view[i + 1] > 0x8F) isValidStart = false;
            } else {
                // 非法起始字节
                isValidStart = false;
            }
            
            // 验证 continuation 字节
            if (isValidStart && expectedContinuation > 0) {
                let validContinuation = true;
                for (let j = 1; j <= expectedContinuation; j++) {
                    if (i + j >= view.length || (view[i + j] & 0xC0) !== 0x80) {
                        validContinuation = false;
                        break;
                    }
                }
                if (validContinuation) {
                    validUtf8Sequence++;
                    i += expectedContinuation; // 跳过 continuation 字节
                } else {
                    invalidUtf8Sequence++;
                }
            } else if (!isValidStart) {
                invalidUtf8Sequence++;
            }
        }
    }
    
    // 决策逻辑：优先 UTF-8
    if (hasHighBytes) {
        if (invalidUtf8Sequence === 0 && validUtf8Sequence > 0) {
            return 'UTF-8';
        } else if (invalidUtf8Sequence > 0 && validUtf8Sequence === 0) {
            return 'GBK';
        } else if (invalidUtf8Sequence > 0 && validUtf8Sequence > 0) {
            const ratio = invalidUtf8Sequence / (validUtf8Sequence + invalidUtf8Sequence);
            if (ratio < 0.01) {
                return 'UTF-8';
            }
            return 'GBK';
        }
    }
    
    return 'UTF-8';
}

// 检测是否包含二进制数据
function containsBinary(text) {
    // 检查是否包含大量不可打印字符
    let nonPrintable = 0;
    let total = 0;
    
    for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        // 检查控制字符（除了换行、制表符、回车）
        if ((char < 0x20 && char !== 0x09 && char !== 0x0A && char !== 0x0D) || 
            (char >= 0x7F && char < 0xA0)) {
            nonPrintable++;
        }
        total++;
    }
    
    // 如果不可打印字符超过 5%，认为包含二进制数据
    return total > 0 && (nonPrintable / total) > 0.05;
}

// 渲染预览内容
function renderPreviewContent(content, fileSize) {
    const container = document.getElementById('previewContent');
    const lines = content.split(/\r?\n/);
    const lineCount = lines.length;
    
    // 更新行数统计
    document.getElementById('previewLineCount').textContent = `${lineCount.toLocaleString()} 行`;
    
    // 大文件警告
    let statusHtml = '';
    if (fileSize > 1024 * 1024) {
        statusHtml = `<span class="warning"><i class="bi bi-exclamation-triangle me-1"></i>大文件，渲染可能较慢</span>`;
    } else {
        statusHtml = `<span class="info"><i class="bi bi-check-circle me-1"></i>已加载 ${formatFileSize(fileSize)}</span>`;
    }
    document.getElementById('previewStatus').innerHTML = statusHtml;
    
    // 检测文件类型用于语法高亮
    const ext = filePreviewState.currentName.split('.').pop().toLowerCase();
    const isCodeFile = isCodeExtension(ext);
    
    // 构建 HTML
    let html = '';
    const maxLines = 5000; // 最大显示行数
    const displayLines = lines.slice(0, maxLines);
    
    displayLines.forEach((line, index) => {
        const lineNum = index + 1;
        let highlightedLine = line;
        
        // 语法高亮
        if (isCodeFile) {
            highlightedLine = highlightSyntax(highlightedLine, ext);
        }
        
        // 转义 HTML
        highlightedLine = escapeHtml(highlightedLine);
        
        html += `<div class="preview-line"><span class="line-number">${lineNum}</span><span class="line-content">${highlightedLine}</span></div>`;
    });
    
    if (lines.length > maxLines) {
        html += `<div class="preview-line"><span class="line-number"></span><span class="line-content text-muted">... 还有 ${(lines.length - maxLines).toLocaleString()} 行未显示 ...</span></div>`;
    }
    
    container.innerHTML = html;
    
    // 应用换行设置
    applyWrapSetting();
}

// 语法高亮
function highlightSyntax(line, ext) {
    // 简单的高亮规则
    const rules = [
        // 注释
        { pattern: /(\/\/.*$)/gm, class: 'comment' },
        { pattern: /(#.*$)/gm, class: 'comment' },
        { pattern: /(\/\*[\s\S]*?\*\/)/g, class: 'comment' },
        // 字符串
        { pattern: /("(?:[^"\\]|\\.)*")/g, class: 'string' },
        { pattern: /('(?:[^'\\]|\\.)*')/g, class: 'string' },
        { pattern: /(`(?:[^`\\]|\\.)*`)/g, class: 'string' },
        // 数字
        { pattern: /\b(\d+\.?\d*)\b/g, class: 'number' },
        // 关键字
        { pattern: /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|try|catch|throw|new|this|super|extends|typeof|instanceof|null|undefined|true|false)\b/g, class: 'keyword' },
    ];
    
    // 暂时用纯文本（完整的高亮需要更复杂的解析器）
    return escapeHtml(line);
}

// 转义 HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 判断是否为代码文件扩展名
function isCodeExtension(ext) {
    const codeExtensions = [
        'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'cs', 'go', 'rs',
        'rb', 'php', 'swift', 'kt', 'scala', 'html', 'css', 'scss', 'less',
        'json', 'xml', 'yaml', 'yml', 'md', 'txt', 'sh', 'bash', 'zsh',
        'vue', 'svelte', 'html', 'htm', 'ini', 'conf', 'log', 'sql', 'r'
    ];
    return codeExtensions.includes(ext);
}

// 获取文件类型信息
function getFileTypeInfo(ext) {
    const typeMap = {
        'js': 'JavaScript',
        'ts': 'TypeScript',
        'jsx': 'React JSX',
        'tsx': 'React TSX',
        'py': 'Python',
        'java': 'Java',
        'c': 'C',
        'cpp': 'C++',
        'cs': 'C#',
        'go': 'Go',
        'rs': 'Rust',
        'rb': 'Ruby',
        'php': 'PHP',
        'swift': 'Swift',
        'kt': 'Kotlin',
        'vue': 'Vue',
        'html': 'HTML',
        'htm': 'HTML',
        'css': 'CSS',
        'scss': 'SCSS',
        'less': 'LESS',
        'json': 'JSON',
        'xml': 'XML',
        'yaml': 'YAML',
        'yml': 'YAML',
        'md': 'Markdown',
        'txt': '文本文件',
        'ini': '配置文件',
        'conf': '配置文件',
        'log': '日志文件',
        'sql': 'SQL',
        'sh': 'Shell',
        'bash': 'Bash',
        'zsh': 'Zsh'
    };
    return typeMap[ext] || '文本文件';
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// 显示预览错误
function showPreviewError(title, message) {
    const container = document.getElementById('previewContent');
    container.innerHTML = `
        <div class="error-message">
            <span class="error-icon">⚠️</span>
            <h5>${title}</h5>
            <p>${message}</p>
        </div>
    `;
    document.getElementById('previewStatus').innerHTML = '';
}

// 改变编码
function changeEncoding(encoding) {
    if (!filePreviewState.currentHref) return;
    
    filePreviewState.currentEncoding = encoding;
    loadFileContent(filePreviewState.currentHref, encoding);
}

// 切换换行
function wrapText(enable) {
    filePreviewState.isWrapped = enable;
    applyWrapSetting();
}

// 应用换行设置
function applyWrapSetting() {
    const container = document.getElementById('previewContent');
    if (container) {
        container.style.whiteSpace = filePreviewState.isWrapped ? 'pre-wrap' : 'pre';
    }
}

// 关闭文件预览
function closeFilePreview() {
    const popup = document.getElementById('filePreviewPopup');
    const overlay = document.getElementById('previewOverlay');
    
    if (popup) popup.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
    
    // 恢复背景滚动
    document.body.style.overflow = '';
    
    // 清空状态
    filePreviewState.currentHref = null;
    filePreviewState.currentName = null;
    filePreviewState.content = null;
}

// 在新标签页打开
function openInNewTab() {
    if (filePreviewState.currentHref) {
        window.open(filePreviewState.currentHref, '_blank');
    }
}

// 键盘事件处理
document.addEventListener('keydown', function(e) {
    const popup = document.getElementById('filePreviewPopup');
    if (!popup || popup.style.display === 'none') return;
    
    if (e.key === 'Escape') {
        closeFilePreview();
    }
});

// 判断是否为文本文件
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

// 导出函数给全局使用
window.showMediaPreview = showMediaPreview;
window.showVideoWithXGPlayer = showVideoWithXGPlayer;
window.openFilePreview = openFilePreview;
window.closeFilePreview = closeFilePreview;
window.changeEncoding = changeEncoding;
window.wrapText = wrapText;
window.openInNewTab = openInNewTab;