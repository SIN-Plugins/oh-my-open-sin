#!/usr/bin/env node

import { program } from 'commander';
import { loadConfig, saveConfig, validateConfig, getDefaultConfig, SinConfig, ConfigValidationError } from '../utils/config-loader.js';
import fs from 'fs/promises';
import path from 'path';

program
  .name('sin-config')
  .description('CLI for managing OH My Open SIN configuration')
  .version('1.0.0');

program
  .command('show')
  .description('Show current merged configuration')
  .option('-l, --layer <layer>', 'Show specific layer (global|project|default)', 'merged')
  .option('-j, --json', 'Output as JSON')
  .action(async (options) => {
    try {
      if (options.layer === 'default') {
        const config = getDefaultConfig();
        if (options.json) {
          console.log(JSON.stringify(config, null, 2));
        } else {
          console.log('Default Configuration:');
          console.log(JSON.stringify(config, null, 2));
        }
      } else if (options.layer === 'global') {
        const globalPath = path.join(process.env.HOME || '', '.config', 'oh-my-open-sin', 'config.json');
        try {
          const raw = await fs.readFile(globalPath, 'utf-8');
          const config = JSON.parse(raw);
          if (options.json) {
            console.log(JSON.stringify(config, null, 2));
          } else {
            console.log('Global Configuration:');
            console.log(JSON.stringify(config, null, 2));
          }
        } catch {
          console.log('No global configuration found');
        }
      } else if (options.layer === 'project') {
        const projectPath = path.join(process.cwd(), '.opencode', 'oh-my-open-sin.json');
        try {
          const raw = await fs.readFile(projectPath, 'utf-8');
          const config = JSON.parse(raw);
          if (options.json) {
            console.log(JSON.stringify(config, null, 2));
          } else {
            console.log('Project Configuration:');
            console.log(JSON.stringify(config, null, 2));
          }
        } catch {
          console.log('No project configuration found');
        }
      } else {
        const config = await loadConfig();
        if (options.json) {
          console.log(JSON.stringify(config, null, 2));
        } else {
          console.log('Merged Configuration (session > project > global > default):');
          console.log(JSON.stringify(config, null, 2));
        }
      }
    } catch (error) {
      if (error instanceof ConfigValidationError) {
        console.error('Configuration validation failed:');
        error.errors.forEach(err => console.error(`  - ${err.path}: ${err.message}`));
        process.exit(1);
      }
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate configuration against schema')
  .argument('[file]', 'Configuration file to validate (default: project config)')
  .action(async (file) => {
    try {
      let configPath = file;
      if (!configPath) {
        configPath = path.join(process.cwd(), '.opencode', 'oh-my-open-sin.json');
      }
      
      const raw = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(raw);
      
      await validateConfig(config);
      console.log(`✓ Configuration is valid: ${configPath}`);
    } catch (error) {
      if (error instanceof ConfigValidationError) {
        console.error('✗ Configuration validation failed:');
        error.errors.forEach(err => console.error(`  - ${err.path}: ${err.message}`));
        process.exit(1);
      } else if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.error(`✗ File not found: ${file || 'project config'}`);
        process.exit(1);
      } else {
        console.error('Error:', error);
        process.exit(1);
      }
    }
  });

program
  .command('init')
  .description('Initialize a new project configuration file')
  .option('-f, --force', 'Overwrite existing configuration')
  .action(async (options) => {
    try {
      const configPath = path.join(process.cwd(), '.opencode', 'oh-my-open-sin.json');
      
      try {
        await fs.access(configPath);
        if (!options.force) {
          console.log('Configuration already exists. Use --force to overwrite.');
          return;
        }
      } catch {
        // File doesn't exist, which is fine
      }
      
      const config = getDefaultConfig();
      await saveConfig(config, 'project');
      console.log(`✓ Initialized project configuration: ${configPath}`);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('migrate')
  .description('Migrate old configuration format to new format')
  .argument('<old-file>', 'Old configuration file')
  .option('-o, --output <file>', 'Output file (default: project config)')
  .action(async (oldFile, options) => {
    try {
      const raw = await fs.readFile(oldFile, 'utf-8');
      const oldConfig = JSON.parse(raw);
      
      // Detect old format and migrate
      const newConfig: Partial<SinConfig> = {
        version: oldConfig.version || '1.0.0'
      };
      
      // Migrate agents
      if (oldConfig.agents) {
        newConfig.agents = oldConfig.agents;
      }
      
      // Migrate flat structure to nested
      const global: any = {};
      const project: any = {};
      
      if (oldConfig.budget) {
        global.budget = oldConfig.budget;
      }
      if (oldConfig.telemetry) {
        global.telemetry = oldConfig.telemetry;
      }
      if (oldConfig.healing) {
        global.healing = oldConfig.healing;
      }
      if (oldConfig.verification) {
        project.verification = oldConfig.verification;
      }
      
      if (Object.keys(global).length > 0) {
        newConfig.global = global;
      }
      if (Object.keys(project).length > 0) {
        newConfig.project = project;
      }
      
      const outputPath = options.output || path.join(process.cwd(), '.opencode', 'oh-my-open-sin.json');
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, JSON.stringify(newConfig, null, 2), 'utf-8');
      
      console.log(`✓ Migrated configuration to: ${outputPath}`);
      console.log('  Please review and validate the migrated configuration.');
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program.parse();
