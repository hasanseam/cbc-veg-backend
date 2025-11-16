/* eslint-env jest */

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../../app'); // Import the configurable Express app
const { pool } = require('../../config/database');

describe('Auth API: Login', () => {
  let testClient;
  const testUser = {
    email: 'login-test@example.com',
    password: 'Password123!',
    username: 'logintester',
  };
  let hashedPassword;

  // Setup: connect to DB, hash password, and create a test user
  beforeAll(async () => {
    testClient = await pool.connect();
    hashedPassword = await bcrypt.hash(testUser.password, 10);

    // Clean up any previous test user
    await testClient.query('DELETE FROM users WHERE email = $1', [
      testUser.email,
    ]);

    // Insert the test user
    await testClient.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4)',
      [testUser.username, testUser.email, hashedPassword, 'user']
    );
  });

  // Teardown: remove the test user and close the connection
  afterAll(async () => {
    await testClient.query('DELETE FROM users WHERE email = $1', [
      testUser.email,
    ]);
    testClient.release();
    await pool.end(); // Close all connections in the pool
  });

  describe('POST /api/v1/auth/login', () => {
    it('should return a JWT token for valid credentials', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('token');
      expect(res.body.token).toMatch(
        /^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/
      ); // JWT format check
    });

    it('should return 401 for an incorrect password', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: testUser.email,
        password: 'WrongPassword!',
      });

      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('message', 'Invalid credentials');
      expect(res.body).not.toHaveProperty('token');
    });

    it('should return 401 for a non-existent user', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'nouser@example.com',
        password: 'any-password',
      });

      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('message', 'Invalid credentials');
    });

    it('should return 400 if email is missing', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        password: testUser.password,
      });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toContain('email'); // Assuming Joi validation
    });

    it('should return 400 if password is missing', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: testUser.email,
      });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toContain('password'); // Assuming Joi validation
    });
  });
});
