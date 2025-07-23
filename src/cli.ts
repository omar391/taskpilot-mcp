#!/usr/bin/env node

import { initializeGlobalDatabaseService } from './database/global-queries.js';
import { DatabaseService } from './services/database-service.js';
import { SeedManager } from './services/seed-manager.js';
import { PromptOrchestrator } from './services/prompt-orchestrator.js';

// Tools
import { InitTool, initToolSchema } from './tools/init.js';
import { StartTool, startToolSchema } from './tools/start.js';
import { AddTool, addToolSchema } from './tools/add.js';
import { CreateTaskTool, createTaskToolSchema } from './tools/create-task.js';
import { StatusTool, statusToolSchema } from './tools/status.js';
import { UpdateTool, updateToolSchema } from './tools/update.js';
import { AuditTool, auditToolSchema } from './tools/audit.js';
import { FocusTool, focusToolSchema } from './tools/focus.js';
import { GitHubTool, githubToolSchema } from './tools/github.js';
import { RuleUpdateTool, ruleUpdateToolSchema } from './tools/rule-update.js';
import { RemoteInterfaceTool, remoteInterfaceToolSchema } from './tools/remote-interface.js';

/**
 * CLI tool for testing MCP tool calls programmatically
 * Usage: npm run test:tool -- <toolName> <arguments>
 * Example: npm run test:tool -- taskpilot_start '{"workspace_path": "/tmp/test-workspace"}'
 */

// Global variables
let toolsInitialized = false;
let globalDbService: any = null;
let globalDrizzleManager: any = null;

async function initializeTools(): Promise<{
    tools: Record<string, any>;
    schemas: Record<string, any>;
}> {
    if (toolsInitialized && globalDrizzleManager) {
        // Return cached tools
        const tools = {
            taskpilot_init: new InitTool(globalDrizzleManager),
            taskpilot_start: new StartTool(globalDrizzleManager),
            taskpilot_add: new AddTool(globalDrizzleManager),
            taskpilot_create_task: new CreateTaskTool(globalDrizzleManager),
            taskpilot_status: new StatusTool(globalDrizzleManager),
            taskpilot_update: new UpdateTool(globalDrizzleManager),
            taskpilot_audit: new AuditTool(globalDrizzleManager),
            taskpilot_focus: new FocusTool(globalDrizzleManager),
            taskpilot_github: new GitHubTool(globalDrizzleManager),
            taskpilot_rule_update: new RuleUpdateTool(globalDrizzleManager),
            taskpilot_remote_interface: new RemoteInterfaceTool(globalDrizzleManager),
        };

        const schemas = {
            taskpilot_init: initToolSchema,
            taskpilot_start: startToolSchema,
            taskpilot_add: addToolSchema,
            taskpilot_create_task: createTaskToolSchema,
            taskpilot_status: statusToolSchema,
            taskpilot_update: updateToolSchema,
            taskpilot_audit: auditToolSchema,
            taskpilot_focus: focusToolSchema,
            taskpilot_github: githubToolSchema,
            taskpilot_rule_update: ruleUpdateToolSchema,
            taskpilot_remote_interface: remoteInterfaceToolSchema,
        };

        return { tools, schemas };
    }

    try {
        // Check if we're in a test environment
        const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

        if (isTest) {
            // Create in-memory database for tests
            const { DrizzleDatabaseManager, DatabaseType } = await import('./database/drizzle-connection.js');
            const inMemoryDb = new DrizzleDatabaseManager(':memory:', DatabaseType.GLOBAL);
            await inMemoryDb.initialize();

            const { GlobalDatabaseService } = await import('./database/global-queries.js');
            globalDbService = new GlobalDatabaseService(inMemoryDb);
            await globalDbService.initialize();
        } else {
            // Production environment
            globalDbService = (await import('./database/global-queries.js')).getGlobalDatabaseService();
            await globalDbService.initialize();
        }
    } catch (error) {
        console.error('Error initializing database:', error);
        console.error('Error stack:', (error as Error).stack);
        globalDbService = null;
    }

    if (!globalDbService) {
        throw new Error('Failed to initialize global database service');
    }

    try {
        globalDrizzleManager = globalDbService.getDrizzleManager();

        // Mark tools as initialized
        toolsInitialized = true;

        // Create tool instances
        const tools = {
            taskpilot_init: new InitTool(globalDrizzleManager),
            taskpilot_start: new StartTool(globalDrizzleManager),
            taskpilot_add: new AddTool(globalDrizzleManager),
            taskpilot_create_task: new CreateTaskTool(globalDrizzleManager),
            taskpilot_status: new StatusTool(globalDrizzleManager),
            taskpilot_update: new UpdateTool(globalDrizzleManager),
            taskpilot_audit: new AuditTool(globalDrizzleManager),
            taskpilot_focus: new FocusTool(globalDrizzleManager),
            taskpilot_github: new GitHubTool(globalDrizzleManager),
            taskpilot_rule_update: new RuleUpdateTool(globalDrizzleManager),
            taskpilot_remote_interface: new RemoteInterfaceTool(globalDrizzleManager),
        };

        const schemas = {
            taskpilot_init: initToolSchema,
            taskpilot_start: startToolSchema,
            taskpilot_add: addToolSchema,
            taskpilot_create_task: createTaskToolSchema,
            taskpilot_status: statusToolSchema,
            taskpilot_update: updateToolSchema,
            taskpilot_audit: auditToolSchema,
            taskpilot_focus: focusToolSchema,
            taskpilot_github: githubToolSchema,
            taskpilot_rule_update: ruleUpdateToolSchema,
            taskpilot_remote_interface: remoteInterfaceToolSchema,
        };

        return { tools, schemas };
    } catch (error) {
        console.error('Error getting drizzle manager:', error);
        throw error;
    }
}

