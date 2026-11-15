import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowLeft,
  Star,
  Plus,
  Minus,
  ShoppingCart,
  Loader2,
  Send,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";

const CHARCUTERIE_CATEGORY_ID = "f6741cb2-ac67-47bb-900d-8d54fb05d1e6";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  unit_type: string;
  image_url: string | null;
  product_info: string | null;
  cooking_tips: string | null;
  conservation_tips: string | null;
  category_id: string | null;
  is_active: boolean | null;
}

interface Review {
  id: string;
  product_id: string;
  rating: number;
  comment: string | null;
  created_at: string | null;
}

import { formatPrice } from "@/lib/format";

const StarRating = ({
  rating,
  interactive = false,
  size = "h-5 w-5",
  onRate,
}: {
  rating: number;
  interactive?: boolean;
  size?: string;
  onRate?: (r: number) => void;
}) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((star) => (
      <Star
        key={star}
        className={`${size} transition-colors ${
          star <= rating
            ? "fill-yellow-400 text-yellow-400"
            : "text-muted-foreground/30"
        } ${interactive ? "cursor-pointer hover:scale-110 transition-transform" : ""}`}
        onClick={() => interactive && onRate?.(star)}
      />
    ))}
  </div>
);

const ProductPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(0.25);
  const [imageZoomed, setImageZoomed] = useState(false);

  // Review form
  const [userRating, setUserRating] = useState(0);
  const [userComment, setUserComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchProduct();
      fetchReviews();
      checkAuth();
    }
  }, [id]);

  useEffect(() => {
    if (product) {
      const isCharc = product.category_id === CHARCUTERIE_CATEGORY_ID;
      setQuantity(product.unit_type === "weight" ? (isCharc ? 0.1 : 0.25) : 1);
    }
  }, [product]);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    setCurrentUserId(session?.user?.id ?? null);
  };

  const fetchProduct = async () => {
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("id", id!)
      .single();
    if (data) setProduct(data);
    setLoading(false);
  };

  const fetchReviews = async () => {
    const { data } = await supabase
      .rpc("get_public_product_reviews", { _product_id: id! });
    if (data) setReviews(data as Review[]);
  };

  const handleAddToCart = () => {
    if (!product) return;
    addItem(
      {
        id: product.id,
        name: product.name,
        price: product.price,
        unit_type: product.unit_type,
        image_url: product.image_url,
      },
      quantity
    );
    toast({
      title: "Ajouté au panier",
      description: `${quantity} ${product.unit_type === "weight" ? "kg" : "×"} ${product.name}`,
    });
  };

  const submitReview = async () => {
    if (!currentUserId || userRating === 0) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une note",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("product_reviews").upsert(
      {
        product_id: id!,
        user_id: currentUserId,
        rating: userRating,
        comment: userComment || null,
      },
      { onConflict: "product_id,user_id" }
    );
    setSubmitting(false);
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de publier votre avis",
        variant: "destructive",
      });
    } else {
      toast({ title: "Merci !", description: "Votre avis a été publié" });
      setUserRating(0);
      setUserComment("");
      fetchReviews();
    }
  };

  const isKg = product?.unit_type === "weight";
  const isCharcuterie = product?.category_id === CHARCUTERIE_CATEGORY_ID;
  const WEIGHT_OPTIONS = isCharcuterie
    ? [
        { label: "100g", value: 0.1 },
        { label: "200g", value: 0.2 },
        { label: "300g", value: 0.3 },
        { label: "500g", value: 0.5 },
      ]
    : [
        { label: "250g", value: 0.25 },
        { label: "500g", value: 0.5 },
        { label: "750g", value: 0.75 },
        { label: "1kg", value: 1 },
      ];
  const displayQty = isKg ? `${quantity >= 1 ? quantity + " kg" : quantity * 1000 + "g"}` : `${quantity}`;

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Produit introuvable</p>
        <Button onClick={() => navigate(-1)}>Retour</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-md px-4 py-3 flex items-center gap-3 border-b border-border/50">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate("/");
            }
          }}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold truncate">{product.name}</h1>
      </div>

      {/* Image Zoom Overlay */}
      {imageZoomed && product.image_url && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center cursor-zoom-out animate-in fade-in duration-200"
          onClick={() => setImageZoomed(false)}
        >
          <img
            src={product.image_url}
            alt={product.name}
            className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg animate-in zoom-in-90 duration-300"
          />
        </div>
      )}

      {/* Product Image */}
      <div
        className="w-full aspect-square bg-accent/20 relative overflow-hidden cursor-zoom-in"
        onClick={() => product.image_url && setImageZoomed(true)}
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-32 h-32 rounded-full bg-primary/20 animate-pulse" />
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="px-4 py-5 space-y-4">
        {/* Name, rating summary, price */}
        <div>
          <h2 className="text-2xl font-bold text-foreground">{product.name}</h2>
          {reviews.length > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <StarRating rating={Math.round(avgRating)} size="h-4 w-4" />
              <span className="text-sm text-muted-foreground">
                {avgRating.toFixed(1)} ({reviews.length} avis)
              </span>
            </div>
          )}
          <p className="text-2xl font-bold text-primary mt-2">
            {formatPrice(product.price)}
            <span className="text-base font-normal text-muted-foreground">
              /{isKg ? "kg" : "pièce"}
            </span>
          </p>
        </div>

        {product.description && (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {product.description}
          </p>
        )}

        <Separator className="bg-border/50" />

        {/* Quantity Selector */}
        <div className="space-y-3">
          <span className="font-semibold text-foreground">Quantité</span>
          {isKg ? (
            <div className="grid grid-cols-4 gap-2">
              {WEIGHT_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant={quantity === opt.value ? "default" : "secondary"}
                  className="py-5 text-base font-bold rounded-xl"
                  onClick={() => setQuantity(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="secondary"
                size="icon"
                className="w-10 h-10 rounded-full"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="text-xl font-bold min-w-[70px] text-center">
                {displayQty}
              </span>
              <Button
                variant="secondary"
                size="icon"
                className="w-10 h-10 rounded-full"
                onClick={() => setQuantity((q) => q + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Add to Cart Button */}
        {product.is_active === false ? (
          <div className="w-full py-4 text-center bg-destructive/10 border border-destructive/30 rounded-xl">
            <p className="text-destructive font-bold">Victime de son succès 🔥</p>
            <p className="text-xs text-muted-foreground mt-1">Ce produit est temporairement indisponible</p>
          </div>
        ) : (
          <Button
            className="w-full py-6 text-base font-bold gap-2 rounded-xl"
            onClick={handleAddToCart}
          >
            <ShoppingCart className="h-5 w-5" />
            Ajouter — {formatPrice(product.price * quantity)}
          </Button>
        )}

        <Separator className="bg-border/50" />

        {/* Information Produit & Conseil de Cuisson */}
        <Accordion type="multiple" defaultValue={["info", "cooking", "conservation"]} className="w-full">
          <AccordionItem value="info" className="border-border/50">
            <AccordionTrigger className="text-foreground font-semibold hover:no-underline">
              🥩 Information produit
            </AccordionTrigger>
            <AccordionContent>
              <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">
                {product.product_info || "Aucune information disponible pour le moment."}
              </p>
            </AccordionContent>
          </AccordionItem>

          {product.cooking_tips && (
            <AccordionItem value="cooking" className="border-border/50">
              <AccordionTrigger className="text-foreground font-semibold hover:no-underline">
                🔥 Conseil de cuisson
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">
                  {product.cooking_tips}
                </p>
              </AccordionContent>
            </AccordionItem>
          )}

          {(product as any).conservation_tips && (
            <AccordionItem value="conservation" className="border-border/50">
              <AccordionTrigger className="text-foreground font-semibold hover:no-underline">
                ❄️ Conseil de conservation
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">
                  {(product as any).conservation_tips}
                </p>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>

        <Separator className="bg-border/50" />

        {/* Reviews Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-foreground">
            Avis clients{" "}
            {reviews.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({reviews.length})
              </span>
            )}
          </h3>

          {/* Submit Review */}
          {currentUserId && (
            <Card className="p-4 border-border/50 bg-card space-y-3">
              <p className="text-sm font-semibold text-foreground">
                Donnez votre avis
              </p>
              <StarRating
                rating={userRating}
                interactive
                size="h-7 w-7"
                onRate={setUserRating}
              />
              <Textarea
                placeholder="Votre commentaire (optionnel)..."
                value={userComment}
                onChange={(e) => setUserComment(e.target.value)}
                className="bg-accent/30 border-border/50 text-sm"
                rows={3}
              />
              <Button
                size="sm"
                className="gap-2"
                onClick={submitReview}
                disabled={submitting || userRating === 0}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Publier
              </Button>
            </Card>
          )}

          {/* Reviews List */}
          {reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun avis pour le moment. Soyez le premier !
            </p>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => (
                <Card
                  key={review.id}
                  className="p-4 border-border/50 bg-card space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">
                      Client
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {review.created_at ? new Date(review.created_at).toLocaleDateString("fr-FR") : ""}
                    </span>
                  </div>
                  <StarRating rating={review.rating} size="h-4 w-4" />
                  {review.comment && (
                    <p className="text-sm text-muted-foreground">
                      {review.comment}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default ProductPage;
