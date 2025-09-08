# GameJournal
Track your gaming progress (like MyAnimeList, but for games).

## Features (MVP)
- 🔐 JWT auth (register, login, whoami)
- 🎮 Games CRUD (API + simple UI)
- 📝 Personal entries with statuses (Planning, Playing, Completed…)
- 🔎 RAWG-powered search to import games
- 📊 Stats (totals by status, total minutes)

## Stack
- **Backend:** Django, DRF, SimpleJWT, drf-spectacular (Swagger), CORS, drf-nested-routers
- **Frontend:** React (Vite + TS), axios, react-router-dom

## Quick Start

### Backend
```bash
cd backend
python -m venv venv
# PowerShell:
.\venv\Scripts\Activate.ps1

pip install --upgrade pip
pip install django djangorestframework djangorestframework-simplejwt drf-spectacular django-cors-headers drf-nested-routers python-dotenv requests

# env
# create backend/.env with:
# RAWG_API_KEY=YOUR_KEY_HERE

python manage.py migrate
python manage.py runserver
# API docs: http://127.0.0.1:8000/api/docs/
