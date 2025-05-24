const fs = require('fs');
const path = require('path');
const mockFs = require('mock-fs');

// Mock API data
const mockApis = [
  {
    name: 'test-api-1',
    type: 'REST',
    basePath: '/api/v1',
    swagger: 'swagger.json',
    active: true,
    dirPath: 'data/test-api-1'
  },
  {
    name: 'test-api-2',
    type: 'OData',
    basePath: '/odata',
    metadata: 'metadata.xml',
    active: true,
    dirPath: 'data/test-api-2'
  },
  {
    name: 'inactive-api',
    type: 'REST',
    basePath: '/api/inactive',
    swagger: 'swagger.json',
    active: false,
    dirPath: 'data/inactive-api'
  }
];

// Mock API registry
jest.mock('../src/api-registry', () => {
  return {
    loadApiConfigurations: jest.fn().mockResolvedValue(mockApis),
    filterApisByStatus: jest.fn().mockImplementation((apis, active) => {
      return apis.filter(api => api.active === active);
    }),
    createRegistry: jest.fn().mockReturnValue({
      apis: mockApis,
      activeApis: mockApis.filter(api => api.active),
      types: ['REST', 'OData'],
      count: mockApis.length,
      activeCount: mockApis.filter(api => api.active).length,
      lastUpdated: new Date().toISOString()
    })
  };
});

// Require modules after mocks are set up
const dashboardGenerator = require('../src/dashboard-generator');
const apiRegistry = require('../src/api-registry');

