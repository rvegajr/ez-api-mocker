/**
 * OData Query Processor Module
 * Processes OData query options and applies them to data
 */

/**
 * Processes OData query options and applies them to data
 * @param {Array} data - The data to process
 * @param {Object} queryOptions - The OData query options
 * @returns {Object} The processed data and metadata
 */
function processQuery(data, queryOptions) {
  if (!data || !Array.isArray(data)) {
    return { value: [] };
  }

  let result = [...data];
  let count = null;
  
  // Process $filter
  if (queryOptions.$filter) {
    result = applyFilter(result, queryOptions.$filter);
  }
  
  // Process $count
  if (queryOptions.$count === 'true') {
    count = result.length;
  }
  
  // Process $orderby
  if (queryOptions.$orderby) {
    result = applyOrderBy(result, queryOptions.$orderby);
  }
  
  // Process $skip
  if (queryOptions.$skip) {
    const skip = parseInt(queryOptions.$skip, 10);
    if (!isNaN(skip) && skip >= 0) {
      result = result.slice(skip);
    }
  }
  
  // Process $top
  if (queryOptions.$top) {
    const top = parseInt(queryOptions.$top, 10);
    if (!isNaN(top) && top >= 0) {
      result = result.slice(0, top);
    }
  }
  
  // Process $select
  if (queryOptions.$select) {
    result = applySelect(result, queryOptions.$select);
  }
  
  // Process $expand
  if (queryOptions.$expand) {
    result = applyExpand(result, queryOptions.$expand);
  }
  
  // Create OData response format
  const response = {
    value: result
  };
  
  // Add count if requested
  if (count !== null) {
    response['@odata.count'] = count;
  }
  
  return response;
}

/**
 * Applies $select query option to data
 * @param {Array} data - The data to process
 * @param {string} selectOption - The $select query option
 * @returns {Array} The filtered data
 */
function applySelect(data, selectOption) {
  if (!selectOption) {
    return data;
  }
  
  const properties = selectOption.split(',').map(prop => prop.trim());
  
  return data.map(item => {
    const result = {};
    
    for (const prop of properties) {
      if (prop.includes('/')) {
        // Handle nested properties
        const [parent, child] = prop.split('/');
        if (item[parent]) {
          if (!result[parent]) {
            result[parent] = {};
          }
          result[parent][child] = item[parent][child];
        }
      } else {
        // Handle regular properties
        if (item.hasOwnProperty(prop)) {
          result[prop] = item[prop];
        }
      }
    }
    
    return result;
  });
}

/**
 * Applies $filter query option to data
 * @param {Array} data - The data to process
 * @param {string} filterOption - The $filter query option
 * @returns {Array} The filtered data
 */
function applyFilter(data, filterOption) {
  if (!filterOption) {
    return data;
  }
  
  // Simple filter parser for common operations
  return data.filter(item => {
    try {
      return evaluateFilterExpression(item, filterOption);
    } catch (error) {
      console.warn(`Error evaluating filter expression: ${error.message}`);
      return true; // Include item if filter evaluation fails
    }
  });
}

/**
 * Evaluates a filter expression against an item
 * @param {Object} item - The item to evaluate
 * @param {string} expression - The filter expression
 * @returns {boolean} The result of the evaluation
 */
