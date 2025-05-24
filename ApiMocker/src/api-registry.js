/**
 * API Registry Module
 * 
 * Handles API discovery, configuration loading, and filtering
 * Implements section 7.1 of the TDD Implementation Checklist
 */

const fs = require('fs');
const path = require('path');
const util = require('util');

// Promisify filesystem operations
const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const stat = util.promisify(fs.stat);

/**
 * Discovers APIs from the data directory
 * 
 * @param {string} dataDir - Path to the data directory
 * @returns {Promise<Array>} - Array of API directory names
 */
async function discoverApis(dataDir) {
  try {
    const entries = await readdir(dataDir, { withFileTypes: true });
    const apiDirs = entries
      .filter(entry => entry.isDirectory())
      .map(dir => {
        return {
          name: dir.name,
          path: path.join(dataDir, dir.name)
        };
      })
      // Sort by name to ensure consistent order for tests
      .sort((a, b) => a.name.localeCompare(b.name));
    
    return apiDirs;
  } catch (error) {
    console.error(`Error discovering APIs: ${error.message}`);
    return [];
  }
}

/**
 * Loads API configurations from the data directory
 * 
 * @param {string} dataDir - Path to the data directory
 * @returns {Promise<Array>} - Array of API configurations
 */
async function loadApiConfigurations(dataDir) {
  try {
    const apiDirs = await discoverApis(dataDir);
    const apiConfigs = [];
    
    for (const apiDir of apiDirs) {
      const configPath = path.join(apiDir.path, 'config.json');
      const swaggerPath = path.join(apiDir.path, 'swagger.json');
      
      try {
        // Load config.json if it exists
        let config = {};
        if (fs.existsSync(configPath)) {
          const configData = await readFile(configPath, 'utf8');
          config = JSON.parse(configData);
        }
        
        // Add the directory path to the config
        config.dirPath = apiDir.path;
        // Ensure name is set from directory if not in config
        if (!config.name) {
          config.name = apiDir.name;
        }
        
        // Load swagger.json if it exists
        if (fs.existsSync(swaggerPath)) {
          const swaggerData = await readFile(swaggerPath, 'utf8');
          config.swagger = JSON.parse(swaggerData);
          
          // Use basePath from swagger if not set in config
          if (!config.basePath && config.swagger.basePath) {
            config.basePath = config.swagger.basePath;
          }
        }
        
        // Set responses directory
        config.responsesDir = path.join(apiDir.path, 'responses');
        
        apiConfigs.push(config);
      } catch (configError) {
        console.error(`Error loading config for ${apiDir.name}: ${configError.message}`);
      }
    }
    
    // Sort configurations by name to ensure consistent order for tests
    apiConfigs.sort((a, b) => a.name.localeCompare(b.name));
    
    return apiConfigs;
  } catch (error) {
    console.error(`Error loading API configurations: ${error.message}`);
    return [];
  }
}

/**
 * Filters APIs by type
 * 
 * @param {Array} apis - Array of API configurations
 * @param {string} type - API type to filter by (REST, OData, GraphQL)
 * @returns {Array} - Filtered array of APIs
 */
function filterApisByType(apis, type) {
  if (!apis || !Array.isArray(apis)) {
    return [];
  }
  if (!type) {
    return apis;
  }
  return apis.filter(api => api.type === type);
}

/**
 * Filters APIs by active status
 * 
 * @param {Array} apis - Array of API configurations
 * @param {boolean} active - Active status to filter by
 * @returns {Array} - Filtered array of APIs
 */
function filterApisByStatus(apis, active) {
  if (!apis || !Array.isArray(apis)) {
    return [];
  }
  // If active parameter is undefined, return all APIs
  if (active === undefined) {
    return apis;
  }
  return apis.filter(api => api.active === active);
}

/**
 * Gets an API by name
 * 
 * @param {Array} apis - Array of API configurations
 * @param {string} name - API name to find
 * @returns {Object|null} - API configuration or null if not found
 */
function getApiByName(apis, name) {
  if (!apis || !Array.isArray(apis)) {
    return null;
  }
  if (!name) {
    return null;
  }
  const api = apis.find(api => api.name === name);
  return api || null;
}

/**
 * Saves an API configuration
 * 
 * @param {string} dataDir - Path to the data directory
 * @param {Object} api - API configuration to save
 * @returns {Promise<boolean>} - Success status
 */
async function saveApiConfiguration(dataDir, api) {
  try {
    const apiDirPath = path.join(dataDir, api.name);
    const configPath = path.join(apiDirPath, 'config.json');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(apiDirPath)) {
      fs.mkdirSync(apiDirPath, { recursive: true });
    }
    
    // Create a copy of the API config without the dirPath property
    const configToSave = { ...api };
    delete configToSave.dirPath;
    
    await writeFile(configPath, JSON.stringify(configToSave, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`Error saving API configuration: ${error.message}`);
    return false;
  }
}

/**
 * Creates an API registry data structure
 * 
 * @param {Array} apis - Array of API configurations
 * @returns {Object} - API registry object
 */
function createRegistry(apis) {
  const activeApis = filterApisByStatus(apis, true);
  
  // Extract unique API types
  const types = [...new Set(apis.map(api => api.type))];
  
  return {
    apis,
    activeApis,
    types,
    count: apis.length,
    activeCount: activeApis.length,
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Initializes the API registry
 * 
 * @param {string} dataDir - Path to the data directory
 * @returns {Promise<Object>} - API registry object
 */
async function initializeRegistry(dataDir) {
  const apis = await loadApiConfigurations(dataDir);
  return createRegistry(apis);
}

module.exports = {
  discoverApis,
  loadApiConfigurations,
  filterApisByType,
  filterApisByStatus,
  getApiByName,
  saveApiConfiguration,
  createRegistry,
  initializeRegistry
};
