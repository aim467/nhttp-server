// Windows Explorer 风格文件浏览器
class WindowsExplorer {
    constructor() {
        this.isListView = false;
        this.isDarkMode = localStorage.getItem('darkMode') === 'true';
        this.sortBy = 'name';
        this.allFileItems = [];
        this.searchTimeout = null;
        this.currentShareHref = null;
        this.currentShareTitle = '';
        
        this.init();
    }

    init() {
        this.initializeElements();
        this.initializeTheme();
        this.initializeFileItems();
        this.bindEvents();
        this.initializeTooltips();
    }

    initializeElements() {
        this.elements = {
            themeToggle: document.getElementById('themeToggle'),
            viewToggle: document.getElementById('viewToggle'),
            searchInput: document.getElementById('searchInput'),
            fileList: document.getElementById('fileList'),
            listHeader: document.querySelector('.list-header'),
            mediaModal: null,
            shortcutsModal: null,
            shortcutsToast: document.getElementById('shortcutsToast'),
            qrModal: null,
            qrCodeContainer: document.getElementById('qrCodeContainer'),
            qrUrlText: document.getElementById('qrUrlText'),
            qrDownloadMode: document.getElementById('qrDownloadMode')
        };

        // 初始化模态框
        if (document.getElementById('mediaModal')) {
            this.elements.mediaModal = new bootstrap.Modal(document.getElementById('mediaModal'));
        }
        if (document.getElementById('shortcutsModal')) {
            this.elements.shortcutsModal = new bootstrap.Modal(document.getElementById('shortcutsModal'));
        }
        if (document.getElementById('qrModal')) {
            this.elements.qrModal = new bootstrap.Modal(document.getElementById('qrModal'));
        }
    }

    initializeTheme() {
        // 应用保存的主题
        if (this.isDarkMode) {
            document.documentElement.setAttribute('data-theme', 'dark');
            this.elements.themeToggle.innerHTML = '<i class="bi bi-sun"></i>';
            this.elements.themeToggle.title = '切换到浅色模式';
        } else {
            document.documentElement.removeAttribute('data-theme');
            this.elements.themeToggle.innerHTML = '<i class="bi bi-moon"></i>';
            this.elements.themeToggle.title = '切换到深色模式';
        }
    }

    initializeFileItems() {
        this.allFileItems = Array.from(this.elements.fileList.children).filter(item => 
            item.classList.contains('file-item')
        );
    }

    initializeTooltips() {
        // 初始化 Bootstrap 工具提示
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }

    bindEvents() {
        // 主题切换
        if (this.elements.themeToggle) {
            this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
        }
        
        // 视图切换
        if (this.elements.viewToggle) {
            this.elements.viewToggle.addEventListener('click', () => this.toggleView());
        }
        
        // 搜索功能
        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('input', (e) => this.handleSearch(e));
        }

        const qrShareCurrent = document.getElementById('qrShareCurrent');
        if (qrShareCurrent) {
            qrShareCurrent.addEventListener('click', () => this.shareCurrentDirectory());
        }

        if (this.elements.qrDownloadMode) {
            this.elements.qrDownloadMode.addEventListener('change', () => {
                if (this.currentShareHref) {
                    const url = this.getShareUrl(this.currentShareHref);
                    this.showQr(url, this.currentShareTitle || '');
                }
            });
        }
        
        // 排序功能
        document.querySelectorAll('[data-sort]').forEach(item => {
            item.addEventListener('click', (e) => this.handleSort(e));
        });
        
        // 键盘快捷键
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        // 拖拽功能
        this.bindDragEvents();
        
        // 右键菜单功能
        this.bindContextMenu();
        
