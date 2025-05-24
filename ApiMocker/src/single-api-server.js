/**
 * Single API Server Module
 * 
 * Handles serving a single API with its own router and state
 * Implements section 7.4 of the TDD Implementation Checklist
 */

const path = require('path');
const apiRegistry = require('./api-registry');
const expressServer = require('./express-server');
const routeHandler = require('./route-handler');
const crudHandler = require('./crud-handler');

/**
 * Creates a single API server
 * 
 * @param {Object} options - Server configuration options
 * @param {string} options.dataDir - Path to the data directory
 * @param {string} options.apiName - Name of the API to serve
 * @param {number} options.port - Port to run the server on
 * @param {string} options.basePath - Optional custom base path for the API
 * @returns {Promise<Object>} - Server object
 */
async function createServer(options) {
  const { dataDir, apiName, port, basePath } = options;
  
  // Load API configurations
  const apis = await apiRegistry.loadApiConfigurations(dataDir);
  
  // Find the requested API
  const api = apiRegistry.getApiByName(apis, apiName);
  
  if (!api) {
    throw new Error(`API not found: ${apiName}`);
  }
  
  // Create Express app
  const app = expressServer.createExpressApp();
  
  // Initialize data store for this API
  crudHandler.initializeDataStore(api.name);
  
  // Determine base path (custom or from API config)
  const apiBasePath = basePath || api.basePath || `/${api.name}`;
  
  // Add a test endpoint to verify routing
  app.get('/test', (req, res) => {
    res.json({ message: 'Test endpoint is working!' });
  });
  
  // Add a test endpoint with the API base path
  app.get(`${apiBasePath}/test`, (req, res) => {
    res.json({ message: `Test endpoint at ${apiBasePath} is working!` });
  });
  
  // Add a proper index page
  app.get('/', (req, res) => {
    const host = req.get('host');
    const protocol = req.protocol;
    const baseUrl = `${protocol}://${host}`;
    
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>API Mocker - ${api.name}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          h1 {
            color: #2c3e50;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
          }
          .card {
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .card h2 {
            margin-top: 0;
            color: #3498db;
          }
          a {
            color: #3498db;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
          .endpoint {
            background: #f8f9fa;
            padding: 10px;
            border-radius: 4px;
            margin: 10px 0;
          }
          .method {
            display: inline-block;
            padding: 3px 6px;
            border-radius: 3px;
            color: white;
            font-size: 12px;
            font-weight: bold;
            margin-right: 10px;
          }
          .get { background-color: #61affe; }
          .post { background-color: #49cc90; }
          .put { background-color: #fca130; }
          .delete { background-color: #f93e3e; }
        </style>
      </head>
      <body>
        <h1>API Mocker - ${api.name}</h1>
        
        <div class="card">
          <h2>API Information</h2>
          <p><strong>Name:</strong> ${api.name}</p>
          <p><strong>Base Path:</strong> ${apiBasePath}</p>
          <p><strong>Description:</strong> ${api.swagger.info.description || 'No description available'}</p>
          <p><strong>Version:</strong> ${api.swagger.info.version || '1.0.0'}</p>
        </div>
        
        <div class="card">
          <h2>Documentation</h2>
          <p>Explore and test the API using the Swagger UI:</p>
          <p><a href="${baseUrl}/api-docs" target="_blank">Open Swagger UI</a></p>
          <p>View the raw Swagger specification:</p>
          <p><a href="${baseUrl}/swagger.json" target="_blank">View Swagger JSON</a></p>
        </div>
        
        <div class="card">
          <h2>Available Endpoints</h2>
          ${Object.entries(api.swagger.paths).map(([path, methods]) => `
            ${Object.entries(methods).filter(([method]) => method !== 'parameters').map(([method, operation]) => `
              <div class="endpoint">
                <span class="method ${method}">${method.toUpperCase()}</span>
                <span>${apiBasePath}${path}</span>
                <p>${operation.summary || 'No description'}</p>
              </div>
            `).join('')}
          `).join('')}
        </div>
      </body>
      </html>
    `;
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });
  
  // Register API routes directly on the app
  console.log(`Registering API routes for ${api.name} at base path: ${apiBasePath}`);
  expressServer.registerApiRoutes(app, api, path.join(dataDir, api.name, 'responses'), apiBasePath);
  
  // Mount Swagger UI directly on the app
  expressServer.mountSwaggerUI(app, api, '');
  
  console.log(`Mounted API: ${api.name} at ${apiBasePath}`);
  
  return {
    app,
    port,
    api,
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
    console.log(`Single API Server started on port ${server.port}`);
    console.log(`Serving API: ${server.api.name}`);
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
    console.log('Single API Server stopped');
  });
  
  return true;
}

/**
 * Creates and starts a single API server
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
