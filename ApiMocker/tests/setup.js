// Global test setup for Jest

// Add global test utilities and mocks here
beforeAll(() => {
  console.log('Starting API Mocker tests...');
});

afterAll(() => {
  console.log('All tests completed');
});

// Set longer timeout for API calls
jest.setTimeout(10000);
