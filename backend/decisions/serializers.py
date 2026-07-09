from rest_framework import serializers
from .models import Decision

class DecisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Decision
        fields = ('id', 'title', 'description', 'summary', 'advantages', 'disadvantages', 
                  'risks', 'opportunities', 'long_term_impact', 'recommended_choice', 
                  'confidence_score', 'immediate_next_actions', 'status', 'created_at', 'updated_at')
        read_only_fields = ('id', 'summary', 'advantages', 'disadvantages', 'risks', 
                            'opportunities', 'long_term_impact', 'recommended_choice', 
                            'confidence_score', 'immediate_next_actions', 'created_at', 'updated_at')
