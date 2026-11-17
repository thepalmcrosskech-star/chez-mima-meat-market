import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Star } from "lucide-react";

interface DriverRatingProps {
  orderId: string;
  driverId: string;
  onComplete: () => void;
}

const DriverRating = ({ orderId, driverId, onComplete }: DriverRatingProps) => {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({ title: "Sélectionnez une note", variant: "destructive" });
      return;
    }
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.rpc("submit_driver_rating", {
        _order_id: orderId,
        _driver_id: driverId,
        _rating: rating,
        _comment: comment.trim() || null,
      });
      if (error) throw error;

      toast({ title: "Merci pour votre note ! ⭐" });
      onComplete();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="text-6xl">🎉</div>
        <h2 className="text-2xl font-bold">Commande livrée !</h2>
        <p className="text-muted-foreground">Comment s'est passée la livraison ?</p>

        {/* Stars */}
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              onClick={() => setRating(star)}
              className="transition-transform hover:scale-110"
            >
              <Star
                className={`h-10 w-10 ${
                  star <= (hoveredRating || rating)
                    ? "fill-warning text-warning"
                    : "text-muted-foreground"
                }`}
              />
            </button>
          ))}
        </div>

        <Textarea
          placeholder="Un commentaire ? (optionnel)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="resize-none"
          rows={3}
        />

        <div className="space-y-2">
          <Button
            className="w-full bg-primary hover:bg-primary text-primary-foreground"
            onClick={handleSubmit}
            disabled={submitting || rating === 0}
          >
            {submitting ? "Envoi..." : "Envoyer la note"}
          </Button>
          <Button variant="ghost" className="w-full" onClick={onComplete}>
            Passer
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DriverRating;
