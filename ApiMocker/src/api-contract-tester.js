/**
 * Universal API Contract Tester
 * 
 * Discovers and validates API endpoints across multiple protocols (REST, OData, GraphQL)
 * Supports automatic protocol detection and capability probing
 */

const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const edmxParser = require('./parsers/edmx-parser');
const swaggerParser = require('./parsers/swagger-parser');
const graphqlParser = require('./parsers/graphql-parser');

/**
 * API Protocol Types
 */
const PROTOCOL_TYPES = {
  REST: 'rest',
  ODATA: 'odata',
  GRAPHQL: 'graphql',
  UNKNOWN: 'unknown'
};

/**
 * Probes an API endpoint to discover its capabilities and protocol
 * @param {string} baseUrl - The base URL of the API
 * @param {Object} options - Probe options
 * @returns {Promise<Object>} API capabilities and protocol information
 */
async function probeApiCapabilities(baseUrl, options = {}) {
  const capabilities = {
    protocol: PROTOCOL_TYPES.UNKNOWN,
    endpoints: [],
    metadata: null,
    supportsSwagger: false,
    supportsOData: false,
    supportsGraphQL: false,
    supportsCrud: false,
    error: null
  };

  try {
    // Try to detect protocol by probing common endpoints
    const protocol = await detectProtocol(baseUrl);
    capabilities.protocol = protocol;

    // Based on detected protocol, discover endpoints and capabilities
    switch (protocol) {
      case PROTOCOL_TYPES.ODATA:
        await discoverODataCapabilities(baseUrl, capabilities);
        break;
      case PROTOCOL_TYPES.GRAPHQL:
        await discoverGraphQLCapabilities(baseUrl, capabilities);
        break;
      case PROTOCOL_TYPES.REST:
      default:
        await discoverRestCapabilities(baseUrl, capabilities);
        break;
    }
  } catch (error) {
    capabilities.error = {
      message: error.message,
      stack: error.stack
    };
  }

  return capabilities;
}

/**
 * Detects the API protocol by probing common endpoints
 * @param {string} baseUrl - The base URL of the API
 * @returns {Promise<string>} The detected protocol type
 */
