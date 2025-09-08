from django.contrib import admin
from django.utils.html import format_html
from .models import Platform, Game, GameEntry, PlaySession


@admin.register(Platform)
class PlatformAdmin(admin.ModelAdmin):
    list_display = ("id", "name")
    search_fields = ("name",)


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "release_year", "cover_preview")
    search_fields = ("title",)
    list_filter = ("release_year", "platforms")
    filter_horizontal = ("platforms",)  # nicer M2M picker

    def cover_preview(self, obj):
        if obj.cover_url:
            return format_html('<img src="{}" width="60" style="border-radius:4px;" />', obj.cover_url)
        return "—"
    cover_preview.short_description = "Cover"


class PlaySessionInline(admin.TabularInline):
    model = PlaySession
    extra = 0
    fields = ("played_on", "duration_min", "note", "created_at")
    readonly_fields = ("created_at",)


@admin.register(GameEntry)
class GameEntryAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "game", "status", "score", "started_at", "finished_at", "updated_at")
    list_filter = ("status", "started_at", "finished_at", "updated_at")
    search_fields = ("user__username", "game__title", "notes")
    autocomplete_fields = ("user", "game")
    inlines = [PlaySessionInline]


@admin.register(PlaySession)
class PlaySessionAdmin(admin.ModelAdmin):
    list_display = ("id", "entry", "played_on", "duration_min", "note", "created_at")
    list_filter = ("played_on", "created_at")
    search_fields = ("entry__game__title", "entry__user__username", "note")
    autocomplete_fields = ("entry",)
    readonly_fields = ("created_at",)
