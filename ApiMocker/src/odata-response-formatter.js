/**
 * OData Response Formatter Module
 * Formats responses according to OData conventions
 */

/**
 * Formats a response according to OData conventions
 * @param {Array|Object} data - The data to format
 * @param {Object} options - Formatting options
 * @returns {Object} The formatted OData response
 */
function formatResponse(data, options = {}) {
  // Handle array data
  if (Array.isArray(data)) {
    const response = {
      '@odata.context': options.context || '',
      value: data
    };
    
    // Add count if requested or provided
    if (options.count !== undefined) {
      response['@odata.count'] = options.count;
    }
    
    // Add nextLink if provided
    if (options.nextLink) {
      response['@odata.nextLink'] = options.nextLink;
    }
    
    return response;
  }
  
  // Handle single entity
  if (data && typeof data === 'object') {
    if (options.context) {
      return {
        '@odata.context': options.context,
        ...data
      };
    }
    return data;
  }
  
  // Handle empty or invalid data
  return {
    '@odata.context': options.context || '',
    value: []
  };
}

/**
 * Creates an OData error response
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {Object} details - Additional error details
 * @returns {Object} The formatted OData error response
 */
function formatError(code, message, details = {}) {
  return {
    error: {
      code: code,
      message: message,
      details: details,
      innererror: details.innererror || {}
    }
  };
}

/**
 * Generates OData context URL
 * @param {string} servicePath - The service root path
 * @param {string} entitySet - The entity set name
 * @param {string} selectOption - The $select query option
 * @param {string} expandOption - The $expand query option
 * @returns {string} The OData context URL
 */
function generateContextUrl(servicePath, entitySet, selectOption, expandOption) {
  let context = `${servicePath}/$metadata#${entitySet}`;
  
  // Add $select to context if provided
  if (selectOption) {
    context += `(${selectOption})`;
  }
  
  return context;
}

/**
 * Formats metadata for entity type
 * @param {string} namespace - The namespace
 * @param {string} typeName - The type name
 * @param {Object} properties - The properties of the type
 * @returns {Object} The formatted metadata
 */
function formatEntityType(namespace, typeName, properties) {
  const formattedProperties = {};
  
  for (const [name, type] of Object.entries(properties)) {
    formattedProperties[name] = {
      type: mapToEdmType(type)
    };
  }
  
  return {
    name: typeName,
    properties: formattedProperties
  };
}

/**
 * Maps JavaScript types to EDM types
 * @param {*} value - The value to map
 * @returns {string} The EDM type
 */
function mapToEdmType(value) {
  if (value === null || value === undefined) {
    return 'Edm.String';
  }
  
  switch (typeof value) {
    case 'string':
      return 'Edm.String';
    case 'number':
      return Number.isInteger(value) ? 'Edm.Int32' : 'Edm.Double';
    case 'boolean':
      return 'Edm.Boolean';
    case 'object':
      if (value instanceof Date) {
        return 'Edm.DateTimeOffset';
      }
      return 'Edm.ComplexType';
    default:
      return 'Edm.String';
  }
}

/**
 * Formats a collection for OData response
 * @param {Array} collection - The collection to format
 * @param {Object} options - Formatting options
 * @returns {Object} The formatted OData response
 */
function formatCollection(collection, options = {}) {
  const { skip, top, count, filter, orderby, select, expand } = options;
  
  let result = [...collection];
  
  // Apply filtering if provided
  if (filter && typeof filter === 'function') {
    result = result.filter(filter);
  }
  
  // Get total count before pagination
  const totalCount = result.length;
  
  // Apply sorting if provided
  if (orderby && typeof orderby === 'function') {
    result = result.sort(orderby);
  }
  
  // Apply pagination
  if (skip !== undefined) {
    const skipCount = parseInt(skip, 10);
    if (!isNaN(skipCount) && skipCount >= 0) {
      result = result.slice(skipCount);
    }
  }
  
  if (top !== undefined) {
    const topCount = parseInt(top, 10);
    if (!isNaN(topCount) && topCount >= 0) {
      result = result.slice(0, topCount);
    }
  }
  
  // Apply projection if provided
  if (select && typeof select === 'function') {
    result = result.map(select);
  }
  
  // Format the response
  const response = {
    '@odata.context': options.context || '',
    value: result
  };
  
  // Add count if requested
  if (count === true || count === 'true') {
    response['@odata.count'] = totalCount;
  }
  
  // Add nextLink if there are more results
  if (top !== undefined && skip !== undefined) {
    const skipCount = parseInt(skip, 10) || 0;
    const topCount = parseInt(top, 10) || 0;
    
    if (skipCount + topCount < totalCount) {
      const nextSkip = skipCount + topCount;
      response['@odata.nextLink'] = `${options.baseUrl || ''}?$skip=${nextSkip}&$top=${topCount}`;
    }
  }
  
  return response;
}

module.exports = {
  formatResponse,
  formatError,
  generateContextUrl,
  formatEntityType,
  formatCollection
};
