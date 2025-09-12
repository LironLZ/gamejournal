from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.db.models import Sum
from .models import Platform, Game, GameEntry, PlaySession, Activity, Friendship, FriendRequest

User = get_user_model()


class PlatformSerializer(serializers.ModelSerializer):
    class Meta:
        model = Platform
        fields = ["id", "name"]


class GameSerializer(serializers.ModelSerializer):
    platforms = PlatformSerializer(many=True, read_only=True)

    class Meta:
        model = Game
        fields = ["id", "title", "release_year", "platforms"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ["username", "password"]

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data["username"],
            password=validated_data["password"]
        )
        return user


class GameEntrySerializer(serializers.ModelSerializer):
    game = serializers.SerializerMethodField(read_only=True)
    game_id = serializers.PrimaryKeyRelatedField(queryset=Game.objects.all(), write_only=True, source='game')
    total_minutes = serializers.SerializerMethodField()

    class Meta:
        model = GameEntry
        fields = [
            'id', 'game', 'game_id', 'status', 'score',
            'started_at', 'finished_at', 'notes', 'updated_at',
            'total_minutes'
        ]

    def get_game(self, obj):
        return {"id": obj.game.id, "title": obj.game.title, "release_year": obj.game.release_year, "cover_url": getattr(obj.game, "cover_url", None)}

    def get_total_minutes(self, obj):
        return obj.sessions.aggregate(s=Sum('duration_min'))['s'] or 0

    def validate_score(self, value):
        if value is None:
            return value
        if not (0 <= value <= 10):
            raise serializers.ValidationError("Score must be between 0 and 10.")
        return value

    def validate(self, attrs):
        started = attrs.get("started_at", getattr(self.instance, "started_at", None))
        finished = attrs.get("finished_at", getattr(self.instance, "finished_at", None))
        if started and finished and finished < started:
            from rest_framework import serializers
            raise serializers.ValidationError({"finished_at": "Finish date cannot be before start date."})
        return attrs


class PlaySessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlaySession
        fields = ['id', 'played_on', 'duration_min', 'note', 'created_at']


class GameWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Game
        fields = ["id", "title", "release_year"]


# --- Public profile (slim) ----------------------------------------------------
class PublicGameSerializer(serializers.ModelSerializer):
    class Meta:
        model = Game
        fields = ("id", "title", "release_year", "cover_url")


class PublicEntrySerializer(serializers.ModelSerializer):
    game = PublicGameSerializer()

    class Meta:
        model = GameEntry
        fields = ("id", "status", "updated_at", "game")


# --- Activity -----------------------------------------------------------------
class ActivitySerializer(serializers.ModelSerializer):
    actor = serializers.CharField(source="actor.username", read_only=True)
    actor_avatar_url = serializers.SerializerMethodField()
    game = PublicGameSerializer(read_only=True)

    class Meta:
        model = Activity
        fields = ["id", "actor", "actor_avatar_url", "verb", "status", "score", "game", "created_at"]

    def get_actor_avatar_url(self, obj):
        req = self.context.get("request")
        prof = getattr(obj.actor, "profile", None)
        if prof and prof.avatar and req:
            try:
                return req.build_absolute_uri(prof.avatar.url)
            except Exception:
                return None
        return None


# --- Friends ------------------------------------------------------------------
class FriendMiniSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "avatar_url"]

    def get_avatar_url(self, u):
        req = self.context.get("request")
        prof = getattr(u, "profile", None)
        if prof and prof.avatar and req:
            try:
                return req.build_absolute_uri(prof.avatar.url)
            except Exception:
                return None
        return None


class FriendshipSerializer(serializers.ModelSerializer):
    friend = serializers.SerializerMethodField()

    class Meta:
        model = Friendship
        fields = ["id", "friend", "created_at"]

    def get_friend(self, obj):
        me = self.context["request"].user
        other = obj.user_b if obj.user_a_id == me.id else obj.user_a
        return FriendMiniSerializer(other, context=self.context).data


class FriendRequestSerializer(serializers.ModelSerializer):
    from_user = FriendMiniSerializer(read_only=True)
    to_user = FriendMiniSerializer(read_only=True)
    to_user_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), source="to_user", write_only=True)

    class Meta:
        model = FriendRequest
        fields = ["id", "from_user", "to_user", "to_user_id", "status", "created_at", "responded_at"]
        read_only_fields = ["status", "created_at", "responded_at"]
