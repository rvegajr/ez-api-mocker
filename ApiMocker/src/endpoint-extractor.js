/**
 * Endpoint Extractor Module
 * Extracts endpoints, parameters, and response schemas from Swagger/OpenAPI specifications
 */

/**
 * Extracts all endpoints from a Swagger/OpenAPI specification
 * @param {Object} swaggerSpec - The parsed Swagger/OpenAPI spec
 * @param {Object} options - Additional options (e.g., isOData flag)
 * @returns {Array} Array of extracted endpoints
 */
function extractEndpoints(swaggerSpec, options = {}) {
  const endpoints = [];
  const stats = {
    get: 0,
    post: 0,
    put: 0,
    delete: 0,
    patch: 0,
    total: 0
  };
  
  // Handle undefined or empty spec
  if (!swaggerSpec || !swaggerSpec.paths) {
    console.warn('No paths found in Swagger spec');
    return endpoints;
  }
  
  // Process each path
  for (const [path, pathItem] of Object.entries(swaggerSpec.paths)) {
    // Process each HTTP method for this path
    for (const [method, operation] of Object.entries(pathItem)) {
      // Skip non-HTTP methods (like parameters at path level)
      if (!['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method)) {
        continue;
      }
      
      // Create endpoint object
      const endpoint = {
        path,
        method,
        operationId: operation.operationId || `${method}_${path.replace(/[^\w]/g, '_')}`,
        parameters: extractParameters(operation.parameters),
        responses: extractResponses(operation.responses, swaggerSpec),
        isOData: options.isOData || path.includes('/odata/')
      };
      
      // Extract response schema if available
      endpoint.responseSchema = extractResponseSchema(operation, swaggerSpec);
      
      // Add OData-specific information if relevant
      if (endpoint.isOData) {
        endpoint.odataQueryOptions = extractODataQueryOptions(endpoint.parameters);
      }
      
      // Add to results
      endpoints.push(endpoint);
      
      // Update statistics
      stats[method] = (stats[method] || 0) + 1;
      stats.total++;
    }
  }
  
  console.log(`Extracted ${endpoints.length} endpoints from Swagger spec:`);
  console.log(`  GET: ${stats.get}, POST: ${stats.post}, PUT: ${stats.put}, DELETE: ${stats.delete}, PATCH: ${stats.patch}`);
  
  return endpoints;
}

/**
 * Extracts parameters from an operation
 * @param {Array} parameters - The parameters array from the Swagger operation
 * @returns {Array} Extracted parameters
 */
function extractParameters(parameters) {
  if (!parameters) {
    return [];
  }
  
  return parameters.map(param => {
    // Create a simplified parameter object
    return {
      name: param.name,
      in: param.in,
      required: param.required || false,
      type: param.type || (param.schema ? param.schema.type : 'string'),
      default: param.default,
      description: param.description
    };
  });
}

/**
 * Extracts responses from an operation
 * @param {Object} responses - The responses object from the Swagger operation
 * @param {Object} swaggerSpec - The full Swagger spec for resolving references
 * @returns {Object} Extracted responses
 */
function extractResponses(responses, swaggerSpec) {
  const result = {};
  
  if (!responses) {
    return result;
  }
  
  for (const [code, response] of Object.entries(responses)) {
    result[code] = {
      description: response.description
    };
    
    // Handle Swagger 2.0 response schema
    if (response.schema) {
      result[code].schema = resolveSchema(response.schema, swaggerSpec);
    }
    
    // Handle OpenAPI 3.0 response content
    if (response.content) {
      result[code].content = {};
      
      for (const [mediaType, mediaTypeObject] of Object.entries(response.content)) {
        if (mediaTypeObject.schema) {
          result[code].content[mediaType] = {
            schema: resolveSchema(mediaTypeObject.schema, swaggerSpec)
          };
        }
      }
    }
  }
  
  return result;
}

/**
 * Extracts the response schema from an operation
 * @param {Object} operation - The operation object
 * @param {Object} swaggerSpec - The full Swagger spec
 * @returns {Object} The response schema if available
 */
function extractResponseSchema(operation, swaggerSpec) {
  if (!operation.responses) {
    return null;
  }
  
  // Try to get schema from 200 response first
  if (operation.responses['200']) {
    // Swagger 2.0
    if (operation.responses['200'].schema) {
      return resolveSchema(operation.responses['200'].schema, swaggerSpec);
    }
    
    // OpenAPI 3.0
    if (operation.responses['200'].content && operation.responses['200'].content['application/json']) {
      return resolveSchema(operation.responses['200'].content['application/json'].schema, swaggerSpec);
    }
  }
  
  // Try other success codes
  for (const code of ['201', '202', '203', '204']) {
    if (operation.responses[code]) {
      // Swagger 2.0
      if (operation.responses[code].schema) {
        return resolveSchema(operation.responses[code].schema, swaggerSpec);
      }
      
      // OpenAPI 3.0
      if (operation.responses[code].content && operation.responses[code].content['application/json']) {
        return resolveSchema(operation.responses[code].content['application/json'].schema, swaggerSpec);
      }
    }
  }
  
  return null;
}

/**
 * Resolves schema references in the Swagger spec
 * @param {Object} schema - The schema object that might contain references
 * @param {Object} swaggerSpec - The full Swagger spec
 * @returns {Object} The resolved schema
 */
function resolveSchema(schema, swaggerSpec) {
  if (!schema) {
    return null;
  }
  
  // Handle schema references
  if (schema.$ref) {
    const ref = schema.$ref;
    
    // Extract reference path parts
    const refParts = ref.split('/').slice(1);
    
    // Navigate through the swagger spec to find the referenced object
    let resolved = swaggerSpec;
    for (const part of refParts) {
      if (!resolved[part]) {
        return schema; // Can't resolve reference
      }
      resolved = resolved[part];
    }
    
    return resolved;
  }
  
  // Handle array type with items that might have references
  if (schema.type === 'array' && schema.items) {
    return {
      ...schema,
      items: resolveSchema(schema.items, swaggerSpec)
    };
  }
  
  // Handle object type with properties that might have references
  if (schema.type === 'object' && schema.properties) {
    const resolvedProperties = {};
    
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      resolvedProperties[propName] = resolveSchema(propSchema, swaggerSpec);
    }
    
    return {
      ...schema,
      properties: resolvedProperties
    };
  }
  
  return schema;
}

/**
 * Extracts OData query options from parameters
 * @param {Array} parameters - The parameters array
 * @returns {Array} OData query options
 */
function extractODataQueryOptions(parameters) {
  const odataOptions = [];
  
  if (!parameters) {
    return odataOptions;
  }
  
  // List of common OData query options
  const ODATA_QUERY_OPTIONS = [
    '$select', '$expand', '$filter', '$orderby', 
    '$top', '$skip', '$count', '$search', '$format'
  ];
  
  // Extract OData query parameters
  for (const param of parameters) {
    if (param.in === 'query' && ODATA_QUERY_OPTIONS.includes(param.name)) {
      odataOptions.push(param.name);
    }
  }
  
  return odataOptions;
}

module.exports = {
  extractEndpoints
};
