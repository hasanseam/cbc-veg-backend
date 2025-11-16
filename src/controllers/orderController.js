const { pool } = require('../config/database');
const { orderSchema } = require('../validators/schemas');
const emailService = require('../services/emailService');

class OrderController {
  async createOrder(req, res) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { error, value } = orderSchema.validate(req.body);
      if (error) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map((detail) => detail.message),
        });
      }

      const { items, ...customerData } = value;

      // --- START: Robust Product Validation ---

      // 1. Verify all product IDs exist and get their current data from the database
      const productIds = items.map((item) => item.product_id);
      const productsResult = await client.query(
        'SELECT id, name, price, unit, is_available FROM products WHERE id = ANY($1::int[])',
        [productIds]
      );

      const foundProducts = productsResult.rows;
      if (foundProducts.length !== productIds.length) {
        const notFoundIds = productIds.filter(
          (id) => !foundProducts.some((p) => p.id === id)
        );
        await client.query('ROLLBACK'); // Abort the transaction
        return res.status(404).json({
          success: false,
          message: `One or more products could not be found.`,
          error: `Invalid product IDs: ${notFoundIds.join(', ')}`,
        });
      }

      // 2. Calculate totals using database prices and check for unavailable products
      let totalAmount = 0;
      let totalItems = 0;

      for (const item of items) {
        const product = foundProducts.find((p) => p.id === item.product_id);
        if (!product.is_available) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            message: `Product '${product.name}' is currently unavailable and cannot be ordered.`,
          });
        }
        // Use the price from the database as the source of truth
        totalAmount += parseFloat(product.price) * item.quantity;
        totalItems += item.quantity;
      }
      // --- END: Robust Product Validation ---

      // 3. Create the main order record
      const orderResult = await client.query(
        'INSERT INTO orders (customer_name, customer_email, customer_phone, customer_address, total_amount, total_items, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [
          customerData.customer_name,
          customerData.customer_email,
          customerData.customer_phone,
          customerData.customer_address,
          totalAmount,
          totalItems,
          customerData.notes,
        ]
      );
      const order = orderResult.rows[0];

      // 4. Create the associated order items
      const orderItems = [];
      for (const item of items) {
        const product = foundProducts.find((p) => p.id === item.product_id);
        const totalPrice = parseFloat(product.price) * item.quantity;
        const itemResult = await client.query(
          'INSERT INTO order_items (order_id, product_id, product_name, quantity, unit, price, total_price) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
          [
            order.id,
            item.product_id,
            product.name,
            item.quantity,
            product.unit,
            product.price,
            totalPrice,
          ]
        );
        orderItems.push(itemResult.rows[0]);
      }

      await client.query('COMMIT');

      // Try to send email notification
      let emailSent = false;
      let emailError = null;

      try {
        await emailService.sendOrderEmail(order, orderItems);
        emailSent = true;
        console.log(`✅ Order confirmation email sent for order #${order.id}`);
      } catch (error) {
        emailError = error.message;
        console.error(
          `❌ Failed to send order email for order #${order.id}:`,
          error
        );

        // Log to database for retry later
        await this.logEmailFailure(
          order.id,
          customerData.customer_email,
          error.message
        );
      }

      res.status(201).json({
        success: true,
        message: emailSent
          ? 'Order created successfully and confirmation email sent'
          : 'Order created successfully, but confirmation email failed to send',
        data: {
          order,
          items: orderItems,
          email_sent: emailSent,
          ...(emailError && { email_error: 'Email notification failed' }),
        },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating order:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating order',
        error: error.message,
      });
    } finally {
      client.release();
    }
  }

  // Helper method to log email failures for retry
  async logEmailFailure(orderId, email, errorMessage) {
    try {
      await pool.query(
        'INSERT INTO email_failures (order_id, email, error_message, created_at) VALUES ($1, $2, $3, NOW())',
        [orderId, email, errorMessage]
      );
    } catch (logError) {
      console.error('Failed to log email failure:', logError);
    }
  }

  async getAllOrders(req, res) {
    try {
      const { status, limit = 50, offset = 0 } = req.query;
      let query = `
        SELECT o.*, 
               COUNT(oi.id) as item_count,
               json_agg(
                 json_build_object(
                   'id', oi.id,
                   'product_name', oi.product_name,
                   'quantity', oi.quantity,
                   'unit', oi.unit,
                   'price', oi.price,
                   'total_price', oi.total_price
                 )
               ) as items
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE 1=1
      `;
      const params = [];

      if (status) {
        params.push(status);
        query += ` AND o.status = $${params.length}`;
      }

      query += ` GROUP BY o.id ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      // Get total count
      let countQuery = 'SELECT COUNT(*) FROM orders WHERE 1=1';
      const countParams = [];
      if (status) {
        countParams.push(status);
        countQuery += ` AND status = $${countParams.length}`;
      }

      const countResult = await pool.query(countQuery, countParams);
      const totalCount = parseInt(countResult.rows[0].count);

      res.status(200).json({
        success: true,
        data: result.rows,
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          pages: Math.ceil(totalCount / limit),
        },
      });
    } catch (error) {
      console.error('Error fetching orders:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching orders',
        error: error.message,
      });
    }
  }

  async getOrderById(req, res) {
    try {
      const { id } = req.params;

      const orderResult = await pool.query(
        'SELECT * FROM orders WHERE id = $1',
        [id]
      );
      if (orderResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Order not found',
        });
      }

      const itemsResult = await pool.query(
        'SELECT * FROM order_items WHERE order_id = $1',
        [id]
      );

      res.status(200).json({
        success: true,
        data: {
          order: orderResult.rows[0],
          items: itemsResult.rows,
        },
      });
    } catch (error) {
      console.error('Error fetching order:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching order',
        error: error.message,
      });
    }
  }

  async updateOrderStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = [
        'pending',
        'confirmed',
        'preparing',
        'ready',
        'delivered',
        'cancelled',
      ];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message:
            'Invalid status. Valid statuses are: ' + validStatuses.join(', '),
        });
      }

      const result = await pool.query(
        'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
        [status, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Order not found',
        });
      }

      res.status(200).json({
        success: true,
        message: 'Order status updated successfully',
        data: result.rows[0],
      });
    } catch (error) {
      console.error('Error updating order status:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating order status',
        error: error.message,
      });
    }
  }

  async deleteOrder(req, res) {
    try {
      const { id } = req.params;
      const result = await pool.query(
        'DELETE FROM orders WHERE id = $1 RETURNING *',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Order not found',
        });
      }

      res.status(200).json({
        success: true,
        message: 'Order deleted successfully',
        data: result.rows[0],
      });
    } catch (error) {
      console.error('Error deleting order:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting order',
        error: error.message,
      });
    }
  }

  async getOrderStats(req, res) {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_orders,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
          COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_orders,
          COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_orders,
          SUM(total_amount) as total_revenue,
          AVG(total_amount) as average_order_value
        FROM orders
      `;

      const result = await pool.query(statsQuery);

      res.status(200).json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error('Error fetching order stats:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching order stats',
        error: error.message,
      });
    }
  }
}

module.exports = new OrderController();
