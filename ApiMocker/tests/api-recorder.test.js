const nock = require('nock');
const fs = require('fs');
const path = require('path');
const apiRecorder = require('../src/api-recorder');

// Mock fs module
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true)
}));

describe('API Recorder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    nock.cleanAll();
  });
  
  test('records GET endpoints from Swagger spec', async () => {
    // Mock Swagger spec with endpoints
    const swaggerSpec = {
      paths: {
        '/api/users': {
          get: {
            operationId: 'getUsers',
            produces: ['application/json']
          }
        },
        '/api/products': {
          get: {
            operationId: 'getProducts',
            produces: ['application/json']
          }
        }
      }
    };
    
    // Mock API responses
    nock('http://test-api.com')
      .get('/api/users')
      .reply(200, [{ id: 1, name: 'User 1' }, { id: 2, name: 'User 2' }])
      .get('/api/products')
      .reply(200, [{ id: 1, name: 'Product 1' }, { id: 2, name: 'Product 2' }]);
    
    // Mock endpoint list
    const endpoints = [
      {
        path: '/api/users',
        method: 'get',
        operationId: 'getUsers'
      },
      {
        path: '/api/products',
        method: 'get',
        operationId: 'getProducts'
      }
    ];
    
    // Record API responses
    await apiRecorder.recordResponses('http://test-api.com', 'test-api', swaggerSpec, endpoints, {});
    
    // Check if responses were saved
    expect(fs.writeFileSync).toHaveBeenCalledTimes(3); // 2 responses + metadata
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('getUsers.json'),
      expect.any(String)
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('getProducts.json'),
      expect.any(String)
    );
  });
  
  test('handles API authentication', async () => {
    // Mock Swagger spec with endpoint
    const swaggerSpec = {
      paths: {
        '/api/secure': {
          get: {
            operationId: 'getSecureData',
            produces: ['application/json']
          }
        }
      }
    };
    
    // Mock endpoint that requires authentication
    const endpoints = [
      {
        path: '/api/secure',
        method: 'get',
        operationId: 'getSecureData'
      }
    ];
    
    // Mock API response with auth check
    const mockAuthToken = 'Bearer test-token-123';
    nock('http://test-api.com')
      .get('/api/secure')
      .matchHeader('Authorization', mockAuthToken)
      .reply(200, { secure: true })
      .get('/api/secure')
      .reply(401, { error: 'Unauthorized' });
    
    // Record with auth token
    await apiRecorder.recordResponses(
      'http://test-api.com', 
      'test-api', 
      swaggerSpec, 
      endpoints, 
      { authToken: mockAuthToken }
    );
    
    // Check if response was saved
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('getSecureData.json'),
      expect.stringMatching(/secure.*true/)
    );
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Record without auth token (should fail)
    await apiRecorder.recordResponses(
      'http://test-api.com', 
      'test-api', 
      swaggerSpec, 
      endpoints, 
      {}
    );
    
    // Check if error response was saved
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('getSecureData.json'),
      expect.stringMatching(/error.*Unauthorized/)
    );
  });
  
  test('handles API errors gracefully', async () => {
    // Mock Swagger spec with endpoints
    const swaggerSpec = {
      paths: {
        '/api/notfound': {
          get: {
            operationId: 'getNotFound',
            produces: ['application/json']
          }
        }
      }
    };
    
    // Mock endpoint that returns error
    const endpoints = [
      {
        path: '/api/notfound',
        method: 'get',
        operationId: 'getNotFound'
      }
    ];
    
    // Mock API response with 404 error
    nock('http://test-api.com')
      .get('/api/notfound')
      .reply(404, { error: 'Not Found' });
    
    // Record API responses
    await apiRecorder.recordResponses('http://test-api.com', 'test-api', swaggerSpec, endpoints, {});
    
    // Check if error response was saved
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('getNotFound.json'),
      expect.stringMatching(/error.*Not Found/)
    );
    
    // Check if metadata was updated with error
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('_metadata.json'),
      expect.stringMatching(/errorCount.*1/)
    );
  });
  
  test('handles network timeouts', async () => {
    // Mock Swagger spec with endpoints
    const swaggerSpec = {
      paths: {
        '/api/slow': {
          get: {
            operationId: 'getSlow',
            produces: ['application/json']
          }
        }
      }
    };
    
    // Mock endpoint that times out
    const endpoints = [
      {
        path: '/api/slow',
        method: 'get',
        operationId: 'getSlow'
      }
    ];
    
    // Mock API response with delay longer than timeout
    nock('http://test-api.com')
      .get('/api/slow')
      .delayConnection(3000) // 3 seconds delay
      .reply(200, { data: 'slow response' });
    
    // Record API responses with short timeout
    await apiRecorder.recordResponses(
      'http://test-api.com', 
      'test-api', 
      swaggerSpec, 
      endpoints, 
      { timeout: 1000 } // 1 second timeout
    );
    
    // Check if error response was saved
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('getSlow.json'),
      expect.stringMatching(/error.*timeout/i)
    );
  });
  
  test('records OData specific endpoints', async () => {
    // Mock Swagger spec with OData endpoints
    const swaggerSpec = {
      paths: {
        '/odata/Users': {
          get: {
            operationId: 'getUsers',
            produces: ['application/json']
          }
        }
      }
    };
    
    // Mock endpoint with OData flag
    const endpoints = [
      {
        path: '/odata/Users',
        method: 'get',
        operationId: 'getUsers',
        isOData: true,
        odataQueryOptions: ['$select', '$expand']
      }
    ];
    
    // Mock API response with OData format
    const odataResponse = {
      '@odata.context': 'http://test-api.com/$metadata#Users',
      'value': [
        { id: 1, name: 'User 1' },
        { id: 2, name: 'User 2' }
      ]
    };
    
    nock('http://test-api.com')
      .get('/odata/Users')
      .reply(200, odataResponse)
      .get('/odata/Users?$select=id,name')
      .reply(200, {
        '@odata.context': 'http://test-api.com/$metadata#Users(id,name)',
        'value': [
          { id: 1, name: 'User 1' },
          { id: 2, name: 'User 2' }
        ]
      });
    
    // Record API responses
    await apiRecorder.recordResponses('http://test-api.com', 'test-api', swaggerSpec, endpoints, {});
    
    // Check if OData response was saved
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('getUsers.json'),
      expect.stringMatching(/@odata\.context/)
    );
    
    // Check if additional OData query options were recorded
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('getUsers_select_id_name.json'),
      expect.any(String)
    );
  });
});
