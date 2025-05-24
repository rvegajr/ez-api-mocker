/**
 * Swagger Parser Module
 * 
 * Parses Swagger/OpenAPI specifications to extract endpoints, operations, and schemas
 */

/**
 * Parses a Swagger/OpenAPI specification
 * @param {Object} swaggerSpec - The Swagger/OpenAPI specification object
 * @returns {Object} Parsed API information
 */
function parseSwagger(swaggerSpec) {
  try {
    // Initialize result object
    const result = {
      info: extractInfo(swaggerSpec),
      paths: [],
      schemas: [],
      securitySchemes: []
    };
    
    // Extract paths and operations
    if (swaggerSpec.paths) {
      for (const [path, pathItem] of Object.entries(swaggerSpec.paths)) {
        const pathInfo = {
          path: path,
          operations: []
        };
        
        // Extract operations for this path
        for (const [method, operation] of Object.entries(pathItem)) {
          if (['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method)) {
            pathInfo.operations.push({
              method: method.toUpperCase(),
              operationId: operation.operationId || `${method}${path.replace(/[^a-zA-Z0-9]/g, '')}`,
              summary: operation.summary || '',
              description: operation.description || '',
              parameters: extractParameters(operation.parameters),
              requestBody: extractRequestBody(operation.requestBody),
              responses: extractResponses(operation.responses),
              tags: operation.tags || []
            });
          }
        }
        
        result.paths.push(pathInfo);
      }
    }
    
    // Extract schemas
    if (swaggerSpec.components && swaggerSpec.components.schemas) {
      for (const [name, schema] of Object.entries(swaggerSpec.components.schemas)) {
        result.schemas.push({
          name: name,
          properties: extractSchemaProperties(schema),
          type: schema.type || 'object',
          required: schema.required || []
        });
      }
    } else if (swaggerSpec.definitions) {
      // Handle Swagger 2.0
      for (const [name, schema] of Object.entries(swaggerSpec.definitions)) {
        result.schemas.push({
          name: name,
          properties: extractSchemaProperties(schema),
          type: schema.type || 'object',
          required: schema.required || []
        });
      }
    }
    
    // Extract security schemes
    if (swaggerSpec.components && swaggerSpec.components.securitySchemes) {
      for (const [name, scheme] of Object.entries(swaggerSpec.components.securitySchemes)) {
        result.securitySchemes.push({
          name: name,
          type: scheme.type,
          description: scheme.description,
          scheme: scheme.scheme,
          bearerFormat: scheme.bearerFormat,
          flows: scheme.flows
        });
      }
    } else if (swaggerSpec.securityDefinitions) {
      // Handle Swagger 2.0
      for (const [name, scheme] of Object.entries(swaggerSpec.securityDefinitions)) {
        result.securitySchemes.push({
          name: name,
          type: scheme.type,
          description: scheme.description,
          name: scheme.name,
          in: scheme.in,
          flow: scheme.flow,
          authorizationUrl: scheme.authorizationUrl,
          tokenUrl: scheme.tokenUrl,
          scopes: scheme.scopes
        });
      }
    }
    
    return result;
  } catch (error) {
    throw new Error(`Error parsing Swagger: ${error.message}`);
  }
}

/**
 * Extracts API info from Swagger spec
 * @param {Object} spec - The Swagger/OpenAPI specification
 * @returns {Object} API info
 */
function extractInfo(spec) {
  const info = {
    title: spec.info?.title || 'Unknown API',
    version: spec.info?.version || '1.0.0',
    description: spec.info?.description || '',
    specVersion: spec.openapi || spec.swagger || 'unknown'
  };
  
  if (spec.servers && spec.servers.length > 0) {
    info.baseUrl = spec.servers[0].url;
  } else if (spec.host) {
    // Swagger 2.0
    const scheme = (spec.schemes && spec.schemes[0]) || 'https';
    info.baseUrl = `${scheme}://${spec.host}${spec.basePath || ''}`;
  }
  
  return info;
}

/**
 * Extracts parameters from operation
 * @param {Array} parameters - Operation parameters
 * @returns {Array} Extracted parameters
 */
function extractParameters(parameters) {
  if (!parameters) {
    return [];
  }
  
  return parameters.map(param => ({
    name: param.name,
    in: param.in,
    description: param.description || '',
    required: param.required || false,
    schema: param.schema ? {
      type: param.schema.type,
      format: param.schema.format,
      enum: param.schema.enum
    } : {
      type: param.type,
      format: param.format,
      enum: param.enum
    }
  }));
}

/**
 * Extracts request body from operation
 * @param {Object} requestBody - Operation request body
 * @returns {Object} Extracted request body
 */
function extractRequestBody(requestBody) {
  if (!requestBody) {
    return null;
  }
  
  const result = {
    description: requestBody.description || '',
    required: requestBody.required || false,
    content: {}
  };
  
  if (requestBody.content) {
    for (const [mediaType, content] of Object.entries(requestBody.content)) {
      result.content[mediaType] = {
        schema: content.schema ? {
          type: content.schema.type,
          properties: extractSchemaProperties(content.schema),
          required: content.schema.required || []
        } : null
      };
    }
  }
  
  return result;
}

/**
 * Extracts responses from operation
 * @param {Object} responses - Operation responses
 * @returns {Object} Extracted responses
 */
function extractResponses(responses) {
  if (!responses) {
    return {};
  }
  
  const result = {};
  
  for (const [statusCode, response] of Object.entries(responses)) {
    result[statusCode] = {
      description: response.description || '',
      content: {}
    };
    
    if (response.content) {
      for (const [mediaType, content] of Object.entries(response.content)) {
        result[statusCode].content[mediaType] = {
          schema: content.schema ? {
            type: content.schema.type,
            properties: extractSchemaProperties(content.schema),
            items: content.schema.items ? {
              type: content.schema.items.type,
              properties: extractSchemaProperties(content.schema.items)
            } : null
          } : null
        };
      }
    } else if (response.schema) {
      // Swagger 2.0
      result[statusCode].content['application/json'] = {
        schema: {
          type: response.schema.type,
          properties: extractSchemaProperties(response.schema),
          items: response.schema.items ? {
            type: response.schema.items.type,
            properties: extractSchemaProperties(response.schema.items)
          } : null
        }
      };
    }
  }
  
  return result;
}

/**
 * Extracts properties from schema
 * @param {Object} schema - Schema object
 * @returns {Object} Extracted properties
 */
function extractSchemaProperties(schema) {
  if (!schema || !schema.properties) {
    return {};
  }
  
  const result = {};
  
  for (const [name, property] of Object.entries(schema.properties)) {
    result[name] = {
      type: property.type || 'string',
      format: property.format,
      description: property.description || '',
      enum: property.enum,
      default: property.default,
      example: property.example,
      nullable: property.nullable || false
    };
    
    // Handle nested objects
    if (property.type === 'object' && property.properties) {
      result[name].properties = extractSchemaProperties(property);
    }
    
    // Handle arrays
    if (property.type === 'array' && property.items) {
      result[name].items = {
        type: property.items.type,
        format: property.items.format,
        properties: property.items.properties ? extractSchemaProperties(property.items) : null
      };
    }
    
    // Handle references
    if (property.$ref) {
      result[name].ref = property.$ref.split('/').pop();
    }
  }
  
  return result;
}

module.exports = {
  parseSwagger
};
