const endpointExtractor = require('../src/endpoint-extractor');

describe('Endpoint Extractor', () => {
  test('extracts GET endpoints from Swagger 2.0', () => {
    const swaggerSpec = {
      swagger: '2.0',
      paths: {
        '/api/users': {
          get: {
            operationId: 'getUsers',
            produces: ['application/json'],
            responses: {
              '200': {
                description: 'OK'
              }
            }
          }
        },
        '/api/users/{id}': {
          get: {
            operationId: 'getUserById',
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                type: 'string'
              }
            ],
            produces: ['application/json'],
            responses: {
              '200': {
                description: 'OK'
              }
            }
          }
        }
      }
    };
    
    const result = endpointExtractor.extractEndpoints(swaggerSpec);
    
    expect(result).toHaveLength(2);
    expect(result[0].path).toBe('/api/users');
    expect(result[0].method).toBe('get');
    expect(result[0].operationId).toBe('getUsers');
    expect(result[1].path).toBe('/api/users/{id}');
    expect(result[1].parameters).toHaveLength(1);
    expect(result[1].parameters[0].name).toBe('id');
    expect(result[1].parameters[0].in).toBe('path');
  });
  
  test('extracts all HTTP methods for endpoints', () => {
    const swaggerSpec = {
      swagger: '2.0',
      paths: {
        '/api/resources': {
          get: { operationId: 'getResources' },
          post: { operationId: 'createResource' },
          put: { operationId: 'updateResources' },
          delete: { operationId: 'deleteResources' }
        }
      }
    };
    
    const result = endpointExtractor.extractEndpoints(swaggerSpec);
    
    expect(result).toHaveLength(4);
    // Stats are no longer returned, so we count manually
    const methods = result.map(endpoint => endpoint.method);
    expect(methods.filter(m => m === 'get').length).toBe(1);
    expect(methods.filter(m => m === 'post').length).toBe(1);
    expect(methods.filter(m => m === 'put').length).toBe(1);
    expect(methods.filter(m => m === 'delete').length).toBe(1);
  });
  
  test('extracts endpoints from OpenAPI 3.0', () => {
    const swaggerSpec = {
      openapi: '3.0.0',
      paths: {
        '/api/products': {
          get: {
            operationId: 'getProducts',
            responses: {
              '200': {
                description: 'OK',
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: {
                        '$ref': '#/components/schemas/Product'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      components: {
        schemas: {
          Product: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' }
            }
          }
        }
      }
    };
    
    const result = endpointExtractor.extractEndpoints(swaggerSpec);
    
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('/api/products');
    expect(result[0].responseSchema).toBeDefined();
    expect(result[0].responseSchema.type).toBe('array');
  });
  
  test('extracts query parameters from endpoints', () => {
    const swaggerSpec = {
      swagger: '2.0',
      paths: {
        '/api/search': {
          get: {
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
          }
        }
      }
    };
    
    const result = endpointExtractor.extractEndpoints(swaggerSpec);
    
    expect(result[0].parameters).toHaveLength(2);
    expect(result[0].parameters[0].name).toBe('q');
    expect(result[0].parameters[0].in).toBe('query');
    expect(result[0].parameters[1].name).toBe('limit');
    expect(result[0].parameters[1].default).toBe(10);
  });
  
  test('handles OData specific endpoints', () => {
    const swaggerSpec = {
      swagger: '2.0',
      paths: {
        '/odata/Users': {
          get: {
            operationId: 'getUsers',
            parameters: [
              {
                name: '$filter',
                in: 'query',
                required: false,
                type: 'string'
              },
              {
                name: '$expand',
                in: 'query',
                required: false,
                type: 'string'
              }
            ]
          }
        }
      }
    };
    
    const result = endpointExtractor.extractEndpoints(swaggerSpec, { isOData: true });
    
    expect(result[0].isOData).toBe(true);
    expect(result[0].odataQueryOptions).toContain('$filter');
    expect(result[0].odataQueryOptions).toContain('$expand');
  });
  
  test('handles empty or invalid Swagger spec', () => {
    expect(() => endpointExtractor.extractEndpoints(undefined)).not.toThrow();
    expect(() => endpointExtractor.extractEndpoints({})).not.toThrow();
    
    const result = endpointExtractor.extractEndpoints({});
    expect(result).toHaveLength(0);
    // Stats are no longer returned
  });
});
