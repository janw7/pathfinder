import time

import httpx

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OSRM_URL = "http://router.project-osrm.org/route/v1/driving/{coords}"

EMISSION_FACTORS = {
    "Car (Combustion)": 0.15,
    "Car (Electric)": 0.00,
    "Van (Combustion)": 0.25,
    "Van (Electric)": 0.00,
    "Light Truck": 0.45,
    "Heavy Truck": 0.85,
}


def geocode(city: str) -> tuple[float, float]:
    """Return (lon, lat) for a place name via Nominatim."""
    with httpx.Client(timeout=10) as client:
        response = client.get(
            NOMINATIM_URL,
            params={"q": city, "format": "json"},
            headers={"User-Agent": "PathfinderApp/1.0"},
        )
    response.raise_for_status()
    results = response.json()
    if not results:
        raise ValueError(f"Could not geocode waypoint: {city}")
    return float(results[0]["lon"]), float(results[0]["lat"])


def get_osrm_route(coords: str) -> tuple[float, list]:
    """Return (distance_km, geometry) via OSRM for 'lon,lat;lon,lat;...' string.

    geometry is a list of [lon, lat] pairs following the actual road network.
    """
    url = OSRM_URL.format(coords=coords)
    params = {"overview": "full", "geometries": "geojson"}
    with httpx.Client(timeout=30) as client:
        response = client.get(url, params=params)
    response.raise_for_status()
    data = response.json()
    if data.get("code") != "Ok" or not data.get("routes"):
        raise ValueError("OSRM could not calculate a route for the given waypoints")
    route = data["routes"][0]
    return route["distance"] / 1000.0, route["geometry"]["coordinates"]


def calculate_route_data(waypoints: list[str], vehicle_type: str) -> dict:
    coordinates = []
    for city in waypoints:
        coordinates.append(geocode(city))
        time.sleep(1)  # respect Nominatim's 1 req/sec rate limit

    coords = ";".join(f"{lon},{lat}" for lon, lat in coordinates)
    distance_km, geometry = get_osrm_route(coords)

    factor = EMISSION_FACTORS.get(vehicle_type)
    if factor is None:
        raise ValueError(f"Unknown vehicle_type: {vehicle_type}")
    co2 = distance_km * factor

    return {
        "distance_km": round(distance_km, 1),
        "co2_emission": round(co2, 1),
        # [lat, lon] pairs for map rendering
        "coordinates": [[lat, lon] for lon, lat in coordinates],
        # full road geometry, flipped from OSRM's [lon, lat] to Leaflet's [lat, lon]
        "route_geometry": [[lat, lon] for lon, lat in geometry],
    }
