#!/usr/bin/env node

const { program } = require('commander');
const fs = require('fs');
const path = require('path');
const swaggerFetcher = require('./swagger-fetcher');
const apiClassifier = require('./api-classifier');
const endpointExtractor = require('./endpoint-extractor');
const apiRecorder = require('./api-recorder');
const expressServer = require('./express-server');
const pkg = require('../package.json');

// Configure the CLI program
program
  .name('api-mocker')
  .description('Record and mock REST APIs automatically with OData support')
  .version(pkg.version)
  .addHelpText('after', `
Examples:
  $ api-mocker record -u https://api.example.com -n example-api
  $ api-mocker record -c config.json
  $ api-mocker serve -p 8080 -s

Documentation:
  For more detailed information, visit: https://github.com/yourusername/api-mocker
`);

// Record command
program
  .command('record')
  .description('Record responses from a REST API based on its Swagger/OpenAPI specification')
  .option('-u, --url <url>', 'Base URL of the API to record (required if not using config file)')
  .option('-n, --name <name>', 'Name of the API for organization (required if not using config file)')
  .option('-a, --auth <token>', 'Authentication token (e.g. "Bearer token123") for protected APIs')
  .option('-c, --config <file>', 'JSON configuration file with multiple API definitions')
  .option('-t, --timeout <ms>', 'Request timeout in milliseconds', '10000')
  .option('-o, --output <dir>', 'Output directory for recorded responses', './data')
  .option('-f, --force', 'Force overwrite of existing recordings', false)
  .addHelpText('after', `
  Examples:
    $ api-mocker record -u https://petstore.swagger.io/v2 -n petstore
    $ api-mocker record -c apis-config.json -o ./custom-data-dir
    $ api-mocker record -u https://api.example.com -n example-api -a "Bearer token123"
  `)
  .action(async (options) => {
    try {
      // If config file is provided, load it
      if (options.config) {
        console.log(`Using configuration from ${options.config}`);
        if (!fs.existsSync(options.config)) {
          console.error(`Configuration file not found: ${options.config}`);
          process.exit(1);
        }
        
        const config = JSON.parse(fs.readFileSync(options.config, 'utf8'));
        
        // Record each API in the config
        for (const api of config.apis) {
          await recordApi(api.url, api.name, {
            authToken: api.auth || options.auth,
            timeout: parseInt(api.timeout || options.timeout),
            output: options.output,
            force: options.force,
            swaggerUrl: api.swaggerUrl // Pass the swaggerUrl if provided in config
          });
        }
      } else {
        // Validate required options
        if (!options.url) {
          console.error('Error: required option \'-u, --url <url>\' not specified');
          process.exit(1);
        }
        
        if (!options.name) {
          console.error('Error: required option \'-n, --name <name>\' not specified');
          process.exit(1);
        }
        
        // Record single API
        await recordApi(options.url, options.name, {
          authToken: options.auth,
          timeout: parseInt(options.timeout),
          output: options.output,
          force: options.force
        });
      }
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

// Serve command
program
  .command('serve')
  .description('Start the mock API server with OData support and CRUD operations')
  .option('-p, --port <port>', 'Port to listen on', '3000')
  .option('-d, --data <dir>', 'Directory containing recorded APIs and data', './data')
  .option('-h, --host <host>', 'Host to bind to', 'localhost')
  .option('-s, --stateful', 'Enable stateful mode with in-memory data store for CRUD operations', false)
  .option('-a, --api <name>', 'Serve only a specific API (single API mode)')
  .option('-b, --base-path <path>', 'Custom base path for the API (only used with --api)')
  .option('-m, --multi', 'Use multi-API server mode (default when no specific API is specified)', true)
  .addHelpText('after', `
  Examples:
    $ api-mocker serve                                # Start multi-API server with default settings
    $ api-mocker serve -p 8080                       # Start server on port 8080
    $ api-mocker serve -s                           # Start server with stateful mode enabled
    $ api-mocker serve -d ./custom-data -p 8080 -s   # Custom data directory with stateful mode
    $ api-mocker serve -a my-api                     # Serve only a specific API (single API mode)
    $ api-mocker serve -a my-api -b /custom-path     # Serve specific API with custom base path

  Notes:
    - Stateful mode (-s) enables full CRUD operations and OData query support
    - Dashboard available at http://<host>:<port>/
    - API endpoints available at http://<host>:<port>/<api-base-path>
  `)
  .action(async (options) => {
    try {
      console.log(`Starting mock server on ${options.host}:${options.port}`);
      console.log(`Using data directory: ${options.data}`);
      if (options.stateful) {
        console.log('Stateful mode enabled: API state will be maintained in memory');
      }
      
      // Determine server mode based on options
      if (options.api) {
        // Single API mode
        console.log(`Single API mode: Serving only '${options.api}'`);
        if (options.basePath) {
          console.log(`Using custom base path: ${options.basePath}`);
        }
      } else {
        // Multi-API mode
        console.log('Multi-API mode: Serving all available APIs');
      }
      
      // Create public directory for dashboard if it doesn't exist
      const publicDir = path.join(process.cwd(), 'public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      
      // Single API mode
      if (options.api) {
        // Import single-api-server module
        const singleApiServer = require('./single-api-server');
        
        // Start single API server
        await singleApiServer.createAndStartServer({
          dataDir: options.data,
          apiName: options.api,
          port: options.port,
          host: options.host,
          basePath: options.basePath,
          stateful: options.stateful
        });
      } else {
        // Multi-API mode
        // Generate dashboard
        console.log('Generating API dashboard...');
        const dashboardGenerator = require('./dashboard-generator');
        const dashboardPath = path.join(publicDir, 'index.html');
        await dashboardGenerator.writeDashboard(options.data, dashboardPath);
        await dashboardGenerator.generateAssets(publicDir);
        
        // Import multi-api-server module
        const multiApiServer = require('./multi-api-server');
        
        // Start multi-API server
        await multiApiServer.createAndStartServer({
          dataDir: options.data,
          port: options.port,
          host: options.host,
          stateful: options.stateful
        });
      }
      
      console.log(`Server started: http://${options.host}:${options.port}`);
      
      if (options.api) {
        console.log(`API available at: http://${options.host}:${options.port}${options.basePath || '/<api-base-path>'}`);
      } else {
        console.log(`Dashboard: http://${options.host}:${options.port}/`);
      }
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Records an API
 * @param {string} url - Base URL of the API
 * @param {string} name - Name of the API
 * @param {Object} options - Recording options
 */
async function recordApi(url, name, options) {
  console.log(`Recording API: ${name} from ${url}${options.authToken ? ' with authentication' : ''}`);
  
  try {
    // Create output directory
    const apiDir = path.resolve(options.output, name);
    if (!fs.existsSync(apiDir)) {
      fs.mkdirSync(apiDir, { recursive: true });
    }
    
    // Step 1: Fetch Swagger spec
    console.log('Fetching Swagger/OpenAPI specification...');
    const swaggerSpec = await swaggerFetcher.fetchSwagger(url, name, {
      authToken: options.authToken,
      output: apiDir
    });
    
    // Step 2: Classify API
    console.log('Analyzing API...');
    const apiType = await apiClassifier.classifyApi(swaggerSpec);
    console.log(`API Type: ${apiType.apiType}`);
    console.log(`Authentication Required: ${apiType.authRequired ? 'Yes' : 'No'}`);
    console.log(`OData: ${apiType.isOData ? 'Yes' : 'No'}`);
    
    // Save API classification
    fs.writeFileSync(
      path.join(apiDir, 'api-type.json'),
      JSON.stringify(apiType, null, 2)
    );
    
    // Step 3: Extract endpoints
    console.log('Extracting endpoints...');
    const endpoints = await endpointExtractor.extractEndpoints(swaggerSpec, apiType);
    console.log(`Found ${endpoints.length} endpoints`);
    
    // Save endpoints
    fs.writeFileSync(
      path.join(apiDir, 'endpoints.json'),
      JSON.stringify(endpoints, null, 2)
    );
    
    // Step 4: Record responses
    console.log('Recording responses...');
    await apiRecorder.recordResponses(url, name, swaggerSpec, endpoints, {
      authToken: options.authToken,
      timeout: options.timeout,
      force: options.force
    });
    
    console.log(`Recording completed for API: ${name}`);
    
  } catch (error) {
    console.error(`Error recording API: ${error.message}`);
    throw error;
  }
}

/**
 * Display a custom welcome message with usage instructions
 */
function displayWelcome() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║                  Welcome to API Mocker                     ║
║                                                            ║
║  A powerful tool for recording and mocking REST APIs       ║
║  with full OData support and stateful CRUD operations      ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`);
  console.log('Usage: api-mocker [options] [command]');
  console.log('');
  console.log('Commands:');
  console.log('  record [options]    Record responses from a REST API based on its Swagger/OpenAPI spec');
  console.log('  serve [options]     Start the mock API server with OData support and CRUD operations');
  console.log('');
  console.log('Common Options:');
  console.log('  -V, --version      Output the version number');
  console.log('  -h, --help         Display help for command');
  console.log('');
  console.log('Examples:');
  console.log('  $ api-mocker record -u https://api.example.com -n example-api');
  console.log('  $ api-mocker record -c config.json');
  console.log('  $ api-mocker serve -p 8080 -s');
  console.log('');
  console.log('For detailed help and options, run:');
  console.log('  api-mocker --help');
  console.log('  api-mocker record --help');
  console.log('  api-mocker serve --help');
  console.log('');
}

// Check for arguments before parsing to handle the no-args case
if (!process.argv.slice(2).length) {
  displayWelcome();
  process.exit(0);
}

// Parse command line arguments
program.parse(process.argv);

module.exports = {
  program,
  displayWelcome
};