        // 双击面包屑滚动到顶部
        const breadcrumb = document.querySelector('.breadcrumb-nav');
        if (breadcrumb) {
            breadcrumb.addEventListener('dblclick', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
    }

    toggleTheme() {
        this.isDarkMode = !this.isDarkMode;
        localStorage.setItem('darkMode', this.isDarkMode);
        
        if (this.isDarkMode) {
            document.documentElement.setAttribute('data-theme', 'dark');
            this.elements.themeToggle.innerHTML = '<i class="bi bi-sun"></i>';
            this.elements.themeToggle.title = '切换到浅色模式';
        } else {
            document.documentElement.removeAttribute('data-theme');
            this.elements.themeToggle.innerHTML = '<i class="bi bi-moon"></i>';
            this.elements.themeToggle.title = '切换到深色模式';
        }
        
        // 显示切换提示
        this.showToast('主题已切换', this.isDarkMode ? '深色模式' : '浅色模式');
    }

    toggleView() {
        this.isListView = !this.isListView;
        
        if (this.isListView) {
            // 切换到列表视图
            this.elements.fileList.classList.add('list-view');
            this.elements.listHeader.classList.remove('d-none');
            this.elements.viewToggle.innerHTML = '<i class="bi bi-grid-3x3-gap"></i>';
            this.elements.viewToggle.title = '切换到网格视图';
            this.elements.viewToggle.classList.add('active');
        } else {
            // 切换到网格视图
            this.elements.fileList.classList.remove('list-view');
            this.elements.listHeader.classList.add('d-none');
            this.elements.viewToggle.innerHTML = '<i class="bi bi-list"></i>';
            this.elements.viewToggle.title = '切换到列表视图';
            this.elements.viewToggle.classList.remove('active');
        }
        
        this.showToast('视图已切换', this.isListView ? '列表视图' : '网格视图');
    }

    handleSearch(e) {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.performSearch(e.target.value.trim());
        }, 300);
    }

    performSearch(query) {
        if (!query) {
            // 显示所有文件
            this.allFileItems.forEach(item => {
                item.style.display = '';
                this.clearHighlight(item);
            });
            return;
        }

        const searchRegex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        let visibleCount = 0;
        
        this.allFileItems.forEach(item => {
            const fileName = item.dataset.name || item.querySelector('.file-name-grid, .file-name-list').textContent;
            const matches = searchRegex.test(fileName);
            
            if (matches) {
                item.style.display = '';
                this.highlightMatch(item, query);
                visibleCount++;
            } else {
                item.style.display = 'none';
                this.clearHighlight(item);
            }
        });

        // 显示搜索结果统计
        if (query) {
            this.showToast('搜索结果', `找到 ${visibleCount} 个匹配项`);
        }
    }

    highlightMatch(item, query) {
        const nameElements = item.querySelectorAll('.file-name-grid, .file-name-list');
        nameElements.forEach(nameElement => {
            const originalText = nameElement.textContent;
            const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            const highlightedText = originalText.replace(regex, '<span class="search-highlight">$1</span>');
            nameElement.innerHTML = highlightedText;
        });
    }

    clearHighlight(item) {
        const nameElements = item.querySelectorAll('.file-name-grid, .file-name-list');
        nameElements.forEach(nameElement => {
            nameElement.innerHTML = nameElement.textContent;
        });
    }

    handleSort(e) {
        e.preventDefault();
        const sortType = e.target.closest('[data-sort]').dataset.sort;
        this.sortBy = sortType;
        
        const items = Array.from(this.elements.fileList.children);
        const fileItems = items.filter(item => item.classList.contains('file-item'));

        // 排序逻辑
        fileItems.sort((a, b) => {
            const aIsDir = a.classList.contains('directory');
            const bIsDir = b.classList.contains('directory');
            
            // 目录始终在前
            if (aIsDir && !bIsDir) return -1;
            if (!aIsDir && bIsDir) return 1;

            const aName = a.dataset.name;
            const bName = b.dataset.name;
            
            switch (sortType) {
                case 'name':
                    return aName.localeCompare(bName, 'zh-CN', { numeric: true });
                case 'date':
                    const aDate = a.dataset.date;
                    const bDate = b.dataset.date;
                    return new Date(bDate) - new Date(aDate);
                case 'size':
                    const aSize = a.dataset.size;
                    const bSize = b.dataset.size;
                    if (aSize === '-' && bSize === '-') return 0;
                    if (aSize === '-') return -1;
                    if (bSize === '-') return 1;
                    return this.parseSize(bSize) - this.parseSize(aSize);
                default:
                    return 0;
            }
        });

        // 重新排列 DOM
        this.elements.fileList.innerHTML = '';
        fileItems.forEach(item => this.elements.fileList.appendChild(item));
        
        // 重新初始化文件项数组
        this.initializeFileItems();
        
        this.showToast('排序完成', `按${this.getSortName(sortType)}排序`);
    }

    parseSize(sizeStr) {
        if (sizeStr === '-') return 0;
        const units = { 'B': 1, 'KB': 1024, 'MB': 1024*1024, 'GB': 1024*1024*1024 };
        const match = sizeStr.match(/^([\d.]+)\s*(\w+)$/);
        if (!match) return 0;
        return parseFloat(match[1]) * (units[match[2]] || 1);
    }

    getSortName(sortType) {
        const names = {
            'name': '名称',
            'date': '修改日期',
            'size': '大小'
        };
        return names[sortType] || '名称';
    }

    handleKeyboard(e) {
        // 如果正在输入搜索，只处理 ESC 键
        if (document.activeElement === this.elements.searchInput) {
            if (e.key === 'Escape') {
                this.elements.searchInput.blur();
                this.elements.searchInput.value = '';
                this.performSearch('');
            }
            return;
        }
        
        if (e.ctrlKey || e.metaKey) return;
        
        switch(e.key.toLowerCase()) {
            case '/':
                e.preventDefault();
                if (this.elements.searchInput) {
                    this.elements.searchInput.focus();
                }
                break;
            case 'v':
                e.preventDefault();
                this.toggleView();
                break;
            case 't':
                e.preventDefault();
                this.toggleTheme();
                break;
            case 'r':
                e.preventDefault();
                location.reload();
                break;
            case '?':
                e.preventDefault();
                if (this.elements.shortcutsModal) {
                    this.elements.shortcutsModal.show();
                }
                break;
            case 'escape':
                if (this.elements.searchInput && this.elements.searchInput.value) {
                    this.elements.searchInput.value = '';
                    this.performSearch('');
                }
                break;
        }
    }

    bindDragEvents() {
        let dragCounter = 0;

        document.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dragCounter++;
            document.body.classList.add('drag-over');
        });

        document.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dragCounter--;
            if (dragCounter === 0) {
                document.body.classList.remove('drag-over');
            }
        });

        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            dragCounter = 0;
            document.body.classList.remove('drag-over');
            
            this.showToast('拖拽上传', '此功能需要服务端支持', 'warning');
        });
    }

    bindContextMenu() {
        const contextMenu = document.getElementById('contextMenu');
        let currentFileItem = null;

        // 右键点击文件项
        document.addEventListener('contextmenu', (e) => {
            const fileItem = e.target.closest('.file-item');
            if (fileItem) {
                e.preventDefault();
                currentFileItem = fileItem;
                this.showContextMenu(e.pageX, e.pageY, fileItem);
            }
        });

        // 点击其他地方隐藏菜单
        document.addEventListener('click', () => {
            this.hideContextMenu();
        });

        // 菜单项点击事件
        if (contextMenu) {
            contextMenu.addEventListener('click', (e) => {
                const action = e.target.closest('.context-menu-item')?.dataset.action;
                if (action && currentFileItem) {
                    this.handleContextMenuAction(action, currentFileItem);
                }
                this.hideContextMenu();
            });
        }
    }

    showContextMenu(x, y, fileItem) {
        const contextMenu = document.getElementById('contextMenu');
        if (!contextMenu) return;

        const isDirectory = fileItem.dataset.isDirectory === 'true';
        
        // 根据文件类型显示/隐藏菜单项
        const previewItem = contextMenu.querySelector('[data-action="preview"]');
        const downloadItem = contextMenu.querySelector('[data-action="download"]');
        
        if (previewItem) {
            previewItem.style.display = isDirectory ? 'none' : 'flex';
        }
        if (downloadItem) {
            downloadItem.style.display = isDirectory ? 'none' : 'flex';
        }

        // 显示菜单
        contextMenu.style.display = 'block';
        contextMenu.style.left = x + 'px';
        contextMenu.style.top = y + 'px';

        // 确保菜单不超出屏幕
        const rect = contextMenu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            contextMenu.style.left = (x - rect.width) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            contextMenu.style.top = (y - rect.height) + 'px';
        }
    }

    hideContextMenu() {
        const contextMenu = document.getElementById('contextMenu');
        if (contextMenu) {
            contextMenu.style.display = 'none';
        }
    }

    handleContextMenuAction(action, fileItem) {
        const href = fileItem.dataset.href;
        const name = fileItem.dataset.name;
        const mediaType = fileItem.dataset.mediaType;

        switch (action) {
            case 'preview':
                this.previewFile(href, mediaType, name);
                break;
            case 'download':
                this.downloadFile(href, name);
                break;
            case 'copy-link':
                this.copyToClipboard(window.location.origin + href);
                this.showToast('链接已复制', '文件链接已复制到剪贴板');
                break;
            case 'open-new-tab':
                window.open(href, '_blank');
                break;
            case 'share-qr':
                this.shareFile(href, name);
                break;
        }
    }

    /**
     * 获取用于二维码分享的内网 URL
     * @param {string} href - 文件路径
     * @returns {string} 完整的内网 URL
     */
    getShareUrl(href) {
        // 获取服务器内网 IP
        const ipSelect = document.getElementById('qrIpSelect');
        const portInput = document.getElementById('serverPort');
        const modeSelect = this.elements.qrDownloadMode || document.getElementById('qrDownloadMode');
        
        let ip = 'localhost';
        if (ipSelect) {
            // 多网卡，选择了特定 IP
            ip = ipSelect.value;
        } else {
            // 单网卡，从隐藏字段获取
            const hiddenIp = document.querySelector('input[id="qrIpSelect"]');
            if (hiddenIp) {
                ip = hiddenIp.value;
            }
        }
        
        const port = portInput ? portInput.value : window.location.port;
        const protocol = window.location.protocol;
        const baseUrl = `${protocol}//${ip}:${port}${href}`;

        const mode = modeSelect ? modeSelect.value : 'open';
        if (mode === 'download') {
            try {
                const urlObj = new URL(baseUrl);
                urlObj.searchParams.set('download', '1');
                return urlObj.toString();
            } catch (e) {
                const hasQuery = baseUrl.includes('?');
                const separator = hasQuery ? '&' : '?';
                return `${baseUrl}${separator}download=1`;
            }
        }

        return baseUrl;
    }

    shareCurrentDirectory() {
        this.currentShareHref = window.location.pathname;
        this.currentShareTitle = '当前目录';
        const shareUrl = this.getShareUrl(this.currentShareHref);
        this.showQr(shareUrl, this.currentShareTitle);
    }

    shareFile(href, name) {
        this.currentShareHref = href;
        this.currentShareTitle = name;
        const shareUrl = this.getShareUrl(this.currentShareHref);
        this.showQr(shareUrl, this.currentShareTitle);
    }

    showQr(url, title) {
        if (!this.elements.qrModal || !this.elements.qrCodeContainer) return;
        this.elements.qrCodeContainer.innerHTML = '';
        if (typeof QRCode !== 'undefined') {
            new QRCode(this.elements.qrCodeContainer, {
                text: url,
                width: 220,
                height: 220
            });
        } else {
            this.elements.qrCodeContainer.textContent = url;
        }
        if (this.elements.qrUrlText) {
            this.elements.qrUrlText.textContent = url;
        }
        const label = document.getElementById('qrModalLabel');
        if (label && title) {
            label.textContent = '二维码分享 - ' + title;
        }
        this.elements.qrModal.show();
    }

    previewFile(href, mediaType, name) {
        if (mediaType === 'image') {
            // 使用 Viewer.js 预览图片
            const img = document.querySelector(`[data-viewer-image="${href}"]`)?.querySelector('.viewer-image');
            if (img) {
                const fileList = document.getElementById('fileList');
                const viewer = new Viewer(fileList);
                const index = Array.from(fileList.querySelectorAll('.viewer-image')).indexOf(img);
                viewer.view(index);
            }
        } else if (mediaType === 'video') {
            // 使用 XGPlayer 预览视频
            showVideoWithXGPlayer(href, name);
        } else if (mediaType) {
            // 使用模态框预览其他媒体
            showMediaPreview(href, mediaType, name);
        } else {
            // 在新标签页中打开文件
            window.open(href, '_blank');
        }
    }

    downloadFile(href, name) {
        const link = document.createElement('a');
        link.href = href;
        link.download = name;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showToast('开始下载', `正在下载 ${name}`);
    }

    copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
        } else {
            // 兼容旧浏览器
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
    }

    showToast(title, message, type = 'info') {
        // 创建动态 Toast
        const toastContainer = document.querySelector('.toast-container') || this.createToastContainer();
        const toastId = 'toast-' + Date.now();
        
        const toastHtml = `
            <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header">
                    <i class="bi bi-${this.getToastIcon(type)} text-${type} me-2"></i>
                    <strong class="me-auto">${title}</strong>
                    <small class="text-muted">刚刚</small>
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        `;
        
        toastContainer.insertAdjacentHTML('beforeend', toastHtml);
        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement, { delay: 3000 });
        
        toast.show();
        
        // 自动清理
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }

    createToastContainer() {
        const container = document.createElement('div');
        container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(container);
        return container;
    }

    getToastIcon(type) {
        const icons = {
            'info': 'info-circle',
            'success': 'check-circle',
            'warning': 'exclamation-triangle',
            'danger': 'x-circle'
        };
        return icons[type] || 'info-circle';
    }
}

