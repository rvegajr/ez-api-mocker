#!/bin/bash
# Example script for recording and serving APIs with API Mocker

# Create a configuration file for multiple APIs
cat > api-config.json << EOL
{
  "apis": [
    {
      "name": "pilot-api",
      "url": "http://localhost:5000",
      "auth": "Bearer YOUR_TOKEN_HERE"
    },
    {
      "name": "petstore",
      "url": "https://petstore.swagger.io/v2",
      "timeout": 15000
    }
  ]
}
EOL

echo "✅ Created API configuration file at api-config.json"
echo "⚠️  Before recording, make sure to replace YOUR_TOKEN_HERE with a valid token if needed"

echo ""
echo "🚀 Example commands:"
echo "-------------------"

echo "📝 To record a single API:"
echo "  npm run record -- --url https://petstore.swagger.io/v2 --name petstore"
echo ""

echo "📝 To record multiple APIs using the configuration file:"
echo "  npm run record -- --config api-config.json"
echo ""

echo "🌐 To start the mock server (default port 3000):"
echo "  npm run serve"
echo ""

echo "🌐 To start the mock server on a specific port:"
echo "  npm run serve -- --port 8080"
echo ""

echo "💡 Quick start: Record the Swagger Petstore API and serve it"
echo "  1. Run: npm run record -- --url https://petstore.swagger.io/v2 --name petstore"
echo "  2. Then: npm run serve"
echo "  3. Visit: http://localhost:3000 to see the dashboard"
echo ""
