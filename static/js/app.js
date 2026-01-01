/**
 * PyTube-AudioHub - Aplicación Frontend Completa
 * Maneja búsqueda, descarga, reproducción de video y audio
 */

class PyTubeApp {
    constructor() {
        this.ws = null;
        this.downloads = new Map();
        this.searchResults = [];
        this.currentFormat = 'audio';
        this.isPlaylist = false;
        this.audioQuality = 'high';
        this.videoQuality = 'high';
        this.init();
    }

    init() {
        console.log('🔄 Inicializando PyTubeApp...');
        this.bindElements();
        this.bindEvents();
        this.bindFormatSelector();
        this.connectWebSocket();
        this.loadFiles();
        console.log('✅ PyTubeApp inicializada');
    }

    bindElements() {
        console.log('📋 Bindings de elementos...');
        this.searchInput = document.getElementById('searchInput');
        this.searchBtn = document.getElementById('searchBtn');
        this.resultsSection = document.getElementById('resultsSection');
        this.resultsGrid = document.getElementById('resultsGrid');
        this.resultCount = document.getElementById('resultCount');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.emptyState = document.getElementById('emptyState');
        this.suggestionsDropdown = document.getElementById('suggestionsDropdown');
        this.suggestionsList = document.getElementById('suggestionsList');
        this.suggestionsTimeout = null;
        this.selectedSuggestionIndex = -1;
        this.filesList = document.getElementById('filesList');
        this.emptyFilesState = document.getElementById('emptyFilesState');
        this.refreshFilesBtn = document.getElementById('refreshFilesBtn');
        this.progressPanel = document.getElementById('progressPanel');
        this.progressList = document.getElementById('progressList');
        this.closeProgressBtn = document.getElementById('closeProgressBtn');
        this.toastContainer = document.getElementById('toastContainer');
        this.serverStatus = document.getElementById('serverStatus');
    }

