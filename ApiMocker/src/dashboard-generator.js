/**
 * Dashboard Generator Module
 * 
 * Handles generating the HTML dashboard for the API Mocker application
 * Implements section 7.3 of the TDD Implementation Checklist
 */

const fs = require('fs');
const path = require('path');
const util = require('util');
const apiRegistry = require('./api-registry');

// Promisify filesystem operations
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const mkdir = util.promisify(fs.mkdir);

/**
 * Generates the HTML dashboard
 * 
 * @param {string} dataDir - Path to the data directory
 * @returns {Promise<string>} - HTML content
 */
async function generateDashboard(dataDir) {
  try {
    // Load API configurations
    const apis = await apiRegistry.loadApiConfigurations(dataDir);
    
    // Create API registry
    const registry = apiRegistry.createRegistry(apis);
    
    // Generate API table
    const apiTable = generateApiTable(apis);
    
    // Generate documentation links
    const docLinks = generateDocLinks(apis);
    
    // Generate usage statistics
    const usageStats = await generateUsageStats(dataDir);
    
    // Generate HTML
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Mocker Dashboard</title>
  <link rel="stylesheet" href="/css/dashboard.css">
</head>
<body>
  <header>
    <h1>API Mocker Dashboard</h1>
    <div class="summary">
      <p>Total APIs: ${registry.count}</p>
      <p>Active APIs: ${registry.activeCount}</p>
      <p>Last Updated: ${new Date(registry.lastUpdated).toLocaleString()}</p>
    </div>
  </header>
  
  <main>
    <section class="api-list">
      <h2>API List</h2>
      ${apiTable}
    </section>
    
    <section class="documentation">
      <h2>API Documentation</h2>
      ${docLinks}
    </section>
    
    <section class="statistics">
      ${usageStats}
    </section>
  </main>
  
  <footer>
    <p>API Mocker &copy; ${new Date().getFullYear()}</p>
  </footer>
  
  <script src="/js/dashboard.js"></script>
</body>
</html>
    `;
    
    return html;
  } catch (error) {
    console.error(`Error generating dashboard: ${error.message}`);
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Mocker Dashboard - Error</title>
</head>
<body>
  <h1>Error Generating Dashboard</h1>
  <p>${error.message}</p>
</body>
</html>
    `;
  }
}

/**
 * Generates the API table HTML
 * 
 * @param {Array} apis - Array of API configurations
 * @returns {string} - HTML table
 */
function generateApiTable(apis) {
  if (!apis || !Array.isArray(apis) || apis.length === 0) {
    return '<p>No APIs found.</p>';
  }
  
  const tableRows = apis.map(api => {
    const statusClass = api.active ? 'active' : 'inactive';
    const statusText = api.active ? 'Active' : 'Inactive';
    
    return `
    <tr class="${statusClass}">
      <td>${api.name}</td>
      <td>${api.type}</td>
      <td>${api.basePath || '/'}</td>
      <td>${statusText}</td>
      <td>
        <a href="${api.basePath || '/'}" class="btn btn-primary">View API</a>
        <a href="${api.basePath || '/'}/docs" class="btn btn-secondary">Docs</a>
      </td>
    </tr>
    `;
  }).join('');
  
  return `
  <table class="api-table">
    <thead>
      <tr>
        <th>Name</th>
        <th>Type</th>
        <th>Base Path</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
  `;
}

/**
 * Generates documentation links
 * 
 * @param {Array} apis - Array of API configurations
 * @returns {string} - HTML list of links
 */
function generateDocLinks(apis) {
  if (!apis || !Array.isArray(apis) || apis.length === 0) {
    return '<p>No documentation available.</p>';
  }
  
  const activeApis = apis.filter(api => api.active);
  
  if (activeApis.length === 0) {
    return '<p>No active APIs found.</p>';
  }
  
  const linkItems = activeApis.map(api => {
    const apiTitle = getApiTitle(api);
    return `
    <li>
      <a href="${api.basePath || '/'}/docs">${apiTitle} Documentation</a>
    </li>
    `;
  }).join('');
  
  return `
  <ul class="doc-links">
    ${linkItems}
  </ul>
  `;
}

/**
 * Gets the API title from its configuration
 * 
 * @param {Object} api - API configuration
 * @returns {string} - API title
 */
function getApiTitle(api) {
  if (api.type === 'REST' && api.swagger) {
    try {
      // Try to get title from swagger file
      const swaggerPath = path.join(api.dirPath, api.swagger);
      if (fs.existsSync(swaggerPath)) {
        const swaggerContent = fs.readFileSync(swaggerPath, 'utf8');
        const swagger = JSON.parse(swaggerContent);
        if (swagger.info && swagger.info.title) {
          return swagger.info.title;
        }
      }
    } catch (error) {
      // Ignore error and use default title
    }
  }
  
  // Default to API name
  return api.name;
}

/**
 * Generates usage statistics HTML
 * 
 * @param {string} dataDir - Path to the data directory
 * @returns {Promise<string>} - HTML content
 */
