# core/urls.py
from django.conf import settings
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_nested import routers
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from . import views, views_public, views_auth
from .views import FriendRequestViewSet, FriendsViewSet

router = DefaultRouter()
router.register(r'entries', views.GameEntryViewSet, basename='entry')
router.register(r'games', views.GameViewSet, basename='game')

# Friends system
router.register(r'friends/requests', FriendRequestViewSet, basename='friend-requests')
router.register(r'friends', FriendsViewSet, basename='friends')

# Nested: play sessions under entries
nested = routers.NestedDefaultRouter(router, r'entries', lookup='entry')
nested.register(r'sessions', views.PlaySessionViewSet, basename='entry-sessions')

urlpatterns = [
    path('ping/', views.ping, name='ping'),

    # SSO (always on)
    path('auth/google/', views_auth.google_login, name='google-login'),

    # Always expose refresh for SSO token renewal
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # account
    path('auth/whoami/', views.whoami, name='whoami'),
    path('account/username/', views.update_username, name='update-username'),
    path('account/avatar/', views.upload_avatar, name='upload-avatar'),

    # stats
    path('stats/', views.my_stats, name='my-stats'),

    # RAWG
    path('search/games/', views.search_games_external, name='search-games'),
    path('import/game/',  views.import_game,           name='import-game'),

    # feed (me + my friends)
    path('feed/', views.activity_feed, name='activity-feed'),

    # user search/browse (used by Discover People)
    path('users/', views.search_users, name='search-users'),

    # resources
    path('', include(router.urls)),
    path('', include(nested.urls)),

    # public
    path('users/<str:username>/', views.public_profile, name='public-profile'),
    path('public/games/', views_public.discover_games, name='discover-games'),
    path('public/games/<int:game_id>/', views_public.game_details, name='public-game-details'),
]

# Dev-only password endpoints (optional)
if getattr(settings, "ALLOW_PASSWORD_LOGIN", False):
    urlpatterns += [
        path('auth/register/', views.register, name='register'),
        path('auth/login/',    TokenObtainPairView.as_view(), name='token_obtain_pair'),
    ]
