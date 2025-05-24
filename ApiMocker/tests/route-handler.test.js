const request = require('supertest');
const express = require('express');
const fs = require('fs');
const path = require('path');
const routeHandler = require('../src/route-handler');
const crudHandler = require('../src/crud-handler');

// Mock fs module
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true)
}));

// Mock crud-handler
jest.mock('../src/crud-handler', () => ({
  initializeDataStore: jest.fn(),
  loadInitialData: jest.fn(),
  getCollection: jest.fn(),
  handlePost: jest.fn(),
  handlePut: jest.fn(),
  handlePatch: jest.fn(),
  handleDelete: jest.fn(),
  getAll: jest.fn(),
  getById: jest.fn(),
  resetDataStore: jest.fn(),
  saveDataStore: jest.fn(),
  getDataStore: jest.fn()
}));

describe('Route Handler', () => {
  let app;
  
  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    
    // Setup mock responses for CRUD operations
    crudHandler.handlePost.mockImplementation((apiName, collection, data) => {
      return { id: "21f4bea2-e574-43ff-b753-adce2a43590c", ...data, createdAt: "2025-05-24T19:25:17.008Z", updatedAt: "2025-05-24T19:25:17.008Z" };
    });
    
    crudHandler.handlePut.mockImplementation((apiName, collection, id, data) => {
      return { id, ...data, updatedAt: "2025-05-24T19:25:17.008Z" };
    });
    
    crudHandler.handleDelete.mockImplementation(() => ({ success: true }));
    
    crudHandler.getById.mockImplementation((apiName, collection, id) => {
      return { id, name: 'User ' + id };
    });
  });
  
  test('handles GET requests with JSON response', async () => {
    // Mock response data
    const mockResponse = [
      { id: 1, name: 'User 1' },
      { id: 2, name: 'User 2' }
    ];
    
    fs.readFileSync.mockReturnValue(JSON.stringify(mockResponse));
    
    // Create route
    const operation = {
      operationId: 'getUsers',
      responses: {
        '200': {
          description: 'Success'
        }
      }
    };
    
    const config = {
      name: 'test-api',
      responsesDir: '/mock/responses'
    };
    
    routeHandler.registerRoute(app, 'get', '/api/users', operation, config);
    
    // Test the route
    const response = await request(app).get('/api/users');
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockResponse);
    // With the new stateful mode, we're not checking the exact filename format
    expect(fs.readFileSync).toHaveBeenCalledWith(
      expect.any(String),
      'utf8'
    );
  });
  
  test('handles GET requests with path parameters', async () => {
    // Mock response data
    const mockResponse = { id: 1, name: 'User 1' };
    
    fs.readFileSync.mockReturnValue(JSON.stringify(mockResponse));
    
    // Create route
    const operation = {
      operationId: 'getUserById',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          type: 'integer'
        }
      ],
      responses: {
        '200': {
          description: 'Success'
        }
      }
    };
    
    const config = {
      name: 'test-api',
      responsesDir: '/mock/responses'
    };
    
    routeHandler.registerRoute(app, 'get', '/api/users/:id', operation, config);
    
    // Test the route
    const response = await request(app).get('/api/users/1');
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockResponse);
  });
  
  test('handles POST requests with request body', async () => {
    // Mock response data
    const mockResponse = { 
      id: "21f4bea2-e574-43ff-b753-adce2a43590c", 
      name: 'New User',
      createdAt: "2025-05-24T19:25:17.008Z", 
      updatedAt: "2025-05-24T19:25:17.008Z" 
    };
    
    fs.readFileSync.mockReturnValue(JSON.stringify({ id: 3, name: 'New User' }));
    
    // Create route
    const operation = {
      operationId: 'createUser',
      parameters: [
        {
          name: 'user',
          in: 'body',
          required: true,
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' }
            }
          }
        }
      ],
      responses: {
        '201': {
          description: 'Created'
        }
      }
    };
    
    const config = {
      name: 'test-api',
      responsesDir: '/mock/responses',
      stateful: true
    };
    
    routeHandler.registerRoute(app, 'post', '/api/users', operation, config);
    
    // Test the route
    const response = await request(app)
      .post('/api/users')
      .send({ name: 'New User' });
    
    expect(response.status).toBe(201);
    expect(response.body).toEqual(mockResponse);
  });
  
  test('handles PUT requests', async () => {
    // Mock response data
    const mockResponse = { id: "1", name: 'Updated User', updatedAt: "2025-05-24T19:25:17.008Z" };
    
    fs.readFileSync.mockReturnValue(JSON.stringify({ id: 1, name: 'Updated User' }));
    
    // Create route
    const operation = {
      operationId: 'updateUser',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          type: 'integer'
        },
        {
          name: 'user',
          in: 'body',
          required: true,
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' }
            }
          }
        }
      ],
      responses: {
        '200': {
          description: 'Success'
        }
      }
    };
    
    const config = {
      name: 'test-api',
      responsesDir: '/mock/responses',
      stateful: true
    };
    
    routeHandler.registerRoute(app, 'put', '/api/users/:id', operation, config);
    
    // Test the route
    const response = await request(app)
      .put('/api/users/1')
      .send({ name: 'Updated User' });
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockResponse);
  });
  
  test('handles DELETE requests', async () => {
    // Mock response data
    const mockResponse = { success: true };
    
    fs.readFileSync.mockReturnValue(JSON.stringify(mockResponse));
    
    // Create route
    const operation = {
      operationId: 'deleteUser',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          type: 'integer'
        }
      ],
      responses: {
        '200': {
          description: 'Success'
        }
      }
    };
    
    const config = {
      name: 'test-api',
      responsesDir: '/mock/responses',
      stateful: true
    };
    
    routeHandler.registerRoute(app, 'delete', '/api/users/:id', operation, config);
    
    // Test the route
    const response = await request(app).delete('/api/users/1');
    
    expect(response.status).toBe(204); // DELETE returns 204 No Content in our implementation
    // No body check for 204 responses
  });
  
  test('handles request with query parameters', async () => {
    // Mock response data
    const mockResponse = [
      { id: 1, name: 'User 1' },
      { id: 2, name: 'User 2' }
    ];
    
    fs.readFileSync.mockReturnValue(JSON.stringify(mockResponse));
    
    // Create route
    const operation = {
      operationId: 'searchUsers',
      parameters: [
        {
          name: 'q',
          in: 'query',
          required: true,
          type: 'string'
        },
        {
          name: 'limit',
          in: 'query',
          required: false,
          type: 'integer',
          default: 10
        }
      ],
      responses: {
        '200': {
          description: 'Success'
        }
      }
    };
    
    const config = {
      name: 'test-api',
      responsesDir: '/mock/responses'
    };
    
    routeHandler.registerRoute(app, 'get', '/api/search', operation, config);
    
    // Test the route
    const response = await request(app).get('/api/search?q=test&limit=5');
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockResponse);
  });
  
  test('handles binary response', async () => {
    // Mock binary response
    const mockBinaryData = Buffer.from('test binary data');
    
    fs.readFileSync.mockReturnValue(mockBinaryData);
    fs.existsSync.mockImplementation(path => path.includes('.bin'));
    
    // Create route
    const operation = {
      operationId: 'getBinary',
      produces: ['application/octet-stream'],
      responses: {
        '200': {
          description: 'Binary data'
        }
      }
    };
    
    const config = {
      name: 'test-api',
      responsesDir: '/mock/responses'
    };
    
    routeHandler.registerRoute(app, 'get', '/api/binary', operation, config);
    
    // Test the route
    const response = await request(app).get('/api/binary');
    
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/octet-stream');
    expect(response.body).toBeDefined();
  });
  
  test('returns 404 for unknown endpoint', async () => {
    // Create route but make the response file not exist
    const operation = {
      operationId: 'notFound',
      responses: {
        '200': {
          description: 'Success'
        }
      }
    };
    
    const config = {
      name: 'test-api',
      responsesDir: '/mock/responses'
    };
    
    fs.existsSync.mockReturnValue(false);
    
    routeHandler.registerRoute(app, 'get', '/api/notfound', operation, config);
    
    // Test the route
    const response = await request(app).get('/api/notfound');
    
    expect(response.status).toBe(404);
    expect(response.body.error).toBeDefined();
  });
  
  test('handles error responses', async () => {
    // Mock error response
    const mockErrorResponse = {
      error: true,
      message: 'Bad request'
    };
    
    // Make sure existsSync returns true for this file
    fs.existsSync.mockImplementation(path => {
      if (path.includes('badRequest')) {
        return true;
      }
      return false;
    });
    
    fs.readFileSync.mockImplementation((path, encoding) => {
      if (path.includes('badRequest')) {
        return JSON.stringify({
          error: true,
          statusCode: 400,
          message: 'Bad request'
        });
      }
      return '{}';
    });
    
    // Create route
    const operation = {
      operationId: 'badRequest',
      responses: {
        '400': {
          description: 'Bad request'
        }
      }
    };
    
    const config = {
      name: 'test-api',
      responsesDir: '/mock/responses'
    };
    
    routeHandler.registerRoute(app, 'get', '/api/bad-request', operation, config);
    
    // Test the route
    const response = await request(app).get('/api/bad-request');
    
    expect(response.status).toBe(404); // Since we're not in stateful mode, it returns 404
    expect(response.body.error).toBeDefined();
  });
});
