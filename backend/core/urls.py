# backend/core/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_nested import routers
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from . import views, views_public

# top-level routers
router = DefaultRouter()
router.register(r'entries', views.GameEntryViewSet, basename='entry')
router.register(r'games', views.GameViewSet, basename='game')

# nested: /api/entries/{entry_pk}/sessions/
nested = routers.NestedDefaultRouter(router, r'entries', lookup='entry')
nested.register(r'sessions', views.PlaySessionViewSet, basename='entry-sessions')

urlpatterns = [
    path('ping/', views.ping, name='ping'),

    # auth
    path('auth/register/', views.register, name='register'),
    path('auth/login/',    TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/',  TokenRefreshView.as_view(),    name='token_refresh'),
    path('auth/whoami/',   views.whoami, name='whoami'),

    # stats
    path('stats/', views.my_stats, name='my-stats'),

    # RAWG-backed search & import
    path('search/games/', views.search_games_external, name='search-games'),
    path('import/game/',  views.import_game,           name='import-game'),

    # resources
    path('', include(router.urls)),
    path('', include(nested.urls)),

    # public
    path("users/<str:username>/", views.public_profile, name="public-profile"),
    path("public/games/", views_public.discover_games, name="discover-games"),
    path("public/games/<int:game_id>/", views_public.game_detail, name="public-game-detail"),  # ⬅️ NEW
]
