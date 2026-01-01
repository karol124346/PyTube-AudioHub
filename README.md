# PyTube-AudioHub

<div align="center">

![YouTube Downloader](https://img.shields.io/badge/YouTube-Audio%20Downloader-red?style=for-the-badge&logo=youtube)
![Python](https://img.shields.io/badge/Python-3.8+-blue?style=for-the-badge&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104-green?style=for-the-badge&logo=fastapi)
![License](https://img.shields.io/badge/License-Educational-purple?style=for-the-badge)

**Download YouTube videos as MP3 with video preview, ID3 metadata, and a beautiful web interface.**

[![Stars](https://img.shields.io/github/stars/josevdr95new/PyTube-AudioHub?style=social)](https://github.com/josevdr95new/PyTube-AudioHub/stargazers)
[![Forks](https://img.shields.io/github/forks/josevdr95new/PyTube-AudioHub?style=social)](https://github.com/josevdr95new/PyTube-AudioHub/network)
![Issues](https://img.shields.io/github/issues/josevdr95new/PyTube-AudioHub)

[English](README.md) | [Español](README_ES.md)

</div>

## Key Features

- **Smart Search** - Search videos by name or paste YouTube URLs
- **Video Preview** - Play videos directly in the application
- **Audio Player** - Listen to your downloaded MP3s with full controls
- **Automatic ID3 Metadata** - Title, artist, album, and embedded cover art
- **MP3 Download** - High quality (192kbps) with automatic conversion
- **Termux Support** - Works on Android with Termux
- **Dark Mode** - Modern and responsive design for all devices

## Quick Installation

### On PC (Windows, Linux, macOS)

```bash
# Clone the repository
git clone https://github.com/josevdr95new/PyTube-AudioHub.git
cd PyTube-AudioHub

# Install FFmpeg
# Ubuntu/Debian: sudo apt install ffmpeg
# macOS: brew install ffmpeg
# Windows: https://ffmpeg.org/download.html

# Create virtual environment and install dependencies
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Start the application
python app.py
```

### On Termux (Android)

```bash
# Install Termux from F-Droid or Play Store

# Update and install Python
pkg update && pkg upgrade
pkg install python git ffmpeg

# Clone the repository
git clone https://github.com/josevdr95new/PyTube-AudioHub.git
cd PyTube-AudioHub

# Grant storage permissions
termux-setup-storage

# Install dependencies
pip install -r requirements.txt

# Start the application
python app.py
```

The application will be available at: **http://localhost:8000**

## User Guide

1. Open `http://localhost:8000` in your browser
2. Type a video name or paste a YouTube URL
3. Click **Search**
4. To preview a video, click the **play button**
5. To download, click **"Download MP3"**
6. Files are saved in the `downloads/` folder
7. Click the **play button** to listen to your downloaded MP3s

## Project Structure

```
PyTube-AudioHub/
├── app.py                    # Main FastAPI server
├── requirements.txt          # Python dependencies
├── README.md                 # English documentation
├── README_ES.md              # Spanish documentation
├── services/                 # Server logic
│   ├── __init__.py
│   ├── downloader.py         # Download + ID3 metadata
│   ├── youtube.py            # Search service
│   └── youtube_scraper.py    # Video scraping
├── static/                   # Frontend resources
│   ├── css/
│   │   └── style.css         # Modern styles
│   └── js/
│       └── app.js            # Interactive frontend
└── templates/
    └── index.html            # Complete web interface
```

## Technologies Used

| Category | Technology |
|----------|------------|
| **Backend** | FastAPI + Python |
| **Download Engine** | yt-dlp |
| **Audio Processing** | FFmpeg + Mutagen |
| **Frontend** | HTML5 + CSS3 + Vanilla JS |
| **Communication** | REST API + WebSockets |

## Technical Features

- ✅ 192kbps MP3 download
- ✅ ID3 Metadata (TIT2, TPE1, TALB, APIC)
- ✅ Real-time progress via WebSockets
- ✅ Video search without API key
- ✅ Responsive design (mobile-friendly)
- ✅ Optimized dark theme

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License and Disclaimer

This is an **educational project** created to learn about web development with FastAPI and Python.

**This software is provided "as is" without any warranties.**

Using this application to download YouTube content may violate YouTube's Terms of Service. The user is responsible for complying with applicable copyright laws in their country.

**We are not responsible for any misuse of this tool.**

---

<div align="center">

**⭐ If you like this project, don't forget to star it on GitHub!**

Made with ❤️ by [josevdr95](https://github.com/josevdr95new)

**Repository**: https://github.com/josevdr95new/PyTube-AudioHub

</div>
