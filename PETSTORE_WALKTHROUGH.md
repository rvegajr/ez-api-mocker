# Petstore API Mocking Walkthrough

This walkthrough demonstrates how to use EZ API Mocker to create a mock Petstore API from scratch.

## 1. Setup

First, ensure you have EZ API Mocker installed and its dependencies:

```bash
cd ApiMocker
npm install
```

## 2. Recording the Petstore API

The Swagger Petstore is a common example API used for demonstration purposes. We'll use it to show how EZ API Mocker works.

### 2.1 Record the API

```bash
node src/cli.js record --url https://petstore.swagger.io/v2 --name petstore
```

This command will:
1. Discover the Swagger specification at https://petstore.swagger.io/v2/swagger.json
2. Extract all endpoints from the specification
3. Make requests to each endpoint to record sample responses
4. Save all data to the `./data/petstore` directory

You'll see output similar to:

```
Recording API: petstore from https://petstore.swagger.io/v2
Fetching Swagger/OpenAPI specification...
✅ Found and saved Swagger spec at https://petstore.swagger.io/v2/swagger.json
Analyzing API...
API Type: REST
Authentication Required: false
OData: false
Extracting endpoints...
Found 20 endpoints
Recording responses...
Recording GET /pet/findByStatus...
Recording GET /pet/{petId}...
Recording POST /pet/{petId}...
...
Recording completed for API: petstore
```

### 2.2 Examine the Recorded Data

After recording, you'll have a directory structure like:

```
data/
  └── petstore/
      ├── swagger.json         # The Swagger specification
      ├── api-type.json        # API classification information
      ├── endpoints.json       # Extracted endpoint information
      └── responses/           # Recorded responses
          ├── get_pet_findbystatus.json
          ├── get_pet_petid.json
          ├── post_pet.json
          └── ...
```

## 3. Starting the Mock Server

Now that we've recorded the Petstore API, let's start the mock server:

```bash
node src/cli.js serve --port 3010 --data ./data --api petstore
```

This command:
1. Starts a server on port 3010
2. Loads the Petstore API data from the `./data` directory
3. Sets up routes for all recorded endpoints
4. Mounts the Swagger UI for interactive documentation

You'll see output similar to:

```
Starting mock server on localhost:3010
Using data directory: ./data
Single API mode: Serving only 'petstore'
Initialized data store for API: petstore
Registering API routes for petstore at base path: /api/v1
...
Mounted Swagger UI at /api-docs
Swagger JSON available at /swagger.json
Mounted API: petstore at /api/v1
Server started: http://localhost:3010
API available at: http://localhost:3010/api/v1
```

## 4. Exploring the Mock API

### 4.1 Visit the Home Page

Open your browser and navigate to http://localhost:3010/

You'll see a beautiful dashboard with:
- API information (name, description, version)
- Links to documentation
- List of available endpoints

### 4.2 Using the Swagger UI

Click on "Open Swagger UI" or navigate to http://localhost:3010/api-docs

This interactive documentation allows you to:
- Browse all available endpoints
- See request and response schemas
- Test endpoints directly from the browser
- View example responses

### 4.3 Making API Requests

You can make requests to the mock API using curl or any HTTP client:

```bash
# Get available pets
curl http://localhost:3010/api/v1/pet/findByStatus?status=available

# Get a specific pet
curl http://localhost:3010/api/v1/pet/1

# Create a new pet
curl -X POST -H "Content-Type: application/json" -d '{"id": 100, "name": "Fluffy", "status": "available"}' http://localhost:3010/api/v1/pet
```

## 5. Customizing Responses

You can customize the responses for specific endpoints by editing the JSON files in the `data/petstore/responses` directory.

### 5.1 Default Responses

Create default responses for HTTP methods when no specific response file is found:

```json
// data/petstore/responses/get_default.json
{
  "message": "Default GET response",
  "status": "success"
}
```

```json
// data/petstore/responses/post_default.json
{
  "message": "Resource created successfully",
  "id": 999
}
```

### 5.2 Endpoint-Specific Responses

Modify specific endpoint responses:

```json
// data/petstore/responses/get_pet_findbystatus.json
[
  {
    "id": 1,
    "name": "Fluffy",
    "category": {"id": 1, "name": "Cats"},
    "photoUrls": ["https://example.com/pet1.jpg"],
    "tags": [{"id": 1, "name": "cute"}, {"id": 2, "name": "fluffy"}],
    "status": "available"
  },
  {
    "id": 2,
    "name": "Rex",
    "category": {"id": 2, "name": "Dogs"},
    "photoUrls": ["https://example.com/pet2.jpg"],
    "tags": [{"id": 3, "name": "loyal"}, {"id": 4, "name": "friendly"}],
    "status": "available"
  }
]
```

## 6. Advanced Usage

### 6.1 Using with Authentication

If the API requires authentication, you can record and serve it with auth tokens:

```bash
# Record with authentication
node src/cli.js record --url https://secure-api.example.com --name secure-api --auth "Bearer YOUR_TOKEN"

# Serve with authentication requirement
node src/cli.js serve --api secure-api
```

### 6.2 Multi-API Mode

You can serve multiple APIs simultaneously:

```bash
# Serve all recorded APIs
node src/cli.js serve --port 3010
```

This will mount each API at its own base path and provide a dashboard to navigate between them.

## 7. Troubleshooting

### Common Issues

1. **404 Not Found**: Check that the endpoint path matches exactly what's in the Swagger specification
2. **CORS Errors**: The mock server has CORS enabled by default, but you may need to adjust your client settings
3. **Authentication Errors**: Ensure you're providing the correct authentication token format

### Logs

Check the server logs for detailed information about requests and responses:

```
[DEBUG] GET /api/v1/pet/findByStatus?status=available
Checking response files for GET /pet/findByStatus:
 - data/petstore/responses/get_pet_findByStatus.json
 - data/petstore/responses/get_pet_findByStatus
 - data/petstore/responses/GET_pet_findByStatus.json
 - data/petstore/responses/getpetfindByStatus.json
 - data/petstore/responses/get_default.json
Found response file: data/petstore/responses/get_pet_findByStatus.json
```

## Conclusion

You now have a fully functional mock of the Petstore API that you can use for development and testing. This approach allows you to:

1. Work offline without depending on the actual API
2. Test edge cases and error scenarios
3. Develop against APIs that are still under construction
4. Avoid rate limits and other production API restrictions

EZ API Mocker makes the process of mocking APIs simple and efficient, allowing you to focus on your application development.
