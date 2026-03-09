import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface Zone {
  id: string;
  name: string;
  delivery_fee: number;
  minimum_order: number;
  free_delivery_threshold: number | null;
  color: string | null;
  is_active: boolean | null;
  sort_order: number | null;
}

const AdminDeliveryZones = () => {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Zone | null>(null);
  const [name, setName] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [minimumOrder, setMinimumOrder] = useState("");
  const [freeThreshold, setFreeThreshold] = useState("");
  const [color, setColor] = useState("#D3111A");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => { fetchZones(); }, []);

  const fetchZones = async () => {
    const { data } = await supabase.from("delivery_zones").select("*").order("sort_order");
    if (data) setZones(data as Zone[]);
    setLoading(false);
  };

  const resetForm = () => {
    setName(""); setDeliveryFee(""); setMinimumOrder(""); setFreeThreshold("");
    setColor("#D3111A"); setIsActive(true); setEditing(null);
  };

  const openEdit = (z: Zone) => {
    setEditing(z); setName(z.name); setDeliveryFee(String(z.delivery_fee));
    setMinimumOrder(String(z.minimum_order)); setFreeThreshold(z.free_delivery_threshold ? String(z.free_delivery_threshold) : "");
    setColor(z.color || "#D3111A"); setIsActive(z.is_active ?? true); setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name || !deliveryFee || !minimumOrder) { toast({ title: "Erreur", description: "Champs requis manquants", variant: "destructive" }); return; }
    const payload = {
      name, delivery_fee: parseFloat(deliveryFee), minimum_order: parseFloat(minimumOrder),
      free_delivery_threshold: freeThreshold ? parseFloat(freeThreshold) : null,
      color, is_active: isActive,
    };
    try {
      if (editing) {
        const { error } = await supabase.from("delivery_zones").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Zone mise à jour" });
      } else {
        const { error } = await supabase.from("delivery_zones").insert({ ...payload, polygon: { type: "Polygon", coordinates: [] } });
        if (error) throw error;
        toast({ title: "Zone ajoutée" });
      }
      setIsDialogOpen(false); resetForm(); fetchZones();
    } catch (e: any) { toast({ title: "Erreur", description: e.message, variant: "destructive" }); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette zone ?")) return;
    const { error } = await supabase.from("delivery_zones").delete().eq("id", id);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else { toast({ title: "Zone supprimée" }); fetchZones(); }
  };

  const toggleActive = async (z: Zone) => {
    await supabase.from("delivery_zones").update({ is_active: !z.is_active }).eq("id", z.id);
    fetchZones();
  };

  const formatPrice = (n: number) => new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2 }).format(n) + " MAD";

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Zones de livraison</h1>
        <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Ajouter</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Modifier" : "Ajouter"} une zone</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><Label>Nom</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Frais de livraison</Label><Input type="number" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} /></div>
                <div><Label>Commande minimum</Label><Input type="number" value={minimumOrder} onChange={(e) => setMinimumOrder(e.target.value)} /></div>
              </div>
              <div><Label>Livraison gratuite dès</Label><Input type="number" value={freeThreshold} onChange={(e) => setFreeThreshold(e.target.value)} placeholder="Optionnel" /></div>
              <div className="flex items-center gap-3">
                <Label>Couleur</Label><input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer" />
              </div>
              <div className="flex items-center gap-2"><Switch checked={isActive} onCheckedChange={setIsActive} /><Label>Active</Label></div>
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
                <TableHead>Zone</TableHead>
                <TableHead>Frais</TableHead>
                <TableHead>Min. commande</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zones.map((z) => (
                <TableRow key={z.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: z.color || "#D3111A" }} />
                      <span className="font-medium">{z.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{formatPrice(z.delivery_fee)}</TableCell>
                  <TableCell>{formatPrice(z.minimum_order)}</TableCell>
                  <TableCell>
                    <Badge variant={z.is_active ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleActive(z)}>
                      {z.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(z)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(z.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {zones.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucune zone</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDeliveryZones;
