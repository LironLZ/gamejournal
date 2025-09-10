# backend/core/views_public.py
from datetime import timedelta

from django.db.models import Avg, Count, Max, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
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
        ratings_count=Count("entries", filter=Q(entries__score__isnull=False), distinct=True),
        avg_score=Avg("entries__score", filter=Q(entries__score__isnull=False)),
        last_entry_at=Max("entries__updated_at"),
        recent_count=Count("entries", filter=Q(entries__updated_at__gte=cutoff)),
    )

    if sort == "trending":
        qs = qs.order_by("-recent_count", "-ratings_count", "-last_entry_at", "title")
    elif sort == "top":
        qs = qs.filter(ratings_count__gte=3).order_by("-avg_score", "-ratings_count", "title")
    elif sort == "new":
        qs = qs.order_by("-release_year", "-recent_count", "-ratings_count", "title")
    elif sort == "popular":
        qs = qs.order_by("-ratings_count", "-avg_score", "title")
    else:
        qs = qs.order_by("-recent_count", "-ratings_count", "-last_entry_at", "title")

    slice_qs = qs[offset : offset + limit]

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
    Public details for a single game: aggregates + recent activity.
    """
    # Ensure the game exists
    get_object_or_404(Game, pk=game_id)

    # Aggregate metrics
    g = (
        Game.objects.filter(pk=game_id)
        .annotate(
            avg_score=Avg("entries__score", filter=Q(entries__score__isnull=False)),
            ratings_count=Count("entries", filter=Q(entries__score__isnull=False), distinct=True),
            last_entry_at=Max("entries__updated_at"),
            planning_count=Count("entries", filter=Q(entries__status=GameEntry.Status.PLANNING)),
            playing_count=Count("entries", filter=Q(entries__status=GameEntry.Status.PLAYING)),
            paused_count=Count("entries", filter=Q(entries__status=GameEntry.Status.PAUSED)),
            dropped_count=Count("entries", filter=Q(entries__status=GameEntry.Status.DROPPED)),
            completed_count=Count("entries", filter=Q(entries__status=GameEntry.Status.COMPLETED)),
        )
        .values(
            "id",
            "title",
            "release_year",
            "cover_url",
            "avg_score",
            "ratings_count",
            "last_entry_at",
            "planning_count",
            "playing_count",
            "paused_count",
            "dropped_count",
            "completed_count",
        )
        .first()
    )

    # Recent activity (no notes to avoid oversharing by default)
    recent = list(
        GameEntry.objects.filter(game_id=game_id)
        .select_related("user")
        .order_by("-updated_at")
        .values(
            "id",
            "user__username",
            "status",
            "score",
            "finished_at",
            "updated_at",
        )[:20]
    )

    return Response({"game": g, "recent_entries": recent})
