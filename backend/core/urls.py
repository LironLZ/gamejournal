# backend/core/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_nested import routers
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from . import views, views_public
from . import views_auth

router = DefaultRouter()
router.register(r'entries', views.GameEntryViewSet, basename='entry')
router.register(r'games', views.GameViewSet, basename='game')

nested = routers.NestedDefaultRouter(router, r'entries', lookup='entry')
nested.register(r'sessions', views.PlaySessionViewSet, basename='entry-sessions')

urlpatterns = [
    path('ping/', views.ping, name='ping'),

    # auth (password/JWT still available for dev)
    path('auth/register/', views.register, name='register'),
    path('auth/login/',    TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/',  TokenRefreshView.as_view(),    name='token_refresh'),
    path('auth/whoami/',   views.whoami, name='whoami'),

    # Google SSO
    path('auth/google/',   views_auth.google_login, name='google-login'),

    # account
    path('account/username/', views.update_username, name='update-username'),

    # stats
    path('stats/', views.my_stats, name='my-stats'),

    # RAWG
    path('search/games/', views.search_games_external, name='search-games'),
    path('import/game/',  views.import_game,           name='import-game'),

    # resources
    path('', include(router.urls)),
    path('', include(nested.urls)),

    # public
    path('users/<str:username>/', views.public_profile, name='public-profile'),
    path('public/games/', views_public.discover_games, name='discover-games'),
    path('public/games/<int:game_id>/', views_public.game_details, name='public-game-details'),
]
