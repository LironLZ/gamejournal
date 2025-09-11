from django.conf import settings
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver


class Platform(models.Model):
    name = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.name


class Game(models.Model):
    title = models.CharField(max_length=200)
    release_year = models.IntegerField(null=True, blank=True)
    cover_url = models.URLField(blank=True, null=True)  # thumbnails/covers
    platforms = models.ManyToManyField(Platform, related_name="games", blank=True)

    def __str__(self):
        return self.title


class Profile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    avatar = models.ImageField(upload_to="avatars/", null=True, blank=True)

    def __str__(self):
        return f"Profile({self.user.username})"


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_profile_for_user(sender, instance, created, **kwargs):
    if created:
        Profile.objects.get_or_create(user=instance)


class GameEntry(models.Model):
    class Status(models.TextChoices):
        PLANNING = "PLANNING", "Planning"
        PLAYING = "PLAYING", "Playing"
        PLAYED = "PLAYED", "Played"
        DROPPED = "DROPPED", "Dropped"
        COMPLETED = "COMPLETED", "Completed"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="entries"
    )
    game = models.ForeignKey("Game", on_delete=models.CASCADE, related_name="entries")
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PLANNING
    )
    score = models.PositiveSmallIntegerField(null=True, blank=True)
    started_at = models.DateField(null=True, blank=True)
    finished_at = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "game")
        verbose_name = "Game entry"
        verbose_name_plural = "Game entries"

    def __str__(self):
        return f"{self.user} — {self.game} ({self.status})"


class PlaySession(models.Model):
    entry = models.ForeignKey(
        GameEntry, on_delete=models.CASCADE, related_name="sessions"
    )
    played_on = models.DateField()
    duration_min = models.PositiveIntegerField()
    note = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Play session"
        verbose_name_plural = "Play sessions"

    def __str__(self):
        return f"{self.entry.game.title}: {self.duration_min} min on {self.played_on}"
