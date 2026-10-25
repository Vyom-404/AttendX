export function haversineMeters(latitude1, longitude1, latitude2, longitude2) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = radians(latitude2 - latitude1);
  const longitudeDelta = radians(longitude2 - longitude1);
  const a = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(latitude1)) * Math.cos(radians(latitude2)) *
    Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function parseLocationFix(body, now = new Date()) {
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const accuracyMeters = Number(body.accuracyMeters);
  const timestamp = new Date(body.locationTimestamp);

  if (
    !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
    !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
    !Number.isFinite(accuracyMeters) || accuracyMeters <= 0 ||
    Number.isNaN(timestamp.getTime())
  ) {
    return { error: "LOCATION_INVALID" };
  }

  const ageSeconds = (now.getTime() - timestamp.getTime()) / 1000;
  if (ageSeconds < -10) return { error: "LOCATION_TIMESTAMP_INVALID" };

  return { latitude, longitude, accuracyMeters, ageSeconds: Math.max(0, ageSeconds) };
}

export function evaluateGeofence(fix, geofence) {
  if (!geofence?.center || !Number.isFinite(geofence.radiusMeters)) {
    return { error: "HOSTEL_NOT_CONFIGURED" };
  }
  if (fix.ageSeconds > geofence.maxFixAgeSeconds) return { error: "LOCATION_STALE" };
  if (fix.accuracyMeters > geofence.maxAccuracyMeters) return { error: "LOCATION_ACCURACY_LOW" };

  const distanceMeters = haversineMeters(
    fix.latitude,
    fix.longitude,
    geofence.center.latitude,
    geofence.center.longitude,
  );

  if (distanceMeters - fix.accuracyMeters > geofence.radiusMeters) {
    return { error: "OUTSIDE_GEOFENCE", distanceMeters };
  }
  if (distanceMeters + fix.accuracyMeters > geofence.radiusMeters) {
    return { error: "LOCATION_BOUNDARY_UNCERTAIN", distanceMeters };
  }

  return { distanceMeters };
}
