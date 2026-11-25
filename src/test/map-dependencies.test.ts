import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// mapbox-gl powers the staff, driver and admin maps. It used to arrive only as a
// transitive copy carried by its own type package, so removing or updating that
// type package would silently break the app at build time.
const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
const deps = packageJson.dependencies as Record<string, string>;
const devDeps = packageJson.devDependencies as Record<string, string>;

describe("dépendances des cartes", () => {
  it("mapbox-gl est une dépendance déclarée, pas une copie transitive", () => {
    expect(deps["mapbox-gl"]).toBeDefined();
    expect(devDeps["mapbox-gl"]).toBeUndefined();
    expect(deps["mapbox-gl"]).toMatch(/^\^?3\./);
  });

  it("les pages qui importent mapbox-gl trouvent la bibliothèque déclarée", () => {
    const importers = [
      "src/components/MapboxMap.tsx",
      "src/components/driver/DeliveryRequest.tsx",
      "src/pages/OrderTrackingPage.tsx",
      "src/pages/admin/AdminDeliveryZones.tsx",
      "src/pages/admin/AdminDrivers.tsx",
      "src/pages/admin/AdminSettings.tsx",
      "src/pages/driver/DriverActiveDelivery.tsx",
    ];
    for (const file of importers) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      if (source.includes('from "mapbox-gl"')) {
        expect(deps["mapbox-gl"], `${file} importe mapbox-gl sans dépendance déclarée`).toBeDefined();
      }
    }
  });

  it("garde la bibliothèque Leaflet des adresses clients", () => {
    expect(deps["leaflet"]).toBeDefined();
    expect(deps["@types/leaflet"] ?? devDeps["@types/leaflet"]).toBeDefined();
  });
});
