# core/views.py
import os
import re
import requests

from django.conf import settings
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.db.models import Count, Q
from django.utils import timezone

from rest_framework import status, viewsets, permissions, mixins
from rest_framework.decorators import (
    api_view, permission_classes, authentication_classes, action, parser_classes
)
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from drf_spectacular.utils import extend_schema, OpenApiExample

from .models import (
    GameEntry, PlaySession, Game, Profile, Activity,
    Friendship, FriendRequest,
)
from .serializers import (
    RegisterSerializer,
    GameEntrySerializer,
    PlaySessionSerializer,
    GameWriteSerializer,
    PublicEntrySerializer,
    ActivitySerializer,
    FriendMiniSerializer,       # for public friends preview
    FriendshipSerializer,       # for returning my friends
    FriendRequestSerializer,    # for listing/creating requests (uses to_user_id)
)

RAWG_API_KEY = os.environ.get("RAWG_API_KEY")
User = get_user_model()


def _log_activity(user, entry, verb, *, status=None, score=None):
    """Create an Activity row when a user changes status or rating."""
    Activity.objects.create(
        actor=user,
        game=entry.game,
        entry=entry,
        verb=verb,
        status=status,
        score=score,
    )


# ---------- Helpers: friendships ----------
def _friend_ids_of(user: User):
    """Return list of user IDs who are friends with `user`."""
    a = Friendship.objects.filter(user_a=user).values_list("user_b_id", flat=True)
    b = Friendship.objects.filter(user_b=user).values_list("user_a_id", flat=True)
    return list(a) + list(b)


def _are_friends(a: User, b: User) -> bool:
    return Friendship.objects.filter(
        Q(user_a=a, user_b=b) | Q(user_a=b, user_b=a)
    ).exists()


