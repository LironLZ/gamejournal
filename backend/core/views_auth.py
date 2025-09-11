# backend/core/views_auth.py
import re
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from google.oauth2 import id_token
from google.auth.transport import requests as greq

User = get_user_model()

def _issue_tokens(user):
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
        },
    }

def _slugify_username(base: str) -> str:
    # keep letters, numbers, underscore; lowercase; max 20
    s = re.sub(r"[^a-zA-Z0-9_]", "", (base or "user")).lower()
    if len(s) < 3:
        s = "user"
    return s[:20]

def _unique_username(base: str) -> str:
    base = _slugify_username(base)
    cand = base
    i = 1
    while User.objects.filter(username=cand).exists():
        i += 1
        suffix = str(i)
        cand = (base[: max(1, 20 - len(suffix))] + suffix)
    return cand

@api_view(["POST"])
@permission_classes([AllowAny])
def google_login(request):
    """
    Body: { "credential": "<google_id_token>" }
    Returns: { access, refresh, user, created }
    """
    cred = request.data.get("credential")
    if not cred:
        return Response({"detail": "Missing credential"}, status=status.HTTP_400_BAD_REQUEST)
    if not settings.GOOGLE_OAUTH_CLIENT_ID:
        return Response({"detail": "Server missing GOOGLE_OAUTH_CLIENT_ID"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    try:
        info = id_token.verify_oauth2_token(cred, greq.Request(), settings.GOOGLE_OAUTH_CLIENT_ID)
    except Exception:
        return Response({"detail": "Invalid Google token"}, status=status.HTTP_400_BAD_REQUEST)

    email = (info.get("email") or "").lower()
    email_local = email.split("@")[0] if "@" in email else "user"

    if getattr(settings, "ENFORCE_ALLOWLIST", False) and getattr(settings, "ALLOWED_EMAILS", set()) and email not in settings.ALLOWED_EMAILS:
        return Response({"detail": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

    user, created = User.objects.get_or_create(
        email=email,
        defaults={"username": _unique_username(email_local)},
    )

    data = _issue_tokens(user)
    data["created"] = created
    return Response(data, status=status.HTTP_200_OK)
