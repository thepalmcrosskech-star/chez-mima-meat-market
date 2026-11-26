import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_FROM_EMAIL = "Chez Mima <contact@chezmima.app>";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail({ to, subject, html, from }: SendEmailParams) {
  const { data, error } = await supabase.functions.invoke("send-email", {
    body: { to, subject, html, from },
  });

  if (error) {
    console.error("Error sending email:", error);
    throw error;
  }

  return data;
}

export { getOrderConfirmationEmail } from "../../supabase/functions/_shared/order-confirmation-email";

// Template pour nouveau statut de commande
export function getOrderStatusEmail(details: {
  customerName: string;
  orderId: string;
  status: string;
  statusMessage: string;
}) {
  const statusColors: Record<string, string> = {
    pending: "#f59e0b",
    confirmed: "#3b82f6",
    preparing: "#8b5cf6",
    ready: "#10b981",
    delivering: "#06b6d4",
    delivered: "#16a34a",
    cancelled: "#ef4444",
  };

  const color = statusColors[details.status] || "#6b7280";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">🍽️ Chez Mima</h1>
      </div>
      
      <div style="background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; text-align: center;">
        <p style="font-size: 16px;">Bonjour <strong>${details.customerName}</strong>,</p>
        
        <div style="background: ${color}; color: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h2 style="margin: 0; font-size: 24px;">${details.statusMessage}</h2>
        </div>
        
        <p style="color: #666;">Commande <strong>#${details.orderId.slice(0, 8).toUpperCase()}</strong></p>
      </div>
      
      <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border: 1px solid #e5e5e5; border-top: none;">
        <p style="margin: 0; color: #666; font-size: 12px;">© 2024 Chez Mima - Tous droits réservés</p>
      </div>
    </body>
    </html>
  `;
}
