const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  async sendOrderEmail(order, orderItems) {
    try {
      const recipients = process.env.ORDER_EMAIL_RECIPIENTS.split(',');
      const html = this.buildOrderEmailHtml(order, orderItems);
            
      const mailOptions = {
        from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
        to: recipients,
        subject: `CBC Order #${order.id} - ${new Date(order.created_at).toLocaleDateString()}`,
        html: html
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Order email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('Error sending order email:', error);
      return false;
    }
  }

  buildOrderEmailHtml(order, orderItems) {
    const orderDate = new Date(order.created_at).toLocaleDateString();
    const orderTime = new Date(order.created_at).toLocaleTimeString();
        
    let itemsHtml = '';
    orderItems.forEach(item => {
      // Convert price and total_price to numbers to handle string values from database
      const price = parseFloat(item.price) || 0;
      const totalPrice = parseFloat(item.total_price) || 0;
      
      itemsHtml += `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.product_name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}${item.unit}</td>
          <!--td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">€${price.toFixed(2).replace('.', ',')}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">€${totalPrice.toFixed(2).replace('.', ',')}</td-->
        </tr>
      `;
    });

    // Also convert order.total_amount to number
    const totalAmount = parseFloat(order.total_amount) || 0;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>CBC vegetable Order ${orderDate}</title>
      </head>
      <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h1 style="color: #2E7D32; text-align: center; margin-bottom: 30px;">CBC vegetable Order ${orderDate}</h1>
                    
          <div style="margin-bottom: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #333;">Customer Information</h3>
            <p><strong>Name:</strong> ${order.customer_name}</p>
            ${order.customer_email ? `<p><strong>Email:</strong> ${order.customer_email}</p>` : ''}
            ${order.customer_phone ? `<p><strong>Phone:</strong> ${order.customer_phone}</p>` : ''}
            ${order.customer_address ? `<p><strong>Address:</strong> ${order.customer_address}</p>` : ''}
          </div>

          <div style="margin-bottom: 20px;">
            <p><strong>Order Date:</strong> ${orderDate} at ${orderTime}</p>
            <p><strong>Total Items:</strong> ${order.total_items}</p>
            ${order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p>` : ''}
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #f0f0f0;">
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Product</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">Quantity</th>
                <!--th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">Unit Price</th>
                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">Total</th-->
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <!--div style="text-align: right; margin-top: 20px; padding-top: 20px; border-top: 2px solid #2E7D32;">
            <h2 style="color: #2E7D32; margin: 0;">Total Amount: €${totalAmount.toFixed(2).replace('.', ',')}</h2>
          </div-->

          <div style="margin-top: 30px; padding: 15px; background-color: #f9f9f9; border-radius: 4px;">
            <p style="margin: 0; font-size: 14px; color: #666;">
              This order was placed through the CBC Vegetable Order mobile application.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = new EmailService();
