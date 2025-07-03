const { pool, testConnection } = require('../config/database');

const seedData = async () => {
  console.log('🌱 Starting database seeding...');
  
  // Test connection first
  const isConnected = await testConnection();
  if (!isConnected) {
    console.error('❌ Cannot connect to database. Please check your database configuration.');
    process.exit(1);
  }

  const client = await pool.connect();
  
  try {
    // Seed products with stock information
    const products = [
      { 
        name: 'Tomatoes', 
        price: 2.50, 
        stock: 100, 
        unit: 'kg', 
        category: 'Vegetables', 
        description: 'Fresh red tomatoes',
        used: 0,
        need_to_order: 0
      },
      { 
        name: 'Carrots', 
        price: 1.80, 
        stock: 80, 
        unit: 'kg', 
        category: 'Vegetables', 
        description: 'Organic carrots',
        used: 0,
        need_to_order: 0
      },
      { 
        name: 'Potatoes', 
        price: 1.20, 
        stock: 150, 
        unit: 'kg', 
        category: 'Vegetables', 
        description: 'Fresh potatoes',
        used: 0,
        need_to_order: 0
      },
      { 
        name: 'Onions', 
        price: 1.50, 
        stock: 120, 
        unit: 'kg', 
        category: 'Vegetables', 
        description: 'Yellow onions',
        used: 0,
        need_to_order: 0
      },
      { 
        name: 'Lettuce', 
        price: 1.00, 
        stock: 50, 
        unit: 'pc', 
        category: 'Leafy Greens', 
        description: 'Fresh lettuce head',
        used: 0,
        need_to_order: 0
      },
      { 
        name: 'Spinach', 
        price: 2.00, 
        stock: 60, 
        unit: 'kg', 
        category: 'Leafy Greens', 
        description: 'Fresh spinach leaves',
        used: 0,
        need_to_order: 0
      },
      { 
        name: 'Bell Peppers', 
        price: 3.00, 
        stock: 40, 
        unit: 'kg', 
        category: 'Vegetables', 
        description: 'Mixed bell peppers',
        used: 0,
        need_to_order: 0
      },
      { 
        name: 'Cucumbers', 
        price: 1.75, 
        stock: 70, 
        unit: 'kg', 
        category: 'Vegetables', 
        description: 'Fresh cucumbers',
        used: 0,
        need_to_order: 0
      },
      { 
        name: 'Broccoli', 
        price: 2.80, 
        stock: 30, 
        unit: 'kg', 
        category: 'Vegetables', 
        description: 'Fresh broccoli',
        used: 0,
        need_to_order: 0
      },
      { 
        name: 'Cauliflower', 
        price: 2.50, 
        stock: 25, 
        unit: 'pc', 
        category: 'Vegetables', 
        description: 'Fresh cauliflower head',
        used: 0,
        need_to_order: 0
      }
    ];

    console.log('📦 Seeding products...');
    for (const product of products) {
      await client.query(
        `INSERT INTO products (name, price, stock, unit, category, description, used, need_to_order) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         ON CONFLICT DO NOTHING`,
        [product.name, product.price, product.stock, product.unit, product.category, product.description, product.used, product.need_to_order]
      );
    }

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
