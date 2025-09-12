from django.conf import settings
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model

User = get_user_model()


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
        WISHLIST = "WISHLIST", "Wishlist"
        PLAYING = "PLAYING", "Playing"
        PLAYED = "PLAYED", "Played"
        DROPPED = "DROPPED", "Dropped"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="entries"
    )
    game = models.ForeignKey("Game", on_delete=models.CASCADE, related_name="entries")
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.WISHLIST
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


# --- Activity stream (already used by feed) -----------------------------------
class Activity(models.Model):
    class Verb(models.TextChoices):
        RATED = "RATED", "rated"
        STATUS = "STATUS", "status updated"
        SESSION = "SESSION", "logged play session"

    actor = models.ForeignKey(User, on_delete=models.CASCADE, related_name="activities")
    game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name="activities")
    entry = models.ForeignKey(GameEntry, on_delete=models.CASCADE, null=True, blank=True, related_name="activities")

    verb = models.CharField(max_length=10, choices=Verb.choices)
    status = models.CharField(max_length=10, choices=GameEntry.Status.choices, null=True, blank=True)
    score = models.PositiveSmallIntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.actor.username} {self.verb} {self.game.title}"


# --- Friends (mutual) ---------------------------------------------------------
class Friendship(models.Model):
    """
    Undirected friendship. We store (user_a, user_b) with a<b to ensure uniqueness.
    """
    user_a = models.ForeignKey(User, on_delete=models.CASCADE, related_name="friendships_a")
    user_b = models.ForeignKey(User, on_delete=models.CASCADE, related_name="friendships_b")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user_a", "user_b")

    def save(self, *args, **kwargs):
        # normalize order
        if self.user_a_id and self.user_b_id and self.user_a_id > self.user_b_id:
            self.user_a, self.user_b = self.user_b, self.user_a
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user_a.username} ↔ {self.user_b.username}"


class FriendRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        ACCEPTED = "ACCEPTED", "Accepted"
        DECLINED = "DECLINED", "Declined"
        CANCELED = "CANCELED", "Canceled"

    from_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="friend_requests_sent")
    to_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="friend_requests_received")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("from_user", "to_user")

    def __str__(self):
        return f"{self.from_user.username} → {self.to_user.username} [{self.status}]"
