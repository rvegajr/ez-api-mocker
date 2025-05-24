const apiClassifier = require('../src/api-classifier');

describe('API Classifier', () => {
  test('detects OData API from paths', () => {
    const swaggerSpec = {
      paths: {
        '/odata/$metadata': {},
        '/odata/Users': {},
        '/odata/Products': {}
      }
    };
    
    const result = apiClassifier.classifyApi(swaggerSpec);
    expect(result.isOData).toBe(true);
    expect(result.apiType).toBe('odata');
  });
  
  test('detects OData API from definitions', () => {
    const swaggerSpec = {
      paths: {
        '/api/users': {},
        '/api/products': {}
      },
      definitions: {
        'OData.Collection': {}
      }
    };
    
    const result = apiClassifier.classifyApi(swaggerSpec);
    expect(result.isOData).toBe(true);
    expect(result.apiType).toBe('odata');
  });
  
  test('identifies REST API', () => {
    const swaggerSpec = {
      paths: {
        '/api/users': {},
        '/api/products': {},
        '/api/orders': {}
      }
    };
    
    const result = apiClassifier.classifyApi(swaggerSpec);
    expect(result.isOData).toBe(false);
    expect(result.apiType).toBe('rest');
  });
  
  test('detects GraphQL API', () => {
    const swaggerSpec = {
      paths: {
        '/graphql': {},
      }
    };
    
    const result = apiClassifier.classifyApi(swaggerSpec);
    expect(result.isGraphQL).toBe(true);
    expect(result.apiType).toBe('graphql');
  });
  
  test('identifies authentication requirements', () => {
    const swaggerSpec = {
      securityDefinitions: {
        BearerAuth: {
          type: 'apiKey',
          name: 'Authorization',
          in: 'header'
        }
      },
      security: [
        { BearerAuth: [] }
      ]
    };
    
    const result = apiClassifier.classifyApi(swaggerSpec);
    expect(result.requiresAuth).toBe(true);
    expect(result.authType).toBe('bearer');
  });
  
  test('handles empty or undefined swagger spec', () => {
    expect(() => apiClassifier.classifyApi(undefined)).not.toThrow();
    expect(() => apiClassifier.classifyApi({})).not.toThrow();
    
    const result = apiClassifier.classifyApi({});
    expect(result.apiType).toBe('unknown');
  });
});
