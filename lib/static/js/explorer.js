// Windows Explorer 风格文件浏览器 - 核心类
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

// 导出给其他模块使用
window.WindowsExplorer = WindowsExplorer;