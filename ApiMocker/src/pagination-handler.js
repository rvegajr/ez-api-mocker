const fs = require('fs');
const path = require('path');
const URL = require('url').URL;

/**
 * Detects pagination format in API response
 * @param {Object} response - API response object
 * @returns {Object} Pagination information
 */
function detectPaginationFormat(response) {
  const result = {
    hasPagination: false,
    format: null,
    currentPage: null,
    totalPages: null,
    pageSize: null,
    totalItems: null,
    nextLink: null,
    nextCursor: null,
    hasMore: null
  };
  
  // Early return if no response data
  if (!response || !response.data) {
    return result;
  }
  
  const data = response.data;
  
  // Check for standard pagination (page, pageSize, totalPages)
  if (data.page !== undefined && data.totalPages !== undefined) {
    result.hasPagination = true;
    result.format = 'standard';
    result.currentPage = data.page;
    result.totalPages = data.totalPages;
    result.pageSize = data.pageSize || data.limit || data.perPage;
    result.totalItems = data.totalItems || data.total || data.count;
    return result;
  }
  
  // Check for OData pagination (@odata.count, @odata.nextLink)
  if (data['@odata.count'] !== undefined || data['@odata.nextLink'] !== undefined) {
    result.hasPagination = true;
    result.format = 'odata';
    result.totalItems = data['@odata.count'];
    result.nextLink = data['@odata.nextLink'];
    return result;
  }
  
  // Check for cursor-based pagination
  if ((data.cursor !== undefined || data.nextCursor !== undefined) && 
      (data.hasMoreItems !== undefined || data.hasMore !== undefined)) {
    result.hasPagination = true;
    result.format = 'cursor';
    result.nextCursor = data.cursor || data.nextCursor || data.nextPageToken;
    result.hasMore = data.hasMoreItems || data.hasMore || data.moreResults === true;
    return result;
  }
  
  // Check for Link header pagination (common in GitHub and other APIs)
  if (response.headers && response.headers.link) {
    const linkHeader = response.headers.link;
    const nextLink = linkHeader.split(',').find(link => link.includes('rel="next"'));
    if (nextLink) {
      const match = nextLink.match(/<([^>]+)>/);
      if (match) {
        result.hasPagination = true;
        result.format = 'link-header';
        result.nextLink = match[1];
        return result;
      }
    }
  }
  
  return result;
}

/**
 * Truncates large response data to a specified size limit
 * @param {Object} responseData - Response data object
 * @param {number} maxItems - Maximum number of items to keep
 * @returns {Object} Truncated response data
 */
function truncateLargeResponse(responseData, maxItems = 100) {
  // Clone the response data to avoid modifying the original
  const result = JSON.parse(JSON.stringify(responseData));
  
  // Determine the data structure and truncate accordingly
  if (Array.isArray(result)) {
    // Direct array response
    const originalSize = result.length;
    if (originalSize > maxItems) {
      const truncated = result.slice(0, maxItems);
      return {
        _truncated: true,
        _originalSize: originalSize,
        _note: `Response truncated to ${maxItems} items`,
        items: truncated
      };
    }
    return result;
  } 
  
  // Object with items array
  if (result.items && Array.isArray(result.items)) {
    const originalSize = result.items.length;
    if (originalSize > maxItems) {
      result.items = result.items.slice(0, maxItems);
      result._truncated = true;
      result._originalSize = originalSize;
      result._note = `Response truncated to ${maxItems} items`;
    }
    return result;
  }
  
  // OData response
  if (result.value && Array.isArray(result.value)) {
    const originalSize = result.value.length;
    if (originalSize > maxItems) {
      result.value = result.value.slice(0, maxItems);
      result._truncated = true;
      result._originalSize = originalSize;
      result._note = `Response truncated to ${maxItems} items`;
    }
    return result;
  }
  
  // No recognized format to truncate
  return result;
}

/**
 * Records all pages of a paginated response
 * @param {string} baseUrl - Base URL of the API
 * @param {Object} endpoint - Endpoint information
 * @param {Object} client - Axios client instance
 * @param {string} outputDir - Directory to save responses
 * @param {Object} options - Additional options
 * @returns {Promise<Array>} Results of recording operations for each page
 */
