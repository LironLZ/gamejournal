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
        return obj.sessions.aggregate(s=Sum('duration_min'))['s'] or 0

class PlaySessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlaySession
        fields = ['id', 'played_on', 'duration_min', 'note', 'created_at']

class GameWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Game
        fields = ["id", "title", "release_year"]