import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, Upload, X, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  unit_type: string;
  image_url: string | null;
  category_id: string | null;
  is_active: boolean | null;
  stock_quantity: number;
  product_info: string | null;
  cooking_tips: string | null;
  conservation_tips: string | null;
}

interface Category {
  id: string;
  name: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const AdminProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [unitType, setUnitType] = useState("weight");
  const [categoryId, setCategoryId] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [stockQuantity, setStockQuantity] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [productInfo, setProductInfo] = useState("");
  const [cookingTips, setCookingTips] = useState("");
  const [conservationTips, setConservationTips] = useState("");
  const [showCookingTips, setShowCookingTips] = useState(false);
  const [showConservationTips, setShowConservationTips] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [productsRes, categoriesRes] = await Promise.all([
      supabase.from("products").select("*").order("name"),
      supabase.from("categories").select("id, name").order("sort_order"),
    ]);
    if (productsRes.data) setProducts(productsRes.data);
    if (categoriesRes.data) setCategories(categoriesRes.data);
    setLoading(false);
  };

  const resetForm = () => {
    setName(""); setDescription(""); setPrice(""); setUnitType("weight");
    setCategoryId(""); setImageUrl(""); setImagePreview(""); setStockQuantity("0"); setIsActive(true);
    setProductInfo(""); setCookingTips(""); setConservationTips("");
    setShowCookingTips(false); setShowConservationTips(false);
    setEditingProduct(null);
  };

  const openEdit = (p: Product) => {
    setEditingProduct(p);
    setName(p.name); setDescription(p.description || ""); setPrice(String(p.price));
    setUnitType(p.unit_type); setCategoryId(p.category_id || ""); setImageUrl(p.image_url || "");
    setImagePreview(p.image_url || ""); setStockQuantity(String(p.stock_quantity)); setIsActive(p.is_active ?? true);
    setProductInfo(p.product_info || ""); setCookingTips(p.cooking_tips || "");
    setConservationTips((p as any).conservation_tips || "");
    setShowCookingTips(!!p.cooking_tips);
    setShowConservationTips(!!(p as any).conservation_tips);
    setIsDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

      const { error } = await supabase.storage.from("product-images").upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/product-images/${fileName}`;
      setImageUrl(publicUrl);
      toast({ title: "Image téléversée" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
      setImagePreview("");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = () => {
    setImageUrl(""); setImagePreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async () => {
    if (!name || !price) { toast({ title: "Erreur", description: "Nom et prix requis", variant: "destructive" }); return; }

    const parsedPrice = parseFloat(String(price).replace(",", "."));
    const parsedStock = parseInt(String(stockQuantity)) || 0;
    if (isNaN(parsedPrice) || parsedPrice <= 0) { toast({ title: "Erreur", description: "Prix invalide", variant: "destructive" }); return; }

    const payload = {
      name, description: description || null, price: parsedPrice, unit_type: unitType,
      category_id: categoryId || null, image_url: imageUrl || null,
      stock_quantity: parsedStock, is_active: isActive,
      product_info: productInfo || null,
      cooking_tips: showCookingTips ? (cookingTips || null) : null,
      conservation_tips: showConservationTips ? (conservationTips || null) : null,
    };

    try {
      if (editingProduct) {
        const { error } = await supabase.from("products").update(payload).eq("id", editingProduct.id);
        if (error) throw error;
        toast({ title: "Produit mis à jour" });
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
        toast({ title: "Produit ajouté" });
      }
      setIsDialogOpen(false); resetForm(); fetchData();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce produit ?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else { toast({ title: "Produit supprimé" }); fetchData(); }
  };

  const toggleActive = async (p: Product) => {
    await supabase.from("products").update({ is_active: !p.is_active }).eq("id", p.id);
    fetchData();
  };

  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Produits</h1>
        <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Ajouter</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{editingProduct ? "Modifier le produit" : "Ajouter un produit"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div><Label>Nom</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Prix</Label><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
                <div>
                  <Label>Unité</Label>
                  <Select value={unitType} onValueChange={setUnitType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weight">Kg</SelectItem>
                      <SelectItem value="piece">Pièce</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Catégorie</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Image Upload */}
              <div>
                <Label>Image du produit</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                {imagePreview ? (
                  <div className="relative mt-2 rounded-lg overflow-hidden border border-border">
                    <img src={imagePreview} alt="Aperçu" className="w-full h-40 object-cover" />
                    <div className="absolute top-2 right-2 flex gap-1">
                      <Button variant="secondary" size="icon" className="w-7 h-7 rounded-full bg-background/80 backdrop-blur-sm" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-4 w-4" />
                      </Button>
                      <Button variant="secondary" size="icon" className="w-7 h-7 rounded-full bg-background/80 backdrop-blur-sm" onClick={removeImage}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {uploading && (
                      <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 w-full h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    <Upload className="h-6 w-6" />
                    <span className="text-sm font-medium">Cliquer pour téléverser ou prendre une photo</span>
                    <span className="text-xs">JPG, PNG, WebP</span>
                  </button>
                )}
              </div>

              <div><Label>🥩 Information produit</Label><Textarea placeholder="Origine, qualité..." value={productInfo} onChange={(e) => setProductInfo(e.target.value)} /></div>

              {/* Toggleable tip sections */}
              <div className="space-y-3 rounded-lg border border-border/50 p-4">
                <p className="text-sm font-semibold text-foreground">Rubriques optionnelles</p>
                <div className="flex items-center gap-3">
                  <Switch checked={showCookingTips} onCheckedChange={setShowCookingTips} />
                  <Label>🔥 Conseil de cuisson</Label>
                </div>
                {showCookingTips && (
                  <Textarea placeholder="Temps, température, astuces..." value={cookingTips} onChange={(e) => setCookingTips(e.target.value)} />
                )}
                <div className="flex items-center gap-3">
                  <Switch checked={showConservationTips} onCheckedChange={setShowConservationTips} />
                  <Label>❄️ Conseil de conservation</Label>
                </div>
                {showConservationTips && (
                  <Textarea placeholder="Durée, température de conservation..." value={conservationTips} onChange={(e) => setConservationTips(e.target.value)} />
                )}
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <Label>{isActive ? "Disponible" : "Indisponible"}</Label>
              </div>
              <Button onClick={handleSave} disabled={uploading} className="w-full">{editingProduct ? "Enregistrer" : "Ajouter"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Rechercher un produit..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead>Prix</TableHead>
                <TableHead>Disponibilité</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center text-muted-foreground text-xs">IMG</div>
                      )}
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.unit_type === 'weight' ? 'Kg' : 'Pièce'}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold text-primary">{formatPrice(p.price)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch checked={p.is_active ?? true} onCheckedChange={() => toggleActive(p)} />
                      <span className={`text-xs font-medium ${p.is_active ? "text-green-500" : "text-muted-foreground"}`}>
                        {p.is_active ? "Disponible" : "Indisponible"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Aucun produit</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminProducts;
