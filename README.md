# GameJournal

A lightweight game tracker with a social layer. Log what you’re playing, rate and review games, follow friends, and browse community activity.

This repo contains a **Django REST API** (backend) and a **React + Vite + TypeScript** app (frontend) styled with **Tailwind**.

---

## Highlights

- **Auth**
  - Google Sign-In (JWT issued by the backend)
  - Optional password login & registration (feature-flagged)
- **Journal**
  - Personal entries per game: status, score, notes
- **Discover**
  - Public game pages with community stats
  - Optional import from RAWG (title, cover, description, genres)
- **Social**
  - Friends, requests, and a personalized activity feed
  - Public profiles with stats and favorites (up to 9)
- **Nice to have**
  - Dark/light theme toggle
  - Avatars (local storage by default; Cloudinary optional)
  - Clean, mobile-friendly UI

---

## Stack

- **Backend:** Django 5, DRF, SimpleJWT, django-cors-headers, drf-spectacular  
  *(optional)* Cloudinary for user-uploaded avatars
- **Frontend:** React 18, Vite, TypeScript, TailwindCSS
- **Auth:** Google Identity Services → backend verifies Google ID token → mints JWT

---

## Monorepo layout

```
backend/
  core/                 # Django app (models, views, serializers)
  gamejournal_backend/  # settings, urls, wsgi
  requirements.txt
  .env                  # backend env (see below)

frontend/
  src/                  # React app
  index.html
  vite.config.ts
  .env                  # frontend env (see below)
```

---

## Quick start (local)

> Prereqs: Python 3.11+ (3.12 works), Node 18+.

### 1) Backend

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env   # or create .env with the values below
python manage.py migrate
python manage.py runserver
```

The API will run on `http://127.0.0.1:8000/`.

### 2) Frontend

```bash
cd frontend
npm i
cp .env.example .env   # or create .env with the values below
npm run dev
```

The app will run on `http://localhost:5173/`.

---

## Environment variables

### Backend: `backend/.env`

```ini
# General
DEBUG=True
ALLOWED_HOSTS=127.0.0.1,localhost

# JWT defaults are OK (see settings.py)

# Google SSO
GOOGLE_OAUTH_CLIENT_ID=714984890272-eqs9mq55l6q87rrghk74ei5chmpk6avr.apps.googleusercontent.com

# Optional: restrict who can sign in via Google
ENFORCE_ALLOWLIST=false
ALLOWED_EMAILS=

# Optional: enable password login/registration (dev only)
ALLOW_PASSWORD_LOGIN=true
ALLOW_REGISTRATION=false

# RAWG import (only used for search/import endpoints)
RAWG_API_KEY=434b133645f94021b0d60eab52a42910

# Optional: Cloudinary to store avatars in the cloud
# Example: CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
CLOUDINARY_URL=
```

### Frontend: `frontend/.env`

```ini
# Point frontend to your backend API base path
VITE_API_URL=http://127.0.0.1:8000/api

# Google SSO: must match backend's client id exactly
VITE_GOOGLE_OAUTH_CLIENT_ID=714984890272-eqs9mq55l6q87rrghk74ei5chmpk6avr.apps.googleusercontent.com

# Show/hide UI for optional password login & register
VITE_ENABLE_PASSWORD_LOGIN=true
VITE_ENABLE_REGISTER=false
```

> **Important:** The **Google client id** must be identical in **both** `.env` files.  
> For local dev, add `http://localhost:5173` to **Authorized JavaScript origins** in your Google OAuth client.

---

## First run checklist

1. **Start backend** (`python manage.py runserver`)
2. **Start frontend** (`npm run dev`)
3. Open `http://localhost:5173/` and use **Sign in with Google**.
4. If you enabled password login:
   - (Optional) `python manage.py createsuperuser` or hit `/auth/register/` if allowed.

---

## Common routes (frontend)