// 全局变量用于存储当前播放器实例
let currentXGPlayer = null;

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
            plugins: [
                // 可以在这里添加更多插件
            ]
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

document.addEventListener('DOMContentLoaded', function() {
    window.windowsExplorer = new WindowsExplorer();
    window.explorerInstance = window.windowsExplorer;
    const shortcutsToast = document.getElementById('shortcutsToast');
    if (shortcutsToast) {
        setTimeout(() => {
            const toast = new bootstrap.Toast(shortcutsToast);
            toast.show();
        }, 1500);
    }
});

// 全局错误处理
window.addEventListener('error', function(e) {
    console.error('应用错误:', e.error);
    if (window.windowsExplorer) {
        window.windowsExplorer.showToast('错误', '应用遇到了一个错误', 'danger');
    }
});

// 文件预览功能 - 供模板调用
function previewFile(href, mediaType, name) {
    if (mediaType === 'image') {
        // 使用 Viewer.js 预览图片
        const img = document.querySelector(`[data-viewer-image="${href}"]`)?.querySelector('.viewer-image');
        if (img) {
            const fileList = document.getElementById('fileList');
            const viewer = new Viewer(fileList);
            const index = Array.from(fileList.querySelectorAll('.viewer-image')).indexOf(img);
            viewer.view(index);
        }
    } else if (mediaType === 'video') {
        // 使用 XGPlayer 预览视频
        showVideoWithXGPlayer(href, name);
    } else if (mediaType) {
        // 使用模态框预览其他媒体
        showMediaPreview(href, mediaType, name);
    } else {
        // 在新标签页中打开文件
        window.open(href, '_blank');
    }
}

