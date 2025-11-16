const { pool, testConnection } = require('../config/database');
const { hashPassword } = require('./bcrypt');

const seedData = async () => {
  console.log('🌱 Starting database seeding...');

  // Test connection first
  const isConnected = await testConnection();
  if (!isConnected) {
    console.error(
      '❌ Cannot connect to database. Please check your database configuration.'
    );
    process.exit(1);
  }

  const client = await pool.connect();

  try {
    // Truncate all tables to ensure a clean slate
    console.log('🧹 Truncating all tables...');
    await client.query(
      'TRUNCATE TABLE order_items, orders, products, users, customers RESTART IDENTITY CASCADE'
    );
    console.log('✅ All tables truncated.');

    // Seed products with stock information
    const products = [
      {
        name: 'Tomatoes',
        price: 2.5,
        stock: 100,
        unit: 'kg',
        category: 'Vegetables',
        type: 'Kitchen',
        description: 'Fresh red tomatoes',
        used: 0,
        need_to_order: 0,
      },
      {
        name: 'Carrots',
        price: 1.8,
        stock: 80,
        unit: 'kg',
        category: 'Vegetables',
        type: 'Kitchen',
        description: 'Organic carrots',
        used: 0,
        need_to_order: 0,
      },
      {
        name: 'Potatoes',
        price: 1.2,
        stock: 150,
        unit: 'kg',
        category: 'Vegetables',
        type: 'Kitchen',
        description: 'Fresh potatoes',
        used: 0,
        need_to_order: 0,
      },
      {
        name: 'Onions',
        price: 1.5,
        stock: 120,
        unit: 'kg',
        category: 'Vegetables',
        type: 'Kitchen',
        description: 'Yellow onions',
        used: 0,
        need_to_order: 0,
      },
      {
        name: 'Lettuce',
        price: 1.0,
        stock: 50,
        unit: 'pc',
        category: 'Leafy Greens',
        type: 'Kitchen',
        description: 'Fresh lettuce head',
        used: 0,
        need_to_order: 0,
      },
      {
        name: 'Spinach',
        price: 2.0,
        stock: 60,
        unit: 'kg',
        category: 'Leafy Greens',
        type: 'Kitchen',
        description: 'Fresh spinach leaves',
        used: 0,
        need_to_order: 0,
      },
      {
        name: 'Bell Peppers',
        price: 3.0,
        stock: 40,
        unit: 'kg',
        category: 'Vegetables',
        type: 'Kitchen',
        description: 'Mixed bell peppers',
        used: 0,
        need_to_order: 0,
      },
      {
        name: 'Cucumbers',
        price: 1.75,
        stock: 70,
        unit: 'kg',
        category: 'Vegetables',
        type: 'Kitchen',
        description: 'Fresh cucumbers',
        used: 0,
        need_to_order: 0,
      },
      {
        name: 'Lemons',
        price: 0.5,
        stock: 200,
        unit: 'pc',
        category: 'Fruits',
        type: 'Bar',
        description: 'Fresh lemons for cocktails',
        used: 0,
        need_to_order: 0,
      },
      {
        name: 'Limes',
        price: 0.4,
        stock: 250,
        unit: 'pc',
        category: 'Fruits',
        type: 'Bar',
        description: 'Fresh limes for cocktails',
        used: 0,
        need_to_order: 0,
      },
      {
        name: 'Mint',
        price: 1.5,
        stock: 40,
        unit: 'bunch',
        category: 'Herbs',
        type: 'Bar',
        description: 'Fresh mint for mojitos',
        used: 0,
        need_to_order: 0,
      },
    ];

    console.log('📦 Seeding products...');
    for (const product of products) {
      await client.query(
        `INSERT INTO products (name, price, stock, unit, category, type, description, used, need_to_order) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          product.name,
          product.price,
          product.stock,
          product.unit,
          product.category,
          product.type,
          product.description,
          product.used,
          product.need_to_order,
        ]
      );
    }

    // Seed a default admin user
    console.log('👤 Seeding admin user...');
    const username = 'admin';
    const password = 'adminpass'; // Use a more secure password in production
    const passwordHash = await hashPassword(password);

    await client.query(
      `INSERT INTO users (username, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [username, passwordHash]
    );
    console.log(`✅ Default admin user '${username}' seeded.`);

    console.log('🎉 Database seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Run seeding
seedData()
  .then(() => {
    console.log('✨ Seeding finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Seeding failed:', error);
    process.exit(1);
  });
