const fs = require('fs');
const path = require('path');

describe('Project Structure', () => {
  test('required directories exist', () => {
    const requiredDirs = ['src', 'tests', 'data', 'config'];
    
    requiredDirs.forEach(dir => {
      const dirPath = path.join(__dirname, '..', dir);
      expect(fs.existsSync(dirPath)).toBe(true);
    });
  });
  
  test('package.json exists with correct configuration', () => {
    const packagePath = path.join(__dirname, '..', 'package.json');
    expect(fs.existsSync(packagePath)).toBe(true);
    
    const packageJson = require(packagePath);
    expect(packageJson.name).toBe('api-mocker');
    expect(packageJson.scripts.record).toBeDefined();
    expect(packageJson.scripts.serve).toBeDefined();
  });
});
