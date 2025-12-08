class CameraApp {
    constructor() {
        this.photos = [];
        this.isConnected = false;

        this.initElements();
        this.initUIEvents();
        this.initBackend();
    }

    initElements() {
        this.videoStream = document.getElementById('video-stream');
        this.videoLoading = document.getElementById('video-loading');
        this.captureBtn = document.getElementById('capture-btn');
        this.photosGrid = document.getElementById('photos-grid');
        this.photoCount = document.getElementById('photo-count');
        this.toast = document.getElementById('toast');
        this.modal = document.getElementById('preview-modal');
        this.previewImage = document.getElementById('preview-image');
        this.modalClose = document.querySelector('.modal-close');
    }

    initBackend() {
        this.videoStream.src = `${BACKEND_BASE_URL}/video_feed`;
        this.loadPhotos();
    }

    initUIEvents() {
        this.videoStream.addEventListener('load', () => {
            this.videoLoading.style.display = 'none';
        });

        this.videoStream.addEventListener('error', () => {
            this.videoLoading.textContent = '摄像头连接失败';
            this.showToast('摄像头连接失败', 'error');
        });

        this.captureBtn.addEventListener('click', () => {
            this.capture();
        });

        this.modalClose.addEventListener('click', () => {
            this.closeModal();
        });

        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('show')) {
                this.closeModal();
            }
        });
    }

    async loadPhotos() {
        try {
            const res = await fetch(`${BACKEND_BASE_URL}/api/photos`);
            if (!res.ok) {
                throw new Error('请求失败');
            }
            const json = await res.json();
            if (json.code === 0 && Array.isArray(json.data)) {
                this.photos = json.data;
                this.renderPhotos();
                this.isConnected = true;
                this.captureBtn.disabled = false;
                this.showToast('已连接服务器', 'success');
            } else {
                this.showToast(json.msg || '获取照片列表失败', 'error');
            }
        } catch (err) {
            console.error(err);
            this.isConnected = false;
            this.captureBtn.disabled = true;
            this.showToast('无法连接服务器，请检查后端是否已启动', 'error');
        }
    }

    async capture() {
        if (!this.isConnected) {
            this.showToast('未连接服务器', 'error');
            return;
        }

        const originalText = this.captureBtn.textContent;
        this.captureBtn.disabled = true;
        this.captureBtn.textContent = '拍照中...';

        try {
            const res = await fetch(`${BACKEND_BASE_URL}/api/capture`, {
                method: 'POST',
            });
            if (!res.ok) {
                throw new Error('请求失败');
            }
            const json = await res.json();
            if (json.code === 0 && json.data) {
                const photo = json.data;
                this.photos.unshift(photo);
                this.renderPhotos();
                this.showToast('拍照成功', 'success');
            } else {
                this.showToast(json.msg || '拍照失败', 'error');
            }
        } catch (err) {
            console.error(err);
            this.isConnected = false;
            this.captureBtn.disabled = true;
            this.showToast('无法连接服务器，请检查后端是否已启动', 'error');
        } finally {
            if (this.isConnected) {
                this.captureBtn.disabled = false;
            }
            this.captureBtn.textContent = originalText;
        }
    }

    async deletePhoto(filename) {
        if (!filename) {
            return;
        }
        const confirmed = window.confirm('确定要删除这张照片吗？');
        if (!confirmed) {
            return;
        }

        try {
            const res = await fetch(`${BACKEND_BASE_URL}/api/photos/${encodeURIComponent(filename)}`, {
                method: 'DELETE',
            });
            if (!res.ok) {
                throw new Error('请求失败');
            }
            const json = await res.json();
            if (json.code === 0) {
                this.photos = this.photos.filter(p => p.filename !== filename);
                this.renderPhotos();
                this.showToast('照片已删除', 'success');
            } else {
                this.showToast(json.msg || '删除失败', 'error');
            }
        } catch (err) {
            console.error(err);
            this.showToast('删除失败，无法连接服务器', 'error');
        }
    }

    renderPhotos() {
        this.photoCount.textContent = this.photos.length.toString();

        if (this.photos.length === 0) {
            this.photosGrid.innerHTML = '<p class="no-photos">暂无照片，点击拍照按钮开始拍摄。</p>';
            return;
        }

        this.photosGrid.innerHTML = this.photos.map(photo => {
            const url = `${BACKEND_BASE_URL}${photo.url}`;
            const safeUrl = url.replace(/"/g, '&quot;');
            const safeFilename = String(photo.filename).replace(/"/g, '&quot;');
            return `
                <div class="photo-item" data-filename="${safeFilename}">
                    <img src="${safeUrl}"
                         alt="照片"
                         loading="lazy"
                         onclick="app.openPreview('${safeUrl}')">
                    <button class="delete-btn"
                            onclick="event.stopPropagation(); app.deletePhoto('${safeFilename}')"
                            title="删除照片">
                        &times;
                    </button>
                </div>
            `;
        }).join('');
    }

    openPreview(url) {
        this.previewImage.src = url;
        this.modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        this.modal.classList.remove('show');
        document.body.style.overflow = '';
        setTimeout(() => {
            this.previewImage.src = '';
        }, 300);
    }

    showToast(message, type = 'info') {
        this.toast.textContent = message;
        this.toast.className = `toast show ${type}`;
        setTimeout(() => {
            this.toast.className = 'toast';
        }, 3000);
    }
}

const app = new CameraApp();
window.app = app;
