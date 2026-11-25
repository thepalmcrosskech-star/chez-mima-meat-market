import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Operational maps must remain keyless, with Leaflet also used by customer addresses.
const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
const deps = packageJson.dependencies as Record<string, string>;
const devDeps = packageJson.devDependencies as Record<string, string>;

describe("dépendances des cartes", () => {
  it("ne dépend plus de Mapbox", () => {
    expect(deps["mapbox-gl"]).toBeUndefined();
    expect(devDeps["mapbox-gl"]).toBeUndefined();
    expect(deps["@types/mapbox-gl"]).toBeUndefined();
  });

  it("les cartes opérationnelles utilisent Leaflet sans import Mapbox", () => {
    const importers = [
      "src/components/OpenStreetMap.tsx",
      "src/components/driver/DeliveryRequest.tsx",
      "src/pages/OrderTrackingPage.tsx",
      "src/pages/admin/AdminDeliveryZones.tsx",
      "src/pages/admin/AdminDrivers.tsx",
      "src/pages/admin/AdminSettings.tsx",
      "src/pages/driver/DriverActiveDelivery.tsx",
    ];
    for (const file of importers) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source, file).not.toMatch(/mapbox-gl|api\.mapbox\.com|getMapboxToken/);
      expect(deps.leaflet).toBeDefined();
    }
  });

  it("garde la bibliothèque Leaflet des adresses clients", () => {
    expect(deps["leaflet"]).toBeDefined();
    expect(deps["@types/leaflet"] ?? devDeps["@types/leaflet"]).toBeDefined();
  });
});
