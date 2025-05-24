const request = require('supertest');
const path = require('path');
const fs = require('fs');
const mockFs = require('mock-fs');
const multiApiServer = require('../src/multi-api-server');
const apiRegistry = require('../src/api-registry');

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

describe('Multi-API Server', () => {
  beforeEach(() => {
    // Mock the file system
    mockFs({
      'data': {
        'test-api-1': {
          'config.json': JSON.stringify({
            name: 'test-api-1',
            type: 'REST',
            basePath: '/api/v1',
            swagger: 'swagger.json',
            active: true
          }),
          'swagger.json': JSON.stringify({
            openapi: '3.0.0',
            info: {
              title: 'Test API 1',
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
        },
        'test-api-2': {
          'config.json': JSON.stringify({
            name: 'test-api-2',
            type: 'OData',
            basePath: '/odata',
            metadata: 'metadata.xml',
            active: true
          }),
          'metadata.xml': '<edmx:Edmx></edmx:Edmx>',
          'responses': {
            'Products': {
              'get.json': JSON.stringify([{ ID: 1, Name: 'Product 1' }])
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

  test('creates a multi-API server with proper configuration', async () => {
    const server = await multiApiServer.createServer({
      dataDir: 'data',
      port: 3000
    });
    
    expect(server).toBeDefined();
    expect(server.app).toBeDefined();
    expect(server.port).toBe(3000);
    expect(server.apis).toBeDefined();
    expect(server.apis.length).toBe(2); // Only active APIs
  });

  test('mounts multiple APIs with their base paths', async () => {
    const expressServer = require('../src/express-server');
    const server = await multiApiServer.createServer({
      dataDir: 'data',
      port: 3000
    });
    
    // Should create a router for each API
    expect(expressServer.createRouter).toHaveBeenCalledTimes(2);
    
    // Should register routes for each API
    expect(expressServer.registerApiRoutes).toHaveBeenCalledTimes(2);
    
    // Should use the routers with the correct base paths
    expect(server.app.use).toHaveBeenCalledWith('/api/v1', expect.any(Object));
    expect(server.app.use).toHaveBeenCalledWith('/odata', expect.any(Object));
  });

  test('maintains isolated state for each API', async () => {
    const crudHandler = require('../src/crud-handler');
    await multiApiServer.createServer({
      dataDir: 'data',
      port: 3000
    });
    
    // Should initialize a data store for each API
    expect(crudHandler.initializeDataStore).toHaveBeenCalledTimes(2);
    expect(crudHandler.initializeDataStore).toHaveBeenCalledWith('test-api-1');
    expect(crudHandler.initializeDataStore).toHaveBeenCalledWith('test-api-2');
  });

  test('supports custom base paths for APIs', async () => {
    const expressServer = require('../src/express-server');
    const server = await multiApiServer.createServer({
      dataDir: 'data',
      port: 3000,
      basePaths: {
        'test-api-1': '/custom/api/v1',
        'test-api-2': '/custom/odata'
      }
    });
    
    // Should use the custom base paths
    expect(server.app.use).toHaveBeenCalledWith('/custom/api/v1', expect.any(Object));
    expect(server.app.use).toHaveBeenCalledWith('/custom/odata', expect.any(Object));
  });

  test('handles API filtering', async () => {
    const server = await multiApiServer.createServer({
      dataDir: 'data',
      port: 3000,
      apiFilter: ['test-api-1'] // Only include test-api-1
    });
    
    expect(server.apis.length).toBe(1);
    expect(server.apis[0].name).toBe('test-api-1');
  });

  test('starts the server on the specified port', async () => {
    const server = await multiApiServer.createServer({
      dataDir: 'data',
      port: 3000
    });
    
    const runningServer = await multiApiServer.startServer(server);
    expect(runningServer).toBeDefined();
    expect(server.app.listen).toHaveBeenCalledWith(3000, expect.any(Function));
  });

  test('stops the server', async () => {
    const server = await multiApiServer.createServer({
      dataDir: 'data',
      port: 3000
    });
    
    const runningServer = await multiApiServer.startServer(server);
    await multiApiServer.stopServer(runningServer);
    
    expect(runningServer.close).toHaveBeenCalled();
  });
});
