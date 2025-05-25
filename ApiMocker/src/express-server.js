const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');

/**
 * Joins URL paths correctly, handling slashes properly
 * @param {...string} parts - Path parts to join
 * @returns {string} Joined path
 */
function joinPaths(...parts) {
  // Filter out empty parts and normalize slashes
  const normalizedParts = parts
    .filter(part => part && part.trim() !== '')
    .map(part => {
      // Remove leading and trailing slashes
      return part.replace(/^\/+|\/+$/g, '');
    });
  
  // Special case: if there are no normalized parts, return root path
  if (normalizedParts.length === 0) {
    return '/';
  }
  
  // Special case: if the first part is an empty string (representing root path)
  // and there are other parts, don't add an extra leading slash
  if (parts[0] === '/' && normalizedParts.length > 0) {
    return '/' + normalizedParts.join('/');
  }
  
  // Join parts with a single slash
  return '/' + normalizedParts.join('/');
}
const routeHandler = require('./route-handler');

/**
 * Creates and configures an Express application
 * @returns {Object} Express application
 */
function createApp() {
  const app = express();
  
  // Add request logging middleware
  app.use((req, res, next) => {
    console.log(`[DEBUG] ${req.method} ${req.url}`);
    next();
  });
  
  // Configure middleware with enhanced CORS settings
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
  }));
  
  // Handle OPTIONS requests for CORS preflight
  app.options('*', cors());
  
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('dev'));
  
  // Serve static files
  app.use('/static', express.static(path.join(__dirname, '../public')));
  
  // Add health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  
  return app;
}

/**
 * Creates an Express application (alias for createApp for compatibility)
 * @returns {Object} Express application
 */
function createExpressApp() {
  return createApp();
}

/**
 * Creates a new Express router
 * @returns {Object} Express router
 */
function createRouter() {
  return express.Router();
}

/**
 * Loads API configurations from the data directory
 * @param {string} dataDir - Path to the data directory
 * @returns {Array} Array of API configurations
 */
function loadApiConfigurations(dataDir) {
  const configs = [];
  
  try {
    // Get all API directories in the data directory
    const apiDirs = fs.readdirSync(dataDir);
    
    for (const apiName of apiDirs) {
      const apiDir = path.join(dataDir, apiName);
      
      // Skip if not a directory
      if (!fs.existsSync(apiDir) || !fs.statSync(apiDir).isDirectory()) {
        continue;
      }
      
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
      
      // Determine the base path for this API
      let basePath = swaggerSpec.basePath || '';
      
      // If no basePath in swagger, use the API name
      if (!basePath) {
        basePath = `/${apiName}`;
      }
      
      // Add to configurations
      configs.push({
        name: apiName,
        basePath,
        swagger: swaggerSpec,
        responsesDir
      });
      
      console.log(`Loaded API configuration: ${apiName} (${basePath})`);
    }
    
  } catch (error) {
    console.error(`Error loading API configurations: ${error.message}`);
  }
  
  return configs;
}

/**
 * Registers API routes based on configurations
 * @param {Object} app - Express application or router
 * @param {Object|Array} configs - API configuration or array of API configurations
 * @param {string} responsesDir - Optional path to responses directory (only used with single API)
 * @param {string} customBasePath - Optional custom base path to override the API's base path
 */
