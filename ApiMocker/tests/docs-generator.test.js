const fs = require('fs');
const path = require('path');
const docsGenerator = require('../src/docs-generator');

// Mock data
const mockRestApi = {
  name: 'test-rest-api',
  type: 'REST',
  swagger: {
    openapi: '3.0.0',
    info: {
      title: 'Test REST API',
      version: '1.0.0',
      description: 'A test REST API for documentation generation'
    },
    paths: {
      '/users': {
        get: {
          summary: 'Get all users',
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/User'
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          summary: 'Create a new user',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/User'
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'User created'
            }
          }
        }
      },
      '/users/{id}': {
        get: {
          summary: 'Get user by ID',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'integer'
              }
            }
          ],
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/User'
                  }
                }
              }
            }
          }
        }
      }
    },
    components: {
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer'
            },
            name: {
              type: 'string'
            },
            email: {
              type: 'string'
            }
          }
        }
      }
    }
  }
};

const mockODataApi = {
  name: 'test-odata-api',
  type: 'OData',
  metadata: {
    edmx: {
      dataServices: {
        schema: {
          entityType: [
            {
              name: 'Product',
              property: [
                { name: 'ID', type: 'Edm.Int32', key: true },
                { name: 'Name', type: 'Edm.String' },
                { name: 'Description', type: 'Edm.String' },
                { name: 'Price', type: 'Edm.Decimal' }
              ],
              navigationProperty: [
                { name: 'Category', type: 'Category' }
              ]
            },
            {
              name: 'Category',
              property: [
                { name: 'ID', type: 'Edm.Int32', key: true },
                { name: 'Name', type: 'Edm.String' }
              ],
              navigationProperty: [
                { name: 'Products', type: 'Collection(Product)' }
              ]
            }
          ],
          entityContainer: {
            entitySet: [
              { name: 'Products', entityType: 'Product' },
              { name: 'Categories', entityType: 'Category' }
            ]
          }
        }
      }
    }
  }
};

const mockGraphQLApi = {
  name: 'test-graphql-api',
  type: 'GraphQL',
  schema: `
    type User {
      id: ID!
      name: String!
      email: String!
      posts: [Post!]!
    }
    
    type Post {
      id: ID!
      title: String!
      content: String!
      author: User!
    }
    
    type Query {
      users: [User!]!
      user(id: ID!): User
      posts: [Post!]!
      post(id: ID!): Post
    }
    
    type Mutation {
      createUser(name: String!, email: String!): User!
      createPost(title: String!, content: String!, authorId: ID!): Post!
    }
  `
};

// Ensure output directory exists
const outputDir = path.join(__dirname, '../temp-docs');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

describe('Universal Documentation Generator', () => {
  afterAll(() => {
    // Clean up created files
    if (fs.existsSync(outputDir)) {
      const files = fs.readdirSync(outputDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(outputDir, file));
      });
      fs.rmdirSync(outputDir);
    }
  });

  test('generates markdown documentation for REST API', async () => {
    const outputPath = path.join(outputDir, 'rest-api-docs.md');
    await docsGenerator.generateMarkdownDocs(mockRestApi, outputPath);
    
    expect(fs.existsSync(outputPath)).toBe(true);
    const content = fs.readFileSync(outputPath, 'utf8');
    
    // Check for key sections
    expect(content).toContain('# Test REST API');
    expect(content).toContain('## Endpoints');
    expect(content).toContain('### GET /users');
    expect(content).toContain('### POST /users');
    expect(content).toContain('### GET /users/{id}');
    expect(content).toContain('## Models');
    expect(content).toContain('### User');
  });

  test('generates markdown documentation for OData API', async () => {
    const outputPath = path.join(outputDir, 'odata-api-docs.md');
    await docsGenerator.generateMarkdownDocs(mockODataApi, outputPath);
    
    expect(fs.existsSync(outputPath)).toBe(true);
    const content = fs.readFileSync(outputPath, 'utf8');
    
    // Check for key sections
    expect(content).toContain('# OData API Documentation');
    expect(content).toContain('## Entity Types');
    expect(content).toContain('### Product');
    expect(content).toContain('### Category');
    expect(content).toContain('## Entity Sets');
    expect(content).toContain('### Products');
    expect(content).toContain('### Categories');
    expect(content).toContain('## OData Query Examples');
  });

  test('generates markdown documentation for GraphQL API', async () => {
    const outputPath = path.join(outputDir, 'graphql-api-docs.md');
    await docsGenerator.generateMarkdownDocs(mockGraphQLApi, outputPath);
    
    expect(fs.existsSync(outputPath)).toBe(true);
    const content = fs.readFileSync(outputPath, 'utf8');
    
    // Check for key sections
    expect(content).toContain('# GraphQL API Documentation');
    expect(content).toContain('## Types');
    expect(content).toContain('### User');
    expect(content).toContain('### Post');
    expect(content).toContain('## Queries');
    expect(content).toContain('## Mutations');
  });

  test('generates code samples for REST API', async () => {
    const samples = await docsGenerator.generateCodeSamples(mockRestApi, 'GET', '/users');
    
    expect(samples).toHaveProperty('curl');
    expect(samples).toHaveProperty('javascript');
    expect(samples).toHaveProperty('python');
    expect(samples.curl).toContain('curl');
    expect(samples.curl).toContain('--max-time 5'); // As per memory requirement
    expect(samples.javascript).toContain('fetch');
    expect(samples.python).toContain('requests');
  });

  test('generates code samples for OData API', async () => {
    const samples = await docsGenerator.generateCodeSamples(mockODataApi, 'GET', '/Products');
    
    expect(samples).toHaveProperty('curl');
    expect(samples).toHaveProperty('javascript');
    expect(samples).toHaveProperty('python');
    expect(samples.curl).toContain('curl');
    expect(samples.curl).toContain('--max-time 5'); // As per memory requirement
    expect(samples.javascript).toContain('fetch');
    expect(samples.python).toContain('requests');
  });

  test('generates query examples for different API types', async () => {
    const restExamples = await docsGenerator.generateQueryExamples(mockRestApi);
    expect(restExamples).toContain('/users?');
    
    const odataExamples = await docsGenerator.generateQueryExamples(mockODataApi);
    expect(odataExamples).toContain('$filter=');
    expect(odataExamples).toContain('$select=');
    expect(odataExamples).toContain('$expand=');
    
    const graphqlExamples = await docsGenerator.generateQueryExamples(mockGraphQLApi);
    expect(graphqlExamples).toContain('query {');
    expect(graphqlExamples).toContain('mutation {');
  });

  test('generates Postman collection for REST API', async () => {
    const outputPath = path.join(outputDir, 'rest-api-postman.json');
    await docsGenerator.generatePostmanCollection(mockRestApi, outputPath);
    
    expect(fs.existsSync(outputPath)).toBe(true);
    const collection = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    
    expect(collection).toHaveProperty('info');
    expect(collection).toHaveProperty('item');
    expect(collection.info.name).toBe('Test REST API');
    expect(collection.item.length).toBeGreaterThan(0);
  });

  test('generates client library stubs', async () => {
    const outputDir = path.join(__dirname, '../temp-docs/client-libs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    await docsGenerator.generateClientLibrary(mockRestApi, outputDir, 'javascript');
    
    expect(fs.existsSync(path.join(outputDir, 'index.js'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'api.js'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'models.js'))).toBe(true);
    
    const apiContent = fs.readFileSync(path.join(outputDir, 'api.js'), 'utf8');
    expect(apiContent).toContain('getUsers');
    expect(apiContent).toContain('createUser');
    expect(apiContent).toContain('getUserById');
  });
});
