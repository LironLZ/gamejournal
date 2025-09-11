# core/views.py
import os
import re
import requests

from django.conf import settings
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.db.models import Count, Q

from rest_framework import status, viewsets, permissions
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from drf_spectacular.utils import extend_schema, OpenApiExample

from .models import GameEntry, PlaySession, Game
from .serializers import (
    RegisterSerializer,
    GameEntrySerializer,
    PlaySessionSerializer,
    GameWriteSerializer,
    PublicEntrySerializer,
)

RAWG_API_KEY = os.environ.get("RAWG_API_KEY")


# ---------- Health ----------
@api_view(["GET"])
@permission_classes([AllowAny])
def ping(request):
    return Response({"status": "ok", "app": "GameJournal"})


# ---------- Auth ----------
@extend_schema(
    request=RegisterSerializer,
    examples=[OpenApiExample("Register example", value={"username": "tester", "password": "secret123"})],
    responses={201: {"type": "object", "properties": {"ok": {"type": "boolean"}}}},
)
@api_view(["POST"])
@permission_classes([AllowAny])
@authentication_classes([])  # ignore Authorization header here
def register(request):
    """
    Public password registration.
    In production we usually keep this OFF (SSO-only) by setting ALLOW_REGISTRATION=false.
    Flip it on in dev or if you want to allow password signups.
    """
    if not settings.ALLOW_REGISTRATION:
        return Response({"detail": "Registration is closed."}, status=status.HTTP_403_FORBIDDEN)

    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response({"ok": True}, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def whoami(request):
    return Response({"user": request.user.username})


# ---------- Account: change username (first login nickname picker) ----------
@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_username(request):
    """
    PATCH /api/account/username/  { "username": "new_handle" }
    Rules: 3–20 chars, letters/numbers/underscore. Unique (case-insensitive).
    """
    new = (request.data.get("username") or "").strip()
    if not re.fullmatch(r"[A-Za-z0-9_]{3,20}", new):
        return Response({"detail": "Username must be 3–20 chars; letters, numbers, '_' only."}, status=400)

    User = get_user_model()
    if User.objects.filter(username__iexact=new).exists():
        return Response({"detail": "Username already taken."}, status=409)

    u = request.user
    u.username = new
    u.save(update_fields=["username"])
    return Response({"ok": True, "username": u.username})


# ---------- Stats (private) ----------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_stats(request):
    """
    Private dashboard stats for the authenticated user.
    """
    qs = GameEntry.objects.filter(user=request.user)
    data = {
        "total": qs.count(),
        "planning": qs.filter(status=GameEntry.Status.PLANNING).count(),
        "playing": qs.filter(status=GameEntry.Status.PLAYING).count(),
        "played": qs.filter(status=GameEntry.Status.PLAYED).count(),
        "dropped": qs.filter(status=GameEntry.Status.DROPPED).count(),
        "completed": qs.filter(status=GameEntry.Status.COMPLETED).count(),
    }
    return Response(data)


# ---------- Public profile (read-only) ----------
@api_view(["GET"])
@permission_classes([AllowAny])
def public_profile(request, username: str):
    """
    Public read-only profile for a given username.
    Returns user basics, aggregate stats (no minutes), and entries (with slim game info).
    """
    User = get_user_model()
    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

    qs = (
        GameEntry.objects
        .filter(user=user)
        .select_related("game")
        .order_by("-updated_at")
    )

    stats = qs.aggregate(
        total=Count("id"),
        planning=Count("id", filter=Q(status=GameEntry.Status.PLANNING)),
        playing=Count("id", filter=Q(status=GameEntry.Status.PLAYING)),
        played=Count("id", filter=Q(status=GameEntry.Status.PLAYED)),
        dropped=Count("id", filter=Q(status=GameEntry.Status.DROPPED)),
        completed=Count("id", filter=Q(status=GameEntry.Status.COMPLETED)),
    )

    entries = PublicEntrySerializer(qs, many=True).data

    return Response({
        "user": {
            "username": user.username,
            "joined": user.date_joined.isoformat(),
        },
        "stats": stats,
        "entries": entries,
    })


# ---------- RAWG search & import ----------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def search_games_external(request):
    """
    Proxy to RAWG: /api/search/games/?q=<query>
    Returns up to 8 results with: rawg_id, title, release_year, background_image.
    """
    q = (request.query_params.get("q") or "").strip()
    if not q:
        return Response([])

    if not RAWG_API_KEY:
        return Response({"detail": "RAWG_API_KEY missing on server"}, status=500)

    r = requests.get(
        "https://api.rawg.io/api/games",
        params={"key": RAWG_API_KEY, "search": q, "page_size": 8},
        timeout=10,
    )
    r.raise_for_status()
    results = r.json().get("results", [])
    items = []
    for g in results:
        released = g.get("released") or ""
        items.append({
            "source": "rawg",
            "rawg_id": g.get("id"),
            "title": g.get("name"),
            "release_year": int(released[:4]) if released[:4].isdigit() else None,
            "background_image": g.get("background_image"),
        })
    return Response(items)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def import_game(request):
    """
    Body: {"rawg_id": <int>}
    Fetch RAWG detail and create/update a local Game; returns the local game info.
    """
    rawg_id = request.data.get("rawg_id")
    if not rawg_id:
        return Response({"detail": "rawg_id required"}, status=400)

    if not RAWG_API_KEY:
        return Response({"detail": "RAWG_API_KEY missing on server"}, status=500)

    r = requests.get(
        f"https://api.rawg.io/api/games/{rawg_id}",
        params={"key": RAWG_API_KEY},
        timeout=10,
    )
    r.raise_for_status()
    g = r.json()

    title = g.get("name") or "Unknown"
    released = g.get("released") or ""
    year = int(released[:4]) if released[:4].isdigit() else None
    cover = g.get("background_image")

    game, created = Game.objects.get_or_create(
        title=title,
        defaults={"release_year": year, "cover_url": cover},
    )
    if not created and cover and not game.cover_url:
        game.cover_url = cover
        game.save(update_fields=["cover_url"])

    return Response(
        {"id": game.id, "title": game.title, "release_year": game.release_year, "cover_url": game.cover_url},
        status=201
    )


# ---------- Permissions ----------
class IsOwner(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if isinstance(obj, GameEntry):
            return obj.user == request.user
        if isinstance(obj, PlaySession):
            return obj.entry.user == request.user
        return True


# ---------- ViewSets ----------
class GameEntryViewSet(viewsets.ModelViewSet):
    serializer_class = GameEntrySerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]

    def get_queryset(self):
        return (
            GameEntry.objects
            .filter(user=self.request.user)
            .select_related("game")
            .order_by("-updated_at")
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class PlaySessionViewSet(viewsets.ModelViewSet):
    serializer_class = PlaySessionSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]

    def get_queryset(self):
        entry_id = self.kwargs["entry_pk"]
        return (
            PlaySession.objects
            .filter(entry__id=entry_id, entry__user=self.request.user)
            .order_by("-played_on", "-id")
        )

    def perform_create(self, serializer):
        entry_id = self.kwargs["entry_pk"]
        entry = get_object_or_404(GameEntry, id=entry_id, user=self.request.user)
        serializer.save(entry=entry)


class GameViewSet(viewsets.ModelViewSet):
    serializer_class = GameWriteSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = Game.objects.all().order_by("-id")
        q = self.request.query_params.get("q")
        if q:
            qs = qs.filter(title__icontains=q)
        return qs
