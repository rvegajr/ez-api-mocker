/**
 * Tests for the Swagger Downloader
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const swaggerDownloader = require('../src/swagger-downloader');

// Mock axios
jest.mock('axios');

// Mock fs
jest.mock('fs', () => {
  const originalFs = jest.requireActual('fs');
  return {
    ...originalFs,
    writeFileSync: jest.fn(),
    readFileSync: jest.fn(),
    existsSync: jest.fn(),
    mkdirSync: jest.fn()
  };
});

describe('Swagger Downloader', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('Swagger URL Discovery', () => {
    test('should discover Swagger URL from common paths', async () => {
      // Mock successful response for one of the common paths
      axios.head.mockImplementation((url) => {
        if (url.includes('/swagger.json')) {
          return Promise.resolve({ status: 200 });
        }
        return Promise.reject(new Error('Not found'));
      });

      const result = await swaggerDownloader.downloadSwagger('http://example.com/api');
      
      expect(result.specUrl).toBe('http://example.com/api/swagger.json');
      expect(axios.head).toHaveBeenCalledWith('http://example.com/api/swagger.json', expect.any(Object));
    });

    test('should discover Swagger URL from HTML content', async () => {
      // Mock failed responses for all common paths
      axios.head.mockRejectedValue(new Error('Not found'));
      
      // Mock successful response for base URL with HTML containing Swagger path
      axios.get.mockImplementation((url, config) => {
        if (url === 'http://example.com/api' && config.headers.Accept.includes('text/html')) {
          return Promise.resolve({
            status: 200,
            data: '<html><body><a href="/swagger/v1/swagger.json">API Docs</a></body></html>'
          });
        } else if (url === 'http://example.com/api/swagger/v1/swagger.json') {
          return Promise.resolve({
            status: 200,
            data: { swagger: '2.0', info: { title: 'Test API' } }
          });
        }
        return Promise.reject(new Error('Not found'));
      });

      const result = await swaggerDownloader.downloadSwagger('http://example.com/api');
      
      expect(result.specUrl).toBe('http://example.com/api/swagger.json');
      expect(axios.get).toHaveBeenCalledWith('http://example.com/api', expect.any(Object));
    });

    test('should handle failure to discover Swagger URL', async () => {
      // Mock failed responses for all paths
      axios.head.mockRejectedValue(new Error('Not found'));
      axios.get.mockRejectedValue(new Error('Not found'));

      const result = await swaggerDownloader.downloadSwagger('http://example.com/api');
      
      expect(result.error).not.toBeNull();
      expect(result.error.message).toBe('No Swagger/OpenAPI specification found');
    });
  });

  describe('Swagger Download', () => {
    test('should download Swagger specification', async () => {
      // Mock successful discovery and download
      const mockSwagger = {
        swagger: '2.0',
        info: {
          title: 'Test API',
          version: '1.0.0'
        },
        paths: {
          '/users': {
            get: { operationId: 'getUsers' }
          }
        }
      };

      axios.head.mockImplementation((url) => {
        if (url.includes('/swagger.json')) {
          return Promise.resolve({ status: 200 });
        }
        return Promise.reject(new Error('Not found'));
      });

      axios.get.mockImplementation((url) => {
        if (url.includes('/swagger.json')) {
          return Promise.resolve({
            status: 200,
            data: mockSwagger
          });
        }
        return Promise.reject(new Error('Not found'));
      });

      const result = await swaggerDownloader.downloadSwagger('http://example.com/api');
      
      expect(result.specUrl).toBe('http://example.com/api/swagger.json');
      expect(result.specType).toBe('swagger');
      expect(result.spec).toEqual(mockSwagger);
      expect(result.version).toBe('2.0');
      expect(result.title).toBe('Test API');
    });

    test('should download OData metadata', async () => {
      // Mock successful discovery and download for OData
      const mockODataMetadata = '<edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" Version="4.0"></edmx:Edmx>';

      axios.head.mockImplementation((url) => {
        if (url.includes('$metadata')) {
          return Promise.resolve({ status: 200 });
        }
        return Promise.reject(new Error('Not found'));
      });

      axios.get.mockImplementation((url) => {
        if (url.includes('$metadata')) {
          return Promise.resolve({
            status: 200,
            data: mockODataMetadata
          });
        }
        return Promise.reject(new Error('Not found'));
      });

      const result = await swaggerDownloader.downloadSwagger('http://example.com/odata');
      
      expect(result.specUrl).toBe('http://example.com/odata/$metadata');
      expect(result.specType).toBe('odata');
      expect(result.spec).toBe(mockODataMetadata);
    });
  });

  describe('Swagger Save', () => {
    test('should save Swagger specification to file', async () => {
      const spec = {
        baseUrl: 'http://example.com/api',
        specUrl: 'http://example.com/api/swagger.json',
        specType: 'swagger',
        spec: {
          swagger: '2.0',
          info: { title: 'Test API' }
        },
        version: '2.0',
        title: 'Test API',
        timestamp: new Date().toISOString()
      };

      // Mock file system functions
      fs.existsSync.mockReturnValue(false);

      const result = await swaggerDownloader.saveSwagger(spec, '/tmp/swagger');
      
      expect(fs.mkdirSync).toHaveBeenCalledWith('/tmp/swagger', { recursive: true });
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/tmp/swagger/test_api_swagger.json',
        JSON.stringify(spec.spec, null, 2)
      );
      expect(result.filePath).toBe('/tmp/swagger/test_api_swagger.json');
    });

    test('should save OData metadata to file', async () => {
      const spec = {
        baseUrl: 'http://example.com/odata',
        specUrl: 'http://example.com/odata/$metadata',
        specType: 'odata',
        spec: '<edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" Version="4.0"></edmx:Edmx>',
        timestamp: new Date().toISOString()
      };

      // Mock file system functions
      fs.existsSync.mockReturnValue(false);

      const result = await swaggerDownloader.saveSwagger(spec, '/tmp/swagger');
      
      expect(fs.mkdirSync).toHaveBeenCalledWith('/tmp/swagger', { recursive: true });
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/tmp/swagger/example_com_swagger.xml',
        spec.spec
      );
      expect(result.filePath).toBe('/tmp/swagger/example_com_swagger.xml');
    });

    test('should skip saving if file exists with same content', async () => {
      const spec = {
        baseUrl: 'http://example.com/api',
        specUrl: 'http://example.com/api/swagger.json',
        specType: 'swagger',
        spec: {
          swagger: '2.0',
          info: { title: 'Test API' }
        },
        version: '2.0',
        title: 'Test API',
        timestamp: new Date().toISOString()
      };

      // Mock file system functions
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(spec.spec, null, 2));

      const result = await swaggerDownloader.saveSwagger(spec, '/tmp/swagger');
      
      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(result.skipped).toBe(true);
    });

    test('should save metadata if requested', async () => {
      const spec = {
        baseUrl: 'http://example.com/api',
        specUrl: 'http://example.com/api/swagger.json',
        specType: 'swagger',
        spec: {
          swagger: '2.0',
          info: { title: 'Test API' }
        },
        version: '2.0',
        title: 'Test API',
        timestamp: new Date().toISOString()
      };

      // Mock file system functions
      fs.existsSync.mockReturnValue(false);

      const result = await swaggerDownloader.saveSwagger(spec, '/tmp/swagger', { saveMetadata: true });
      
      expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/tmp/swagger/test_api_swagger.json.meta.json',
        expect.any(String)
      );
    });
  });

  describe('Swagger Comparison', () => {
    test('should compare identical Swagger specifications', () => {
      const spec1 = {
        specType: 'swagger',
        spec: {
          swagger: '2.0',
          info: { title: 'Test API' },
          paths: {
            '/users': {
              get: { operationId: 'getUsers' }
            }
          },
          definitions: {
            User: { type: 'object' }
          }
        }
      };

      const spec2 = {
        specType: 'swagger',
        spec: {
          swagger: '2.0',
          info: { title: 'Test API' },
          paths: {
            '/users': {
              get: { operationId: 'getUsers' }
            }
          },
          definitions: {
            User: { type: 'object' }
          }
        }
      };

      const result = swaggerDownloader.compareSwagger(spec1, spec2);
      
      expect(result.identical).toBe(true);
      expect(result.changes.paths).toHaveLength(0);
      expect(result.changes.definitions).toHaveLength(0);
    });

    test('should detect added paths in Swagger specifications', () => {
      const spec1 = {
        specType: 'swagger',
        spec: {
          paths: {
            '/users': {
              get: { operationId: 'getUsers' }
            }
          }
        }
      };

      const spec2 = {
        specType: 'swagger',
        spec: {
          paths: {
            '/users': {
              get: { operationId: 'getUsers' }
            },
            '/products': {
              get: { operationId: 'getProducts' }
            }
          }
        }
      };

      const result = swaggerDownloader.compareSwagger(spec1, spec2);
      
      expect(result.identical).toBe(false);
      expect(result.changes.paths).toHaveLength(1);
      expect(result.changes.paths[0]).toEqual({
        path: '/products',
        change: 'added'
      });
    });

    test('should detect removed paths in Swagger specifications', () => {
      const spec1 = {
        specType: 'swagger',
        spec: {
          paths: {
            '/users': {
              get: { operationId: 'getUsers' }
            },
            '/products': {
              get: { operationId: 'getProducts' }
            }
          }
        }
      };

      const spec2 = {
        specType: 'swagger',
        spec: {
          paths: {
            '/users': {
              get: { operationId: 'getUsers' }
            }
          }
        }
      };

      const result = swaggerDownloader.compareSwagger(spec1, spec2);
      
      expect(result.identical).toBe(false);
      expect(result.changes.paths).toHaveLength(1);
      expect(result.changes.paths[0]).toEqual({
        path: '/products',
        change: 'removed'
      });
    });

    test('should detect added methods in Swagger specifications', () => {
      const spec1 = {
        specType: 'swagger',
        spec: {
          paths: {
            '/users': {
              get: { operationId: 'getUsers' }
            }
          }
        }
      };

      const spec2 = {
        specType: 'swagger',
        spec: {
          paths: {
            '/users': {
              get: { operationId: 'getUsers' },
              post: { operationId: 'createUser' }
            }
          }
        }
      };

      const result = swaggerDownloader.compareSwagger(spec1, spec2);
      
      expect(result.identical).toBe(false);
      expect(result.changes.paths).toHaveLength(1);
      expect(result.changes.paths[0]).toEqual({
        path: '/users',
        method: 'post',
        change: 'method_added'
      });
    });

    test('should compare different specification types', () => {
      const spec1 = {
        specType: 'swagger',
        spec: { swagger: '2.0' }
      };

      const spec2 = {
        specType: 'odata',
        spec: '<edmx:Edmx />'
      };

      const result = swaggerDownloader.compareSwagger(spec1, spec2);
      
      expect(result.identical).toBe(false);
      expect(result.changes.type).toEqual({
        from: 'swagger',
        to: 'odata'
      });
    });

    test('should compare identical OData specifications', () => {
      const spec1 = {
        specType: 'odata',
        spec: '<edmx:Edmx />'
      };

      const spec2 = {
        specType: 'odata',
        spec: '<edmx:Edmx />'
      };

      const result = swaggerDownloader.compareSwagger(spec1, spec2);
      
      expect(result.identical).toBe(true);
    });

    test('should compare different OData specifications', () => {
      const spec1 = {
        specType: 'odata',
        spec: '<edmx:Edmx version="1.0" />'
      };

      const spec2 = {
        specType: 'odata',
        spec: '<edmx:Edmx version="2.0" />'
      };

      const result = swaggerDownloader.compareSwagger(spec1, spec2);
      
      expect(result.identical).toBe(false);
    });
  });
});
