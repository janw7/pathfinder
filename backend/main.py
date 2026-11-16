import json

import httpx
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import Base, Route, SessionLocal, engine
from routing import EMISSION_FACTORS, calculate_route_data

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Pathfinder Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RouteCreate(BaseModel):
    waypoints: list[str]
    vehicle_type: str


class RouteUpdate(BaseModel):
    vehicle_type: str


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def compute_or_400(waypoints: list[str], vehicle_type: str) -> dict:
    if len(waypoints) < 2:
        raise HTTPException(status_code=400, detail="At least 2 waypoints are required")
    if vehicle_type not in EMISSION_FACTORS:
        raise HTTPException(status_code=400, detail=f"Unknown vehicle_type: {vehicle_type}")
    try:
        return calculate_route_data(waypoints, vehicle_type)
    except (ValueError, httpx.HTTPError) as e:
        raise HTTPException(status_code=502, detail=f"Routing service error: {e}")


@app.get("/api/health")
def health_check():
    return {"status": "Pathfinder Backend is alive"}


@app.post("/api/routes", status_code=201)
def create_route(payload: RouteCreate, db: Session = Depends(get_db)):
    route_data = compute_or_400(payload.waypoints, payload.vehicle_type)
    route = Route(
        waypoints=json.dumps(payload.waypoints),
        vehicle_type=payload.vehicle_type,
        distance_km=route_data["distance_km"],
        co2_emission=route_data["co2_emission"],
        coordinates=json.dumps(route_data["coordinates"]),
        route_geometry=json.dumps(route_data["route_geometry"]),
    )
    db.add(route)
    db.commit()
    db.refresh(route)
    return serialize(route)


@app.get("/api/routes")
def list_routes(db: Session = Depends(get_db)):
    routes = db.query(Route).all()
    return [serialize(r) for r in routes]


@app.put("/api/routes/{route_id}")
def update_route(route_id: int, payload: RouteUpdate, db: Session = Depends(get_db)):
    route = db.query(Route).get(route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    waypoints = json.loads(route.waypoints)
    route_data = compute_or_400(waypoints, payload.vehicle_type)

    route.vehicle_type = payload.vehicle_type
    route.distance_km = route_data["distance_km"]
    route.co2_emission = route_data["co2_emission"]
    route.coordinates = json.dumps(route_data["coordinates"])
    route.route_geometry = json.dumps(route_data["route_geometry"])
    db.commit()
    db.refresh(route)
    return serialize(route)


@app.delete("/api/routes/{route_id}", status_code=204)
def delete_route(route_id: int, db: Session = Depends(get_db)):
    route = db.query(Route).get(route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    db.delete(route)
    db.commit()


def serialize(route: Route) -> dict:
    return {
        "id": route.id,
        "waypoints": json.loads(route.waypoints),
        "vehicle_type": route.vehicle_type,
        "distance_km": route.distance_km,
        "co2_emission": route.co2_emission,
        "coordinates": json.loads(route.coordinates) if route.coordinates else None,
        "route_geometry": json.loads(route.route_geometry) if route.route_geometry else None,
        "ai_advice": route.ai_advice,
    }
