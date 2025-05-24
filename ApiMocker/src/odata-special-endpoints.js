/**
 * OData Special Endpoints Module
 * Handles OData-specific endpoints like $metadata and service document
 */

const fs = require('fs');
const path = require('path');
const crudHandler = require('./crud-handler');

/**
 * Generates OData service document
 * @param {string} baseUrl - The base URL of the service
 * @param {Object} config - API configuration
 * @returns {Object} The service document
 */
function generateServiceDocument(baseUrl, config) {
  const collections = getCollections(config.apiName);
  const serviceDocument = {
    '@odata.context': `${baseUrl}/$metadata`,
    value: []
  };
  
  for (const collection of collections) {
    serviceDocument.value.push({
      name: collection,
      kind: 'EntitySet',
      url: collection
    });
  }
  
  return serviceDocument;
}

/**
 * Gets collections for an API
 * @param {string} apiName - The API name
 * @returns {Array} List of collection names
 */
function getCollections(apiName) {
  try {
    // Try to get collections from the data store
    const apiStore = crudHandler.getDataStore(apiName);
    if (apiStore && apiStore.collections) {
      return Array.from(apiStore.collections.keys());
    }
    
    // If no collections in data store, try to read from data directory
    const dataDir = path.join('./data', apiName, 'data');
    if (fs.existsSync(dataDir)) {
      const files = fs.readdirSync(dataDir)
        .filter(file => file.endsWith('.json'))
        .map(file => path.basename(file, '.json'));
      
      return files;
    }
  } catch (error) {
    console.warn(`Error getting collections: ${error.message}`);
  }
  
  return [];
}

/**
 * Generates OData metadata document
 * @param {Object} config - API configuration
 * @returns {string} The metadata document XML
 */
function generateMetadata(config) {
  const collections = getCollections(config.apiName);
  const entityTypes = [];
  
  // Generate entity types from collections
  for (const collection of collections) {
    try {
      // Get a sample item to infer the entity type
      const items = crudHandler.getAll(config.apiName, collection);
      if (items && items.length > 0) {
        const sampleItem = items[0];
        entityTypes.push(generateEntityType(collection, sampleItem));
      }
    } catch (error) {
      console.warn(`Error generating entity type for ${collection}: ${error.message}`);
    }
  }
  
  // Generate entity sets
  const entitySets = collections.map(collection => {
    // Convert collection name to entity type name (singular)
    const entityType = collection.endsWith('s')
      ? collection.slice(0, -1)
      : collection;
    
    return `<EntitySet Name="${collection}" EntityType="Self.${capitalize(entityType)}" />`;
  });
  
  // Generate the metadata document
  return `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <Schema Namespace="${config.apiName}" xmlns="http://docs.oasis-open.org/odata/ns/edm">
      ${entityTypes.join('\n      ')}
      <EntityContainer Name="DefaultContainer">
        ${entitySets.join('\n        ')}
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;
}

/**
 * Generates an entity type from a sample item
 * @param {string} collection - The collection name
 * @param {Object} sampleItem - A sample item
 * @returns {string} The entity type XML
 */
function generateEntityType(collection, sampleItem) {
  // Convert collection name to entity type name (singular)
  const entityType = collection.endsWith('s')
    ? collection.slice(0, -1)
    : collection;
  
  const entityTypeName = capitalize(entityType);
  
  // Generate properties
  const properties = [];
  
  for (const [name, value] of Object.entries(sampleItem)) {
    const type = getEdmType(value);
    
    // Add key attribute for ID property
    const isKey = name === 'id' || name === `${entityType}Id`;
    const keyAttribute = isKey ? ' Nullable="false"' : '';
    
    properties.push(`<Property Name="${name}" Type="${type}"${keyAttribute} />`);
  }
  
  // Generate key element
  const keyProperty = sampleItem.id ? 'id' : `${entityType}Id`;
  const keyElement = `<Key><PropertyRef Name="${keyProperty}" /></Key>`;
  
  return `<EntityType Name="${entityTypeName}">
        ${keyElement}
        ${properties.join('\n        ')}
      </EntityType>`;
}

/**
 * Gets the EDM type for a value
 * @param {*} value - The value
 * @returns {string} The EDM type
 */
function getEdmType(value) {
  if (value === null || value === undefined) {
    return 'Edm.String';
  }
  
  switch (typeof value) {
    case 'string':
      // Check if it's a date
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
        return 'Edm.DateTimeOffset';
      }
      return 'Edm.String';
    case 'number':
      return Number.isInteger(value) ? 'Edm.Int32' : 'Edm.Double';
    case 'boolean':
      return 'Edm.Boolean';
    case 'object':
      if (value instanceof Date) {
        return 'Edm.DateTimeOffset';
      }
      if (Array.isArray(value)) {
        return 'Collection(Edm.String)';
      }
      return 'Edm.ComplexType';
    default:
      return 'Edm.String';
  }
}

/**
 * Capitalizes the first letter of a string
 * @param {string} str - The string to capitalize
 * @returns {string} The capitalized string
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Handles OData batch requests
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} config - API configuration
 */
function handleBatch(req, res, config) {
  // This is a simplified implementation that doesn't actually process batch requests
  // In a real implementation, you would need to parse the multipart request and
  // execute each operation individually
  
  res.status(501).json({
    error: {
      code: 'NotImplemented',
      message: 'Batch operations are not currently supported'
    }
  });
}

/**
 * Adds OData-specific headers to a response
 * @param {Object} res - Express response object
 */
function addODataHeaders(res) {
  res.set('OData-Version', '4.0');
  res.set('OData-MaxVersion', '4.0');
}

module.exports = {
  generateServiceDocument,
  generateMetadata,
  handleBatch,
  addODataHeaders,
  getCollections
};
