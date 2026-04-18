"""
Management command: python manage.py seed_data
Seeds the database with realistic sample US city location data.
"""
from django.core.management.base import BaseCommand
from analytics.models import LocationData


SAMPLE_DATA = [
    # High-growth zones (major metros, high infra, good yields)
    {"area_name": "Downtown Austin, TX",       "latitude": 30.2672, "longitude": -97.7431, "price_per_sqft": 420,  "rental_yield": 7.2, "infra_score": 8.5, "listing_density": 340},
    {"area_name": "Midtown Atlanta, GA",        "latitude": 33.7838, "longitude": -84.3830, "price_per_sqft": 280,  "rental_yield": 8.1, "infra_score": 7.8, "listing_density": 290},
    {"area_name": "Uptown Dallas, TX",          "latitude": 32.7973, "longitude": -96.8063, "price_per_sqft": 310,  "rental_yield": 7.5, "infra_score": 8.1, "listing_density": 310},
    {"area_name": "South Loop Chicago, IL",     "latitude": 41.8503, "longitude": -87.6259, "price_per_sqft": 360,  "rental_yield": 6.9, "infra_score": 8.9, "listing_density": 450},
    {"area_name": "Wynwood Miami, FL",          "latitude": 25.8007, "longitude": -80.1993, "price_per_sqft": 480,  "rental_yield": 7.8, "infra_score": 7.6, "listing_density": 280},
    {"area_name": "SoHo New York, NY",          "latitude": 40.7233, "longitude": -74.0030, "price_per_sqft": 1850, "rental_yield": 4.2, "infra_score": 9.5, "listing_density": 620},
    {"area_name": "Capitol Hill Seattle, WA",   "latitude": 47.6235, "longitude": -122.3190, "price_per_sqft": 680, "rental_yield": 5.8, "infra_score": 8.4, "listing_density": 390},
    {"area_name": "Mission District SF, CA",    "latitude": 37.7599, "longitude": -122.4148, "price_per_sqft": 1200, "rental_yield": 4.5, "infra_score": 8.0, "listing_density": 510},
    {"area_name": "NoDa Charlotte, NC",         "latitude": 35.2307, "longitude": -80.8122, "price_per_sqft": 210,  "rental_yield": 8.9, "infra_score": 7.2, "listing_density": 195},
    {"area_name": "River North Denver, CO",     "latitude": 39.7620, "longitude": -104.9847, "price_per_sqft": 390, "rental_yield": 6.4, "infra_score": 8.3, "listing_density": 320},

    # Medium-growth zones
    {"area_name": "Midtown Memphis, TN",        "latitude": 35.1421, "longitude": -90.0490, "price_per_sqft": 140,  "rental_yield": 9.2, "infra_score": 5.5, "listing_density": 180},
    {"area_name": "East Nashville, TN",         "latitude": 36.1747, "longitude": -86.7620, "price_per_sqft": 250,  "rental_yield": 6.8, "infra_score": 6.5, "listing_density": 220},
    {"area_name": "Broad Ripple Indianapolis",  "latitude": 39.8667, "longitude": -86.1411, "price_per_sqft": 175,  "rental_yield": 7.5, "infra_score": 6.0, "listing_density": 160},
    {"area_name": "Short North Columbus, OH",   "latitude": 39.9782, "longitude": -83.0025, "price_per_sqft": 195,  "rental_yield": 7.1, "infra_score": 6.8, "listing_density": 230},
    {"area_name": "Midtown Kansas City, MO",    "latitude": 39.0620, "longitude": -94.5660, "price_per_sqft": 155,  "rental_yield": 8.0, "infra_score": 5.8, "listing_density": 150},
    {"area_name": "Germantown Philadelphia, PA","latitude": 40.0380, "longitude": -75.1720, "price_per_sqft": 220,  "rental_yield": 7.4, "infra_score": 6.2, "listing_density": 270},
    {"area_name": "Montrose Houston, TX",       "latitude": 29.7452, "longitude": -95.3890, "price_per_sqft": 230,  "rental_yield": 6.9, "infra_score": 6.7, "listing_density": 260},
    {"area_name": "Virginia Highland Atlanta",  "latitude": 33.7928, "longitude": -84.3560, "price_per_sqft": 295,  "rental_yield": 5.9, "infra_score": 7.0, "listing_density": 200},

    # Lower-growth zones
    {"area_name": "West End Birmingham, AL",    "latitude": 33.5152, "longitude": -86.8580, "price_per_sqft": 85,   "rental_yield": 9.8, "infra_score": 3.5, "listing_density": 110},
    {"area_name": "North Tulsa, OK",            "latitude": 36.1820, "longitude": -95.9910, "price_per_sqft": 75,   "rental_yield": 10.2,"infra_score": 3.0, "listing_density": 95},
    {"area_name": "South Side Cleveland, OH",   "latitude": 41.4530, "longitude": -81.6730, "price_per_sqft": 90,   "rental_yield": 10.5,"infra_score": 3.8, "listing_density": 120},
    {"area_name": "Eastside Detroit, MI",       "latitude": 42.3540, "longitude": -82.9820, "price_per_sqft": 60,   "rental_yield": 11.0,"infra_score": 2.5, "listing_density": 80},
    {"area_name": "Lower Ninth Ward NOLA, LA",  "latitude": 29.9660, "longitude": -89.9960, "price_per_sqft": 95,   "rental_yield": 8.5, "infra_score": 3.2, "listing_density": 100},
    {"area_name": "North Milwaukee, WI",        "latitude": 43.0840, "longitude": -87.9500, "price_per_sqft": 110,  "rental_yield": 9.5, "infra_score": 4.2, "listing_density": 130},
    {"area_name": "Rust Belt Erie, PA",         "latitude": 42.1290, "longitude": -80.0852, "price_per_sqft": 70,   "rental_yield": 10.8,"infra_score": 3.5, "listing_density": 90},
]


class Command(BaseCommand):
    help = 'Seeds the database with sample urban location data for 25 US areas.'

    def handle(self, *args, **options):
        existing = LocationData.objects.count()
        if existing > 0:
            self.stdout.write(self.style.WARNING(
                f'Database already has {existing} records. Skipping seed. '
                f'Run "python manage.py flush" first to reset.'
            ))
            return

        self.stdout.write('Seeding database with sample location data...')

        # Bulk create without growth_score first
        objs = [LocationData(**d) for d in SAMPLE_DATA]
        # We need to save one by one so the model's save() logic runs
        for obj in objs:
            obj.save()

        # Recompute all scores with full dataset context
        from analytics.views import _recompute_all_scores
        _recompute_all_scores()

        count = LocationData.objects.count()
        self.stdout.write(self.style.SUCCESS(
            f'✅ Successfully seeded {count} location records!'
        ))
        self.stdout.write('Top growth zones:')
        for loc in LocationData.objects.all()[:5]:
            self.stdout.write(f'  • {loc.area_name}: {loc.growth_score}/10')
