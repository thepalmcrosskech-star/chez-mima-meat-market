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
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  user_id: string;
  profiles: { name: string } | null;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2 }).format(price) +
  " MAD";

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
  const [quantity, setQuantity] = useState(1);

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
      .from("product_reviews")
      .select("id, rating, comment, created_at, user_id, profiles(name)")
      .eq("product_id", id!)
      .order("created_at", { ascending: false });
    if (data) setReviews(data as unknown as Review[]);
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
  const step = isKg ? 0.25 : 1;
  const min = isKg ? 0.25 : 1;
  const displayQty = isKg ? `${quantity} kg` : `${quantity}`;

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
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold truncate">{product.name}</h1>
      </div>

      {/* Product Image */}
      <div className="w-full aspect-square bg-accent/20 relative overflow-hidden">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
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
        <div className="flex items-center justify-between">
          <span className="font-semibold text-foreground">Quantité</span>
          <div className="flex items-center gap-4">
            <Button
              variant="secondary"
              size="icon"
              className="w-10 h-10 rounded-full"
              onClick={() =>
                setQuantity((q) => Math.max(min, +(q - step).toFixed(2)))
              }
              disabled={quantity <= min}
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
              onClick={() => setQuantity((q) => +(q + step).toFixed(2))}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Add to Cart Button */}
        <Button
          className="w-full py-6 text-base font-bold gap-2 rounded-xl"
          onClick={handleAddToCart}
        >
          <ShoppingCart className="h-5 w-5" />
          Ajouter — {formatPrice(product.price * quantity)}
        </Button>

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
                      {review.profiles?.name || "Anonyme"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(review.created_at).toLocaleDateString("fr-FR")}
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
