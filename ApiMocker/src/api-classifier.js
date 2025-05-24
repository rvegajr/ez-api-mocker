/**
 * API Classifier module
 * Detects the type of API (REST, OData, GraphQL) and authentication requirements
 * from a Swagger/OpenAPI specification
 */

/**
 * Classifies an API based on its Swagger/OpenAPI specification
 * @param {Object} swaggerSpec - The parsed Swagger/OpenAPI spec
 * @returns {Object} Classification results including API type and auth requirements
 */
function classifyApi(swaggerSpec) {
  // Handle undefined or empty spec
  if (!swaggerSpec || Object.keys(swaggerSpec).length === 0) {
    return {
      apiType: 'unknown',
      isOData: false,
      isGraphQL: false,
      requiresAuth: false
    };
  }
  
  const result = {
    apiType: 'rest', // Default to REST
    isOData: false,
    isGraphQL: false,
    requiresAuth: false,
    authType: null
  };
  
  // Detect OData API
  if (detectOData(swaggerSpec)) {
    result.isOData = true;
    result.apiType = 'odata';
  }
  
  // Detect GraphQL API
  if (detectGraphQL(swaggerSpec)) {
    result.isGraphQL = true;
    result.apiType = 'graphql';
  }
  
  // Detect authentication requirements
  const authInfo = detectAuth(swaggerSpec);
  if (authInfo.requiresAuth) {
    result.requiresAuth = true;
    result.authType = authInfo.type;
  }
  
  return result;
}

/**
 * Detects if an API is OData based on common indicators
 * @param {Object} swaggerSpec - The Swagger/OpenAPI spec
 * @returns {boolean} True if the API appears to be OData
 */
function detectOData(swaggerSpec) {
  // Check paths for OData endpoints
  if (swaggerSpec.paths) {
    const paths = Object.keys(swaggerSpec.paths);
    
    // Look for OData-specific paths
    for (const path of paths) {
      if (
        path.includes('/odata/') || 
        path.includes('/$metadata') ||
        path.includes('/$count') ||
        path.includes('/$value')
      ) {
        return true;
      }
    }
  }
  
  // Check for OData in definitions or schema components
  if (swaggerSpec.definitions) {
    const defNames = Object.keys(swaggerSpec.definitions);
    for (const name of defNames) {
      if (name.includes('OData') || name.includes('Edm.')) {
        return true;
      }
    }
  }
  
  // Check for OData in schema components (OpenAPI 3)
  if (swaggerSpec.components && swaggerSpec.components.schemas) {
    const schemaNames = Object.keys(swaggerSpec.components.schemas);
    for (const name of schemaNames) {
      if (name.includes('OData') || name.includes('Edm.')) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Detects if an API is GraphQL based on common indicators
 * @param {Object} swaggerSpec - The Swagger/OpenAPI spec
 * @returns {boolean} True if the API appears to be GraphQL
 */
function detectGraphQL(swaggerSpec) {
  // Check paths for GraphQL endpoints
  if (swaggerSpec.paths) {
    const paths = Object.keys(swaggerSpec.paths);
    
    // Look for GraphQL-specific paths
    for (const path of paths) {
      if (path.includes('/graphql')) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Detects authentication requirements from the Swagger/OpenAPI spec
 * @param {Object} swaggerSpec - The Swagger/OpenAPI spec
 * @returns {Object} Authentication information
 */
function detectAuth(swaggerSpec) {
  const result = {
    requiresAuth: false,
    type: null
  };
  
  // Check security definitions (Swagger 2.0)
  if (swaggerSpec.securityDefinitions) {
    const securityDefs = swaggerSpec.securityDefinitions;
    
    // Check if API requires auth
    if (swaggerSpec.security && swaggerSpec.security.length > 0) {
      result.requiresAuth = true;
      
      // Determine auth type
      for (const [name, def] of Object.entries(securityDefs)) {
        if (def.type === 'oauth2') {
          result.type = 'oauth2';
          break;
        } else if (def.type === 'apiKey' && def.name === 'Authorization') {
          result.type = 'bearer';
          break;
        } else if (def.type === 'apiKey') {
          result.type = 'apiKey';
          break;
        } else if (def.type === 'http' && def.scheme === 'bearer') {
          result.type = 'bearer';
          break;
        } else if (def.type === 'http' && def.scheme === 'basic') {
          result.type = 'basic';
          break;
        }
      }
    }
  }
  
  // Check security schemes (OpenAPI 3.0)
  if (swaggerSpec.components && swaggerSpec.components.securitySchemes) {
    const securitySchemes = swaggerSpec.components.securitySchemes;
    
    // Check if API requires auth
    if (swaggerSpec.security && swaggerSpec.security.length > 0) {
      result.requiresAuth = true;
      
      // Determine auth type
      for (const [name, scheme] of Object.entries(securitySchemes)) {
        if (scheme.type === 'oauth2') {
          result.type = 'oauth2';
          break;
        } else if (scheme.type === 'apiKey' && scheme.name === 'Authorization') {
          result.type = 'bearer';
          break;
        } else if (scheme.type === 'apiKey') {
          result.type = 'apiKey';
          break;
        } else if (scheme.type === 'http' && scheme.scheme === 'bearer') {
          result.type = 'bearer';
          break;
        } else if (scheme.type === 'http' && scheme.scheme === 'basic') {
          result.type = 'basic';
          break;
        }
      }
    }
  }
  
  return result;
}

module.exports = {
  classifyApi
};