// 文件下载功能 - 供模板调用
function downloadFile(href, name) {
    const link = document.createElement('a');
    link.href = href;
    link.download = name;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // 显示下载提示
    if (window.windowsExplorer) {
        window.windowsExplorer.showToast('开始下载', `正在下载 ${name}`);
    }
}

// 导出给模板使用
window.showMediaPreview = showMediaPreview;
window.showVideoWithXGPlayer = showVideoWithXGPlayer;
window.previewFile = function(href, mediaType, name) {
    if (window.explorerInstance) {
        window.explorerInstance.previewFile(href, mediaType, name);
    }
};
window.downloadFile = function(href, name) {
    if (window.explorerInstance) {
        window.explorerInstance.downloadFile(href, name);
    }
};
window.shareFileQr = function(href, name) {
    if (window.explorerInstance) {
        window.explorerInstance.shareFile(href, name);
    }
};

// ============ 文件预览浮窗功能 ============

// 文件预览状态管理
const filePreviewState = {
    currentHref: null,
    currentName: null,
    currentEncoding: 'auto',
    isWrapped: true,
    content: null,
    detectedEncoding: null
};

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
                const utf8Decoder = new TextEncoding('utf-8');
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
    // 如果有高字节但没有无效序列，很可能是 UTF-8
    // 如果有无效序列，可能是 GBK 或其他编码
    if (hasHighBytes) {
        if (invalidUtf8Sequence === 0 && validUtf8Sequence > 0) {
            return 'UTF-8';
        } else if (invalidUtf8Sequence > 0 && validUtf8Sequence === 0) {
            return 'GBK';
        } else if (invalidUtf8Sequence > 0 && validUtf8Sequence > 0) {
            // 混合情况：如果无效序列很少，可能是 UTF-8
            const ratio = invalidUtf8Sequence / (validUtf8Sequence + invalidUtf8Sequence);
            if (ratio < 0.01) {
                return 'UTF-8'; // 不到 1% 无效序列，认为是 UTF-8
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

// 修改原有的 previewFile 函数以支持浮窗预览
const originalPreviewFile = previewFile;
previewFile = function(href, mediaType, name) {
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
window.openFilePreview = openFilePreview;
window.closeFilePreview = closeFilePreview;
window.changeEncoding = changeEncoding;
window.wrapText = wrapText;
window.openInNewTab = openInNewTab;