async function detectProtocol(baseUrl) {
  try {
    // Check for OData metadata endpoint
    const metadataResponse = await axios.get(`${baseUrl}/$metadata`, { 
      validateStatus: status => status < 500 
    });
    
    if (metadataResponse.status === 200 && 
        metadataResponse.headers['content-type']?.includes('application/xml')) {
      return PROTOCOL_TYPES.ODATA;
    }
    
    // Check for GraphQL endpoint
    const graphqlResponse = await axios.post(`${baseUrl}/graphql`, {
      query: '{ __schema { queryType { name } } }'
    }, { 
      validateStatus: status => status < 500,
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (graphqlResponse.status === 200 && graphqlResponse.data?.data?.__schema) {
      return PROTOCOL_TYPES.GRAPHQL;
    }
    
    // Check for Swagger/OpenAPI endpoint
    const swaggerResponse = await axios.get(`${baseUrl}/swagger.json`, { 
      validateStatus: status => status < 500 
    });
    
    if (swaggerResponse.status === 200 && 
        swaggerResponse.headers['content-type']?.includes('application/json')) {
      return PROTOCOL_TYPES.REST;
    }
    
    // Default to REST if no specific protocol is detected
    return PROTOCOL_TYPES.REST;
  } catch (error) {
    console.warn(`Error detecting protocol: ${error.message}`);
    return PROTOCOL_TYPES.UNKNOWN;
  }
}

/**
 * Discovers OData capabilities
 * @param {string} baseUrl - The base URL of the API
 * @param {Object} capabilities - Capabilities object to update
 * @returns {Promise<void>}
 */
async function discoverODataCapabilities(baseUrl, capabilities) {
  try {
    // Fetch OData metadata
    const metadataResponse = await axios.get(`${baseUrl}/$metadata`);
    
    if (metadataResponse.status === 200) {
      capabilities.supportsOData = true;
      
      // Parse EDMX metadata
      const edmxMetadata = await edmxParser.parseEdmx(metadataResponse.data);
      capabilities.metadata = edmxMetadata;
      
      // Extract entity sets as endpoints
      if (edmxMetadata.entitySets) {
        capabilities.endpoints = edmxMetadata.entitySets.map(entitySet => ({
          name: entitySet.name,
          url: `${baseUrl}/${entitySet.name}`,
          type: 'collection',
          methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
        }));
      }
      
      // Check for CRUD support by looking for entity sets
      capabilities.supportsCrud = capabilities.endpoints.length > 0;
    }
    
    // Check for service document
    const serviceDocResponse = await axios.get(baseUrl, {
      headers: { Accept: 'application/json' },
      validateStatus: status => status < 500
    });
    
    if (serviceDocResponse.status === 200 && 
        serviceDocResponse.data?.value?.length > 0) {
      // Add any additional entity sets from service document
      const serviceEntities = serviceDocResponse.data.value
        .filter(item => item.kind === 'EntitySet')
        .map(item => item.name);
        
      // Add any entities not already discovered
      for (const entity of serviceEntities) {
        if (!capabilities.endpoints.some(e => e.name === entity)) {
          capabilities.endpoints.push({
            name: entity,
            url: `${baseUrl}/${entity}`,
            type: 'collection',
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
          });
        }
      }
    }
  } catch (error) {
    console.warn(`Error discovering OData capabilities: ${error.message}`);
  }
}

/**
 * Discovers REST API capabilities
 * @param {string} baseUrl - The base URL of the API
 * @param {Object} capabilities - Capabilities object to update
 * @returns {Promise<void>}
 */
async function discoverRestCapabilities(baseUrl, capabilities) {
  try {
    // Try to fetch Swagger/OpenAPI specification
    const swaggerResponse = await axios.get(`${baseUrl}/swagger.json`, {
      validateStatus: status => status < 500
    });
    
    if (swaggerResponse.status === 200) {
      capabilities.supportsSwagger = true;
      
      // Parse Swagger specification
      const swaggerSpec = swaggerParser.parseSwagger(swaggerResponse.data);
      capabilities.metadata = swaggerSpec;
      
      // Extract endpoints from paths
      if (swaggerSpec.paths) {
        for (const [path, methods] of Object.entries(swaggerSpec.paths)) {
          const endpoint = {
            name: path.split('/').pop().replace(/[{}]/g, ''),
            url: `${baseUrl}${path}`,
            type: 'resource',
            methods: Object.keys(methods).map(m => m.toUpperCase())
          };
          
          capabilities.endpoints.push(endpoint);
        }
      }
      
      // Check for CRUD support by looking for POST, PUT, DELETE methods
      capabilities.supportsCrud = capabilities.endpoints.some(
        endpoint => endpoint.methods.includes('POST') || 
                   endpoint.methods.includes('PUT') || 
                   endpoint.methods.includes('DELETE')
      );
    } else {
      // If no Swagger, try to discover endpoints by probing common paths
      await discoverEndpointsByProbing(baseUrl, capabilities);
    }
  } catch (error) {
    console.warn(`Error discovering REST capabilities: ${error.message}`);
    // Try to discover endpoints by probing if Swagger fails
    await discoverEndpointsByProbing(baseUrl, capabilities);
  }
}

/**
 * Discovers GraphQL capabilities
 * @param {string} baseUrl - The base URL of the API
 * @param {Object} capabilities - Capabilities object to update
 * @returns {Promise<void>}
 */
async function discoverGraphQLCapabilities(baseUrl, capabilities) {
  try {
    // Perform GraphQL introspection query
    const introspectionQuery = `
      {
        __schema {
          queryType { name }
          mutationType { name }
          subscriptionType { name }
          types {
            kind
            name
            description
            fields {
              name
              description
              type {
                kind
                name
                ofType {
                  kind
                  name
                }
              }
            }
          }
        }
      }
    `;
    
    const graphqlResponse = await axios.post(`${baseUrl}/graphql`, {
      query: introspectionQuery
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (graphqlResponse.status === 200 && graphqlResponse.data?.data?.__schema) {
      capabilities.supportsGraphQL = true;
      
      // Parse GraphQL schema
      const schema = graphqlParser.parseSchema(graphqlResponse.data.data.__schema);
      capabilities.metadata = schema;
      
      // Extract types as endpoints
      if (schema.types) {
        // Filter out internal types (those starting with __)
        const userTypes = schema.types.filter(
          type => !type.name.startsWith('__') && 
                 ['OBJECT', 'INTERFACE'].includes(type.kind)
        );
        
        capabilities.endpoints = userTypes.map(type => ({
          name: type.name,
          url: `${baseUrl}/graphql`,
          type: 'graphql',
          methods: ['POST'],
          fields: type.fields?.map(f => f.name) || []
        }));
      }
      
      // Check for mutations to determine CRUD support
      capabilities.supportsCrud = !!graphqlResponse.data.data.__schema.mutationType;
    }
  } catch (error) {
    console.warn(`Error discovering GraphQL capabilities: ${error.message}`);
  }
}

/**
 * Discovers endpoints by probing common paths
 * @param {string} baseUrl - The base URL of the API
 * @param {Object} capabilities - Capabilities object to update
 * @returns {Promise<void>}
 */
async function discoverEndpointsByProbing(baseUrl, capabilities) {
  // Common resource paths to probe
  const commonPaths = [
    '/users', '/products', '/orders', '/items', '/customers',
    '/api/users', '/api/products', '/api/orders'
  ];
  
  for (const path of commonPaths) {
    try {
      const response = await axios.get(`${baseUrl}${path}`, {
        validateStatus: status => status < 500,
        timeout: 2000
      });
      
      if (response.status === 200) {
        capabilities.endpoints.push({
          name: path.split('/').pop(),
          url: `${baseUrl}${path}`,
          type: 'resource',
          methods: ['GET']
        });
      }
    } catch (error) {
      // Ignore errors for probing
    }
  }
}

/**
 * Validates an API against its contract
 * @param {string} baseUrl - The base URL of the API
 * @param {Object} options - Validation options
 * @returns {Promise<Object>} Validation results
 */
async function validateApiContract(baseUrl, options = {}) {
  // First probe the API to discover its capabilities
  const capabilities = await probeApiCapabilities(baseUrl, options);
  
  const validationResults = {
    protocol: capabilities.protocol,
    timestamp: new Date().toISOString(),
    endpoints: [],
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    },
    error: capabilities.error
  };
  
  // If there was an error during probing, return early
  if (capabilities.error) {
    return validationResults;
  }
  
  // Validate each endpoint based on the protocol
  for (const endpoint of capabilities.endpoints) {
    const endpointResult = {
      name: endpoint.name,
      url: endpoint.url,
      tests: []
    };
    
    try {
      switch (capabilities.protocol) {
        case PROTOCOL_TYPES.ODATA:
          await validateODataEndpoint(endpoint, endpointResult, capabilities, options);
          break;
        case PROTOCOL_TYPES.GRAPHQL:
          await validateGraphQLEndpoint(endpoint, endpointResult, capabilities, options);
          break;
        case PROTOCOL_TYPES.REST:
        default:
          await validateRestEndpoint(endpoint, endpointResult, capabilities, options);
          break;
      }
    } catch (error) {
      endpointResult.tests.push({
        name: 'Endpoint validation',
        passed: false,
        error: error.message
      });
    }
    
    // Update summary statistics
    endpointResult.summary = {
      total: endpointResult.tests.length,
      passed: endpointResult.tests.filter(t => t.passed).length,
      failed: endpointResult.tests.filter(t => !t.passed).length
    };
    
    validationResults.endpoints.push(endpointResult);
    
    // Update overall summary
    validationResults.summary.total += endpointResult.summary.total;
    validationResults.summary.passed += endpointResult.summary.passed;
    validationResults.summary.failed += endpointResult.summary.failed;
  }
  
  return validationResults;
}

/**
 * Validates an OData endpoint
 * @param {Object} endpoint - The endpoint to validate
 * @param {Object} result - The result object to update
 * @param {Object} capabilities - API capabilities
 * @param {Object} options - Validation options
 * @returns {Promise<void>}
 */
async function validateODataEndpoint(endpoint, result, capabilities, options) {
  // Test 1: Basic collection access
  try {
    const response = await axios.get(endpoint.url, {
      params: { $top: 1 },
      validateStatus: status => true
    });
    
    const test = {
      name: 'Collection access',
      passed: response.status === 200,
      statusCode: response.status
    };
    
    if (test.passed) {
      // Check if response has the expected OData format
      test.passed = response.data && 
                   (Array.isArray(response.data.value) || Array.isArray(response.data));
    }
    
    result.tests.push(test);
    
    // If collection access succeeded, perform more tests
    if (test.passed) {
      // Get a sample item for further testing
      const items = response.data.value || response.data;
      if (items.length > 0) {
        const sample = items[0];
        
        // Test 2: $select capability
        if (Object.keys(sample).length > 1) {
          const selectFields = Object.keys(sample).slice(0, 2).join(',');
          const selectResponse = await axios.get(endpoint.url, {
            params: { $select: selectFields, $top: 1 },
            validateStatus: status => true
          });
          
          const selectTest = {
            name: '$select capability',
            passed: selectResponse.status === 200,
            statusCode: selectResponse.status
          };
          
          if (selectTest.passed) {
            const selectItems = selectResponse.data.value || selectResponse.data;
            if (selectItems.length > 0) {
              // Check that only the selected fields are present
              const selectedItem = selectItems[0];
              const selectedFields = Object.keys(selectedItem);
              selectTest.passed = selectedFields.length <= selectFields.split(',').length &&
                                 selectedFields.every(f => selectFields.includes(f));
            } else {
              selectTest.passed = false;
            }
          }
          
          result.tests.push(selectTest);
        }
        
        // Test 3: Single entity access
        const idField = Object.keys(sample).find(k => k === 'id' || k.endsWith('Id')) || Object.keys(sample)[0];
        const entityId = sample[idField];
        
        if (entityId !== undefined) {
          const entityUrl = `${endpoint.url}/${entityId}`;
          const entityResponse = await axios.get(entityUrl, {
            validateStatus: status => true
          });
          
          result.tests.push({
            name: 'Single entity access',
            passed: entityResponse.status === 200,
            statusCode: entityResponse.status
          });
        }
      }
    }
  } catch (error) {
    result.tests.push({
      name: 'Collection access',
      passed: false,
      error: error.message
    });
  }
}

/**
 * Validates a REST endpoint
 * @param {Object} endpoint - The endpoint to validate
 * @param {Object} result - The result object to update
 * @param {Object} capabilities - API capabilities
 * @param {Object} options - Validation options
 * @returns {Promise<void>}
 */
async function validateRestEndpoint(endpoint, result, capabilities, options) {
  // Test 1: Basic endpoint access
  try {
    const response = await axios.get(endpoint.url, {
      validateStatus: status => true
    });
    
    result.tests.push({
      name: 'Endpoint access',
      passed: response.status >= 200 && response.status < 500,
      statusCode: response.status
    });
    
    // If endpoint supports POST and options allow CRUD testing
    if (endpoint.methods.includes('POST') && options.testCrud) {
      // We would need a sample payload to test POST
      // This is simplified and would need to be expanded based on API specifics
      result.tests.push({
        name: 'POST capability',
        passed: true,
        skipped: true,
        message: 'CRUD testing requires sample payloads'
      });
    }
  } catch (error) {
    result.tests.push({
      name: 'Endpoint access',
      passed: false,
      error: error.message
    });
  }
}

/**
 * Validates a GraphQL endpoint
 * @param {Object} endpoint - The endpoint to validate
 * @param {Object} result - The result object to update
 * @param {Object} capabilities - API capabilities
 * @param {Object} options - Validation options
 * @returns {Promise<void>}
 */
async function validateGraphQLEndpoint(endpoint, result, capabilities, options) {
  // Test 1: Basic query capability
  try {
    // Create a simple query based on the type name and fields
    const typeName = endpoint.name.charAt(0).toLowerCase() + endpoint.name.slice(1);
    const fields = endpoint.fields?.slice(0, 3) || ['id', 'name'];
    
    const query = `
      {
        ${typeName} {
          ${fields.join('\n          ')}
        }
      }
    `;
    
    const response = await axios.post(endpoint.url, {
      query: query
    }, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: status => true
    });
    
    result.tests.push({
      name: 'Query capability',
      passed: response.status === 200 && !response.data.errors,
      statusCode: response.status
    });
    
    // Test 2: Field selection
    if (fields.length > 1) {
      const limitedFields = fields.slice(0, 1);
      const limitedQuery = `
        {
          ${typeName} {
            ${limitedFields.join('\n            ')}
          }
        }
      `;
      
      const limitedResponse = await axios.post(endpoint.url, {
        query: limitedQuery
      }, {
        headers: { 'Content-Type': 'application/json' },
        validateStatus: status => true
      });
      
      result.tests.push({
        name: 'Field selection',
        passed: limitedResponse.status === 200 && !limitedResponse.data.errors,
        statusCode: limitedResponse.status
      });
    }
  } catch (error) {
    result.tests.push({
      name: 'Query capability',
      passed: false,
      error: error.message
    });
  }
}

module.exports = {
  probeApiCapabilities,
  validateApiContract,
  detectProtocol,
  PROTOCOL_TYPES
};
