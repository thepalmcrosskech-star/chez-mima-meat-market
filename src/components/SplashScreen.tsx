import { useState, useEffect } from "react";
import logo from "@/assets/logo.jpeg";

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [fadeOut, setFadeOut] = useState(false);
  const [stage, setStage] = useState(0); // 0: hidden, 1: logo in, 2: text in, 3: dots in

  useEffect(() => {
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
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-background overflow-hidden transition-opacity duration-500 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Animated radial glow */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full transition-all duration-1000 ease-out"
        style={{
          background: "radial-gradient(circle, hsl(var(--primary) / 0.06) 0%, transparent 70%)",
          transform: stage >= 1 ? "scale(1)" : "scale(0)",
          opacity: stage >= 1 ? 1 : 0,
        }}
      />

      {/* Spinning ring */}
      <div
        className="absolute w-44 h-44 rounded-full border-2 border-primary/10 transition-all duration-700 ease-out"
        style={{
          transform: stage >= 1 ? "scale(1) rotate(0deg)" : "scale(0.5) rotate(-180deg)",
          opacity: stage >= 1 ? 1 : 0,
          animation: stage >= 1 ? "spin 8s linear infinite" : "none",
          borderTopColor: "hsl(var(--primary) / 0.25)",
        }}
      />

      {/* Logo */}
      <div className="relative z-10 flex flex-col items-center gap-5">
        <div
          className="relative transition-all duration-700 ease-out"
          style={{
            transform: stage >= 1 ? "scale(1) translateY(0)" : "scale(0.3) translateY(40px)",
            opacity: stage >= 1 ? 1 : 0,
          }}
        >
          {/* Glow behind logo */}
          <div
            className="absolute -inset-6 rounded-full blur-2xl transition-opacity duration-1000"
            style={{
              background: "hsl(var(--primary) / 0.12)",
              opacity: stage >= 1 ? 1 : 0,
            }}
          />
          <img
            src={logo}
            alt="Chez Mima"
            className="relative w-36 h-36 rounded-full object-cover border-4 border-primary/40 shadow-[0_0_30px_hsl(var(--primary)/0.15)]"
          />
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
            Boucherie & Traiteur
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
