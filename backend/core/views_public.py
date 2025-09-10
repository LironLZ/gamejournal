# backend/core/views_public.py
from datetime import timedelta

from django.db.models import Avg, Count, Max, Q
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Game, GameEntry


@api_view(["GET"])
@permission_classes([AllowAny])
def discover_games(request):
    """
    Public feed of games with aggregate stats.

    Query params:
      - sort: trending | top | new | popular  (default: trending)
      - q:    search term for title (optional)
      - limit: 1..100 (default 24)
      - offset: >=0 (default 0)
    """
    sort = (request.GET.get("sort") or "trending").lower()
    q = (request.GET.get("q") or "").strip()

    # pagination
    try:
        limit = max(1, min(int(request.GET.get("limit", 24)), 100))
    except ValueError:
        limit = 24
    try:
        offset = max(0, int(request.GET.get("offset", 0)))
    except ValueError:
        offset = 0

    qs = Game.objects.all()
    if q:
        qs = qs.filter(title__icontains=q)

    now = timezone.now()
    cutoff = now - timedelta(days=90)  # “recent” window for trending

    qs = qs.annotate(
        ratings_count=Count("entries", filter=Q(entries__score__isnull=False)),
        avg_score=Avg("entries__score", filter=Q(entries__score__isnull=False)),
        last_entry_at=Max("entries__updated_at"),
        recent_count=Count("entries", filter=Q(entries__updated_at__gte=cutoff)),
    )

    if sort == "trending":
        qs = qs.order_by("-recent_count", "-ratings_count", "-last_entry_at", "title")
    elif sort == "top":
        # show games with at least 1 rating
        qs = qs.filter(ratings_count__gte=1).order_by("-avg_score", "-ratings_count", "title")
    elif sort == "new":
        qs = qs.order_by("-release_year", "-recent_count", "-ratings_count", "title")
    elif sort == "popular":
        qs = qs.order_by("-ratings_count", "-avg_score", "title")
    else:
        qs = qs.order_by("-recent_count", "-ratings_count", "-last_entry_at", "title")

    slice_qs = qs[offset: offset + limit]
    data = list(
        slice_qs.values(
            "id",
            "title",
            "release_year",
            "cover_url",
            "avg_score",
            "ratings_count",
            "last_entry_at",
        )
    )
    return Response(data)


@api_view(["GET"])
@permission_classes([AllowAny])
def game_detail(request, game_id: int):
    """
    Public detail for a single game: basic fields, aggregate stats and recent entries.
    """
    game = get_object_or_404(Game, id=game_id)

    entries_qs = GameEntry.objects.filter(game=game).select_related("user")

    stats = entries_qs.aggregate(
        ratings_count=Count("id", filter=Q(score__isnull=False)),
        avg_score=Avg("score", filter=Q(score__isnull=False)),
        last_entry_at=Max("updated_at"),

        planning=Count("id", filter=Q(status=GameEntry.Status.PLANNING)),
        playing=Count("id", filter=Q(status=GameEntry.Status.PLAYING)),
        played=Count("id", filter=Q(status=GameEntry.Status.PLAYED)),
        dropped=Count("id", filter=Q(status=GameEntry.Status.DROPPED)),
        completed=Count("id", filter=Q(status=GameEntry.Status.COMPLETED)),
    )

    # keep it small & anonymous-ish; include score + note
    recent_entries = list(
        entries_qs.order_by("-updated_at")[:20].values(
            username=Q("user__username"),
            status=Q("status"),
            score=Q("score"),
            notes=Q("notes"),
            started_at=Q("started_at"),
            finished_at=Q("finished_at"),
            updated_at=Q("updated_at"),
        )
    )

    return Response({
        "game": {
            "id": game.id,
            "title": game.title,
            "release_year": game.release_year,
            "cover_url": game.cover_url,
        },
        "stats": stats,
        "entries": recent_entries,
    })
