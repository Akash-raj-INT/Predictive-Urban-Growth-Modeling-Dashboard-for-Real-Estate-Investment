from django.contrib import admin
from .models import LocationData


@admin.register(LocationData)
class LocationDataAdmin(admin.ModelAdmin):
    list_display = ['area_name', 'latitude', 'longitude', 'price_per_sqft',
                    'rental_yield', 'infra_score', 'growth_score', 'timestamp']
    list_filter = ['timestamp']
    search_fields = ['area_name']
    readonly_fields = ['growth_score', 'timestamp']
    ordering = ['-growth_score']
