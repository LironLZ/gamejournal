# core/views.py
from django.shortcuts import get_object_or_404
from django.db.models import Sum

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
)

# ---------- Health ----------
@api_view(['GET'])
@permission_classes([AllowAny])
def ping(request):
    return Response({"status": "ok", "app": "GameJournal"})


# ---------- Auth ----------
@extend_schema(
    request=RegisterSerializer,
    examples=[
        OpenApiExample(
            'Register example',
            value={"username": "tester", "password": "secret123"}
        )
    ],
    responses={201: {"type": "object", "properties": {"ok": {"type": "boolean"}}}}
)
@api_view(["POST"])
@permission_classes([AllowAny])
@authentication_classes([])  # ignore Authorization header here
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response({"ok": True}, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def whoami(request):
    return Response({"user": request.user.username})


# ---------- Stats ----------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_stats(request):
    qs = GameEntry.objects.filter(user=request.user)
    data = {
        "total": qs.count(),
        "planning": qs.filter(status=GameEntry.Status.PLANNING).count(),
        "playing": qs.filter(status=GameEntry.Status.PLAYING).count(),
        "paused": qs.filter(status=GameEntry.Status.PAUSED).count(),
        "dropped": qs.filter(status=GameEntry.Status.DROPPED).count(),
        "completed": qs.filter(status=GameEntry.Status.COMPLETED).count(),
        "total_minutes": PlaySession.objects.filter(entry__user=request.user)
                                            .aggregate(s=Sum('duration_min'))['s'] or 0,
    }
    return Response(data)


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
            .select_related('game')
            .order_by('-updated_at')
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class PlaySessionViewSet(viewsets.ModelViewSet):
    serializer_class = PlaySessionSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]

    def get_queryset(self):
        entry_id = self.kwargs['entry_pk']
        return (
            PlaySession.objects
            .filter(entry__id=entry_id, entry__user=self.request.user)
            .order_by('-played_on', '-id')
        )

    def perform_create(self, serializer):
        entry_id = self.kwargs['entry_pk']
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
