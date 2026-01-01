"""
PyTube-AudioHub - YouTube Video/Audio Downloader
Main FastAPI Application Server with Playlist Support
"""

import asyncio
import json
import os
import urllib.parse
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

import aiohttp
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from services.downloader import YouTubeDownloader, DownloadProgress
from services.youtube_scraper import YouTubeScraper

# Configuration
DOWNLOAD_FOLDER = Path(__file__).parent / "downloads"
DOWNLOAD_FOLDER.mkdir(exist_ok=True)
MAX_FILE_AGE_HOURS = 24

# Global instances
downloader = YouTubeDownloader(download_folder=DOWNLOAD_FOLDER)
search_service = YouTubeScraper()
aiohttp_session = None

# WebSocket clients for progress updates
connected_clients = set()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle with proper resource cleanup."""
    global aiohttp_session
    # Startup: Create aiohttp session for the scraper
    aiohttp_session = aiohttp.ClientSession(
        timeout=aiohttp.ClientTimeout(total=30),
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }
    )
    search_service.set_session(aiohttp_session)
    
    # Cleanup old files on startup
    cleanup_old_files()
    
    print("Server started successfully")
    yield
    # Shutdown: Close aiohttp session properly
    if aiohttp_session:
        await aiohttp_session.close()
        print("aiohttp session closed")


def cleanup_old_files():
    """Remove files older than MAX_FILE_AGE_HOURS."""
    try:
        current_time = datetime.now()
        for file in DOWNLOAD_FOLDER.glob("*"):
            if file.is_file():
                file_time = datetime.fromtimestamp(file.stat().st_mtime)
                if (current_time - file_time).total_seconds() > MAX_FILE_AGE_HOURS * 3600:
                    file.unlink()
                    print(f"Cleaned up old file: {file.name}")
    except Exception as e:
        print(f"Error during cleanup: {e}")


async def broadcast_progress(progress: DownloadProgress):
    """Send progress update to all connected WebSocket clients."""
    message = {
        "type": "progress",
        "data": {
            "video_id": progress.video_id,
            "title": progress.title,
            "status": progress.status,
            "progress": progress.progress,
            "filename": progress.filename,
            "error": progress.error,
            "speed": getattr(progress, 'speed', ''),
            "eta": getattr(progress, 'eta', '')
        }
    }
    
    # Send to all connected clients
    disconnected = set()
    for client in connected_clients:
        try:
            await client.send_json(message)
        except Exception:
            disconnected.add(client)
    
    # Remove disconnected clients
    connected_clients.difference_update(disconnected)


app = FastAPI(
    title="PyTube-AudioHub",
    description="Download YouTube videos as MP3/MP4 with smart search and playlist support",
    version="2.1.0",
    lifespan=lifespan
)

# Mount static files
static_path = Path(__file__).parent / "static"
if static_path.exists():
    app.mount("/static", StaticFiles(directory=str(static_path)), name="static")

# Templates
templates_path = Path(__file__).parent / "templates"
templates = Jinja2Templates(directory=str(templates_path))


@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    """Serve the main application page."""
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/api/files")
async def list_files():
    """List all downloaded files with their information."""
    files_info = []
    try:
        for file in DOWNLOAD_FOLDER.glob("*"):
            if file.is_file():
                stat = file.stat()
                suffix = file.suffix.lower()
                
                # Determine file type
                if suffix == '.mp3':
                    file_type = 'audio'
                    media_type = 'audio/mpeg'
                elif suffix == '.mp4':
                    file_type = 'video'
                    media_type = 'video/mp4'
                elif suffix == '.zip':
                    file_type = 'playlist'
                    media_type = 'application/zip'
                else:
                    continue
                
                files_info.append({
                    "name": file.name,
                    "type": file_type,
                    "size": f"{stat.st_size / (1024 * 1024):.2f} MB",
                    "created": datetime.fromtimestamp(stat.st_ctime).strftime("%Y-%m-%d %H:%M:%S"),
                    "download_url": f"/download/{urllib.parse.quote(file.name)}",
                    "media_type": media_type
                })
    except Exception as e:
        return {"error": str(e)}
    
    return {"files": sorted(files_info, key=lambda x: x["created"], reverse=True)}


@app.get("/download/{filename}")
async def download_file(filename: str):
    """Download a file from the downloads folder."""
    file_path = DOWNLOAD_FOLDER / filename
    if file_path.exists() and file_path.is_file():
        suffix = file_path.suffix.lower()
        
        if suffix == '.mp3':
            media_type = 'audio/mpeg'
        elif suffix == '.mp4':
            media_type = 'video/mp4'
        elif suffix == '.zip':
            media_type = 'application/zip'
        else:
            media_type = 'application/octet-stream'
        
        return FileResponse(
            path=str(file_path),
            filename=filename,
            media_type=media_type
        )
    return {"error": "File not found"}


@app.post("/api/cleanup")
async def cleanup_files():
    """Remove all downloaded files."""
    removed = 0
    try:
        for file in DOWNLOAD_FOLDER.glob("*"):
            if file.is_file():
                file.unlink()
                removed += 1
    except Exception as e:
        return {"error": str(e), "removed": removed}
    
    return {"message": f"Removed {removed} files", "removed": removed}


@app.websocket("/ws/progress")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time download progress updates."""
    await websocket.accept()
    connected_clients.add(websocket)
    
    try:
        # Keep connection alive and handle client disconnect
        while True:
            try:
                # Wait for any message from client (or disconnect)
                data = await websocket.receive_text()
                if data == "ping":
                    await websocket.send_text("pong")
            except WebSocketDisconnect:
                break
    finally:
        connected_clients.discard(websocket)


