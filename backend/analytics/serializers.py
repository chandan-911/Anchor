from rest_framework import serializers
from .models import GrowthReport

class GrowthReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = GrowthReport
        fields = ('id', 'report_type', 'start_date', 'end_date', 'content', 'created_at')
        read_only_fields = ('id', 'created_at')
