from django.contrib import admin
from .models import Platform, Game

@admin.register(Platform)
class PlatformAdmin(admin.ModelAdmin):
    list_display = ("id", "name")
    search_fields = ("name",)

@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "release_year")
    search_fields = ("title",)
    list_filter = ("release_year", "platforms")
