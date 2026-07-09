from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AnalyticsDashboardView, GrowthReportViewSet

router = DefaultRouter()
router.register('reports', GrowthReportViewSet, basename='reports')

urlpatterns = [
    path('dashboard/', AnalyticsDashboardView.as_view(), name='analytics_dashboard'),
    path('', include(router.urls)),
]
