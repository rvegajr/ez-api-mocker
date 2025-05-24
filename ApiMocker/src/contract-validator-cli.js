#!/usr/bin/env node

/**
 * Universal Contract Validator CLI
 * 
 * Command-line interface for validating APIs against their contracts
 */

const { program } = require('commander');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const apiContractTester = require('./api-contract-tester');

// Define the program
program
  .name('api-contract-validator')
  .description('Validate APIs against their contracts')
  .version('1.0.0');

/**
 * Validate command
 */
program
  .command('validate <url>')
  .description('Validate an API against its contract')
  .option('-p, --protocol <type>', 'Specify the API protocol (rest, odata, graphql)')
  .option('-o, --output <format>', 'Output format (console, json)', 'console')
  .option('-f, --file <path>', 'Save results to a file')
  .option('--test-crud', 'Test CRUD operations (may modify data)')
  .option('--timeout <ms>', 'Request timeout in milliseconds', '5000')
  .action(async (url, options) => {
    try {
      console.log(chalk.blue(`🔍 Validating API at ${url}...`));
      
      if (options.protocol) {
        console.log(chalk.gray(`Protocol specified: ${options.protocol}`));
      } else {
        console.log(chalk.gray('Auto-detecting API protocol...'));
      }
      
      // Run validation
      const validationResults = await apiContractTester.validateApiContract(url, {
        protocol: options.protocol,
        testCrud: options.testCrud || false,
        timeout: parseInt(options.timeout, 10)
      });
      
      // Output results
      if (options.output === 'json') {
        outputJson(validationResults, options.file);
      } else {
        outputConsole(validationResults, options.file);
      }
      
      // Set exit code based on validation results
      process.exitCode = validationResults.summary.failed > 0 ? 1 : 0;
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      if (error.stack) {
        console.error(chalk.gray(error.stack));
      }
      process.exitCode = 1;
    }
  });

/**
 * Discover command
 */
program
  .command('discover <url>')
  .description('Discover API capabilities without validation')
  .option('-o, --output <format>', 'Output format (console, json)', 'console')
  .option('-f, --file <path>', 'Save results to a file')
  .action(async (url, options) => {
    try {
      console.log(chalk.blue(`🔍 Discovering API capabilities at ${url}...`));
      
      // Probe API capabilities
      const capabilities = await apiContractTester.probeApiCapabilities(url);
      
      // Output results
      if (options.output === 'json') {
        outputJson(capabilities, options.file);
      } else {
        outputCapabilitiesConsole(capabilities, options.file);
      }
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      if (error.stack) {
        console.error(chalk.gray(error.stack));
      }
      process.exitCode = 1;
    }
  });

/**
 * Output validation results as JSON
 * @param {Object} results - Validation results
 * @param {string} filePath - Optional file path to save results
 */
function outputJson(results, filePath) {
  const json = JSON.stringify(results, null, 2);
  
  console.log(json);
  
  if (filePath) {
    fs.writeFileSync(filePath, json);
    console.log(chalk.green(`Results saved to ${filePath}`));
  }
}

/**
 * Output validation results to console
 * @param {Object} results - Validation results
 * @param {string} filePath - Optional file path to save results
 */
function outputConsole(results, filePath) {
  console.log('\n' + chalk.bold('API Contract Validation Results'));
  console.log('─'.repeat(50));
  console.log(`Protocol: ${chalk.cyan(results.protocol)}`);
  console.log(`Timestamp: ${chalk.gray(results.timestamp)}`);
  console.log(`Endpoints: ${chalk.yellow(results.endpoints.length)}`);
  console.log('─'.repeat(50));
  
  // Output summary
  console.log(chalk.bold('\nSummary:'));
  console.log(`Total Tests: ${chalk.yellow(results.summary.total)}`);
  console.log(`Passed: ${chalk.green(results.summary.passed)}`);
  console.log(`Failed: ${chalk.red(results.summary.failed)}`);
  console.log(`Skipped: ${chalk.gray(results.summary.skipped || 0)}`);
  
  // Calculate compliance score
  const complianceScore = results.summary.total > 0 
    ? Math.round((results.summary.passed / results.summary.total) * 100) 
    : 0;
  
  console.log(`Compliance Score: ${getComplianceColor(complianceScore)}%`);
  
  // Output endpoint details
  console.log(chalk.bold('\nEndpoint Details:'));
  
  for (const endpoint of results.endpoints) {
    console.log('\n' + chalk.cyan(`${endpoint.name} (${endpoint.url})`));
    
    // Output test results for this endpoint
    for (const test of endpoint.tests) {
      const status = test.passed 
        ? chalk.green('✓ PASS') 
        : (test.skipped ? chalk.yellow('⚠ SKIP') : chalk.red('✗ FAIL'));
      
      console.log(`  ${status} ${test.name}`);
      
      if (!test.passed && test.error) {
        console.log(`    ${chalk.red(test.error)}`);
      }
      
      if (test.skipped && test.message) {
        console.log(`    ${chalk.yellow(test.message)}`);
      }
    }
    
    // Output endpoint summary
    const endpointScore = endpoint.summary.total > 0 
      ? Math.round((endpoint.summary.passed / endpoint.summary.total) * 100) 
      : 0;
    
    console.log(`  Score: ${getComplianceColor(endpointScore)}%`);
  }
  
  // Output error if any
  if (results.error) {
    console.log(chalk.bold('\nErrors:'));
    console.log(chalk.red(results.error.message));
    if (results.error.stack) {
      console.log(chalk.gray(results.error.stack));
    }
  }
  
  // Save to file if requested
  if (filePath) {
    const output = [
      'API Contract Validation Results',
      '─'.repeat(50),
      `Protocol: ${results.protocol}`,
      `Timestamp: ${results.timestamp}`,
      `Endpoints: ${results.endpoints.length}`,
      '─'.repeat(50),
      '',
      'Summary:',
      `Total Tests: ${results.summary.total}`,
      `Passed: ${results.summary.passed}`,
      `Failed: ${results.summary.failed}`,
      `Skipped: ${results.summary.skipped || 0}`,
      `Compliance Score: ${complianceScore}%`,
      '',
      'Endpoint Details:'
    ];
    
    for (const endpoint of results.endpoints) {
      output.push('');
      output.push(`${endpoint.name} (${endpoint.url})`);
      
      for (const test of endpoint.tests) {
        const status = test.passed 
          ? '✓ PASS' 
          : (test.skipped ? '⚠ SKIP' : '✗ FAIL');
        
        output.push(`  ${status} ${test.name}`);
        
        if (!test.passed && test.error) {
          output.push(`    ${test.error}`);
        }
        
        if (test.skipped && test.message) {
          output.push(`    ${test.message}`);
        }
      }
      
      const endpointScore = endpoint.summary.total > 0 
        ? Math.round((endpoint.summary.passed / endpoint.summary.total) * 100) 
        : 0;
      
      output.push(`  Score: ${endpointScore}%`);
    }
    
    if (results.error) {
      output.push('');
      output.push('Errors:');
      output.push(results.error.message);
      if (results.error.stack) {
        output.push(results.error.stack);
      }
    }
    
    fs.writeFileSync(filePath, output.join('\n'));
    console.log(chalk.green(`\nResults saved to ${filePath}`));
  }
}

