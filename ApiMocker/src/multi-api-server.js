/**
 * Multi-API Server Module
 * 
 * Handles mounting multiple APIs with isolated state and different base paths
 * Implements section 7.2 of the TDD Implementation Checklist
 */

const path = require('path');
const apiRegistry = require('./api-registry');
const expressServer = require('./express-server');
const routeHandler = require('./route-handler');
const crudHandler = require('./crud-handler');

/**
 * Creates a multi-API server
 * 
 * @param {Object} options - Server configuration options
 * @param {string} options.dataDir - Path to the data directory
 * @param {number} options.port - Port to run the server on
 * @param {Array} options.apiFilter - Optional list of API names to include
 * @param {Object} options.basePaths - Optional custom base paths for APIs
 * @returns {Promise<Object>} - Server object
 */
async function createServer(options) {
  const { dataDir, port, apiFilter, basePaths = {} } = options;
  
  // Load API configurations
  const allApis = await apiRegistry.loadApiConfigurations(dataDir);
  
  // Filter active APIs
  let apis = apiRegistry.filterApisByStatus(allApis, true);
  
  // Apply API filter if provided
  if (apiFilter && Array.isArray(apiFilter) && apiFilter.length > 0) {
    apis = apis.filter(api => apiFilter.includes(api.name));
  }
  
  // Create Express app
  const app = expressServer.createExpressApp();
  
  // Mount each API at its base path
  for (const api of apis) {
    const apiBasePath = basePaths[api.name] || api.basePath || `/${api.name}`;
    
    // Initialize data store for this API
    crudHandler.initializeDataStore(api.name);
    
    // Create router for this API
    const router = expressServer.createRouter();
    
    // Register API routes
    expressServer.registerApiRoutes(router, api, path.join(dataDir, api.name, 'responses'));
    
    // Mount the router
    app.use(apiBasePath, router);
    
    // Mount Swagger UI directly on the app with a unique path for each API
    expressServer.mountSwaggerUI(app, api, `/${api.name}`);
    
    console.log(`Mounted API: ${api.name} at ${apiBasePath}`);
  }
  
  return {
    app,
    port,
    apis,
    dataDir
  };
}

/**
 * Starts the server
 * 
 * @param {Object} server - Server object from createServer
 * @returns {Promise<Object>} - Running server instance
 */
async function startServer(server) {
  // Create a server instance
  const httpServer = server.app.listen(server.port, () => {
    console.log(`Multi-API Server started on port ${server.port}`);
    console.log(`Serving ${server.apis.length} APIs`);
  });
  
  // Add error handler
  httpServer.on('error', (error) => {
    console.error(`Error starting server: ${error.message}`);
  });
  
  return httpServer;
}

/**
 * Stops the server
 * 
 * @param {Object} server - Running server instance
 * @returns {Promise<boolean>} - Success status
 */
async function stopServer(server) {
  if (!server || typeof server.close !== 'function') {
    console.warn('Invalid server instance provided to stopServer');
    return false;
  }
  
  server.close(() => {
    console.log('Multi-API Server stopped');
  });
  
  return true;
}

/**
 * Creates and starts a multi-API server
 * 
 * @param {Object} options - Server configuration options
 * @returns {Promise<Object>} - Running server instance
 */
async function createAndStartServer(options) {
  const server = await createServer(options);
  return startServer(server);
}

module.exports = {
  createServer,
  startServer,
  stopServer,
  createAndStartServer
};
