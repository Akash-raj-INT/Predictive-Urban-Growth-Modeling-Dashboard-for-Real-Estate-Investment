# UrbanPulse — Predictive Urban Growth Modeling Dashboard

A full-stack Django + Leaflet.js dashboard for real estate investment intelligence.
Displays predicted growth zones as interactive heatmaps + color-coded markers.

---

## 📁 Project Structure

```
urban_growth/
├── manage.py
├── requirements.txt
│
├── urban_growth/               ← Django project config
│   ├── __init__.py
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
│
├── analytics/                  ← Main Django app
│   ├── __init__.py
│   ├── admin.py
│   ├── apps.py
│   ├── models.py               ← LocationData model + growth score logic
│   ├── serializers.py          ← DRF serializers
│   ├── views.py                ← API endpoints
│   ├── urls.py                 ← App URL routing
│   ├── migrations/
│   │   └── __init__.py
│   └── management/
│       └── commands/
│           └── seed_data.py    ← Optional: seeds 25 sample US cities
│
├── templates/
│   └── analytics/
│       └── dashboard.html      ← Main frontend page
│
└── static/
    ├── css/
    │   └── dashboard.css       ← Full dashboard styles
    ├── js/
    │   └── dashboard.js        ← Map logic, API calls, UI
    └── data/
        └── sample_data.csv     ← Sample CSV for upload testing
```

---

## ⚡ Quick Setup (Step-by-Step)

### 1. Prerequisites
- Python 3.9+ installed
- pip installed
- A terminal / command prompt

### 2. Clone / Download the project
```bash
# If you have git:
git clone <your-repo-url>
cd urban_growth

# Or just navigate to the folder:
cd path/to/urban_growth
```

### 3. Create a virtual environment
```bash
# Create
python -m venv venv

# Activate (macOS / Linux):
source venv/bin/activate

# Activate (Windows):
venv\Scripts\activate
```

### 4. Install dependencies
```bash
pip install -r requirements.txt
```

### 5. Run database migrations
```bash
python manage.py makemigrations analytics
python manage.py migrate
```

### 6. (Optional) Seed sample data — 25 US cities pre-loaded
```bash
python manage.py seed_data
```

### 7. Start the development server
```bash
python manage.py runserver
```

### 8. Open the dashboard
Open your browser and go to:
```
http://127.0.0.1:8000/
```

You should see the dark map dashboard. If you ran `seed_data`, the heatmap
and markers will already be visible across the US.

---

## 🗺️ Using the Dashboard

| Action | How |
|---|---|
| **See the map** | Open `http://127.0.0.1:8000/` |
| **Load sample data** | Click "Load Sample Data" in the sidebar |
| **Upload your CSV** | Click "Upload CSV" → select a `.csv` file |
| **Add one location** | Fill the "Add Location" form at the bottom of the sidebar |
| **Refresh map** | Click "Refresh Map" button |
| **Toggle heatmap/markers** | Use the Layer toggles |
| **Filter by growth score** | Drag the "Min Score" slider |
| **View location details** | Click any map marker → popup + bottom strip |
| **Clear all data** | Click "Clear All Data" (with confirmation) |
| **Download sample CSV** | In browser console: `downloadSampleCSV()` |

---

## 📡 API Endpoints

| Method | URL | Description |
|---|---|---|
| `GET`  | `/api/locations/` | List all locations with growth scores |
| `POST` | `/api/locations/` | Add a single location (JSON body) |
| `GET`  | `/api/locations/<id>/` | Get one location |
| `PUT`  | `/api/locations/<id>/` | Update a location |
| `DELETE` | `/api/locations/<id>/` | Delete a location |
| `POST` | `/api/upload-csv/` | Bulk upload via CSV file |
| `GET`  | `/api/stats/` | Summary statistics |
| `DELETE` | `/api/clear/` | Delete all records |

### POST /api/locations/ — Example JSON body:
```json
{
  "area_name": "Brooklyn Heights NY",
  "latitude": 40.6960,
  "longitude": -73.9975,
  "price_per_sqft": 950,
  "rental_yield": 5.1,
  "infra_score": 8.8,
  "listing_density": 420
}
```

### POST /api/upload-csv/ — CSV format:
```
area_name,latitude,longitude,price_per_sqft,rental_yield,infra_score,listing_density
Brooklyn Heights NY,40.696,-73.997,950,5.1,8.8,420
```

---

## 📊 Growth Score Formula

```
Growth Score = (normalized_price × 0.4) + (normalized_yield × 0.3) + (normalized_infra × 0.3)
```

Each component is min-max normalized across the **entire dataset**:
- `price_per_sqft` — higher relative price = higher score
- `rental_yield` — higher yield = higher score  
- `infra_score` — already 0–10; normalized to 0–1

Final score is scaled to **0–10**.

**Color coding:**
- 🟢 Green  → score ≥ 7  (High growth)
- 🟡 Yellow → score 4–6.9 (Medium growth)
- 🔴 Red    → score < 4  (Low growth)

Scores are **recomputed for all records** whenever data is added/updated/deleted
to ensure consistent relative ranking.

---

## 🛠️ Django Admin

Create a superuser to access the admin panel:
```bash
python manage.py createsuperuser
```
Then visit: `http://127.0.0.1:8000/admin/`

---

## 🧪 Testing the API with curl

```bash
# List all locations
curl http://127.0.0.1:8000/api/locations/

# Add a location
curl -X POST http://127.0.0.1:8000/api/locations/ \
  -H "Content-Type: application/json" \
  -d '{"area_name":"Test Zone","latitude":40.0,"longitude":-75.0,"price_per_sqft":300,"rental_yield":7,"infra_score":7,"listing_density":200}'

# Get stats
curl http://127.0.0.1:8000/api/stats/

# Upload CSV
curl -X POST http://127.0.0.1:8000/api/upload-csv/ \
  -F "file=@static/data/sample_data.csv"

# Clear all
curl -X DELETE http://127.0.0.1:8000/api/clear/
```

---

## 📦 requirements.txt contents

```
Django==4.2.7
djangorestframework==3.14.0
django-cors-headers==4.3.1
```

---

## 🐛 Troubleshooting

| Problem | Solution |
|---|---|
| `ModuleNotFoundError: No module named 'django'` | Run `pip install -r requirements.txt` inside your venv |
| Static files (CSS/JS) not loading | Run with `DEBUG=True` (default). If deploying, run `python manage.py collectstatic` |
| Map is blank / no tiles | Check internet connection — map tiles load from CartoDB CDN |
| CSV upload fails | Ensure all 7 required columns are present with exact header names |
| `OperationalError: no such table` | Run `python manage.py migrate` |
| Port 8000 already in use | Run `python manage.py runserver 8080` and visit `:8080` |
