const fs = require('fs');
const path = require('path');
const expressServer = require('./express-server');
const routeHandler = require('./route-handler');
const oDataRecorder = require('./odata-recorder');

/**
 * Starts the mock API server
 * @param {object} options - Server options
 * @returns {Promise<Object>} Server instance
 */
async function start(options) {
  const port = parseInt(options.port) || 3000;
  const host = options.host || 'localhost';
  const dataDir = path.resolve(options.dataDir || './data');
  
  // Check if data directory exists
  if (!fs.existsSync(dataDir)) {
    throw new Error(`Data directory ${dataDir} does not exist. Run 'api-mocker record' first.`);
  }
  
  console.log(`Starting mock server with data from ${dataDir}`);
  
  // Create Express app with standard middleware
  const app = expressServer.createApp();
  
  // Load API configurations from data directory
  const configs = loadApiConfigurations(dataDir, options);
  
  if (configs.length === 0) {
    throw new Error('No API configurations found. Run \'api-mocker record\' first.');
  }
  
  console.log(`Loaded ${configs.length} API configuration(s)`);
  
  // Register routes for each API
  registerApiRoutes(app, configs);
  
  // Register dashboard
  expressServer.registerDashboard(app, configs);
  
  // Serve Swagger UI for each API
  configs.forEach(config => {
    const swaggerPath = `${config.basePath}/swagger`;
    
    // Serve Swagger UI
    app.get(swaggerPath, (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>API Mocker - ${config.name} - Swagger UI</title>
            <link rel="stylesheet" type="text/css" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.18.3/swagger-ui.css" />
        </head>
        <body>
            <div id="swagger-ui"></div>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.18.3/swagger-ui-bundle.js"></script>
            <script>
                window.onload = function() {
                    window.ui = SwaggerUIBundle({
                        url: "${config.basePath}/swagger.json",
                        dom_id: '#swagger-ui',
                        presets: [
                            SwaggerUIBundle.presets.apis,
                            SwaggerUIBundle.SwaggerUIStandalonePreset
                        ],
                        layout: "BaseLayout"
                    });
                };
            </script>
        </body>
        </html>
      `);
    });
    
    // Serve Swagger spec
    app.get(`${config.basePath}/swagger.json`, (req, res) => {
      res.json(config.swagger);
    });
  });
  
  // This section is now handled by registerApiRoutes
  
  // Add fallback route for unknown endpoints
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Endpoint ${req.path} not found in recorded responses`,
      hint: 'Run api-mocker record to capture this endpoint'
    });
  });
  
  // Additional setup can go here if needed
  
  // Start the server
  const server = await expressServer.startServer(app, port);
  
  console.log(`✅ Mock API server running at http://${host}:${port}`);
  console.log(`📚 Dashboard available at http://${host}:${port}/`);
  
  return server;
}

/**
 * Loads API configurations from the data directory
 * @param {string} dataDir - Path to the data directory
 * @param {Object} options - Server options
 * @returns {Array} Array of API configurations
 */
function loadApiConfigurations(dataDir, options = {}) {
  const configs = [];
  
  try {
    // Get all API directories in the data directory
    const items = fs.readdirSync(dataDir);
    const apiDirs = items.filter(item => {
      const itemPath = path.join(dataDir, item);
      return fs.statSync(itemPath).isDirectory();
    });
    
    for (const apiName of apiDirs) {
      const apiDir = path.join(dataDir, apiName);
      
      // Check if there's a swagger.json file
      const swaggerPath = path.join(apiDir, 'swagger.json');
      if (!fs.existsSync(swaggerPath)) {
        console.warn(`No swagger.json found for API: ${apiName}`);
        continue;
      }
      
      // Read and parse the Swagger spec
      const swaggerSpec = JSON.parse(fs.readFileSync(swaggerPath, 'utf8'));
      
      // Check if there's a responses directory
      const responsesDir = path.join(apiDir, 'responses');
      if (!fs.existsSync(responsesDir)) {
        console.warn(`No responses directory found for API: ${apiName}`);
        continue;
      }
      
      // Check if there's an API type file
      const apiTypePath = path.join(apiDir, 'api-type.json');
      let apiType = null;
      if (fs.existsSync(apiTypePath)) {
        apiType = JSON.parse(fs.readFileSync(apiTypePath, 'utf8'));
      }
      
      // Determine the base path for this API
      let basePath = swaggerSpec.basePath || '';
      
      // If no basePath in swagger, use the API name
      if (!basePath) {
        basePath = `/${apiName}`;
      }
      
      // Add to configurations
      configs.push({
        name: apiName,
        apiName: apiName,
        basePath,
        swagger: swaggerSpec,
        responsesDir,
        dataDir: path.join(apiDir, 'data'),
        apiType,
        stateful: options.stateful !== false
      });
      
      console.log(`Loaded API configuration: ${apiName} (${basePath})`);
    }
    
  } catch (error) {
    console.error(`Error loading API configurations: ${error.message}`);
  }
  
  return configs;
}

/**
 * Registers routes for all APIs
 * @param {Object} app - Express application
 * @param {Array} configs - Array of API configurations
 */
function registerApiRoutes(app, configs) {
  for (const config of configs) {
    // Check if this is an OData API
    const isOData = config.apiType && config.apiType.isOData;
    
    if (isOData) {
      // Register OData-specific routes
      routeHandler.registerODataRoutes(app, config.basePath, config);
    }
    
    // Extract paths from Swagger spec
    const { paths } = config.swagger;
    
    if (!paths) {
      console.warn(`No paths found in Swagger spec for API: ${config.name}`);
      continue;
    }
    
    // Register routes for each path and method
    for (const [pathPattern, pathItem] of Object.entries(paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        // Skip if no operationId (needed for response file mapping)
        if (!operation.operationId) {
          console.warn(`No operationId for ${method.toUpperCase()} ${pathPattern} in API: ${config.name}`);
          continue;
        }
        
        // Normalize path (remove path parameters)
        const normalizedPath = pathPattern.replace(/{([^}]+)}/g, ':$1');
        
        // Create full route path
        const routePath = `${config.basePath}${normalizedPath}`;
        
        // Register the route
        routeHandler.registerRoute(app, method, routePath, operation, config);
        
        console.log(`Registered route: ${method.toUpperCase()} ${routePath}`);
      }
    }
  }
  
  // Add fallback route
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not found',
      message: `No mock response found for ${req.method} ${req.path}`,
      timestamp: new Date().toISOString()
    });
  });
}

module.exports = {
  start,
  loadApiConfigurations,
  registerApiRoutes
};
