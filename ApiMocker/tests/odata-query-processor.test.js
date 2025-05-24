/**
 * Tests for the OData Query Processor
 */

const odataQueryProcessor = require('../src/odata-query-processor');

describe('OData Query Processor', () => {
  // Sample data for testing
  const sampleData = [
    { id: 1, name: 'Product 1', price: 10.99, category: 'Electronics', inStock: true, tags: ['new', 'featured'] },
    { id: 2, name: 'Product 2', price: 24.99, category: 'Home', inStock: true, tags: ['sale'] },
    { id: 3, name: 'Product 3', price: 5.99, category: 'Electronics', inStock: false, tags: [] },
    { id: 4, name: 'Product 4', price: 49.99, category: 'Clothing', inStock: true, tags: ['new'] },
    { id: 5, name: 'Product 5', price: 15.99, category: 'Home', inStock: false, tags: ['clearance'] }
  ];
  
  describe('processQuery', () => {
    test('should return empty array for null or undefined data', () => {
      expect(odataQueryProcessor.processQuery(null, {})).toEqual({ value: [] });
      expect(odataQueryProcessor.processQuery(undefined, {})).toEqual({ value: [] });
    });
    
    test('should return all data when no query options are provided', () => {
      const result = odataQueryProcessor.processQuery(sampleData, {});
      expect(result.value).toEqual(sampleData);
    });
    
    test('should include count when $count=true', () => {
      const result = odataQueryProcessor.processQuery(sampleData, { $count: 'true' });
      expect(result.value).toEqual(sampleData);
      expect(result['@odata.count']).toBe(5);
    });
  });
  
  describe('applySelect', () => {
    test('should select only specified properties', () => {
      const result = odataQueryProcessor.applySelect(sampleData, 'id,name');
      
      expect(result).toHaveLength(5);
      expect(result[0]).toEqual({ id: 1, name: 'Product 1' });
      expect(Object.keys(result[0])).toEqual(['id', 'name']);
    });
    
    test('should handle nested properties', () => {
      const nestedData = [
        { id: 1, name: 'Product 1', details: { color: 'red', weight: 100 } }
      ];
      
      const result = odataQueryProcessor.applySelect(nestedData, 'id,details/color');
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: 1, details: { color: 'red' } });
    });
  });
  
  describe('applyFilter', () => {
    test('should filter by simple equality', () => {
      const result = odataQueryProcessor.applyFilter(sampleData, 'category eq \'Electronics\'');
      
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(3);
    });
    
    test('should filter by numeric comparison', () => {
      const result = odataQueryProcessor.applyFilter(sampleData, 'price gt 20');
      
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(2);
      expect(result[1].id).toBe(4);
    });
    
    test('should filter with logical operators', () => {
      const result = odataQueryProcessor.applyFilter(
        sampleData, 
        'category eq \'Electronics\' and inStock eq true'
      );
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });
    
    test('should handle contains function', () => {
      const result = odataQueryProcessor.applyFilter(sampleData, 'name contains \'Product\'');
      
      expect(result).toHaveLength(5);
    });
  });
  
  describe('applyOrderBy', () => {
    test('should sort by a single property ascending', () => {
      const result = odataQueryProcessor.applyOrderBy(sampleData, 'price');
      
      expect(result).toHaveLength(5);
      expect(result[0].price).toBe(5.99);
      expect(result[4].price).toBe(49.99);
    });
    
    test('should sort by a single property descending', () => {
      const result = odataQueryProcessor.applyOrderBy(sampleData, 'price desc');
      
      expect(result).toHaveLength(5);
      expect(result[0].price).toBe(49.99);
      expect(result[4].price).toBe(5.99);
    });
    
    test('should sort by multiple properties', () => {
      const result = odataQueryProcessor.applyOrderBy(sampleData, 'category,price desc');
      
      // First by category (alphabetical)
      expect(result[0].category).toBe('Clothing');
      
      // Then within Electronics, by price descending
      expect(result[1].category).toBe('Electronics');
      expect(result[1].price).toBe(10.99);
      expect(result[2].price).toBe(5.99);
    });
  });
  
  describe('Integration tests', () => {
    test('should apply multiple query options together', () => {
      const result = odataQueryProcessor.processQuery(sampleData, {
        $filter: 'price gt 10',
        $orderby: 'price',
        $select: 'id,name,price',
        $count: 'true'
      });
      
      // Check count and that we have the right items
      expect(result['@odata.count']).toBe(4); // There are 4 items with price > 10
      
      // Verify we have the correct items in the correct order
      const ids = result.value.map(item => item.id);
      expect(ids).toContain(5); // Product 5 (15.99)
      expect(ids).toContain(2); // Product 2 (24.99)
      expect(ids).toContain(4); // Product 4 (49.99)
      
      // Verify the items are in ascending price order
      const prices = result.value.map(item => item.price);
      expect(prices).toEqual([...prices].sort((a, b) => a - b));
    });
    
    test('should apply pagination with $top and $skip', () => {
      const result = odataQueryProcessor.processQuery(sampleData, {
        $orderby: 'id',
        $top: '2',
        $skip: '2'
      });
      
      expect(result.value).toHaveLength(2);
      expect(result.value[0].id).toBe(3);
      expect(result.value[1].id).toBe(4);
    });
  });
});
