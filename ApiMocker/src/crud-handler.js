/**
 * CRUD Operations Handler Module
 * Implements in-memory data store and handlers for POST, PUT, PATCH, DELETE operations
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// In-memory data store for each API
const dataStore = new Map();

/**
 * Initializes a data store for an API
 * @param {string} apiName - The name of the API
 * @param {Object} config - API configuration
 * @returns {Object} The initialized data store
 */
function initializeDataStore(apiName, config) {
  if (dataStore.has(apiName)) {
    return dataStore.get(apiName);
  }
  
  // Create new data store for this API
  const apiDataStore = {
    collections: new Map(),
    config
  };
  
  dataStore.set(apiName, apiDataStore);
  console.log(`Initialized data store for API: ${apiName}`);
  
  return apiDataStore;
}

/**
 * Loads initial data for collections from files
 * @param {string} apiName - The name of the API
 * @param {string} dataDir - Directory containing data files
 */
function loadInitialData(apiName, dataDir) {
  if (!fs.existsSync(dataDir)) {
    console.warn(`Data directory not found: ${dataDir}`);
    return;
  }
  
  const apiStore = dataStore.get(apiName);
  if (!apiStore) {
    console.warn(`Data store not initialized for API: ${apiName}`);
    return;
  }
  
  // Read all JSON files in the data directory
  const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.json'));
  
  for (const file of files) {
    try {
      // Parse collection name from filename (e.g., pets.json -> pets)
      const collectionName = path.basename(file, '.json');
      
      // Read and parse the file
      const data = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
      
      // Initialize collection with data
      if (Array.isArray(data)) {
        apiStore.collections.set(collectionName, [...data]);
        console.log(`Loaded ${data.length} items into collection: ${collectionName}`);
      } else {
        console.warn(`Expected array data in ${file}, got ${typeof data}`);
      }
    } catch (error) {
      console.error(`Error loading data from ${file}: ${error.message}`);
    }
  }
}

/**
 * Gets a collection by name, creating it if it doesn't exist
 * @param {string} apiName - The name of the API
 * @param {string} collectionName - The name of the collection
 * @returns {Array} The collection
 */
function getCollection(apiName, collectionName) {
  const apiStore = dataStore.get(apiName);
  if (!apiStore) {
    throw new Error(`Data store not initialized for API: ${apiName}`);
  }
  
  // Create collection if it doesn't exist
  if (!apiStore.collections.has(collectionName)) {
    apiStore.collections.set(collectionName, []);
  }
  
  return apiStore.collections.get(collectionName);
}

/**
 * Handles POST requests to create new items
 * @param {string} apiName - The name of the API
 * @param {string} collectionName - The name of the collection
 * @param {Object} data - The data to create
 * @param {Object} options - Additional options
 * @returns {Object} The created item
 */
function handlePost(apiName, collectionName, data, options = {}) {
  const collection = getCollection(apiName, collectionName);
  
  // Generate an ID if not provided
  if (!data.id) {
    data.id = crypto.randomUUID();
  }
  
  // Add timestamps if enabled
  if (options.timestamps) {
    data.createdAt = new Date().toISOString();
    data.updatedAt = new Date().toISOString();
  }
  
  // Add the item to the collection
  collection.push(data);
  
  console.log(`Created item in ${collectionName}: ${data.id}`);
  return data;
}

/**
 * Handles PUT requests to replace existing items
 * @param {string} apiName - The name of the API
 * @param {string} collectionName - The name of the collection
 * @param {string} id - The ID of the item to replace
 * @param {Object} data - The replacement data
 * @param {Object} options - Additional options
 * @returns {Object|null} The updated item or null if not found
 */
function handlePut(apiName, collectionName, id, data, options = {}) {
  const collection = getCollection(apiName, collectionName);
  
  // Find the item by ID
  const index = collection.findIndex(item => item.id === id);
  if (index === -1) {
    console.warn(`Item not found for PUT: ${collectionName}/${id}`);
    return null;
  }
  
  // Ensure the ID is preserved
  data.id = id;
  
  // Update timestamps if enabled
  if (options.timestamps) {
    data.createdAt = collection[index].createdAt || new Date().toISOString();
    data.updatedAt = new Date().toISOString();
  }
  
  // Replace the item
  collection[index] = data;
  
  console.log(`Updated item in ${collectionName}: ${id}`);
  return data;
}

