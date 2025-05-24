const fs = require('fs');
const path = require('path');
const nock = require('nock');
const getRequestHandler = require('../src/get-request-handler');

// Mock fs module
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  writeFileSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true)
}));

describe('GET Request Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    nock.cleanAll();
  });
  
  test('handles basic GET request', async () => {
    const endpoint = {
      path: '/api/users',
      method: 'get',
      operationId: 'getUsers'
    };
    
    const mockResponse = [
      { id: 1, name: 'User 1' },
      { id: 2, name: 'User 2' }
    ];
    
    nock('http://test-api.com')
      .get('/api/users')
      .reply(200, mockResponse);
    
    const client = {
      get: jest.fn().mockResolvedValue({ data: mockResponse, status: 200 })
    };
    
    const result = await getRequestHandler.handleGetRequest(
      'http://test-api.com',
      endpoint,
      client,
      '/output/dir'
    );
    
    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockResponse);
    expect(result.statusCode).toBe(200);
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('getUsers.json'),
      expect.any(String)
    );
  });
  
  test('handles path parameters', async () => {
    const endpoint = {
      path: '/api/users/{id}',
      method: 'get',
      operationId: 'getUserById',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          type: 'string'
        }
      ]
    };
    
    const mockResponse = { id: 1, name: 'User 1' };
    
    nock('http://test-api.com')
      .get('/api/users/1')
      .reply(200, mockResponse);
    
    const client = {
      get: jest.fn().mockResolvedValue({ data: mockResponse, status: 200 })
    };
    
    const result = await getRequestHandler.handleGetRequest(
      'http://test-api.com',
      endpoint,
      client,
      '/output/dir',
      { pathParams: { id: '1' } }
    );
    
    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockResponse);
    expect(client.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/users/1'),
      expect.any(Object)
    );
  });
  
  test('handles query parameters', async () => {
    const endpoint = {
      path: '/api/search',
      method: 'get',
      operationId: 'search',
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
      ]
    };
    
    const mockResponse = [
      { id: 1, name: 'Result 1' },
      { id: 2, name: 'Result 2' }
    ];
    
    nock('http://test-api.com')
      .get('/api/search?q=test&limit=10')
      .reply(200, mockResponse);
    
    const client = {
      get: jest.fn().mockResolvedValue({ data: mockResponse, status: 200 })
    };
    
    const result = await getRequestHandler.handleGetRequest(
      'http://test-api.com',
      endpoint,
      client,
      '/output/dir',
      { queryParams: { q: 'test' } }
    );
    
    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockResponse);
    expect(client.get).toHaveBeenCalledWith(
      expect.stringContaining('q=test'),
      expect.any(Object)
    );
    expect(client.get).toHaveBeenCalledWith(
      expect.stringContaining('limit=10'),
      expect.any(Object)
    );
  });
  
  test('handles different response types', async () => {
    const endpoint = {
      path: '/api/binary',
      method: 'get',
      operationId: 'getBinary',
      produces: ['application/octet-stream']
    };
    
    const binaryData = Buffer.from('test binary data');
    
    const client = {
      get: jest.fn().mockResolvedValue({ 
        data: binaryData,
        status: 200,
        headers: {
          'content-type': 'application/octet-stream'
        }
      })
    };
    
    const result = await getRequestHandler.handleGetRequest(
      'http://test-api.com',
      endpoint,
      client,
      '/output/dir'
    );
    
    expect(result.success).toBe(true);
    expect(result.isBinary).toBe(true);
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('getBinary.bin'),
      expect.any(Buffer)
    );
  });
  
  test('handles error responses', async () => {
    const endpoint = {
      path: '/api/notfound',
      method: 'get',
      operationId: 'getNotFound'
    };
    
    const errorResponse = {
      message: 'Resource not found'
    };
    
    const error = new Error('Request failed with status code 404');
    error.response = {
      status: 404,
      data: errorResponse
    };
    
    const client = {
      get: jest.fn().mockRejectedValue(error)
    };
    
    const result = await getRequestHandler.handleGetRequest(
      'http://test-api.com',
      endpoint,
      client,
      '/output/dir'
    );
    
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(404);
    expect(result.error).toBeDefined();
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('getNotFound.json'),
      expect.stringMatching(/Resource not found/)
    );
  });
});
