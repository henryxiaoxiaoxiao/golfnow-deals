export interface Coords {
  lat: number;
  lng: number;
  city: string;
  state: string;
}

export async function zipToCoords(zipCode: string): Promise<Coords | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
    if (!res.ok) return null;
    const data = await res.json();
    const place = data.places?.[0];
    if (!place) return null;
    return {
      lat: parseFloat(place.latitude),
      lng: parseFloat(place.longitude),
      city: place["place name"],
      state: place["state abbreviation"],
    };
  } catch {
    return null;
  }
}

export function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function milesPerDegLng(lat: number): number {
  return 69 * Math.cos((lat * Math.PI) / 180);
}

export function randomPointInRadius(
  centerLat: number,
  centerLng: number,
  radiusMiles: number
): { lat: number; lng: number } {
  const r = Math.sqrt(Math.random()) * radiusMiles;
  const theta = Math.random() * 2 * Math.PI;
  const dLat = (r * Math.sin(theta)) / 69;
  const dLng = (r * Math.cos(theta)) / milesPerDegLng(centerLat);
  return { lat: centerLat + dLat, lng: centerLng + dLng };
}
