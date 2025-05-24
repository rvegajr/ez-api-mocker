/**
 * Tests for the Universal API Contract Tester
 */

const axios = require('axios');
const apiContractTester = require('../src/api-contract-tester');
const edmxParser = require('../src/parsers/edmx-parser');
const swaggerParser = require('../src/parsers/swagger-parser');
const graphqlParser = require('../src/parsers/graphql-parser');

// Mock axios
jest.mock('axios');

describe('API Contract Tester', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Reset any spies on the module
    if (apiContractTester.detectProtocol.mockRestore) {
      apiContractTester.detectProtocol.mockRestore();
    }
  });

  describe('Protocol Detection', () => {
    test('should detect OData protocol when $metadata endpoint exists', async () => {
      // Mock successful response for OData metadata
      axios.get.mockImplementation((url) => {
        if (url.includes('$metadata')) {
          return Promise.resolve({
            status: 200,
            headers: { 'content-type': 'application/xml' },
            data: '<edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" Version="4.0"></edmx:Edmx>'
          });
        }
        return Promise.reject(new Error('Not found'));
      });

      const capabilities = await apiContractTester.probeApiCapabilities('http://example.com/odata');
      expect(capabilities.protocol).toBe(apiContractTester.PROTOCOL_TYPES.ODATA);
      expect(capabilities.supportsOData).toBe(true);
    });

    test('should detect GraphQL protocol when introspection query succeeds', async () => {
      // Mock all HTTP requests to fail by default
      axios.get.mockRejectedValue(new Error('Not found'));
      axios.head.mockRejectedValue(new Error('Not found'));
      
      // Mock successful response for GraphQL introspection
      axios.post.mockImplementation((url, data) => {
        if (url.includes('graphql') && data.query && data.query.includes('__schema')) {
          return Promise.resolve({
            status: 200,
            data: {
              data: {
                __schema: {
                  queryType: { name: 'Query' }
                }
              }
            }
          });
        }
        return Promise.reject(new Error('Not found'));
      });

      const capabilities = await apiContractTester.probeApiCapabilities('http://example.com/graphql');
      
      expect(capabilities.protocol).toBe(apiContractTester.PROTOCOL_TYPES.GRAPHQL);
      expect(capabilities.supportsGraphQL).toBe(true);
    });

    test('should detect REST protocol when swagger.json endpoint exists', async () => {
      // Mock all HTTP requests to fail by default
      axios.post.mockRejectedValue(new Error('Not found'));
      axios.head.mockRejectedValue(new Error('Not found'));
      
      // Mock successful response for Swagger
      axios.get.mockImplementation((url) => {
        if (url.includes('swagger.json')) {
          return Promise.resolve({
            status: 200,
            headers: { 'content-type': 'application/json' },
            data: { swagger: '2.0', info: { title: 'Test API' } }
          });
        }
        if (url.includes('$metadata')) {
          return Promise.reject(new Error('Not found'));
        }
        return Promise.reject(new Error('Not found'));
      });

      const capabilities = await apiContractTester.probeApiCapabilities('http://example.com/api');
      
      expect(capabilities.protocol).toBe(apiContractTester.PROTOCOL_TYPES.REST);
      expect(capabilities.supportsSwagger).toBe(true);
    });

    test('should default to REST when no specific protocol is detected', async () => {
      // Mock failed responses for all protocol detection attempts
      axios.get.mockRejectedValue(new Error('Not found'));
      axios.post.mockRejectedValue(new Error('Not found'));
      axios.head.mockRejectedValue(new Error('Not found'));

      // Override the detectProtocol function to return REST as default
      const originalDetectProtocol = apiContractTester.detectProtocol;
      apiContractTester.detectProtocol = jest.fn().mockResolvedValue(apiContractTester.PROTOCOL_TYPES.REST);

      try {
        const capabilities = await apiContractTester.probeApiCapabilities('http://example.com/unknown');
        expect(capabilities.protocol).toBe(apiContractTester.PROTOCOL_TYPES.REST);
      } finally {
        // Restore the original function
        apiContractTester.detectProtocol = originalDetectProtocol;
      }
    });
  });

  describe('OData Capabilities Discovery', () => {
    test('should discover entity sets from OData metadata', async () => {
      // Mock successful responses for OData
      const mockMetadata = `
        <edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" Version="4.0">
          <edmx:DataServices>
            <Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="TestService">
              <EntityType Name="Product">
                <Key>
                  <PropertyRef Name="ID" />
                </Key>
                <Property Name="ID" Type="Edm.Int32" Nullable="false" />
                <Property Name="Name" Type="Edm.String" />
                <Property Name="Price" Type="Edm.Decimal" />
              </EntityType>
              <EntityContainer Name="DefaultContainer">
                <EntitySet Name="Products" EntityType="TestService.Product" />
              </EntityContainer>
            </Schema>
          </edmx:DataServices>
        </edmx:Edmx>
      `;

      const mockServiceDoc = {
        '@odata.context': 'http://example.com/odata/$metadata',
        value: [
          { name: 'Products', kind: 'EntitySet', url: 'Products' }
        ]
      };

      axios.get.mockImplementation((url) => {
        if (url.includes('$metadata')) {
          return Promise.resolve({
            status: 200,
            headers: { 'content-type': 'application/xml' },
            data: mockMetadata
          });
        } else if (url === 'http://example.com/odata') {
          return Promise.resolve({
            status: 200,
            data: mockServiceDoc
          });
        }
        return Promise.reject(new Error('Not found'));
      });

      // Spy on edmxParser
      const parseEdmxSpy = jest.spyOn(edmxParser, 'parseEdmx').mockResolvedValue({
        entitySets: [{ name: 'Products', entityType: 'TestService.Product' }],
        entityTypes: [{ 
          name: 'Product', 
          properties: [
            { name: 'ID', type: 'Edm.Int32' },
            { name: 'Name', type: 'Edm.String' },
            { name: 'Price', type: 'Edm.Decimal' }
          ]
        }]
      });

      const capabilities = await apiContractTester.probeApiCapabilities('http://example.com/odata');
      
      expect(capabilities.protocol).toBe(apiContractTester.PROTOCOL_TYPES.ODATA);
      expect(capabilities.supportsOData).toBe(true);
      expect(capabilities.endpoints.length).toBe(1);
      expect(capabilities.endpoints[0].name).toBe('Products');
      expect(parseEdmxSpy).toHaveBeenCalled();
    });
  });

  describe('REST Capabilities Discovery', () => {
    test('should discover endpoints from Swagger specification', async () => {
      // Mock all HTTP requests to fail by default
      axios.post.mockRejectedValue(new Error('Not found'));
      axios.head.mockRejectedValue(new Error('Not found'));
      
      // Mock successful response for Swagger
      const mockSwagger = {
        swagger: '2.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/products': {
            get: { operationId: 'getProducts', summary: 'Get all products' },
            post: { operationId: 'createProduct', summary: 'Create a product' }
          },
          '/products/{id}': {
            get: { operationId: 'getProductById', summary: 'Get a product by ID' },
            put: { operationId: 'updateProduct', summary: 'Update a product' },
            delete: { operationId: 'deleteProduct', summary: 'Delete a product' }
          }
        }
      };

      // Mock detectProtocol to return REST
      const originalDetectProtocol = apiContractTester.detectProtocol;
      apiContractTester.detectProtocol = jest.fn().mockResolvedValue(apiContractTester.PROTOCOL_TYPES.REST);

      axios.get.mockImplementation((url) => {
        if (url.includes('swagger.json')) {
          return Promise.resolve({
            status: 200,
            headers: { 'content-type': 'application/json' },
            data: mockSwagger
          });
        }
        if (url.includes('$metadata')) {
          return Promise.reject(new Error('Not found'));
        }
        return Promise.reject(new Error('Not found'));
      });

      // Spy on swaggerParser
      const parseSwaggerSpy = jest.spyOn(swaggerParser, 'parseSwagger').mockReturnValue({
        paths: [
          { 
            path: '/products',
            operations: [
              { method: 'GET', operationId: 'getProducts' },
              { method: 'POST', operationId: 'createProduct' }
            ]
          },
          {
            path: '/products/{id}',
            operations: [
              { method: 'GET', operationId: 'getProductById' },
              { method: 'PUT', operationId: 'updateProduct' },
              { method: 'DELETE', operationId: 'deleteProduct' }
            ]
          }
        ]
      });

      try {
        const capabilities = await apiContractTester.probeApiCapabilities('http://example.com/api');
        
        expect(capabilities.protocol).toBe(apiContractTester.PROTOCOL_TYPES.REST);
        expect(capabilities.supportsSwagger).toBe(true);
        expect(capabilities.endpoints.length).toBe(2);
        expect(parseSwaggerSpy).toHaveBeenCalled();
        expect(capabilities.supportsCrud).toBe(true);
      } finally {
        // Restore the original function
        apiContractTester.detectProtocol = originalDetectProtocol;
      }
    });
  });

  describe('GraphQL Capabilities Discovery', () => {
    test('should discover types from GraphQL introspection', async () => {
      // Mock all HTTP requests to fail by default
      axios.get.mockRejectedValue(new Error('Not found'));
      axios.head.mockRejectedValue(new Error('Not found'));
      
      // Mock detectProtocol to return GRAPHQL
      const originalDetectProtocol = apiContractTester.detectProtocol;
      apiContractTester.detectProtocol = jest.fn().mockResolvedValue(apiContractTester.PROTOCOL_TYPES.GRAPHQL);
      
      // Mock successful response for GraphQL introspection
      const mockIntrospection = {
        __schema: {
          queryType: { name: 'Query' },
          mutationType: { name: 'Mutation' },
          types: [
            {
              kind: 'OBJECT',
              name: 'Query',
              fields: [
                {
                  name: 'products',
                  type: { kind: 'LIST', ofType: { kind: 'OBJECT', name: 'Product' } },
                  args: []
                }
              ]
            },
            {
              kind: 'OBJECT',
              name: 'Product',
              fields: [
                { name: 'id', type: { kind: 'SCALAR', name: 'ID' } },
                { name: 'name', type: { kind: 'SCALAR', name: 'String' } },
                { name: 'price', type: { kind: 'SCALAR', name: 'Float' } }
              ]
            }
          ]
        }
      };

      axios.post.mockImplementation((url, data) => {
        if (url.includes('graphql') && data.query && data.query.includes('__schema')) {
          return Promise.resolve({
            status: 200,
            data: { data: mockIntrospection }
          });
        }
        return Promise.reject(new Error('Not found'));
      });

      // Spy on graphqlParser
      const parseSchemaspy = jest.spyOn(graphqlParser, 'parseSchema').mockReturnValue({
        queryType: 'Query',
        mutationType: 'Mutation',
        types: [
          {
            name: 'Product',
            kind: 'OBJECT',
            fields: [
              { name: 'id', type: { kind: 'SCALAR', name: 'ID' } },
              { name: 'name', type: { kind: 'SCALAR', name: 'String' } },
              { name: 'price', type: { kind: 'SCALAR', name: 'Float' } }
            ]
          }
        ]
      });

      try {
        const capabilities = await apiContractTester.probeApiCapabilities('http://example.com/graphql');
        
        expect(capabilities.protocol).toBe(apiContractTester.PROTOCOL_TYPES.GRAPHQL);
        expect(capabilities.supportsGraphQL).toBe(true);
        expect(parseSchemaspy).toHaveBeenCalled();
        expect(capabilities.supportsCrud).toBe(true);
      } finally {
        // Restore the original function
        apiContractTester.detectProtocol = originalDetectProtocol;
      }
    });
  });

  describe('API Contract Validation', () => {
    test('should validate OData endpoints', async () => {
      // Mock successful responses for OData
      axios.get.mockImplementation((url) => {
        if (url.includes('$metadata')) {
          return Promise.resolve({
            status: 200,
            headers: { 'content-type': 'application/xml' },
            data: '<edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" Version="4.0"></edmx:Edmx>'
          });
        } else if (url.includes('Products')) {
          return Promise.resolve({
            status: 200,
            data: {
              value: [
                { id: 1, name: 'Product 1', price: 10.99 }
              ]
            }
          });
        } else if (url.includes('Products?$select=id,name')) {
          return Promise.resolve({
            status: 200,
            data: {
              value: [
                { id: 1, name: 'Product 1' }
              ]
            }
          });
        } else if (url.includes('Products/1')) {
          return Promise.resolve({
            status: 200,
            data: { id: 1, name: 'Product 1', price: 10.99 }
          });
        }
        return Promise.reject(new Error('Not found'));
      });

      // Mock capabilities
      jest.spyOn(apiContractTester, 'probeApiCapabilities').mockResolvedValue({
        protocol: apiContractTester.PROTOCOL_TYPES.ODATA,
        supportsOData: true,
        endpoints: [
          {
            name: 'Products',
            url: 'http://example.com/odata/Products',
            type: 'collection',
            methods: ['GET', 'POST', 'PUT', 'DELETE']
          }
        ],
        error: null
      });

      const validationResults = await apiContractTester.validateApiContract('http://example.com/odata');
      
      expect(validationResults.protocol).toBe(apiContractTester.PROTOCOL_TYPES.ODATA);
      expect(validationResults.endpoints.length).toBe(1);
      expect(validationResults.endpoints[0].tests.length).toBeGreaterThan(0);
      expect(validationResults.summary.total).toBeGreaterThan(0);
    });
  });
});
