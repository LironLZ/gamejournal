# backend/core/views_public.py
from datetime import timedelta

from django.db.models import Avg, Count, Max, Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Game


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
    except Exception:
        limit = 24
    try:
        offset = max(0, int(request.GET.get("offset", 0)))
    except Exception:
        offset = 0

    qs = Game.objects.all()
    if q:
        qs = qs.filter(title__icontains=q)

    # “recent” window for trending
    cutoff = timezone.now() - timedelta(days=90)

    # aggregate over related entries
    qs = qs.annotate(
        ratings_count=Count("entries", filter=Q(entries__score__isnull=False)),
        avg_score=Avg("entries__score", filter=Q(entries__score__isnull=False)),
        last_entry_at=Max("entries__updated_at"),
        recent_count=Count("entries", filter=Q(entries__updated_at__gte=cutoff)),
    )

    if sort == "trending":
        # recent activity first, then overall activity
        qs = qs.order_by("-recent_count", "-ratings_count", "-last_entry_at", "title")
    elif sort == "top":
        # Show anything with at least 1 scored rating so the feed isn't empty on small datasets
        qs = qs.filter(ratings_count__gt=0).order_by(
            "-avg_score", "-ratings_count", "-last_entry_at", "title"
        )
    elif sort == "new":
        # recently released (fallback to activity as tiebreakers)
        qs = qs.order_by("-release_year", "-recent_count", "-ratings_count", "title")
    elif sort == "popular":
        # most rated overall
        qs = qs.order_by("-ratings_count", "-avg_score", "title")
    else:
        # default: trending
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
