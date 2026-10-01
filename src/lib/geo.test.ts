import { describe, expect, it } from "vitest";
import { haversineMeters, validateGeofence } from "./geo";

describe("geo", () => {
  it("measures nearby points under 120m", () => {
    const a = { lat: 4.7642, lng: -74.0465 };
    const b = { lat: 4.7643, lng: -74.0466 };
    expect(haversineMeters(a, b)).toBeLessThan(120);
  });

  it("rejects spoofed gps", () => {
    const r = validateGeofence({ lat: 4.76, lng: -74.04, mocked: true }, { lat: 4.76, lng: -74.04 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("gps_spoofed");
  });

  it("rejects outside geofence", () => {
    const r = validateGeofence({ lat: 4.8, lng: -74.1 }, { lat: 4.7642, lng: -74.0465 }, 120);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("outside_geofence");
  });
});
