# API Mocker - Test-Driven Implementation Checklist

## Mission
Create a robust, test-driven tool that automatically generates a mock API from Swagger/OpenAPI specifications with full support for all HTTP verbs and OData capabilities.

## Test-Driven Development Approach

This checklist is organized around a strict test-driven development (TDD) workflow. For each component:

1. **Write the test first** - Define expected behavior before implementation
2. **Run the test and watch it fail** - Verify the test correctly identifies missing functionality
3. **Implement the minimal code to pass** - Write just enough code to make the test pass
4. **Run the test and see it pass** - Verify the implementation meets requirements
5. **Refactor** - Improve the code while keeping tests passing

Each module should have corresponding test files created **before** implementation begins.

## Phase 1: Project Setup & Core Testing Framework

### 1.1 Project Structure (Day 1 - Morning)
- [x] **TEST**: Create test to verify project structure exists
- [x] Create package.json with dependencies:
  ```json
  {
    "dependencies": {
      "axios": "^1.6.2",
      "express": "^4.18.2",
      "swagger-parser": "^10.1.0",
      "commander": "^11.1.0",
      "cors": "^2.8.5"
    },
    "devDependencies": {
      "jest": "^29.7.0",
      "supertest": "^6.3.3",
      "nock": "^13.4.0",
      "mock-fs": "^5.2.0"
    },
    "scripts": {
      "test": "jest",
      "test:watch": "jest --watch",
      "record": "node src/index.js record",
      "serve": "node src/index.js serve"
    }
  }
  ```
- [x] Create folder structure:
  - `/src` - Source code
  - `/tests` - Test files
  - `/data` - For storing recorded API responses
  - `/config` - Configuration files

### 1.2 Test Infrastructure (Day 1 - Morning)
- [x] **TEST**: Create tests/setup.js for Jest configuration
- [ ] Configure Jest in package.json:
  ```json
  "jest": {
    "testEnvironment": "node",
    "setupFilesAfterEnv": ["./tests/setup.js"],
    "collectCoverage": true,
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 80
      }
    }
  }
  ```
- [ ] Create helper functions for common test operations
- [ ] Set up test fixtures for different API types (REST, OData)

## Phase 2: Swagger Discovery & API Analysis

### 2.1 Swagger Fetcher Module (Day 1 - Afternoon)
- [x] **TEST**: Write tests for swagger-fetcher.js
  - Test discovery at multiple common paths
  - Test direct URL input
  - Test error handling for unavailable swagger
  - Test parsing invalid swagger files
- [x] Implement Swagger discovery function with common paths:
  - `/swagger/v1/swagger.json`
  - `/swagger.json`
  - `/api-docs/swagger.json`
  - `/openapi.json`
- [x] Add support for direct URL input
- [x] Implement error handling for failed discovery
- [x] Save discovered Swagger spec to API-specific directory

### 2.2 API Classification Module (Day 1 - Afternoon)
- [x] **TEST**: Write tests for api-classifier.js
  - Test OData detection
  - Test REST API detection
  - Test GraphQL detection
- [x] Implement API type detection logic
- [x] Create classification records for discovered APIs
- [x] Add detection for authentication requirements

### 2.3 Endpoint Extractor Module (Day 2 - Morning)
- [x] **TEST**: Write tests for endpoint-extractor.js
  - Test extraction of GET endpoints
  - Test extraction of POST/PUT/DELETE endpoints
  - Test parameter extraction
  - Test extraction from different Swagger versions
- [x] Implement endpoint extraction from Swagger spec
- [x] Categorize endpoints by HTTP method
- [x] Extract request/response schemas
- [x] Identify path and query parameters

## Phase 3: Recording Engine

### 3.1 API Recorder Core (Day 2 - Morning)
- [x] **TEST**: Write tests for api-recorder.js
  - Test recording from mock API (using nock)
  - Test authentication handling
  - Test error handling
  - Test recording with timeouts
- [x] Implement API recording functionality
- [x] Add authentication support (token via header)
- [x] Create directory structure for responses
- [x] Implement logging during recording process

### 3.2 GET Request Handler (Day 2 - Afternoon)
- [x] **TEST**: Write tests for get-request-handler.js
  - Test basic GET requests
  - Test GET with query parameters
  - Test GET with path parameters
  - Test handling of different response types
- [x] Implement GET endpoint calling logic
- [x] Handle path and query parameters
- [x] Process and normalize responses
- [x] Save responses to structured JSON files

### 3.3 OData Recording Support (Day 3 - Morning)
- [x] **TEST**: Write tests for odata-recorder.js
  - Test $metadata document fetching
  - Test entity relationships extraction
  - Test OData query options ($select, $expand, etc.)
  - Test service document handling
- [x] Implement OData-specific recording logic
- [x] Record $metadata document
- [x] Test and record responses with query options
- [x] Extract entity relationships
- [x] Handle OData-specific response formats

### 3.4 Pagination & Large Response Handling (Day 3 - Afternoon)
- [x] **TEST**: Write tests for pagination-handler.js
  - Test pagination detection
  - Test large response handling
  - Test response truncation
- [x] Implement pagination detection and handling
- [x] Add support for OData query options recordings
- [x] Implement size limits for large responses
- [x] Create summarized versions of large responses

## Phase 4: Mock Server Implementation

### 4.1 Express Server Setup (Day 4 - Morning)
- [x] **TEST**: Write tests for express-server.js
  - Test server setup
  - Test API route registration
  - Test middleware configuration
- [x] Create Express app with middleware
- [x] Implement configuration loading
- [x] Add dashboard UI for API overview
- [x] Create route registration mechanism
- [x] Implement dynamic port configuration
- [x] Add error handling middleware

### 4.2 Route Handler Module (Day 4 - Afternoon)
- [x] **TEST**: Write tests for route-handler.js
  - Test route registration for GET endpoints
  - Test route registration for POST/PUT/DELETE endpoints
  - Test path parameter handling
  - Test query parameter handling
- [x] Implement dynamic route registration
- [x] Handle path and query parameters
- [x] Support different HTTP verbs
- [x] Create response handler types and headers
- [x] Handle path parameters in routes

### 4.3 Mock Server Implementation (Day 5 - Morning)
- [x] **TEST**: Write tests for mock-server.js
  - Test API configuration loading
  - Test multiple API support
  - Test route registration
- [x] Implement mock server using express-server
- [x] Support file-based mock responses
- [x] Add content negotiation
- [x] Implement parameter matching

### 4.4 CRUD Operations Handler (Day 5 - Afternoon)
- [x] **TEST**: Write tests for crud-handler.js
  - Test POST operations
  - Test PUT operations
  - Test DELETE operations
  - Test PATCH operations
  - Test state management
- [x] Implement in-memory data store
- [x] Create POST handler with ID generation
- [x] Create PUT/PATCH handlers for updates
- [x] Create DELETE handler
- [x] Implement state tracking

## Phase 5: OData Support

### 5.1 OData Query Processor (Day 6 - Morning)
- [x] **TEST**: Write tests for odata-query-processor.js
  - Test $select functionality
  - Test $filter functionality
  - Test $orderby functionality
  - Test $top/$skip functionality
  - Test $count functionality
- [x] Implement OData $metadata fetching and parsing
- [x] Create handlers for each query option
- [x] Implement filter expression evaluation
- [x] Add sorting and pagination logic

### 5.2 OData Response Formatter (Day 6 - Afternoon)
- [x] **TEST**: Write tests for odata-response-formatter.js
  - Test envelope format
  - Test metadata inclusion
  - Test error responses
- [x] Implement OData response envelope formatting
- [x] Add metadata generation
- [x] Create proper OData error responses
- [x] Handle content negotiation

