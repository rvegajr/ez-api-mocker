const fs = require('fs');
const path = require('path');
const crudHandler = require('./crud-handler');
const odataQueryProcessor = require('./odata-query-processor');
const odataResponseFormatter = require('./odata-response-formatter');
const odataRelationshipHandler = require('./odata-relationship-handler');
const odataSpecialEndpoints = require('./odata-special-endpoints');

/**
 * Registers a route with the Express app
 * @param {Object} app - Express application
 * @param {string} method - HTTP method (get, post, put, delete, etc.)
 * @param {string} routePath - Route path including path parameters
 * @param {Object} operation - Swagger operation object
 * @param {Object} config - API configuration
 */
function registerRoute(app, method, routePath, operation, config) {
  // Ensure the method is supported
  if (!app[method]) {
    console.warn(`Unsupported HTTP method: ${method}`);
    return;
  }
  
  // Initialize CRUD data store if stateful mode is enabled
  if (config.stateful !== false) {
    crudHandler.initializeDataStore(config.apiName, config);
    
    // Try to load initial data if available
    if (config.dataDir) {
      crudHandler.loadInitialData(config.apiName, config.dataDir);
    }
  }
  
  // Register the route with Express
  app[method](routePath, (req, res) => {
    try {
      // Extract collection name from path (e.g., /pets -> pets)
      const pathParts = routePath.split('/');
      const collectionName = pathParts[pathParts.length - 1].replace(/[{}]/g, '');
      
      // Handle CRUD operations if stateful mode is enabled
      if (config.stateful !== false && ['post', 'put', 'patch', 'delete'].includes(method)) {
        return handleCrudOperation(method, req, res, config.apiName, collectionName, operation);
      }
      
      // For GET requests or if stateful mode is disabled, use file-based responses
      // Generate the response filename based on operationId
      const fileBaseName = operation.operationId
        .replace(/[^a-zA-Z0-9]/g, '_')
        .toLowerCase();
      
      // Determine content type and file extension
      let contentType = 'application/json';
      let fileExtension = '.json';
      
      // Check if this is a binary response
      if (operation.produces && 
          (operation.produces.includes('application/octet-stream') ||
           operation.produces.includes('image/') ||
           operation.produces.includes('audio/') ||
           operation.produces.includes('video/'))) {
        contentType = operation.produces[0];
        fileExtension = '.bin';
      }
      
      // Construct the response file path
      const responseFilePath = path.join(
        config.responsesDir,
        `${fileBaseName}${fileExtension}`
      );
      
      // Check if the response file exists
      if (!fs.existsSync(responseFilePath)) {
        console.warn(`Response file not found: ${responseFilePath}`);
        res.status(404).json({
          error: 'Mock response not found',
          message: `No mock response available for ${req.method} ${req.path}`,
          operationId: operation.operationId
        });
        return;
      }
      
      // Read the response file
      const responseContent = fs.readFileSync(responseFilePath, 
        fileExtension === '.bin' ? null : 'utf8');
      
      // Parse JSON responses or handle binary data
      if (fileExtension === '.json') {
        const responseData = JSON.parse(responseContent);
        
        // Check if this is an error response
        if (responseData.error === true && responseData.statusCode) {
          res.status(responseData.statusCode).json(responseData);
          return;
        }
        
        // Determine response status code
        let statusCode = 200;
        if (method === 'post') {
          statusCode = 201;
        } else if (method === 'delete') {
          statusCode = 204;
          // If the response is empty, don't send a body
          if (Object.keys(responseData).length === 0) {
            res.status(statusCode).end();
            return;
          }
        }
        
        // Send the JSON response
        res.status(statusCode).json(responseData);
      } else {
        // Send binary response
        res.status(200)
          .set('Content-Type', contentType)
          .set('Content-Length', responseContent.length)
          .send(responseContent);
      }
      
      // Log the request
      console.log(`${req.method} ${req.path} => ${
        fileExtension === '.json' ? '200 OK (JSON)' : '200 OK (Binary)'
      }`);
      
    } catch (error) {
      console.error(`Error handling ${req.method} ${req.path}: ${error.message}`);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  });
}

/**
 * Handles CRUD operations using the in-memory data store
 * @param {string} method - HTTP method (post, put, patch, delete)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {string} apiName - Name of the API
 * @param {string} collectionName - Name of the collection
 * @param {Object} operation - Swagger operation object
 * @returns {void}
 */
function handleCrudOperation(method, req, res, apiName, collectionName, operation) {
  try {
    // Extract ID from path parameters if present
    const id = req.params.id || req.params[collectionName + 'Id'];
    
    // Options for CRUD operations
    const options = {
      timestamps: true
    };
    
    switch (method) {
      case 'post':
        // Create new item
        const createdItem = crudHandler.handlePost(apiName, collectionName, req.body, options);
        res.status(201).json(createdItem);
        console.log(`POST ${req.path} => 201 Created`);
        break;
        
      case 'put':
        // Replace existing item
        if (!id) {
          res.status(400).json({
            error: 'Bad Request',
            message: 'ID is required for PUT operations'
          });
          return;
        }
        
        const updatedItem = crudHandler.handlePut(apiName, collectionName, id, req.body, options);
        if (!updatedItem) {
          res.status(404).json({
            error: 'Not Found',
            message: `Item with ID ${id} not found`
          });
          return;
        }
        
        res.status(200).json(updatedItem);
        console.log(`PUT ${req.path} => 200 OK`);
        break;
        
      case 'patch':
        // Partially update existing item
        if (!id) {
          res.status(400).json({
            error: 'Bad Request',
            message: 'ID is required for PATCH operations'
          });
          return;
        }
        
        const patchedItem = crudHandler.handlePatch(apiName, collectionName, id, req.body, options);
        if (!patchedItem) {
          res.status(404).json({
            error: 'Not Found',
            message: `Item with ID ${id} not found`
          });
          return;
        }
        
        res.status(200).json(patchedItem);
        console.log(`PATCH ${req.path} => 200 OK`);
        break;
        
      case 'delete':
        // Delete existing item
        if (!id) {
          res.status(400).json({
            error: 'Bad Request',
            message: 'ID is required for DELETE operations'
          });
          return;
        }
        
        const deleted = crudHandler.handleDelete(apiName, collectionName, id);
        if (!deleted) {
          res.status(404).json({
            error: 'Not Found',
            message: `Item with ID ${id} not found`
          });
          return;
        }
        
        res.status(204).end();
        console.log(`DELETE ${req.path} => 204 No Content`);
        break;
    }
  } catch (error) {
    console.error(`Error handling CRUD operation: ${error.message}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
}

/**
 * Registers a custom dynamic route with additional logic
 * @param {Object} app - Express application
 * @param {string} method - HTTP method (get, post, put, delete, etc.)
 * @param {string} routePath - Route path including path parameters
 * @param {Function} handler - Custom handler function
 */
function registerDynamicRoute(app, method, routePath, handler) {
  // Ensure the method is supported
  if (!app[method]) {
    console.warn(`Unsupported HTTP method: ${method}`);
    return;
  }
  
  // Register the route with Express
  app[method](routePath, handler);
  
  console.log(`Registered dynamic route: ${method.toUpperCase()} ${routePath}`);
}

/**
 * Registers OData-specific routes
 * @param {Object} app - Express application
 * @param {string} basePath - Base path for the OData API
 * @param {Object} config - API configuration
 */
function registerODataRoutes(app, basePath, config) {
  // Add OData headers to all responses
  app.use(basePath, (req, res, next) => {
    odataSpecialEndpoints.addODataHeaders(res);
    next();
  });
  
  // Register OData service document route
  app.get(`${basePath}`, (req, res) => {
    try {
      // Check if service document exists in file
      const serviceDocPath = path.join(config.responsesDir, 'service-document.json');
      if (fs.existsSync(serviceDocPath)) {
        // Use existing service document
        const serviceDoc = JSON.parse(fs.readFileSync(serviceDocPath, 'utf8'));
        res.json(serviceDoc);
        return;
      }
      
      // Generate service document dynamically
      const serviceDoc = odataSpecialEndpoints.generateServiceDocument(
        `${req.protocol}://${req.get('host')}${basePath}`,
        config
      );
      res.json(serviceDoc);
      
    } catch (error) {
      console.error(`Error handling OData service document request: ${error.message}`);
      res.status(500).json(
        odataResponseFormatter.formatError(
          'InternalServerError',
          `Error handling OData service document request: ${error.message}`
        )
      );
    }
  });
  
  // Register OData $metadata route
  app.get(`${basePath}/$metadata`, (req, res) => {
    try {
      // Check if metadata document exists in file
      const metadataPath = path.join(config.responsesDir, '$metadata.xml');
      if (fs.existsSync(metadataPath)) {
        // Use existing metadata document
        const metadata = fs.readFileSync(metadataPath, 'utf8');
        res.type('application/xml').send(metadata);
        return;
      }
      
      // Generate metadata document dynamically
      const metadata = odataSpecialEndpoints.generateMetadata(config);
      res.type('application/xml').send(metadata);
      
    } catch (error) {
      console.error(`Error handling OData $metadata request: ${error.message}`);
      res.status(500).json(
        odataResponseFormatter.formatError(
          'InternalServerError',
          `Error handling OData $metadata request: ${error.message}`
        )
      );
    }
  });
  
  // Register OData $batch route
  app.post(`${basePath}/$batch`, (req, res) => {
    try {
      odataSpecialEndpoints.handleBatch(req, res, config);
    } catch (error) {
      console.error(`Error handling OData $batch request: ${error.message}`);
      res.status(500).json(
        odataResponseFormatter.formatError(
          'InternalServerError',
          `Error handling OData $batch request: ${error.message}`
        )
      );
    }
  });
  
  // Register collection routes for each entity set
  const collections = odataSpecialEndpoints.getCollections(config.apiName);
  for (const collection of collections) {
    // Register collection route (e.g., /Products)
    app.get(`${basePath}/${collection}`, (req, res) => {
      try {
        // Get query options from request
        const queryOptions = extractODataQueryOptions(req.query);
        
        // Get data from the collection
        const data = crudHandler.getAll(config.apiName, collection);
        
        // Process the query
        const processedData = odataQueryProcessor.processQuery(data, queryOptions);
        
        // Format the response
        const response = odataResponseFormatter.formatResponse(processedData.value, {
          context: `${req.protocol}://${req.get('host')}${basePath}/$metadata#${collection}`,
          count: queryOptions.$count === 'true' ? processedData['@odata.count'] : undefined
        });
        
        res.json(response);
        
      } catch (error) {
        console.error(`Error handling OData collection request: ${error.message}`);
        res.status(500).json(
          odataResponseFormatter.formatError(
            'InternalServerError',
            `Error handling OData collection request: ${error.message}`
          )
        );
      }
    });
    
    // Register entity route (e.g., /Products(1))
    app.get(`${basePath}/${collection}/:id`, (req, res) => {
      try {
        const id = req.params.id;
        
        // Get query options from request
        const queryOptions = extractODataQueryOptions(req.query);
        
        // Get the entity
        const entity = crudHandler.getById(config.apiName, collection, id);
        
        if (!entity) {
          res.status(404).json(
            odataResponseFormatter.formatError(
              'EntityNotFound',
              `Entity with ID ${id} not found in collection ${collection}`
            )
          );
          return;
        }
        
        // Apply $expand if requested
        let result = entity;
        if (queryOptions.$expand) {
          result = odataRelationshipHandler.applyExpand(entity, queryOptions.$expand, {
            apiName: config.apiName
          });
        }
        
        // Format the response
        const response = odataResponseFormatter.formatResponse(result, {
          context: `${req.protocol}://${req.get('host')}${basePath}/$metadata#${collection}/$entity`
        });
        
        res.json(response);
        
      } catch (error) {
        console.error(`Error handling OData entity request: ${error.message}`);
        res.status(500).json(
          odataResponseFormatter.formatError(
            'InternalServerError',
            `Error handling OData entity request: ${error.message}`
          )
        );
      }
    });
  }
  
  console.log(`Registered OData routes for ${basePath}`);
}

/**
 * Extracts OData query options from request query parameters
 * @param {Object} query - Express request query object
 * @returns {Object} OData query options
 */
function extractODataQueryOptions(query) {
  const odataOptions = {};
  
  // List of OData query options
  const ODATA_QUERY_OPTIONS = [
    '$select', '$expand', '$filter', '$orderby', 
    '$top', '$skip', '$count', '$search', '$format'
  ];
  
  // Extract OData query options
  for (const option of ODATA_QUERY_OPTIONS) {
    if (query[option] !== undefined) {
      odataOptions[option] = query[option];
    }
  }
  
  return odataOptions;
}

module.exports = {
  registerRoute,
  registerDynamicRoute,
  registerODataRoutes
};
