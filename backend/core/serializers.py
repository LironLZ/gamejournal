from rest_framework import serializers
from .models import Platform, Game, GameEntry, PlaySession
from django.contrib.auth.models import User
from django.db.models import Sum


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
        # ensure password is hashed
        user = User.objects.create_user(
            username=validated_data["username"],
            password=validated_data["password"]
        )
        return user


class GameEntrySerializer(serializers.ModelSerializer):
    """
    Full entry serializer for the private app (owner views).
    Keeps total_minutes for now so existing private screens continue to work.
    """
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
        # minimal game representation
        return {"id": obj.game.id, "title": obj.game.title, "release_year": obj.game.release_year}

    def get_total_minutes(self, obj):
        # still available for private owner views; not used in public profile or stats anymore
        return obj.sessions.aggregate(s=Sum('duration_min'))['s'] or 0

    def validate_score(self, value):
        if value is None:
            return value
        if not (0 <= value <= 10):
            raise serializers.ValidationError("Score must be between 0 and 10.")
        return value

    def validate(self, attrs):
        # handle partial updates by falling back to existing instance values
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
        fields = ("id", "status", "updated_at", "game")  # 👈 no minutes here
