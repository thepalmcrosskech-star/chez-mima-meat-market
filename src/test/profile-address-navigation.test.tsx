import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ProfilePage from "@/pages/ProfilePage";

const navigate = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
vi.mock("@/components/OriginPromise", () => ({ CustomerHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header> }));
vi.mock("@/components/BottomNav", () => ({ default: () => null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "customer" } } }) },
  from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { id: "customer", name: "Client", email: "client@example.com", phone: null, role: "user" } }) }) }) }),
} }));
afterEach(() => { cleanup(); navigate.mockClear(); });

it("opens the saved address book from the profile, not the order history", async () => {
  const view = render(<ProfilePage />);
  const button = await view.findByRole("button", { name: "Mes adresses" });
  fireEvent.click(button);
  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/addresses"));
  expect(navigate).not.toHaveBeenCalledWith("/orders");
});