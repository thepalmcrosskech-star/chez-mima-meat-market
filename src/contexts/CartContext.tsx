import { supabase } from "@/integrations/supabase/client";
import { cartBadgeCount } from "@/lib/cart-display";
import { toast } from "sonner";
import { cartLoginPath } from "@/lib/checkout-access";
import { getQuantityRules } from "@/lib/product-units";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  unit_type: string;
  image_url: string | null;
  category_id?: string | null;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (product: Omit<CartItem, "quantity">, quantity: number) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_KEY = "chezmima_cart";

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(CART_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);

  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(!!session));
    return () => data.subscription.unsubscribe();
  }, []);

  const addItem = (product: Omit<CartItem, "quantity">, quantity: number) => {
    if (!signedIn) {
      toast("Créez votre espace client pour ajouter des articles au panier");
      window.location.assign(cartLoginPath(window.location.pathname + window.location.search));
      return;
    }
    setItems((prev) => {
      const { minimum, maximum } = getQuantityRules(product.unit_type, product.category_id);
      const withinLimits = (value: number) =>
        +(maximum === null ? value : Math.min(maximum, Math.max(minimum, value))).toFixed(2);
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.id === product.id
            ? { ...i, category_id: i.category_id ?? product.category_id, quantity: withinLimits(i.quantity + quantity) }
            : i
        );
      }
      return [...prev, { ...product, quantity: withinLimits(quantity) }];
    });
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity } : i))
    );
  };

  const clearCart = () => setItems([]);

  const totalItems = cartBadgeCount(items);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems, subtotal }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
