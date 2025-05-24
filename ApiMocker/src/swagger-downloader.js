/**
 * Swagger Downloader Module
 * 
 * Downloads and stores Swagger/OpenAPI specifications from API endpoints
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Common Swagger/OpenAPI specification paths
 */
const COMMON_SWAGGER_PATHS = [
  '/swagger.json',
  '/swagger/v1/swagger.json',
  '/api-docs',
  '/api-docs.json',
  '/openapi.json',
  '/v1/swagger.json',
  '/v2/swagger.json',
  '/v3/swagger.json',
  '/$metadata'  // For OData
];

/**
 * Downloads a Swagger/OpenAPI specification from a URL
 * @param {string} baseUrl - The base URL of the API
 * @param {Object} options - Download options
 * @returns {Promise<Object>} The downloaded specification and metadata
 */
async function downloadSwagger(baseUrl, options = {}) {
  const result = {
    baseUrl,
    specUrl: null,
    specType: null,
    spec: null,
    version: null,
    title: null,
    timestamp: new Date().toISOString(),
    error: null
  };
  
  try {
    // Normalize base URL
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    
    // Try to discover Swagger/OpenAPI specification URL
    const specUrl = await discoverSpecUrl(normalizedBaseUrl);
    
    if (!specUrl) {
      throw new Error('No Swagger/OpenAPI specification found');
    }
    
    result.specUrl = specUrl;
    
    // Download the specification
    const response = await axios.get(specUrl, {
      headers: {
        Accept: 'application/json, application/xml'
      },
      timeout: options.timeout || 10000
    });
    
    // Determine specification type
    if (specUrl.includes('$metadata')) {
      result.specType = 'odata';
      result.spec = response.data;  // XML content
    } else {
      result.specType = 'swagger';
      result.spec = response.data;  // JSON content
      
      // Extract version and title
      if (result.spec.swagger) {
        result.version = result.spec.swagger;
      } else if (result.spec.openapi) {
        result.version = result.spec.openapi;
      }
      
      if (result.spec.info) {
        result.title = result.spec.info.title;
      }
    }
    
    return result;
  } catch (error) {
    result.error = {
      message: error.message,
      stack: error.stack
    };
    return result;
  }
}

/**
 * Discovers the URL of a Swagger/OpenAPI specification
 * @param {string} baseUrl - The base URL of the API
 * @returns {Promise<string>} The discovered specification URL
 */
async function discoverSpecUrl(baseUrl) {
  // Try common paths
  for (const path of COMMON_SWAGGER_PATHS) {
    const url = `${baseUrl}${path}`;
    try {
      const response = await axios.head(url, {
        validateStatus: status => status < 500,
        timeout: 5000
      });
      
      if (response.status === 200) {
        return url;
      }
    } catch (error) {
      // Ignore errors and try the next path
    }
  }
  
  // Try to discover from HTML content
  try {
    const response = await axios.get(baseUrl, {
      headers: {
        Accept: 'text/html'
      },
      timeout: 5000
    });
    
    if (response.status === 200 && typeof response.data === 'string') {
      // Look for common Swagger/OpenAPI paths in HTML
      for (const path of COMMON_SWAGGER_PATHS) {
        if (response.data.includes(path)) {
          return `${baseUrl}${path}`;
        }
      }
    }
  } catch (error) {
    // Ignore errors
  }
  
  return null;
}

/**
 * Saves a Swagger/OpenAPI specification to a file
 * @param {Object} spec - The specification object
 * @param {string} outputDir - The output directory
 * @param {Object} options - Save options
 * @returns {Promise<Object>} The save result
 */
