/**
 * EDMX Parser Module
 * 
 * Parses OData EDMX metadata documents to extract entity types, entity sets, and properties
 */

const { XMLParser } = require('fast-xml-parser');

/**
 * Parses an EDMX metadata document
 * @param {string} edmxContent - The EDMX XML content
 * @returns {Object} Parsed metadata information
 */
async function parseEdmx(edmxContent) {
  // Create XML parser with appropriate options
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name, jpath, isLeafNode, isAttribute) => {
      // Elements that should always be treated as arrays even when there's only one
      const arrayElements = [
        'EntityType', 'EntitySet', 'Property', 'NavigationProperty', 
        'Schema', 'EntityContainer'
      ];
      return arrayElements.includes(name);
    }
  });
  
  try {
    // Parse the EDMX XML
    const parsed = parser.parse(edmxContent);
    
    // Initialize result object
    const result = {
      version: getEdmxVersion(parsed),
      entityTypes: [],
      entitySets: [],
      relationships: [],
      functions: [],
      actions: []
    };
    
    // Extract data from the parsed EDMX
    if (parsed.edmx && parsed.edmx.DataServices) {
      const dataServices = parsed.edmx.DataServices;
      
      // Process each schema
      if (dataServices.Schema) {
        for (const schema of Array.isArray(dataServices.Schema) 
          ? dataServices.Schema 
          : [dataServices.Schema]) {
          
          // Extract namespace
          const namespace = schema['@_Namespace'];
          result.namespace = namespace;
          
          // Process entity types
          if (schema.EntityType) {
            for (const entityType of schema.EntityType) {
              const parsedEntityType = parseEntityType(entityType, namespace);
              result.entityTypes.push(parsedEntityType);
            }
          }
          
          // Process entity container (for entity sets)
          if (schema.EntityContainer) {
            for (const container of schema.EntityContainer) {
              if (container.EntitySet) {
                for (const entitySet of container.EntitySet) {
                  const parsedEntitySet = parseEntitySet(entitySet, namespace);
                  result.entitySets.push(parsedEntitySet);
                }
              }
            }
          }
          
          // Process functions
          if (schema.Function) {
            for (const func of Array.isArray(schema.Function) 
              ? schema.Function 
              : [schema.Function]) {
              const parsedFunction = parseFunction(func, namespace);
              result.functions.push(parsedFunction);
            }
          }
          
          // Process actions
          if (schema.Action) {
            for (const action of Array.isArray(schema.Action) 
              ? schema.Action 
              : [schema.Action]) {
              const parsedAction = parseAction(action, namespace);
              result.actions.push(parsedAction);
            }
          }
        }
      }
    }
    
    return result;
  } catch (error) {
    throw new Error(`Error parsing EDMX: ${error.message}`);
  }
}

/**
 * Gets the EDMX version
 * @param {Object} parsed - The parsed EDMX
 * @returns {string} The EDMX version
 */
function getEdmxVersion(parsed) {
  if (parsed.edmx && parsed.edmx['@_Version']) {
    return parsed.edmx['@_Version'];
  }
  return 'unknown';
}

/**
 * Parses an entity type
 * @param {Object} entityType - The entity type object
 * @param {string} namespace - The schema namespace
 * @returns {Object} The parsed entity type
 */
function parseEntityType(entityType, namespace) {
  const result = {
    name: entityType['@_Name'],
    namespace: namespace,
    properties: [],
    navigationProperties: [],
    key: null
  };
  
  // Parse key
  if (entityType.Key && entityType.Key.PropertyRef) {
    const propertyRefs = Array.isArray(entityType.Key.PropertyRef) 
      ? entityType.Key.PropertyRef 
      : [entityType.Key.PropertyRef];
    
    result.key = propertyRefs.map(ref => ref['@_Name']);
  }
  
  // Parse properties
  if (entityType.Property) {
    for (const property of entityType.Property) {
      result.properties.push({
        name: property['@_Name'],
        type: property['@_Type'],
        nullable: property['@_Nullable'] !== 'false',
        defaultValue: property['@_DefaultValue']
      });
    }
  }
  
  // Parse navigation properties
  if (entityType.NavigationProperty) {
    for (const navProp of entityType.NavigationProperty) {
      result.navigationProperties.push({
        name: navProp['@_Name'],
        type: navProp['@_Type'],
        partner: navProp['@_Partner'],
        containsTarget: navProp['@_ContainsTarget'] === 'true'
      });
    }
  }
  
  return result;
}

/**
 * Parses an entity set
 * @param {Object} entitySet - The entity set object
 * @param {string} namespace - The schema namespace
 * @returns {Object} The parsed entity set
 */
function parseEntitySet(entitySet, namespace) {
  return {
    name: entitySet['@_Name'],
    entityType: entitySet['@_EntityType'],
    namespace: namespace
  };
}

/**
 * Parses a function
 * @param {Object} func - The function object
 * @param {string} namespace - The schema namespace
 * @returns {Object} The parsed function
 */
function parseFunction(func, namespace) {
  const result = {
    name: func['@_Name'],
    namespace: namespace,
    parameters: [],
    returnType: null
  };
  
  // Parse parameters
  if (func.Parameter) {
    const parameters = Array.isArray(func.Parameter) 
      ? func.Parameter 
      : [func.Parameter];
    
    for (const param of parameters) {
      result.parameters.push({
        name: param['@_Name'],
        type: param['@_Type'],
        nullable: param['@_Nullable'] !== 'false'
      });
    }
  }
  
  // Parse return type
  if (func.ReturnType) {
    result.returnType = {
      type: func.ReturnType['@_Type'],
      nullable: func.ReturnType['@_Nullable'] !== 'false'
    };
  }
  
  return result;
}

/**
 * Parses an action
 * @param {Object} action - The action object
 * @param {string} namespace - The schema namespace
 * @returns {Object} The parsed action
 */
function parseAction(action, namespace) {
  const result = {
    name: action['@_Name'],
    namespace: namespace,
    parameters: [],
    returnType: null
  };
  
  // Parse parameters
  if (action.Parameter) {
    const parameters = Array.isArray(action.Parameter) 
      ? action.Parameter 
      : [action.Parameter];
    
    for (const param of parameters) {
      result.parameters.push({
        name: param['@_Name'],
        type: param['@_Type'],
        nullable: param['@_Nullable'] !== 'false'
      });
    }
  }
  
  // Parse return type
  if (action.ReturnType) {
    result.returnType = {
      type: action.ReturnType['@_Type'],
      nullable: action.ReturnType['@_Nullable'] !== 'false'
    };
  }
  
  return result;
}

module.exports = {
  parseEdmx
};
