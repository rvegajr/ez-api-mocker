const path = require('path');

// Mock Commander
jest.mock('commander', () => {
  const mockCommand = {
    description: jest.fn().mockReturnThis(),
    option: jest.fn().mockReturnThis(),
    action: jest.fn().mockReturnThis(),
    addHelpText: jest.fn().mockReturnThis(),
    parse: jest.fn(),
    name: jest.fn().mockReturnThis(),
    version: jest.fn().mockReturnThis(),
  };

  return {
    program: {
      ...mockCommand,
      command: jest.fn().mockReturnValue(mockCommand),
    },
  };
});

// Mock fs module
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue('{}'),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn()
}));

// Get the mocked fs module
const fs = require('fs');

// Mock modules
jest.mock('../src/single-api-server', () => ({
  createAndStartServer: jest.fn().mockResolvedValue({})
}));

jest.mock('../src/multi-api-server', () => ({
  createAndStartServer: jest.fn().mockResolvedValue({})
}));

jest.mock('../src/dashboard-generator', () => ({
  writeDashboard: jest.fn().mockResolvedValue({}),
  generateAssets: jest.fn().mockResolvedValue({})
}));

jest.mock('../src/swagger-fetcher', () => ({
  fetchSwagger: jest.fn().mockResolvedValue({})
}));

jest.mock('../src/api-classifier', () => ({
  classifyApi: jest.fn().mockResolvedValue({
    apiType: 'REST',
    authRequired: false,
    isOData: false
  })
}));

jest.mock('../src/endpoint-extractor', () => ({
  extractEndpoints: jest.fn().mockResolvedValue([])
}));

jest.mock('../src/api-recorder', () => ({
  recordResponses: jest.fn().mockResolvedValue({})
}));

// Mock console.log and console.error to capture output
let consoleOutput = [];
const originalLog = console.log;
const originalError = console.error;

// Mock process.exit to prevent test from exiting
let mockExit;

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  consoleOutput = [];
  console.log = jest.fn((...args) => {
    consoleOutput.push(args.join(' '));
  });
  console.error = jest.fn((...args) => {
    consoleOutput.push(args.join(' '));
  });
  
  // Mock process.exit for all tests
  mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
});

// Restore console and process.exit after tests
afterEach(() => {
  console.log = originalLog;
  console.error = originalError;
  mockExit.mockRestore();
});