describe('Dashboard Generator', () => {
  beforeEach(() => {
    // Mock the file system
    mockFs({
      'data': {
        'test-api-1': {
          'config.json': JSON.stringify({
            name: 'test-api-1',
            type: 'REST',
            basePath: '/api/v1',
            swagger: 'swagger.json',
            active: true
          }),
          'swagger.json': JSON.stringify({
            openapi: '3.0.0',
            info: {
              title: 'Test API 1',
              version: '1.0.0'
            }
          }),
          'responses': {
            'users': {
              'get.json': JSON.stringify([{ id: 1, name: 'User 1' }])
            }
          }
        },
        'test-api-2': {
          'config.json': JSON.stringify({
            name: 'test-api-2',
            type: 'OData',
            basePath: '/odata',
            metadata: 'metadata.xml',
            active: true
          }),
          'metadata.xml': '<edmx:Edmx></edmx:Edmx>',
          'responses': {
            'Products': {
              'get.json': JSON.stringify([{ ID: 1, Name: 'Product 1' }])
            }
          }
        }
      },
      'public': {
        'css': {},
        'js': {}
      }
    });
  });

  afterEach(() => {
    // Restore the file system
    mockFs.restore();
    jest.clearAllMocks();
  });

  test('generates HTML dashboard with API listing', async () => {
    const html = await dashboardGenerator.generateDashboard('data');
    
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
    expect(html).toContain('<title>API Mocker Dashboard</title>');
    expect(html).toContain('test-api-1');
    expect(html).toContain('test-api-2');
    expect(html).toContain('REST');
    expect(html).toContain('OData');
    expect(html).toContain('/api/v1');
    expect(html).toContain('/odata');
  });

  test('generates API listing table', async () => {
    const apis = await apiRegistry.loadApiConfigurations('data');
    const tableHtml = dashboardGenerator.generateApiTable(apis);
    
    expect(tableHtml).toContain('<table');
    expect(tableHtml).toContain('</table>');
    expect(tableHtml).toContain('<th>Name</th>');
    expect(tableHtml).toContain('<th>Type</th>');
    expect(tableHtml).toContain('<th>Base Path</th>');
    expect(tableHtml).toContain('<th>Status</th>');
    expect(tableHtml).toContain('<td>test-api-1</td>');
    expect(tableHtml).toContain('<td>REST</td>');
    expect(tableHtml).toContain('<td>/api/v1</td>');
    expect(tableHtml).toContain('<td>Active</td>');
  });

  test('generates documentation links', async () => {
    const apis = await apiRegistry.loadApiConfigurations('data');
    const linksHtml = dashboardGenerator.generateDocLinks(apis);
    
    expect(linksHtml).toContain('<ul');
    expect(linksHtml).toContain('</ul>');
    expect(linksHtml).toContain('<li>');
    expect(linksHtml).toContain('</li>');
    expect(linksHtml).toContain('href="/api/v1/docs"');
    expect(linksHtml).toContain('href="/odata/docs"');
    expect(linksHtml).toContain('Test API 1 Documentation');
  });

  test('includes usage statistics', async () => {
    // Mock usage data
    const usageData = {
      'test-api-1': {
        requests: 150,
        endpoints: {
          '/users': 100,
          '/users/1': 50
        }
      },
      'test-api-2': {
        requests: 75,
        endpoints: {
          '/Products': 50,
          '/Products(1)': 25
        }
      }
    };
    
    // Write mock usage data to file
    fs.writeFileSync('data/usage-stats.json', JSON.stringify(usageData));
    
    const statsHtml = await dashboardGenerator.generateUsageStats('data');
    
    expect(statsHtml).toContain('<h2>Usage Statistics</h2>');
    expect(statsHtml).toContain('test-api-1');
    expect(statsHtml).toContain('150 requests');
    expect(statsHtml).toContain('test-api-2');
    expect(statsHtml).toContain('75 requests');
  });

  test('writes dashboard HTML to file', async () => {
    const outputPath = 'public/index.html';
    await dashboardGenerator.writeDashboard('data', outputPath);
    
    expect(fs.existsSync(outputPath)).toBe(true);
    const content = fs.readFileSync(outputPath, 'utf8');
    expect(content).toContain('<title>API Mocker Dashboard</title>');
  });

  test('generates CSS and JS files for dashboard', async () => {
    const cssPath = 'public/css/dashboard.css';
    const jsPath = 'public/js/dashboard.js';
    
    await dashboardGenerator.generateAssets('public');
    
    expect(fs.existsSync(cssPath)).toBe(true);
    expect(fs.existsSync(jsPath)).toBe(true);
    
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    const jsContent = fs.readFileSync(jsPath, 'utf8');
    
    expect(cssContent).toContain('body');
    expect(jsContent).toContain('function');
  });

  // Edge case tests to improve branch coverage
  test('handles empty API list gracefully', async () => {
    // Mock empty API list
    apiRegistry.loadApiConfigurations.mockResolvedValueOnce([]);
    
    const html = await dashboardGenerator.generateDashboard('data');
    
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
    expect(html).toContain('No APIs found.');
  });

  test('handles missing usage stats file', async () => {
    // Remove usage stats file
    mockFs.restore();
    mockFs({
      'data': {}
    });
    
    const statsHtml = await dashboardGenerator.generateUsageStats('data');
    
    expect(statsHtml).toContain('<h2>Usage Statistics</h2>');
    expect(statsHtml).toContain('No usage data available yet.');
  });

  test('handles invalid usage stats file', async () => {
    // Create invalid JSON file
    mockFs.restore();
    mockFs({
      'data': {
        'usage-stats.json': 'invalid json'
      }
    });
    
    const statsHtml = await dashboardGenerator.generateUsageStats('data');
    
    expect(statsHtml).toContain('<h2>Usage Statistics</h2>');
    expect(statsHtml).toContain('Error loading usage statistics.');
  });

  test('handles API without swagger file for title', () => {
    const api = {
      name: 'test-api-no-swagger',
      type: 'REST',
      basePath: '/api/no-swagger',
      swagger: 'non-existent.json',
      active: true,
      dirPath: 'data/test-api-no-swagger'
    };
    
    // Mock file system without the swagger file
    mockFs.restore();
    mockFs({
      'data': {
        'test-api-no-swagger': {}
      }
    });
    
    const title = dashboardGenerator.getApiTitle(api);
    
    expect(title).toBe('test-api-no-swagger');
  });

  test('handles error when writing dashboard', async () => {
    // Create a directory that can't be written to
    mockFs.restore();
    mockFs({
      'data': {},
      '/read-only': mockFs.directory({
        mode: 0o444 // Read-only directory
      })
    });
    
    // Attempt to write to a read-only directory
    const result = await dashboardGenerator.writeDashboard('data', '/read-only/index.html');
    
    expect(result).toBe(false);
  });

  test('handles error when generating assets', async () => {
    // Create a directory that can't be written to
    mockFs.restore();
    mockFs({
      '/read-only': mockFs.directory({
        mode: 0o444 // Read-only directory
      })
    });
    
    // Attempt to generate assets in a read-only directory
    const result = await dashboardGenerator.generateAssets('/read-only');
    
    expect(result).toBe(false);
  });
});
