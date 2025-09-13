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

    ids = getattr(settings, "GOOGLE_OAUTH_CLIENT_IDS", set())
    if not ids:
        return Response({"detail": "Server missing GOOGLE_OAUTH_CLIENT_ID(S)"}, status=500)

    try:
        # Verify token without audience first; we'll check aud manually to allow multiple IDs
        info = id_token.verify_oauth2_token(cred, greq.Request())
        aud = info.get("aud")
        if aud not in ids:
            return Response(
                {"detail": "Token audience mismatch", "aud": aud},
                status=status.HTTP_400_BAD_REQUEST,
            )
    except Exception as e:
        msg = "Invalid Google token"
        # Show real reason only when DEBUG=True (local dev)
        if settings.DEBUG:
            msg += f" ({e.__class__.__name__}: {e})"
        return Response({"detail": msg}, status=status.HTTP_400_BAD_REQUEST)

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