describe('CLI Module', () => {
  let cli;
  let singleApiServer;
  let multiApiServer;
  let dashboardGenerator;
  let swaggerFetcher;
  let apiClassifier;
  let endpointExtractor;
  let apiRecorder;
  
  beforeEach(() => {
    jest.resetModules();
    cli = require('../src/cli');
    singleApiServer = require('../src/single-api-server');
    multiApiServer = require('../src/multi-api-server');
    dashboardGenerator = require('../src/dashboard-generator');
    swaggerFetcher = require('../src/swagger-fetcher');
    apiClassifier = require('../src/api-classifier');
    endpointExtractor = require('../src/endpoint-extractor');
    apiRecorder = require('../src/api-recorder');
  });
  
  test('should configure CLI program with correct commands', () => {
    const { program } = require('commander');
    expect(program.command).toHaveBeenCalledWith('record');
    expect(program.command).toHaveBeenCalledWith('serve');
  });
  
  test('should handle record command with required options', async () => {
    // Get the action callback for record command
    const recordAction = require('commander').program.command().action.mock.calls[0][0];
    
    // Call the action with options
    await recordAction({
      url: 'http://api.example.com',
      name: 'test-api',
      auth: null,
      timeout: '10000',
      output: './data',
      force: false
    });
    
    // Verify expected behavior
    expect(consoleOutput.some(output => output.includes('Recording API'))).toBe(true);
    expect(swaggerFetcher.fetchSwagger).toHaveBeenCalledWith(
      'http://api.example.com', 
      'test-api', 
      expect.objectContaining({
        authToken: null,
        output: expect.any(String)
      })
    );
  });
  
  test('should handle serve command in multi-API mode', async () => {
    // Get the action callback for serve command
    const serveAction = require('commander').program.command().action.mock.calls[1][0];
    
    // Call the action with options for multi-API mode
    await serveAction({
      port: '3000',
      host: 'localhost',
      data: './data',
      stateful: false,
      api: null,
      basePath: null,
      multi: true
    });
    
    // Verify expected behavior
    expect(consoleOutput.some(output => output.includes('Starting mock server'))).toBe(true);
    expect(consoleOutput.some(output => output.includes('Multi-API mode'))).toBe(true);
    expect(multiApiServer.createAndStartServer).toHaveBeenCalledWith(
      expect.objectContaining({
        dataDir: './data',
        port: '3000',
        host: 'localhost',
        stateful: false
      })
    );
  });
  
  test('should handle serve command in single API mode', async () => {
    // Get the action callback for serve command
    const serveAction = require('commander').program.command().action.mock.calls[1][0];
    
    // Call the action with options for single API mode
    await serveAction({
      port: '3000',
      host: 'localhost',
      data: './data',
      stateful: false,
      api: 'test-api',
      basePath: null,
      multi: true
    });
    
    // Verify expected behavior
    expect(consoleOutput.some(output => output.includes('Starting mock server'))).toBe(true);
    expect(consoleOutput.some(output => output.includes('Single API mode'))).toBe(true);
    expect(consoleOutput.some(output => output.includes("Serving only 'test-api'"))).toBe(true);
    expect(singleApiServer.createAndStartServer).toHaveBeenCalledWith(
      expect.objectContaining({
        dataDir: './data',
        apiName: 'test-api',
        port: '3000',
        host: 'localhost'
      })
    );
  });
  
  test('should handle serve command with custom base path in single API mode', async () => {
    // Get the action callback for serve command
    const serveAction = require('commander').program.command().action.mock.calls[1][0];
    
    // Call the action with options for single API mode with custom base path
    await serveAction({
      port: '3000',
      host: 'localhost',
      data: './data',
      stateful: false,
      api: 'test-api',
      basePath: '/custom',
      multi: true
    });
    
    // Verify expected behavior
    expect(consoleOutput.some(output => output.includes('Starting mock server'))).toBe(true);
    expect(consoleOutput.some(output => output.includes('Single API mode'))).toBe(true);
    expect(consoleOutput.some(output => output.includes('Using custom base path: /custom'))).toBe(true);
    expect(singleApiServer.createAndStartServer).toHaveBeenCalledWith(
      expect.objectContaining({
        dataDir: './data',
        apiName: 'test-api',
        port: '3000',
        host: 'localhost',
        basePath: '/custom'
      })
    );
  });
  
  test('should validate required options for record command', async () => {
    // Get the action callback for record command
    const recordAction = require('commander').program.command().action.mock.calls[0][0];
    
    // Call the action without required options
    await recordAction({
      url: null,
      name: null,
      auth: null,
      timeout: '10000',
      output: './data',
      force: false
    });
    
    // Verify expected behavior
    expect(consoleOutput.some(output => output.includes('required option'))).toBe(true);
    expect(mockExit).toHaveBeenCalledWith(1);
  });
  
  test('should handle auth token option for record command', async () => {
    // Get the action callback for record command
    const recordAction = require('commander').program.command().action.mock.calls[0][0];
    
    // Call the action with auth token
    await recordAction({
      url: 'http://api.example.com',
      name: 'test-api',
      auth: 'Bearer token123',
      timeout: '10000',
      output: './data',
      force: false
    });
    
    // Verify expected behavior
    expect(consoleOutput.some(output => output.includes('with authentication'))).toBe(true);
    expect(swaggerFetcher.fetchSwagger).toHaveBeenCalledWith(
      'http://api.example.com', 
      'test-api', 
      expect.objectContaining({
        authToken: 'Bearer token123'
      })
    );
  });
  
  test('should handle configuration file option', async () => {
    // Get the action callback for record command
    const recordAction = require('commander').program.command().action.mock.calls[0][0];
    
    // Mock process.exit to prevent test from exiting
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    
    // Create a spy for console.log to verify output
    const logSpy = jest.spyOn(console, 'log');
    
    // Call the action with config file
    await recordAction({
      config: 'config.json',
      output: './data',
      force: false,
      timeout: '10000'
    });
    
    // Verify expected behavior
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Using configuration from config.json'));
    
    // Restore mocks
    logSpy.mockRestore();
    mockExit.mockRestore();
  });
  
  test('should handle stateful mode option', async () => {
    // Get the action callback for serve command
    const serveAction = require('commander').program.command().action.mock.calls[1][0];
    
    // Call the action with stateful mode
    await serveAction({
      port: '3000',
      host: 'localhost',
      data: './data',
      stateful: true,
      api: null,
      basePath: null,
      multi: true
    });
    
    // Verify expected behavior
    expect(consoleOutput.some(output => output.includes('Stateful mode enabled'))).toBe(true);
    expect(multiApiServer.createAndStartServer).toHaveBeenCalledWith(
      expect.objectContaining({
        stateful: true
      })
    );
  });
  
  test('should handle custom data directory option', async () => {
    // Get the action callback for serve command
    const serveAction = require('commander').program.command().action.mock.calls[1][0];
    
    // Call the action with custom data directory
    await serveAction({
      port: '3000',
      host: 'localhost',
      data: './custom-data',
      stateful: false,
      api: null,
      basePath: null,
      multi: true
    });
    
    // Verify expected behavior
    expect(consoleOutput.some(output => output.includes('Using data directory: ./custom-data'))).toBe(true);
    expect(multiApiServer.createAndStartServer).toHaveBeenCalledWith(
      expect.objectContaining({
        dataDir: './custom-data'
      })
    );
  });
});
