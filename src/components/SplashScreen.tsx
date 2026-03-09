import { useState, useEffect } from "react";
import logo from "@/assets/logo.jpeg";

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadeOut(true), 1500);
    const completeTimer = setTimeout(() => onComplete(), 2000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-transparent to-primary/10" />

      {/* Logo */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="relative">
          <div className="absolute -inset-4 rounded-full bg-primary/20 blur-xl animate-pulse" />
          <img
            src={logo}
            alt="Chez Mima"
            className="relative w-32 h-32 rounded-full object-cover border-4 border-primary shadow-2xl animate-pulse"
          />
        </div>

        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          Chez Mima
        </h1>

        {/* Loading indicator */}
        <div className="flex gap-1.5 mt-4">
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
