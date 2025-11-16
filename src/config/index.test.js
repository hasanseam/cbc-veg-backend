/* eslint-env jest */

describe('Application Configuration', () => {
  const OLD_ENV = process.env;

  // Mock console and process.exit to prevent tests from stopping and to spy on their calls
  const mockConsoleError = jest
    .spyOn(console, 'error')
    .mockImplementation(() => {});
  const mockConsoleWarn = jest
    .spyOn(console, 'warn')
    .mockImplementation(() => {});
  const mockProcessExit = jest
    .spyOn(process, 'exit')
    .mockImplementation(() => {});

  beforeEach(() => {
    // Reset modules and environment variables before each test to ensure isolation
    jest.resetModules();
    process.env = { ...OLD_ENV };
    mockConsoleError.mockClear();
    mockConsoleWarn.mockClear();
    mockProcessExit.mockClear();
  });

  afterAll(() => {
    // Restore original environment and mocks
    process.env = OLD_ENV;
    mockConsoleError.mockRestore();
    mockConsoleWarn.mockRestore();
    mockProcessExit.mockRestore();
  });

  it('should load default values for development environment', () => {
    process.env.NODE_ENV = 'development';

    const config = require('./index');

    expect(config.nodeEnv).toBe('development');
    expect(config.port).toBe(3000);
    expect(config.host).toBe('0.0.0.0');
    expect(config.db.host).toBe('postgres');
    expect(config.db.user).toBe('cbc_admin');
    expect(config.jwt.expiresIn).toBe('7d');
  });

  it('should override default values with environment variables', () => {
    process.env.NODE_ENV = 'production';
    process.env.PORT = '8080';
    process.env.DB_HOST = 'my-db-host';
    process.env.JWT_SECRET = 'a-real-secret';
    process.env.DB_PASSWORD = 'a-real-password';
    process.env.CORS_ORIGIN = 'https://my-frontend.com';

    const config = require('./index');

    expect(config.nodeEnv).toBe('production');
    expect(config.port).toBe(8080);
    expect(config.db.host).toBe('my-db-host');
    expect(config.jwt.secret).toBe('a-real-secret');
  });

  it('should have undefined secrets if not provided in development', () => {
    process.env.NODE_ENV = 'development';

    const config = require('./index');

    expect(config.db.password).toBeUndefined();
    expect(config.jwt.secret).toBeUndefined();
    expect(mockProcessExit).not.toHaveBeenCalled();
  });

  describe('Production Environment Validations', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should throw an error and exit if JWT_SECRET is missing', () => {
      // Missing JWT_SECRET
      process.env.DB_PASSWORD = 'a-real-password';
      process.env.CORS_ORIGIN = 'https://my-frontend.com';

      require('./index');

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining(
          'FATAL ERROR: Required environment variable "JWT_SECRET" is missing.'
        )
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should throw an error and exit if DB_PASSWORD is missing', () => {
      // Missing DB_PASSWORD
      process.env.JWT_SECRET = 'a-real-secret';
      process.env.CORS_ORIGIN = 'https://my-frontend.com';

      require('./index');

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining(
          'FATAL ERROR: Required environment variable "DB_PASSWORD" is missing.'
        )
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should throw an error and exit if CORS_ORIGIN is missing', () => {
      // Missing CORS_ORIGIN
      process.env.JWT_SECRET = 'a-real-secret';
      process.env.DB_PASSWORD = 'a-real-password';

      require('./index');

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining(
          'FATAL ERROR: Required environment variable "CORS_ORIGIN" is missing.'
        )
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should not exit if all required variables are present', () => {
      process.env.JWT_SECRET = 'a-real-secret';
      process.env.DB_PASSWORD = 'a-real-password';
      process.env.CORS_ORIGIN = 'https://my-frontend.com';

      require('./index');

      expect(mockProcessExit).not.toHaveBeenCalled();
    });
  });

  describe('Email Configuration Warnings', () => {
    it('should warn if SMTP user is set but password is not', () => {
      process.env.SMTP_USER = 'test@example.com';
      process.env.FROM_EMAIL = 'noreply@example.com';

      require('./index');

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        'Warning: Email configuration "SMTP Password" is missing'
      );
    });

    it('should not warn if all required email configs are present', () => {
      process.env.SMTP_USER = 'test@example.com';
      process.env.SMTP_PASS = 'password';
      process.env.FROM_EMAIL = 'noreply@example.com';

      require('./index');

      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });
  });
});