/**
 * Handles PATCH requests to update parts of existing items
 * @param {string} apiName - The name of the API
 * @param {string} collectionName - The name of the collection
 * @param {string} id - The ID of the item to update
 * @param {Object} data - The partial update data
 * @param {Object} options - Additional options
 * @returns {Object|null} The updated item or null if not found
 */
function handlePatch(apiName, collectionName, id, data, options = {}) {
  const collection = getCollection(apiName, collectionName);
  
  // Find the item by ID
  const index = collection.findIndex(item => item.id === id);
  if (index === -1) {
    console.warn(`Item not found for PATCH: ${collectionName}/${id}`);
    return null;
  }
  
  // Merge the existing item with the update data
  const updatedItem = { ...collection[index], ...data };
  
  // Ensure the ID is preserved
  updatedItem.id = id;
  
  // Update timestamps if enabled
  if (options.timestamps) {
    updatedItem.updatedAt = new Date().toISOString();
  }
  
  // Update the item
  collection[index] = updatedItem;
  
  console.log(`Patched item in ${collectionName}: ${id}`);
  return updatedItem;
}

/**
 * Handles DELETE requests to remove items
 * @param {string} apiName - The name of the API
 * @param {string} collectionName - The name of the collection
 * @param {string} id - The ID of the item to delete
 * @returns {boolean} True if the item was deleted, false otherwise
 */
function handleDelete(apiName, collectionName, id) {
  const collection = getCollection(apiName, collectionName);
  
  // Find the item by ID
  const index = collection.findIndex(item => item.id === id);
  if (index === -1) {
    console.warn(`Item not found for DELETE: ${collectionName}/${id}`);
    return false;
  }
  
  // Remove the item
  collection.splice(index, 1);
  
  console.log(`Deleted item from ${collectionName}: ${id}`);
  return true;
}

/**
 * Gets all items in a collection
 * @param {string} apiName - The name of the API
 * @param {string} collectionName - The name of the collection
 * @param {Object} query - Query parameters for filtering
 * @returns {Array} The items in the collection
 */
function getAll(apiName, collectionName, query = {}) {
  const collection = getCollection(apiName, collectionName);
  
  // Apply simple filtering if query parameters are provided
  if (Object.keys(query).length > 0) {
    return collection.filter(item => {
      for (const [key, value] of Object.entries(query)) {
        if (item[key] !== value) {
          return false;
        }
      }
      return true;
    });
  }
  
  return collection;
}

/**
 * Gets a single item by ID
 * @param {string} apiName - The name of the API
 * @param {string} collectionName - The name of the collection
 * @param {string} id - The ID of the item to get
 * @returns {Object|null} The item or null if not found
 */
function getById(apiName, collectionName, id) {
  const collection = getCollection(apiName, collectionName);
  
  // Find the item by ID
  const item = collection.find(item => item.id === id);
  if (!item) {
    console.warn(`Item not found: ${collectionName}/${id}`);
    return null;
  }
  
  return item;
}

/**
 * Resets the data store for an API
 * @param {string} apiName - The name of the API to reset
 */
function resetDataStore(apiName) {
  if (dataStore.has(apiName)) {
    const apiStore = dataStore.get(apiName);
    apiStore.collections.clear();
    console.log(`Reset data store for API: ${apiName}`);
  }
}

/**
 * Saves the current state of the data store to files
 * @param {string} apiName - The name of the API
 * @param {string} dataDir - Directory to save data files
 */
function saveDataStore(apiName, dataDir) {
  if (!dataStore.has(apiName)) {
    console.warn(`Data store not found for API: ${apiName}`);
    return;
  }
  
  // Create the data directory if it doesn't exist
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const apiStore = dataStore.get(apiName);
  
  // Save each collection to a separate file
  for (const [collectionName, data] of apiStore.collections.entries()) {
    try {
      const filePath = path.join(dataDir, `${collectionName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`Saved collection to ${filePath}`);
    } catch (error) {
      console.error(`Error saving collection ${collectionName}: ${error.message}`);
    }
  }
}

/**
 * Gets the data store for an API
 * @param {string} apiName - The name of the API
 * @returns {Object|null} The data store or null if not found
 */
function getDataStore(apiName) {
  return dataStore.get(apiName) || null;
}

module.exports = {
  initializeDataStore,
  loadInitialData,
  getCollection,
  handlePost,
  handlePut,
  handlePatch,
  handleDelete,
  getAll,
  getById,
  resetDataStore,
  saveDataStore,
  getDataStore
};
