const nock = require('nock');
const path = require('path');
const fs = require('fs');

// Mock the fs module
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn()
}));

// We need to mock the module before requiring it
const mockSwaggerParser = {
  parse: jest.fn()
};
jest.mock('@apidevtools/swagger-parser', () => mockSwaggerParser);

// Now we can require our module under test
const swaggerFetcher = require('../src/swagger-fetcher');

describe('Swagger Fetcher', () => {
  beforeEach(() => {
    nock.cleanAll();
    jest.clearAllMocks();
    mockSwaggerParser.parse.mockImplementation(data => Promise.resolve(data));
  });
  
  test('discovers swagger at common paths', async () => {
    const mockSwagger = { swagger: '2.0', info: { title: 'Test API' } };
    
    nock('http://test-api.com')
      .get('/swagger/v1/swagger.json')
      .reply(200, mockSwagger);
      
    const result = await swaggerFetcher.fetchSwagger('http://test-api.com');
    expect(result).toMatchObject(mockSwagger);
  });
  
  test('tries multiple paths if first fails', async () => {
    const mockSwagger = { swagger: '2.0', info: { title: 'Test API' } };
    
    nock('http://test-api.com')
      .get('/swagger/v1/swagger.json')
      .reply(404)
      .get('/swagger.json')
      .reply(200, mockSwagger);
      
    const result = await swaggerFetcher.fetchSwagger('http://test-api.com');
    expect(result).toMatchObject(mockSwagger);
  });
  
  test('handles direct swagger url input', async () => {
    const mockSwagger = { swagger: '2.0', info: { title: 'Test API' } };
    
    nock('http://test-api.com')
      .get('/custom/swagger-path.json')
      .reply(200, mockSwagger);
      
    const result = await swaggerFetcher.fetchSwagger('http://test-api.com/custom/swagger-path.json');
    expect(result).toMatchObject(mockSwagger);
  });
  
  test('throws error when swagger cannot be found', async () => {
    nock('http://test-api.com')
      .get('/swagger/v1/swagger.json').reply(404)
      .get('/swagger.json').reply(404)
      .get('/api-docs/swagger.json').reply(404)
      .get('/openapi.json').reply(404)
      .get('/api-docs').reply(404)
      .get('/docs/swagger.json').reply(404);
      
    await expect(swaggerFetcher.fetchSwagger('http://test-api.com'))
      .rejects.toThrow('Could not discover Swagger');
  });
  
  test('saves discovered swagger spec to file', async () => {
    const mockSwagger = { swagger: '2.0', info: { title: 'Test API' } };
    const apiName = 'test-api';
    
    nock('http://test-api.com')
      .get('/swagger.json')
      .reply(200, mockSwagger);
      
    await swaggerFetcher.fetchSwagger('http://test-api.com', apiName);
    
    // Check if directories were created
    expect(fs.mkdirSync).toHaveBeenCalled();
    
    // Check if swagger was saved
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining(apiName),
      expect.any(String)
    );
  });
});
