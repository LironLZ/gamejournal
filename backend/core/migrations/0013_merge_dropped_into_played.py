from django.db import migrations

def merge_dropped_to_played(apps, schema_editor):
    GameEntry = apps.get_model("core", "GameEntry")
    GameEntry.objects.filter(status="DROPPED").update(status="PLAYED")

class Migration(migrations.Migration):

    dependencies = [
        ("core", "0012_favoritegame"),
    ]

    operations = [
        migrations.RunPython(merge_dropped_to_played, reverse_code=migrations.RunPython.noop),
    ]
