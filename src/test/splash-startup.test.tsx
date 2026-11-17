import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SplashScreen from "@/components/SplashScreen";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("startup with a stalled logo", () => {
  it("completes even when the logo never finishes loading", () => {
    vi.useFakeTimers();
    vi.stubGlobal("Image", class {
      complete = false;
      src = "";
      onload = null;
      onerror = null;
    });
    const complete = vi.fn();
    render(<SplashScreen onComplete={complete} />);
    act(() => vi.advanceTimersByTime(1200));
    expect(complete).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(2700));
    expect(complete).toHaveBeenCalledTimes(1);
  });
});