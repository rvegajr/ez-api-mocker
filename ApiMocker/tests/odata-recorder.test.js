const nock = require('nock');
const fs = require('fs');
const path = require('path');
const odataRecorder = require('../src/odata-recorder');

// Mock fs module
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true)
}));

describe('OData Recorder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    nock.cleanAll();
  });
  
  test('fetches $metadata document', async () => {
    const metadataXml = `<?xml version="1.0" encoding="utf-8"?>
      <edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
        <edmx:DataServices>
          <Schema Namespace="TestService" xmlns="http://docs.oasis-open.org/odata/ns/edm">
            <EntityType Name="User">
              <Key>
                <PropertyRef Name="Id" />
              </Key>
              <Property Name="Id" Type="Edm.Int32" Nullable="false" />
              <Property Name="Name" Type="Edm.String" />
              <NavigationProperty Name="Orders" Type="Collection(TestService.Order)" />
            </EntityType>
          </Schema>
        </edmx:DataServices>
      </edmx:Edmx>`;
    
    nock('http://test-api.com')
      .get('/odata/$metadata')
      .reply(200, metadataXml, { 'Content-Type': 'application/xml' });
    
    const client = {
      get: jest.fn().mockResolvedValue({ 
        data: metadataXml, 
        status: 200,
        headers: { 'Content-Type': 'application/xml' }
      })
    };
    
    const result = await odataRecorder.fetchMetadata('http://test-api.com', client, '/output/dir');
    
    expect(result.success).toBe(true);
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('$metadata.xml'),
      expect.stringContaining('edmx:Edmx')
    );
  });
  
  test('extracts entity relationships from metadata', async () => {
    const metadataXml = `<?xml version="1.0" encoding="utf-8"?>
      <edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
        <edmx:DataServices>
          <Schema Namespace="TestService" xmlns="http://docs.oasis-open.org/odata/ns/edm">
            <EntityType Name="User">
              <Key>
                <PropertyRef Name="Id" />
              </Key>
              <Property Name="Id" Type="Edm.Int32" Nullable="false" />
              <Property Name="Name" Type="Edm.String" />
              <NavigationProperty Name="Orders" Type="Collection(TestService.Order)" />
            </EntityType>
            <EntityType Name="Order">
              <Key>
                <PropertyRef Name="Id" />
              </Key>
              <Property Name="Id" Type="Edm.Int32" Nullable="false" />
              <Property Name="UserId" Type="Edm.Int32" />
              <NavigationProperty Name="User" Type="TestService.User" />
            </EntityType>
          </Schema>
        </edmx:DataServices>
      </edmx:Edmx>`;
    
    const relationships = odataRecorder.extractRelationships(metadataXml);
    
    expect(relationships).toBeDefined();
    expect(relationships.User).toBeDefined();
    expect(relationships.User.Orders).toBeDefined();
    expect(relationships.User.Orders.targetEntity).toBe('Order');
    expect(relationships.User.Orders.isCollection).toBe(true);
    
    expect(relationships.Order).toBeDefined();
    expect(relationships.Order.User).toBeDefined();
    expect(relationships.Order.User.targetEntity).toBe('User');
    expect(relationships.Order.User.isCollection).toBe(false);
  });
  
  test('records entity set with query options', async () => {
    const endpoint = {
      path: '/odata/Users',
      method: 'get',
      operationId: 'getUsers',
      isOData: true
    };
    
    const usersResponse = {
      '@odata.context': 'http://test-api.com/$metadata#Users',
      'value': [
        { id: 1, name: 'User 1' },
        { id: 2, name: 'User 2' }
      ]
    };
    
    const usersSelectResponse = {
      '@odata.context': 'http://test-api.com/$metadata#Users(id,name)',
      'value': [
        { id: 1, name: 'User 1' },
        { id: 2, name: 'User 2' }
      ]
    };
    
    const usersExpandResponse = {
      '@odata.context': 'http://test-api.com/$metadata#Users(id,name,Orders())',
      'value': [
        { 
          id: 1, 
          name: 'User 1',
          Orders: [
            { id: 101, amount: 100 },
            { id: 102, amount: 200 }
          ]
        },
        { 
          id: 2, 
          name: 'User 2',
          Orders: []
        }
      ]
    };
    
    // Setup nock for multiple requests
    nock('http://test-api.com')
      .get('/odata/Users')
      .reply(200, usersResponse)
      .get('/odata/Users?$select=id,name')
      .reply(200, usersSelectResponse)
      .get('/odata/Users?$expand=Orders')
      .reply(200, usersExpandResponse);
    
    const client = {
      get: jest.fn()
        .mockImplementationOnce(() => Promise.resolve({ data: usersResponse, status: 200 }))
        .mockImplementationOnce(() => Promise.resolve({ data: usersSelectResponse, status: 200 }))
        .mockImplementationOnce(() => Promise.resolve({ data: usersExpandResponse, status: 200 }))
    };
    
    const queryOptions = ['$select', '$expand'];
    const relationships = {
      User: {
        Orders: { targetEntity: 'Order', isCollection: true }
      }
    };
    
    const results = await odataRecorder.recordEntityWithQueryOptions(
      'http://test-api.com',
      endpoint,
      client,
      '/output/dir',
      queryOptions,
      relationships
    );
    
    expect(results).toHaveLength(3); // Base + $select + $expand
    expect(results[0].success).toBe(true);
    expect(results[1].queryOption).toBe('$select');
    expect(results[2].queryOption).toBe('$expand');
    
    expect(fs.writeFileSync).toHaveBeenCalledTimes(3);
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('getUsers_select_id_name.json'),
      expect.any(String)
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('getUsers_expand_Orders.json'),
      expect.any(String)
    );
  });
  
  test('handles OData service document', async () => {
    const serviceDocument = {
      '@odata.context': 'http://test-api.com/$metadata',
      'value': [
        {
          'name': 'Users',
          'kind': 'EntitySet',
          'url': 'Users'
        },
        {
          'name': 'Orders',
          'kind': 'EntitySet',
          'url': 'Orders'
        }
      ]
    };
    
    nock('http://test-api.com')
      .get('/odata')
      .reply(200, serviceDocument);
      
    const client = {
      get: jest.fn().mockResolvedValue({ data: serviceDocument, status: 200 })
    };
    
    const result = await odataRecorder.fetchServiceDocument('http://test-api.com', client, '/output/dir');
    
    expect(result.success).toBe(true);
    expect(result.entitySets).toContain('Users');
    expect(result.entitySets).toContain('Orders');
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('service-document.json'),
      expect.any(String)
    );
  });
  
  test('detects entity sets from service document', async () => {
    const serviceDocument = {
      '@odata.context': 'http://test-api.com/$metadata',
      'value': [
        {
          'name': 'Users',
          'kind': 'EntitySet',
          'url': 'Users'
        },
        {
          'name': 'Orders',
          'kind': 'EntitySet',
          'url': 'Orders'
        }
      ]
    };
    
    const entitySets = odataRecorder.extractEntitySetsFromService(serviceDocument);
    
    expect(entitySets).toContain('Users');
    expect(entitySets).toContain('Orders');
    expect(entitySets).toHaveLength(2);
  });
});
