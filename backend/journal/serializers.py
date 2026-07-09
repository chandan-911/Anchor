from rest_framework import serializers
from .models import JournalEntry

class JournalEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = JournalEntry
        fields = ('id', 'content', 'mood_score', 'confidence_score', 'stress_score', 
                  'energy_level', 'language', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')
