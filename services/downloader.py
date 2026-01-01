"""
Servicio de descarga de videos/audio desde YouTube.
Progreso en tiempo real, metadatos ID3 y descarga de miniaturas.
"""
import asyncio
import uuid
import os
import threading
import requests
from pathlib import Path
from typing import Optional, Callable
import yt_dlp
from mutagen.mp3 import MP3
from mutagen.id3 import ID3, APIC, TIT2, TPE1, TALB, TPE2, TDRC, TCON, USLT, COMM, WXXX
from dataclasses import dataclass

AUDIO_QUALITY = {'low': '96', 'medium': '128', 'high': '192', 'best': '320'}
VIDEO_QUALITY = {'low': '480', 'medium': '720', 'high': '1080', 'best': '2160'}


@dataclass
class DownloadProgress:
    video_id: str
    title: str
    status: str  # 'waiting', 'downloading', 'converting', 'completed', 'error'
    progress: float
    filename: Optional[str] = None
    error: Optional[str] = None
    speed: str = ""
    eta: str = ""


class YouTubeDownloader:
    def __init__(self, download_folder: str = "downloads"):
        self.download_folder = Path(download_folder)
        self.download_folder.mkdir(exist_ok=True)
        self._is_downloading = False
        self._queue = asyncio.Queue()
        self._current_callback = None
        self._current_info = {}
    
    async def download(
        self, 
        video_url: str, 
        download_type: str = 'audio',
        is_playlist: bool = False,
        audio_quality: str = 'high',
        video_quality: str = 'high',
        progress_callback: Optional[Callable] = None
    ) -> DownloadProgress:
        """Inicia descarga con progreso en tiempo real."""
        
        # Si ya está descargando, rechazar
        if self._is_downloading:
            if progress_callback:
                await progress_callback(DownloadProgress(
                    video_id="queue", title="Espera...",
                    status="error", progress=0,
                    error="Ya hay una descarga en progreso. Espera a que termine."
                ))
            return DownloadProgress(
                video_id="queue", title="En cola",
                status="error", progress=0,
                error="Ya hay una descarga en progreso"
            )
        
        self._is_downloading = True
        self._current_callback = progress_callback
        
        try:
            if is_playlist:
                result = await self._download_playlist(
                    video_url, download_type, audio_quality, video_quality, progress_callback
                )
            elif download_type == 'video':
                result = await self._download_single(video_url, 'video', video_quality, progress_callback)
            else:
                result = await self._download_single(video_url, 'audio', audio_quality, progress_callback)
            
            return result
        finally:
            self._is_downloading = False
    
    def _create_progress_hook(self, video_id: str, title: str, loop, callback):
        """Crea hook de progreso que envía actualizaciones en tiempo real."""
        
        def hook(d):
            if d['status'] == 'downloading':
                total = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
                downloaded = d.get('downloaded_bytes', 0)
                
                if total > 0:
                    progress = (downloaded / total) * 100
                else:
                    progress = 0
                
                speed = d.get('speed', 0)
                speed_str = f"{speed/1024/1024:.1f} MB/s" if speed else ""
                
                eta = d.get('eta', 0)
                eta_str = f"{eta}s" if eta else ""
                
                # Enviar progreso al loop principal
                if callback:
                    asyncio.run_coroutine_threadsafe(
                        callback(DownloadProgress(
                            video_id=video_id,
                            title=f"⬇️ {title[:40]}",
                            status='downloading',
                            progress=min(progress, 99),
                            speed=speed_str,
                            eta=eta_str
                        )),
                        loop
                    )
            
            elif d['status'] == 'finished':
                if callback:
                    asyncio.run_coroutine_threadsafe(
                        callback(DownloadProgress(
                            video_id=video_id,
                            title=f"🔄 Procesando: {title[:35]}",
                            status='converting',
                            progress=99
                        )),
                        loop
                    )
        
        return hook
    
    async def _download_single(
        self, url: str, dtype: str, quality: str,
        callback: Optional[Callable]
    ) -> DownloadProgress:
        """Descarga un video/audio con progreso y metadatos."""
        download_id = str(uuid.uuid4())[:8]
        loop = asyncio.get_event_loop()
        
        try:
            # Notificar inicio
            if callback:
                await callback(DownloadProgress(
                    video_id=download_id,
                    title="🔍 Obteniendo información...",
                    status='downloading',
                    progress=5
                ))
            
            # Obtener info completa del video
            info = await loop.run_in_executor(
                None,
                lambda: yt_dlp.YoutubeDL({'quiet': True}).extract_info(url, download=False)
            )
            
            video_id = info.get('id', download_id)
            title = info.get('title', 'video')
            safe_title = "".join(c for c in title if c.isalnum() or c in (' ', '-', '_')).strip()[:50]
            
            # Guardar información para metadatos
            self._current_info = {
                'title': title,
                'artist': info.get('uploader', info.get('channel', 'Unknown Artist')),
                'album': info.get('album', f'YouTube - {info.get("channel", "Unknown")}'),
                'release_date': info.get('upload_date', ''),
                'description': info.get('description', '')[:500] if info.get('description') else '',
                'genre': 'Music',
                'thumbnail_url': info.get('thumbnail', ''),
                'url': url,
                'duration': info.get('duration', 0),
                'view_count': info.get('view_count', 0),
            }
            
            if callback:
                await callback(DownloadProgress(
                    video_id=video_id,
                    title=f"⬇️ {title[:40]}",
                    status='downloading',
                    progress=10
                ))
            
            # Configurar opciones según tipo
            output_template = str(self.download_folder / f"{safe_title}_%(id)s.%(ext)s")
            
            if dtype == 'audio':
                bitrate = AUDIO_QUALITY.get(quality, '192')
                opts = {
                    'format': 'bestaudio/best',
                    'outtmpl': output_template,
                    'quiet': True,
                    'no_warnings': True,
                    'writethumbnail': True,
                    'progress_hooks': [self._create_progress_hook(video_id, title, loop, callback)],
                    'postprocessors': [{
                        'key': 'FFmpegExtractAudio',
                        'preferredcodec': 'mp3',
                        'preferredquality': bitrate,
                    }],
                }
                ext = '.mp3'
            else:
                res = VIDEO_QUALITY.get(quality, '1080')
                opts = {
                    'format': f'bestvideo[height<={res}]+bestaudio/best[height<={res}]/best',
                    'outtmpl': output_template,
                    'quiet': True,
                    'no_warnings': True,
                    'merge_output_format': 'mp4',
                    'progress_hooks': [self._create_progress_hook(video_id, title, loop, callback)],
                }
                ext = '.mp4'
            
            # Descargar
            await loop.run_in_executor(
                None,
                lambda: yt_dlp.YoutubeDL(opts).download([url])
            )
            
            # Buscar archivo
            filename = self._find_file(safe_title, video_id, ext)
            
            # Si es audio, añadir metadatos ID3
            if dtype == 'audio' and filename:
                await loop.run_in_executor(
                    None,
                    lambda: self._add_id3_metadata(filename, self._current_info)
                )
            
            # Notificar completado
            result = DownloadProgress(
                video_id=video_id,
                title=f"✅ {title[:40]}",
                status='completed',
                progress=100,
                filename=filename
            )
            
            if callback:
                await callback(result)
            
            return result
            
        except Exception as e:
            error_result = DownloadProgress(
                video_id=download_id,
                title="❌ Error",
                status='error',
                progress=0,
                error=str(e)[:100]
            )
            if callback:
                await callback(error_result)
            return error_result
    
    def _add_id3_metadata(self, filename: str, info: dict):
        """Añade metadatos ID3 reales al archivo MP3 incluyendo portada."""
        try:
            if not filename or not Path(filename).exists():
                return
            
            # Abrir el archivo con mutagen
            audio = MP3(filename)
            
            # Crear tags ID3 si no existen
            if audio.tags is None:
                audio.add_tags()
            
            # Descargar y añadir portada
            thumbnail_path = None
            if info.get('thumbnail_url'):
                try:
                    # Descargar la miniatura
                    thumbnail_url = info['thumbnail_url']
                    thumbnail_path = filename.replace('.mp3', '.jpg')
                    
                    # Obtener la mejor calidad de thumbnail
                    if 'maxresdefault' not in thumbnail_url:
                        # Intentar obtener maxresdefault
                        video_id_match = thumbnail_url.split('/')[-1].split('?')[0]
                        if len(video_id_match) == 11:
                            thumbnail_url = f"https://i.ytimg.com/vi_maxresdefault/{video_id_match}.jpg"
                    
                    response = requests.get(thumbnail_url, timeout=10)
                    if response.status_code == 200:
                        with open(thumbnail_path, 'wb') as f:
                            f.write(response.content)
                except Exception as e:
                    print(f"Error descargando thumbnail: {e}")
            
            # Añadir metadatos ID3
            tags = audio.tags
            
            # Título
            if info.get('title'):
                tags.add(TIT2(encoding=3, text=info['title']))
            
            # Artista
            if info.get('artist'):
                tags.add(TPE1(encoding=3, text=info['artist']))
            
            # Álbum
            if info.get('album'):
                tags.add(TALB(encoding=3, text=info['album']))
            
            # Año de lanzamiento
            if info.get('release_date'):
                year = info['release_date'][:4]
                tags.add(TDRC(encoding=3, text=year))
            
            # Género
            if info.get('genre'):
                tags.add(TCON(encoding=3, text=info['genre']))
            
            # Descripción como comentario
            if info.get('description'):
                tags.add(COMM(encoding=3, lang='eng', desc='Description', text=info['description']))
            
            # Álbum Artist
            if info.get('artist'):
                tags.add(TPE2(encoding=3, text=info['artist']))
            
            # Añadir portada (album art)
            if thumbnail_path and Path(thumbnail_path).exists():
                try:
                    with open(thumbnail_path, 'rb') as img:
                        img_data = img.read()
                    
                    tags.add(APIC(
                        encoding=3,
                        mime='image/jpeg',
                        type=3,  # Cover (front)
                        desc='Cover',
                        data=img_data
                    ))
                    
                    # Eliminar archivo temporal
                    Path(thumbnail_path).unlink()
                except Exception as e:
                    print(f"Error añadiendo portada: {e}")
            
            # Guardar cambios
            audio.save()
            print(f"Metadatos ID3 añadidos: {filename}")
            
        except Exception as e:
            print(f"Error añadiendo metadatos ID3: {e}")
    
    def _download_thumbnail(self, url: str, output_path: str) -> Optional[str]:
        """Descarga la miniatura del video."""
        try:
            # Intentar obtener thumbnail de alta calidad
            if 'i.ytimg.com' in url:
                # Extraer video ID
                video_id = None
                if 'vi/' in url:
                    video_id = url.split('vi/')[-1].split('/')[0]
                elif 'watch?v=' in url:
                    video_id = url.split('watch?v=')[-1].split('&')[0]
                elif len(url) == 11:
                    video_id = url
                
                if video_id:
                    # Intentar maxresdefault primero
                    high_quality_url = f"https://i.ytimg.com/vi_maxresdefault/{video_id}.jpg"
                    response = requests.get(high_quality_url, timeout=10)
                    if response.status_code == 200:
                        with open(output_path, 'wb') as f:
                            f.write(response.content)
                        return output_path
            
            # Si no funciona, usar la URL original
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                with open(output_path, 'wb') as f:
                    f.write(response.content)
                return output_path
            
        except Exception as e:
            print(f"Error descargando thumbnail: {e}")
        
        return None
    
    async def _download_playlist(
        self, url: str, dtype: str,
        audio_quality: str, video_quality: str,
        callback: Optional[Callable]
    ) -> DownloadProgress:
        """Descarga playlist - uno a uno con progreso."""
        
        loop = asyncio.get_event_loop()
        
        try:
            if callback:
                await callback(DownloadProgress(
                    video_id='playlist',
                    title="🔍 Analizando playlist...",
                    status='downloading',
                    progress=5
                ))
            
            info = await loop.run_in_executor(
                None,
                lambda: yt_dlp.YoutubeDL({'quiet': True}).extract_info(url, download=False)
            )
            
            entries = [e for e in info.get('entries', []) if e]
            total = len(entries)
            
            if total == 0:
                return DownloadProgress(
                    video_id='playlist',
                    title="Playlist vacía",
                    status='error',
                    progress=0,
                    error="No se encontraron videos"
                )
            
            downloaded = 0
            quality = audio_quality if dtype == 'audio' else video_quality
            
            for i, entry in enumerate(entries):
                video_url = f"https://www.youtube.com/watch?v={entry.get('id', '')}"
                video_title = entry.get('title', f'Video {i+1}')
                
                if callback:
                    await callback(DownloadProgress(
                        video_id='playlist',
                        title=f"📥 [{i+1}/{total}] {video_title[:30]}",
                        status='downloading',
                        progress=(i / total) * 100
                    ))
                
                result = await self._download_single(video_url, dtype, quality, None)
                if result.status == 'completed':
                    downloaded += 1
            
            return DownloadProgress(
                video_id='playlist',
                title=f"✅ Playlist: {downloaded}/{total} descargados",
                status='completed',
                progress=100
            )
            
        except Exception as e:
            return DownloadProgress(
                video_id='playlist',
                title="❌ Error en playlist",
                status='error',
                progress=0,
                error=str(e)[:100]
            )
    
    def _find_file(self, title: str, video_id: str, ext: str) -> Optional[str]:
        import time
        now = time.time()
        
        for f in self.download_folder.glob(f"*{ext}"):
            if now - f.stat().st_mtime < 120:
                if video_id in f.name:
                    return str(f)
        
        for f in self.download_folder.glob(f"*{ext}"):
            if now - f.stat().st_mtime < 60:
                return str(f)
        
        return None
    
    def get_downloaded_files(self) -> list:
        files = []
        for ext, ftype in [('*.mp3', 'audio'), ('*.mp4', 'video')]:
            for f in sorted(self.download_folder.glob(ext), key=lambda x: x.stat().st_mtime, reverse=True):
                files.append({
                    'name': f.name,
                    'size': self._format_size(f.stat().st_size),
                    'created': self._format_date(f.stat().st_mtime),
                    'download_url': f"/download/{f.name}",
                    'type': ftype
                })
        return files
    
    def _format_size(self, size: int) -> str:
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} TB"
    
    def _format_date(self, ts: float) -> str:
        from datetime import datetime
        return datetime.fromtimestamp(ts).strftime('%d/%m/%Y %H:%M')
