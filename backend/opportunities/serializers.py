from rest_framework import serializers
from .models import Opportunity

class OpportunitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Opportunity
        fields = ('id', 'title', 'description', 'category', 'priority_score', 
                  'impact_score', 'urgency_score', 'external_link', 'status', 'created_at', 'updated_at')
        read_only_fields = ('id', 'priority_score', 'created_at', 'updated_at')
