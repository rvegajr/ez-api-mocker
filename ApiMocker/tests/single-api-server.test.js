const request = require('supertest');
const path = require('path');
const fs = require('fs');
const mockFs = require('mock-fs');

// Mock API data
const mockApi = {
  name: 'test-api',
  type: 'REST',
  basePath: '/api/v1',
  swagger: 'swagger.json',
  active: true,
  dirPath: 'data/test-api'
};

// Mock express-server module
jest.mock('../src/express-server', () => {
  // Create a mock server object that will be returned by listen
  const mockServer = {
    close: jest.fn().mockImplementation(callback => {
      if (callback) callback();
      return true;
    }),
    on: jest.fn()
  };
  
  // Create a mock express app
  const mockApp = {
    use: jest.fn(),
    listen: jest.fn().mockImplementation((port, callback) => {
      if (callback) callback();
      return mockServer;
    })
  };
  
  return {
    createExpressApp: jest.fn().mockReturnValue(mockApp),
    registerApiRoutes: jest.fn(),
    createRouter: jest.fn().mockReturnValue({
      use: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn()
    })
  };
});

// Mock api-registry module
jest.mock('../src/api-registry', () => {
  return {
    loadApiConfigurations: jest.fn().mockResolvedValue([mockApi]),
    getApiByName: jest.fn().mockImplementation((apis, name) => {
      if (name === 'test-api') {
        return mockApi;
      }
      return null;
    })
  };
});

// Mock route-handler module
jest.mock('../src/route-handler', () => {
  return {
    registerRoutes: jest.fn(),
    handleRequest: jest.fn()
  };
});

// Mock crud-handler module
jest.mock('../src/crud-handler', () => {
  return {
    initializeDataStore: jest.fn(),
    getDataStore: jest.fn().mockReturnValue({})
  };
});

// Require modules after mocks are set up
const singleApiServer = require('../src/single-api-server');
const apiRegistry = require('../src/api-registry');
const expressServer = require('../src/express-server');
const crudHandler = require('../src/crud-handler');

describe('Single API Server', () => {
  beforeEach(() => {
    // Mock the file system
    mockFs({
      'data': {
        'test-api': {
          'config.json': JSON.stringify({
            name: 'test-api',
            type: 'REST',
            basePath: '/api/v1',
            swagger: 'swagger.json',
            active: true
          }),
          'swagger.json': JSON.stringify({
            openapi: '3.0.0',
            info: {
              title: 'Test API',
              version: '1.0.0'
            },
            paths: {
              '/users': {
                get: { summary: 'Get users' }
              }
            }
          }),
          'responses': {
            'users': {
              'get.json': JSON.stringify([{ id: 1, name: 'User 1' }])
            }
          }
        }
      }
    });
  });

  afterEach(() => {
    // Restore the file system
    mockFs.restore();
    jest.clearAllMocks();
  });

  test('creates a single API server with proper configuration', async () => {
    const server = await singleApiServer.createServer({
      dataDir: 'data',
      apiName: 'test-api',
      port: 3000
    });
    
    expect(server).toBeDefined();
    expect(server.app).toBeDefined();
    expect(server.port).toBe(3000);
    expect(server.api).toBeDefined();
    expect(server.api.name).toBe('test-api');
  });

  test('mounts API with its base path', async () => {
    const server = await singleApiServer.createServer({
      dataDir: 'data',
      apiName: 'test-api',
      port: 3000
    });
    
    // Should create a router for the API
    expect(expressServer.createRouter).toHaveBeenCalledTimes(1);
    
    // Should register routes for the API
    expect(expressServer.registerApiRoutes).toHaveBeenCalledTimes(1);
    
    // Should use the router with the correct base path
    expect(server.app.use).toHaveBeenCalledWith('/api/v1', expect.any(Object));
  });

  test('supports custom base path', async () => {
    const server = await singleApiServer.createServer({
      dataDir: 'data',
      apiName: 'test-api',
      port: 3000,
      basePath: '/custom/api'
    });
    
    // Should use the custom base path
    expect(server.app.use).toHaveBeenCalledWith('/custom/api', expect.any(Object));
  });

  test('initializes isolated state for the API', async () => {
    await singleApiServer.createServer({
      dataDir: 'data',
      apiName: 'test-api',
      port: 3000
    });
    
    // Should initialize a data store for the API
    expect(crudHandler.initializeDataStore).toHaveBeenCalledTimes(1);
    expect(crudHandler.initializeDataStore).toHaveBeenCalledWith('test-api');
  });

  test('starts the server on the specified port', async () => {
    const server = await singleApiServer.createServer({
      dataDir: 'data',
      apiName: 'test-api',
      port: 3000
    });
    
    const runningServer = await singleApiServer.startServer(server);
    expect(runningServer).toBeDefined();
    expect(server.app.listen).toHaveBeenCalledWith(3000, expect.any(Function));
  });

  test('stops the server', async () => {
    const server = await singleApiServer.createServer({
      dataDir: 'data',
      apiName: 'test-api',
      port: 3000
    });
    
    const runningServer = await singleApiServer.startServer(server);
    await singleApiServer.stopServer(runningServer);
    
    expect(runningServer.close).toHaveBeenCalled();
  });

  test('throws error when API name is not found', async () => {
    await expect(singleApiServer.createServer({
      dataDir: 'data',
      apiName: 'non-existent-api',
      port: 3000
    })).rejects.toThrow('API not found: non-existent-api');
  });

  test('creates and starts a server in one call', async () => {
    const runningServer = await singleApiServer.createAndStartServer({
      dataDir: 'data',
      apiName: 'test-api',
      port: 3000
    });
    
    expect(runningServer).toBeDefined();
    expect(expressServer.createExpressApp).toHaveBeenCalled();
    expect(expressServer.createRouter).toHaveBeenCalled();
    expect(expressServer.registerApiRoutes).toHaveBeenCalled();
  });

  test('handles invalid server instance when stopping', async () => {
    const result = await singleApiServer.stopServer(null);
    expect(result).toBe(false);
  });

  test('handles API without base path', async () => {
    // Create API without basePath
    const apiWithoutBasePath = { ...mockApi };
    delete apiWithoutBasePath.basePath;
    
    // Mock getApiByName to return API without basePath
    apiRegistry.getApiByName.mockImplementationOnce(() => apiWithoutBasePath);
    
    const server = await singleApiServer.createServer({
      dataDir: 'data',
      apiName: 'test-api',
      port: 3000
    });
    
    // Should use the API name as base path
    expect(server.app.use).toHaveBeenCalledWith('/test-api', expect.any(Object));
  });
});
