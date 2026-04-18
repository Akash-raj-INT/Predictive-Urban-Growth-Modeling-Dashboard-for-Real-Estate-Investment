import csv
import io
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, JSONParser
from rest_framework.response import Response

from .models import LocationData
from .serializers import LocationDataSerializer


@api_view(['GET', 'POST'])
def location_list(request):
    """
    GET  /api/locations/ → Return all location records with growth scores.
    POST /api/locations/ → Add a single new location.
    """
    if request.method == 'GET':
        locations = LocationData.objects.all()
        serializer = LocationDataSerializer(locations, many=True)
        return Response({
            'count': locations.count(),
            'locations': serializer.data
        })

    elif request.method == 'POST':
        serializer = LocationDataSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            # Re-normalize all after new entry
            _recompute_all_scores()
            # Return fresh data for the saved object
            obj = LocationData.objects.get(pk=serializer.data['id'])
            return Response(LocationDataSerializer(obj).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
def location_detail(request, pk):
    """
    GET    /api/locations/<id>/ → single record
    PUT    /api/locations/<id>/ → update record
    DELETE /api/locations/<id>/ → delete record
    """
    try:
        location = LocationData.objects.get(pk=pk)
    except LocationData.DoesNotExist:
        return Response({'error': 'Location not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(LocationDataSerializer(location).data)

    elif request.method == 'PUT':
        serializer = LocationDataSerializer(location, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            _recompute_all_scores()
            obj = LocationData.objects.get(pk=pk)
            return Response(LocationDataSerializer(obj).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        location.delete()
        _recompute_all_scores()
        return Response({'message': 'Deleted successfully.'}, status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@parser_classes([MultiPartParser])
def upload_csv(request):
    """
    POST /api/upload-csv/
    Expects a multipart file upload with key 'file'.
    CSV columns: area_name, latitude, longitude, price_per_sqft,
                 rental_yield, infra_score, listing_density
    """
    if 'file' not in request.FILES:
        return Response({'error': 'No file provided. Use key "file".'}, status=status.HTTP_400_BAD_REQUEST)

    csv_file = request.FILES['file']

    if not csv_file.name.endswith('.csv'):
        return Response({'error': 'Only CSV files are accepted.'}, status=status.HTTP_400_BAD_REQUEST)

    required_columns = {
        'area_name', 'latitude', 'longitude',
        'price_per_sqft', 'rental_yield', 'infra_score', 'listing_density'
    }

    try:
        decoded = csv_file.read().decode('utf-8-sig')
        reader = csv.DictReader(io.StringIO(decoded))

        # Validate headers
        if not reader.fieldnames:
            return Response({'error': 'Empty or invalid CSV.'}, status=status.HTTP_400_BAD_REQUEST)

        headers = {h.strip().lower() for h in reader.fieldnames}
        missing = required_columns - headers
        if missing:
            return Response(
                {'error': f'Missing columns: {", ".join(missing)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        created_count = 0
        errors = []

        for row_num, row in enumerate(reader, start=2):
            try:
                # Strip whitespace from keys and values
                row = {k.strip().lower(): v.strip() for k, v in row.items() if k}

                obj = LocationData(
                    area_name=row['area_name'],
                    latitude=float(row['latitude']),
                    longitude=float(row['longitude']),
                    price_per_sqft=float(row['price_per_sqft']),
                    rental_yield=float(row['rental_yield']),
                    infra_score=float(row['infra_score']),
                    listing_density=float(row['listing_density']),
                )

                # Basic validation
                if not (0 <= obj.infra_score <= 10):
                    errors.append(f"Row {row_num}: infra_score must be 0-10.")
                    continue
                if obj.price_per_sqft <= 0:
                    errors.append(f"Row {row_num}: price_per_sqft must be > 0.")
                    continue

                obj.save()
                created_count += 1

            except (ValueError, KeyError) as e:
                errors.append(f"Row {row_num}: {str(e)}")

        # Re-normalize all scores after bulk insert
        _recompute_all_scores()

        return Response({
            'message': f'Successfully imported {created_count} location(s).',
            'created': created_count,
            'errors': errors,
            'total_in_db': LocationData.objects.count()
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        return Response({'error': f'Failed to process CSV: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
def clear_all(request):
    """DELETE /api/clear/ → Wipe all location data (for testing)."""
    count = LocationData.objects.count()
    LocationData.objects.all().delete()
    return Response({'message': f'Deleted {count} record(s).'})


@api_view(['GET'])
def stats(request):
    """GET /api/stats/ → Summary statistics for the dashboard."""
    locations = LocationData.objects.all()
    if not locations.exists():
        return Response({'message': 'No data available.'})

    scores = [loc.growth_score for loc in locations]
    prices = [loc.price_per_sqft for loc in locations]
    yields = [loc.rental_yield for loc in locations]

    high = sum(1 for s in scores if s >= 7)
    medium = sum(1 for s in scores if 4 <= s < 7)
    low = sum(1 for s in scores if s < 4)

    return Response({
        'total_locations': len(scores),
        'avg_growth_score': round(sum(scores) / len(scores), 2),
        'max_growth_score': max(scores),
        'min_growth_score': min(scores),
        'avg_price_per_sqft': round(sum(prices) / len(prices), 2),
        'avg_rental_yield': round(sum(yields) / len(yields), 2),
        'high_growth_zones': high,
        'medium_growth_zones': medium,
        'low_growth_zones': low,
    })


def _recompute_all_scores():
    """
    Re-normalizes and recomputes growth scores for ALL records
    using the full dataset's min/max values — ensures consistent
    relative scoring after any insert/update/delete.
    """
    locations = list(LocationData.objects.all())
    if not locations:
        return

    all_prices = [loc.price_per_sqft for loc in locations]
    all_yields = [loc.rental_yield for loc in locations]
    all_infra = [loc.infra_score for loc in locations]

    for loc in locations:
        new_score = LocationData.compute_growth_score(
            loc.price_per_sqft, loc.rental_yield, loc.infra_score,
            all_prices, all_yields, all_infra
        )
        # Direct update to avoid recursive save() signal
        LocationData.objects.filter(pk=loc.pk).update(growth_score=new_score)
