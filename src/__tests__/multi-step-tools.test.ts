/**
 * Unit Tests for Multi-Step Tool Flows
 * 
 * Tests the enhanced MCP tools that support stepId parameter for multi-step workflows.
 * Uses CLI's executeToolCall function to test integration properly.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Import CLI execution function 
import { AddTool } from '../tools/add.js';
import { CreateTaskTool } from '../tools/create-task.js';
import { StatusTool } from '../tools/status.js';
import { UpdateTool } from '../tools/update.js';
import { FocusTool } from '../tools/focus.js';

// Import types
import { ToolStepResult, MultiStepToolInput } from '../types/index.js';

describe('Multi-Step Tool Flows Integration Tests', () => {
    const TEST_WORKSPACE_PATH = path.join(os.tmpdir(), 'taskpilot-test-workspace');

    beforeEach(async () => {
        // Create test workspace directory
        if (!fs.existsSync(TEST_WORKSPACE_PATH)) {
            fs.mkdirSync(TEST_WORKSPACE_PATH, { recursive: true });
        }
    });

    afterEach(async () => {
        // Clean up test workspace
        if (fs.existsSync(TEST_WORKSPACE_PATH)) {
            fs.rmSync(TEST_WORKSPACE_PATH, { recursive: true, force: true });
        }
    });

    describe('CLI Integration with Multi-Step Tools', () => {
        it('should properly execute add tool multi-step flow via CLI', async () => {
            // Import the CLI execute function
            const { executeToolCall } = await import('../cli.js');

            // Test initial step (no stepId)
            const initialArgs = {
                task_description: 'Test task description for CLI integration',
                workspace_path: TEST_WORKSPACE_PATH
            };

            const initialResult = await executeToolCall('taskpilot_add', initialArgs);

            // Result should contain step information
            expect(initialResult).toBeDefined();

            // The CLI should handle both ToolStepResult and TaskPilotToolResult formats
            if ('isFinalStep' in initialResult) {
                // ToolStepResult format
                expect(initialResult.isFinalStep).toBe(false);
                expect(initialResult.nextStepId).toBe('validate');
                expect(initialResult.feedback).toContain('analysis');
            } else {
                // TaskPilotToolResult format (converted)
                expect(initialResult.content).toBeDefined();
                expect(Array.isArray(initialResult.content)).toBe(true);
                expect(initialResult.content[0]).toHaveProperty('type', 'text');
            }

            // Test validate step
            const validateArgs = {
                ...initialArgs,
                stepId: 'validate'
            };

            const validateResult = await executeToolCall('taskpilot_add', validateArgs);
            expect(validateResult).toBeDefined();

            // Test create step
            const createArgs = {
                ...initialArgs,
                stepId: 'create'
            };

            const createResult = await executeToolCall('taskpilot_add', createArgs);
            expect(createResult).toBeDefined();
        }, 30000); // Extended timeout for CLI operations

        it('should handle status tool multi-step flow', async () => {
            const { executeToolCall } = await import('../cli.js');

            const statusArgs = {
                workspace_path: TEST_WORKSPACE_PATH
            };

            // Test overview step
            const overviewResult = await executeToolCall('taskpilot_status', statusArgs);
            expect(overviewResult).toBeDefined();

            // Test detailed step
            const detailedArgs = {
                ...statusArgs,
                stepId: 'detailed'
            };

            const detailedResult = await executeToolCall('taskpilot_status', detailedArgs);
            expect(detailedResult).toBeDefined();

            // Test recommendations step
            const recommendationsArgs = {
                ...statusArgs,
                stepId: 'recommendations'
            };

            const recommendationsResult = await executeToolCall('taskpilot_status', recommendationsArgs);
            expect(recommendationsResult).toBeDefined();

            // Test rules step (final)
            const rulesArgs = {
                ...statusArgs,
                stepId: 'rules'
            };

            const rulesResult = await executeToolCall('taskpilot_status', rulesArgs);
            expect(rulesResult).toBeDefined();
        }, 30000);

        it('should handle invalid stepId gracefully', async () => {
            const { executeToolCall } = await import('../cli.js');

            const invalidArgs = {
                task_description: 'Test task description',
                workspace_path: TEST_WORKSPACE_PATH,
                stepId: 'invalid_step_id'
            };

            // Should not throw error, should handle gracefully
            const result = await executeToolCall('taskpilot_add', invalidArgs);
            expect(result).toBeDefined();

            // Should default to initial behavior or return error
            if ('isFinalStep' in result) {
                // Multi-step result
                expect(typeof result.isFinalStep).toBe('boolean');
            } else {
                // Traditional result
                expect(result.content).toBeDefined();
            }
        }, 15000);
    });

    describe('Tool Definition Schema Validation', () => {
        it('should have valid tool definitions with stepId support', () => {
            const addToolDef = AddTool.getToolDefinition();
            const createTaskToolDef = CreateTaskTool.getToolDefinition();
            const statusToolDef = StatusTool.getToolDefinition();
            const updateToolDef = UpdateTool.getToolDefinition();
            const focusToolDef = FocusTool.getToolDefinition();

            // Check that all enhanced tools have stepId in their schema
            expect(addToolDef.inputSchema.properties).toHaveProperty('stepId');
            expect(createTaskToolDef.inputSchema.properties).toHaveProperty('stepId');
            expect(statusToolDef.inputSchema.properties).toHaveProperty('stepId');
            expect(updateToolDef.inputSchema.properties).toHaveProperty('stepId');
            expect(focusToolDef.inputSchema.properties).toHaveProperty('stepId');

            // Check that stepId is optional (not in required array)
            expect(addToolDef.inputSchema.required).not.toContain('stepId');
            expect(createTaskToolDef.inputSchema.required).not.toContain('stepId');
            expect(statusToolDef.inputSchema.required).not.toContain('stepId');
            expect(updateToolDef.inputSchema.required).not.toContain('stepId');
            expect(focusToolDef.inputSchema.required).not.toContain('stepId');

            // Check that stepId has enum values
            expect(addToolDef.inputSchema.properties.stepId).toHaveProperty('enum');
            expect(createTaskToolDef.inputSchema.properties.stepId).toHaveProperty('enum');
            expect(statusToolDef.inputSchema.properties.stepId).toHaveProperty('enum');
            expect(updateToolDef.inputSchema.properties.stepId).toHaveProperty('enum');
            expect(focusToolDef.inputSchema.properties.stepId).toHaveProperty('enum');
        });

        it('should have correct step enums for each tool', () => {
            const addToolDef = AddTool.getToolDefinition();
            const createTaskToolDef = CreateTaskTool.getToolDefinition();
            const statusToolDef = StatusTool.getToolDefinition();
            const updateToolDef = UpdateTool.getToolDefinition();
            const focusToolDef = FocusTool.getToolDefinition();

            expect(addToolDef.inputSchema.properties.stepId.enum).toEqual(['validate', 'create']);
            expect(createTaskToolDef.inputSchema.properties.stepId.enum).toEqual(['confirm']);
            expect(statusToolDef.inputSchema.properties.stepId.enum).toEqual(['detailed', 'recommendations', 'rules']);
            expect(updateToolDef.inputSchema.properties.stepId.enum).toEqual(['validate', 'confirm']);
            expect(focusToolDef.inputSchema.properties.stepId.enum).toEqual(['analyze', 'plan', 'implement']);
        });

        it('should have all required fields in schemas', () => {
            const addToolDef = AddTool.getToolDefinition();
            const statusToolDef = StatusTool.getToolDefinition();

            // Add tool should require task_description and workspace_path
            expect(addToolDef.inputSchema.required).toContain('task_description');
            expect(addToolDef.inputSchema.required).toContain('workspace_path');

            // Status tool should require workspace_path
            expect(statusToolDef.inputSchema.required).toContain('workspace_path');
        });
    });

    describe('Error Handling', () => {
        it('should handle non-existent workspace gracefully', async () => {
            const { executeToolCall } = await import('../cli.js');

            const invalidWorkspaceArgs = {
                workspace_path: '/non/existent/workspace/path',
                task_description: 'Test task'
            };

            // Should not crash, should return error result
            const result = await executeToolCall('taskpilot_add', invalidWorkspaceArgs);
            expect(result).toBeDefined();

            if ('isFinalStep' in result) {
                expect(result.data?.error).toBe(true);
            } else {
                expect(result.isError).toBe(true);
            }
        }, 10000);

        it('should validate required parameters', async () => {
            const { executeToolCall } = await import('../cli.js');

            // Test missing required parameter
            const incompleteArgs = {
                workspace_path: TEST_WORKSPACE_PATH
                // Missing task_description for add tool
            };

            // Should throw validation error or return error result
            await expect(async () => {
                await executeToolCall('taskpilot_add', incompleteArgs);
            }).rejects.toThrow();
        }, 5000);
    });

    describe('Multi-Step Navigation Logic', () => {
        it('should provide correct next step information', async () => {
            const { executeToolCall } = await import('../cli.js');

            const args = {
                task_description: 'Test multi-step navigation',
                workspace_path: TEST_WORKSPACE_PATH
            };

            // Initial call should suggest validate step (without workspace init)
            const result = await executeToolCall('taskpilot_add', args);

            if ('isFinalStep' in result) {
                expect(result.isFinalStep).toBe(false);
                expect(result.nextStepId).toBe('validate');
            } else {
                // Check for step information in converted format, or error about workspace
                expect(result.content?.[0]?.text).toMatch(/validate|workspace/);
            }
        }, 15000);

        it('should complete workflow at final step', async () => {
            const { executeToolCall } = await import('../cli.js');

            const args = {
                task_description: 'Test workflow completion',
                workspace_path: TEST_WORKSPACE_PATH,
                stepId: 'create' // Final step for add tool
            };

            const result = await executeToolCall('taskpilot_add', args);

            if ('isFinalStep' in result) {
                expect(result.isFinalStep).toBe(true);
                expect(result.nextStepId).toBeUndefined();
            } else {
                // For converted results, final step may indicate completion or error
                expect(result.content).toBeDefined();
            }
        }, 15000);
    });
});
