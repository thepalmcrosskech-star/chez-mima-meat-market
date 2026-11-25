import { CustomerHeader } from "@/components/OriginPromise";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, LogOut, User, Mail, Phone, MapPin, ChevronRight } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { brandLogo as logo } from "@/lib/brand";
import LoyaltyCard from "@/components/LoyaltyCard";

interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
}

const ProfilePage = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }

    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (data) {
      setProfile(data);
      setName(data.name);
      setPhone(data.phone || "");
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ name, phone: phone || null }).eq("id", profile.id);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else { toast({ title: "Profil mis à jour" }); setEditing(false); fetchProfile(); }
    setSaving(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="client-page min-h-screen bg-background">
      {/* Header */}
      <CustomerHeader>
      <div className="brand-header border-b-4 border-primary px-4 pt-8 pb-12 text-center">
        <div className="w-36 h-24 mx-auto mb-3 flex items-center justify-center">
          <img src={logo} alt="Chez Mima" className="w-full h-full object-contain" />
        </div>
        <h2 className="text-xl font-bold text-sidebar-foreground">{profile?.name}</h2>
        <p className="text-sidebar-foreground/80 text-sm break-all">{profile?.email}</p>
      </div>
      </CustomerHeader>

      <div className="px-4 pt-4 space-y-4">
        <LoyaltyCard />
        {/* Profile Info */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            {editing ? (
              <>
                <div>
                  <Label>Nom</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label>Téléphone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+212 6XX XXX XXX" />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={saving} className="flex-1">
                    {saving ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                  <Button variant="secondary" onClick={() => setEditing(false)} className="flex-1">Annuler</Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 py-2">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1"><p className="text-xs text-muted-foreground">Nom</p><p className="font-medium">{profile?.name}</p></div>
                </div>
                <div className="flex items-center gap-3 py-2 border-t border-border">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1 min-w-0"><p className="text-xs text-muted-foreground">Email</p><p className="font-medium break-all">{profile?.email}</p></div>
                </div>
                <div className="flex items-center gap-3 py-2 border-t border-border">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1"><p className="text-xs text-muted-foreground">Téléphone</p><p className="font-medium">{profile?.phone || "Non renseigné"}</p></div>
                </div>
                <Button variant="secondary" onClick={() => setEditing(true)} className="w-full">Modifier le profil</Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card>
          <CardContent className="pt-4 space-y-1">
            <button onClick={() => navigate("/orders")} className="w-full flex items-center justify-between py-3 hover:bg-accent/50 rounded-lg px-2 transition-colors">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium text-sm">Mes adresses</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </CardContent>
        </Card>

        {/* Sign out */}
        <Button variant="destructive" onClick={handleSignOut} className="w-full gap-2">
          <LogOut className="h-4 w-4" />
          Se déconnecter
        </Button>
      </div>

      <BottomNav />
    </div>
  );
};

export default ProfilePage;
