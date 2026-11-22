import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductPhoto } from "@/components/ProductPhoto";

afterEach(cleanup);

describe("product photo loading", () => {
  it("does not allow opening a partially decoded photo", async () => {
    const open = vi.fn();
    const view = render(<ProductPhoto src="/chicken.jpg" alt="Filet poulet" onOpen={open} />);
    const image = view.getByAltText("Filet poulet");
    Object.defineProperty(image, "naturalWidth", { value: 848 });
    let finish: (() => void) | undefined;
    Object.defineProperty(image, "decode", { value: () => new Promise<void>(resolve => { finish = resolve; }) });
    fireEvent.load(image);
    expect(view.queryByRole("button", { name: /Agrandir/ })).toBeNull();
    await act(async () => { finish?.(); });
    fireEvent.click(view.getByRole("button", { name: /Agrandir/ }));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("allows retrying a failed photo and decoding the new image", async () => {
    const view = render(<ProductPhoto src="/chicken.jpg" alt="Filet poulet" onOpen={() => {}} />);
    fireEvent.error(view.getByAltText("Filet poulet"));
    fireEvent.click(view.getByRole("button", { name: "Réessayer la photo" }));
    const image = view.getByAltText("Filet poulet");
    Object.defineProperty(image, "naturalWidth", { value: 848 });
    Object.defineProperty(image, "decode", { value: () => Promise.resolve() });
    await act(async () => { fireEvent.load(image); });
    expect(view.queryByRole("button", { name: /Agrandir/ })).not.toBeNull();
  });
});