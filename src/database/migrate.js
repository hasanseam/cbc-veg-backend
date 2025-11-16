const { pool, testConnection } = require('../config/database');

const createTables = async () => {
  console.log('🚀 Starting database migration...');

  try {
    // Test connection first
    await testConnection();
    console.log('✅ Database connection successful.');
  } catch (error) {
    console.error(
      '❌ Cannot connect to database. Please check your database configuration.',
      error
    );
    process.exit(1);
  }

  const client = await pool.connect();

  try {
    console.log('📋 Creating tables...');

    // Create products table with stock management fields
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        unit VARCHAR(50) NOT NULL DEFAULT 'kg',
        used INTEGER NOT NULL DEFAULT 0,
        need_to_order INTEGER NOT NULL DEFAULT 0,
        description TEXT,
        image_url VARCHAR(500),
        category VARCHAR(100),
        type VARCHAR(50),
        is_available BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Products table created');

    // Add 'type' column to products table if it doesn't exist
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'products' AND column_name = 'type'
        ) THEN
          ALTER TABLE products ADD COLUMN type VARCHAR(50);
        END IF;
      END$$;
    `);
    console.log('✅ Ensured "type" column exists in products table');

    // Remove the UNIQUE constraint from product name if it exists
    await client.query(`
      ALTER TABLE products DROP CONSTRAINT IF EXISTS products_name_key;
    `);
    console.log('✅ Ensured UNIQUE constraint is removed from products(name)');

    // Create customers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        phone VARCHAR(50),
        address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Customers table created');

    // Create orders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id),
        customer_name VARCHAR(255),
        customer_email VARCHAR(255),
        customer_phone VARCHAR(50),
        customer_address TEXT,
        total_amount DECIMAL(10, 2) NOT NULL,
        total_items INTEGER NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Orders table created');

    // Create order_items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id),
        product_name VARCHAR(255) NOT NULL,
        quantity DECIMAL(10, 2) NOT NULL,
        unit VARCHAR(50) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        total_price DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Order items table created');

    // Create users table for authentication
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Users table created');

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_available ON products(is_available);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_type ON products(type);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `);
    console.log('✅ Indexes created');

    // Create updated_at trigger function
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);
    console.log('✅ Trigger function created');

    // Create stock management trigger function
    await client.query(`
      CREATE OR REPLACE FUNCTION update_stock_on_order()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Update product stock when order item is created
        IF TG_OP = 'INSERT' THEN
          UPDATE products 
          SET used = used + NEW.quantity::INTEGER,
              need_to_order = GREATEST(0, (used + NEW.quantity::INTEGER) - stock)
          WHERE id = NEW.product_id;
          RETURN NEW;
        END IF;
        
        -- Update product stock when order item is updated
        IF TG_OP = 'UPDATE' THEN
          UPDATE products 
          SET used = used - OLD.quantity::INTEGER + NEW.quantity::INTEGER,
              need_to_order = GREATEST(0, (used - OLD.quantity::INTEGER + NEW.quantity::INTEGER) - stock)
          WHERE id = NEW.product_id;
          RETURN NEW;
        END IF;
        
        -- Update product stock when order item is deleted
        IF TG_OP = 'DELETE' THEN
          UPDATE products 
          SET used = used - OLD.quantity::INTEGER,
              need_to_order = GREATEST(0, (used - OLD.quantity::INTEGER) - stock)
          WHERE id = OLD.product_id;
          RETURN OLD;
        END IF;
        
        RETURN NULL;
      END;
      $$ language 'plpgsql';
    `);
    console.log('✅ Stock management trigger function created');

    // Create triggers for updated_at
    await client.query(`
      DROP TRIGGER IF EXISTS update_products_updated_at ON products;
      CREATE TRIGGER update_products_updated_at
        BEFORE UPDATE ON products
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
      CREATE TRIGGER update_customers_updated_at
        BEFORE UPDATE ON customers
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
      CREATE TRIGGER update_orders_updated_at
        BEFORE UPDATE ON orders
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    // Create stock management triggers
    await client.query(`
      DROP TRIGGER IF EXISTS update_stock_on_order_insert ON order_items;
      CREATE TRIGGER update_stock_on_order_insert
        AFTER INSERT ON order_items
        FOR EACH ROW EXECUTE FUNCTION update_stock_on_order();
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_stock_on_order_update ON order_items;
      CREATE TRIGGER update_stock_on_order_update
        AFTER UPDATE ON order_items
        FOR EACH ROW EXECUTE FUNCTION update_stock_on_order();
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_stock_on_order_delete ON order_items;
      CREATE TRIGGER update_stock_on_order_delete
        AFTER DELETE ON order_items
        FOR EACH ROW EXECUTE FUNCTION update_stock_on_order();
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    console.log('✅ All triggers created');
    console.log('🎉 Database migration completed successfully!');
  } catch (error) {
    console.error('❌ Error creating tables:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Run migration
createTables()
  .then(() => {
    console.log('✨ Migration finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });
