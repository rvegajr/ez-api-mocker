/**
 * GraphQL Parser Module
 * 
 * Parses GraphQL schema introspection results to extract types, queries, mutations, and fields
 */

/**
 * Parses a GraphQL schema from introspection results
 * @param {Object} schema - The GraphQL schema from introspection
 * @returns {Object} Parsed schema information
 */
function parseSchema(schema) {
  try {
    // Initialize result object
    const result = {
      queryType: schema.queryType?.name || null,
      mutationType: schema.mutationType?.name || null,
      subscriptionType: schema.subscriptionType?.name || null,
      types: []
    };
    
    // Process all types
    if (schema.types && Array.isArray(schema.types)) {
      // Filter out introspection types (those starting with __)
      const userTypes = schema.types.filter(type => !type.name.startsWith('__'));
      
      for (const type of userTypes) {
        const parsedType = parseType(type);
        result.types.push(parsedType);
      }
    }
    
    return result;
  } catch (error) {
    throw new Error(`Error parsing GraphQL schema: ${error.message}`);
  }
}

/**
 * Parses a GraphQL type
 * @param {Object} type - The GraphQL type
 * @returns {Object} The parsed type
 */
function parseType(type) {
  const result = {
    name: type.name,
    kind: type.kind,
    description: type.description || '',
    fields: [],
    interfaces: type.interfaces?.map(i => i.name) || [],
    possibleTypes: type.possibleTypes?.map(t => t.name) || [],
    enumValues: type.enumValues?.map(e => ({
      name: e.name,
      description: e.description || '',
      deprecated: e.isDeprecated,
      deprecationReason: e.deprecationReason
    })) || []
  };
  
  // Process fields
  if (type.fields && Array.isArray(type.fields)) {
    for (const field of type.fields) {
      result.fields.push({
        name: field.name,
        description: field.description || '',
        deprecated: field.isDeprecated,
        deprecationReason: field.deprecationReason,
        type: parseFieldType(field.type),
        args: field.args?.map(arg => ({
          name: arg.name,
          description: arg.description || '',
          type: parseFieldType(arg.type),
          defaultValue: arg.defaultValue
        })) || []
      });
    }
  }
  
  return result;
}

/**
 * Parses a GraphQL field type
 * @param {Object} type - The field type
 * @returns {Object} The parsed field type
 */
function parseFieldType(type) {
  // Handle non-null wrapper
  if (type.kind === 'NON_NULL') {
    const ofType = parseFieldType(type.ofType);
    return {
      ...ofType,
      nullable: false
    };
  }
  
  // Handle list wrapper
  if (type.kind === 'LIST') {
    const ofType = parseFieldType(type.ofType);
    return {
      kind: 'LIST',
      ofType: ofType,
      nullable: true
    };
  }
  
  // Handle named types
  return {
    kind: type.kind,
    name: type.name,
    nullable: true
  };
}

/**
 * Generates a GraphQL query for a type
 * @param {Object} type - The GraphQL type
 * @param {number} depth - Maximum depth for nested fields
 * @returns {string} The generated query
 */
function generateQuery(type, depth = 2) {
  if (!type || !type.fields || type.fields.length === 0) {
    return '';
  }
  
  // Use the type name to create a query
  const typeName = type.name.charAt(0).toLowerCase() + type.name.slice(1);
  
  // Generate field selections
  const fieldSelections = generateFieldSelections(type.fields, depth);
  
  return `
query Get${type.name} {
  ${typeName} {
${fieldSelections}
  }
}
`;
}

/**
 * Generates field selections for a GraphQL query
 * @param {Array} fields - The fields to include
 * @param {number} depth - Maximum depth for nested fields
 * @param {number} currentDepth - Current depth in the recursion
 * @param {string} indent - Indentation string
 * @returns {string} The generated field selections
 */
function generateFieldSelections(fields, maxDepth = 2, currentDepth = 0, indent = '    ') {
  if (currentDepth >= maxDepth || !fields || fields.length === 0) {
    return '';
  }
  
  return fields
    // Filter out fields with complex arguments for simplicity
    .filter(field => !field.args || field.args.length === 0)
    // Filter out fields with complex types at deep levels
    .filter(field => {
      if (currentDepth === 0) return true;
      const typeName = field.type.name || (field.type.ofType && field.type.ofType.name);
      return !typeName || ['String', 'Int', 'Float', 'Boolean', 'ID'].includes(typeName);
    })
    .map(field => {
      const fieldName = field.name;
      
      // Check if this is an object type that needs nested fields
      const isObjectType = field.type.kind === 'OBJECT' || 
                          (field.type.kind === 'LIST' && 
                           field.type.ofType && 
                           field.type.ofType.kind === 'OBJECT');
      
      if (isObjectType && currentDepth < maxDepth - 1) {
        // For object types, include nested fields
        const nestedFields = field.type.fields || 
                           (field.type.ofType && field.type.ofType.fields);
        
        if (nestedFields && nestedFields.length > 0) {
          const nestedSelections = generateFieldSelections(
            nestedFields, 
            maxDepth, 
            currentDepth + 1, 
            indent + '  '
          );
          
          return `${indent}${fieldName} {\n${nestedSelections}\n${indent}}`;
        }
      }
      
      // For scalar types, just include the field name
      return `${indent}${fieldName}`;
    })
    .join('\n');
}

module.exports = {
  parseSchema,
  generateQuery
};