async function generateUsageStats(dataDir) {
  try {
    const usageStatsPath = path.join(dataDir, 'usage-stats.json');
    
    if (!fs.existsSync(usageStatsPath)) {
      return '<h2>Usage Statistics</h2><p>No usage data available yet.</p>';
    }
    
    const statsData = await readFile(usageStatsPath, 'utf8');
    const stats = JSON.parse(statsData);
    
    const apiStats = Object.entries(stats).map(([apiName, apiStats]) => {
      const endpointStats = Object.entries(apiStats.endpoints || {})
        .map(([endpoint, count]) => `
          <li>${endpoint}: ${count} requests</li>
        `)
        .join('');
      
      return `
      <div class="api-stats">
        <h3>${apiName}</h3>
        <p>Total: ${apiStats.requests || 0} requests</p>
        <h4>Top Endpoints:</h4>
        <ul>
          ${endpointStats || '<li>No endpoint data available</li>'}
        </ul>
      </div>
      `;
    }).join('');
    
    return `
    <h2>Usage Statistics</h2>
    <div class="stats-container">
      ${apiStats || '<p>No usage data available yet.</p>'}
    </div>
    `;
  } catch (error) {
    console.error(`Error generating usage statistics: ${error.message}`);
    return '<h2>Usage Statistics</h2><p>Error loading usage statistics.</p>';
  }
}

/**
 * Writes the dashboard HTML to a file
 * 
 * @param {string} dataDir - Path to the data directory
 * @param {string} outputPath - Path to write the HTML file
 * @returns {Promise<boolean>} - Success status
 */
async function writeDashboard(dataDir, outputPath) {
  try {
    // Create directory if it doesn't exist
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }
    
    // Generate dashboard HTML
    const html = await generateDashboard(dataDir);
    
    // Write HTML to file
    await writeFile(outputPath, html, 'utf8');
    
    return true;
  } catch (error) {
    console.error(`Error writing dashboard: ${error.message}`);
    return false;
  }
}

/**
 * Generates CSS and JS assets for the dashboard
 * 
 * @param {string} publicDir - Path to the public directory
 * @returns {Promise<boolean>} - Success status
 */
async function generateAssets(publicDir) {
  try {
    // Create directories if they don't exist
    const cssDir = path.join(publicDir, 'css');
    const jsDir = path.join(publicDir, 'js');
    
    if (!fs.existsSync(cssDir)) {
      await mkdir(cssDir, { recursive: true });
    }
    
    if (!fs.existsSync(jsDir)) {
      await mkdir(jsDir, { recursive: true });
    }
    
    // CSS content
    const cssContent = `
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  line-height: 1.6;
  color: #333;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

header {
  background-color: #f5f5f5;
  padding: 20px;
  border-radius: 5px;
  margin-bottom: 20px;
}

h1 {
  margin-top: 0;
  color: #2c3e50;
}

.summary {
  display: flex;
  justify-content: space-between;
  max-width: 500px;
}

section {
  margin-bottom: 30px;
}

.api-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
}

.api-table th, .api-table td {
  padding: 12px 15px;
  text-align: left;
  border-bottom: 1px solid #ddd;
}

.api-table th {
  background-color: #f8f9fa;
  font-weight: bold;
}

.api-table tr:hover {
  background-color: #f1f1f1;
}

.active {
  color: #28a745;
}

.inactive {
  color: #dc3545;
}

.btn {
  display: inline-block;
  padding: 6px 12px;
  margin-right: 5px;
  text-decoration: none;
  border-radius: 4px;
  font-size: 14px;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.doc-links {
  list-style-type: none;
  padding-left: 0;
}

.doc-links li {
  margin-bottom: 10px;
}

.doc-links a {
  text-decoration: none;
  color: #007bff;
}

.doc-links a:hover {
  text-decoration: underline;
}

.stats-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.api-stats {
  background-color: #f8f9fa;
  padding: 15px;
  border-radius: 5px;
}

footer {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid #ddd;
  text-align: center;
  color: #6c757d;
}
    `;
    
    // JS content
    const jsContent = `
document.addEventListener('DOMContentLoaded', function() {
  // Add interactivity to the dashboard
  
  // Toggle API details
  const apiRows = document.querySelectorAll('.api-table tbody tr');
  apiRows.forEach(row => {
    row.addEventListener('click', function(e) {
      // Don't toggle if clicking on a button
      if (e.target.tagName === 'A') return;
      
      this.classList.toggle('expanded');
    });
  });
  
  // Refresh button
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function() {
      location.reload();
    });
  }
  
  // Filter APIs
  const filterInput = document.getElementById('filter-apis');
  if (filterInput) {
    filterInput.addEventListener('input', function() {
      const filterValue = this.value.toLowerCase();
      
      apiRows.forEach(row => {
        const apiName = row.querySelector('td:first-child').textContent.toLowerCase();
        const apiType = row.querySelector('td:nth-child(2)').textContent.toLowerCase();
        
        if (apiName.includes(filterValue) || apiType.includes(filterValue)) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    });
  }
});
    `;
    
    // Write files
    await writeFile(path.join(cssDir, 'dashboard.css'), cssContent, 'utf8');
    await writeFile(path.join(jsDir, 'dashboard.js'), jsContent, 'utf8');
    
    return true;
  } catch (error) {
    console.error(`Error generating assets: ${error.message}`);
    return false;
  }
}

module.exports = {
  generateDashboard,
  generateApiTable,
  generateDocLinks,
  generateUsageStats,
  writeDashboard,
  generateAssets,
  getApiTitle // Export for testing
};
