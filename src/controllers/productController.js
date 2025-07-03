const { pool } = require('../config/database');
const { productSchema } = require('../validators/schemas');

class ProductController {
  async getAllProducts(req, res) {
    try {
      const { category, available, low_stock } = req.query;
      let query = 'SELECT * FROM products WHERE 1=1';
      const params = [];

      if (category) {
        params.push(category);
        query += ` AND category = $${params.length}`;
      }

      if (available !== undefined) {
        params.push(available === 'true');
        query += ` AND is_available = $${params.length}`;
      }

      if (low_stock === 'true') {
        query += ` AND stock <= need_to_order`;
      }

      query += ' ORDER BY name ASC';

      const result = await pool.query(query, params);
      
      // Add computed fields for Flutter compatibility
      const products = result.rows.map(product => ({
        ...product,
        stockDisplay: `${product.stock}${product.unit}`,
        availableStock: Math.max(0, product.stock - product.used),
        stockStatus: product.stock <= product.need_to_order ? 'low' : 
                    product.stock <= (product.need_to_order * 1.5) ? 'medium' : 'high'
      }));

      res.json({
        success: true,
        data: products,
        count: products.length
      });
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching products',
        error: error.message
      });
    }
  }

  async getProductById(req, res) {
    try {
      const { id } = req.params;
      const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      const product = result.rows[0];
      
      res.json({
        success: true,
        data: {
          ...product,
          stockDisplay: `${product.stock}${product.unit}`,
          availableStock: Math.max(0, product.stock - product.used),
          stockStatus: product.stock <= product.need_to_order ? 'low' : 
                      product.stock <= (product.need_to_order * 1.5) ? 'medium' : 'high'
        }
      });
    } catch (error) {
      console.error('Error fetching product:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching product',
        error: error.message
      });
    }
  }

  async createProduct(req, res) {
    try {
      const { error, value } = productSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(detail => detail.message)
        });
      }

      const {
        name,
        price,
        stock = 0,
        unit = 'kg',
        used = 0,
        need_to_order = 0,
        description,
        image_url,
        category,
        is_available = true
      } = value;

      const result = await pool.query(
        `INSERT INTO products (name, price, stock, unit, used, need_to_order, description, image_url, category, is_available)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [name, price, stock, unit, used, need_to_order, description, image_url, category, is_available]
      );

      const product = result.rows[0];

      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: {
          ...product,
          stockDisplay: `${product.stock}${product.unit}`,
          availableStock: Math.max(0, product.stock - product.used),
          stockStatus: product.stock <= product.need_to_order ? 'low' : 
                      product.stock <= (product.need_to_order * 1.5) ? 'medium' : 'high'
        }
      });
    } catch (error) {
      console.error('Error creating product:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating product',
        error: error.message
      });
    }
  }

  async updateProduct(req, res) {
    try {
      const { id } = req.params;
      const { error, value } = productSchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(detail => detail.message)
        });
      }

      const {
        name,
        price,
        stock,
        unit,
        used,
        need_to_order,
        description,
        image_url,
        category,
        is_available
      } = value;

      const result = await pool.query(
        `UPDATE products 
         SET name = $1, price = $2, stock = $3, unit = $4, used = $5, need_to_order = $6,
             description = $7, image_url = $8, category = $9, is_available = $10, updated_at = CURRENT_TIMESTAMP
         WHERE id = $11
         RETURNING *`,
        [name, price, stock, unit, used, need_to_order, description, image_url, category, is_available, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      const product = result.rows[0];

      res.json({
        success: true,
        message: 'Product updated successfully',
        data: {
          ...product,
          stockDisplay: `${product.stock}${product.unit}`,
          availableStock: Math.max(0, product.stock - product.used),
          stockStatus: product.stock <= product.need_to_order ? 'low' : 
                      product.stock <= (product.need_to_order * 1.5) ? 'medium' : 'high'
        }
      });
    } catch (error) {
      console.error('Error updating product:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating product',
        error: error.message
      });
    }
  }

  async deleteProduct(req, res) {
    try {
      const { id } = req.params;
      
      // Check if product is used in any orders
      const orderCheck = await pool.query(
        'SELECT COUNT(*) FROM order_items WHERE product_id = $1',
        [id]
      );

      if (parseInt(orderCheck.rows[0].count) > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete product that has been ordered'
        });
      }

      const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      res.json({
        success: true,
        message: 'Product deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting product:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting product',
        error: error.message
      });
    }
  }

  async getCategories(req, res) {
    try {
      const result = await pool.query(
        'SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category'
      );

      res.json({
        success: true,
        data: result.rows.map(row => row.category)
      });
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching categories',
        error: error.message
      });
    }
  }

  async updateStock(req, res) {
    try {
      const { id } = req.params;
      const { stock, used, need_to_order } = req.body;

      if (stock === undefined && used === undefined && need_to_order === undefined) {
        return res.status(400).json({
          success: false,
          message: 'At least one field (stock, used, need_to_order) is required'
        });
      }

      let query = 'UPDATE products SET ';
      const params = [];
      const updates = [];

      if (stock !== undefined) {
        params.push(stock);
        updates.push(`stock = $${params.length}`);
      }

      if (used !== undefined) {
        params.push(used);
        updates.push(`used = $${params.length}`);
      }

      if (need_to_order !== undefined) {
        params.push(need_to_order);
        updates.push(`need_to_order = $${params.length}`);
      }

      params.push(id);
      query += updates.join(', ') + `, updated_at = CURRENT_TIMESTAMP WHERE id = $${params.length} RETURNING *`;

      const result = await pool.query(query, params);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      const product = result.rows[0];

      res.json({
        success: true,
        message: 'Stock updated successfully',
        data: {
          ...product,
          stockDisplay: `${product.stock}${product.unit}`,
          availableStock: Math.max(0, product.stock - product.used),
          stockStatus: product.stock <= product.need_to_order ? 'low' : 
                      product.stock <= (product.need_to_order * 1.5) ? 'medium' : 'high'
        }
      });
    } catch (error) {
      console.error('Error updating stock:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating stock',
        error: error.message
      });
    }
  }

  async getLowStockProducts(req, res) {
    try {
      const result = await pool.query(
        'SELECT * FROM products WHERE stock <= need_to_order AND is_available = true ORDER BY (stock - need_to_order) ASC'
      );

      const products = result.rows.map(product => ({
        ...product,
        stockDisplay: `${product.stock}${product.unit}`,
        availableStock: Math.max(0, product.stock - product.used),
        stockStatus: 'low',
        shortage: Math.max(0, product.need_to_order - product.stock)
      }));

      res.json({
        success: true,
        data: products,
        count: products.length
      });
    } catch (error) {
      console.error('Error fetching low stock products:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching low stock products',
        error: error.message
      });
    }
  }

  async getStockReport(req, res) {
    try {
      const result = await pool.query(`
        SELECT 
          category,
          COUNT(*) as total_products,
          SUM(stock) as total_stock,
          SUM(used) as total_used,
          SUM(need_to_order) as total_need_to_order,
          COUNT(CASE WHEN stock <= need_to_order THEN 1 END) as low_stock_count
        FROM products 
        WHERE is_available = true
        GROUP BY category
        ORDER BY category
      `);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Error fetching stock report:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching stock report',
        error: error.message
      });
    }
  }
}

module.exports = new ProductController();
