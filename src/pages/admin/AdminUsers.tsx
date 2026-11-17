import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  created_at: string | null;
}

const AdminUsers = () => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [change, setChange] = useState<{ user: Profile; role: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    const [profiles, roles] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (profiles.error || roles.error) toast({ title: "Lecture des comptes impossible", variant: "destructive" });
    else setUsers((profiles.data ?? []).map(profile => ({ ...profile, role: roles.data?.find(row => row.user_id === profile.id)?.role ?? "user" })));
    setLoading(false);
  };
  const saveRole = async () => {
    if (!change) return;
    setSaving(true);
    const { error } = await supabase.rpc("set_profile_role_as_admin", { _target_user_id: change.user.id, _new_role: change.role });
    setSaving(false); setChange(null);
    if (error) toast({ title: "Changement refusé", description: error.message, variant: "destructive" });
    else { toast({ title: "Rôle mis à jour" }); fetchUsers(); }
  };

  const roleBadge = (role: string) => {
    const colors: Record<string, "default" | "secondary" | "destructive"> = { admin: "destructive", driver: "default", user: "secondary" };
    const labels: Record<string, string> = { admin: "Admin", driver: "Livreur", user: "Client" };
    return <Badge variant={colors[role] || "secondary"}>{labels[role] || role}</Badge>;
  };

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Utilisateurs</h1>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Inscrit le</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>{u.phone || "—"}</TableCell>
                  <TableCell>
                    <Select value={u.role} disabled={saving} onValueChange={role => setChange({ user: u, role })}>
                      <SelectTrigger aria-label={`Rôle de ${u.name}`} className="w-40"><SelectValue>{roleBadge(u.role)}</SelectValue></SelectTrigger>
                      <SelectContent><SelectItem value="user">Client</SelectItem><SelectItem value="driver">Livreur</SelectItem><SelectItem value="admin">Administrateur</SelectItem></SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.created_at ? new Date(u.created_at).toLocaleDateString("fr-FR") : "—"}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucun utilisateur</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <AlertDialog open={!!change} onOpenChange={open => { if (!open && !saving) setChange(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Confirmer le changement de rôle</AlertDialogTitle><AlertDialogDescription>{change?.user.email} : {change?.role === "admin" ? "cet utilisateur pourra gérer toute la boutique." : change?.role === "driver" ? "cet utilisateur accédera à l’espace livreur." : "cet utilisateur accédera uniquement à l’espace client."}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={saving}>Annuler</AlertDialogCancel><AlertDialogAction disabled={saving} onClick={saveRole}>Confirmer</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsers;
