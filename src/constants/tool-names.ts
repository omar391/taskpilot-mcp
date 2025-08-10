/**
 * Central registry for all TaskPilot tool names
 * 
 * This file serves as the single source of truth for tool name validation
 * and prevents duplication across CLI, MCP server, and other components.
 */

// String enum for all TaskPilot tools
export enum ToolNames {
    INIT = 'taskpilot_init',
    START = 'taskpilot_start',
    ADD = 'taskpilot_add',
    STATUS = 'taskpilot_status',
    UPDATE = 'taskpilot_update',
    AUDIT = 'taskpilot_audit',
    FOCUS = 'taskpilot_focus',
    GITHUB = 'taskpilot_github',
    RULE_UPDATE = 'taskpilot_rule_update',
    REMOTE_INTERFACE = 'taskpilot_remote_interface',
    UPDATE_RESOURCES = 'taskpilot_update_resources',
    UPDATE_STEPS = 'taskpilot_update_steps'
}

// Array of tool names for iteration (derived from enum values)
export const TOOL_NAMES = Object.values(ToolNames);

// Type for tool names - ensures compile-time validation
export type ToolName = ToolNames;

// Utility function for tool name validation
export function isValidToolName(name: string): name is ToolNames {
    return Object.values(ToolNames).includes(name as ToolNames);
}

// Tool name validation with error message
export function validateToolName(name: string): void {
    if (!isValidToolName(name)) {
        throw new Error(`Unknown tool: ${name}. Available tools: ${Object.values(ToolNames).join(', ')}`);
    }
}

// Default export for convenience
export default ToolNames;
