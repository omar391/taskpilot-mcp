import { z } from 'zod';
import { SeedManager } from '../services/seed-manager.js';
import type { DrizzleDatabaseManager } from '../database/drizzle-connection.js';

/**
 * Dynamic Schema Generator
 * 
 * Generates tool schemas with dynamic stepId enums based on database tool flow steps.
 * Implements lazy loading to handle async database queries during schema generation.
 */

export class DynamicSchemaGenerator<T extends z.ZodRawShape = z.ZodRawShape> {
  private schemaCache = new Map<string, z.ZodObject<T>>();
  private seedManager: SeedManager;

  constructor(private dbManager: DrizzleDatabaseManager) {
    this.seedManager = new SeedManager(dbManager);
  }

  /**
   * Generate tool schema with dynamic stepId enum from database
   */
  async generateToolSchema(
    toolName: string,
    additionalProperties: Partial<T> = {},
    requiredFields: string[] = ['workspace_path']
  ): Promise<z.ZodObject<T>> {
    // Check cache first
    const cacheKey = `${toolName}-${JSON.stringify(additionalProperties)}-${requiredFields.join(',')}`;
    if (this.schemaCache.has(cacheKey)) {
      return this.schemaCache.get(cacheKey)!;
    }

    // Get available step IDs from database
    const stepIds = await this.getToolStepIds(toolName);
    
    // Create dynamic stepId enum based on database steps
    let stepIdSchema: z.ZodOptional<z.ZodEnum<any>> | z.ZodOptional<z.ZodString>;
    
    if (stepIds.length > 0) {
      // Dynamic enum based on database steps
      stepIdSchema = z.enum(stepIds as [string, ...string[]]).optional();
    } else {
      // Fallback to generic string if no steps found
      stepIdSchema = z.string().optional();
    }

    // Build complete schema
    const baseSchema = {
      stepId: stepIdSchema.describe(`Optional step ID for multi-step workflow. Available steps: ${stepIds.join(', ')}`),
      workspace_path: z.string().describe('Absolute path to the workspace directory'),
      ...(additionalProperties as T)
    } as const;

    // Create final schema
    const schema = z.object(baseSchema) as z.ZodObject<T>;
    
    // Cache for future use
    this.schemaCache.set(cacheKey, schema);
    
    return schema;
  }

  /**
   * Get available step IDs for a tool from database
   */
  private async getToolStepIds(toolName: string): Promise<string[]> {
    try {
      // Get tool flow from database
      const toolFlow = await this.seedManager.getGlobalToolFlow(toolName);
      if (!toolFlow) {
        return [];
      }

      // Query tool flow steps to get stepIds
      const db = this.dbManager.getDb();
      const { toolFlowSteps } = await import('../database/schema/global-schema.js');
      const { eq } = await import('drizzle-orm');

      const steps = await db
        .select()
        .from(toolFlowSteps)
        .where(eq(toolFlowSteps.toolFlowId, toolFlow.id));

      // Extract unique step IDs from metadata
      const stepIds = new Set<string>();
      
      for (const step of steps) {
        if (step.metadata && typeof step.metadata === 'object') {
          const metadata = step.metadata as any;
          if (metadata.stepId) {
            stepIds.add(metadata.stepId);
          }
        }
      }

      return Array.from(stepIds).sort();
    } catch (error) {
      console.warn(`Failed to load step IDs for tool ${toolName}:`, error);
      return [];
    }
  }

  /**
   * Clear schema cache (useful for testing or when database changes)
   */
  clearCache(): void {
    this.schemaCache.clear();
  }

  /**
   * Get cached schema if available
   */
  getCachedSchema(toolName: string, additionalProperties: Partial<T> = {}, requiredFields: string[] = ['workspace_path']): z.ZodObject<T> | null {
    const cacheKey = `${toolName}-${JSON.stringify(additionalProperties)}-${requiredFields.join(',')}`;
    return this.schemaCache.get(cacheKey) || null;
  }
}
