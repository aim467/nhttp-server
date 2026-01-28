// ============ 文件上传功能 ============

class FileUploader {
    constructor() {
        this.files = [];
        this.isUploading = false;
        this.modal = null;
        this.init();
    }

    init() {
        // 检查是否启用了认证模式
        const authEnabled = document.getElementById('authEnabled');
        if (!authEnabled || authEnabled.value !== 'true') {
            return;
        }

        // 初始化 DOM 元素
        this.uploadBtn = document.getElementById('uploadBtn');
        this.uploadModal = document.getElementById('uploadModal');
        this.uploadDropzone = document.getElementById('uploadDropzone');
        this.fileInput = document.getElementById('fileInput');
        this.uploadFileList = document.getElementById('uploadFileList');
        this.uploadFiles = document.getElementById('uploadFiles');
        this.uploadFileCount = document.getElementById('uploadFileCount');
        this.uploadProgress = document.getElementById('uploadProgress');
        this.uploadProgressBar = document.getElementById('uploadProgressBar');
        this.uploadProgressText = document.getElementById('uploadProgressText');
        this.startUploadBtn = document.getElementById('startUploadBtn');

        if (!this.uploadModal) return;

        this.modal = new bootstrap.Modal(this.uploadModal);
        this.bindEvents();
    }

    bindEvents() {
        // 打开上传模态框
        if (this.uploadBtn) {
            this.uploadBtn.addEventListener('click', () => this.openModal());
        }

        // 文件选择
        if (this.fileInput) {
            this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }

        // 拖拽上传
        if (this.uploadDropzone) {
            this.uploadDropzone.addEventListener('dragenter', (e) => this.handleDragEnter(e));
            this.uploadDropzone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
            this.uploadDropzone.addEventListener('dragover', (e) => this.handleDragOver(e));
            this.uploadDropzone.addEventListener('drop', (e) => this.handleDrop(e));
        }

        // 开始上传
        if (this.startUploadBtn) {
            this.startUploadBtn.addEventListener('click', () => this.startUpload());
        }

        // 模态框关闭时重置
        if (this.uploadModal) {
            this.uploadModal.addEventListener('hidden.bs.modal', () => this.resetModal());
        }
    }

    openModal() {
        this.resetModal();
        this.modal.show();
    }

    resetModal() {
        this.files = [];
        this.isUploading = false;
        this.updateFileList();
        this.uploadProgress.style.display = 'none';
        this.uploadProgressBar.style.width = '0%';
        this.uploadProgressText.textContent = '0%';
        this.startUploadBtn.disabled = true;
        this.fileInput.value = '';
    }

    handleDragEnter(e) {
        e.preventDefault();
        e.stopPropagation();
        this.uploadDropzone.classList.add('drag-over');
    }

    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        this.uploadDropzone.classList.remove('drag-over');
    }

    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        this.uploadDropzone.classList.remove('drag-over');

        const droppedFiles = Array.from(e.dataTransfer.files);
        this.addFiles(droppedFiles);
    }

    handleFileSelect(e) {
        const selectedFiles = Array.from(e.target.files);
        this.addFiles(selectedFiles);
    }

    addFiles(newFiles) {
        // 过滤重复文件
        newFiles.forEach(file => {
            const exists = this.files.some(f => f.name === file.name && f.size === file.size);
            if (!exists) {
                this.files.push(file);
            }
        });

        this.updateFileList();
    }

    removeFile(index) {
        this.files.splice(index, 1);
        this.updateFileList();
    }

    updateFileList() {
        if (this.files.length === 0) {
            this.uploadFileList.style.display = 'none';
            this.startUploadBtn.disabled = true;
            return;
        }

        this.uploadFileList.style.display = 'block';
        this.uploadFileCount.textContent = this.files.length;
        this.startUploadBtn.disabled = false;

        this.uploadFiles.innerHTML = this.files.map((file, index) => `
            <div class="upload-file-item">
                <div class="upload-file-info">
                    <i class="bi bi-file-earmark text-secondary"></i>
                    <span class="upload-file-name" title="${file.name}">${file.name}</span>
                    <span class="upload-file-size">${this.formatSize(file.size)}</span>
                </div>
                <span class="upload-file-remove" onclick="window.fileUploader.removeFile(${index})">
                    <i class="bi bi-x-lg"></i>
                </span>
            </div>
        `).join('');
    }

    formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }

    async startUpload() {
        if (this.files.length === 0 || this.isUploading) return;

        this.isUploading = true;
        this.startUploadBtn.disabled = true;
        this.uploadProgress.style.display = 'block';

        const currentPath = document.getElementById('currentPath')?.value || '/';
        const formData = new FormData();
        formData.append('uploadPath', currentPath);

        this.files.forEach(file => {
            formData.append('files', file);
        });

        try {
            const xhr = new XMLHttpRequest();

            // 进度更新
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    this.uploadProgressBar.style.width = percent + '%';
                    this.uploadProgressText.textContent = percent + '%';
                }
            });

            // 完成处理
            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    if (response.success) {
                        this.showToast('上传成功', response.message, 'success');
                        this.modal.hide();
                        // 刷新页面显示新文件
                        setTimeout(() => location.reload(), 500);
                    } else {
                        this.showToast('上传失败', response.error, 'danger');
                    }
                } else {
                    let errorMsg = '上传失败';
                    try {
                        const response = JSON.parse(xhr.responseText);
                        errorMsg = response.error || errorMsg;
                    } catch (e) {}
                    this.showToast('上传失败', errorMsg, 'danger');
                }
                this.isUploading = false;
                this.startUploadBtn.disabled = false;
            });

            // 错误处理
            xhr.addEventListener('error', () => {
                this.showToast('上传失败', '网络错误', 'danger');
                this.isUploading = false;
                this.startUploadBtn.disabled = false;
            });

            xhr.open('POST', '/upload');
            xhr.send(formData);

        } catch (error) {
            this.showToast('上传失败', error.message, 'danger');
            this.isUploading = false;
            this.startUploadBtn.disabled = false;
        }
    }

    showToast(title, message, type = 'info') {
        if (window.windowsExplorer) {
            window.windowsExplorer.showToast(title, message, type);
        }
    }
}

// 初始化文件上传器
document.addEventListener('DOMContentLoaded', function() {
    window.fileUploader = new FileUploader();
});

// 导出
window.FileUploader = FileUploader;