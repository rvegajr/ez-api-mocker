const fs = require('fs');
const path = require('path');
const nock = require('nock');
const paginationHandler = require('../src/pagination-handler');

// Mock fs module
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  writeFileSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true)
}));

describe('Pagination Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    nock.cleanAll();
  });
  
  test('detects standard pagination in response', () => {
    const response = {
      data: {
        page: 1,
        pageSize: 10,
        totalPages: 5,
        totalItems: 45,
        items: [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' }
        ]
      }
    };
    
    const paginationInfo = paginationHandler.detectPaginationFormat(response);
    
    expect(paginationInfo.hasPagination).toBe(true);
    expect(paginationInfo.format).toBe('standard');
    expect(paginationInfo.currentPage).toBe(1);
    expect(paginationInfo.totalPages).toBe(5);
  });
  
  test('detects OData pagination in response', () => {
    const response = {
      data: {
        '@odata.count': 45,
        '@odata.nextLink': 'https://api.example.com/odata/users?$skip=10',
        value: [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' }
        ]
      }
    };
    
    const paginationInfo = paginationHandler.detectPaginationFormat(response);
    
    expect(paginationInfo.hasPagination).toBe(true);
    expect(paginationInfo.format).toBe('odata');
    expect(paginationInfo.nextLink).toBe('https://api.example.com/odata/users?$skip=10');
  });
  
  test('detects cursor-based pagination in response', () => {
    const response = {
      data: {
        items: [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' }
        ],
        cursor: 'next_page_token_abc123',
        hasMoreItems: true
      }
    };
    
    const paginationInfo = paginationHandler.detectPaginationFormat(response);
    
    expect(paginationInfo.hasPagination).toBe(true);
    expect(paginationInfo.format).toBe('cursor');
    expect(paginationInfo.nextCursor).toBe('next_page_token_abc123');
    expect(paginationInfo.hasMore).toBe(true);
  });
  
  test('handles large response by truncating', () => {
    // Create a large response with 1000 items
    const items = [];
    for (let i = 1; i <= 1000; i++) {
      items.push({ id: i, name: `Item ${i}` });
    }
    
    const largeResponse = {
      data: {
        items: items,
        totalItems: 1000
      }
    };
    
    const truncated = paginationHandler.truncateLargeResponse(largeResponse.data, 100);
    
    expect(truncated.items.length).toBe(100);
    expect(truncated.items[0].id).toBe(1);
    expect(truncated.items[99].id).toBe(100);
    expect(truncated._truncated).toBe(true);
    expect(truncated._originalSize).toBe(1000);
  });
  
  test('records paginated responses', async () => {
    const endpoint = {
      path: '/api/items',
      method: 'get',
      operationId: 'getItems'
    };
    
    // Mock first page response
    const page1Response = {
      page: 1,
      pageSize: 2,
      totalPages: 3,
      totalItems: 5,
      items: [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' }
      ]
    };
    
    // Mock second page response
    const page2Response = {
      page: 2,
      pageSize: 2,
      totalPages: 3,
      totalItems: 5,
      items: [
        { id: 3, name: 'Item 3' },
        { id: 4, name: 'Item 4' }
      ]
    };
    
    // Mock third page response
    const page3Response = {
      page: 3,
      pageSize: 2,
      totalPages: 3,
      totalItems: 5,
      items: [
        { id: 5, name: 'Item 5' }
      ]
    };
    
    // Setup nock to return different pages
    nock('http://test-api.com')
      .get('/api/items?page=1')
      .reply(200, page1Response)
      .get('/api/items?page=2')
      .reply(200, page2Response)
      .get('/api/items?page=3')
      .reply(200, page3Response);
    
    const client = {
      get: jest.fn()
        .mockImplementationOnce(() => Promise.resolve({ data: page1Response, status: 200 }))
        .mockImplementationOnce(() => Promise.resolve({ data: page2Response, status: 200 }))
        .mockImplementationOnce(() => Promise.resolve({ data: page3Response, status: 200 }))
    };
    
    const results = await paginationHandler.recordAllPages(
      'http://test-api.com',
      endpoint,
      client,
      '/output/dir'
    );
    
    expect(results.length).toBe(3);
    expect(results[0].pageNumber).toBe(1);
    expect(results[1].pageNumber).toBe(2);
    expect(results[2].pageNumber).toBe(3);
    
    expect(fs.writeFileSync).toHaveBeenCalledTimes(4); // 3 individual pages + merged result
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('getItems_page_1.json'),
      expect.any(String)
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('getItems_all_pages.json'),
      expect.any(String)
    );
  });
  
  test('handles OData pagination with nextLink', async () => {
    const endpoint = {
      path: '/odata/items',
      method: 'get',
      operationId: 'getODataItems',
      isOData: true
    };
    
    // Mock first page response
    const page1Response = {
      '@odata.context': 'https://test-api.com/$metadata#items',
      '@odata.count': 5,
      '@odata.nextLink': 'https://test-api.com/odata/items?$skip=2',
      value: [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' }
      ]
    };
    
    // Mock second page response
    const page2Response = {
      '@odata.context': 'https://test-api.com/$metadata#items',
      '@odata.count': 5,
      '@odata.nextLink': 'https://test-api.com/odata/items?$skip=4',
      value: [
        { id: 3, name: 'Item 3' },
        { id: 4, name: 'Item 4' }
      ]
    };
    
    // Mock third page response
    const page3Response = {
      '@odata.context': 'https://test-api.com/$metadata#items',
      '@odata.count': 5,
      value: [
        { id: 5, name: 'Item 5' }
      ]
    };
    
    // Setup nock to return different pages
    nock('http://test-api.com')
      .get('/odata/items?$top=2')
      .reply(200, page1Response)
      .get('/odata/items?$skip=2')
      .reply(200, page2Response)
      .get('/odata/items?$skip=4')
      .reply(200, page3Response);
    
    const client = {
      get: jest.fn()
        .mockImplementationOnce(() => Promise.resolve({ data: page1Response, status: 200 }))
        .mockImplementationOnce(() => Promise.resolve({ data: page2Response, status: 200 }))
        .mockImplementationOnce(() => Promise.resolve({ data: page3Response, status: 200 }))
    };
    
    const results = await paginationHandler.recordAllPages(
      'http://test-api.com',
      endpoint,
      client,
      '/output/dir'
    );
    
    expect(results.length).toBe(3);
    expect(results[0].isOData).toBe(true);
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('getODataItems_all_pages.json'),
      expect.any(String)
    );
  });
});