- `/` – Landing (or redirects to Entries if logged in)
- `/discover` – Browse games
- `/game/:gameId` – Public game page (stats + recent entries)
- `/login` – Google SSO (password form optional)
- `/entries` – Your journal (**protected**)
- `/wishlist` – Your wishlist (**protected**)
- `/feed` – Friends + your activity (**protected**)
- `/u/:username` – Public profile
- `/settings/profile` – Avatar / profile settings (**protected**)

---

## API overview (backend)

Base: `/api/`

- **Auth**
  - `POST /auth/google/` → `{access, refresh, user, created}`
  - `POST /auth/login/` (JWT by username/password; feature-flagged)
  - `POST /auth/refresh/` (refresh to new access)
  - `GET /auth/whoami/` → `{user, avatar_url}` (requires JWT)

- **Account**
  - `PATCH /account/username/` → change username
  - `POST /account/avatar/` (multipart `avatar`) → `{avatar_url}`

- **Journal**
  - `GET/POST /entries/`
  - `GET/PATCH/DELETE /entries/:id/`
  - `GET/POST /entries/:entry_id/sessions/`
  - `GET/PATCH/DELETE /entries/:entry_id/sessions/:id/`

- **Games**
  - `GET /public/games/` (discover lists)
  - `GET /public/games/:id/` (public game detail)
  - `GET /games/?q=...` (admin/editor use)
  - `GET /search/games/?q=...` (RAWG search; requires `RAWG_API_KEY`)
  - `POST /import/game/` `{rawg_id}` (imports title/cover/desc/genres)

- **Social**
  - `GET /feed/?limit=&offset=` (me + friends)
  - `GET/POST /friends/requests/` (+ `/accept/`, `/decline/`, `/cancel/`)
  - `GET /friends/` (my friends)
  - `GET /friends/:username/` (someone’s public list)
  - `DELETE /friends/:username/` (unfriend)

- **Profiles**
  - `GET /users/?q=li` (search users; JWT required)
  - `GET /users/:username/` (public profile with stats & entries)
  - `GET/PUT /me/favorites/` (list / reorder favorites)

---

## Development notes

- **Axios** automatically attaches the JWT access token and silently refreshes on 401.
- **Tailwind** utilities live in `frontend/index.css` (with some component classes).
- Landing page uses images at `public/landing/slide1.webp`, `slide2.png` … (optional).
- Static files are served by **WhiteNoise** in production; media (avatars) are local unless `CLOUDINARY_URL` is set.

---

## Production checklist

- **Backend env**
  - `DEBUG=False`
  - `ALLOWED_HOSTS=your.domain`
  - Set `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` if not using a reverse proxy with same domain
  - Configure `DATABASE_URL` (Postgres recommended)
  - Consider `CLOUDINARY_URL` for avatars
- **Frontend env**
  - `VITE_API_URL=https://your-backend.example.com/api`
  - `VITE_GOOGLE_OAUTH_CLIENT_ID=...` (prod client id)
- Build & deploy frontend (`npm run build`; publish `dist/`).
- Run `python manage.py collectstatic` if serving any admin/static via backend.

---

## Troubleshooting

**“Invalid Google token (used too early)”**  
Your machine clock is ahead/behind. Sync your system time (Windows: *Date & Time → Sync now*; macOS: *Date & Time → Set automatically*).

**“Invalid Google token” (400 from `/auth/google/`)**
- The client id in **frontend** and **backend** don’t match.
- Your Google OAuth “Authorized JavaScript origins” does not include `http://localhost:5173`.
- You’re using a prod client id on localhost (or vice-versa).

**Discover page shows 500/404**  
- `/public/games/` should work without RAWG.  
- Only `/search/games/` and `/import/game/` need `RAWG_API_KEY`.

**CORS errors**  
Make sure `VITE_API_URL` points to the correct backend URL and your backend CORS/CSRF settings allow your frontend origin in production.

---

## Scripts you’ll use a lot

```bash
# Backend
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver

# Frontend
npm run dev
npm run build
```

---

## Contributing
Thanks for your interest in contributing! 🎉

### Ways to help
- Report bugs and issues
- Suggest features and UX improvements
- Submit small, focused pull requests

---

## License
This project is open source under the MIT License. See [LICENSE](./LICENSE) for details.
