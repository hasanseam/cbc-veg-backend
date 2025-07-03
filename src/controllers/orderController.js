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
        errors: error.details.map(detail => detail.message)
      });
    }

    const { customer_name, customer_email, customer_phone, customer_address, notes, items } = value;

    // Calculate totals
    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalItems = items.length;

    // Create order
    const orderResult = await client.query(
      'INSERT INTO orders (customer_name, customer_email, customer_phone, customer_address, total_amount, total_items, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [customer_name, customer_email, customer_phone, customer_address, totalAmount, totalItems, notes]
    );
    const order = orderResult.rows[0];

    // Create order items
    const orderItems = [];
    for (const item of items) {
      const totalPrice = item.price * item.quantity;
      const itemResult = await client.query(
        'INSERT INTO order_items (order_id, product_id, product_name, quantity, unit, price, total_price) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [order.id, item.product_id, item.product_name, item.quantity, item.unit, item.price, totalPrice]
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
      console.error(`❌ Failed to send order email for order #${order.id}:`, error);
      
      // Log to database for retry later
      await this.logEmailFailure(order.id, customer_email, error.message);
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
        ...(emailError && { email_error: 'Email notification failed' })
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating order',
      error: error.message
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

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          pages: Math.ceil(totalCount / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching orders:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching orders',
        error: error.message
      });
    }
  }

  async getOrderById(req, res) {
    try {
      const { id } = req.params;
      
      const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
      if (orderResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      const itemsResult = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [id]);

      res.json({
        success: true,
        data: {
          order: orderResult.rows[0],
          items: itemsResult.rows
        }
      });
    } catch (error) {
      console.error('Error fetching order:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching order',
        error: error.message
      });
    }
  }

  async updateOrderStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Valid statuses are: ' + validStatuses.join(', ')
        });
      }

      const result = await pool.query(
        'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
        [status, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      res.json({
        success: true,
        message: 'Order status updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error updating order status:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating order status',
        error: error.message
      });
    }
  }

  async deleteOrder(req, res) {
    try {
      const { id } = req.params;
      const result = await pool.query('DELETE FROM orders WHERE id = $1 RETURNING *', [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      res.json({
        success: true,
        message: 'Order deleted successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error deleting order:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting order',
        error: error.message
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
      
      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error fetching order stats:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching order stats',
        error: error.message
      });
    }
  }
}

module.exports = new OrderController();
