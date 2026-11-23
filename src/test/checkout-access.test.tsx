import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const auth = vi.hoisted(() => ({ getUser: vi.fn(), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth } }));
import RequireCheckoutSession from "@/components/RequireCheckoutSession";
import { loginDestination } from "@/lib/checkout-access";

afterEach(cleanup);
function openCheckout() {
  render(<MemoryRouter initialEntries={["/checkout"]}><Routes>
    <Route path="/checkout" element={<RequireCheckoutSession><div>customer-checkout</div></RequireCheckoutSession>} />
    <Route path="/login" element={<div>account-required</div>} />
  </Routes></MemoryRouter>);
}
describe("visitor checkout access", () => {
  it("requires an account to finalize a visitor order", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    openCheckout();
    expect(await screen.findByText("account-required")).not.toBeNull();
    expect(screen.queryByText("customer-checkout")).toBeNull();
  });
  it("allows a signed-in customer to finalize an order", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: "customer" } }, error: null });
    openCheckout();
    expect(await screen.findByText("customer-checkout")).not.toBeNull();
  });
  it("returns the customer to checkout after login", () => {
    expect(loginDestination(["user"], "/checkout")).toBe("/checkout");
  });
  it("does not redirect to an arbitrary external destination", () => {
    expect(loginDestination(["user"], "https://example.com")).toBe("/");
  });
  it("preserves administrator and driver destinations", () => {
    expect(loginDestination(["admin"], "/checkout")).toBe("/admin");
    expect(loginDestination(["employee"], "/checkout")).toBe("/staff");
    expect(loginDestination(["driver"], "/checkout")).toBe("/driver");
  });
});describe("cart login return", () => {
  it("returns a customer to the product page after login", () => {
    expect(loginDestination(["user"], "/product/abc")).toBe("/product/abc");
  });
  it("never returns a customer to staff pages", () => {
    expect(loginDestination(["user"], "/admin")).toBe("/");
    expect(loginDestination(["user"], "/staff")).toBe("/");
  });
});
