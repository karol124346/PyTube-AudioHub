# PyTube-AudioHub

<div align="center">

![YouTube Downloader](https://img.shields.io/badge/YouTube-Audio%20Downloader-red?style=for-the-badge&logo=youtube)
![Python](https://img.shields.io/badge/Python-3.8+-blue?style=for-the-badge&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104-green?style=for-the-badge&logo=fastapi)
![License](https://img.shields.io/badge/License-Educational-purple?style=for-the-badge)

**Descarga videos de YouTube como MP3 con vista previa de video, metadatos ID3 y una hermosa interfaz web.**

[![Stars](https://img.shields.io/github/stars/josevdr95new/PyTube-AudioHub?style=social)](https://github.com/josevdr95new/PyTube-AudioHub/stargazers)
[![Forks](https://img.shields.io/github/forks/josevdr95new/PyTube-AudioHub?style=social)](https://github.com/josevdr95new/PyTube-AudioHub/network)
![Issues](https://img.shields.io/github/issues/josevdr95new/PyTube-AudioHub)

[English](README.md) | [Español](README_ES.md)

</div>

## Características Principales

- **Búsqueda Inteligente** - Busca videos por nombre o pega URLs de YouTube
- **Vista Previa de Video** - Reproduce videos directamente en la aplicación
- **Reproductor de Audio** - Escucha tus MP3 descargados con controles completos
- **Metadatos ID3 Automáticos** - Título, artista, álbum y portada embebida
- **Descarga en MP3** - Alta calidad (192kbps) con conversión automática
- **Soporte para Termux** - Funciona en Android con Termux
- **Interfaz Oscura** - Diseño moderno y responsivo para todos los dispositivos

## Instalación Rápida

### En PC (Windows, Linux, macOS)

```bash
# Clonar el repositorio
git clone https://github.com/josevdr95new/PyTube-AudioHub.git
cd PyTube-AudioHub

# Instalar FFmpeg
# Ubuntu/Debian: sudo apt install ffmpeg
# macOS: brew install ffmpeg
# Windows: https://ffmpeg.org/download.html

# Crear entorno virtual e instalar dependencias
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Iniciar la aplicación
python app.py
```

### En Termux (Android)

```bash
# Instalar Termux desde F-Droid o Play Store

# Actualizar e instalar Python
pkg update && pkg upgrade
pkg install python git ffmpeg

# Clonar el repositorio
git clone https://github.com/josevdr95new/PyTube-AudioHub.git
cd PyTube-AudioHub

# Dar permisos de almacenamiento
termux-setup-storage

# Instalar dependencias
pip install -r requirements.txt

# Iniciar la aplicación
python app.py
```

La aplicación estará disponible en: **http://localhost:8000**

## Guía de Uso

1. Abre `http://localhost:8000` en tu navegador
2. Escribe el nombre de un video o pega una URL de YouTube
3. Haz clic en **Buscar**
4. Para previsualizar un video, haz clic en el **botón de reproducción**
5. Para descargar, haz clic en **"Descargar MP3"**
6. Los archivos se guardan en la carpeta `downloads/`
7. Haz clic en el **botón de reproducción** para escuchar tus MP3

## Estructura del Proyecto

```
PyTube-AudioHub/
├── app.py                    # Servidor FastAPI principal
├── requirements.txt          # Dependencias Python
├── README.md                 # Documentación en inglés
├── README_ES.md              # Documentación en español
├── services/                 # Lógica del servidor
│   ├── __init__.py
│   ├── downloader.py         # Descarga + metadatos ID3
│   ├── youtube.py            # Servicio de búsqueda
│   └── youtube_scraper.py    # Scraping de videos
├── static/                   # Recursos frontend
│   ├── css/
│   │   └── style.css         # Estilos modernos
│   └── js/
│       └── app.js            # Frontend interactivo
└── templates/
    └── index.html            # Interfaz web completa
```

## Tecnologías Utilizadas

| Categoría | Tecnología |
|-----------|------------|
| **Backend** | FastAPI + Python |
| **Motor de Descarga** | yt-dlp |
| **Procesamiento de Audio** | FFmpeg + Mutagen |
| **Frontend** | HTML5 + CSS3 + Vanilla JS |
| **Comunicación** | REST API + WebSockets |

## Características Técnicas

- ✅ Descarga de MP3 en 192kbps
- ✅ Metadatos ID3 (TIT2, TPE1, TALB, APIC)
- ✅ Progreso en tiempo real vía WebSockets
- ✅ Búsqueda de videos sin API key
- ✅ Diseño responsivo (mobile-friendly)
- ✅ Tema oscuro optimizado

## Contribuciones

¡Las contribuciones son bienvenidas! Por favor:

1. Haz fork del repositorio
2. Crea una rama (`git checkout -b feature/amazing-feature`)
3. Commit tus cambios (`git commit -m 'Add amazing feature'`)
4. Push a la rama (`git push origin feature/amazing-feature`)
5. Abre un Pull Request

## Licencia y Descargo de Responsabilidad

Este es un proyecto de **finalidad educativa** creado para aprender sobre desarrollo web con FastAPI y Python.

**Este software se proporciona "tal cual" sin garantías de ningún tipo.**

El uso de esta aplicación para descargar contenido de YouTube puede violar los Términos de Servicio de YouTube. El usuario es responsable de cumplir con las leyes de derechos de autor aplicables en su país.

**No nos hacemos responsables del uso indebido de esta herramienta.**

---

<div align="center">

**⭐ Si te gusta este proyecto, no olvides darle una estrella en GitHub!**

Hecho con ❤️ por [josevdr95](https://github.com/josevdr95new)

**Repositorio**: https://github.com/josevdr95new/PyTube-AudioHub

</div>
