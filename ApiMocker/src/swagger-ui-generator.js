/**
 * Swagger UI Generator Module
 * 
 * Generates Swagger UI HTML for downloaded specifications
 */

const fs = require('fs');
const path = require('path');

// Swagger UI version to use
const SWAGGER_UI_VERSION = '4.18.3';

/**
 * Generates a Swagger UI HTML page for a specification
 * @param {string} specPath - Path to the specification file
 * @param {Object} options - Generation options
 * @returns {Object} Generation result
 */
function generateSwaggerUI(specPath, options = {}) {
  const result = {
    htmlPath: null,
    error: null
  };
  
  try {
    // Determine output path
    const outputDir = options.outputDir || path.dirname(specPath);
    const baseName = path.basename(specPath, path.extname(specPath));
    const htmlPath = path.join(outputDir, `${baseName}.html`);
    
    // Generate HTML content
    const specRelativePath = path.relative(outputDir, specPath).replace(/\\/g, '/');
    const html = generateSwaggerUIHtml(specRelativePath, options);
    
    // Write HTML file
    fs.writeFileSync(htmlPath, html);
    
    result.htmlPath = htmlPath;
    return result;
  } catch (error) {
    result.error = {
      message: error.message,
      stack: error.stack
    };
    return result;
  }
}

/**
 * Generates Swagger UI HTML content
 * @param {string} specPath - Path to the specification file
 * @param {Object} options - Generation options
 * @returns {string} HTML content
 */
function generateSwaggerUIHtml(specPath, options = {}) {
  const title = options.title || 'API Documentation';
  const version = options.swaggerUIVersion || SWAGGER_UI_VERSION;
  const theme = options.theme || 'default';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@${version}/swagger-ui.css">
  <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@${version}/favicon-32x32.png" sizes="32x32" />
  <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@${version}/favicon-16x16.png" sizes="16x16" />
  <style>
    html {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    
    *,
    *:before,
    *:after {
      box-sizing: inherit;
    }
    
    body {
      margin: 0;
      background: #fafafa;
    }
    
    .swagger-ui .topbar {
      background-color: ${theme === 'dark' ? '#1f2937' : '#0078d4'};
    }
    
    ${theme === 'dark' ? `
    body {
      background-color: #111827;
      color: #f3f4f6;
    }
    
    .swagger-ui .info .title,
    .swagger-ui .info .base-url,
    .swagger-ui .info,
    .swagger-ui .opblock-tag,
    .swagger-ui table thead tr th,
    .swagger-ui .parameter__name,
    .swagger-ui .parameter__type,
    .swagger-ui .response-col_status,
    .swagger-ui .response-col_description,
    .swagger-ui .tab li,
    .swagger-ui .opblock .opblock-summary-description,
    .swagger-ui .opblock-description-wrapper p,
    .swagger-ui .responses-inner h4,
    .swagger-ui .responses-inner h5,
    .swagger-ui .model-title,
    .swagger-ui .model {
      color: #f3f4f6;
    }
    
    .swagger-ui .opblock-tag:hover,
    .swagger-ui .opblock .opblock-summary {
      background-color: #1f2937;
    }
    
    .swagger-ui section.models {
      background-color: #1f2937;
    }
    
    .swagger-ui .model-box {
      background-color: #374151;
    }
    ` : ''}
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  
  <script src="https://unpkg.com/swagger-ui-dist@${version}/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@${version}/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      // Begin Swagger UI call region
      const ui = SwaggerUIBundle({
        url: "${specPath}",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout"
      });
      // End Swagger UI call region
      
      window.ui = ui;
    };
  </script>
</body>
</html>`;
}

/**
 * Generates Swagger UI HTML for all specifications in a directory
 * @param {string} specDir - Directory containing specification files
 * @param {Object} options - Generation options
 * @returns {Object} Generation result
 */
function generateSwaggerUIForDirectory(specDir, options = {}) {
  const result = {
    generatedFiles: [],
    indexPath: null,
    error: null
  };
  
  try {
    // Find all JSON and YAML specification files
    const specFiles = fs.readdirSync(specDir)
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return (ext === '.json' || ext === '.yaml' || ext === '.yml') && 
               !file.endsWith('.meta.json');
      })
      .map(file => path.join(specDir, file));
    
    if (specFiles.length === 0) {
      result.error = {
        message: 'No specification files found'
      };
      return result;
    }
    
    // Generate Swagger UI for each specification
    for (const specFile of specFiles) {
      const uiResult = generateSwaggerUI(specFile, options);
      
      if (uiResult.error) {
        console.warn(`Failed to generate Swagger UI for ${specFile}: ${uiResult.error.message}`);
      } else {
        result.generatedFiles.push(uiResult.htmlPath);
      }
    }
    
    // Generate index page if requested
    if (options.generateIndex) {
      const indexPath = path.join(specDir, 'index.html');
      const indexHtml = generateIndexHtml(result.generatedFiles, options);
      
      fs.writeFileSync(indexPath, indexHtml);
      result.indexPath = indexPath;
    }
    
    return result;
  } catch (error) {
    result.error = {
      message: error.message,
      stack: error.stack
    };
    return result;
  }
}

/**
 * Generates an index HTML page for multiple Swagger UI pages
 * @param {Array} htmlFiles - List of HTML file paths
 * @param {Object} options - Generation options
 * @returns {string} HTML content
 */
function generateIndexHtml(htmlFiles, options = {}) {
  const title = options.title || 'API Documentation Index';
  const theme = options.theme || 'default';
  
  // Extract file names and create links
  const links = htmlFiles.map(file => {
    const fileName = path.basename(file);
    const displayName = fileName.replace(/\.html$/, '').replace(/[-_]/g, ' ');
    
    return `<li><a href="${fileName}">${displayName}</a></li>`;
  });
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      ${theme === 'dark' ? 'background-color: #111827; color: #f3f4f6;' : 'background-color: #fafafa; color: #333;'}
    }
    
    h1 {
      ${theme === 'dark' ? 'color: #f3f4f6;' : 'color: #0078d4;'}
      border-bottom: 1px solid ${theme === 'dark' ? '#374151' : '#ddd'};
      padding-bottom: 10px;
    }
    
    ul {
      list-style-type: none;
      padding: 0;
    }
    
    li {
      margin-bottom: 10px;
      padding: 10px;
      border-radius: 4px;
      ${theme === 'dark' ? 'background-color: #1f2937;' : 'background-color: #fff;'}
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    
    a {
      ${theme === 'dark' ? 'color: #60a5fa;' : 'color: #0078d4;'}
      text-decoration: none;
      font-weight: 500;
      display: block;
    }
    
    a:hover {
      ${theme === 'dark' ? 'color: #93c5fd;' : 'color: #106ebe;'}
    }
    
    .footer {
      margin-top: 30px;
      font-size: 0.8em;
      text-align: center;
      ${theme === 'dark' ? 'color: #9ca3af;' : 'color: #666;'}
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>Select an API specification to view its documentation:</p>
  
  <ul>
    ${links.join('\n    ')}
  </ul>
  
  <div class="footer">
    <p>Generated by API Mocker on ${new Date().toLocaleString()}</p>
  </div>
</body>
</html>`;
}

module.exports = {
  generateSwaggerUI,
  generateSwaggerUIForDirectory,
  SWAGGER_UI_VERSION
};
