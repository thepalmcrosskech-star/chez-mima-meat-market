import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

interface AppSetting {
  id: string;
  key: string;
  value: any;
}

const AdminSettings = () => {
  const [settings, setSettings] = useState<Record<string, string>>({
    store_name: "Chez Mima",
    store_phone: "",
    store_email: "",
    store_address: "",
    currency: "MAD",
    opening_hours: "",
    whatsapp_number: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    const { data } = await supabase.from("app_settings").select("*");
    if (data) {
      const map: Record<string, string> = { ...settings };
      data.forEach((s: AppSetting) => { map[s.key] = typeof s.value === "string" ? s.value : JSON.stringify(s.value); });
      setSettings(map);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(settings)) {
        await supabase.from("app_settings").upsert({ key, value: value as any }, { onConflict: "key" });
      }
      toast({ title: "Paramètres enregistrés" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: string, value: string) => setSettings((prev) => ({ ...prev, [key]: value }));

  const fields = [
    { key: "store_name", label: "Nom du magasin" },
    { key: "store_phone", label: "Téléphone" },
    { key: "store_email", label: "Email" },
    { key: "store_address", label: "Adresse" },
    { key: "currency", label: "Devise" },
    { key: "opening_hours", label: "Horaires d'ouverture" },
    { key: "whatsapp_number", label: "Numéro WhatsApp" },
  ];

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Informations du magasin</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {fields.map((f) => (
            <div key={f.key}>
              <Label>{f.label}</Label>
              <Input value={settings[f.key] || ""} onChange={(e) => updateSetting(f.key, e.target.value)} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSettings;
