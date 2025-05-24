# EZ API Mocker

A powerful utility that creates mock APIs from Swagger/OpenAPI specifications with minimal configuration. EZ API Mocker automatically discovers API endpoints, records sample responses, and creates a fully functional mock server with a beautiful UI and Swagger documentation.

## Purpose

EZ API Mocker solves common challenges in API development and testing by providing a simple way to:

- Create realistic mock APIs for frontend development before backend services are complete
- Test applications against APIs that are rate-limited, costly to access, or unavailable in certain environments
- Develop offline without depending on external API services
- Simulate various API responses including edge cases and error scenarios
- Provide a consistent testing environment across development teams

## Key Features

- **Dynamic Swagger UI**: Interactive API documentation and testing interface
- **Multi-API Support**: Host multiple APIs on a single server
- **Authentication Handling**: Support for JWT and other authentication methods
- **CORS Support**: Built-in handling for cross-origin requests
- **Fallback Responses**: Automatically generate responses when no specific file exists
- **Beautiful Dashboard**: Modern UI with API information and endpoint listings
- **Stateful Mode**: Support for CRUD operations with in-memory data store

## Sample Use Cases

### 1. Frontend Development with Incomplete Backend

Your team is developing a new application where the frontend needs to integrate with APIs that are still under development. With EZ API Mocker, you can:

- Create mock APIs based on the agreed Swagger specifications
- Customize responses to match expected data formats
- Allow frontend developers to work independently of backend progress

### 2. Testing with Protected or Rate-Limited APIs

Your application integrates with third-party APIs that have:
- Usage limits or costs per request
- Authentication requirements that make automated testing difficult
- Inconsistent test environments

EZ API Mocker allows you to record real responses once and replay them in your testing environment without limitations.

### 3. Offline Development

Developers need to work in environments without reliable internet access. EZ API Mocker enables:
- Complete offline development with realistic API responses
- Consistent behavior across all development environments
- Faster development cycles without external dependencies

### 4. API Prototyping and Design

When designing new APIs, you can use EZ API Mocker to:
- Create a working prototype from a Swagger specification
- Test different response formats and structures
- Validate API design before implementation
- Demonstrate API functionality to stakeholders

## Getting Started

### Installation

```bash
# Clone the repository
git clone https://github.com/rvegajr/ez-api-mocker.git

# Navigate to the ApiMocker directory
cd ez-api-mocker/ApiMocker

# Install dependencies
npm install
```

### Quick Start

```bash
# Record an API
node src/cli.js record --url https://petstore.swagger.io/v2 --name petstore

# Start the mock server
node src/cli.js serve --port 3010 --data ./data --api petstore
```

Then open your browser to http://localhost:3010 to see the API dashboard.

## Documentation

For detailed documentation and examples, see:

- [API Mocker README](ApiMocker/README.md) - Comprehensive documentation with all options and features
- [Petstore Walkthrough](PETSTORE_WALKTHROUGH.md) - Step-by-step guide to creating a mock Petstore API

## Contributing

Contributions are welcome! Feel free to submit issues or pull requests.

## License

MIT