async function executeToolCall(toolName: string, toolArguments: any) {
    // Pre-validate tool name before initializing database
    const validToolNames = [
        'taskpilot_init',
        'taskpilot_start',
        'taskpilot_add',
        'taskpilot_create_task',
        'taskpilot_status',
        'taskpilot_update',
        'taskpilot_audit',
        'taskpilot_focus',
        'taskpilot_github',
        'taskpilot_rule_update',
        'taskpilot_remote_interface'
    ];

    if (!validToolNames.includes(toolName)) {
        throw new Error(`Unknown tool: ${toolName}. Available tools: ${validToolNames.join(', ')}`);
    }

    const { tools, schemas } = await initializeTools();

    if (!(toolName in tools)) {
        throw new Error(`Unknown tool: ${toolName}. Available tools: ${Object.keys(tools).join(', ')}`);
    }

    // Parse and validate arguments
    const schema = schemas[toolName as keyof typeof schemas];
    const validatedArgs = schema.parse(toolArguments);

    // Execute the tool based on name
    switch (toolName) {
        case 'taskpilot_init':
            return await tools.taskpilot_init.execute(validatedArgs as any);
        case 'taskpilot_start':
            return await tools.taskpilot_start.execute(validatedArgs as any);
        case 'taskpilot_add':
            return await tools.taskpilot_add.execute(validatedArgs as any);
        case 'taskpilot_create_task':
            return await tools.taskpilot_create_task.execute(validatedArgs as any);
        case 'taskpilot_status':
            return await tools.taskpilot_status.execute(validatedArgs as any);
        case 'taskpilot_update':
            return await tools.taskpilot_update.execute(validatedArgs as any);
        case 'taskpilot_audit':
            return await tools.taskpilot_audit.execute(validatedArgs as any);
        case 'taskpilot_focus':
            return await tools.taskpilot_focus.execute(validatedArgs as any);
        case 'taskpilot_github':
            return await tools.taskpilot_github.execute(validatedArgs as any);
        case 'taskpilot_rule_update':
            return await tools.taskpilot_rule_update.execute(validatedArgs as any);
        case 'taskpilot_remote_interface':
            return await tools.taskpilot_remote_interface.execute(validatedArgs as any);
        default:
            throw new Error(`Unhandled tool: ${toolName}`);
    }
}

// Export for testing
export { executeToolCall };

async function main() {
    const args = process.argv.slice(2);

    if (args.length < 1) {
        console.error('Usage: npm run test:tool -- <toolName> [arguments]');
        console.error('Example: npm run test:tool -- taskpilot_start \'{"workspace_path": "/tmp/test-workspace"}\'');
        console.error('');
        console.error('Available tools:');
        console.error('  taskpilot_init');
        console.error('  taskpilot_start');
        console.error('  taskpilot_add');
        console.error('  taskpilot_create_task');
        console.error('  taskpilot_status');
        console.error('  taskpilot_update');
        console.error('  taskpilot_audit');
        console.error('  taskpilot_focus');
        console.error('  taskpilot_github');
        console.error('  taskpilot_rule_update');
        console.error('  taskpilot_remote_interface');
        process.exit(1);
    }

    const toolName = args[0];
    const toolArguments = args[1] ? JSON.parse(args[1]) : {};

    try {
        console.log(`🧪 Testing tool: ${toolName}`);
        console.log(`📝 Arguments:`, JSON.stringify(toolArguments, null, 2));
        console.log(`⏳ Executing...`);
        console.log('');

        const startTime = Date.now();

        try {
            // Execute the tool
            const result = await executeToolCall(toolName, toolArguments);
            const endTime = Date.now();

            console.log(`✅ Tool call succeeded (${endTime - startTime}ms)`);
            console.log('');

            // Handle different result types (ToolStepResult vs TaskPilotToolResult)
            if ('isFinalStep' in result) {
                // ToolStepResult (multi-step flow)
                console.log('📋 Multi-step tool result:');
                console.log(result.feedback);

                if (!result.isFinalStep && result.nextStepId) {
                    console.log(`\n🔄 Next step available: ${result.nextStepId}`);
                }

                if (result.data) {
                    console.log('\n📊 Step data:', JSON.stringify(result.data, null, 2));
                }
            } else {
            // TaskPilotToolResult (traditional format)
                if (result.isError) {
                    console.log('⚠️  Tool returned error result:');
                } else {
                    console.log('📋 Tool result:');
                }

                // Pretty print the result content
                if (Array.isArray(result.content)) {
                    for (const item of result.content) {
                        if (item.type === 'text') {
                            console.log(item.text);
                        } else {
                            console.log(`[${item.type}]`, item);
                        }
                    }
                } else {
                    console.log(result);
                }
            }

        } catch (error) {
            const endTime = Date.now();
            console.log(`💥 Tool call failed (${endTime - startTime}ms)`);
            console.error('Error:', error instanceof Error ? error.message : String(error));
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ CLI test failed:', error);
        process.exit(1);
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Only run main when not in test environment
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
    main().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}
