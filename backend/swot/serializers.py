from rest_framework import serializers
from .models import SWOTReport

class SWOTReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = SWOTReport
        fields = ('id', 'strengths', 'weaknesses', 'opportunities', 'threats', 
                  'growth_recommendations', 'period', 'created_at', 'updated_at')
        read_only_fields = ('id', 'strengths', 'weaknesses', 'opportunities', 'threats', 
                            'growth_recommendations', 'created_at', 'updated_at')
