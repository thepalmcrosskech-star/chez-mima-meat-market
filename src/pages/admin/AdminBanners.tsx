import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, Image, GripVertical, ExternalLink, Search } from "lucide-react";

interface Banner {
  id: string;
  title: string;
  subtitle: string;
  image_url: string | null;
  link_url: string;
  button_text: string;
  sort_order: number;
  is_active: boolean;
}

const AdminBanners = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [productSuggestions, setProductSuggestions] = useState<{ id: string; name: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const linkInputRef = useRef<HTMLDivElement>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [buttonText, setButtonText] = useState("Découvrir");

  useEffect(() => { fetchBanners(); }, []);

  const fetchBanners = async () => {
    const { data } = await supabase
      .from("banners")
      .select("*")
      .order("sort_order", { ascending: true });
    if (data) setBanners(data as Banner[]);
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setTitle("");
    setSubtitle("");
    setImageUrl("");
    setLinkUrl("");
    setButtonText("Découvrir");
    setDialogOpen(true);
  };

  const openEdit = (b: Banner) => {
    setEditing(b);
    setTitle(b.title);
    setSubtitle(b.subtitle || "");
    setImageUrl(b.image_url || "");
    setLinkUrl(b.link_url || "");
    setButtonText(b.button_text || "Découvrir");
    setDialogOpen(true);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("banner-images").upload(path, file);
    if (error) {
      toast({ title: "Erreur upload", description: error.message, variant: "destructive" });
    } else {
      const { data: pub } = supabase.storage.from("banner-images").getPublicUrl(path);
      setImageUrl(pub.publicUrl);
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "Titre requis", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      title: title.trim(),
      subtitle: subtitle.trim(),
      image_url: imageUrl || null,
      link_url: linkUrl.trim(),
      button_text: buttonText.trim() || "Découvrir",
    };

    if (editing) {
      const { error } = await supabase.from("banners").update(payload).eq("id", editing.id);
      if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
      else toast({ title: "Bannière mise à jour" });
    } else {
      const maxOrder = banners.length > 0 ? Math.max(...banners.map((b) => b.sort_order)) + 1 : 0;
      const { error } = await supabase.from("banners").insert({ ...payload, sort_order: maxOrder });
      if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
      else toast({ title: "Bannière créée" });
    }
    setSaving(false);
    setDialogOpen(false);
    fetchBanners();
  };

  const toggleActive = async (b: Banner) => {
    await supabase.from("banners").update({ is_active: !b.is_active }).eq("id", b.id);
    fetchBanners();
  };

  const deleteBanner = async (b: Banner) => {
    if (!confirm(`Supprimer la bannière "${b.title}" ?`)) return;
    await supabase.from("banners").delete().eq("id", b.id);
    toast({ title: "Bannière supprimée" });
    fetchBanners();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bannières</h1>
          <p className="text-muted-foreground text-sm">Gérez les bannières affichées sur la page d'accueil</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Nouvelle bannière
        </Button>
      </div>

      {banners.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Image className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">Aucune bannière</p>
          <p className="text-sm">Créez votre première bannière pour la page d'accueil</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {banners.map((b) => (
            <Card key={b.id} className={`overflow-hidden ${!b.is_active ? "opacity-50" : ""}`}>
              <div className="flex items-stretch">
                {/* Preview image */}
                <div className="w-32 h-24 bg-muted shrink-0 relative overflow-hidden">
                  {b.image_url ? (
                    <img src={b.image_url} alt={b.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 p-3 min-w-0">
                  <p className="font-bold text-sm truncate">{b.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{b.subtitle}</p>
                  {b.link_url && (
                    <p className="text-xs text-primary flex items-center gap-1 mt-1 truncate">
                      <ExternalLink className="h-3 w-3 shrink-0" /> {b.link_url}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 px-3">
                  <Switch checked={b.is_active} onCheckedChange={() => toggleActive(b)} />
                  <Button variant="ghost" size="icon" onClick={() => openEdit(b)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteBanner(b)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier la bannière" : "Nouvelle bannière"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Image upload */}
            <div>
              <Label>Image d'arrière-plan</Label>
              <input type="file" ref={fileRef} accept="image/*" className="hidden" onChange={handleUpload} />
              {imageUrl ? (
                <div className="mt-2 relative rounded-lg overflow-hidden aspect-[16/7]">
                  <img src={imageUrl} alt="preview" className="w-full h-full object-cover" />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute bottom-2 right-2"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Changer"}
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="mt-2 w-full aspect-[16/7] border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center text-muted-foreground hover:border-primary/50 transition-colors"
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="h-8 w-8 animate-spin" />
                  ) : (
                    <>
                      <Image className="h-8 w-8 mb-2" />
                      <span className="text-sm">Cliquer pour ajouter une image</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <div>
              <Label>Titre *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Offre du jour" className="mt-1" />
            </div>

            <div>
              <Label>Sous-titre</Label>
              <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Ex: Sélection Premium d'exception" className="mt-1" />
            </div>

            <div>
              <Label>Texte du bouton</Label>
              <Input value={buttonText} onChange={(e) => setButtonText(e.target.value)} placeholder="Découvrir" className="mt-1" />
            </div>

            <div>
              <Label>Lien (URL ou /product/id)</Label>
              <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="/product/xxx ou https://..." className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">
                Utilisez /product/ID pour un produit, ou une URL complète
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBanners;
