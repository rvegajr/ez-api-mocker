/**
 * OData Relationship Handler Module
 * Handles entity relationships and $expand functionality
 */

const crudHandler = require('./crud-handler');

/**
 * Extracts relationships from a metadata document
 * @param {Object} metadata - The OData metadata document
 * @returns {Object} Map of entity types to their relationships
 */
function extractRelationships(metadata) {
  const relationships = {};
  
  try {
    // Handle EDMX metadata format
    if (metadata.edmx && metadata.edmx.dataservices && metadata.edmx.dataservices.schema) {
      const schema = Array.isArray(metadata.edmx.dataservices.schema)
        ? metadata.edmx.dataservices.schema[0]
        : metadata.edmx.dataservices.schema;
      
      if (schema.entitytype) {
        const entityTypes = Array.isArray(schema.entitytype)
          ? schema.entitytype
          : [schema.entitytype];
        
        for (const entityType of entityTypes) {
          const typeName = entityType.name;
          relationships[typeName] = {
            navigationProperties: [],
            associations: []
          };
          
          // Extract navigation properties
          if (entityType.navigationproperty) {
            const navProps = Array.isArray(entityType.navigationproperty)
              ? entityType.navigationproperty
              : [entityType.navigationproperty];
            
            for (const navProp of navProps) {
              relationships[typeName].navigationProperties.push({
                name: navProp.name,
                type: navProp.type,
                relationship: navProp.relationship,
                fromRole: navProp.fromrole,
                toRole: navProp.torole
              });
            }
          }
        }
      }
      
      // Extract associations
      if (schema.association) {
        const associations = Array.isArray(schema.association)
          ? schema.association
          : [schema.association];
        
        for (const association of associations) {
          const ends = Array.isArray(association.end)
            ? association.end
            : [association.end];
          
          if (ends.length === 2) {
            const [end1, end2] = ends;
            
            // Add association to both entity types
            if (relationships[end1.type]) {
              relationships[end1.type].associations.push({
                name: association.name,
                end1: {
                  role: end1.role,
                  type: end1.type,
                  multiplicity: end1.multiplicity
                },
                end2: {
                  role: end2.role,
                  type: end2.type,
                  multiplicity: end2.multiplicity
                }
              });
            }
            
            if (relationships[end2.type]) {
              relationships[end2.type].associations.push({
                name: association.name,
                end1: {
                  role: end2.role,
                  type: end2.type,
                  multiplicity: end2.multiplicity
                },
                end2: {
                  role: end1.role,
                  type: end1.type,
                  multiplicity: end1.multiplicity
                }
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error extracting relationships: ${error.message}`);
  }
  
  return relationships;
}

/**
 * Applies $expand query option to data
 * @param {Array|Object} data - The data to expand
 * @param {string} expandOption - The $expand query option
 * @param {Object} options - Additional options
 * @returns {Array|Object} The expanded data
 */
function applyExpand(data, expandOption, options = {}) {
  if (!expandOption || (!Array.isArray(data) && !data)) {
    return data;
  }
  
  const expandPaths = expandOption.split(',').map(path => path.trim());
  
  // Handle array data
  if (Array.isArray(data)) {
    return data.map(item => expandItem(item, expandPaths, options));
  }
  
  // Handle single item
  return expandItem(data, expandPaths, options);
}

/**
 * Expands a single item based on expand paths
 * @param {Object} item - The item to expand
 * @param {Array} expandPaths - The expand paths
 * @param {Object} options - Additional options
 * @returns {Object} The expanded item
 */
function expandItem(item, expandPaths, options) {
  if (!item || typeof item !== 'object') {
    return item;
  }
  
  const result = { ...item };
  
  for (const path of expandPaths) {
    // Handle nested expands (e.g., Orders($expand=Customer))
    let propertyName = path;
    let nestedExpand = null;
    
    if (path.includes('(')) {
      const match = path.match(/([^(]+)\((?:\$expand=)?([^)]+)\)/);
      if (match) {
        [, propertyName, nestedExpand] = match;
      }
    }
    
    // Get related entities based on naming conventions
    if (options.apiName && options.relationships) {
      const relatedCollection = getRelatedCollection(
        item,
        propertyName,
        options.apiName,
        options.relationships
      );
      
      if (relatedCollection) {
        // Apply nested expand if present
        if (nestedExpand) {
          result[propertyName] = applyExpand(
            relatedCollection,
            nestedExpand,
            options
          );
        } else {
          result[propertyName] = relatedCollection;
        }
      }
    }
  }
  
  return result;
}

/**
 * Gets related collection based on naming conventions
 * @param {Object} item - The parent item
 * @param {string} propertyName - The relationship property name
 * @param {string} apiName - The API name
 * @param {Object} relationships - The relationships map
 * @returns {Array|Object} The related entities
 */
function getRelatedCollection(item, propertyName, apiName, relationships) {
  // Try to determine the related collection name from the property name
  let collectionName = propertyName.toLowerCase();
  
  // Handle common naming patterns
  if (collectionName.endsWith('s')) {
    // For collections (e.g., Orders -> order)
    const singularName = collectionName.slice(0, -1);
    
    // Check if there's a foreign key in the item
    const foreignKeyName = `${singularName}Id`;
    if (item[foreignKeyName]) {
      // This is a single entity relationship
      try {
        return crudHandler.getById(apiName, collectionName, item[foreignKeyName]);
      } catch (error) {
        console.warn(`Error getting related entity: ${error.message}`);
        return null;
      }
    }
  } else {
    // For single entities (e.g., Customer -> customers)
    const pluralName = `${collectionName}s`;
    
    // Check if there's a foreign key in the item
    const foreignKeyName = `${collectionName}Id`;
    if (item[foreignKeyName]) {
      // This is a single entity relationship
      try {
        return crudHandler.getById(apiName, pluralName, item[foreignKeyName]);
      } catch (error) {
        console.warn(`Error getting related entity: ${error.message}`);
        return null;
      }
    }
  }
  
  // Try to find items that reference this item
  const itemType = getEntityType(item);
  if (itemType) {
    const foreignKeyName = `${itemType.toLowerCase()}Id`;
    
    try {
      // Get all items from the target collection
      const allItems = crudHandler.getAll(apiName, collectionName);
      
      // Filter items that reference this item
      return allItems.filter(relatedItem => relatedItem[foreignKeyName] === item.id);
    } catch (error) {
      console.warn(`Error getting related collection: ${error.message}`);
    }
  }
  
  return null;
}

/**
 * Tries to determine the entity type from an item
 * @param {Object} item - The item
 * @returns {string|null} The entity type name or null
 */
function getEntityType(item) {
  // Try to determine entity type from common properties
  if (item.entityType) {
    return item.entityType;
  }
  
  if (item['@odata.type']) {
    const match = item['@odata.type'].match(/#([^.]+)\.([^.]+)/);
    if (match) {
      return match[2];
    }
  }
  
  // Try to infer from the item's properties
  if (item.category && item.photoUrls) {
    return 'Pet';
  }
  
  if (item.shipDate && item.petId) {
    return 'Order';
  }
  
  return null;
}

module.exports = {
  extractRelationships,
  applyExpand
};
