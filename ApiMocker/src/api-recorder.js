const fs = require('fs');
const path = require('path');
const axios = require('axios');
const getRequestHandler = require('./get-request-handler');

/**
 * Records responses from API endpoints defined in Swagger
 * @param {string} baseUrl - Base URL of the API
 * @param {string} apiName - Name of the API (used for directory structure)
 * @param {object} swaggerSpec - Parsed Swagger/OpenAPI specification
 * @param {Array} endpoints - List of endpoints to record
 * @param {object} options - Recording options
 * @returns {Promise<void>}
 */
async function recordResponses(baseUrl, apiName, swaggerSpec, endpoints, options) {
  // Normalize base URL (remove trailing slash)
  const normalizedUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  
  // Setup HTTP client with auth if provided
  const client = axios.create({
    baseURL: normalizedUrl,
    timeout: options.timeout || 10000,
    headers: options.authToken ? {
      'Authorization': options.authToken
    } : {}
  });
  
  // Create API-specific output directory
  const apiDir = path.resolve('./data', apiName);
  const outputDir = path.resolve(apiDir, 'responses');
  if (!fs.existsSync(apiDir)) {
    fs.mkdirSync(apiDir, { recursive: true });
  }
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Save metadata about the recording
  const metadata = {
    baseUrl: normalizedUrl,
    recordedAt: new Date().toISOString(),
    endpointCount: 0,
    successCount: 0,
    errorCount: 0,
    endpoints: []
  };
  
  // Use the provided endpoints list
  metadata.endpointCount = endpoints.length;
  console.log(`Recording ${endpoints.length} endpoints for API: ${apiName}`);
  
  // Record responses for each endpoint
  for (const endpoint of endpoints) {
    try {
      // For OData endpoints, add $top parameter to limit results
      let url = endpoint.path;
      if (endpoint.isOData || url.includes('odata')) {
        url += url.includes('?') ? '&$top=20' : '?$top=20';
      }
      
      console.log(`Recording: ${endpoint.method.toUpperCase()} ${url}`);
      
      // Use the GET request handler for more specialized handling
      const result = await getRequestHandler.handleGetRequest(
        normalizedUrl,
        endpoint,
        client,
        outputDir
      );
      
      // If the request was not successful, throw the error to be caught by the catch block
      if (!result.success) {
        throw new Error(result.error || 'Request failed');
      }
      
      // For OData endpoints, also record responses with common query options
      if (endpoint.isOData && endpoint.odataQueryOptions) {
        await recordODataQueryOptions(client, endpoint, outputDir);
      }
      
      // Update metadata
      metadata.successCount++;
      metadata.endpoints.push({
        path: endpoint.path,
        method: endpoint.method,
        operationId: endpoint.operationId,
        status: 'success',
        statusCode: result.statusCode || 200,
        isOData: endpoint.isOData || false
      });
      
      console.log(`✅ Recorded ${endpoint.path}`);
    } catch (error) {
      console.error(`❌ Failed to record ${endpoint.path}: ${error.message}`);
      
      // Save error response for debugging
      const filename = endpoint.operationId
        .replace(/[^a-zA-Z0-9]/g, '_')
        .toLowerCase();
      
      // Create a structured error response
      const errorResponse = {
        error: true,
        message: error.message,
        statusCode: error.response?.status,
        path: endpoint.path,
        method: endpoint.method,
        timestamp: new Date().toISOString()
      };
      
      // Save the error data
      fs.writeFileSync(
        path.join(outputDir, `${filename}.json`),
        JSON.stringify(errorResponse, null, 2)
      );
      
      // Update metadata
      metadata.errorCount++;
      metadata.endpoints.push({
        path: endpoint.path,
        method: endpoint.method,
        operationId: endpoint.operationId,
        status: 'error',
        statusCode: error.response?.status,
        error: error.message,
        isOData: endpoint.isOData || false
      });
    }
  }
  
  // Save metadata
  fs.writeFileSync(
    path.join(outputDir, '_metadata.json'),
    JSON.stringify(metadata, null, 2)
  );
  
  // Save endpoints map for the mock server
  const endpointsMap = {};
  for (const endpoint of metadata.endpoints) {
    if (endpoint.status === 'success') {
      endpointsMap[endpoint.path] = {
        operationId: endpoint.operationId,
        method: endpoint.method,
        responseFile: `${endpoint.operationId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}.json`
      };
    }
  }
  
  fs.writeFileSync(
    path.join(outputDir, '_endpoints.json'),
    JSON.stringify(endpointsMap, null, 2)
  );
  
  console.log(`\nRecording complete: ${metadata.successCount} successful, ${metadata.errorCount} failed`);
}

/**
 * Records OData-specific query option responses
 * @param {Object} client - Axios client instance
 * @param {Object} endpoint - Endpoint information
 * @param {string} outputDir - Output directory for responses
 */
async function recordODataQueryOptions(client, endpoint, outputDir) {
  // Common OData query options to test
  if (endpoint.odataQueryOptions?.includes('$select')) {
    try {
      // Create a basic $select query
      const selectUrl = `${endpoint.path}?$select=id,name`;
      console.log(`Recording OData $select: ${selectUrl}`);
      
      const response = await client.get(selectUrl);
      
      // Create a filename for the select query
      const filename = `${endpoint.operationId}_select_id_name`
        .replace(/[^a-zA-Z0-9]/g, '_')
        .toLowerCase();
      
      // Save the response
      fs.writeFileSync(
        path.join(outputDir, `${filename}.json`),
        JSON.stringify(response.data, null, 2)
      );
    } catch (error) {
      console.error(`Failed to record OData $select for ${endpoint.path}: ${error.message}`);
    }
  }
  
  // Add more OData query options as needed (expand, filter, etc.)
  if (endpoint.odataQueryOptions?.includes('$expand')) {
    // Implementation for $expand
  }
}

module.exports = {
  recordResponses
};
