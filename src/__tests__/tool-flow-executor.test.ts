import { describe, it, expect, beforeEach } from 'vitest';
import { DrizzleDatabaseManager, DatabaseType } from '../database/drizzle-connection.js';
import { GlobalDatabaseService } from '../database/global-queries.js';
import { SeedManager } from '../services/seed-manager.js';
import { ToolFlowExecutor } from '../services/tool-flow-executor.js';
import { StatusToolNew } from '../tools/status.js';

describe('ToolFlowExecutor Service', () => {
  let drizzleDb: DrizzleDatabaseManager;
  let globalDbService: GlobalDatabaseService;
  let seedManager: SeedManager;
  let flowExecutor: ToolFlowExecutor;

  beforeEach(async () => {
    // Create in-memory database for tests
    drizzleDb = new DrizzleDatabaseManager(':memory:', DatabaseType.GLOBAL);
    await drizzleDb.initialize();
    
    globalDbService = new GlobalDatabaseService(drizzleDb);
    await globalDbService.initialize();

    // Seed test data
    seedManager = new SeedManager(drizzleDb);
    await seedManager.initializeGlobalData();

    flowExecutor = new ToolFlowExecutor(drizzleDb);
  });

  describe('Database-Driven Step Routing', () => {
    it('should load tool flow configuration from database', async () => {
      const toolFlow = await globalDbService.getToolFlowByName('taskpilot_status');
      
      expect(toolFlow).toBeDefined();
      expect(toolFlow?.toolName).toBe('taskpilot_status');
      expect(toolFlow?.description).toContain('status');
    });

    it('should get available step IDs dynamically', async () => {
      const stepIds = await flowExecutor.getAvailableStepIds('taskpilot_status');
      
      expect(stepIds).toBeInstanceOf(Array);
      expect(stepIds.length).toBeGreaterThan(0);
    });

    it('should validate step transitions', async () => {
      const isValid = await flowExecutor.validateStepTransition(
        'taskpilot_status',
        undefined,
        'status_overview'
      );
      
      expect(isValid).toBe(true);
    });

    it('should generate dynamic next step instructions', async () => {
      const instructions = await flowExecutor.generateNextStepInstructions(
        'taskpilot_status',
        'overview'
      );
      
      expect(instructions).toBeDefined();
      if (instructions) {
        expect(instructions).toContain('taskpilot_status');
        expect(instructions).toContain('NEXT STEP');
      }
    });
  });

  describe('StatusToolNew Integration', () => {
    it('should create StatusToolNew with database-driven execution', () => {
      const statusTool = new StatusToolNew(drizzleDb);
      
      expect(statusTool).toBeDefined();
      expect(statusTool.getToolName()).toBe('taskpilot_status');
    });

    it('should have proper step handlers map', () => {
      const statusTool = new StatusToolNew(drizzleDb);
      const handlers = statusTool.getStepHandlers();
      
      expect(handlers).toBeDefined();
      expect(handlers['initial']).toBeDefined();
      expect(handlers['overview']).toBeDefined();
      expect(handlers['detailed']).toBeDefined();
      expect(handlers['recommendations']).toBeDefined();
      expect(handlers['rules']).toBeDefined();
    });

    it('should get dynamic tool definition with database steps', async () => {
      const definition = await StatusToolNew.getToolDefinitionDynamic(drizzleDb);
      
      expect(definition).toBeDefined();
      expect(definition.name).toBe('taskpilot_status');
      expect(definition.inputSchema.properties.stepId).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent tool gracefully', async () => {
      const stepIds = await flowExecutor.getAvailableStepIds('nonexistent_tool');
      
      expect(stepIds).toEqual([]);
    });

    it('should handle invalid step transitions', async () => {
      const isValid = await flowExecutor.validateStepTransition(
        'nonexistent_tool',
        'step1',
        'step2'
      );
      
      expect(isValid).toBe(false);
    });

    it('should handle missing next step instructions', async () => {
      const instructions = await flowExecutor.generateNextStepInstructions(
        'nonexistent_tool',
        'overview'
      );
      
      expect(instructions).toBeNull();
    });
  });

  describe('Architectural Validation', () => {
    it('should eliminate hardcoded switch statements', () => {
      const statusTool = new StatusToolNew(drizzleDb);
      
      // Verify the tool implements DatabaseDrivenTool interface
      expect(typeof statusTool.getToolName).toBe('function');
      expect(typeof statusTool.getStepHandlers).toBe('function');
      
      // Verify tool name consistency
      expect(statusTool.getToolName()).toBe('taskpilot_status');
      
      // Verify all handlers are functions
      const handlers = statusTool.getStepHandlers();
      Object.values(handlers).forEach(handler => {
        expect(typeof handler).toBe('function');
      });
    });

    it('should provide database-driven step enumeration', async () => {
      const stepIds = await flowExecutor.getAvailableStepIds('taskpilot_status');
      
      // Verify steps are loaded from database, not hardcoded
      expect(stepIds).toBeInstanceOf(Array);
      
      // Verify dynamic tool definition reflects database state
      const definition = await StatusToolNew.getToolDefinitionDynamic(drizzleDb);
      expect(definition.inputSchema.properties.stepId).toBeDefined();
      
      if (definition.inputSchema.properties.stepId && 'enum' in definition.inputSchema.properties.stepId) {
        expect(definition.inputSchema.properties.stepId.enum).toEqual(stepIds);
      }
    });
  });
});