async function saveSwagger(spec, outputDir, options = {}) {
  const result = {
    filePath: null,
    error: null
  };
  
  try {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Generate file name
    let fileName;
    if (options.fileName) {
      fileName = options.fileName;
    } else {
      // Generate a file name based on the API title or URL
      const baseName = spec.title 
        ? spec.title.toLowerCase().replace(/[^a-z0-9]/g, '_')
        : new URL(spec.baseUrl).hostname.replace(/\./g, '_');
      
      const extension = spec.specType === 'odata' ? 'xml' : 'json';
      fileName = `${baseName}_swagger.${extension}`;
    }
    
    const filePath = path.join(outputDir, fileName);
    
    // Check if file already exists and compare content
    if (fs.existsSync(filePath) && !options.force) {
      const existingContent = fs.readFileSync(filePath, 'utf8');
      const newContent = typeof spec.spec === 'string' 
        ? spec.spec 
        : JSON.stringify(spec.spec, null, 2);
      
      // Compare content hashes
      const existingHash = crypto.createHash('md5').update(existingContent).digest('hex');
      const newHash = crypto.createHash('md5').update(newContent).digest('hex');
      
      if (existingHash === newHash) {
        result.filePath = filePath;
        result.skipped = true;
        return result;
      }
    }
    
    // Save the specification
    if (spec.specType === 'odata') {
      fs.writeFileSync(filePath, spec.spec);
    } else {
      fs.writeFileSync(filePath, JSON.stringify(spec.spec, null, 2));
    }
    
    // Save metadata
    if (options.saveMetadata) {
      const metadataPath = filePath + '.meta.json';
      const metadata = {
        baseUrl: spec.baseUrl,
        specUrl: spec.specUrl,
        specType: spec.specType,
        version: spec.version,
        title: spec.title,
        timestamp: spec.timestamp
      };
      
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    }
    
    result.filePath = filePath;
    return result;
  } catch (error) {
    result.error = {
      message: error.message,
      stack: error.stack
    };
    return result;
  }
}

/**
 * Compares two Swagger/OpenAPI specifications
 * @param {Object} spec1 - The first specification
 * @param {Object} spec2 - The second specification
 * @returns {Object} Comparison result
 */
function compareSwagger(spec1, spec2) {
  const result = {
    identical: false,
    changes: {
      paths: [],
      definitions: [],
      parameters: []
    }
  };
  
  // Check if both specs are the same type
  if (spec1.specType !== spec2.specType) {
    result.changes.type = {
      from: spec1.specType,
      to: spec2.specType
    };
    return result;
  }
  
  // For OData, just compare the raw content
  if (spec1.specType === 'odata') {
    result.identical = spec1.spec === spec2.spec;
    return result;
  }
  
  // For Swagger/OpenAPI, compare paths and definitions
  
  // Compare paths
  const paths1 = spec1.spec.paths || {};
  const paths2 = spec2.spec.paths || {};
  
  // Find added paths
  for (const path in paths2) {
    if (!paths1[path]) {
      result.changes.paths.push({
        path,
        change: 'added'
      });
    }
  }
  
  // Find removed paths
  for (const path in paths1) {
    if (!paths2[path]) {
      result.changes.paths.push({
        path,
        change: 'removed'
      });
    }
  }
  
  // Find modified paths
  for (const path in paths1) {
    if (paths2[path]) {
      // Compare methods
      const methods1 = Object.keys(paths1[path]).filter(m => !m.startsWith('x-'));
      const methods2 = Object.keys(paths2[path]).filter(m => !m.startsWith('x-'));
      
      // Find added methods
      for (const method of methods2) {
        if (!methods1.includes(method)) {
          result.changes.paths.push({
            path,
            method,
            change: 'method_added'
          });
        }
      }
      
      // Find removed methods
      for (const method of methods1) {
        if (!methods2.includes(method)) {
          result.changes.paths.push({
            path,
            method,
            change: 'method_removed'
          });
        }
      }
    }
  }
  
  // Compare definitions/schemas
  const definitions1 = spec1.spec.definitions || (spec1.spec.components && spec1.spec.components.schemas) || {};
  const definitions2 = spec2.spec.definitions || (spec2.spec.components && spec2.spec.components.schemas) || {};
  
  // Find added definitions
  for (const def in definitions2) {
    if (!definitions1[def]) {
      result.changes.definitions.push({
        definition: def,
        change: 'added'
      });
    }
  }
  
  // Find removed definitions
  for (const def in definitions1) {
    if (!definitions2[def]) {
      result.changes.definitions.push({
        definition: def,
        change: 'removed'
      });
    }
  }
  
  // Check if there are any changes
  result.identical = result.changes.paths.length === 0 && 
                    result.changes.definitions.length === 0 && 
                    result.changes.parameters.length === 0 && 
                    !result.changes.type;
  
  return result;
}

module.exports = {
  downloadSwagger,
  saveSwagger,
  compareSwagger,
  COMMON_SWAGGER_PATHS
};