### 5.3 OData Entity Relationships (Day 7 - Morning)
- [x] **TEST**: Write tests for odata-relationship-handler.js
  - Test $expand functionality
  - Test nested $expand
  - Test relationship navigation
- [x] Implement entity relationship detection
- [x] Create $expand handler
- [x] Add support for nested expansions
- [x] Implement navigation properties

### 5.4 OData Specific Endpoints (Day 7 - Afternoon)
- [x] **TEST**: Write tests for odata-special-endpoints.js
  - Test $metadata endpoint
  - Test service document
  - Test batch operations
- [x] Implement $metadata endpoint
- [x] Create service document endpoint
- [x] Add batch operation support (if needed)
- [x] Handle OData-specific headers

## Phase 6: Contract Testing & Swagger Integration

### 6.1 Universal Contract Testing Framework (Day 8 - Morning)
- [x] **TEST**: Write tests for api-contract-tester.js
  - Test endpoint discovery for multiple API types (REST, OData, GraphQL)
  - Test metadata discovery and parsing for each API type
  - Test entity/resource validation across API types
  - Test capability detection for protocol-specific features
  - Test graceful degradation when metadata unavailable
- [x] Implement universal endpoint discovery mechanism
- [x] Create protocol detection to identify API type (REST, OData, GraphQL)
- [x] Implement EDMX parser for OData using fast-xml-parser
- [x] Add REST resource mapping from Swagger/OpenAPI
- [x] Create GraphQL schema introspection parser
- [x] Implement dynamic test generation based on discovered endpoints
- [x] Add property-level validation against type definitions

### 6.2 Swagger Integration (Day 8 - Afternoon)
- [x] **TEST**: Write tests for swagger-downloader.js
  - Test Swagger URL detection
  - Test JSON validation
  - Test file saving
  - Test version comparison
- [x] Implement Swagger specification downloader
- [x] Add automatic Swagger URL discovery from base URL
- [x] Create version comparison to prevent unnecessary downloads
- [x] Implement Swagger UI integration for downloaded specs

### 6.3 Universal Contract Validation CLI (Day 9 - Morning)
- [x] **TEST**: Write tests for contract-validator-cli.js
  - Test command parsing for multiple API types
  - Test protocol auto-detection
  - Test validation reporting for each API type
  - Test exit codes and error handling
- [x] Add 'validate' command to CLI with protocol selection
- [x] Implement auto-detection of API type when not specified
- [x] Create validation profiles for different API standards
- [x] Implement validation report generation for each API type
- [x] Add compliance scoring against standard specifications
- [x] Create machine-readable output format (JSON)
- [x] Add human-readable output format (colored console)

### 6.4 Universal Documentation Generator (Day 9 - Afternoon)
- [ ] **TEST**: Write tests for docs-generator.js
  - Test markdown generation for multiple API types
  - Test code sample generation for different languages
  - Test query examples for each protocol (REST, OData, GraphQL)
  - Test client library generation
- [ ] Implement universal documentation generator supporting multiple API types
- [ ] Create protocol-specific documentation templates
- [ ] Generate code samples for common operations in multiple languages
- [ ] Add query examples based on discovered resource properties
  - REST parameter examples
  - OData query examples
  - GraphQL query examples
- [ ] Implement client library stub generation
- [ ] Generate Postman/Insomnia collections for API testing
- [ ] Create OpenAPI specification from discovered endpoints

## Phase 7: Multi-API Support

### 7.1 API Registry (Day 10 - Morning)
- [x] **TEST**: Write tests for api-registry.js
  - Test API discovery
  - Test configuration loading
  - Test API filtering
- [x] Implement API discovery from data directory
- [x] Create API registry data structure
- [x] Add configuration loading
- [x] Implement API filtering

