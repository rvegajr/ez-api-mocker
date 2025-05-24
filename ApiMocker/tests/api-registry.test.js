const fs = require('fs');
const path = require('path');
const mockFs = require('mock-fs');
const apiRegistry = require('../src/api-registry');

describe('API Registry', () => {
  // Additional test cases for edge cases to improve branch coverage
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
          })
        },
        'test-api-2': {
          'config.json': JSON.stringify({
            name: 'test-api-2',
            type: 'OData',
            basePath: '/odata',
            metadata: 'metadata.xml',
            active: true
          }),
          'metadata.xml': '<edmx:Edmx></edmx:Edmx>'
        },
        'inactive-api': {
          'config.json': JSON.stringify({
            name: 'inactive-api',
            type: 'REST',
            basePath: '/api/inactive',
            swagger: 'swagger.json',
            active: false
          }),
          'swagger.json': '{}'
        }
      }
    });
  });

  afterEach(() => {
    // Restore the file system
    mockFs.restore();
  });

  test('discovers APIs from data directory', async () => {
    const apis = await apiRegistry.discoverApis('data');
    
    expect(apis).toHaveLength(3);
    // The APIs are sorted alphabetically
    expect(apis[0].name).toBe('inactive-api');
    expect(apis[1].name).toBe('test-api-1');
    expect(apis[2].name).toBe('test-api-2');
  });

  test('loads API configurations', async () => {
    const apis = await apiRegistry.loadApiConfigurations('data');
    
    expect(apis).toHaveLength(3);
    // The APIs are sorted alphabetically by name
    expect(apis[0].name).toBe('inactive-api');
    expect(apis[0].type).toBe('REST');
    expect(apis[0].basePath).toBe('/api/inactive');
    
    expect(apis[1].name).toBe('test-api-1');
    expect(apis[1].type).toBe('REST');
    expect(apis[1].basePath).toBe('/api/v1');
    
    expect(apis[2].name).toBe('test-api-2');
    expect(apis[2].type).toBe('OData');
    expect(apis[2].basePath).toBe('/odata');
  });

  test('filters APIs by type', async () => {
    const apis = await apiRegistry.loadApiConfigurations('data');
    const restApis = apiRegistry.filterApisByType(apis, 'REST');
    
    expect(restApis).toHaveLength(2);
    // The APIs are sorted alphabetically by name
    expect(restApis[0].name).toBe('inactive-api');
    expect(restApis[1].name).toBe('test-api-1');
  });

  test('filters APIs by active status', async () => {
    const apis = await apiRegistry.loadApiConfigurations('data');
    const activeApis = apiRegistry.filterApisByStatus(apis, true);
    
    expect(activeApis).toHaveLength(2);
    expect(activeApis[0].name).toBe('test-api-1');
    expect(activeApis[1].name).toBe('test-api-2');
  });

  test('gets API by name', async () => {
    const apis = await apiRegistry.loadApiConfigurations('data');
    const api = apiRegistry.getApiByName(apis, 'test-api-2');
    
    expect(api).toBeDefined();
    expect(api.name).toBe('test-api-2');
    expect(api.type).toBe('OData');
  });

  test('returns null when API name not found', async () => {
    const apis = await apiRegistry.loadApiConfigurations('data');
    const api = apiRegistry.getApiByName(apis, 'non-existent-api');
    
    expect(api).toBeNull();
  });

  test('saves API configuration', async () => {
    const api = {
      name: 'test-api-1',
      type: 'REST',
      basePath: '/api/v1/updated',
      active: true
    };
    
    await apiRegistry.saveApiConfiguration('data', api);
    
    const apis = await apiRegistry.loadApiConfigurations('data');
    const updatedApi = apiRegistry.getApiByName(apis, 'test-api-1');
    
    expect(updatedApi.basePath).toBe('/api/v1/updated');
  });

  test('creates API registry data structure', async () => {
    const apis = await apiRegistry.loadApiConfigurations('data');
    const registry = apiRegistry.createRegistry(apis);
    
    expect(registry).toHaveProperty('apis');
    expect(registry.apis).toHaveLength(3);
    expect(registry).toHaveProperty('activeApis');
    expect(registry.activeApis).toHaveLength(2);
    expect(registry).toHaveProperty('types');
    expect(registry.types).toContain('REST');
    expect(registry.types).toContain('OData');
  });

  // Edge case tests for filterApisByType
  test('filterApisByType handles null or undefined apis', () => {
    expect(apiRegistry.filterApisByType(null, 'REST')).toEqual([]);
    expect(apiRegistry.filterApisByType(undefined, 'REST')).toEqual([]);
    expect(apiRegistry.filterApisByType('not-an-array', 'REST')).toEqual([]);
  });

  test('filterApisByType handles null or undefined type', () => {
    const apis = [
      { name: 'api1', type: 'REST' },
      { name: 'api2', type: 'OData' }
    ];
    expect(apiRegistry.filterApisByType(apis, null)).toEqual(apis);
    expect(apiRegistry.filterApisByType(apis, undefined)).toEqual(apis);
  });

  // Edge case tests for filterApisByStatus
  test('filterApisByStatus handles null or undefined apis', () => {
    expect(apiRegistry.filterApisByStatus(null, true)).toEqual([]);
    expect(apiRegistry.filterApisByStatus(undefined, true)).toEqual([]);
    expect(apiRegistry.filterApisByStatus('not-an-array', true)).toEqual([]);
  });

  test('filterApisByStatus handles undefined active status', () => {
    const apis = [
      { name: 'api1', active: true },
      { name: 'api2', active: false }
    ];
    expect(apiRegistry.filterApisByStatus(apis, undefined)).toEqual(apis);
  });

  // Edge case tests for getApiByName
  test('getApiByName handles null or undefined apis', () => {
    expect(apiRegistry.getApiByName(null, 'api1')).toBeNull();
    expect(apiRegistry.getApiByName(undefined, 'api1')).toBeNull();
    expect(apiRegistry.getApiByName('not-an-array', 'api1')).toBeNull();
  });

  test('getApiByName handles null or undefined name', () => {
    const apis = [
      { name: 'api1', type: 'REST' },
      { name: 'api2', type: 'OData' }
    ];
    expect(apiRegistry.getApiByName(apis, null)).toBeNull();
    expect(apiRegistry.getApiByName(apis, undefined)).toBeNull();
  });
});