    bindEvents() {
        console.log('🎯 Bindings de eventos...');
        this.searchBtn.addEventListener('click', () => this.handleSearch());
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.hideSuggestions();
                this.handleSearch();
            }
        });
        
        this.searchInput.addEventListener('input', (e) => this.handleInputChange(e));
        this.searchInput.addEventListener('keydown', (e) => this.handleKeyNavigation(e));
        
        document.addEventListener('click', (e) => {
            if (!this.searchInput.contains(e.target) && !this.suggestionsDropdown.contains(e.target)) {
                this.hideSuggestions();
            }
        });

        this.refreshFilesBtn.addEventListener('click', () => this.loadFiles());
        this.closeProgressBtn.addEventListener('click', () => this.hideProgressPanel());
    }

    handleInputChange(e) {
        const query = e.target.value.trim();
        
        if (this.suggestionsTimeout) {
            clearTimeout(this.suggestionsTimeout);
        }
        
        if (query.includes('youtube.com') || query.includes('youtu.be')) {
            this.hideSuggestions();
            return;
        }
        
        if (query.length < 2) {
            this.hideSuggestions();
            return;
        }
        
        this.suggestionsTimeout = setTimeout(() => {
            this.fetchSuggestions(query);
        }, 300);
    }

    async fetchSuggestions(query) {
        try {
            const response = await fetch(`/api/suggestions?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            if (data.suggestions && data.suggestions.length > 0) {
                this.showSuggestions(data.suggestions);
            } else {
                this.hideSuggestions();
            }
        } catch (error) {
            console.error('Error fetching suggestions:', error);
        }
    }

    showSuggestions(suggestions) {
        this.selectedSuggestionIndex = -1;
        
        this.suggestionsList.innerHTML = suggestions.map((s, i) => `
            <li class="suggestion-item" data-index="${i}" data-value="${this.escapeHtml(s)}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                </svg>
                <span>${this.escapeHtml(s)}</span>
            </li>
        `).join('');
        
        this.suggestionsList.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                this.searchInput.value = item.dataset.value;
                this.hideSuggestions();
                this.handleSearch();
            });
        });
        
        this.suggestionsDropdown.classList.add('active');
    }

    hideSuggestions() {
        this.suggestionsDropdown.classList.remove('active');
        this.selectedSuggestionIndex = -1;
    }

    handleKeyNavigation(e) {
        const items = this.suggestionsList.querySelectorAll('.suggestion-item');
        if (items.length === 0) return;
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectedSuggestionIndex = Math.min(this.selectedSuggestionIndex + 1, items.length - 1);
            this.updateSuggestionHighlight(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectedSuggestionIndex = Math.max(this.selectedSuggestionIndex - 1, -1);
            this.updateSuggestionHighlight(items);
        } else if (e.key === 'Escape') {
            this.hideSuggestions();
        }
    }

    updateSuggestionHighlight(items) {
        items.forEach((item, i) => {
            item.classList.toggle('active', i === this.selectedSuggestionIndex);
            if (i === this.selectedSuggestionIndex) {
                this.searchInput.value = item.dataset.value;
            }
        });
    }

    bindFormatSelector() {
        const formatOptions = document.querySelectorAll('.format-option');
        formatOptions.forEach(option => {
            option.addEventListener('click', () => {
                formatOptions.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                this.currentFormat = option.dataset.format;
                this.updateDownloadButtons();
            });
        });

        const playlistToggle = document.getElementById('playlistToggle');
        if (playlistToggle) {
            playlistToggle.addEventListener('change', (e) => {
                this.isPlaylist = e.target.checked;
            });
        }

        const audioQualitySelect = document.getElementById('audioQuality');
        if (audioQualitySelect) {
            audioQualitySelect.addEventListener('change', (e) => {
                this.audioQuality = e.target.value;
            });
        }

        const videoQualitySelect = document.getElementById('videoQuality');
        if (videoQualitySelect) {
            videoQualitySelect.addEventListener('change', (e) => {
                this.videoQuality = e.target.value;
            });
        }
    }

    updateDownloadButtons() {
        const buttons = document.querySelectorAll('.video-download-btn');
        const formatText = this.currentFormat === 'audio' ? 'MP3' : 'MP4';
        
        buttons.forEach(btn => {
            if (!btn.classList.contains('downloading') && !btn.classList.contains('completed')) {
                btn.querySelector('span').textContent = `Descargar ${formatText}`;
            }
        });
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/progress`;

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('🔌 WebSocket conectado');
                this.updateServerStatus(true);
            };

            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            };

            this.ws.onclose = () => {
                console.log('🔌 WebSocket desconectado, reintentando...');
                this.updateServerStatus(false);
                setTimeout(() => this.connectWebSocket(), 3000);
            };

            this.ws.onerror = (error) => {
                console.error('❌ Error en WebSocket:', error);
            };

        } catch (error) {
            console.error('❌ Error conectando WebSocket:', error);
            this.updateServerStatus(false);
        }
    }

    handleWebSocketMessage(data) {
        if (data.type === 'progress') {
            const progressData = data.data;
            this.updateDownloadProgress(progressData);
        }
    }

    updateServerStatus(online) {
        const statusDot = this.serverStatus.querySelector('.status-dot');
        const statusText = this.serverStatus.querySelector('.status-text');

        if (online) {
            statusDot.className = 'status-dot online';
            statusText.textContent = 'En línea';
        } else {
            statusDot.className = 'status-dot offline';
            statusText.textContent = 'Desconectado';
        }
    }

    async handleSearch() {
        const query = this.searchInput.value.trim();

        if (!query) {
            this.showToast('Ingresa un término de búsqueda o URL', 'error');
            return;
        }

        this.hideSuggestions();
        this.showLoading();
        this.searchResults = [];

        try {
            console.log(`🔍 Buscando: ${query}`);
            const response = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: query, max_results: 15 })
            });

            const data = await response.json();

            if (data.results && data.results.length > 0) {
                this.searchResults = data.results;
                this.renderResults(data.results);
                this.resultCount.textContent = `${data.results.length} videos encontrados`;
                this.showToast(`✅ ${data.results.length} videos encontrados`, 'success');
            } else {
                const errorMsg = data.error || 'No se encontraron resultados';
                this.showToast(errorMsg, 'error');
                this.renderNoResults();
            }

        } catch (error) {
            console.error('❌ Error en búsqueda:', error);
            this.showToast('Error de conexión con el servidor', 'error');
            this.renderNoResults();
        }
    }

    showLoading() {
        this.loadingIndicator.classList.add('active');
        this.emptyState.style.display = 'none';
        this.resultsGrid.innerHTML = '';
    }

    hideLoading() {
        this.loadingIndicator.classList.remove('active');
    }

    renderResults(results) {
        this.hideLoading();

        if (!results || results.length === 0) {
            this.renderNoResults();
            return;
        }

        const formatText = this.currentFormat === 'audio' ? 'MP3' : 'MP4';

        this.resultsGrid.innerHTML = `
            <div class="results-info">
                <span class="results-info-text">💡 Haz clic en el video para previsualizar o descargar como ${formatText}</span>
            </div>
        ` + results.map((video, index) => this.createVideoCard(video, index)).join('');

        this.bindDownloadButtons();
    }

    renderNoResults() {
        this.hideLoading();
        this.resultCount.textContent = 'Sin resultados';
        this.resultsGrid.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                    <line x1="8" y1="8" x2="14" y2="14"/>
                </svg>
                <p>No se encontraron videos</p>
                <p class="search-hint">💡 Verifica el URL de YouTube e intenta de nuevo</p>
            </div>
        `;
    }

    createVideoCard(video, index) {
        const formatText = this.currentFormat === 'audio' ? 'MP3' : 'MP4';
        
        return `
            <div class="video-card" data-video-id="${video.video_id}" data-index="${index}">
                <div class="video-thumbnail">
                    ${video.thumbnail ? 
                        `<img src="${video.thumbnail}" alt="${this.escapeHtml(video.title)}" loading="lazy">` : 
                        '<div class="placeholder-thumbnail"></div>'
                    }
                    ${video.duration ? `<span class="video-duration">${this.escapeHtml(video.duration)}</span>` : ''}
                    <div class="video-preview-overlay" 
                         data-url="${video.url}" 
                         data-video-id="${video.video_id}" 
                         data-title="${this.escapeHtml(video.title)}" 
                         data-channel="${this.escapeHtml(video.channel || '')}" 
                         data-views="${this.escapeHtml(video.views || '')}">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                        <span>Vista Previa</span>
                    </div>
                </div>
                <div class="video-info">
                    <h3 class="video-title" title="${this.escapeHtml(video.title)}">${this.escapeHtml(video.title)}</h3>
                    <div class="video-meta">
                        ${video.channel ? `
                            <span class="video-channel">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                                </svg>
                                ${this.escapeHtml(video.channel)}
                            </span>
                        ` : ''}
                        ${video.views ? `<span class="video-views">${this.escapeHtml(video.views)}</span>` : ''}
                        ${video.upload_date ? `<span class="video-date">${this.escapeHtml(video.upload_date)}</span>` : ''}
                    </div>
                    <button class="video-download-btn" 
                            data-url="${video.url}" 
                            data-video-id="${video.video_id}"
                            data-title="${this.escapeHtml(video.title)}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        <span>Descargar ${formatText}</span>
                    </button>
                </div>
            </div>
        `;
    }

    bindDownloadButtons() {
        console.log('🔗 Bindings de botones de descarga...');
        const buttons = document.querySelectorAll('.video-download-btn');

        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const url = btn.dataset.url;
                const videoId = btn.dataset.videoId;
                const title = btn.dataset.title;
                this.startDownload(url, videoId, title, btn);
            });
        });

        // Video preview overlay click handlers
        const previewOverlays = document.querySelectorAll('.video-preview-overlay');
        console.log(`🎬 Encontrados ${previewOverlays.length} overlays de previsualización`);
        
        previewOverlays.forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('👆 Clic en overlay de previsualización');
                const videoData = {
                    url: overlay.dataset.url,
                    video_id: overlay.dataset.videoId,
                    title: overlay.dataset.title,
                    channel: overlay.dataset.channel,
                    views: overlay.dataset.views
                };
                
                console.log('📺 Abriendo video:', videoData);
                
                if (window.videoPreview) {
                    window.videoPreview.open(videoData);
                } else {
                    console.error('❌ videoPreview no está definido en window');
                }
            });
        });

        // Click en tarjeta completa abre preview
        const cards = document.querySelectorAll('.video-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                const overlay = card.querySelector('.video-preview-overlay');
                if (overlay) {
                    overlay.click();
                }
            });
        });
    }

    async startDownload(url, videoId, title, buttonElement) {
        if (buttonElement.classList.contains('downloading') || 
            buttonElement.classList.contains('completed')) {
            return;
        }

        buttonElement.classList.add('downloading');
        const formatText = this.currentFormat === 'audio' ? 'MP3' : 'MP4';
        buttonElement.querySelector('span').textContent = `⏳ En cola (${formatText})...`;

        const downloadId = videoId || `dl_${Date.now()}`;
        this.addProgressItem(downloadId, title || 'Procesando...', 0);

        try {
            const response = await fetch('/api/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    url: url,
                    video_id: videoId,
                    title: title,
                    download_type: this.currentFormat,
                    is_playlist: this.isPlaylist,
                    audio_quality: this.audioQuality,
                    video_quality: this.videoQuality
                })
            });

            const data = await response.json();

            if (data.task_id) {
                buttonElement.querySelector('span').textContent = `⬇️ Descargando ${formatText}...`;
                this.updateProgressItem(downloadId, {
                    title: title || 'Procesando...',
                    status: 'downloading',
                    progress: 0
                });
                this.showProgressPanel();
                
                const modeText = this.isPlaylist ? 'Playlist' : 'Video';
                this.showToast(`⬇️ ${modeText} download started (${formatText})`, 'info');
            } else {
                buttonElement.classList.remove('downloading');
                buttonElement.querySelector('span').textContent = `Descargar ${formatText}`;
                this.showToast(data.error || 'Error al iniciar descarga', 'error');
                this.removeProgressItem(downloadId);
            }

        } catch (error) {
            console.error('❌ Error iniciando descarga:', error);
            buttonElement.classList.remove('downloading');
            buttonElement.querySelector('span').textContent = `Descargar ${formatText}`;
            this.showToast('Error de conexión', 'error');
            this.removeProgressItem(downloadId);
        }
    }

    updateDownloadProgress(data) {
        const { video_id, title, status, progress, filename, error } = data;
        const downloadId = video_id || `dl_${Date.now()}`;

        const button = document.querySelector(`.video-download-btn[data-video-id="${video_id}"]`);
        if (button && status !== 'completed' && status !== 'error') {
            button.classList.add('downloading');
            const formatText = this.currentFormat === 'audio' ? 'MP3' : 'MP4';
            button.querySelector('span').textContent = `${Math.round(progress)}%`;
        }

        this.updateProgressItem(downloadId, {
            title: title,
            status: status,
            progress: progress,
            error: error
        });

        if (status === 'completed') {
            if (button) {
                button.classList.remove('downloading');
                button.classList.add('completed');
                const formatText = this.currentFormat === 'audio' ? 'MP3' : 'MP4';
                button.querySelector('span').textContent = '✅ ¡Listo!';
            }

            this.showToast(`✅ ¡Descarga completada! "${title}"`, 'success');
            this.loadFiles();

            setTimeout(() => {
                this.removeProgressItem(downloadId);
                if (button) {
                    button.classList.remove('completed');
                    const formatText = this.currentFormat === 'audio' ? 'MP3' : 'MP4';
                    button.querySelector('span').textContent = `Descargar ${formatText}`;
                }
            }, 5000);

        } else if (status === 'error') {
            if (button) {
                button.classList.remove('downloading');
                button.querySelector('span').textContent = '❌ Error';
            }
            this.showToast(`❌ Error: ${error || 'No se pudo descargar'}`, 'error');
        }
    }

    showProgressPanel() {
        this.progressPanel.classList.add('active');
    }

    hideProgressPanel() {
        this.progressPanel.classList.remove('active');
    }

    addProgressItem(videoId, title, progress) {
        if (document.getElementById(`progress-${videoId}`)) {
            return;
        }

        const item = document.createElement('div');
        item.id = `progress-${videoId}`;
        item.className = 'progress-item';
        item.innerHTML = `
            <div class="progress-item-header">
                <span class="progress-item-title">${this.escapeHtml(title || 'Procesando...')}</span>
                <span class="progress-item-status downloading">En cola</span>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: 0%"></div>
            </div>
        `;

        this.progressList.appendChild(item);
    }

    updateProgressItem(videoId, data) {
        const item = document.getElementById(`progress-${videoId}`);
        if (!item) return;

        const { title, status, progress, error } = data;

        const titleEl = item.querySelector('.progress-item-title');
        if (title) {
            titleEl.textContent = title;
            titleEl.title = title;
        }

        const statusEl = item.querySelector('.progress-item-status');
        statusEl.className = `progress-item-status ${status}`;
        
        switch (status) {
            case 'downloading':
                statusEl.textContent = `${Math.round(progress)}%`;
                break;
            case 'converting':
                statusEl.textContent = '🔄 Procesando...';
                break;
            case 'completed':
                statusEl.textContent = '✅ Listo';
                break;
            case 'error':
                statusEl.textContent = '❌ Error';
                break;
        }

        const progressBar = item.querySelector('.progress-bar');
        progressBar.style.width = `${progress}%`;

        let errorEl = item.querySelector('.progress-item-error');
        if (error) {
            if (!errorEl) {
                errorEl = document.createElement('div');
                errorEl.className = 'progress-item-error';
                item.appendChild(errorEl);
            }
            errorEl.textContent = error;
        } else if (errorEl) {
            errorEl.remove();
        }
    }

    removeProgressItem(videoId) {
        const item = document.getElementById(`progress-${videoId}`);
        if (item) {
            item.style.opacity = '0';
            item.style.transform = 'translateX(100%)';
            setTimeout(() => item.remove(), 300);
        }

        setTimeout(() => {
            if (this.progressList.children.length === 0) {
                this.hideProgressPanel();
            }
        }, 100);
    }

    async loadFiles() {
        try {
            const response = await fetch('/api/files');
            const data = await response.json();

            if (data.files) {
                this.renderFiles(data.files);
            }

        } catch (error) {
            console.error('❌ Error cargando archivos:', error);
        }
    }

    renderFiles(files) {
        if (!files || files.length === 0) {
            this.filesList.innerHTML = `
                <div class="empty-state" id="emptyFilesState">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M9 18V5l12-2v13"/>
                        <circle cx="6" cy="18" r="3"/>
                        <circle cx="18" cy="16" r="3"/>
                    </svg>
                    <p>Aún no hay archivos descargados</p>
                    <p class="search-hint">📥 Los archivos aparecerán aquí después de descargar</p>
                </div>
            `;
            return;
        }

        this.filesList.innerHTML = files.map(file => {
            const typeIcon = this.getFileIcon(file.type);
            return `
                <div class="file-item" data-filename="${this.escapeHtml(file.name)}">
                    <div class="file-icon" style="${this.getFileIconStyle(file.type)}">
                        ${typeIcon}
                    </div>
                    <div class="file-info">
                        <div class="file-name" title="${this.escapeHtml(file.name)}">${this.escapeHtml(file.name)}</div>
                        <div class="file-meta">
                            <span>${file.size}</span>
                            <span>${file.created}</span>
                            <span class="file-type-badge">${file.type.toUpperCase()}</span>
                        </div>
                    </div>
                    <div class="file-actions">
                        ${file.type === 'audio' ? `
                        <button class="file-action-btn play-btn" data-filename="${this.escapeHtml(file.name)}" data-download-url="${file.download_url}" title="Reproducir vista previa">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polygon points="5 3 19 12 5 21 5 3"/>
                            </svg>
                        </button>
                        ` : ''}
                        <a href="${file.download_url}" download="${this.escapeHtml(file.name)}" class="file-action-btn download-btn" title="Descargar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                        </a>
                        <button class="file-action-btn delete-btn" data-filename="${this.escapeHtml(file.name)}" title="Eliminar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Play button events
        this.filesList.querySelectorAll('.play-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const filename = btn.dataset.filename;
                const downloadUrl = btn.dataset.downloadUrl;
                console.log('🎵 Reproduciendo audio:', filename);
                if (window.audioPreview) {
                    window.audioPreview.playFile(downloadUrl, filename);
                } else {
                    console.error('❌ audioPreview no está definido');
                }
            });
        });

        // Delete button events
        this.filesList.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const filename = btn.dataset.filename;
                this.deleteFile(filename);
            });
        });
    }

    getFileIcon(type) {
        switch (type) {
            case 'audio':
                return '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>';
            case 'video':
                return '<rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/>';
            case 'playlist':
                return '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>';
            default:
                return '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>';
        }
    }

    getFileIconStyle(type) {
        switch (type) {
            case 'audio':
                return 'background: linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%);';
            case 'video':
                return 'background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);';
            case 'playlist':
                return 'background: linear-gradient(135deg, #27ae60 0%, #229954 100%);';
            default:
                return 'background: linear-gradient(135deg, #ff0000 0%, #cc0000 100%);';
        }
    }

    async deleteFile(filename) {
        if (!confirm(`¿Eliminar "${filename}"?`)) {
            return;
        }

        try {
            const response = await fetch('/api/cleanup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: filename })
            });

            const data = await response.json();

            if (data.success !== false) {
                this.showToast('Archivo eliminado', 'success');
                this.loadFiles();
            } else {
                this.showToast(data.error || 'Error al eliminar', 'error');
            }

        } catch (error) {
            console.error('❌ Error eliminando archivo:', error);
            this.showToast('Error de conexión', 'error');
        }
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
            error: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
            info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'
        };

        toast.innerHTML = `
            <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                ${icons[type] || icons.info}
            </svg>
            <span class="toast-message">${this.escapeHtml(message)}</span>
            <button class="toast-close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;

        toast.querySelector('.toast-close').addEventListener('click', () => {
            this.hideToast(toast);
        });

        this.toastContainer.appendChild(toast);

        setTimeout(() => this.hideToast(toast), 5000);
    }

    hideToast(toast) {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

/**
 * Video Preview Player Class
 * Maneja la reproducción de video desde resultados de búsqueda
 */
class VideoPreviewPlayer {
    constructor() {
        console.log('🎬 Inicializando VideoPreviewPlayer...');
        
        this.modal = document.getElementById('videoPreviewModal');
        this.titleEl = document.getElementById('videoTitle');
        this.metaEl = document.getElementById('videoMeta');
        this.frame = document.getElementById('videoPlayerFrame');
        this.playOverlayBtn = document.getElementById('videoPlayOverlayBtn');
        this.closeBtn = document.getElementById('closeVideoPreviewBtn');
        this.downloadBtn = document.getElementById('videoDownloadBtn');
        this.errorContainer = document.getElementById('videoErrorContainer');
        this.errorLink = document.getElementById('videoErrorLink');
        
        this.currentVideo = null;
        this.isPlaying = false;
        this.loadTimeout = null;
        
        if (!this.modal || !this.frame) {
            console.error('❌ Elementos del modal de video no encontrados');
            return;
        }
        
        this.init();
        console.log('✅ VideoPreviewPlayer inicializado');
    }
    
    init() {
        // Close button
        this.closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.close();
        });
        
        // Overlay play button
        this.playOverlayBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.startPlayback();
        });
        
        // Close on backdrop click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });
        
        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('active')) {
                this.close();
            }
        });
        
        // Download button
        this.downloadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.downloadCurrent();
        });
    }
    
    open(video) {
        console.log('📺 Abriendo modal de video:', video);
        this.currentVideo = video;
        
        // Update UI
        this.titleEl.textContent = video.title;
        this.metaEl.textContent = `${video.channel || 'Unknown'} • ${video.views || ''}`;
        
        // Reset state
        this.isPlaying = false;
        this.frame.src = '';
        this.frame.style.display = 'block';
        this.frame.style.opacity = '1';
        this.errorContainer.classList.add('hidden');
        
        // Clear any pending timeouts
        if (this.loadTimeout) {
            clearTimeout(this.loadTimeout);
            this.loadTimeout = null;
        }
        
        this.modal.classList.add('active');
        
        // Try to play in embed, but if it fails, open YouTube directly
        setTimeout(() => {
            this.startPlaybackWithYoutubeFallback();
        }, 300);
        
        console.log('✅ Modal de video abierto');
    }
    
    startPlaybackWithYoutubeFallback() {
        console.log('▶️ Iniciando reproducción con fallback a YouTube...');
        if (!this.currentVideo) return;
        
        const videoId = this.currentVideo.video_id;
        if (!videoId) return;
        
        // Use nocookie embed first (better privacy)
        const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3`;
        
        console.log(`📡 Cargando embed: ${embedUrl}`);
        this.frame.style.opacity = '0.5';
        this.frame.src = embedUrl;
        this.isPlaying = true;
        
        // Check quickly if embedding is blocked
        this.loadTimeout = setTimeout(() => {
            console.log('⏱️ Verificando disponibilidad del video...');
            this.frame.style.opacity = '1';
            
            // Since we can't detect iframe content due to cross-origin,
            // we'll check after a short time and offer YouTube link
            this.showYoutubeFallback();
        }, 3000);
    }
    
    showYoutubeFallback() {
        console.log('🔗 Mostrando opción de YouTube...');
        this.frame.style.display = 'none';
        this.errorContainer.classList.remove('hidden');
        
        // Update the error link
        if (this.currentVideo && this.errorLink) {
            this.errorLink.href = this.currentVideo.url;
            this.errorLink.onclick = (e) => {
                e.preventDefault();
                window.open(this.currentVideo.url, '_blank');
            };
        }
    }
    
    close() {
        console.log('🔒 Cerrando modal de video');
        
        // Clear any pending timeouts
        if (this.loadTimeout) {
            clearTimeout(this.loadTimeout);
            this.loadTimeout = null;
        }
        
        this.frame.src = '';
        this.frame.style.display = 'block';
        this.frame.style.opacity = '1';
        this.modal.classList.remove('active');
        this.errorContainer.classList.add('hidden');
        this.currentVideo = null;
        this.isPlaying = false;
    }
    
    downloadCurrent() {
        if (!this.currentVideo || !window.app) return;
        
        const formatOption = document.querySelector('.format-option.video');
        if (formatOption) {
            formatOption.click();
        }
        
        window.app.searchInput.value = this.currentVideo.url;
        this.close();
        window.app.handleSearch();
        window.app.showToast('Video seleccionado para descarga', 'info');
    }
}

