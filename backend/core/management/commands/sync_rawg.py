# core/management/commands/sync_rawg.py
import os, re, time, requests
from django.core.management.base import BaseCommand
from django.db import transaction
from core.models import Game, Genre

RAWG_KEY = os.environ.get("RAWG_API_KEY")

def strip_html(s: str) -> str:
    return re.sub(r"<[^>]+>", "", s or "").strip()

class Command(BaseCommand):
    help = "Backfill Game.description and genres from RAWG"

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=200)

    def handle(self, *args, **opts):
        if not RAWG_KEY:
            self.stderr.write("RAWG_API_KEY not set")
            return

        qs = Game.objects.all().order_by("id")
        updated = 0
        for game in qs[: opts["limit"]]:
            try:
                raw = None
                if game.rawg_id:
                    url = f"https://api.rawg.io/api/games/{game.rawg_id}?key={RAWG_KEY}"
                    raw = requests.get(url, timeout=10).json()
                else:
                    # search by title (and year if you have it)
                    q = game.title
                    url = f"https://api.rawg.io/api/games?search={requests.utils.quote(q)}&key={RAWG_KEY}"
                    if game.release_year:
                        url += f"&dates={game.release_year}-01-01,{game.release_year}-12-31"
                    res = requests.get(url, timeout=10).json()
                    results = (res or {}).get("results") or []
                    if results:
                        rawg_id = results[0]["id"]
                        game.rawg_id = rawg_id
                        game.save(update_fields=["rawg_id"])
                        url = f"https://api.rawg.io/api/games/{rawg_id}?key={RAWG_KEY}"
                        raw = requests.get(url, timeout=10).json()

                if not raw: 
                    continue

                changed = False
                desc = strip_html(raw.get("description_raw") or raw.get("description") or "")
                if desc and not game.description:
                    game.description = desc
                    changed = True

                raw_genres = [g["name"] for g in (raw.get("genres") or []) if g.get("name")]
                if raw_genres:
                    with transaction.atomic():
                        for name in raw_genres:
                            g, _ = Genre.objects.get_or_create(name=name)
                            game.genres.add(g)
                    changed = True

                if changed:
                    game.save()
                    updated += 1
                    self.stdout.write(f"Updated {game.title}")

                time.sleep(0.25)  # be nice to the API
            except Exception as e:
                self.stderr.write(f"[{game.id}] {game.title}: {e}")

        self.stdout.write(self.style.SUCCESS(f"Done. Updated {updated} games."))