function registerApiRoutes(app, configs, responsesDir, customBasePath) {
  // Add custom route handler for $metadata endpoint
  if (responsesDir) {
    const metadataPath = path.join(responsesDir, 'get_odata_metadata.json');
    if (fs.existsSync(metadataPath)) {
      console.log('Registering custom route handler for /odata/$metadata');
      app.get('/odata/$metadata', (req, res) => {
        try {
          const metadataContent = fs.readFileSync(metadataPath, 'utf8');
          const metadata = JSON.parse(metadataContent);
          res.json(metadata);
        } catch (error) {
          console.error(`Error serving $metadata: ${error.message}`);
          res.status(500).json({ error: 'Failed to serve $metadata' });
        }
      });
    }
  }
  // Handle both single API and array of APIs
  const configArray = Array.isArray(configs) ? configs : [configs];
  
  for (const config of configArray) {
    // Extract paths from Swagger spec
    const { paths } = config.swagger;
    
    if (!paths) {
      console.warn(`No paths found in Swagger spec for API: ${config.name}`);
      continue;
    }
    
    // Register routes for each path and method
    for (const [pathPattern, pathItem] of Object.entries(paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (method === 'parameters') continue; // Skip parameters at path level
        
        // Normalize path for Express (convert {param} to :param)
        const normalizedPath = pathPattern.replace(/{([^}]+)}/g, ':$1');
        
        // Ensure method is lowercase and a valid Express method
        const expressMethod = method.toLowerCase();
        if (!app[expressMethod]) {
          console.warn(`Unsupported HTTP method: ${method} for path: ${pathPattern}`);
          return;
        }
        
        // Use custom base path if provided, otherwise use the API's base path
        const basePath = customBasePath || config.basePath || `/${config.name}`;
        console.log(`Using base path: ${basePath} for route: ${normalizedPath}`);
        
        // Handle special case for root base path
        let fullPath;
        if (basePath === '/' && normalizedPath.startsWith('/')) {
          // Avoid double slash by using the normalized path directly
          fullPath = normalizedPath;
        } else {
          // Properly join the base path and normalized path
          fullPath = joinPaths(basePath, normalizedPath);
        }
        
        // Log the route being registered
        console.log(`Registering route: ${expressMethod.toUpperCase()} ${fullPath}`);
        
        // Register route handler
        app[expressMethod](fullPath, (req, res) => {
          // Determine responses directory to use
          const responsesDirectory = responsesDir || config.responsesDir;
          
          // Find matching response file
          const responseFile = findResponseFile(responsesDirectory, pathPattern, method, req.params);
          
          if (responseFile) {
            try {
              // Read and parse response file
              const responseData = JSON.parse(fs.readFileSync(responseFile, 'utf8'));
              
              // Send response with appropriate status code
              res.status(responseData.statusCode || 200).json(responseData.data || responseData);
            } catch (error) {
              console.error(`Error reading response file: ${error.message}`);
              res.status(500).json({ error: 'Internal server error' });
            }
          } else {
            // No matching response file found - generate a fallback response
            const fallbackResponse = generateFallbackResponse(method, pathPattern, req.params);
            res.status(fallbackResponse.statusCode || 200).json(fallbackResponse.data);
          }
        });
        
        console.log(`Registered route: ${expressMethod.toUpperCase()} ${fullPath}`);
      }
    }
  }
}

/**
 * Generates a fallback response when no response file is found
 * @param {string} method - HTTP method
 * @param {string} pathPattern - API path pattern
 * @param {Object} params - Request parameters
 * @returns {Object} Fallback response object
 */
