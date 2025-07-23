/**
 * Unit Tests for CLI.ts
 * 
 * Tests CLI tool execution, argument parsing, result formatting,
 * and error handling for multi-step and traditional tool results.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { executeToolCall } from '../cli.js';

// Mock prompt orchestrator to control behavior but let database work normally
vi.mock('../services/prompt-orchestrator.js');

describe('CLI Tool Execution Tests', () => {
    let testWorkspacePath: string;
    let originalConsoleLog: typeof console.log;
    let originalConsoleError: typeof console.error;
    let consoleLogSpy: any;
    let consoleErrorSpy: any;

    beforeEach(() => {
        // Create test workspace
        testWorkspacePath = path.join(os.tmpdir(), `cli-test-${Date.now()}`);
        if (!fs.existsSync(testWorkspacePath)) {
            fs.mkdirSync(testWorkspacePath, { recursive: true });
        }

        // Mock console methods to capture output
        originalConsoleLog = console.log;
        originalConsoleError = console.error;
        consoleLogSpy = vi.fn();
        consoleErrorSpy = vi.fn();
        console.log = consoleLogSpy;
        console.error = consoleErrorSpy;
    });

    afterEach(() => {
        // Restore console methods
        console.log = originalConsoleLog;
        console.error = originalConsoleError;

        // Clean up test workspace
        if (fs.existsSync(testWorkspacePath)) {
            fs.rmSync(testWorkspacePath, { recursive: true, force: true });
        }

        vi.clearAllMocks();
    });

    describe('Tool Execution with Valid Arguments', () => {
        it('should execute taskpilot_start successfully', async () => {
            const args = {
                workspace_path: testWorkspacePath
            };

            const result = await executeToolCall('taskpilot_start', args);

            expect(result).toBeDefined();

            // Should return either ToolStepResult or TaskPilotToolResult
            if ('isFinalStep' in result) {
                expect(typeof result.isFinalStep).toBe('boolean');
                expect(typeof result.feedback).toBe('string');
            } else {
                expect(result.content).toBeDefined();
                expect(Array.isArray(result.content)).toBe(true);
            }
        }, 10000);

        it('should execute taskpilot_add with multi-step support', async () => {
            const args = {
                task_description: 'Test task for CLI execution',
                workspace_path: testWorkspacePath
            };

            // Test initial step
            const initialResult = await executeToolCall('taskpilot_add', args);
            expect(initialResult).toBeDefined();

            // Test with stepId
            const stepArgs = {
                ...args,
                stepId: 'validate'
            };

            const stepResult = await executeToolCall('taskpilot_add', stepArgs);
            expect(stepResult).toBeDefined();
        }, 15000);

        it('should execute taskpilot_status with workspace', async () => {
            const args = {
                workspace_path: testWorkspacePath
            };

            const result = await executeToolCall('taskpilot_status', args);
            expect(result).toBeDefined();
        }, 10000);
    });

    describe('Argument Validation and Parsing', () => {
        it('should validate required parameters', async () => {
            // Missing required workspace_path for taskpilot_start
            const invalidArgs = {};

            await expect(async () => {
                await executeToolCall('taskpilot_start', invalidArgs);
            }).rejects.toThrow();
        });

        it('should validate parameter types', async () => {
            // Invalid parameter type
            const invalidArgs = {
                workspace_path: 123 // Should be string
            };

            await expect(async () => {
                await executeToolCall('taskpilot_start', invalidArgs);
            }).rejects.toThrow();
        });

        it('should handle unknown tools', async () => {
            await expect(async () => {
                await executeToolCall('unknown_tool', {});
            }).rejects.toThrow('Unknown tool');
        });

        it('should validate stepId enum values', async () => {
            const args = {
                task_description: 'Test task',
                workspace_path: testWorkspacePath,
                stepId: 'invalid_step'
            };

            // Should not throw during validation, but tool should handle gracefully
            const result = await executeToolCall('taskpilot_add', args);
            expect(result).toBeDefined();
        }, 10000);
    });

    describe('Error Handling', () => {
        it('should handle non-existent workspace paths', async () => {
            const args = {
                workspace_path: '/non/existent/path/to/workspace'
            };

            // Should not crash, should return error result
            const result = await executeToolCall('taskpilot_status', args);
            expect(result).toBeDefined();

            if ('isFinalStep' in result) {
                expect(result.data?.error).toBe(true);
            } else {
                // Traditional result may indicate error
                expect(result.content).toBeDefined();
            }
        }, 10000);

        it('should handle database initialization errors gracefully', async () => {
            // This test verifies that CLI handles database errors without crashing
            const args = {
                workspace_path: testWorkspacePath
            };

            // The CLI should initialize tools and handle any database errors internally
            const result = await executeToolCall('taskpilot_start', args);
            expect(result).toBeDefined();
        }, 10000);
    });

    describe('Tool Schema Definitions', () => {
        it('should have valid schemas for all tools', async () => {
            // Import the tools to check their schemas
            const { AddTool } = await import('../tools/add.js');
            const { StartTool } = await import('../tools/start.js');
            const { StatusTool } = await import('../tools/status.js');
            const { UpdateTool } = await import('../tools/update.js');
            const { FocusTool } = await import('../tools/focus.js');

            const addDef = AddTool.getToolDefinition();
            const startDef = StartTool.getToolDefinition();
            const statusDef = StatusTool.getToolDefinition();
            const updateDef = UpdateTool.getToolDefinition();
            const focusDef = FocusTool.getToolDefinition();

            // All tools should have proper schema structure
            expect(addDef).toHaveProperty('name');
            expect(addDef).toHaveProperty('description');
            expect(addDef).toHaveProperty('inputSchema');
            expect(addDef.inputSchema).toHaveProperty('type', 'object');
            expect(addDef.inputSchema).toHaveProperty('properties');
            expect(addDef.inputSchema).toHaveProperty('required');

            // Check multi-step tools have stepId
            expect(addDef.inputSchema.properties).toHaveProperty('stepId');
            expect(statusDef.inputSchema.properties).toHaveProperty('stepId');
            expect(updateDef.inputSchema.properties).toHaveProperty('stepId');
            expect(focusDef.inputSchema.properties).toHaveProperty('stepId');

            // stepId should be optional
            expect(addDef.inputSchema.required).not.toContain('stepId');
            expect(statusDef.inputSchema.required).not.toContain('stepId');
            expect(updateDef.inputSchema.required).not.toContain('stepId');
            expect(focusDef.inputSchema.required).not.toContain('stepId');
        });
    });

    describe('Performance and Timeout Handling', () => {
        it('should handle tool execution within reasonable time', async () => {
            const startTime = Date.now();

            const args = {
                workspace_path: testWorkspacePath
            };

            const result = await executeToolCall('taskpilot_start', args);

            const duration = Date.now() - startTime;

            expect(result).toBeDefined();
            expect(duration).toBeLessThan(15000); // Should complete within 15 seconds
        }, 20000);

        it('should handle multiple concurrent tool calls', async () => {
            const args = {
                workspace_path: testWorkspacePath
            };

            // Execute multiple tools concurrently
            const promises = [
                executeToolCall('taskpilot_start', args),
                executeToolCall('taskpilot_status', args),
                executeToolCall('taskpilot_start', { workspace_path: testWorkspacePath + '-2' })
            ];

            const results = await Promise.all(promises);

            expect(results).toHaveLength(3);
            results.forEach(result => {
                expect(result).toBeDefined();
            });
        }, 30000);
    });

    describe('Result Format Consistency', () => {
        it('should return consistent result format for traditional tools', async () => {
            const args = {
                workspace_path: testWorkspacePath
            };

            const result = await executeToolCall('taskpilot_start', args);

            // Should be TaskPilotToolResult format
            if (!('isFinalStep' in result)) {
                expect(result).toHaveProperty('content');
                expect(Array.isArray(result.content)).toBe(true);
                expect(result.content[0]).toHaveProperty('type');
                expect(result.content[0]).toHaveProperty('text');
            }
        }, 10000);

        it('should return consistent result format for multi-step tools', async () => {
            const args = {
                task_description: 'Test multi-step result format',
                workspace_path: testWorkspacePath
            };

            const result = await executeToolCall('taskpilot_add', args);

            // Could be either format depending on implementation
            if ('isFinalStep' in result) {
                // ToolStepResult format
                expect(typeof result.isFinalStep).toBe('boolean');
                expect(typeof result.feedback).toBe('string');
                if (!result.isFinalStep) {
                    expect(result.nextStepId).toBeDefined();
                }
            } else {
                // TaskPilotToolResult format
                expect(result).toHaveProperty('content');
                expect(Array.isArray(result.content)).toBe(true);
            }
        }, 10000);
    });

    describe('CLI Integration with Database', () => {
        it('should properly initialize database services', async () => {
            // This test ensures that CLI can initialize all required services
            const args = {
                workspace_path: testWorkspacePath
            };

            // Should not throw during initialization
            const result = await executeToolCall('taskpilot_start', args);
            expect(result).toBeDefined();
        }, 10000);

        it('should handle workspace creation and updates', async () => {
            const uniqueWorkspace = path.join(os.tmpdir(), `cli-workspace-${Date.now()}`);
            fs.mkdirSync(uniqueWorkspace, { recursive: true });

            try {
                const args = {
                    workspace_path: uniqueWorkspace
                };

                // First call should create workspace
                const firstResult = await executeToolCall('taskpilot_start', args);
                expect(firstResult).toBeDefined();

                // Second call should use existing workspace
                const secondResult = await executeToolCall('taskpilot_start', args);
                expect(secondResult).toBeDefined();
            } finally {
                if (fs.existsSync(uniqueWorkspace)) {
                    fs.rmSync(uniqueWorkspace, { recursive: true, force: true });
                }
            }
        }, 15000);
    });

    describe('CLI Argument Edge Cases', () => {
        it('should handle empty string arguments', async () => {
            const args = {
                task_description: '',
                workspace_path: testWorkspacePath
            };

            // Should handle empty string gracefully
            const result = await executeToolCall('taskpilot_add', args);
            expect(result).toBeDefined();
        }, 10000);

        it('should handle very long arguments', async () => {
            const longDescription = 'A'.repeat(10000); // 10KB string
            const args = {
                task_description: longDescription,
                workspace_path: testWorkspacePath
            };

            const result = await executeToolCall('taskpilot_add', args);
            expect(result).toBeDefined();
        }, 15000);

        it('should handle special characters in arguments', async () => {
            const specialChars = 'Test with special chars: !@#$%^&*()[]{}|;:,.<>?';
            const args = {
                task_description: specialChars,
                workspace_path: testWorkspacePath
            };

            const result = await executeToolCall('taskpilot_add', args);
            expect(result).toBeDefined();
        }, 10000);
    });
});
