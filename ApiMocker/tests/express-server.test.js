const request = require('supertest');
const fs = require('fs');
const path = require('path');
const mockFs = require('mock-fs');
const expressServer = require('../src/express-server');

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readdirSync: jest.fn(),
  readFileSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true)
}));

describe('Express Server Setup', () => {
  let app;
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    if (mockFs.restore) {
      mockFs.restore();
    }
  });
  
  test('creates an Express app with basic middleware', () => {
    app = expressServer.createApp();
    
    expect(app).toBeDefined();
    expect(app.use).toBeDefined(); // Should be an Express app with middleware setup
  });
  
  test('loads API configurations from data directory', () => {
    // Mock the data directory structure
    fs.readdirSync.mockReturnValue(['test-api', 'another-api']);
    fs.existsSync.mockReturnValue(true);
    
    // Mock reading a swagger spec
    const mockSwagger = {
      swagger: '2.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: { '/users': { get: { operationId: 'getUsers' } } }
    };
    fs.readFileSync.mockReturnValue(JSON.stringify(mockSwagger));
    
    const configs = expressServer.loadApiConfigurations('./data');
    
    expect(configs).toHaveLength(2);
    expect(configs[0].name).toBe('test-api');
    expect(configs[0].swagger).toEqual(mockSwagger);
  });
  
  test('registers API routes based on configurations', () => {
    // Create app
    app = expressServer.createApp();
    
    // Create API configs
    const configs = [
      {
        name: 'test-api',
        basePath: '/api/test',
        swagger: {
          swagger: '2.0',
          info: { title: 'Test API', version: '1.0.0' },
          paths: { 
            '/users': { 
              get: { 
                operationId: 'getUsers',
                responses: {
                  '200': {
                    description: 'Success'
                  }
                }
              } 
            } 
          }
        },
        responsesDir: path.join(__dirname, 'fixtures/test-api/responses')
      }
    ];
    
    // Mock the response file
    const mockResponse = [
      { id: 1, name: 'User 1' },
      { id: 2, name: 'User 2' }
    ];
    fs.readFileSync.mockReturnValue(JSON.stringify(mockResponse));
    
    // Register routes
    expressServer.registerApiRoutes(app, configs);
    
    // Test the registered route
    return request(app)
      .get('/api/test/users')
      .expect(200)
      .then(response => {
        expect(response.body).toEqual(mockResponse);
      });
  });
  
  test('creates a dashboard route to display available APIs', () => {
    // Create app
    app = expressServer.createApp();
    
    // Create API configs
    const configs = [
      {
        name: 'test-api',
        basePath: '/api/test',
        swagger: {
          info: { title: 'Test API', version: '1.0.0' },
          paths: { '/users': { get: { operationId: 'getUsers' } } }
        }
      },
      {
        name: 'another-api',
        basePath: '/api/another',
        swagger: {
          info: { title: 'Another API', version: '1.0.0' },
          paths: { '/items': { get: { operationId: 'getItems' } } }
        }
      }
    ];
    
    // Register dashboard
    expressServer.registerDashboard(app, configs);
    
    // Test the dashboard route
    return request(app)
      .get('/')
      .expect(200)
      .then(response => {
        expect(response.text).toContain('Test API');
        expect(response.text).toContain('Another API');
        expect(response.text).toContain('/api/test/users');
        expect(response.text).toContain('/api/another/items');
      });
  });
  
  test('starts the server on the specified port', async () => {
    // Mock the Express listen method
    const mockListen = jest.fn((port, cb) => {
      cb(); // Call the callback
      return { port };
    });
    
    const mockApp = {
      listen: mockListen
    };
    
    const server = await expressServer.startServer(mockApp, 3000);
    
    expect(mockListen).toHaveBeenCalledWith(3000, expect.any(Function));
    expect(server).toBeDefined();
    expect(server.port).toBe(3000);
  });
});