def _ensure_friendship(a: User, b: User):
    """Create a Friendship if it doesn't exist (idempotent)."""
    if not _are_friends(a, b):
        Friendship.objects.create(user_a=a, user_b=b)


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
    if not getattr(settings, "ALLOW_REGISTRATION", False):
        return Response({"detail": "Registration is closed."}, status=status.HTTP_403_FORBIDDEN)

    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response({"ok": True}, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def whoami(request):
    """Return basic identity + avatar URL for navbar/settings."""
    avatar_url = None
    prof = getattr(request.user, "profile", None)
    if prof and prof.avatar:
        try:
            avatar_url = request.build_absolute_uri(prof.avatar.url)
        except Exception:
            avatar_url = None
    return Response({"user": request.user.username, "avatar_url": avatar_url})


# ---------- Account: change username ----------
@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_username(request):
    new = (request.data.get("username") or "").strip()
    if not re.fullmatch(r"[A-Za-z0-9_]{3,20}", new):
        return Response({"detail": "Username must be 3–20 chars; letters, numbers, '_' only."}, status=400)

    if User.objects.filter(username__iexact=new).exists():
        return Response({"detail": "Username already taken."}, status=409)

    u = request.user
    u.username = new
    u.save(update_fields=["username"])
    return Response({"ok": True, "username": u.username})


# ---------- Account: upload avatar ----------
@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_avatar(request):
    """
    POST multipart/form-data with field 'avatar' (png/jpg/webp).
    Returns: { avatar_url }
    """
    f = request.FILES.get("avatar")
    if not f:
        return Response({"detail": "No file provided (use 'avatar')."}, status=400)

    if f.size > 2 * 1024 * 1024:  # 2MB
        return Response({"detail": "File too large (max 2MB)."}, status=400)

    allowed = {"image/jpeg", "image/png", "image/webp"}
    if f.content_type not in allowed:
        return Response({"detail": "Only JPG/PNG/WebP allowed."}, status=415)

    profile = getattr(request.user, "profile", None)
    if profile is None:
        profile, _ = Profile.objects.get_or_create(user=request.user)

    # stable filename: user-<id>.<ext>
    _, ext = os.path.splitext(f.name or "")
    ext = (ext or ".jpg").lower()
    fname = f"user-{request.user.id}{ext}"

    profile.avatar.save(fname, f, save=True)
    url = request.build_absolute_uri(profile.avatar.url)
    return Response({"avatar_url": url}, status=200)


# ---------- Stats (private) ----------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_stats(request):
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

    # Avatar
    avatar_url = None
    if hasattr(user, "profile") and user.profile.avatar:
        try:
            avatar_url = request.build_absolute_uri(user.profile.avatar.url)
        except Exception:
            avatar_url = None

    entries = PublicEntrySerializer(qs, many=True).data

    # Friends preview (first 12)
    friend_ids = _friend_ids_of(user)
    friends_count = len(friend_ids)
    friends = User.objects.filter(id__in=friend_ids).select_related("profile").order_by("username")[:12]
    friends_preview = FriendMiniSerializer(friends, many=True, context={"request": request}).data

    return Response({
        "user": {
            "id": user.id,
            "username": user.username,
            "joined": user.date_joined.isoformat(),
            "avatar_url": avatar_url,
        },
        "stats": stats,
        "friends": {
            "count": friends_count,
            "preview": friends_preview,
        },
        "entries": entries,
    })


# ---------- Users (search/browse) ----------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def search_users(request):
    """
    GET /api/users/?q=li  -> [{id, username, avatar_url}, ...]
    Privacy-minded:
      - Requires q length >= 2 (no browse-all).
      - Excludes staff/superusers, yourself, existing friends,
        and users with pending requests (either direction).
    """
    q = (request.query_params.get("q") or "").strip()
    if len(q) < 2:
        return Response([])

    qs = (
        User.objects
        .filter(is_active=True, is_staff=False, is_superuser=False)
        .exclude(id=request.user.id)
        .select_related("profile")
    )

    # Exclude existing friends
    friend_ids = _friend_ids_of(request.user)
    if friend_ids:
        qs = qs.exclude(id__in=friend_ids)

    # Exclude pending requests in either direction
    pending_to = FriendRequest.objects.filter(
        from_user=request.user, status=FriendRequest.Status.PENDING
    ).values_list("to_user_id", flat=True)
    pending_from = FriendRequest.objects.filter(
        to_user=request.user, status=FriendRequest.Status.PENDING
    ).values_list("from_user_id", flat=True)
    qs = qs.exclude(id__in=list(pending_to)).exclude(id__in=list(pending_from))

    # Search
    qs = qs.filter(username__icontains=q).order_by("username")[:30]

    # Shape response
    data = []
    for u in qs:
        avatar_url = None
        prof = getattr(u, "profile", None)
        if prof and prof.avatar:
            try:
                avatar_url = request.build_absolute_uri(prof.avatar.url)
            except Exception:
                avatar_url = None
        data.append({"id": u.id, "username": u.username, "avatar_url": avatar_url})
    return Response(data)


# ---------- RAWG search & import ----------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def search_games_external(request):
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
    """
    CRUD for the current user's game entries.

    - GET /api/entries/                -> list my entries
      optional filter: ?game_id=123
    - POST /api/entries/               -> create (requires game_id)
    - PATCH /api/entries/<id>/         -> partial update

    Also logs Activity rows when status/score changes.
    """
    serializer_class = GameEntrySerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]

    def get_queryset(self):
        qs = (
            GameEntry.objects
            .filter(user=self.request.user)
            .select_related("game")
            .order_by("-updated_at")
        )
        gid = self.request.query_params.get("game_id")
        if gid:
            try:
                qs = qs.filter(game_id=int(gid))
            except (TypeError, ValueError):
                pass
        return qs

    def perform_create(self, serializer):
        entry = serializer.save(user=self.request.user)
        s = serializer.validated_data.get("status")
        if s:
            _log_activity(self.request.user, entry, Activity.Verb.STATUS, status=s)
        sc = serializer.validated_data.get("score", None)
        if sc is not None:
            _log_activity(self.request.user, entry, Activity.Verb.RATED, score=sc)

    def perform_update(self, serializer):
        prev_status = serializer.instance.status
        prev_score = serializer.instance.score
        entry = serializer.save()
        if entry.status != prev_status:
            _log_activity(self.request.user, entry, Activity.Verb.STATUS, status=entry.status)
        if entry.score != prev_score and entry.score is not None:
            _log_activity(self.request.user, entry, Activity.Verb.RATED, score=entry.score)


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
        # Optional: log play sessions later with Activity.Verb.SESSION


class GameViewSet(viewsets.ModelViewSet):
    serializer_class = GameWriteSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = Game.objects.all().order_by("-id")
        q = self.request.query_params.get("q")
        if q:
            qs = qs.filter(title__icontains=q)
        return qs