/**
 * Output API capabilities to console
 * @param {Object} capabilities - API capabilities
 * @param {string} filePath - Optional file path to save results
 */
function outputCapabilitiesConsole(capabilities, filePath) {
  console.log('\n' + chalk.bold('API Capabilities'));
  console.log('─'.repeat(50));
  console.log(`Protocol: ${chalk.cyan(capabilities.protocol)}`);
  console.log(`Endpoints: ${chalk.yellow(capabilities.endpoints.length)}`);
  console.log(`Supports OData: ${formatBoolean(capabilities.supportsOData)}`);
  console.log(`Supports Swagger: ${formatBoolean(capabilities.supportsSwagger)}`);
  console.log(`Supports GraphQL: ${formatBoolean(capabilities.supportsGraphQL)}`);
  console.log(`Supports CRUD: ${formatBoolean(capabilities.supportsCrud)}`);
  console.log('─'.repeat(50));
  
  // Output endpoint details
  console.log(chalk.bold('\nEndpoint Details:'));
  
  for (const endpoint of capabilities.endpoints) {
    console.log(`\n${chalk.cyan(endpoint.name)} (${endpoint.url})`);
    console.log(`  Type: ${endpoint.type}`);
    console.log(`  Methods: ${endpoint.methods.join(', ')}`);
    
    if (endpoint.fields && endpoint.fields.length > 0) {
      console.log(`  Fields: ${endpoint.fields.slice(0, 5).join(', ')}${endpoint.fields.length > 5 ? '...' : ''}`);
    }
  }
  
  // Output metadata if available
  if (capabilities.metadata) {
    console.log(chalk.bold('\nMetadata Summary:'));
    
    if (capabilities.protocol === apiContractTester.PROTOCOL_TYPES.ODATA) {
      console.log(`  Entity Types: ${capabilities.metadata.entityTypes?.length || 0}`);
      console.log(`  Entity Sets: ${capabilities.metadata.entitySets?.length || 0}`);
      console.log(`  Functions: ${capabilities.metadata.functions?.length || 0}`);
      console.log(`  Actions: ${capabilities.metadata.actions?.length || 0}`);
    } else if (capabilities.protocol === apiContractTester.PROTOCOL_TYPES.GRAPHQL) {
      console.log(`  Types: ${capabilities.metadata.types?.length || 0}`);
      console.log(`  Query Type: ${capabilities.metadata.queryType || 'None'}`);
      console.log(`  Mutation Type: ${capabilities.metadata.mutationType || 'None'}`);
    } else {
      console.log(`  Paths: ${capabilities.metadata.paths?.length || 0}`);
      console.log(`  Schemas: ${capabilities.metadata.schemas?.length || 0}`);
    }
  }
  
  // Output error if any
  if (capabilities.error) {
    console.log(chalk.bold('\nErrors:'));
    console.log(chalk.red(capabilities.error.message));
    if (capabilities.error.stack) {
      console.log(chalk.gray(capabilities.error.stack));
    }
  }
  
  // Save to file if requested
  if (filePath) {
    const json = JSON.stringify(capabilities, null, 2);
    fs.writeFileSync(filePath, json);
    console.log(chalk.green(`\nCapabilities saved to ${filePath}`));
  }
}

/**
 * Format a boolean value for display
 * @param {boolean} value - The boolean value
 * @returns {string} Formatted string
 */
function formatBoolean(value) {
  return value ? chalk.green('Yes') : chalk.red('No');
}

/**
 * Get color for compliance score
 * @param {number} score - Compliance score
 * @returns {string} Colored score
 */
function getComplianceColor(score) {
  if (score >= 90) {
    return chalk.green(score);
  } else if (score >= 70) {
    return chalk.yellow(score);
  } else {
    return chalk.red(score);
  }
}

// Parse command line arguments
program.parse(process.argv);

// If no command is provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
