# API Mocker

A comprehensive tool to automatically discover, record, and mock REST APIs and OData services from Swagger/OpenAPI specifications with real response data.

## Features

- **Automatic Swagger Discovery**: Automatically finds Swagger/OpenAPI specs at common paths
- **API Classification**: Detects API types (REST, OData, GraphQL) and authentication requirements
- **Comprehensive Recording**: Records responses from all HTTP verbs (GET, POST, PUT, DELETE, PATCH)
- **OData Support**: Special handling for OData services, including $metadata, $select, $expand, and other query options
- **Pagination Handling**: Detects and handles different pagination formats (standard, OData, cursor-based)
- **Large Response Management**: Truncates and summarizes large responses for better performance
- **Multi-API Support**: Serves multiple APIs simultaneously, each with its own base path
- **Dashboard Interface**: Visual dashboard showing all available APIs and endpoints
- **Authentication Support**: Handles bearer tokens and other authentication methods
- **CORS Support**: Built-in CORS handling for cross-origin requests

## Installation

```bash
# Navigate to the ApiMocker directory
cd /Users/rickyvega/Dev/AlliedPilots/APAPilot/APA.PilotAdmin/_Resources/ApiMocker

# Install dependencies
npm install
```

## Quick Start

### Record API Responses

```bash
# Basic recording (no authentication)
node src/cli.js record --url http://your-api-url.com --name your-api-name

# With authentication token
node src/cli.js record --url http://your-api-url.com --name your-api-name --auth "Bearer YOUR_TOKEN"

# Using a configuration file
node src/cli.js record --config api-config.json
```

### Start Mock Server

```bash
# Start on default port (3000)
node src/cli.js serve

# Start on custom port
node src/cli.js serve --port 8080

# Specify data directory
node src/cli.js serve --data ./my-api-data --port 8080

# Start with stateful mode enabled (supports CRUD operations and OData queries)
node src/cli.js serve --stateful
```

## Usage Examples

### Example 1: Record from APA.PilotApi

```bash
node src/cli.js record --url http://localhost:5000 --name pilot-api --auth "Bearer eyJhbGc..."
```

### Example 2: Start Mock Server on Port 15002

```bash
node src/cli.js serve --port 15002
```

### Example 3: Record Multiple APIs Using Configuration

Create a configuration file `api-config.json`:

```json
{
  "apis": [
    {
      "name": "pilot-api",
      "url": "http://localhost:5000",
      "auth": "Bearer eyJhbGc..."
    },
    {
      "name": "weather-api",
      "url": "https://weather-api.example.com",
      "timeout": 15000
    }
  ]
}
```

Then run:

```bash
node src/cli.js record --config api-config.json
```

## Configuration Options

### Record Command Options

| Option | Description | Default |
|--------|-------------|----------|
| `-u, --url` | Base URL of the API to record | (Required) |
| `-n, --name` | Name of the API (used for directory structure) | (Required) |
| `-a, --auth` | Authentication token (e.g. "Bearer token123") | None |
| `-c, --config` | Configuration file (JSON format) | None |
| `-t, --timeout` | Request timeout in milliseconds | 10000 |
| `-o, --output` | Output directory | ./data |
| `-f, --force` | Force overwrite of existing recordings | false |

### Serve Command Options

| Option | Description | Default |
|--------|-------------|----------|
| `-p, --port` | Port to listen on | 3000 |
| `-d, --data` | Data directory containing recorded APIs | ./data |
| `-h, --host` | Host to bind to | localhost |
| `-s, --stateful` | Enable stateful mode with in-memory data store | false |

## How It Works

### Recording Process

1. **Swagger Discovery**: The recorder discovers and fetches the Swagger/OpenAPI specification from your API
2. **API Classification**: The API is classified as REST, OData, or GraphQL, with authentication requirements detected
3. **Endpoint Extraction**: All endpoints are extracted from the specification, including parameters and response schemas
4. **Response Recording**: The recorder calls each endpoint with appropriate parameters and records the responses
5. **OData Handling**: For OData APIs, the recorder also fetches $metadata and records responses with various query options
6. **Pagination Processing**: For paginated endpoints, the recorder fetches all pages and creates both individual page responses and a combined response

### Mock Server

1. **API Configuration Loading**: The server loads all recorded API configurations from the data directory
2. **Route Registration**: Routes are registered for each API based on its Swagger specification
3. **Request Handling**: Incoming requests are matched to recorded responses based on path, method, and parameters
4. **OData Support**: Special routes handle OData-specific requests like $metadata and query options
5. **Dashboard**: A web dashboard provides an overview of all available APIs and endpoints

## Troubleshooting

### Recording Issues

