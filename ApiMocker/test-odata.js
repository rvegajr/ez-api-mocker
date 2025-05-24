/**
 * OData Testing Script for API Mocker
 * 
 * This script demonstrates how to use OData query capabilities with the API Mocker
 * It makes various OData requests to the Petstore API and displays the results
 */

const axios = require('axios');
const util = require('util');

// Configuration
const API_BASE_URL = 'http://localhost:3000';
const API_PATH = '/v2';
const COLLECTION = 'pets';

// Helper function to print results nicely
function printResult(title, data) {
  console.log('\n' + '='.repeat(80));
  console.log(`${title}:`);
  console.log('='.repeat(80));
  console.log(util.inspect(data, { depth: null, colors: true }));
}

// Helper function to make API requests
async function makeRequest(endpoint, params = {}) {
  try {
    const url = `${API_BASE_URL}${API_PATH}/${endpoint}`;
    console.log(`Making request to: ${url}`);
    if (Object.keys(params).length > 0) {
      console.log('With params:', params);
    }
    
    const response = await axios.get(url, { params });
    return response.data;
  } catch (error) {
    console.error('Error making request:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Response:', error.response.data);
    } else {
      console.error(error.message);
    }
    return { error: true, message: error.message };
  }
}

// Main function to run all tests
async function runTests() {
  console.log('Starting OData tests for API Mocker');
  
  // Test 1: Basic collection request
  const allPets = await makeRequest(`pet/findByStatus`, { status: 'available' });
  printResult('All Available Pets', allPets);
  
  // Test 2: $select - Only get specific fields
  const selectedFields = await makeRequest(`pet/findByStatus`, { 
    status: 'available',
    $select: 'id,name,status' 
  });
  printResult('Selected Fields (id, name, status)', selectedFields);
  
  // Test 3: $filter - Filter by property
  const filteredPets = await makeRequest(`pet/findByStatus`, { 
    status: 'available',
    $filter: "category/name eq 'Cats'" 
  });
  printResult('Filtered Pets (Cats only)', filteredPets);
  
  // Test 4: $orderby - Sort results
  const orderedPets = await makeRequest(`pet/findByStatus`, { 
    status: 'available',
    $orderby: 'name desc' 
  });
  printResult('Ordered Pets (name descending)', orderedPets);
  
  // Test 5: $top and $skip - Pagination
  const paginatedPets = await makeRequest(`pet/findByStatus`, { 
    status: 'available',
    $top: 1,
    $skip: 1 
  });
  printResult('Paginated Pets (skip 1, take 1)', paginatedPets);
  
  // Test 6: $count - Get total count
  const countedPets = await makeRequest(`pet/findByStatus`, { 
    status: 'available',
    $count: 'true' 
  });
  printResult('Pets with Count', countedPets);
  
  // Test 7: Combined query options
  const combinedQuery = await makeRequest(`pet/findByStatus`, { 
    status: 'available',
    $select: 'id,name,category',
    $filter: "name eq 'Fluffy'",
    $count: 'true' 
  });
  printResult('Combined Query', combinedQuery);
  
  console.log('\nOData tests completed');
}

// Run the tests
runTests().catch(error => {
  console.error('Error running tests:', error);
});
