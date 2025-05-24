/**
 * Tests for the CRUD Operations Handler
 */

const path = require('path');
const fs = require('fs');
const crudHandler = require('../src/crud-handler');

// Mock fs functions
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

describe('CRUD Operations Handler', () => {
  const apiName = 'test-api';
  const collectionName = 'pets';
  const dataDir = path.join(__dirname, 'data', apiName);
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Initialize data store for tests
    crudHandler.initializeDataStore(apiName, { responsesDir: dataDir });
  });
  
  describe('POST operations', () => {
    test('should create a new item with generated ID', () => {
      const newPet = { name: 'Fluffy', type: 'cat' };
      
      const result = crudHandler.handlePost(apiName, collectionName, newPet);
      
      expect(result).toHaveProperty('id');
      expect(result.name).toBe('Fluffy');
      expect(result.type).toBe('cat');
      
      // Verify item was added to collection
      const collection = crudHandler.getCollection(apiName, collectionName);
      expect(collection).toHaveLength(1);
      expect(collection[0]).toEqual(result);
    });
    
    test('should preserve provided ID', () => {
      const newPet = { id: 'pet-123', name: 'Rex', type: 'dog' };
      
      const result = crudHandler.handlePost(apiName, collectionName, newPet);
      
      expect(result.id).toBe('pet-123');
      expect(result.name).toBe('Rex');
      
      // Verify item was added to collection
      const collection = crudHandler.getCollection(apiName, collectionName);
      expect(collection).toHaveLength(1);
      expect(collection[0]).toEqual(result);
    });
    
    test('should add timestamps when enabled', () => {
      const newPet = { name: 'Whiskers', type: 'cat' };
      
      const result = crudHandler.handlePost(apiName, collectionName, newPet, { timestamps: true });
      
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');
      expect(new Date(result.createdAt)).toBeInstanceOf(Date);
      expect(new Date(result.updatedAt)).toBeInstanceOf(Date);
    });
  });
  
  describe('PUT operations', () => {
    test('should replace an existing item', () => {
      // First create an item
      const newPet = { name: 'Buddy', type: 'dog' };
      const created = crudHandler.handlePost(apiName, collectionName, newPet);
      
      // Then replace it
      const updatedPet = { id: created.id, name: 'Buddy', type: 'golden retriever', age: 3 };
      const result = crudHandler.handlePut(apiName, collectionName, created.id, updatedPet);
      
      expect(result.id).toBe(created.id);
      expect(result.type).toBe('golden retriever');
      expect(result.age).toBe(3);
      
      // Verify item was updated in collection
      const collection = crudHandler.getCollection(apiName, collectionName);
      expect(collection).toHaveLength(1);
      expect(collection[0]).toEqual(result);
    });
    
    test('should return null when item not found', () => {
      const result = crudHandler.handlePut(apiName, collectionName, 'non-existent-id', { name: 'Ghost' });
      
      expect(result).toBeNull();
    });
    
    test('should update timestamps when enabled', () => {
      // First create an item with timestamps
      const newPet = { name: 'Max', type: 'dog' };
      const created = crudHandler.handlePost(apiName, collectionName, newPet, { timestamps: true });
      
      // Wait a moment to ensure timestamps would be different
      jest.advanceTimersByTime(1000);
      
      // Then update it
      const updatedPet = { name: 'Maximus', type: 'dog' };
      const result = crudHandler.handlePut(apiName, collectionName, created.id, updatedPet, { timestamps: true });
      
      expect(result.createdAt).toBe(created.createdAt);
      expect(result.updatedAt).not.toBe(created.updatedAt);
    });
  });
  
  describe('PATCH operations', () => {
    test('should partially update an existing item', () => {
      // First create an item
      const newPet = { name: 'Luna', type: 'cat', color: 'black' };
      const created = crudHandler.handlePost(apiName, collectionName, newPet);
      
      // Then patch it
      const patchData = { color: 'black and white' };
      const result = crudHandler.handlePatch(apiName, collectionName, created.id, patchData);
      
      expect(result.id).toBe(created.id);
      expect(result.name).toBe('Luna');
      expect(result.type).toBe('cat');
      expect(result.color).toBe('black and white');
      
      // Verify item was updated in collection
      const collection = crudHandler.getCollection(apiName, collectionName);
      expect(collection).toHaveLength(1);
      expect(collection[0]).toEqual(result);
    });
    
    test('should return null when item not found', () => {
      const result = crudHandler.handlePatch(apiName, collectionName, 'non-existent-id', { color: 'white' });
      
      expect(result).toBeNull();
    });
    
    test('should update only updatedAt timestamp when enabled', () => {
      // First create an item with timestamps
      const newPet = { name: 'Oliver', type: 'cat' };
      const created = crudHandler.handlePost(apiName, collectionName, newPet, { timestamps: true });
      
      // Wait a moment to ensure timestamps would be different
      jest.advanceTimersByTime(1000);
      
      // Then patch it
      const patchData = { color: 'orange' };
      const result = crudHandler.handlePatch(apiName, collectionName, created.id, patchData, { timestamps: true });
      
      expect(result.createdAt).toBe(created.createdAt);
      expect(result.updatedAt).not.toBe(created.updatedAt);
    });
  });
  
  describe('DELETE operations', () => {
    test('should delete an existing item', () => {
      // First create an item
      const newPet = { name: 'Charlie', type: 'dog' };
      const created = crudHandler.handlePost(apiName, collectionName, newPet);
      
      // Verify item exists
      let collection = crudHandler.getCollection(apiName, collectionName);
      expect(collection).toHaveLength(1);
      
      // Then delete it
      const result = crudHandler.handleDelete(apiName, collectionName, created.id);
      
      expect(result).toBe(true);
      
      // Verify item was removed from collection
      collection = crudHandler.getCollection(apiName, collectionName);
      expect(collection).toHaveLength(0);
    });
    
    test('should return false when item not found', () => {
      const result = crudHandler.handleDelete(apiName, collectionName, 'non-existent-id');
      
      expect(result).toBe(false);
    });
  });
  
  describe('Query operations', () => {
    beforeEach(() => {
      // Add some test data
      crudHandler.handlePost(apiName, collectionName, { id: '1', name: 'Rex', type: 'dog', age: 3 });
      crudHandler.handlePost(apiName, collectionName, { id: '2', name: 'Fluffy', type: 'cat', age: 2 });
      crudHandler.handlePost(apiName, collectionName, { id: '3', name: 'Buddy', type: 'dog', age: 5 });
    });
    
    test('should get all items', () => {
      const result = crudHandler.getAll(apiName, collectionName);
      
      expect(result).toHaveLength(3);
      expect(result.map(item => item.id)).toEqual(['1', '2', '3']);
    });
    
    test('should filter items by query parameters', () => {
      const result = crudHandler.getAll(apiName, collectionName, { type: 'dog' });
      
      expect(result).toHaveLength(2);
      expect(result.map(item => item.name)).toEqual(['Rex', 'Buddy']);
    });
    
    test('should get item by ID', () => {
      const result = crudHandler.getById(apiName, collectionName, '2');
      
      expect(result).not.toBeNull();
      expect(result.name).toBe('Fluffy');
      expect(result.type).toBe('cat');
    });
    
    test('should return null when getting non-existent ID', () => {
      const result = crudHandler.getById(apiName, collectionName, 'non-existent-id');
      
      expect(result).toBeNull();
    });
  });
  
  describe('Data persistence', () => {
    test('should load initial data from files', () => {
      // Mock file system
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['pets.json', 'owners.json']);
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('pets.json')) {
          return JSON.stringify([
            { id: '1', name: 'Rex', type: 'dog' },
            { id: '2', name: 'Fluffy', type: 'cat' }
          ]);
        } else {
          return JSON.stringify([
            { id: '1', name: 'John', pets: ['1'] },
            { id: '2', name: 'Jane', pets: ['2'] }
          ]);
        }
      });
      
      // Load data
      crudHandler.loadInitialData(apiName, dataDir);
      
      // Verify collections were created
      expect(crudHandler.getCollection(apiName, 'pets')).toHaveLength(2);
      expect(crudHandler.getCollection(apiName, 'owners')).toHaveLength(2);
    });
    
    test('should save data store to files', () => {
      // Add some test data
      crudHandler.handlePost(apiName, 'pets', { id: '1', name: 'Rex', type: 'dog' });
      crudHandler.handlePost(apiName, 'owners', { id: '1', name: 'John', pets: ['1'] });
      
      // Mock file system
      fs.existsSync.mockReturnValue(true);
      
      // Save data
      crudHandler.saveDataStore(apiName, dataDir);
      
      // Verify files were written
      expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
      expect(fs.writeFileSync.mock.calls[0][0]).toContain('pets.json');
      expect(fs.writeFileSync.mock.calls[1][0]).toContain('owners.json');
    });
    
    test('should reset data store', () => {
      // Add some test data
      crudHandler.handlePost(apiName, 'pets', { id: '1', name: 'Rex', type: 'dog' });
      crudHandler.handlePost(apiName, 'owners', { id: '1', name: 'John', pets: ['1'] });
      
      // Verify collections have data
      expect(crudHandler.getCollection(apiName, 'pets')).toHaveLength(1);
      expect(crudHandler.getCollection(apiName, 'owners')).toHaveLength(1);
      
      // Reset data store
      crudHandler.resetDataStore(apiName);
      
      // Verify collections are empty
      expect(crudHandler.getCollection(apiName, 'pets')).toHaveLength(0);
      expect(crudHandler.getCollection(apiName, 'owners')).toHaveLength(0);
    });
  });
});