async function recordAllPages(baseUrl, endpoint, client, outputDir, options = {}) {
  const results = [];
  const allItems = [];
  let hasMorePages = true;
  let pageCounter = 1;
  let nextPageUrl = null;
  let nextCursor = null;
  let combinedResponse = null;
  
  // Create base filename
  const baseFilename = endpoint.operationId
    .replace(/[^a-zA-Z0-9]/g, '_')
    .toLowerCase();
  
  try {
    console.log(`Recording paginated responses for: ${endpoint.path}`);
    
    // For OData, start with $top parameter
    let initialUrl = endpoint.path;
    if (endpoint.isOData) {
      const pageSize = options.pageSize || 20;
      initialUrl += initialUrl.includes('?') ? 
        `&$top=${pageSize}` : 
        `?$top=${pageSize}`;
    } else {
      // For standard pagination, start with page=1
      initialUrl += initialUrl.includes('?') ? 
        '&page=1' : 
        '?page=1';
    }
    
    // Get first page
    let currentUrl = initialUrl;
    
    while (hasMorePages) {
      console.log(`Fetching page ${pageCounter}: ${currentUrl}`);
      
      // Make the request
      const response = await client.get(currentUrl);
      
      // Detect pagination format
      const paginationInfo = detectPaginationFormat(response);
      
      // Save individual page response
      const pageFilename = `${baseFilename}_page_${pageCounter}.json`;
      fs.writeFileSync(
        path.join(outputDir, pageFilename),
        JSON.stringify(response.data, null, 2)
      );
      
      // Add result for this page
      results.push({
        success: true,
        pageNumber: pageCounter,
        url: currentUrl,
        statusCode: response.status,
        isOData: endpoint.isOData || false,
        paginationInfo
      });
      
      // Extract items from this page
      let pageItems = [];
      if (response.data.items) {
        pageItems = response.data.items;
      } else if (response.data.value) {
        pageItems = response.data.value;
      } else if (Array.isArray(response.data)) {
        pageItems = response.data;
      }
      
      // Add items to our combined collection
      allItems.push(...pageItems);
      
      // Set up combined response structure if this is the first page
      if (pageCounter === 1) {
        if (response.data.items) {
          // Standard items array
          combinedResponse = {
            ...response.data,
            items: [] // Will populate at the end
          };
        } else if (response.data.value) {
          // OData format
          combinedResponse = {
            ...response.data,
            value: [] // Will populate at the end
          };
          
          // Remove nextLink as it won't be valid for combined response
          if (combinedResponse['@odata.nextLink']) {
            delete combinedResponse['@odata.nextLink'];
          }
        } else if (Array.isArray(response.data)) {
          // Direct array response
          combinedResponse = [];
        }
      }
      
      // Determine if there are more pages and what the next URL should be
      if (paginationInfo.hasPagination) {
        if (paginationInfo.format === 'standard') {
          // Standard pagination
          if (paginationInfo.currentPage < paginationInfo.totalPages) {
            const nextPage = paginationInfo.currentPage + 1;
            // Replace page parameter in URL
            if (currentUrl.includes('page=')) {
              currentUrl = currentUrl.replace(/page=\d+/, `page=${nextPage}`);
            } else {
              currentUrl = endpoint.path + `?page=${nextPage}`;
            }
            hasMorePages = true;
          } else {
            hasMorePages = false;
          }
        } else if (paginationInfo.format === 'odata') {
          // OData pagination
          if (paginationInfo.nextLink) {
            // Extract relative path from nextLink (might be absolute URL)
            try {
              const nextLinkUrl = new URL(paginationInfo.nextLink);
              currentUrl = nextLinkUrl.pathname + nextLinkUrl.search;
            } catch (e) {
              // If not a valid URL, use as is (might be relative path)
              currentUrl = paginationInfo.nextLink;
            }
            hasMorePages = true;
          } else {
            hasMorePages = false;
          }
        } else if (paginationInfo.format === 'cursor') {
          // Cursor-based pagination
          if (paginationInfo.nextCursor && paginationInfo.hasMore) {
            nextCursor = paginationInfo.nextCursor;
            // Replace cursor parameter in URL
            if (currentUrl.includes('cursor=')) {
              currentUrl = currentUrl.replace(/cursor=[^&]+/, `cursor=${nextCursor}`);
            } else {
              currentUrl += currentUrl.includes('?') ? `&cursor=${nextCursor}` : `?cursor=${nextCursor}`;
            }
            hasMorePages = true;
          } else {
            hasMorePages = false;
          }
        } else if (paginationInfo.format === 'link-header') {
          // Link header pagination
          if (paginationInfo.nextLink) {
            // Extract relative path from nextLink (might be absolute URL)
            try {
              const nextLinkUrl = new URL(paginationInfo.nextLink);
              currentUrl = nextLinkUrl.pathname + nextLinkUrl.search;
            } catch (e) {
              // If not a valid URL, use as is (might be relative path)
              currentUrl = paginationInfo.nextLink;
            }
            hasMorePages = true;
          } else {
            hasMorePages = false;
          }
        } else {
          // Unknown or unsupported pagination format
          hasMorePages = false;
        }
      } else {
        // No pagination detected
        hasMorePages = false;
      }
      
      // Safety limit to prevent infinite loops
      if (pageCounter >= (options.maxPages || 10)) {
        console.log(`Reached maximum page limit (${options.maxPages || 10}). Stopping pagination.`);
        hasMorePages = false;
      }
      
      // Increment page counter
      pageCounter++;
    }
    
    // Create combined response with all items
    if (combinedResponse) {
      if (Array.isArray(combinedResponse)) {
        combinedResponse = allItems;
      } else if (combinedResponse.items) {
        combinedResponse.items = allItems;
        
        // Update metadata in combined response
        if (combinedResponse.page !== undefined) combinedResponse.page = 1;
        if (combinedResponse.totalPages !== undefined) combinedResponse.totalPages = 1;
        if (combinedResponse.pageSize !== undefined) combinedResponse.pageSize = allItems.length;
      } else if (combinedResponse.value) {
        combinedResponse.value = allItems;
        
        // Update OData metadata
        if (combinedResponse['@odata.count'] !== undefined) {
          combinedResponse['@odata.count'] = allItems.length;
        }
      }
      
      // Add metadata about the combined pages
      combinedResponse._paginationInfo = {
        originalPageCount: pageCounter - 1,
        combinedItemCount: allItems.length,
        timestamp: new Date().toISOString()
      };
      
      // Save combined response
      const combinedFilename = `${baseFilename}_all_pages.json`;
      fs.writeFileSync(
        path.join(outputDir, combinedFilename),
        JSON.stringify(combinedResponse, null, 2)
      );
      
      console.log(`✅ Saved combined response with ${allItems.length} items from ${pageCounter - 1} pages`);
    }
    
  } catch (error) {
    console.error(`❌ Failed to record paginated responses: ${error.message}`);
    results.push({
      success: false,
      pageNumber: pageCounter,
      error: error.message
    });
  }
  
  return results;
}

module.exports = {
  detectPaginationFormat,
  truncateLargeResponse,
  recordAllPages
};
