import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AddressPicker from "@/components/AddressPicker";

vi.mock("@/components/DeliveryLocationMap", () => ({
  default: ({ onSelect }: { onSelect: (point: [number, number]) => void }) =>
    <button onClick={() => onSelect([-8.01, 31.63])}>Select test position</button>,
}));

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("customer delivery address", () => {
  it("keeps GPS coordinates with the customer's residence", () => {
    const onSelect = vi.fn();
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
      getCurrentPosition: vi.fn(success => success({ coords: { longitude: -8.01, latitude: 31.63, accuracy: 25 } })),
    } });
    const view = render(<AddressPicker onSelect={onSelect} />);
    fireEvent.click(view.getByRole("button", { name: "Autoriser et me localiser" }));
    expect(onSelect).toHaveBeenLastCalledWith({ full_address: "Position GPS : 31.63000, -8.01000", latitude: 31.63, longitude: -8.01 });
    fireEvent.change(view.getByLabelText("Quartier / Résidence / Rue"), { target: { value: "Guéliz, résidence Les Palmiers" } });
    expect(onSelect).toHaveBeenLastCalledWith({ full_address: "Guéliz, résidence Les Palmiers", latitude: 31.63, longitude: -8.01 });
  });

  it("accepts a position from the map without requesting GPS permission", () => {
    const gps = vi.fn();
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: gps } });
    const onSelect = vi.fn();
    const view = render(<AddressPicker onSelect={onSelect} />);
    fireEvent.change(view.getByLabelText("Quartier / Résidence / Rue"), { target: { value: "Résidence Atlas" } });
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(view.getByRole("button", { name: "Choisir sur le plan" }));
    fireEvent.click(view.getByRole("button", { name: "Select test position" }));
    expect(gps).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenLastCalledWith({ full_address: "Résidence Atlas", latitude: 31.63, longitude: -8.01 });
  });

  it("does not invent coordinates when GPS permission is denied", () => {
    const onSelect = vi.fn();
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
      getCurrentPosition: vi.fn((_success, failure) => failure({ code: 1 })),
    } });
    const view = render(<AddressPicker onSelect={onSelect} />);
    fireEvent.click(view.getByRole("button", { name: "Autoriser et me localiser" }));
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(view.getByRole("button", { name: "Select test position" }));
    expect(onSelect).toHaveBeenLastCalledWith({ full_address: "Position GPS : 31.63000, -8.01000", latitude: 31.63, longitude: -8.01 });
  });
});