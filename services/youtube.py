"""
Servicio de búsqueda inteligente en YouTube.
Proporciona funcionalidades avanzadas de búsqueda y detección de URLs.
"""
import re
from typing import Optional
from dataclasses import dataclass
import yt_dlp


@dataclass
class VideoResult:
    """Representa un resultado de búsqueda de video."""
    id: str
    title: str
    url: str
    thumbnail: str
    duration: int  # segundos
    duration_formatted: str
    uploader: str
    view_count: int
    channel_url: str


class YouTubeSearchService:
    """
    Servicio de búsqueda avanzada en YouTube.
    Soporta búsqueda por texto, URLs directas y detección inteligente.
    """
    
    # Patrones para detectar diferentes tipos de URLs de YouTube
    URL_PATTERNS = {
        'video': r'(?:https?://)?(?:www\.)?(?:youtube\.com/watch\?v=|youtu\.be/)([a-zA-Z0-9_-]{11})',
        'playlist': r'(?:https?://)?(?:www\.)?youtube\.com/playlist\?list=([a-zA-Z0-9_-]{34})',
        'channel': r'(?:https?://)?(?:www\.)?youtube\.com/(?:channel|c)/([a-zA-Z0-9_-]{24})',
        'user': r'(?:https?://)?(?:www\.)?youtube\.com/user/([a-zA-Z0-9_-]+)',
    }
    
    def __init__(self):
        """Inicializa el servicio de búsqueda."""
        self.ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'format': 'best',
        }
    
    def detect_input_type(self, query: str) -> str:
        """
        Detecta el tipo de entrada del usuario.
        
        Returns:
            'video_url', 'playlist_url', 'channel_url', 'user_url', o 'search'
        """
        query = query.strip()
        
        # Verificar URLs de video
        if re.match(self.URL_PATTERNS['video'], query):
            return 'video_url'
        
        # Verificar URLs de playlist
        if re.match(self.URL_PATTERNS['playlist'], query):
            return 'playlist_url'
        
        # Verificar URLs de canal
        if re.match(self.URL_PATTERNS['channel'], query):
            return 'channel_url'
        
        # Verificar URLs de usuario
        if re.match(self.URL_PATTERNS['user'], query):
            return 'user_url'
        
        # Si no coincide ningún patrón, es una búsqueda por texto
        return 'search'
    
    def extract_video_id(self, url: str) -> Optional[str]:
        """Extrae el ID de video de una URL de YouTube."""
        match = re.match(self.URL_PATTERNS['video'], url)
        if match:
            return match.group(1)
        return None
    
    def search(self, query: str, max_results: int = 12) -> list[VideoResult]:
        """
        Realiza una búsqueda en YouTube.
        
        Args:
            query: Término de búsqueda o URL
            max_results: Número máximo de resultados
            
        Returns:
            Lista de VideoResult ordenados por relevancia
        """
        input_type = self.detect_input_type(query)
        
        if input_type == 'video_url':
            # Es una URL directa de video
            video_id = self.extract_video_id(query)
            if video_id:
                info = self._get_video_info(video_id)
                if info:
                    return [info]
            return []
        
        elif input_type == 'playlist_url':
            # Es una playlist - devolver videos de la playlist
            return self._get_playlist_videos(query, max_results)
        
        else:
            # Búsqueda por texto
            return self._text_search(query, max_results)
    
    def _text_search(self, query: str, max_results: int) -> list[VideoResult]:
        """Realiza búsqueda por texto en YouTube."""
        with yt_dlp.YoutubeDL(self.ydl_opts) as ydl:
            try:
                # Usar ytsearch para buscar
                search_query = f"ytsearch{20}:{query}"
                result = ydl.extract_info(search_query, download=False)
                
                videos = []
                for entry in result.get('entries', [])[:max_results]:
                    if entry:
                        video = self._entry_to_video_result(entry)
                        if video:
                            videos.append(video)
                
                return videos
                
            except Exception as e:
                print(f"Error en búsqueda de texto: {e}")
                return []
    
    def _get_playlist_videos(self, playlist_url: str, max_results: int) -> list[VideoResult]:
        """Obtiene videos de una playlist de YouTube."""
        with yt_dlp.YoutubeDL(self.ydl_opts) as ydl:
            try:
                result = ydl.extract_info(playlist_url, download=False)
                
                videos = []
                for entry in result.get('entries', [])[:max_results]:
                    if entry:
                        video = self._entry_to_video_result(entry)
                        if video:
                            videos.append(video)
                
                return videos
                
            except Exception as e:
                print(f"Error al obtener playlist: {e}")
                return []
    
    def _get_video_info(self, video_id: str) -> Optional[VideoResult]:
        """Obtiene información de un video específico."""
        url = f"https://www.youtube.com/watch?v={video_id}"
        
        with yt_dlp.YoutubeDL(self.ydl_opts) as ydl:
            try:
                info = ydl.extract_info(url, download=False)
                return self._entry_to_video_result(info)
            except Exception:
                return None
    
    def _entry_to_video_result(self, entry: dict) -> Optional[VideoResult]:
        """Convierte una entrada de yt-dlp a VideoResult."""
        try:
            video_id = entry.get('id', '')
            if not video_id:
                return None
            
            return VideoResult(
                id=video_id,
                title=entry.get('title', 'Sin título'),
                url=f"https://www.youtube.com/watch?v={video_id}",
                thumbnail=entry.get('thumbnail', ''),
                duration=entry.get('duration', 0),
                duration_formatted=self._format_duration(entry.get('duration', 0)),
                uploader=entry.get('uploader', 'Desconocido'),
                view_count=entry.get('view_count', 0),
                channel_url=entry.get('channel_url', ''),
            )
        except Exception:
            return None
    
    def _format_duration(self, seconds: int) -> str:
        """Formatea la duración en formato legible."""
        if not seconds:
            return "Desconocida"
        
        hours, remainder = divmod(seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        
        if hours > 0:
            return f"{hours}:{minutes:02d}:{seconds:02d}"
        else:
            return f"{minutes}:{seconds:02d}"
    
    def format_view_count(self, count: int) -> str:
        """Formatea el número de visualizaciones."""
        if count >= 1_000_000_000:
            return f"{count / 1_000_000_000:.1f}M"
        elif count >= 1_000_000:
            return f"{count / 1_000_000:.1f}M"
        elif count >= 1_000:
            return f"{count / 1_000:.1f}K"
        return str(count)
    
    def get_suggestions(self, partial_query: str) -> list[str]:
        """
        Obtiene sugerencias de búsqueda (basado en búsqueda rápida).
        Note: YouTube no tiene API oficial de sugerencias sin API key,
        esto es una implementación básica.
        """
        # Sugerencias básicas basadas en patrones comunes
        suggestions = [
            f"{partial_query} música",
            f"{partial_query} oficial",
            f"{partial_query} en vivo",
            f"{partial_query} letra",
            f"{partial_query} instrumental",
        ]
        
        return suggestions[:5]
