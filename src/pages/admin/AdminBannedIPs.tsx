import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldOff, RefreshCw, Loader2 } from "lucide-react";

interface BannedIP {
  id: string;
  ip_address: string;
  reason: string | null;
  banned_by: string | null;
  created_at: string | null;
  banned_by_profile?: { name: string } | null;
  linked_users?: { user_id: string; profile?: { name: string; email: string } | null }[];
}

const AdminBannedIPs = () => {
  const [bannedIPs, setBannedIPs] = useState<BannedIP[]>([]);
  const [loading, setLoading] = useState(true);
  const [unbanTarget, setUnbanTarget] = useState<BannedIP | null>(null);
  const [unbanning, setUnbanning] = useState(false);

  const fetchBannedIPs = async () => {
    setLoading(true);
    try {
      const { data: ips, error } = await supabase
        .from("banned_ips")
        .select("*, banned_by_profile:profiles!banned_ips_banned_by_fkey(name)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // For each IP, find linked users
      const enriched = await Promise.all(
        (ips || []).map(async (ip) => {
          const { data: userIps } = await supabase
            .from("user_ips")
            .select("user_id, profile:profiles!user_ips_user_id_fkey(name, email)")
            .eq("ip_address", ip.ip_address);
          return { ...ip, linked_users: userIps || [] } as BannedIP;
        })
      );

      setBannedIPs(enriched);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBannedIPs(); }, []);

  const handleUnban = async () => {
    if (!unbanTarget) return;
    setUnbanning(true);
    try {
      const { error } = await supabase
        .from("banned_ips")
        .delete()
        .eq("id", unbanTarget.id);

      if (error) throw error;
      toast({ title: "IP débannée", description: `${unbanTarget.ip_address} a été retirée de la liste noire.` });
      setBannedIPs((prev) => prev.filter((ip) => ip.id !== unbanTarget.id));
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setUnbanning(false);
      setUnbanTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-destructive" />
            IP Bannies
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {bannedIPs.length} adresse{bannedIPs.length !== 1 ? "s" : ""} IP bloquée{bannedIPs.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchBannedIPs} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : bannedIPs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShieldOff className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>Aucune IP bannie pour le moment.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Adresse IP</TableHead>
                <TableHead>Raison</TableHead>
                <TableHead>Utilisateurs liés</TableHead>
                <TableHead>Banni par</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bannedIPs.map((ip) => (
                <TableRow key={ip.id}>
                  <TableCell className="font-mono text-sm">{ip.ip_address}</TableCell>
                  <TableCell>
                    <Badge variant="destructive" className="text-xs">
                      {ip.reason || "Non spécifiée"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {ip.linked_users && ip.linked_users.length > 0 ? (
                      <div className="space-y-0.5">
                        {ip.linked_users.map((u) => (
                          <div key={u.user_id} className="text-xs text-muted-foreground">
                            {(u.profile as any)?.name || "—"} ({(u.profile as any)?.email || "—"})
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Aucun</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {(ip.banned_by_profile as any)?.name || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {ip.created_at ? new Date(ip.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setUnbanTarget(ip)}>
                      <ShieldOff className="h-4 w-4 mr-1" />
                      Débannir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={!!unbanTarget} onOpenChange={(o) => !o && setUnbanTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Débannir cette IP ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'adresse <span className="font-mono font-bold">{unbanTarget?.ip_address}</span> sera retirée de la liste noire.
              Les utilisateurs associés pourront à nouveau accéder au site.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unbanning}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnban} disabled={unbanning}>
              {unbanning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminBannedIPs;
