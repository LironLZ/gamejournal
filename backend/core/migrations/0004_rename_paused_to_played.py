from django.db import migrations

def forwards(apps, schema_editor):
    GameEntry = apps.get_model("core", "GameEntry")
    GameEntry.objects.filter(status="PAUSED").update(status="PLAYED")

def backwards(apps, schema_editor):
    GameEntry = apps.get_model("core", "GameEntry")
    GameEntry.objects.filter(status="PLAYED").update(status="PAUSED")

class Migration(migrations.Migration):

    dependencies = [
        ("core", "0003_game_cover_url"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
