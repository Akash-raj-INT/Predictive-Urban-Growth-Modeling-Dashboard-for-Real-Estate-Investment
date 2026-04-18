from rest_framework import serializers
from .models import LocationData


class LocationDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = LocationData
        fields = [
            'id', 'area_name', 'latitude', 'longitude',
            'price_per_sqft', 'rental_yield', 'infra_score',
            'listing_density', 'growth_score', 'timestamp'
        ]
        read_only_fields = ['id', 'growth_score', 'timestamp']

    def validate_infra_score(self, value):
        if not (0 <= value <= 10):
            raise serializers.ValidationError("infra_score must be between 0 and 10.")
        return value

    def validate_rental_yield(self, value):
        if value < 0:
            raise serializers.ValidationError("rental_yield must be a positive number.")
        return value

    def validate_price_per_sqft(self, value):
        if value <= 0:
            raise serializers.ValidationError("price_per_sqft must be greater than 0.")
        return value
