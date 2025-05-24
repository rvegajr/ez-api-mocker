const fs = require('fs');
const path = require('path');

/**
 * Handles GET requests to endpoints
 * @param {string} baseUrl - Base URL of the API
 * @param {Object} endpoint - Endpoint information
 * @param {Object} client - Axios client instance
 * @param {string} outputDir - Directory to save responses
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Result with success status and data
 */
async function handleGetRequest(baseUrl, endpoint, client, outputDir, options = {}) {
  const result = {
    success: false,
    statusCode: null,
    data: null,
    headers: null,
    error: null,
    isBinary: false
  };
  
  try {
    // Process path parameters if present
    let url = endpoint.path;
    if (options.pathParams && endpoint.parameters) {
      const pathParams = endpoint.parameters.filter(p => p.in === 'path');
      
      for (const param of pathParams) {
        if (options.pathParams[param.name]) {
          url = url.replace(`{${param.name}}`, options.pathParams[param.name]);
        }
      }
    }
    
    // Process query parameters
    const queryParams = {};
    
    // Add default values for required query parameters
    if (endpoint.parameters) {
      const queryParamsFromSpec = endpoint.parameters.filter(p => p.in === 'query');
      
      for (const param of queryParamsFromSpec) {
        // If parameter has a default value, use it
        if (param.default !== undefined) {
          queryParams[param.name] = param.default;
        }
      }
    }
    
    // Override with provided query parameters
    if (options.queryParams) {
      Object.assign(queryParams, options.queryParams);
    }
    
    // Execute the request
    console.log(`Making GET request to: ${url}`);
    
    // Build request config
    const requestConfig = {};
    
    // If we have query parameters, add them to the request
    if (Object.keys(queryParams).length > 0) {
      requestConfig.params = queryParams;
    }
    
    // Add responseType based on the 'produces' field
    if (endpoint.produces && endpoint.produces.includes('application/octet-stream')) {
      requestConfig.responseType = 'arraybuffer';
    }
    
    const response = await client.get(url, requestConfig);
    
    // Update result with success information
    result.success = true;
    result.statusCode = response.status;
    result.data = response.data;
    result.headers = response.headers;
    
    // Create a filename for the response
    const baseFilename = endpoint.operationId
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase();
    
    // Detect binary responses
    const contentType = response.headers?.['content-type'] || '';
    if (contentType.includes('application/octet-stream') || 
        contentType.includes('image/') ||
        contentType.includes('audio/') ||
        contentType.includes('video/') ||
        requestConfig.responseType === 'arraybuffer') {
      
      result.isBinary = true;
      const filePath = path.join(outputDir, `${baseFilename}.bin`);
      
      // Save binary data
      fs.writeFileSync(filePath, response.data);
      console.log(`Saved binary response to ${filePath}`);
    } else {
      // Save JSON response
      const filePath = path.join(outputDir, `${baseFilename}.json`);
      fs.writeFileSync(filePath, JSON.stringify(response.data, null, 2));
      console.log(`Saved JSON response to ${filePath}`);
    }
    
  } catch (error) {
    // Handle error response
    result.success = false;
    result.error = error.message;
    
    if (error.response) {
      result.statusCode = error.response.status;
      result.data = error.response.data;
      result.headers = error.response.headers;
    }
    
    // Save error response
    const errorFilename = endpoint.operationId
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase();
    
    const errorResponse = {
      error: true,
      message: error.message,
      statusCode: result.statusCode,
      data: result.data,
      timestamp: new Date().toISOString()
    };
    
    const filePath = path.join(outputDir, `${errorFilename}.json`);
    fs.writeFileSync(filePath, JSON.stringify(errorResponse, null, 2));
    console.error(`Error in GET request to ${endpoint.path}: ${error.message}`);
  }
  
  return result;
}

module.exports = {
  handleGetRequest
};
