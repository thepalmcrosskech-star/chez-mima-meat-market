import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { CustomerHeader } from "@/components/OriginPromise";
import BottomNav from "@/components/BottomNav";
import AddressPicker from "@/components/AddressPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Address = Tables<"user_addresses">;
type Location = Pick<Address, "full_address" | "latitude" | "longitude">;

export default function AddressesPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [label, setLabel] = useState("Maison");
  const [apartment, setApartment] = useState("");
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Address | null>(null);

  const makeDefault = async (address: Address) => {
    if (!userId || busyId) return;
    setBusyId(address.id);
    const { error: failure } = await supabase.rpc("set_my_default_address", { _address_id: address.id });
    setBusyId(null);
    if (failure) { toast({ title: "Modification impossible", description: "Veuillez réessayer.", variant: "destructive" }); return; }
    toast({ title: "Adresse principale mise à jour" });
    await load(userId);
  };
  const confirmDelete = async () => {
    const address = toDelete;
    setToDelete(null);
    if (!userId || !address || busyId) return;
    setBusyId(address.id);
    const { error: failure } = await supabase.rpc("delete_my_address", { _address_id: address.id });
    setBusyId(null);
    if (failure) { toast({ title: "Suppression impossible", description: "Veuillez réessayer.", variant: "destructive" }); return; }
    toast({ title: "Adresse supprimée" });
    await load(userId);
  };

  const load = async (id: string) => {
    const { data, error: failure } = await supabase.from("user_addresses").select("*").eq("user_id", id).order("is_default", { ascending: false }).order("created_at", { ascending: false });
    if (failure) setError("Vos adresses n’ont pas pu être chargées. Réessayez.");
    else { setAddresses(data ?? []); setError(""); }
    setLoading(false);
  };
  useEffect(() => {
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { navigate("/login?next=%2Faddresses", { replace: true }); return; }
      setUserId(user.id);
      void load(user.id);
    }).catch(() => { setError("Vos adresses n’ont pas pu être chargées. Réessayez."); setLoading(false); });
  }, [navigate]);

  const openForm = (address: Address | null) => {
    setEditing(address);
    setLocation(address ? { full_address: address.full_address, latitude: address.latitude, longitude: address.longitude } : null);
    setLabel(address?.label || "Maison");
    setApartment(address?.apartment || "");
    setInstructions(address?.instructions || "");
    setFormOpen(true);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userId || !location || saving) return;
    setSaving(true);
    try {
      const values = { ...location, label: label.trim() || "Adresse", apartment: apartment.trim() || null, instructions: instructions.trim() || null, delivery_zone_id: null };
      const result = editing
        ? await supabase.from("user_addresses").update(values).eq("id", editing.id).eq("user_id", userId).select("id").single()
        : await supabase.from("user_addresses").insert({ ...values, user_id: userId, is_default: addresses.length === 0 }).select("id").single();
      if (result.error) throw result.error;
      setFormOpen(false);
      await load(userId);
      toast({ title: "Adresse enregistrée" });
    } catch {
      toast({ title: "Adresse non enregistrée", description: "Veuillez réessayer.", variant: "destructive" });
    } finally { setSaving(false); }
  };

  return <div className="client-page min-h-screen bg-background">
    <CustomerHeader><div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-5">
      <Button variant="ghost" size="icon" className="shrink-0 text-sidebar-foreground" aria-label="Retour au profil" onClick={() => navigate("/profile")}><ArrowLeft className="h-5 w-5" /></Button>
      <h1 className="font-display text-3xl text-sidebar-foreground">Mes adresses</h1>
    </div></CustomerHeader>
    <main className="mx-auto max-w-xl space-y-5 px-4 py-6">
      {loading ? <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" aria-label="Chargement" /> : error ? <div role="alert" className="space-y-3"><p className="text-destructive">{error}</p><Button variant="outline" onClick={() => { if (userId) void load(userId); }}>Réessayer</Button></div> : <>
        {!formOpen && <Button className="w-full gap-2" onClick={() => openForm(null)}><Plus className="h-5 w-5" />Ajouter une adresse</Button>}
        {formOpen ? <form onSubmit={save} className="space-y-4">
          <h2 className="font-display text-2xl">{editing ? "Modifier l’adresse" : "Nouvelle adresse"}</h2>
          <div><Label htmlFor="address-label">Nom de l’adresse</Label><Input id="address-label" value={label} onChange={event => setLabel(event.target.value)} placeholder="Maison, Bureau…" /></div>
          <AddressPicker key={editing?.id ?? "new"} defaultValue={editing ? { full_address: editing.full_address, latitude: editing.latitude, longitude: editing.longitude } : undefined} onSelect={setLocation} />
          <div><Label htmlFor="address-apartment">Étage / Numéro d’appartement (optionnel)</Label><Input id="address-apartment" value={apartment} onChange={event => setApartment(event.target.value)} placeholder="Appt 3, 2ème étage" /></div>
          <div><Label htmlFor="address-instructions">Repère / Consignes pour le coursier (optionnel)</Label><Textarea id="address-instructions" value={instructions} onChange={event => setInstructions(event.target.value)} rows={2} /></div>
          <div className="flex gap-3"><Button type="submit" disabled={saving || !location} className="flex-1">{saving ? "Enregistrement…" : "Enregistrer"}</Button><Button type="button" variant="outline" disabled={saving} onClick={() => setFormOpen(false)}>Annuler</Button></div>
        </form> : addresses.length === 0 ? <div className="py-10 text-center text-muted-foreground"><MapPin className="mx-auto mb-3 h-8 w-8" /><p>Aucune adresse enregistrée</p></div> : <ul className="space-y-3">{addresses.map(address => <li key={address.id} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
          <MapPin className="mt-1 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1 break-words"><h2 className="font-semibold">{address.label || "Adresse"}</h2>{address.is_default && <p className="text-xs text-primary">Adresse principale</p>}<p className="mt-1 text-sm">{address.full_address}</p>{address.apartment && <p className="text-sm text-muted-foreground">{address.apartment}</p>}{address.instructions && <p className="mt-1 text-sm text-muted-foreground">{address.instructions}</p>}</div>
          <div className="flex shrink-0 flex-col gap-1">
            <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`Modifier ${address.label || "l’adresse"}`} onClick={() => openForm(address)}><Pencil className="h-4 w-4" /></Button>
            {!address.is_default && <Button variant="ghost" size="icon" className="h-11 w-11" disabled={busyId === address.id} aria-label={`Choisir ${address.label || "cette adresse"} comme adresse principale`} onClick={() => void makeDefault(address)}><Star className="h-4 w-4" /></Button>}
            <Button variant="ghost" size="icon" className="h-11 w-11 text-destructive" disabled={busyId === address.id} aria-label={`Supprimer ${address.label || "l’adresse"}`} onClick={() => setToDelete(address)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </li>)}</ul>}
      </>}
    </main>
    <AlertDialog open={!!toDelete} onOpenChange={open => { if (!open) setToDelete(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer cette adresse ?</AlertDialogTitle>
          <AlertDialogDescription>« {toDelete?.label || "Adresse"} » sera retirée de votre carnet. Vos commandes passées gardent l’adresse avec laquelle elles ont été livrées.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={() => void confirmDelete()}>Supprimer</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <BottomNav />
  </div>;
}