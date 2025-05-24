/**
 * Server Integration Module
 * 
 * Provides integration between existing express-server module and new server modules
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const expressServer = require('./express-server');
const apiRegistry = require('./api-registry');
const multiApiServer = require('./multi-api-server');
const singleApiServer = require('./single-api-server');
const dashboardGenerator = require('./dashboard-generator');

/**
 * Creates an Express application with proper configuration
 * @returns {Object} Express application
 */
function createExpressApp() {
  return expressServer.createApp();
}

/**
 * Creates a new Express router
 * @returns {Object} Express router
 */
function createRouter() {
  return express.Router();
}

/**
 * Registers API routes on a router
 * @param {Object} router - Express router
 * @param {Object} api - API configuration
 * @param {string} responsesDir - Path to responses directory
 */
function registerApiRoutes(router, api, responsesDir) {
  // Add routes based on the Swagger spec
  const paths = api.swagger.paths || {};
  
  for (const path in paths) {
    const pathObj = paths[path];
    
    for (const method in pathObj) {
      const endpoint = pathObj[method];
      const route = path.replace(/{([^}]+)}/g, ':$1');
      
      // Register the route handler
      router[method](route, (req, res) => {
        // Find matching response file
        const responseFile = findResponseFile(responsesDir, path, method);
        
        if (responseFile) {
          // Read and send the response
          const response = JSON.parse(fs.readFileSync(responseFile, 'utf8'));
          res.status(response.status || 200).json(response.data || {});
        } else {
          // No matching response file found
          res.status(404).json({ error: 'No matching response found' });
        }
      });
    }
  }
}

/**
 * Finds a matching response file for a path and method
 * @param {string} responsesDir - Path to responses directory
 * @param {string} path - API path
 * @param {string} method - HTTP method
 * @returns {string|null} Path to response file or null if not found
 */
function findResponseFile(responsesDir, path, method) {
  // Normalize path for filename
  const normalizedPath = path.replace(/\//g, '_').replace(/[{}]/g, '');
  const filename = `${method}${normalizedPath}.json`;
  
  const filePath = path.join(responsesDir, filename);
  
  if (fs.existsSync(filePath)) {
    return filePath;
  }
  
  return null;
}

/**
 * Starts a server based on options
 * @param {Object} options - Server options
 * @returns {Promise<Object>} Server instance
 */
async function startServer(options) {
  try {
    const { dataDir, port, host, stateful, api, basePath } = options;
    
    // Create public directory for dashboard if it doesn't exist
    const publicDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    // Single API mode
    if (api) {
      return await singleApiServer.createAndStartServer({
        dataDir,
        apiName: api,
        port,
        host,
        basePath,
        stateful
      });
    }
    
    // Multi-API mode
    // Generate dashboard
    const dashboardPath = path.join(publicDir, 'index.html');
    await dashboardGenerator.writeDashboard(dataDir, dashboardPath);
    await dashboardGenerator.generateAssets(publicDir);
    
    return await multiApiServer.createAndStartServer({
      dataDir,
      port,
      host,
      stateful
    });
  } catch (error) {
    console.error(`Error starting server: ${error.message}`);
    throw error;
  }
}

// Export the functions that the other modules expect
module.exports = {
  createExpressApp,
  createRouter,
  registerApiRoutes,
  startServer
};