### 7.2 Multi-API Server (Day 10 - Afternoon)
- [x] **TEST**: Write tests for multi-api-server.js
  - Test multiple API mounting
  - Test isolated state
  - Test different base paths
- [x] Implement multi-API server configuration
- [x] Create API-specific router mounting
- [x] Add isolated state management
- [x] Implement base path configuration

### 7.3 API Dashboard (Day 11 - Morning)
- [x] **TEST**: Write tests for dashboard-generator.js
  - Test HTML generation
  - Test API listing
  - Test link generation
- [x] Implement dashboard HTML generation
- [x] Create API listing interface
- [x] Add documentation links
- [x] Include usage statistics

### 7.4 Single API Mode (Day 11 - Afternoon)
- [x] **TEST**: Write tests for single-api-server.js
  - Test single API mounting
  - Test custom base path
  - Test router isolation
- [x] Implement single API mode
- [x] Add custom base path support

## Phase 8: CLI Interface & Documentation

### 8.1 CLI Module (Day 6 - Morning)
- [x] **TEST**: Write tests for cli.js
  - Test command parsing
  - Test option validation
  - Test integration with other modules
- [x] Implement command-line interface
- [x] Add record command
- [x] Add serve command
- [x] Implement configuration file support
- [x] Handle authentication options

### 8.2 Final Documentation (Day 12 - Afternoon)
- [ ] Update README.md with comprehensive documentation
- [ ] Create examples for different API types
- [ ] Add troubleshooting guide
- [ ] Include API reference

## Running and Testing Instructions

### Recording API Responses
```bash
# Run tests for recording functionality
npm test -- --testPathPattern=record

# Record API responses with test coverage
npm test -- --testPathPattern=record-integration --coverage

# Record a real API
node src/index.js record http://your-api-url.com --name="my-api" --auth-token=YOUR_TOKEN
```

### Running Mock Server
```bash
# Run tests for server functionality
npm test -- --testPathPattern=server

# Test server with mock data
npm test -- --testPathPattern=server-integration --coverage

# Start mock server
node src/index.js serve --port=3000

# Start specific API only
node src/index.js serve --api="my-api" --port=8080 --base-path="/api"
```

## Test-Driven Validation Checkpoints

After completing each phase, run the entire test suite to ensure no regressions:

```bash
npm test
```

Aim for test coverage of at least:
- 90% for core functionality
- 80% for edge cases and error handling
- 70% for UI/rendering components

## Error Handling Strategy

Each error condition should have corresponding tests:

1. **Network Errors**
   - Test timeout handling
   - Test connection failures
   - Test malformed responses

2. **Input Validation**
   - Test invalid URLs
   - Test malformed Swagger
   - Test missing parameters

3. **Runtime Errors**
   - Test file system access issues
   - Test memory limitations
   - Test concurrent access

4. **Graceful Degradation**
   - Test partial API mocking
   - Test fallback responses
   - Test helpful error messages

## OData Testing Strategy

Special focus on OData testing:

1. **Query Options Tests**
   - Each query option should have dedicated tests
   - Test combinations of options
   - Test edge cases like empty results

2. **Entity Relationship Tests**
   - Test one-to-many relationships
   - Test many-to-many relationships
   - Test nested expansion

3. **Performance Tests**
   - Test response time with large datasets
   - Test memory usage with complex queries
   - Test concurrent OData queries

## Code Quality Standards

Throughout implementation, maintain:

1. **Consistent Code Style**
   - ESLint configuration
   - Prettier formatting
   - JSDoc comments

2. **Modular Architecture**
   - Clear separation of concerns
   - Dependency injection for testability
   - Interface-based design

3. **Comprehensive Logging**
   - Structured log format
   - Multiple log levels
   - Contextual information

4. **Performance Considerations**
   - Memory efficient data structures
   - Response caching where appropriate
   - Asynchronous operations

By following this test-driven approach, we ensure the API Mocker is robust, maintainable, and correctly implements all requirements from the start.
