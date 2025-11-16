const PDFDocument = require('pdfkit');

class PDFService {
  /**
   * Creates a PDF buffer for an order.
   * @param {object} order - The order details.
   * @param {Array<object>} orderItems - The items in the order.
   * @returns {Promise<Buffer>} A promise that resolves with the PDF buffer.
   */
  createOrderPdf(order, orderItems) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfData = Buffer.concat(buffers);
          resolve(pdfData);
        });

        // --- PDF Content ---

        // Header
        doc
          .fontSize(20)
          .font('Helvetica-Bold')
          .text(`CBC Vegetable Order #${order.id}`, { align: 'center' });
        doc.moveDown(2);

        // Customer Info
        doc.fontSize(14).font('Helvetica-Bold').text('Customer Information');
        doc.fontSize(12).font('Helvetica');
        doc.text(`Name: ${order.customer_name}`);
        if (order.customer_email) doc.text(`Email: ${order.customer_email}`);
        if (order.customer_phone) doc.text(`Phone: ${order.customer_phone}`);
        if (order.customer_address)
          doc.text(`Address: ${order.customer_address}`);
        doc.moveDown();

        // Order Details
        const orderDate = new Date(order.created_at).toLocaleString();
        doc.text(`Order Date: ${orderDate}`);
        if (order.notes) doc.text(`Notes: ${order.notes}`);
        doc.moveDown(2);

        // Product List Table
        doc.fontSize(14).font('Helvetica-Bold').text('Product List');
        doc.moveDown();

        this.generateTable(doc, orderItems);

        doc.end();
      } catch (error) {
        console.error('Error creating PDF:', error);
        reject(error);
      }
    });
  }

  /**
   * Generates a table of items in the PDF.
   * @param {PDFDocument} doc - The PDFKit document instance.
   * @param {Array<object>} items - The items to list in the table.
   */
  generateTable(doc, items) {
    const tableTop = doc.y;
    const itemX = 50;
    const quantityX = 450;

    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Product', itemX, tableTop);
    doc.text('Quantity', quantityX, tableTop, { width: 100, align: 'right' });
    doc
      .moveTo(itemX, tableTop + 20)
      .lineTo(550, tableTop + 20)
      .stroke();
    doc.font('Helvetica');

    let y = tableTop + 30;
    items.forEach((item) => {
      doc.text(item.product_name, itemX, y);
      doc.text(`${item.quantity} ${item.unit}`, quantityX, y, {
        width: 100,
        align: 'right',
      });
      y += 25;
      doc
        .moveTo(itemX, y - 5)
        .lineTo(550, y - 5)
        .strokeColor('#eeeeee')
        .stroke();
    });
  }
}

module.exports = new PDFService();
