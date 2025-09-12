from django.db import migrations

def forwards(apps, schema_editor):
    GameEntry = apps.get_model("core", "GameEntry")
    # Planning -> Wishlist
    GameEntry.objects.filter(status="PLANNING").update(status="WISHLIST")
    # Completed -> Played
    GameEntry.objects.filter(status="COMPLETED").update(status="PLAYED")

def backwards(apps, schema_editor):
    GameEntry = apps.get_model("core", "GameEntry")
    # Best-effort rollback
    GameEntry.objects.filter(status="WISHLIST").update(status="PLANNING")
    # Can't reliably revert PLAYED back to COMPLETED

class Migration(migrations.Migration):
    dependencies = [("core", '0008_friendrequest_friendship_delete_follow')]
    operations = [migrations.RunPython(forwards, backwards)]
