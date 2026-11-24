import { expect, it } from "vitest";
import { deliveryAddressDetails } from "@/lib/delivery-address";

it("preserves address, apartment and every delivery instruction in the order snapshot", () => {
  expect(deliveryAddressDetails({ full_address: "Résidence test", label: "Maison", apartment: "2ème étage, appt 3", instructions: "Code 1234\nAppeler devant le portail" })).toEqual({ address: "Résidence test", label: "Maison", apartment: "2ème étage, appt 3", instructions: "Code 1234\nAppeler devant le portail" });
});
it("supports historical address snapshots without inventing delivery instructions", () => {
  expect(deliveryAddressDetails({ address: "Ancienne adresse" })).toEqual({ address: "Ancienne adresse", label: "", apartment: "", instructions: "" });
  expect(deliveryAddressDetails(null).instructions).toBe("");
});