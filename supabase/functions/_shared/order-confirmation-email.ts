export const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char] ?? char));

// Template pour confirmation de commande
export function getOrderConfirmationEmail(orderDetails: {
  customerName: string;
  orderId: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  total: number;
  deliveryAddress: string;
}) {
  const itemsHtml = orderDetails.items
    .map(
      (item) =>
        `<tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${escapeHtml(item.name)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${escapeHtml(item.quantity)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${item.price.toFixed(2)} MAD</td>
        </tr>`
    )
    .join("");

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
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Merci pour votre commande !</p>
      </div>
      
      <div style="background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none;">
        <p style="font-size: 16px;">Bonjour <strong>${escapeHtml(orderDetails.customerName)}</strong>,</p>
        
        <p>Votre commande <strong>#${escapeHtml(orderDetails.orderId.slice(0, 8).toUpperCase())}</strong> a été confirmée.</p>
        
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 15px 0; color: #16a34a;">📦 Détails de la commande</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #e5e7eb;">
                <th style="padding: 10px; text-align: left;">Article</th>
                <th style="padding: 10px; text-align: center;">Qté</th>
                <th style="padding: 10px; text-align: right;">Prix</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2" style="padding: 15px 10px; font-weight: bold; font-size: 18px;">Total</td>
                <td style="padding: 15px 10px; font-weight: bold; font-size: 18px; text-align: right; color: #16a34a;">${orderDetails.total.toFixed(2)} MAD</td>
              </tr>
            </tfoot>
          </table>
        </div>
        
        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h4 style="margin: 0 0 10px 0; color: #92400e;">📍 Adresse de livraison</h4>
          <p style="margin: 0; color: #78350f;">${escapeHtml(orderDetails.deliveryAddress)}</p>
        </div>
        
        <p style="color: #666; font-size: 14px;">Nous vous contacterons dès que votre commande sera en route.</p>
      </div>
      
      <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border: 1px solid #e5e5e5; border-top: none;">
        <p style="margin: 0; color: #666; font-size: 12px;">© ${new Date().getFullYear()} Chez Mima - Tous droits réservés</p>
      </div>
    </body>
    </html>
  `;
}

