import { useEffect, useState } from 'react'
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import {
  CheckCircle2,
  Fuel,
  Gauge,
  Leaf,
  MapPin,
  Navigation,
  Plus,
  Route,
  Star,
  Trash2,
  Truck,
  X,
} from 'lucide-react'

const API_BASE = 'http://localhost:8000/api'

const VEHICLE_TYPES = [
  'Car (Combustion)',
  'Car (Electric)',
  'Van (Combustion)',
  'Van (Electric)',
  'Light Truck',
  'Heavy Truck',
]

const DEFAULT_VEHICLE = 'Van (Combustion)'
const VEHICLE_STORAGE_KEY = 'defaultVehicle'

// Fix for Leaflet's default marker icons not resolving under Vite
const DefaultIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

function FitBounds({ positions }) {
  const map = useMap()
  useEffect(() => {
    if (!positions || positions.length === 0) return
    if (positions.length === 1) {
      map.setView(positions[0], 12)
    } else {
      map.fitBounds(L.latLngBounds(positions).pad(0.15))
    }
  }, [positions, map])
  return null
}

function isElectric(vehicleType) {
  return vehicleType.includes('Electric')
}

function VehicleBadge({ vehicleType }) {
  const electric = isElectric(vehicleType)
  const Icon = electric ? Leaf : vehicleType.includes('Truck') ? Truck : Fuel
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
        electric
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-amber-200 bg-amber-50 text-amber-700'
      }`}
    >
      <Icon className="h-3 w-3" />
      {vehicleType}
    </span>
  )
}

function App() {
  const [waypoints, setWaypoints] = useState(['', ''])
  const [vehicleType, setVehicleType] = useState(() => {
    const saved = localStorage.getItem(VEHICLE_STORAGE_KEY)
    return VEHICLE_TYPES.includes(saved) ? saved : DEFAULT_VEHICLE
  })
  const [defaultSaved, setDefaultSaved] = useState(false)
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [mapView, setMapView] = useState(null) // { positions, labels, path, summary }
  const [selectedRouteId, setSelectedRouteId] = useState(null)

  async function fetchRoutes() {
    try {
      const res = await fetch(`${API_BASE}/routes`)
      if (!res.ok) throw new Error(`Failed to load routes (${res.status})`)
      setRoutes(await res.json())
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    fetchRoutes()
  }, [])

  function updateWaypoint(index, value) {
    setWaypoints((wps) => wps.map((wp, i) => (i === index ? value : wp)))
  }

  function addStop() {
    // Insert before the last waypoint (the End input)
    setWaypoints((wps) => [...wps.slice(0, -1), '', wps[wps.length - 1]])
  }

  function removeStop(index) {
    if (waypoints.length <= 2) return
    setWaypoints((wps) => wps.filter((_, i) => i !== index))
  }

  function handleVehicleChange(value) {
    setVehicleType(value)
  }

  function handleSetDefault() {
    localStorage.setItem(VEHICLE_STORAGE_KEY, vehicleType)
    setDefaultSaved(true)
    setTimeout(() => setDefaultSaved(false), 1500)
  }

  const savedDefault =
    localStorage.getItem(VEHICLE_STORAGE_KEY) || DEFAULT_VEHICLE
  const isDefaultVehicle = vehicleType === savedDefault

  function buildSummary(names, distanceKm, co2) {
    return {
      title: names.join(' → '),
      distance_km: distanceKm,
      co2_emission: co2,
      vehicle_type: vehicleType,
    }
  }

  function showRouteOnMap(waypointNames, coordinates, geometry, summary) {
    if (!coordinates || coordinates.length === 0) return
    setMapView({
      positions: coordinates,
      labels: waypointNames,
      path: geometry,
      summary,
    })
  }

  function handleRowClick(route) {
    setSelectedRouteId(route.id)
    showRouteOnMap(route.waypoints, route.coordinates, route.route_geometry, {
      title: route.waypoints.join(' → '),
      distance_km: route.distance_km,
      co2_emission: route.co2_emission,
      vehicle_type: route.vehicle_type,
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const filled = waypoints.map((wp) => wp.trim()).filter(Boolean)
    if (filled.length < 2) {
      setError('Please provide at least 2 waypoints (start and end).')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waypoints: filled, vehicle_type: vehicleType }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || `Request failed (${res.status})`)
      }
      setRoutes((prev) => [...prev, data])
      setSelectedRouteId(data.id)
      showRouteOnMap(
        filled,
        data.coordinates,
        data.route_geometry,
        buildSummary(filled, data.distance_km, data.co2_emission)
      )
      setWaypoints(['', ''])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleVehicleUpdate(routeId, newVehicleType) {
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/routes/${routeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicle_type: newVehicleType }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || `Update failed (${res.status})`)
      }
      setRoutes((prev) => prev.map((r) => (r.id === routeId ? data : r)))
      if (routeId === selectedRouteId) {
        showRouteOnMap(data.waypoints, data.coordinates, data.route_geometry, {
          title: data.waypoints.join(' → '),
          distance_km: data.distance_km,
          co2_emission: data.co2_emission,
          vehicle_type: data.vehicle_type,
        })
      }
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleDelete(routeId) {
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/routes/${routeId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error(`Delete failed (${res.status})`)
      setRoutes((prev) => prev.filter((r) => r.id !== routeId))
      if (routeId === selectedRouteId) {
        setSelectedRouteId(null)
        setMapView(null)
      }
    } catch (e) {
      setError(e.message)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500'

  const totalDistance = routes.reduce((sum, r) => sum + (r.distance_km || 0), 0)
  const totalCo2 = routes.reduce((sum, r) => sum + (r.co2_emission || 0), 0)

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900 text-white shadow">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600">
              <Navigation className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Pathfinder</h1>
              <p className="text-xs text-slate-400">Fleet &amp; Carbon Dispatch</p>
            </div>
          </div>

          <nav className="ml-6 hidden items-center gap-1 sm:flex">
            <button
              onClick={() => scrollTo('planner')}
              className="rounded-md px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              Dispatch Planner
            </button>
            <button
              onClick={() => scrollTo('my-routes')}
              className="rounded-md px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              My Routes
            </button>
          </nav>

          <div className="ml-auto flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1 text-xs text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            OSRM Routing: Ready
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* KPI Summary Strip */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Route className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Active Routes
              </p>
              <p className="text-2xl font-bold text-slate-800">{routes.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
              <Gauge className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Total Fleet Distance
              </p>
              <p className="text-2xl font-bold text-slate-800">
                {totalDistance.toFixed(1)}
                <span className="ml-1 text-sm font-medium text-slate-500">km</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Leaf className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Tracked CO2 Footprint
              </p>
              <p className="text-2xl font-bold text-slate-800">
                {totalCo2.toFixed(1)}
                <span className="ml-1 text-sm font-medium text-slate-500">kg</span>
              </p>
            </div>
          </div>
        </div>

        {/* Split-Screen Workspace */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Route Planner Form */}
          <section
            id="planner"
            className="rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-5"
          >
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-800">
                New Route Dispatch
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
              {/* Waypoint timeline */}
              <div>
                {waypoints.map((wp, i) => {
                  const isFirst = i === 0
                  const isLast = i === waypoints.length - 1
                  const isMiddle = !isFirst && !isLast
                  return (
                    <div key={i} className="flex gap-3">
                      {/* Timeline rail */}
                      <div className="flex w-6 flex-col items-center">
                        <div
                          className={`z-10 mt-2.5 h-3 w-3 shrink-0 rounded-full border-2 ${
                            isFirst
                              ? 'border-emerald-500 bg-emerald-500'
                              : isLast
                                ? 'border-rose-400 bg-rose-400'
                                : 'border-sky-500 bg-sky-500'
                          }`}
                        />
                        {!isLast && <div className="w-px flex-1 bg-slate-300" />}
                      </div>
                      {/* Input */}
                      <div className="flex flex-1 items-center gap-2 pb-3">
                        <div className="relative flex-1">
                          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={wp}
                            onChange={(e) => updateWaypoint(i, e.target.value)}
                            placeholder={
                              isFirst
                                ? 'Origin city'
                                : isLast
                                  ? 'Destination city'
                                  : 'Stopover city'
                            }
                            className={`${inputClass} pl-9`}
                          />
                        </div>
                        {isMiddle && (
                          <button
                            type="button"
                            onClick={() => removeStop(i)}
                            className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            title="Remove stop"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={addStop}
                className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-emerald-400 hover:text-emerald-600"
              >
                <Plus className="h-4 w-4" />
                Add Stop
              </button>

              {/* Vehicle selector + default */}
              <div className="space-y-2">
                <label
                  htmlFor="vehicle"
                  className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Vehicle Type
                </label>
                <div className="flex items-center gap-2">
                  <select
                    id="vehicle"
                    value={vehicleType}
                    onChange={(e) => handleVehicleChange(e.target.value)}
                    className={`${inputClass} flex-1`}
                  >
                    {VEHICLE_TYPES.map((vt) => (
                      <option key={vt} value={vt}>
                        {vt}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleSetDefault}
                    title="Save as default vehicle"
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                      defaultSaved
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : isDefaultVehicle
                          ? 'border-amber-300 bg-amber-50 text-amber-700'
                          : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {defaultSaved ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Star
                        className={`h-4 w-4 ${isDefaultVehicle ? 'fill-amber-400 text-amber-500' : ''}`}
                      />
                    )}
                    {defaultSaved ? 'Saved' : isDefaultVehicle ? 'Default' : 'Set Default'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <Spinner /> : <Navigation className="h-4 w-4" />}
                {loading ? 'Calculating route…' : 'Calculate Route'}
              </button>
            </form>
          </section>

          {/* Map */}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-7">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-800">Route Map</h2>
            </div>
            <div className="relative h-[480px] min-h-[480px]">
              <MapContainer
                center={[52.0, 19.0]}
                zoom={6}
                className="h-full w-full"
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {mapView && <FitBounds positions={mapView.path || mapView.positions} />}
                {mapView && (
                  <>
                    <Polyline
                      positions={mapView.path || mapView.positions}
                      pathOptions={{ color: '#059669', weight: 4, opacity: 0.8 }}
                    />
                    {mapView.positions.map((pos, i) => (
                      <Marker key={i} position={pos} icon={DefaultIcon}>
                        <Tooltip direction="top" offset={[0, -34]}>
                          {mapView.labels[i] || `Stop ${i + 1}`}
                        </Tooltip>
                      </Marker>
                    ))}
                  </>
                )}
              </MapContainer>

              {/* Floating route info card */}
              {mapView?.summary && (
                <div className="absolute right-3 top-3 z-[1000] w-64 rounded-lg bg-white/95 p-3 shadow-lg backdrop-blur">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <Route className="h-3.5 w-3.5 text-emerald-600" />
                    Active Route
                  </p>
                  <p className="mb-2 line-clamp-2 text-sm font-medium text-slate-800">
                    {mapView.summary.title}
                  </p>
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>Distance</span>
                    <span className="font-semibold text-slate-800">
                      {mapView.summary.distance_km} km
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
                    <span>CO2</span>
                    <span className="font-semibold text-slate-800">
                      {mapView.summary.co2_emission} kg
                    </span>
                  </div>
                  <div className="mt-2">
                    <VehicleBadge vehicleType={mapView.summary.vehicle_type} />
                  </div>
                </div>
              )}

              {!mapView && (
                <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center">
                  <div className="rounded-lg bg-white/90 px-4 py-2 text-sm text-slate-500 shadow backdrop-blur">
                    Calculate a route or select one from My Routes
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* My Routes */}
        <section
          id="my-routes"
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-800">My Routes</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
              {routes.length}
            </span>
          </div>
          {routes.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-500">
              No routes yet. Plan your first route above.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-6 py-3">ID</th>
                    <th className="px-6 py-3">Route</th>
                    <th className="px-6 py-3">Vehicle</th>
                    <th className="px-6 py-3">Distance (km)</th>
                    <th className="px-6 py-3">CO2 (kg)</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {routes.map((route) => (
                    <tr
                      key={route.id}
                      onClick={() => handleRowClick(route)}
                      className={`cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50 ${
                        route.id === selectedRouteId ? 'bg-emerald-50/60' : ''
                      }`}
                    >
                      <td className="px-6 py-3 font-medium text-slate-600">
                        #{route.id}
                      </td>
                      <td className="px-6 py-3 text-slate-800">
                        {route.waypoints.join(' → ')}
                      </td>
                      <td className="px-6 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col gap-1.5">
                          <VehicleBadge vehicleType={route.vehicle_type} />
                          <select
                            value={route.vehicle_type}
                            onChange={(e) =>
                              handleVehicleUpdate(route.id, e.target.value)
                            }
                            className="w-44 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          >
                            {VEHICLE_TYPES.map((vt) => (
                              <option key={vt} value={vt}>
                                {vt}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-slate-700">
                        {route.distance_km}
                      </td>
                      <td className="px-6 py-3 text-slate-700">
                        {route.co2_emission}
                      </td>
                      <td className="px-6 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDelete(route.id)}
                          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          title="Delete route"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