@app.get("/api/suggestions")
async def get_suggestions(q: str = ""):
    """
    Obtiene sugerencias de búsqueda en tiempo real.
    Similar al autocompletado de YouTube.
    """
    if not q or len(q) < 2:
        return {"suggestions": []}
    
    try:
        suggestions = await search_service.get_suggestions(q)
        return {"suggestions": suggestions}
    except Exception as e:
        print(f"Suggestions error: {e}")
        return {"suggestions": []}


@app.post("/api/search")
async def search_youtube(query: dict):
    """
    Busca videos en YouTube por texto o URL.
    Devuelve múltiples resultados para que el usuario elija.
    """
    search_query = query.get("query", "").strip()
    
    if not search_query:
        return {"error": "Ingresa un término de búsqueda o URL"}
    
    try:
        results = await search_service.search(search_query)
        if not results:
            return {"error": "No se encontraron resultados. Intenta con otros términos."}
        
        # Convertir dataclasses a diccionarios
        results_dict = []
        for r in results:
            results_dict.append({
                "video_id": r.video_id,
                "title": r.title,
                "url": r.url,
                "thumbnail": r.thumbnail,
                "duration": r.duration,
                "channel": r.channel,
                "views": r.views,
                "upload_date": r.upload_date
            })
        
        return {"results": results_dict}
    except Exception as e:
        print(f"Search error: {e}")
        return {"error": f"Error en búsqueda: {str(e)}"}


@app.post("/api/download")
async def download_video(request: Request):
    """
    Download a YouTube video or playlist.
    Supports MP3 (audio) and MP4 (video) formats with quality settings.
    """
    data = await request.json()
    url = data.get("url", "").strip()
    download_type = data.get("download_type", "audio").lower()
    is_playlist = data.get("is_playlist", False)
    audio_quality = data.get("audio_quality", "high")
    video_quality = data.get("video_quality", "high")
    
    if not url:
        return {"error": "Please provide a YouTube URL"}
    
    if download_type not in ['audio', 'video']:
        return {"error": "Invalid download type. Use 'audio' or 'video'"}
    
    task_id = str(uuid.uuid4())[:8]
    
    asyncio.create_task(
        downloader.download(
            video_url=url,
            download_type=download_type,
            is_playlist=is_playlist,
            audio_quality=audio_quality,
            video_quality=video_quality,
            progress_callback=broadcast_progress
        )
    )
    
    format_text = "MP3" if download_type == "audio" else "MP4"
    mode_text = "Playlist" if is_playlist else "Video"
    
    return {
        "task_id": task_id,
        "message": f"{mode_text} download started ({format_text})",
        "format": format_text,
        "mode": mode_text
    }


if __name__ == "__main__":
    import uvicorn
    import sys
    
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    
    print(f"""
╔═══════════════════════════════════════════════════════════╗
║       PyTube-AudioHub - YouTube Downloader v2.1           ║
║    Download MP3/MP4 with Playlist Support                 ║
╠═══════════════════════════════════════════════════════════╣
║  Local:   http://localhost:{port}                          ║
║  Network: http://{host}:{port}                            ║
║  WebSocket: ws://{host}:{port}/ws/progress               ║
╠═══════════════════════════════════════════════════════════╣
║  Features:                                                ║
║  - MP3 Audio Download (Default)                           ║
║  - MP4 Video Download                                     ║
║  - Playlist Support (ZIP Archive)                        ║
║  - Real-time Progress Updates                             ║
╠═══════════════════════════════════════════════════════════╣
║  Press Ctrl+C to stop                                     ║
╚═══════════════════════════════════════════════════════════╝
    """)
    
    try:
        uvicorn.run(
            "app:app",
            host=host,
            port=port,
            reload=False,
            log_level="info"
        )
    except KeyboardInterrupt:
        print("\n\nServer stopped. Goodbye!")
        sys.exit(0)
