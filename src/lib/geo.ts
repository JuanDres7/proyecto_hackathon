export type GeoPoint = { lat: number; lng: number; accuracy?: number; mocked?: boolean };

const MAX_ACCURACY_M = 80;

export function haversineMeters(a: GeoPoint, b: GeoPoint) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function validateGeofence(
  current: GeoPoint,
  site: GeoPoint | null | undefined,
  radiusM = 120,
): { ok: boolean; reason?: string; distanceM?: number } {
  if (current.mocked) return { ok: false, reason: "gps_spoofed" };
  if (current.accuracy != null && current.accuracy > MAX_ACCURACY_M) {
    return { ok: false, reason: "gps_inaccurate", distanceM: current.accuracy };
  }
  if (!site) return { ok: true };
  const distanceM = haversineMeters(current, site);
  if (distanceM > radiusM) return { ok: false, reason: "outside_geofence", distanceM };
  return { ok: true, distanceM };
}

export function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function getCurrentPosition(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocalización no disponible en este navegador"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          mocked: Boolean((pos.coords as GeolocationCoordinates & { mocked?: boolean }).mocked),
        }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  });
}