function evaluateFilterExpression(item, expression) {
  // Handle 'and' operator
  if (expression.includes(' and ')) {
    const parts = expression.split(' and ');
    return parts.every(part => evaluateFilterExpression(item, part.trim()));
  }
  
  // Handle 'or' operator
  if (expression.includes(' or ')) {
    const parts = expression.split(' or ');
    return parts.some(part => evaluateFilterExpression(item, part.trim()));
  }
  
  // Handle comparison operators
  const operators = [
    { symbol: ' eq ', operation: (a, b) => a === b },
    { symbol: ' ne ', operation: (a, b) => a !== b },
    { symbol: ' gt ', operation: (a, b) => a > b },
    { symbol: ' ge ', operation: (a, b) => a >= b },
    { symbol: ' lt ', operation: (a, b) => a < b },
    { symbol: ' le ', operation: (a, b) => a <= b },
    { symbol: ' contains ', operation: (a, b) => a.includes(b) }
  ];
  
  for (const { symbol, operation } of operators) {
    if (expression.includes(symbol)) {
      const [left, right] = expression.split(symbol);
      const leftValue = evaluateValue(item, left.trim());
      const rightValue = parseValue(right.trim());
      
      return operation(leftValue, rightValue);
    }
  }
  
  // Handle 'startswith' function
  if (expression.includes('startswith(')) {
    const match = expression.match(/startswith\(([^,]+),\s*([^)]+)\)/);
    if (match) {
      const [, property, value] = match;
      const propValue = evaluateValue(item, property.trim());
      const compareValue = parseValue(value.trim());
      
      return propValue.startsWith(compareValue);
    }
  }
  
  // Handle 'endswith' function
  if (expression.includes('endswith(')) {
    const match = expression.match(/endswith\(([^,]+),\s*([^)]+)\)/);
    if (match) {
      const [, property, value] = match;
      const propValue = evaluateValue(item, property.trim());
      const compareValue = parseValue(value.trim());
      
      return propValue.endsWith(compareValue);
    }
  }
  
  // Default to true if expression can't be parsed
  console.warn(`Unsupported filter expression: ${expression}`);
  return true;
}

/**
 * Evaluates a property path against an item
 * @param {Object} item - The item to evaluate
 * @param {string} propertyPath - The property path
 * @returns {*} The property value
 */
function evaluateValue(item, propertyPath) {
  if (propertyPath.includes('/')) {
    // Handle nested properties
    const parts = propertyPath.split('/');
    let value = item;
    
    for (const part of parts) {
      if (value === null || value === undefined) {
        return null;
      }
      value = value[part];
    }
    
    return value;
  }
  
  return item[propertyPath];
}

/**
 * Parses a value from a filter expression
 * @param {string} value - The value to parse
 * @returns {*} The parsed value
 */
function parseValue(value) {
  // Remove quotes for string literals
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.substring(1, value.length - 1);
  }
  
  // Parse numbers
  if (!isNaN(value)) {
    return parseFloat(value);
  }
  
  // Parse booleans
  if (value === 'true') return true;
  if (value === 'false') return false;
  
  // Default to original value
  return value;
}

/**
 * Applies $orderby query option to data
 * @param {Array} data - The data to process
 * @param {string} orderbyOption - The $orderby query option
 * @returns {Array} The sorted data
 */
function applyOrderBy(data, orderbyOption) {
  if (!orderbyOption) {
    return data;
  }
  
  const sortFields = orderbyOption.split(',').map(field => {
    const [property, direction] = field.trim().split(' ');
    return {
      property: property.trim(),
      descending: direction && direction.toLowerCase() === 'desc'
    };
  });
  
  return [...data].sort((a, b) => {
    for (const { property, descending } of sortFields) {
      const valueA = a[property];
      const valueB = b[property];
      
      if (valueA === valueB) {
        continue; // Try next sort field
      }
      
      if (valueA === null || valueA === undefined) {
        return descending ? 1 : -1;
      }
      
      if (valueB === null || valueB === undefined) {
        return descending ? -1 : 1;
      }
      
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        const comparison = valueA.localeCompare(valueB);
        return descending ? -comparison : comparison;
      }
      
      return descending ? valueB - valueA : valueA - valueB;
    }
    
    return 0; // All fields are equal
  });
}

/**
 * Applies $expand query option to data
 * @param {Array} data - The data to process
 * @param {string} expandOption - The $expand query option
 * @returns {Array} The expanded data
 */
function applyExpand(data, expandOption) {
  if (!expandOption) {
    return data;
  }
  
  // This is a simplified implementation that assumes the expanded data
  // is already present in the item. In a real implementation, you would
  // need to fetch the related entities from the data store.
  
  return data;
}

module.exports = {
  processQuery,
  applySelect,
  applyFilter,
  applyOrderBy,
  applyExpand
};