- **Swagger Discovery Fails**: Provide the exact URL to your swagger.json file using the --url option
- **Authentication Issues**: Ensure your token is valid and properly formatted. For Bearer tokens, include "Bearer " prefix
- **Timeout Errors**: Increase the timeout with --timeout option (e.g., --timeout 30000 for 30 seconds)
- **Large Responses**: Large responses are automatically truncated but can cause memory issues

### Server Issues

- **Port Conflicts**: Change the port using the --port option
- **CORS Errors**: The mock server has CORS enabled by default, but you might need to add specific origins
- **Missing Responses**: Ensure all APIs were properly recorded with successful responses
- **Performance Issues**: For very large APIs, consider serving only the needed APIs

### Common Error Messages

- "No Swagger/OpenAPI specification found": The API doesn't expose a Swagger spec at common paths
- "Failed to record endpoint": The endpoint returned an error during recording
- "Response file not found": The mock server couldn't find a recorded response for the requested path

## Directory Structure

After recording APIs, the data directory will have the following structure:

```
data/
  ├── api-name1/
  │   ├── swagger.json         # The Swagger/OpenAPI specification
  │   ├── api-type.json        # API classification information
  │   ├── endpoints.json       # Extracted endpoint information
  │   ├── responses/           # Recorded responses
  │   │   ├── get_users.json   # Response for GET /users
  │   │   ├── get_user_1.json  # Response for GET /users/1
  │   │   └── ...
  │   └── relationships.json   # Entity relationships (OData)
  ├── api-name2/
  │   └── ...
  └── ...
```

## Stateful Mode and CRUD Operations

API Mocker supports a stateful mode that maintains an in-memory data store, enabling full CRUD operations:

- **In-Memory Data Store**: Maintains data between requests for realistic API interactions
- **Data Loading**: Automatically loads initial data from JSON files in the data directory
- **CRUD Operations**: Supports POST, PUT, PATCH, and DELETE operations
- **Data Persistence**: Changes to the data store persist until the server is restarted
- **Idempotent Operations**: Properly handles idempotent methods according to HTTP standards

To enable stateful mode, use the `--stateful` flag when starting the server:

```bash
node src/cli.js serve --stateful
```

## OData Support

This tool has comprehensive support for OData services:

- **Metadata Handling**: Automatically fetches and parses $metadata documents
- **Entity Relationships**: Extracts entity relationships for proper $expand handling
- **Query Options**: Full support for OData query options:
  - **$select**: Select specific properties
  - **$filter**: Filter entities based on property values
  - **$orderby**: Sort results by one or more properties
  - **$top/$skip**: Pagination support
  - **$count**: Include count of total items
  - **$expand**: Include related entities
- **Pagination**: Handles OData pagination with @odata.nextLink
- **Entity Sets**: Discovers and records all available entity sets
- **Special Endpoints**: Supports $metadata and service document endpoints

### Using OData Queries

When the server is running in stateful mode, you can use OData query options to filter, sort, and shape the data. Here are some examples:

```
# Select only specific properties
http://localhost:3000/v2/pets?$select=id,name,type

# Filter by property value
http://localhost:3000/v2/pets?$filter=type eq 'dog'

# Sort by name in descending order
http://localhost:3000/v2/pets?$orderby=name desc

# Pagination
http://localhost:3000/v2/pets?$top=2&$skip=1

# Include count of total items
http://localhost:3000/v2/pets?$count=true

# Expand related entities
http://localhost:3000/v2/pets?$expand=orders

# Combine multiple options
http://localhost:3000/v2/pets?$select=id,name&$filter=type eq 'cat'&$orderby=name&$top=5
```

### OData Special Endpoints

```
# Get metadata document
http://localhost:3000/v2/$metadata

# Get service document
http://localhost:3000/v2
```

## Extending

### Adding Custom Response Handlers

To add custom response behavior:

1. Create a new handler in the `src/` directory
2. Register your custom handler in `route-handler.js`
3. Use `registerDynamicRoute` to add routes with custom logic

### Supporting Additional API Types

To add support for new API types:

1. Update the `api-classifier.js` file to detect the new API type
2. Create a specialized recorder for the new API type
3. Add appropriate handlers in the mock server

## Contributing

Contributions are welcome! Here are some ways you can contribute:

- Report bugs and request features by creating issues
- Improve documentation
- Add support for new API types
- Enhance existing functionality
- Write additional tests

## License

MIT

## Acknowledgements

- [Swagger/OpenAPI](https://swagger.io/) for API specification
- [Express](https://expressjs.com/) for the HTTP server
- [Commander.js](https://github.com/tj/commander.js/) for the CLI interface
- [Axios](https://axios-http.com/) for HTTP requests
