from django.urls import path
from . import views

urlpatterns = [
    path('locations/', views.location_list, name='location-list'),
    path('locations/<int:pk>/', views.location_detail, name='location-detail'),
    path('upload-csv/', views.upload_csv, name='upload-csv'),
    path('stats/', views.stats, name='stats'),
    path('clear/', views.clear_all, name='clear-all'),
]