function generateFallbackResponse(method, pathPattern, params) {
  const lowerMethod = method.toLowerCase();
  const statusCode = {
    get: 200,
    post: 201,
    put: 200,
    delete: 204,
    patch: 200
  }[lowerMethod] || 200;
  
  // Extract resource name from path
  const resourceName = pathPattern.split('/').filter(Boolean).pop();
  
  // Generate appropriate response based on method
  let responseData;
  switch (lowerMethod) {
    case 'get':
      if (params && Object.keys(params).length > 0) {
        // Single resource response
        responseData = {
          id: params.id || params.petId || params.orderId || 1,
          name: `Mock ${resourceName}`,
          status: 'available',
          createdAt: new Date().toISOString()
        };
      } else {
        // Collection response
        responseData = {
          items: [
            { id: 1, name: `Mock ${resourceName} 1`, status: 'available' },
            { id: 2, name: `Mock ${resourceName} 2`, status: 'pending' }
          ],
          count: 2,
          total: 2
        };
      }
      break;
    
    case 'post':
      responseData = {
        id: Math.floor(Math.random() * 1000) + 1,
        name: `New ${resourceName}`,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      break;
    
    case 'put':
    case 'patch':
      responseData = {
        id: params.id || params.petId || params.orderId || 1,
        name: `Updated ${resourceName}`,
        status: 'available',
        updatedAt: new Date().toISOString()
      };
      break;
    
    case 'delete':
      responseData = {};
      break;
    
    default:
      responseData = { message: 'Operation completed successfully' };
  }
  
  return {
    statusCode,
    data: responseData
  };
}

/**
 * Finds a matching response file for a path and method
 * @param {string} responsesDir - Path to responses directory
 * @param {string} pathPattern - API path pattern
 * @param {string} method - HTTP method
 * @param {Object} params - Request parameters
 * @returns {string|null} Path to response file or null if not found
 */
function findResponseFile(responsesDir, pathPattern, method, params) {
  // Special case for $metadata endpoint
  if (pathPattern === '/odata/$metadata' || pathPattern === 'odata/$metadata') {
    const metadataFile = path.join(responsesDir, 'get_odata_metadata.json');
    if (fs.existsSync(metadataFile)) {
      console.log(`Found special response file for $metadata: ${metadataFile}`);
      return metadataFile;
    }
  }
  if (!responsesDir) {
    console.error('No responses directory provided');
    return null;
  }
  
  try {
    // Convert method to lowercase
    const lowerMethod = method.toLowerCase();
    
    // Normalize path for filename (convert /path/to/resource to _path_to_resource)
    const normalizedPath = pathPattern.replace(/\//g, '_').replace(/[{}]/g, '');
    
    // Try all possible filename formats
    const possibleFiles = [
      // Format: get_path_to_resource.json
      path.join(responsesDir, `${lowerMethod}${normalizedPath}.json`),
      
      // Format: get_path_to_resource (no extension)
      path.join(responsesDir, `${lowerMethod}${normalizedPath}`),
      
      // Format: GET_path_to_resource.json (uppercase method)
      path.join(responsesDir, `${method.toUpperCase()}${normalizedPath}.json`),
      
      // Format: method_path_resource.json (e.g., getpetbyid.json)
      path.join(responsesDir, `${lowerMethod.replace('get', 'get')}${normalizedPath.replace(/_/g, '')}.json`),
      
      // Try with specific parameters if available
      ...(params && Object.keys(params).length > 0 ? [
        path.join(responsesDir, `${lowerMethod}${normalizedPath}_${Object.entries(params)
          .map(([key, value]) => `${key}-${value}`)
          .join('_')}.json`)
      ] : []),
      
      // Default response for the method
      path.join(responsesDir, `${lowerMethod}_default.json`),
      
      // Try matching just the last part of the path
      path.join(responsesDir, `${lowerMethod}_${pathPattern.split('/').filter(Boolean).pop()}.json`)
    ];
    
    // Log the files we're checking (for debugging)
    console.log(`Checking response files for ${method.toUpperCase()} ${pathPattern}:`);
    possibleFiles.forEach(file => console.log(` - ${file}`))
    
    // Check if any of the possible files exist
    for (const file of possibleFiles) {
      if (fs.existsSync(file)) {
        console.log(`Found response file: ${file}`);
        return file;
      }
    }
    
    console.log(`No response file found for ${method.toUpperCase()} ${pathPattern}`);
    return null;
  } catch (error) {
    console.error(`Error finding response file: ${error.message}`);
    return null;
  }
}

/**
 * Registers a single route
 * @param {Object} app - Express application
 * @param {string} method - HTTP method
 * @param {string} path - Route path
 * @param {Object} operation - Swagger operation object
 * @param {Object} config - API configuration
 */
function registerRoute(app, method, path, operation, config) {
  // Use the route handler module to register the route
  routeHandler.registerRoute(app, method, path, operation, config);
}

/**
 * Registers a dashboard page for API exploration
 * @param {Object} app - Express application
 * @param {Array} configs - Array of API configurations
 */
function registerDashboard(app, configs) {
  app.get('/', (req, res) => {
    try {
      // Generate HTML for dashboard
      let html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>API Mocker Dashboard</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            h1 { color: #333; }
            .api { border: 1px solid #ddd; margin-bottom: 20px; padding: 15px; border-radius: 5px; }
            .api h2 { margin-top: 0; }
            .endpoint { margin: 10px 0; padding: 5px; background: #f9f9f9; }
            .method { display: inline-block; padding: 3px 6px; border-radius: 3px; color: white; margin-right: 10px; }
            .get { background-color: #61affe; }
            .post { background-color: #49cc90; }
            .put { background-color: #fca130; }
            .delete { background-color: #f93e3e; }
          </style>
        </head>
        <body>
          <h1>API Mocker Dashboard</h1>
      `;
      
      // Add each API to the dashboard
      for (const config of configs) {
        html += `
          <div class="api">
            <h2>${config.name}</h2>
            <p>Base Path: ${config.basePath}</p>
            <p><a href="${config.basePath}/api-docs" target="_blank">Swagger UI</a></p>
            <h3>Endpoints:</h3>
        `;
        
        // Add endpoints
        for (const [pathPattern, pathItem] of Object.entries(config.swagger.paths)) {
          for (const [method, operation] of Object.entries(pathItem)) {
            const normalizedPath = pathPattern.replace(/{([^}]+)}/g, ':$1');
            const fullPath = `${config.basePath}${normalizedPath}`;
            
            html += `
              <div class="endpoint">
                <span class="method ${method}">${method.toUpperCase()}</span>
                <span>${fullPath}</span>
                ${operation.summary ? `<p>${operation.summary}</p>` : ''}
              </div>
            `;
          }
        }
        
        html += `</div>`;
      }
      
      html += `
        </body>
        </html>
      `;
      
      res.send(html);
      
    } catch (error) {
      console.error(`Error generating dashboard: ${error.message}`);
      res.status(500).send('Error generating dashboard');
    }
  });
}

/**
 * Mounts Swagger UI for an API
 * @param {Object} app - Express application or router
 * @param {Object} api - API configuration
 * @param {string} basePath - Base path for the API
 */
function mountSwaggerUI(app, api, basePath) {
  if (!api || !api.swagger) {
    console.warn('Cannot mount Swagger UI: No swagger specification available');
    return;
  }
  
  // Normalize basePath to ensure it starts with a slash and doesn't end with one
  const normalizedBasePath = basePath ? 
    (basePath.startsWith('/') ? basePath : `/${basePath}`) : '';
  
  // Create paths for Swagger UI and JSON
  const swaggerJsonPath = `${normalizedBasePath}/swagger.json`;
  const swaggerUiPath = `${normalizedBasePath}/api-docs`;
  
  // Add a direct HTML endpoint for Swagger UI to avoid SSL issues
  app.get(swaggerUiPath, (req, res) => {
    // Get the host from the request
    const host = req.get('host');
    const protocol = req.protocol;
    const baseUrl = `${protocol}://${host}`;
    
    const swaggerHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Swagger UI - ${api.name}</title>
        <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4.5.0/swagger-ui.css" />
        <style>
          html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
          *, *:before, *:after { box-sizing: inherit; }
          body { margin: 0; background: #fafafa; }
          .topbar { display: none; }
          .swagger-ui .info { margin: 20px 0; }
          .swagger-ui .scheme-container { padding: 10px 0; }
          .swagger-ui .opblock { margin: 0 0 15px; }
        </style>
      </head>
      <body>
        <div id="swagger-ui"></div>
        <script src="https://unpkg.com/swagger-ui-dist@4.5.0/swagger-ui-bundle.js"></script>
        <script src="https://unpkg.com/swagger-ui-dist@4.5.0/swagger-ui-standalone-preset.js"></script>
        <script>
          window.onload = function() {
            const ui = SwaggerUIBundle({
              url: "${swaggerJsonPath}",
              dom_id: '#swagger-ui',
              deepLinking: true,
              presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
              plugins: [SwaggerUIBundle.plugins.DownloadUrl],
              layout: "StandaloneLayout",
              validatorUrl: null,
              supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
              defaultModelsExpandDepth: 2,
              defaultModelExpandDepth: 2,
              responseInterceptor: (res) => {
                console.log('Response:', res);
                return res;
              },
              // Add custom fetch implementation to handle CORS
              requestInterceptor: function(request) {
                console.log('Request:', request);
                // Make sure we're using the full URL
                if (!request.url.startsWith('http')) {
                  request.url = '${baseUrl}' + request.url;
                }
                return request;
              }
            });
            window.ui = ui;
          };
        </script>
      </body>
      </html>
    `;
    res.setHeader('Content-Type', 'text/html');
    res.send(swaggerHtml);
  });
  
  // Add dynamic Swagger JSON endpoint
  app.get(swaggerJsonPath, (req, res) => {
    try {
      // Create a copy of the swagger spec to modify
      const swaggerSpec = JSON.parse(JSON.stringify(api.swagger));
      
      // Update the host and basePath in the swagger spec to match the mock server
      const host = req.get('host');
      swaggerSpec.host = host;
      
      // Determine the API base path
      const apiBasePath = api.basePath || `/${api.name}`;
      
      // Update the basePath in the swagger spec
      swaggerSpec.basePath = apiBasePath;
      
      // Force HTTP scheme only to avoid SSL errors
      swaggerSpec.schemes = ['http'];
      
      // Remove any https URLs
      if (swaggerSpec.host && swaggerSpec.host.includes('https')) {
        swaggerSpec.host = swaggerSpec.host.replace('https://', '');
      }
      
      // Send the modified swagger spec with CORS headers
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
      res.send(swaggerSpec);
    } catch (error) {
      console.error(`Error generating swagger.json: ${error.message}`);
      res.status(500).json({ error: 'Failed to generate API definition' });
    }
  });
  
  // We're using our custom HTML endpoint for Swagger UI instead of the default setup
  
  console.log(`Mounted Swagger UI at ${swaggerUiPath}`);
  console.log(`Swagger JSON available at ${swaggerJsonPath}`);
}

/**
 * Starts the Express server
 * @param {Object} app - Express application
 * @param {number} port - Port to listen on
 * @returns {Promise<Object>} Server instance
 */
async function startServer(app, port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`API Mocker server started on port ${port}`);
      resolve(server);
    });
    
    server.on('error', (error) => {
      console.error(`Failed to start server: ${error.message}`);
      reject(error);
    });
  });
}

module.exports = {
  createApp,
  createExpressApp,
  createRouter,
  loadApiConfigurations,
  registerApiRoutes,
  findResponseFile,
  registerDashboard,
  mountSwaggerUI,
  startServer
};
