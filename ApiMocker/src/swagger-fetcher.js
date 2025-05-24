const fs = require('fs');
const path = require('path');
const axios = require('axios');
const SwaggerParser = require('@apidevtools/swagger-parser');

// Common paths where Swagger/OpenAPI specs might be located
const COMMON_PATHS = [
  '/swagger/v1/swagger.json',
  '/swagger.json',
  '/api-docs/swagger.json',
  '/api-docs',
  '/openapi.json',
  '/api/swagger.json',
  '/docs/swagger.json'
];

/**
 * Discovers and fetches Swagger/OpenAPI specification
 * @param {string} baseUrl - Base URL of the API
 * @returns {Promise<object>} - Parsed Swagger/OpenAPI specification
 */
async function fetchSwagger(baseUrl, apiName = 'default', options = {}) {
  // Normalize base URL (remove trailing slash)
  const normalizedUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  
  // If a specific Swagger URL is provided in options, try that first
  if (options.swaggerUrl) {
    try {
      console.log(`Trying specified Swagger URL: ${options.swaggerUrl}...`);
      
      const response = await axios.get(options.swaggerUrl, {
        timeout: options.timeout || 5000,
        headers: {
          'Accept': 'application/json',
          ...(options.authToken ? { 'Authorization': options.authToken } : {})
        }
      });
      
      // If we get a successful response, try to parse it as Swagger/OpenAPI
      if (response.status === 200 && response.data) {
        // Validate that this is actually a Swagger/OpenAPI spec
        if (response.data.swagger || response.data.openapi) {
          // Save the raw Swagger spec to API-specific directory
          const apiDir = path.resolve(options.output || './data', apiName);
          if (!fs.existsSync(apiDir)) {
            fs.mkdirSync(apiDir, { recursive: true });
          }
          
          fs.writeFileSync(
            path.resolve(apiDir, 'swagger.json'), 
            JSON.stringify(response.data, null, 2)
          );
          
          console.log(`✅ Found and saved Swagger/OpenAPI spec from specified URL: ${options.swaggerUrl}`);
          return response.data;
        }
      }
    } catch (error) {
      console.log(`Could not fetch Swagger from specified URL ${options.swaggerUrl}: ${error.message}`);
      // Continue to try other methods
    }
  }
  
  // First, try the URL directly if it looks like a Swagger file
  if (baseUrl.endsWith('.json') || baseUrl.endsWith('.yaml') || baseUrl.endsWith('.yml')) {
    try {
      console.log(`Trying direct URL: ${baseUrl}...`);
      
      const response = await axios.get(baseUrl, {
        timeout: options.timeout || 5000,
        headers: {
          'Accept': 'application/json',
          ...(options.authToken ? { 'Authorization': options.authToken } : {})
        }
      });
      
      // If we get a successful response, try to parse it as Swagger/OpenAPI
      if (response.status === 200 && response.data) {
        // Validate that this is actually a Swagger/OpenAPI spec
        if (response.data.swagger || response.data.openapi) {
          // Save the raw Swagger spec to API-specific directory
          const apiDir = path.resolve(options.output || './data', apiName);
          if (!fs.existsSync(apiDir)) {
            fs.mkdirSync(apiDir, { recursive: true });
          }
          
          fs.writeFileSync(
            path.resolve(apiDir, 'swagger.json'), 
            JSON.stringify(response.data, null, 2)
          );
          
          console.log(`✅ Found and saved Swagger/OpenAPI spec at ${baseUrl}`);
          return response.data;
        }
      }
    } catch (error) {
      console.log(`Could not fetch Swagger directly from ${baseUrl}: ${error.message}`);
      // Continue to try common paths
    }
  }
  
  // If direct URL didn't work, try to discover Swagger at common paths
  for (const path of COMMON_PATHS) {
    try {
      const swaggerUrl = `${normalizedUrl}${path}`;
      console.log(`Trying ${swaggerUrl}...`);
      
      const response = await axios.get(swaggerUrl, {
        timeout: options.timeout || 5000,
        headers: {
          'Accept': 'application/json',
          ...(options.authToken ? { 'Authorization': options.authToken } : {})
        }
      });
      
      // If we get a successful response, try to parse it as Swagger/OpenAPI
      if (response.status === 200 && response.data) {
        // Save the raw Swagger spec to API-specific directory
        const apiDir = path.resolve('./data', apiName);
        if (!fs.existsSync(apiDir)) {
          fs.mkdirSync(apiDir, { recursive: true });
        }
        
        fs.writeFileSync(
          path.resolve(apiDir, 'swagger.json'), 
          JSON.stringify(response.data, null, 2)
        );
        
        console.log(`Saved Swagger spec to ${apiDir}/swagger.json`);
        
        // Parse and validate the Swagger spec
        try {
          return await SwaggerParser.parse(response.data);
        } catch (parseError) {
          console.warn(`Found spec at ${swaggerUrl} but failed to parse: ${parseError.message}`);
          // If parse fails but we have the data, return it anyway
          return response.data;
        }
      }
    } catch (error) {
      // Silently continue to the next path
    }
  }
  
  throw new Error('Could not discover Swagger/OpenAPI specification. Please provide the direct URL.');
}

module.exports = {
  fetchSwagger
};