/**
 * Audio Preview Player Class
 * Maneja la reproducción de audio con controles visuales
 */
class AudioPreviewPlayer {
    constructor() {
        console.log('🎵 Inicializando AudioPreviewPlayer...');
        
        this.audio = document.getElementById('audioPlayer');
        this.modal = document.getElementById('audioPreviewModal');
        this.titleEl = document.getElementById('audioTitle');
        this.metaEl = document.getElementById('audioMeta');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.closeBtn = document.getElementById('closePreviewBtn');
        this.progressBar = document.getElementById('audioProgressBar');
        this.progress = document.getElementById('audioProgress');
        this.timeCurrent = document.getElementById('timeCurrent');
        this.timeTotal = document.getElementById('timeTotal');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeValue = document.getElementById('volumeValue');
        
        if (!this.audio || !this.modal) {
            console.error('❌ Elementos del modal de audio no encontrados');
            return;
        }
        
        this.currentFile = null;
        this.playlist = [];
        this.currentIndex = -1;
        this.isDragging = false;
        
        this.init();
        console.log('✅ AudioPreviewPlayer inicializado');
    }
    
    init() {
        // Play/Pause button
        this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        
        // Previous/Next buttons
        this.prevBtn.addEventListener('click', () => this.playPrevious());
        this.nextBtn.addEventListener('click', () => this.playNext());
        
        // Close button
        this.closeBtn.addEventListener('click', () => this.close());
        
        // Close on backdrop click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });
        
        // Progress bar
        this.progressBar.addEventListener('click', (e) => this.seekTo(e));
        
        // Volume control
        this.volumeSlider.addEventListener('input', () => this.setVolume());
        
        // Audio events
        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('loadedmetadata', () => this.onMetadataLoaded());
        this.audio.addEventListener('ended', () => this.onEnded());
        this.audio.addEventListener('play', () => this.onPlay());
        this.audio.addEventListener('pause', () => this.onPause());
        
        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('active')) {
                this.close();
            }
            if (e.key === ' ' && this.modal.classList.contains('active')) {
                e.preventDefault();
                this.togglePlayPause();
            }
        });
    }
    
    playFile(url, filename) {
        console.log('🎵 Reproduciendo:', filename);
        
        // Get playlist
        const fileItems = document.querySelectorAll('.file-item');
        this.playlist = [];
        fileItems.forEach(item => {
            const playBtn = item.querySelector('.play-btn');
            if (playBtn) {
                this.playlist.push({
                    filename: item.dataset.filename,
                    url: playBtn.dataset.downloadUrl
                });
            }
        });
        
        this.currentFile = { url, filename };
        
        // Update UI
        const displayName = filename.replace(/\.[^/.]+$/, '');
        this.titleEl.textContent = displayName;
        this.metaEl.textContent = 'MP3 Audio • PyTube-AudioHub';
        
        // Load and play
        this.audio.src = url;
        this.audio.load();
        
        this.audio.play().then(() => {
            console.log('✅ Reproducción iniciada');
            this.modal.classList.add('active');
        }).catch(err => {
            console.error('❌ Error reproduciendo:', err);
            this.showToast('Error al reproducir el audio', 'error');
        });
    }
    
    togglePlayPause() {
        if (this.audio.paused) {
            this.audio.play();
        } else {
            this.audio.pause();
        }
    }
    
    onPlay() {
        this.playPauseBtn.querySelector('.play-icon').style.display = 'none';
        this.playPauseBtn.querySelector('.pause-icon').style.display = 'block';
        this.modal.classList.add('playing');
    }
    
    onPause() {
        this.playPauseBtn.querySelector('.play-icon').style.display = 'block';
        this.playPauseBtn.querySelector('.pause-icon').style.display = 'none';
        this.modal.classList.remove('playing');
    }
    
    onMetadataLoaded() {
        if (this.audio.duration && isFinite(this.audio.duration)) {
            this.timeTotal.textContent = this.formatTime(this.audio.duration);
        }
    }
    
    onEnded() {
        if (this.currentIndex < this.playlist.length - 1) {
            this.playNext();
        } else {
            this.onPause();
            this.progress.style.width = '0%';
            this.timeCurrent.textContent = '0:00';
        }
    }
    
    updateProgress() {
        if (this.audio.duration && isFinite(this.audio.duration)) {
            const percent = (this.audio.currentTime / this.audio.duration) * 100;
            this.progress.style.width = `${percent}%`;
            this.timeCurrent.textContent = this.formatTime(this.audio.currentTime);
        }
    }
    
    seekTo(e) {
        const rect = this.progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        if (this.audio.duration && isFinite(this.audio.duration)) {
            this.audio.currentTime = percent * this.audio.duration;
        }
    }
    
    playPrevious() {
        const currentIdx = this.playlist.findIndex(f => f.url === this.currentFile?.url);
        if (currentIdx > 0) {
            const prevFile = this.playlist[currentIdx - 1];
            this.playFile(prevFile.url, prevFile.filename);
        }
    }
    
    playNext() {
        const currentIdx = this.playlist.findIndex(f => f.url === this.currentFile?.url);
        if (currentIdx < this.playlist.length - 1) {
            const nextFile = this.playlist[currentIdx + 1];
            this.playFile(nextFile.url, nextFile.filename);
        }
    }
    
    setVolume() {
        const volume = parseInt(this.volumeSlider.value) / 100;
        this.audio.volume = volume;
        this.volumeValue.textContent = `${this.volumeSlider.value}%`;
    }
    
    close() {
        try {
            this.audio.pause();
            if (this.audio.readyState >= 1 && this.audio.duration > 0 && isFinite(this.audio.duration)) {
                this.audio.currentTime = 0;
            }
        } catch (e) {
            console.warn('Error cerrando audio:', e);
        }
        this.modal.classList.remove('active', 'playing');
        this.progress.style.width = '0%';
        this.timeCurrent.textContent = '0:00';
    }
    
    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    showToast(message, type = 'info') {
        if (window.app && typeof window.app.showToast === 'function') {
            window.app.showToast(message, type);
        }
    }
}

// Initialize all components
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Inicializando PyTube-AudioHub...');
    
    window.app = new PyTubeApp();
    window.audioPreview = new AudioPreviewPlayer();
    window.videoPreview = new VideoPreviewPlayer();
    
    console.log('✅ PyTube-AudioHub completamente inicializado');
    console.log('   - window.app:', typeof window.app);
    console.log('   - window.audioPreview:', typeof window.audioPreview);
    console.log('   - window.videoPreview:', typeof window.videoPreview);
});
