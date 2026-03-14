import { useState, useEffect, useCallback } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const STORAGE_KEY = "wishlist";

function getWishlist(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function setWishlist(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function useWishlist() {
  const [wishlist, setWishlistState] = useState<string[]>(getWishlist);

  const toggle = useCallback((productId: string) => {
    setWishlistState((prev) => {
      const next = prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId];
      setWishlist(next);
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (productId: string) => wishlist.includes(productId),
    [wishlist]
  );

  return { wishlist, toggle, isFavorite };
}

interface WishlistButtonProps {
  productId: string;
  isFavorite: boolean;
  onToggle: (id: string) => void;
  className?: string;
  size?: "sm" | "md";
}

export const WishlistButton = ({ productId, isFavorite, onToggle, className = "", size = "sm" }: WishlistButtonProps) => {
  const s = size === "sm" ? "w-8 h-8" : "w-10 h-10";
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <Button
      variant="ghost"
      size="icon"
      className={`${s} rounded-full bg-background/80 backdrop-blur-sm hover:bg-background/90 transition-colors ${className}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle(productId);
        toast({
          title: isFavorite ? "Retiré des favoris" : "Ajouté aux favoris ❤️",
        });
      }}
    >
      <Heart
        className={`${iconSize} transition-colors ${
          isFavorite ? "text-primary fill-primary" : "text-muted-foreground hover:text-primary"
        }`}
      />
    </Button>
  );
};
