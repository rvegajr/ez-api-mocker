/**
 * Tests for the Swagger UI Generator
 */

const fs = require('fs');
const path = require('path');
const swaggerUIGenerator = require('../src/swagger-ui-generator');

// Mock fs
jest.mock('fs', () => {
  const originalFs = jest.requireActual('fs');
  return {
    ...originalFs,
    writeFileSync: jest.fn(),
    readFileSync: jest.fn(),
    readdirSync: jest.fn()
  };
});

describe('Swagger UI Generator', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('Single Specification UI Generation', () => {
    test('should generate Swagger UI HTML for a specification', () => {
      // Mock file system functions
      fs.writeFileSync.mockImplementation(() => {});

      const specPath = '/tmp/swagger/petstore.json';
      const result = swaggerUIGenerator.generateSwaggerUI(specPath);
      
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/tmp/swagger/petstore.html',
        expect.stringContaining('<title>API Documentation</title>')
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/tmp/swagger/petstore.html',
        expect.stringContaining('url: "petstore.json"')
      );
      expect(result.htmlPath).toBe('/tmp/swagger/petstore.html');
      expect(result.error).toBeNull();
    });

    test('should use custom title and theme', () => {
      // Mock file system functions
      fs.writeFileSync.mockImplementation(() => {});

      const specPath = '/tmp/swagger/petstore.json';
      const options = {
        title: 'Petstore API',
        theme: 'dark'
      };
      
      const result = swaggerUIGenerator.generateSwaggerUI(specPath, options);
      
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/tmp/swagger/petstore.html',
        expect.stringContaining('<title>Petstore API</title>')
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/tmp/swagger/petstore.html',
        expect.stringContaining('background-color: #111827')
      );
      expect(result.htmlPath).toBe('/tmp/swagger/petstore.html');
    });

    test('should handle errors during generation', () => {
      // Mock file system functions to throw an error
      fs.writeFileSync.mockImplementation(() => {
        throw new Error('Write error');
      });

      const specPath = '/tmp/swagger/petstore.json';
      const result = swaggerUIGenerator.generateSwaggerUI(specPath);
      
      expect(result.error).not.toBeNull();
      expect(result.error.message).toBe('Write error');
    });
  });

  describe('Directory UI Generation', () => {
    test('should generate Swagger UI for all specifications in a directory', () => {
      // Mock file system functions
      fs.readdirSync.mockReturnValue(['petstore.json', 'users.yaml', 'notes.txt', 'orders.json.meta.json']);
      fs.writeFileSync.mockImplementation(() => {});

      const specDir = '/tmp/swagger';
      const result = swaggerUIGenerator.generateSwaggerUIForDirectory(specDir);
      
      expect(fs.writeFileSync).toHaveBeenCalledTimes(2); // Once for each valid spec file
      expect(result.generatedFiles).toHaveLength(2);
      expect(result.generatedFiles).toContain('/tmp/swagger/petstore.html');
      expect(result.generatedFiles).toContain('/tmp/swagger/users.html');
    });

    test('should generate an index page when requested', () => {
      // Mock file system functions
      fs.readdirSync.mockReturnValue(['petstore.json', 'users.yaml']);
      fs.writeFileSync.mockImplementation(() => {});

      const specDir = '/tmp/swagger';
      const options = {
        generateIndex: true,
        title: 'API Documentation Index'
      };
      
      const result = swaggerUIGenerator.generateSwaggerUIForDirectory(specDir, options);
      
      expect(fs.writeFileSync).toHaveBeenCalledTimes(3); // Two specs + index
      expect(result.indexPath).toBe('/tmp/swagger/index.html');
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/tmp/swagger/index.html',
        expect.stringContaining('<title>API Documentation Index</title>')
      );
    });

    test('should handle directories with no specification files', () => {
      // Mock file system functions
      fs.readdirSync.mockReturnValue(['notes.txt', 'image.png']);

      const specDir = '/tmp/swagger';
      const result = swaggerUIGenerator.generateSwaggerUIForDirectory(specDir);
      
      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(result.error).not.toBeNull();
      expect(result.error.message).toBe('No specification files found');
    });

    test('should handle errors during directory reading', () => {
      // Mock file system functions to throw an error
      fs.readdirSync.mockImplementation(() => {
        throw new Error('Directory error');
      });

      const specDir = '/tmp/swagger';
      const result = swaggerUIGenerator.generateSwaggerUIForDirectory(specDir);
      
      expect(result.error).not.toBeNull();
      expect(result.error.message).toBe('Directory error');
    });
  });
});
