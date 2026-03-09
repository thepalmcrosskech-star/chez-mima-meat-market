import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";

interface Category {
  id: string;
  name: string;
  emoji: string | null;
  image_url: string | null;
  sort_order: number | null;
}

const AdminCategories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🥩");
  const [imageUrl, setImageUrl] = useState("");
  const [sortOrder, setSortOrder] = useState("0");

  useEffect(() => { fetchCategories(); }, []);

  const fetchCategories = async () => {
    const { data } = await supabase.from("categories").select("*").order("sort_order");
    if (data) setCategories(data);
    setLoading(false);
  };

  const resetForm = () => { setName(""); setEmoji("🥩"); setImageUrl(""); setSortOrder("0"); setEditing(null); };

  const openEdit = (c: Category) => {
    setEditing(c); setName(c.name); setEmoji(c.emoji || "🥩");
    setImageUrl(c.image_url || ""); setSortOrder(String(c.sort_order || 0));
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name) { toast({ title: "Erreur", description: "Nom requis", variant: "destructive" }); return; }
    const payload = { name, emoji: emoji || null, image_url: imageUrl || null, sort_order: parseInt(sortOrder) || 0 };
    try {
      if (editing) {
        const { error } = await supabase.from("categories").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Catégorie mise à jour" });
      } else {
        const { error } = await supabase.from("categories").insert(payload);
        if (error) throw error;
        toast({ title: "Catégorie ajoutée" });
      }
      setIsDialogOpen(false); resetForm(); fetchCategories();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette catégorie ?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else { toast({ title: "Catégorie supprimée" }); fetchCategories(); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Catégories</h1>
        <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Ajouter</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Modifier" : "Ajouter"} une catégorie</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><Label>Nom</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label>Emoji</Label><Input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="🥩" /></div>
              <div><Label>URL image</Label><Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} /></div>
              <div><Label>Ordre d'affichage</Label><Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} /></div>
              <Button onClick={handleSave} className="w-full">{editing ? "Enregistrer" : "Ajouter"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Emoji</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell><GripVertical className="h-4 w-4 text-muted-foreground" /></TableCell>
                  <TableCell className="text-2xl">{c.emoji}</TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {categories.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Aucune catégorie</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminCategories;
