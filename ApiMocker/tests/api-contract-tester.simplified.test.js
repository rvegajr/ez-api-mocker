/**
 * Simplified Tests for the Universal API Contract Tester
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

      const protocol = await apiContractTester.detectProtocol('http://example.com/odata');
      expect(protocol).toBe(apiContractTester.PROTOCOL_TYPES.ODATA);
    });

    test('should detect GraphQL protocol when introspection query succeeds', async () => {
      // Mock failed response for OData metadata
      axios.get.mockImplementation((url) => {
        if (url.includes('$metadata')) {
          return Promise.reject(new Error('Not found'));
        }
        return Promise.reject(new Error('Not found'));
      });
      
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

      const protocol = await apiContractTester.detectProtocol('http://example.com/graphql');
      expect(protocol).toBe(apiContractTester.PROTOCOL_TYPES.GRAPHQL);
    });

    test('should detect REST protocol when swagger.json endpoint exists', async () => {
      // Mock failed responses for OData and GraphQL
      axios.get.mockImplementation((url) => {
        if (url.includes('$metadata')) {
          return Promise.reject(new Error('Not found'));
        }
        if (url.includes('swagger.json')) {
          return Promise.resolve({
            status: 200,
            headers: { 'content-type': 'application/json' },
            data: { swagger: '2.0', info: { title: 'Test API' } }
          });
        }
        return Promise.reject(new Error('Not found'));
      });
      
      axios.post.mockRejectedValue(new Error('Not found'));

      const protocol = await apiContractTester.detectProtocol('http://example.com/api');
      expect(protocol).toBe(apiContractTester.PROTOCOL_TYPES.REST);
    });

    test('should default to REST when no specific protocol is detected', async () => {
      // Mock failed responses for all protocol detection attempts
      axios.get.mockRejectedValue(new Error('Not found'));
      axios.post.mockRejectedValue(new Error('Not found'));
      axios.head.mockRejectedValue(new Error('Not found'));

      const protocol = await apiContractTester.detectProtocol('http://example.com/unknown');
      expect(protocol).toBe(apiContractTester.PROTOCOL_TYPES.REST);
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

      // Create a capabilities object to pass to the function
      const capabilities = {
        protocol: apiContractTester.PROTOCOL_TYPES.ODATA,
        endpoints: [],
        metadata: null,
        supportsOData: false,
        supportsSwagger: false,
        supportsGraphQL: false,
        supportsCrud: false,
        error: null
      };

      // Mock axios for the function
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

      // Call the internal function directly
      await apiContractTester.discoverODataCapabilities('http://example.com/odata', capabilities);
      
      expect(capabilities.supportsOData).toBe(true);
      expect(capabilities.endpoints.length).toBe(1);
      expect(capabilities.endpoints[0].name).toBe('Products');
      expect(parseEdmxSpy).toHaveBeenCalled();
    });
  });

  describe('Validation', () => {
    test('should validate OData endpoints', async () => {
      // Mock probeApiCapabilities to return a known result
      const originalProbeApiCapabilities = apiContractTester.probeApiCapabilities;
      apiContractTester.probeApiCapabilities = jest.fn().mockResolvedValue({
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

      // Mock axios for validateODataEndpoint
      axios.get.mockImplementation((url, config) => {
        if (url.includes('Products')) {
          if (config?.params?.$select) {
            return Promise.resolve({
              status: 200,
              data: {
                value: [
                  { id: 1, name: 'Product 1' }
                ]
              }
            });
          }
          return Promise.resolve({
            status: 200,
            data: {
              value: [
                { id: 1, name: 'Product 1', price: 10.99 }
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

      try {
        const validationResults = await apiContractTester.validateApiContract('http://example.com/odata');
        
        expect(validationResults.protocol).toBe(apiContractTester.PROTOCOL_TYPES.ODATA);
        expect(validationResults.endpoints.length).toBe(1);
        expect(validationResults.endpoints[0].tests.length).toBeGreaterThan(0);
        expect(validationResults.summary.total).toBeGreaterThan(0);
      } finally {
        // Restore the original function
        apiContractTester.probeApiCapabilities = originalProbeApiCapabilities;
      }
    });
  });
});
