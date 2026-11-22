import { useEffect, useRef, useState } from "react";
import { ImageOff, Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ProductPhoto({ src, alt, className, imageClassName, onOpen }: {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  onOpen?: () => void;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    const image = imageRef.current;
    setStatus("loading");
    const fail = () => { if (active) setStatus("error"); };
    const loaded = async () => {
      if (!image?.naturalWidth) return fail();
      try {
        await image.decode();
        if (active) setStatus("ready");
      } catch { fail(); }
    };
    image?.addEventListener("load", loaded);
    image?.addEventListener("error", fail);
    if (image?.complete) {
      if (image.naturalWidth) void loaded();
      else fail();
    }
    return () => {
      active = false;
      image?.removeEventListener("load", loaded);
      image?.removeEventListener("error", fail);
    };
  }, [src, attempt]);

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)} aria-busy={status === "loading"}>
      <img
        key={`${src}:${attempt}`}
        ref={imageRef}
        src={src}
        alt={alt}
        loading="eager"
        decoding="async"
        className={cn("absolute inset-0 h-full w-full object-cover", status !== "ready" && "invisible", imageClassName)}
      />
      {status === "loading" && <div className="absolute inset-0 flex items-center justify-center" role="status" aria-label="Chargement de la photo"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
      {status === "error" && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <ImageOff className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <Button variant="outline" onClick={(event) => { event.stopPropagation(); setStatus("loading"); setAttempt(value => value + 1); }}><RotateCw />Réessayer la photo</Button>
      </div>}
      {status === "ready" && onOpen && <Button variant="ghost" className="absolute inset-0 h-full w-full rounded-none p-0 hover:bg-transparent cursor-zoom-in" aria-label={`Agrandir la photo : ${alt}`} onClick={onOpen} />}
    </div>
  );
}