from sqlalchemy import Column, Integer, String, Float
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy import create_engine

SQLALCHEMY_DATABASE_URL = "sqlite:///./pathfinder.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Route(Base):
    __tablename__ = "routes"

    id = Column(Integer, primary_key=True, index=True)
    waypoints = Column(String, nullable=False)
    vehicle_type = Column(String, nullable=False)
    distance_km = Column(Float, nullable=False)
    co2_emission = Column(Float, nullable=False)
    coordinates = Column(String, nullable=True)
    route_geometry = Column(String, nullable=True)
    ai_advice = Column(String, nullable=True)
