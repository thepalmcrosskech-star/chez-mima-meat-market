import { act, cleanup, fireEvent, render } from "@testing-library/react";
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
    const complete = vi.fn();
    render(<SplashScreen onComplete={complete} />);
    act(() => vi.advanceTimersByTime(1199));
    expect(complete).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(complete).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(5000));
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("skips the splash immediately when the displayed logo fails", () => {
    vi.useFakeTimers();
    const complete = vi.fn();
    const { getByAltText } = render(<SplashScreen onComplete={complete} />);
    fireEvent.error(getByAltText("Chez Mima"));
    act(() => vi.advanceTimersByTime(1200));
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("waits for the displayed logo to decode before starting the animation", async () => {
    vi.useFakeTimers();
    const complete = vi.fn();
    const { getByAltText } = render(<SplashScreen onComplete={complete} />);
    const img = getByAltText("Chez Mima");
    Object.defineProperty(img, "naturalWidth", { value: 768 });
    let finishDecode: (() => void) | undefined;
    Object.defineProperty(img, "decode", { value: () => new Promise<void>(resolve => { finishDecode = resolve; }) });
    fireEvent.load(img);
    act(() => vi.advanceTimersByTime(500));
    expect(complete).not.toHaveBeenCalled();
    await act(async () => { finishDecode?.(); });
    act(() => vi.advanceTimersByTime(2700));
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("does not restart the splash after a load event arrives beyond the deadline", async () => {
    vi.useFakeTimers();
    const complete = vi.fn();
    const { getByAltText } = render(<SplashScreen onComplete={complete} />);
    act(() => vi.advanceTimersByTime(1200));
    const img = getByAltText("Chez Mima");
    Object.defineProperty(img, "naturalWidth", { value: 768 });
    await act(async () => { fireEvent.load(img); });
    act(() => vi.advanceTimersByTime(5000));
    expect(complete).toHaveBeenCalledTimes(1);
  });
});