"""
Servicio de Búsqueda Inteligente para YouTube.
Usa yt-dlp para búsqueda confiable y API de Google para sugerencias.
"""
import asyncio
import aiohttp
import re
from urllib.parse import quote_plus
from dataclasses import dataclass
from typing import List, Optional
import yt_dlp


@dataclass
class YouTubeVideo:
    """Representa un video de YouTube encontrado."""
    video_id: str
    title: str
    url: str
    thumbnail: str
    duration: str
    channel: str
    views: str
    upload_date: str
    description_preview: str


class YouTubeScraper:
    """
    Buscador de YouTube usando yt-dlp (confiable) y sugerencias de Google.
    """
    
    SUGGEST_URL = "https://suggestqueries.google.com/complete/search"
    
    def __init__(self):
        self.session = None
    
    async def get_session(self):
        if self.session is None:
            self.session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=30),
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0"}
            )
        return self.session
    
    async def close_session(self):
        if self.session:
            await self.session.close()
            self.session = None
    
    def set_session(self, session):
        self.session = session
    
    async def get_suggestions(self, query: str) -> List[str]:
        """Obtiene sugerencias de autocompletado."""
        if not query or len(query) < 2:
            return []
        
        try:
            session = await self.get_session()
            url = f"{self.SUGGEST_URL}?client=youtube&ds=yt&q={quote_plus(query)}&hl=es"
            
            async with session.get(url) as response:
                if response.status == 200:
                    text = await response.text()
                    matches = re.findall(r'\["([^"]+)",0', text)
                    if matches:
                        return matches[1:9] if len(matches) > 1 else matches[:8]
            return []
        except Exception as e:
            print(f"Error sugerencias: {e}")
            return []
    
    async def search(self, query: str, max_results: int = 10) -> List[YouTubeVideo]:
        """
        Busca videos usando yt-dlp (más confiable que scraping).
        Acepta texto de búsqueda o URLs directas.
        """
        videos = []
        
        try:
            loop = asyncio.get_event_loop()
            
            # Si es URL directa, obtener info del video
            if 'youtube.com' in query or 'youtu.be' in query:
                video = await self._get_video_info(query)
                return [video] if video else []
            
            # Búsqueda por texto usando yt-dlp
            search_query = f"ytsearch{max_results}:{query}"
            
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'extract_flat': True,
                'skip_download': True,
            }
            
            def do_search():
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    return ydl.extract_info(search_query, download=False)
            
            result = await loop.run_in_executor(None, do_search)
            
            if result and 'entries' in result:
                for entry in result['entries']:
                    if entry:
                        video = self._parse_entry(entry)
                        if video:
                            videos.append(video)
            
        except Exception as e:
            print(f"Error en búsqueda: {e}")
        
        return videos
    
    async def _get_video_info(self, url: str) -> Optional[YouTubeVideo]:
        """Obtiene información de un video específico por URL."""
        try:
            loop = asyncio.get_event_loop()
            
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'skip_download': True,
            }
            
            def get_info():
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    return ydl.extract_info(url, download=False)
            
            info = await loop.run_in_executor(None, get_info)
            
            if info:
                return self._parse_entry(info)
            
        except Exception as e:
            print(f"Error obteniendo video: {e}")
        
        return None
    
    def _parse_entry(self, entry: dict) -> Optional[YouTubeVideo]:
        """Convierte entrada de yt-dlp a YouTubeVideo."""
        try:
            video_id = entry.get('id', '')
            if not video_id:
                return None
            
            title = entry.get('title', 'Sin título')
            
            # Duración
            duration_secs = entry.get('duration', 0)
            if duration_secs:
                mins = int(duration_secs) // 60
                secs = int(duration_secs) % 60
                duration = f"{mins}:{secs:02d}"
            else:
                duration = ""
            
            # Vistas
            view_count = entry.get('view_count', 0)
            if view_count:
                if view_count >= 1000000:
                    views = f"{view_count/1000000:.1f}M vistas"
                elif view_count >= 1000:
                    views = f"{view_count/1000:.0f}K vistas"
                else:
                    views = f"{view_count} vistas"
            else:
                views = ""
            
            return YouTubeVideo(
                video_id=video_id,
                title=title,
                url=f"https://www.youtube.com/watch?v={video_id}",
                thumbnail=f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg",
                duration=duration,
                channel=entry.get('channel', entry.get('uploader', '')),
                views=views,
                upload_date=entry.get('upload_date', ''),
                description_preview=entry.get('description', '')[:100] if entry.get('description') else ''
            )
        except Exception:
            return None
