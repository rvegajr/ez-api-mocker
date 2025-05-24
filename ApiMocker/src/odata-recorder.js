const fs = require('fs');
const path = require('path');
const axios = require('axios');
const xml2js = require('xml2js');

/**
 * Fetches the OData $metadata document
 * @param {string} baseUrl - Base URL of the OData API
 * @param {Object} client - Axios client instance
 * @param {string} outputDir - Directory to save the metadata
 * @returns {Promise<Object>} Result with success status and metadata info
 */
async function fetchMetadata(baseUrl, client, outputDir) {
  const result = {
    success: false,
    metadata: null,
    error: null
  };
  
  try {
    // Normalize base URL (remove trailing slash)
    const normalizedUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    
    // Build the $metadata URL
    const metadataUrl = `${normalizedUrl}/odata/$metadata`;
    console.log(`Fetching OData metadata from: ${metadataUrl}`);
    
    // Make the request
    const response = await client.get('odata/$metadata', {
      headers: {
        'Accept': 'application/xml'
      }
    });
    
    // Save the raw metadata XML
    const metadataPath = path.join(outputDir, '$metadata.xml');
    fs.writeFileSync(metadataPath, response.data);
    
    // Parse the XML to extract entity types and relationships
    const parser = new xml2js.Parser({ explicitArray: false });
    const parsedMetadata = await parser.parseStringPromise(response.data);
    
    // Extract relationships from the metadata
    const relationships = extractRelationships(response.data);
    
    // Save the parsed metadata as JSON for easier processing
    const metadataJsonPath = path.join(outputDir, '$metadata.json');
    fs.writeFileSync(metadataJsonPath, JSON.stringify(parsedMetadata, null, 2));
    
    // Save relationships as a separate file
    const relationshipsPath = path.join(outputDir, 'relationships.json');
    fs.writeFileSync(relationshipsPath, JSON.stringify(relationships, null, 2));
    
    result.success = true;
    result.metadata = parsedMetadata;
    result.relationships = relationships;
    
    console.log(`✅ Saved OData metadata to ${metadataPath}`);
    
  } catch (error) {
    console.error(`❌ Failed to fetch OData metadata: ${error.message}`);
    result.error = error.message;
    
    // Create error metadata file
    const errorPath = path.join(outputDir, '$metadata-error.json');
    const errorData = {
      error: true,
      message: error.message,
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(errorPath, JSON.stringify(errorData, null, 2));
  }
  
  return result;
}

/**
 * Extracts entity relationships from OData metadata XML
 * @param {string} metadataXml - OData metadata XML string
 * @returns {Object} Extracted relationships
 */
function extractRelationships(metadataXml) {
  const relationships = {};
  
  try {
    // Parse the XML synchronously to extract relationships
    let parsedMetadata;
    const parser = new xml2js.Parser({ explicitArray: false });
    parser.parseString(metadataXml, (err, result) => {
      if (err) throw err;
      parsedMetadata = result;
    });
    
    if (!parsedMetadata || 
        !parsedMetadata['edmx:Edmx'] || 
        !parsedMetadata['edmx:Edmx']['edmx:DataServices'] || 
        !parsedMetadata['edmx:Edmx']['edmx:DataServices']['Schema']) {
      return relationships;
    }
    
    const schema = parsedMetadata['edmx:Edmx']['edmx:DataServices']['Schema'];
    const entityTypes = Array.isArray(schema) 
      ? schema.flatMap(s => s.EntityType || [])
      : (schema.EntityType ? (Array.isArray(schema.EntityType) ? schema.EntityType : [schema.EntityType]) : []);
    
    // Process each entity type
    for (const entityType of entityTypes) {
      const entityName = entityType.$.Name;
      relationships[entityName] = {};
      
      // Check for navigation properties
      if (entityType.NavigationProperty) {
        const navProps = Array.isArray(entityType.NavigationProperty) 
          ? entityType.NavigationProperty 
          : [entityType.NavigationProperty];
        
        for (const navProp of navProps) {
          const propName = navProp.$.Name;
          const propType = navProp.$.Type;
          
          // Check if it's a collection
          const isCollection = propType.startsWith('Collection(');
          
          // Extract target entity name
          let targetEntity;
          if (isCollection) {
            targetEntity = propType.substring(11, propType.length - 1); // Remove Collection() wrapper
          } else {
            targetEntity = propType;
          }
          
          // Remove namespace if present
          if (targetEntity.includes('.')) {
            targetEntity = targetEntity.split('.').pop();
          }
          
          // Add to relationships
          relationships[entityName][propName] = {
            targetEntity,
            isCollection
          };
        }
      }
    }
    
  } catch (error) {
    console.error(`Failed to extract relationships: ${error.message}`);
  }
  
  return relationships;
}

/**
 * Records an OData entity with various query options
 * @param {string} baseUrl - Base URL of the OData API
 * @param {Object} endpoint - Endpoint information
 * @param {Object} client - Axios client instance
 * @param {string} outputDir - Directory to save responses
 * @param {Array<string>} queryOptions - OData query options to test
 * @param {Object} relationships - Entity relationships
 * @returns {Promise<Array>} Results of recording operations
 */
async function recordEntityWithQueryOptions(baseUrl, endpoint, client, outputDir, queryOptions, relationships) {
  const results = [];
  
  try {
    // Record the base entity first
    console.log(`Recording base entity: ${endpoint.path}`);
    const baseResponse = await client.get(endpoint.path);
    
    // Create a sanitized filename
    const baseFilename = endpoint.operationId
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase();
    
    // Save the base response
    fs.writeFileSync(
      path.join(outputDir, `${baseFilename}.json`),
      JSON.stringify(baseResponse.data, null, 2)
    );
    
    results.push({
      success: true,
      path: endpoint.path,
      queryOption: null,
      statusCode: baseResponse.status
    });
    
    // Extract entity name from path (e.g., /odata/Users -> Users)
    const entityName = endpoint.path.split('/').pop();
    
    // Process each query option
    for (const option of queryOptions) {
      if (option === '$select') {
        // Use $select with common fields
        await recordWithSelect(baseUrl, endpoint, client, outputDir, results);
      } else if (option === '$expand' && relationships) {
        // Use $expand with related entities
        await recordWithExpand(baseUrl, endpoint, client, outputDir, results, entityName, relationships);
      } else if (option === '$filter') {
        // Use $filter with common conditions
        await recordWithFilter(baseUrl, endpoint, client, outputDir, results);
      } else if (option === '$orderby') {
        // Use $orderby for sorting
        await recordWithOrderBy(baseUrl, endpoint, client, outputDir, results);
      } else if (option === '$top' || option === '$skip') {
        // Use $top and $skip for paging
        await recordWithPaging(baseUrl, endpoint, client, outputDir, results);
      }
    }
    
  } catch (error) {
    console.error(`❌ Failed to record entity with query options: ${error.message}`);
    results.push({
      success: false,
      path: endpoint.path,
      error: error.message
    });
  }
  
  return results;
}

/**
 * Records entity with $select query option
 */
async function recordWithSelect(baseUrl, endpoint, client, outputDir, results) {
  try {
    // Create a select query with common fields (id and name)
    const selectUrl = `${endpoint.path}?$select=id,name`;
    console.log(`Recording with $select: ${selectUrl}`);
    
    const response = await client.get(selectUrl);
    
    // Create a filename for the select query
    const filename = `${endpoint.operationId}_select_id_name`
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase();
    
    // Save the response
    fs.writeFileSync(
      path.join(outputDir, `${filename}.json`),
      JSON.stringify(response.data, null, 2)
    );
    
    results.push({
      success: true,
      path: selectUrl,
      queryOption: '$select',
      statusCode: response.status
    });
    
  } catch (error) {
    console.error(`Failed to record with $select: ${error.message}`);
    results.push({
      success: false,
      path: `${endpoint.path}?$select=id,name`,
      queryOption: '$select',
      error: error.message
    });
  }
}

/**
 * Records entity with $expand query option
 */
async function recordWithExpand(baseUrl, endpoint, client, outputDir, results, entityName, relationships) {
  try {
    // Find navigation properties for this entity
    const entityKey = Object.keys(relationships).find(key => 
      key.toLowerCase() === entityName.toLowerCase() || 
      key.toLowerCase() === entityName.toLowerCase().slice(0, -1) // Handle plurals
    );
    
    if (entityKey && relationships[entityKey]) {
      // Get first navigation property
      const navProp = Object.keys(relationships[entityKey])[0];
      
      if (navProp) {
        const expandUrl = `${endpoint.path}?$expand=${navProp}`;
        console.log(`Recording with $expand: ${expandUrl}`);
        
        const response = await client.get(expandUrl);
        
        // Create a filename for the expand query
        const filename = `${endpoint.operationId}_expand_${navProp}`
          .replace(/[^a-zA-Z0-9]/g, '_')
          .toLowerCase();
        
        // Save the response
        fs.writeFileSync(
          path.join(outputDir, `${filename}.json`),
          JSON.stringify(response.data, null, 2)
        );
        
        results.push({
          success: true,
          path: expandUrl,
          queryOption: '$expand',
          navigationProperty: navProp,
          statusCode: response.status
        });
      }
    }
  } catch (error) {
    console.error(`Failed to record with $expand: ${error.message}`);
    results.push({
      success: false,
      path: endpoint.path,
      queryOption: '$expand',
      error: error.message
    });
  }
}

/**
 * Records entity with $filter query option
 */
async function recordWithFilter(baseUrl, endpoint, client, outputDir, results) {
  try {
    // Create a basic filter (assuming id field exists)
    const filterUrl = `${endpoint.path}?$filter=id eq 1`;
    console.log(`Recording with $filter: ${filterUrl}`);
    
    const response = await client.get(filterUrl);
    
    // Create a filename for the filter query
    const filename = `${endpoint.operationId}_filter_id_eq_1`
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase();
    
    // Save the response
    fs.writeFileSync(
      path.join(outputDir, `${filename}.json`),
      JSON.stringify(response.data, null, 2)
    );
    
    results.push({
      success: true,
      path: filterUrl,
      queryOption: '$filter',
      statusCode: response.status
    });
    
  } catch (error) {
    console.error(`Failed to record with $filter: ${error.message}`);
    results.push({
      success: false,
      path: `${endpoint.path}?$filter=id eq 1`,
      queryOption: '$filter',
      error: error.message
    });
  }
}

/**
 * Records entity with $orderby query option
 */
async function recordWithOrderBy(baseUrl, endpoint, client, outputDir, results) {
  try {
    // Create a basic orderby query
    const orderbyUrl = `${endpoint.path}?$orderby=id desc`;
    console.log(`Recording with $orderby: ${orderbyUrl}`);
    
    const response = await client.get(orderbyUrl);
    
    // Create a filename for the orderby query
    const filename = `${endpoint.operationId}_orderby_id_desc`
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase();
    
    // Save the response
    fs.writeFileSync(
      path.join(outputDir, `${filename}.json`),
      JSON.stringify(response.data, null, 2)
    );
    
    results.push({
      success: true,
      path: orderbyUrl,
      queryOption: '$orderby',
      statusCode: response.status
    });
    
  } catch (error) {
    console.error(`Failed to record with $orderby: ${error.message}`);
    results.push({
      success: false,
      path: `${endpoint.path}?$orderby=id desc`,
      queryOption: '$orderby',
      error: error.message
    });
  }
}

/**
 * Records entity with $top and $skip query options
 */
async function recordWithPaging(baseUrl, endpoint, client, outputDir, results) {
  try {
    // Create a paging query
    const pagingUrl = `${endpoint.path}?$top=5&$skip=0`;
    console.log(`Recording with paging: ${pagingUrl}`);
    
    const response = await client.get(pagingUrl);
    
    // Create a filename for the paging query
    const filename = `${endpoint.operationId}_top_5_skip_0`
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase();
    
    // Save the response
    fs.writeFileSync(
      path.join(outputDir, `${filename}.json`),
      JSON.stringify(response.data, null, 2)
    );
    
    results.push({
      success: true,
      path: pagingUrl,
      queryOption: 'paging',
      statusCode: response.status
    });
    
  } catch (error) {
    console.error(`Failed to record with paging: ${error.message}`);
    results.push({
      success: false,
      path: `${endpoint.path}?$top=5&$skip=0`,
      queryOption: 'paging',
      error: error.message
    });
  }
}

/**
 * Fetches the OData service document
 * @param {string} baseUrl - Base URL of the OData API
 * @param {Object} client - Axios client instance
 * @param {string} outputDir - Directory to save the service document
 * @returns {Promise<Object>} Result with success status and entity sets
 */
async function fetchServiceDocument(baseUrl, client, outputDir) {
  const result = {
    success: false,
    entitySets: [],
    error: null
  };
  
  try {
    // Normalize base URL (remove trailing slash)
    const normalizedUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    
    // Build the service document URL
    const serviceUrl = `${normalizedUrl}/odata`;
    console.log(`Fetching OData service document from: ${serviceUrl}`);
    
    // Make the request
    const response = await client.get('odata');
    
    // Save the service document
    const servicePath = path.join(outputDir, 'service-document.json');
    fs.writeFileSync(servicePath, JSON.stringify(response.data, null, 2));
    
    // Extract entity sets
    const entitySets = extractEntitySetsFromService(response.data);
    
    result.success = true;
    result.entitySets = entitySets;
    
    console.log(`✅ Saved OData service document to ${servicePath}`);
    console.log(`Found ${entitySets.length} entity sets: ${entitySets.join(', ')}`);
    
  } catch (error) {
    console.error(`❌ Failed to fetch OData service document: ${error.message}`);
    result.error = error.message;
    
    // Create error service document
    const errorPath = path.join(outputDir, 'service-document-error.json');
    const errorData = {
      error: true,
      message: error.message,
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(errorPath, JSON.stringify(errorData, null, 2));
  }
  
  return result;
}

/**
 * Extracts entity sets from OData service document
 * @param {Object} serviceDocument - OData service document object
 * @returns {Array<string>} List of entity set names
 */
function extractEntitySetsFromService(serviceDocument) {
  const entitySets = [];
  
  try {
    if (serviceDocument && 
        serviceDocument.value && 
        Array.isArray(serviceDocument.value)) {
      
      for (const item of serviceDocument.value) {
        if (item.kind === 'EntitySet') {
          entitySets.push(item.name);
        }
      }
    }
  } catch (error) {
    console.error(`Failed to extract entity sets: ${error.message}`);
  }
  
  return entitySets;
}

module.exports = {
  fetchMetadata,
  extractRelationships,
  recordEntityWithQueryOptions,
  fetchServiceDocument,
  extractEntitySetsFromService
};