# ---------- Friends: requests + list ----------
class FriendRequestViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """
    /api/friends/requests/               GET   -> {"incoming": [...], "outgoing": [...]}
    /api/friends/requests/               POST  -> create request { "to_user_id": <int> }
    /api/friends/requests/{id}/accept/   POST
    /api/friends/requests/{id}/decline/  POST
    /api/friends/requests/{id}/cancel/   POST
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = FriendRequestSerializer

    def get_queryset(self):
        return FriendRequest.objects.filter(
            Q(from_user=self.request.user) | Q(to_user=self.request.user)
        )

    def list(self, request):
        incoming = FriendRequest.objects.filter(
            to_user=request.user, status=FriendRequest.Status.PENDING
        ).select_related("from_user")
        outgoing = FriendRequest.objects.filter(
            from_user=request.user, status=FriendRequest.Status.PENDING
        ).select_related("to_user")
        return Response({
            "incoming": FriendRequestSerializer(incoming, many=True, context={"request": request}).data,
            "outgoing": FriendRequestSerializer(outgoing, many=True, context={"request": request}).data,
        })

    def create(self, request):
        s = FriendRequestSerializer(data=request.data, context={"request": request})
        s.is_valid(raise_exception=True)
        to_user = s.validated_data["to_user"]
        if to_user == request.user:
            return Response({"detail": "You can't friend yourself."}, status=400)

        if _are_friends(request.user, to_user):
            return Response({"detail": "Already friends."}, status=409)

        # prevent duplicate pending in either direction
        existing = FriendRequest.objects.filter(
            Q(from_user=request.user, to_user=to_user, status=FriendRequest.Status.PENDING) |
            Q(from_user=to_user, to_user=request.user, status=FriendRequest.Status.PENDING)
        ).first()
        if existing:
            return Response(
                {"detail": "A pending request already exists.", "request_id": existing.id},
                status=409,
            )

        fr = FriendRequest.objects.create(from_user=request.user, to_user=to_user)
        return Response(
            FriendRequestSerializer(fr, context={"request": request}).data,
            status=201
        )

    @action(detail=True, methods=["POST"])
    def accept(self, request, pk=None):
        fr = get_object_or_404(
            FriendRequest, pk=pk, to_user=request.user, status=FriendRequest.Status.PENDING
        )
        _ensure_friendship(fr.from_user, fr.to_user)
        fr.status = FriendRequest.Status.ACCEPTED
        fr.responded_at = timezone.now()
        fr.save()
        return Response({"detail": "Friend request accepted."})

    @action(detail=True, methods=["POST"])
    def decline(self, request, pk=None):
        fr = get_object_or_404(
            FriendRequest, pk=pk, to_user=request.user, status=FriendRequest.Status.PENDING
        )
        fr.status = FriendRequest.Status.DECLINED
        fr.responded_at = timezone.now()
        fr.save()
        return Response({"detail": "Friend request declined."})

    @action(detail=True, methods=["POST"])
    def cancel(self, request, pk=None):
        fr = get_object_or_404(
            FriendRequest, pk=pk, from_user=request.user, status=FriendRequest.Status.PENDING
        )
        fr.status = FriendRequest.Status.CANCELED
        fr.responded_at = timezone.now()
        fr.save()
        return Response({"detail": "Friend request canceled."})


class FriendsViewSet(viewsets.ViewSet):
    """
    /api/friends/                GET     -> my friends
    /api/friends/<username>/    GET     -> that user's friends (public list)
    /api/friends/<username>/    DELETE  -> unfriend (must be your friend; username = target)
    """
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        fids = _friend_ids_of(request.user)
        friendships = (
            Friendship.objects
            .filter(Q(user_a_id=request.user.id) | Q(user_b_id=request.user.id))
            .order_by("-created_at")
        )
        data = FriendshipSerializer(friendships, many=True, context={"request": request}).data
        return Response({"count": len(fids), "results": data})

    def retrieve(self, request, pk=None):
        other = get_object_or_404(User, username=pk)
        fids = _friend_ids_of(other)
        friends = User.objects.filter(id__in=fids).select_related("profile").order_by("username")
        results = FriendMiniSerializer(friends, many=True, context={"request": request}).data
        return Response({
            "user": {"id": other.id, "username": other.username},
            "count": len(fids),
            "results": results,
        })

    def destroy(self, request, pk=None):
        other = get_object_or_404(User, username=pk)
        fs = Friendship.objects.filter(Q(user_a=request.user, user_b=other) | Q(user_a=other, user_b=request.user)).first()
        if not fs:
            return Response({"detail": "You are not friends."}, status=400)
        fs.delete()
        return Response(status=204)


# ---------- Feed (me + my friends) ----------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def activity_feed(request):
    """
    GET /api/feed/?limit=50&offset=0
    Activities from me + my friends.
    """
    try:
        limit = max(1, min(int(request.query_params.get("limit", 50)), 200))
    except Exception:
        limit = 50
    try:
        offset = max(0, int(request.query_params.get("offset", 0)))
    except Exception:
        offset = 0

    friend_user_ids = _friend_ids_of(request.user)
    user_ids = friend_user_ids + [request.user.id]

    qs = (
        Activity.objects
        .filter(actor_id__in=user_ids)
        .select_related("game", "actor")
        .order_by("-created_at")
    )[offset: offset + limit]

    data = ActivitySerializer(qs, many=True).data
    return Response(data)
