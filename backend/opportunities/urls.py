from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OpportunityViewSet

router = DefaultRouter()
router.register('', OpportunityViewSet, basename='opportunities')

urlpatterns = [
    path('', include(router.urls)),
]
