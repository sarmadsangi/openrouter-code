import { BlueprintParser } from '../../src/qa/blueprint-parser';
import * as fs from 'fs';
import * as path from 'path';

describe('BlueprintParser', () => {
  let parser: BlueprintParser;
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    parser = new BlueprintParser(tempDir);
  });

  afterEach(() => {
    // Clean up temp files
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('parseBlueprint', () => {
    it('should parse a basic blueprint with server command', async () => {
      const blueprint = `# Test App
      
## Server Configuration
**Start Command:** \`npm run dev\`
**Port:** 3000
`;
      
      const blueprintPath = path.join(tempDir, 'blueprint.md');
      fs.writeFileSync(blueprintPath, blueprint);

      const config = await parser.parseBlueprint(blueprintPath);

      expect(config.server.command).toBe('npm run dev');
      expect(config.server.port).toBe(3000);
    });

    it('should extract test cases from blueprint', async () => {
      const blueprint = `# Test App

## QA Testing Configuration

### Test Cases
- Verify home page loads correctly
- Test navigation menu functionality
- Validate contact form submission
`;
      
      const blueprintPath = path.join(tempDir, 'blueprint.md');
      fs.writeFileSync(blueprintPath, blueprint);

      const config = await parser.parseBlueprint(blueprintPath);

      expect(config.testCases).toHaveLength(3);
      expect(config.testCases![0]).toBe('Verify home page loads correctly');
      expect(config.testCases![1]).toBe('Test navigation menu functionality');
      expect(config.testCases![2]).toBe('Validate contact form submission');
    });

    it('should handle missing blueprint file', async () => {
      const nonExistentPath = path.join(tempDir, 'nonexistent.md');
      
      await expect(parser.parseBlueprint(nonExistentPath)).rejects.toThrow('Blueprint file not found');
    });

    it('should parse browser configuration', async () => {
      const blueprint = `# Test App

### Browser Configuration
**Browsers:** chromium, firefox
**Viewport:** 1920x1080
`;
      
      const blueprintPath = path.join(tempDir, 'blueprint.md');
      fs.writeFileSync(blueprintPath, blueprint);

      const config = await parser.parseBlueprint(blueprintPath);

      expect(config.browsers).toEqual(['chromium', 'firefox']);
      expect(config.viewport).toEqual({ width: 1920, height: 1080 });
    });

    it('should use default values when configuration is missing', async () => {
      const blueprint = `# Minimal App`;
      
      const blueprintPath = path.join(tempDir, 'blueprint.md');
      fs.writeFileSync(blueprintPath, blueprint);

      const config = await parser.parseBlueprint(blueprintPath);

      expect(config.server.command).toBe('npm start'); // Default fallback
      expect(config.server.port).toBe(3000); // Default port
      expect(config.server.healthCheckPath).toBe('/'); // Default health check
    });

    it('should extract custom prompts', async () => {
      const blueprint = `# Test App

### Custom Prompts
- Test all form validations work correctly
- Verify error handling for network failures
`;
      
      const blueprintPath = path.join(tempDir, 'blueprint.md');
      fs.writeFileSync(blueprintPath, blueprint);

      const config = await parser.parseBlueprint(blueprintPath);

      expect(config.customPrompts).toHaveLength(2);
      expect(config.customPrompts![0]).toBe('Test all form validations work correctly');
      expect(config.customPrompts![1]).toBe('Verify error handling for network failures');
    });
  });
});