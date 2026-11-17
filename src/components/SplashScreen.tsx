import { useState, useEffect } from "react";
import { brandLogo as logo } from "@/lib/brand";

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [fadeOut, setFadeOut] = useState(false);
  const [stage, setStage] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);

  // A stalled image must never prevent the underlying application from opening.
  useEffect(() => {
    const img = new Image();
    const fallback = window.setTimeout(() => setImageLoaded(true), 1200);
    img.onload = () => setImageLoaded(true);
    img.onerror = () => setImageLoaded(true); // proceed anyway on error
    img.src = logo;
    // If image is already cached
    if (img.complete) setImageLoaded(true);
    return () => {
      window.clearTimeout(fallback);
      img.onload = null;
      img.onerror = null;
    };
  }, []);

  useEffect(() => {
    if (!imageLoaded) return;

    const t1 = setTimeout(() => setStage(1), 100);
    const t2 = setTimeout(() => setStage(2), 600);
    const t3 = setTimeout(() => setStage(3), 1000);
    const t4 = setTimeout(() => setFadeOut(true), 2200);
    const t5 = setTimeout(() => onComplete(), 2700);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [onComplete, imageLoaded]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-background overflow-hidden transition-opacity duration-500 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Logo */}
      <div className="relative z-10 flex flex-col items-center gap-5">
        <div
          className="relative transition-all duration-700 ease-out"
          style={{
            transform: stage >= 1 ? "scale(1) translateY(0)" : "scale(0.3) translateY(40px)",
            opacity: stage >= 1 ? 1 : 0,
          }}
        >
          <div className="relative px-3 py-2">
            <img
              src={logo}
              alt="Chez Mima"
              className="w-64 max-w-[78vw] h-auto object-contain"
            />
          </div>
        </div>

        {/* Title with stagger */}
        <div
          className="transition-all duration-500 ease-out"
          style={{
            transform: stage >= 2 ? "translateY(0)" : "translateY(20px)",
            opacity: stage >= 2 ? 1 : 0,
          }}
        >
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            Chez Mima
          </h1>
          <p
            className="text-sm text-muted-foreground text-center mt-1 transition-all duration-500 delay-200"
            style={{
              opacity: stage >= 2 ? 1 : 0,
              transform: stage >= 2 ? "translateY(0)" : "translateY(10px)",
            }}
          >
            Boucherie & Charcuterie
          </p>
        </div>

        {/* Loading bar */}
        <div
          className="w-32 h-1 rounded-full bg-muted overflow-hidden mt-3 transition-opacity duration-300"
          style={{ opacity: stage >= 3 ? 1 : 0 }}
        >
          <div
            className="h-full rounded-full bg-primary transition-all ease-out"
            style={{
              width: stage >= 3 ? "100%" : "0%",
              transitionDuration: "1200ms",
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
