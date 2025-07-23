# Current Tasks

## Task ID: 20250723-10  
- **Title**: Backend - Create Common Tool Schema Base Interface
- **Description**: Create abstract base tool interface that all MCP tools extend, with common stepId property and dynamic enum values loaded from database tool flows. Eliminate hardcoded stepId enums in individual tools by making them database-driven.
- **Priority**: High
- **Dependencies**: None
- **Status**: Backlog
- **Progress**: 0
- **Notes**: **Analytical Framework Applied**: Current tools have redundant stepId handling. Tool flows database already contains step sequences - need to bridge database-stored flows with runtime tool schemas. Create `BaseToolInterface` with dynamic `getStepIds()` method that queries database.
- **Connected File List**: src/types/index.ts, src/tools/base-tool.ts (new), src/tools/*.ts

## Task ID: 20250723-11
- **Title**: Backend - Merge Add & Create Task Tools
- **Description**: Since multi-step workflows eliminate need for separate tools, merge `taskpilot_add` and `taskpilot_create_task` into unified `taskpilot_add` tool. Update tool flows database and remove duplicate functionality. Preserve all existing functionality through step management.
- **Priority**: Medium  
- **Dependencies**: 20250723-10
- **Status**: Backlog
- **Progress**: 0
- **Notes**: **Analytical Framework Applied**: Two tools serve same purpose with artificial separation. Multi-step support makes separate tools redundant. Merging reduces cognitive overhead and simplifies tool flows. Need to update global tool flows seed data and remove create-task.ts.
- **Connected File List**: src/tools/add.ts, src/tools/create-task.ts, src/data/embedded-seed-data.ts

## Task ID: 20250723-12
- **Title**: Backend - Database-Driven Step Routing System  
- **Description**: Replace hardcoded switch statements for stepId routing with database-driven step flow execution. Create common `executeToolFlow()` function that loads tool flow steps from database and routes execution dynamically. Eliminate hardcoded step handling logic.
- **Priority**: High
- **Dependencies**: 20250723-10
- **Status**: Backlog
- **Progress**: 0
- **Notes**: **Analytical Framework Applied**: Current switch statements violate DRY principle and couple code to specific step names. Tool flows database contains step sequences - system should execute these dynamically. Create `ToolFlowExecutor` service that handles step routing, validation, and next-step determination from database.
- **Connected File List**: src/services/tool-flow-executor.ts (new), src/tools/*.ts, src/database/global-queries.ts

## Task ID: 20250723-13
- **Title**: Backend - Dynamic Next Step Generation
- **Description**: Replace hardcoded "Call taskpilot_add with stepId='validate'" text with dynamic next step instructions generated from database tool flows. Create template system that builds next step instructions from tool flow data automatically.
- **Priority**: Medium
- **Dependencies**: 20250723-12  
- **Status**: Backlog
- **Progress**: 0
- **Notes**: **Analytical Framework Applied**: Hardcoded next step text creates tight coupling and prevents reusability. Tool flows database contains next_tool relationships - system should generate instructions dynamically. Create `NextStepTemplateGenerator` that builds contextual instructions from database flow data.
- **Connected File List**: src/services/next-step-generator.ts (new), src/services/prompt-orchestrator.ts, src/tools/*.ts

## Task ID: 20250723-14
- **Title**: Backend - Centralize Tool Names Constants
- **Description**: Extract validToolNames array from cli.ts into shared constants file. Create central TOOL_NAMES registry that can be imported by cli.ts, MCP server initialization, and any other files needing tool name validation. Eliminate redundant tool name lists.
- **Priority**: Low
- **Dependencies**: None
- **Status**: Backlog  
- **Progress**: 0
- **Notes**: **Analytical Framework Applied**: Tool names list duplicated across files creates maintenance burden and inconsistency risk. Single source of truth principle requires centralized constants. Create `src/constants/tool-names.ts` with exported array and type definitions.
- **Connected File List**: src/constants/tool-names.ts (new), src/cli.ts, src/server/express-server.ts

## Task ID: 20250723-15
- **Title**: Backend - Dynamic StepId Schema Generation
- **Description**: Make stepId enum values dynamic by loading them from database tool flows at runtime rather than hardcoding in tool definitions. Tool schema generation should query database for available step IDs per tool and build enum dynamically.
- **Priority**: Medium
- **Dependencies**: 20250723-10, 20250723-12
- **Status**: Backlog
- **Progress**: 0  
- **Notes**: **Analytical Framework Applied**: Current hardcoded enums prevent runtime flexibility and require code changes for new steps. Database tool flows contain step definitions - schemas should reflect database state dynamically. Implement lazy loading of schema definitions with database queries.
- **Connected File List**: src/tools/base-tool.ts, src/database/global-queries.ts, src/tools/*.ts

## Task ID: 20250723-16
- **Title**: Testing - Fix Error Handling in Multi-Step Tool Tests
- **Description**: Add proper error checking in multi-step tool tests. Tests currently ignore `isError` property and assume all tool calls succeed. Add assertions for error states, proper type checking, and validation of tool failure scenarios.
- **Priority**: High
- **Dependencies**: None
- **Status**: Done
- **Progress**: 100
- **Notes**: ✅ COMPLETED - Added proper error checking throughout multi-step tool tests. Fixed false confidence issue where tests were passing even when tools returned errors. Added explicit `isError` property validation, proper error message pattern matching, and new test case for error state handling. All 70/70 tests passing with improved reliability.
- **Connected File List**: src/__tests__/multi-step-tools.test.ts

## Task ID: 20250723-17
- **Title**: Backend - Replace Any Types with Proper Static Types
- **Description**: Eliminate `any` types throughout codebase and replace with proper TypeScript interfaces. Focus on CLI executeToolCall function, tool execution methods, and database query results. Improve type safety and compile-time error detection.
- **Priority**: Medium
- **Dependencies**: None
- **Status**: Backlog
- **Progress**: 0
- **Notes**: **Analytical Framework Applied**: Extensive `any` usage defeats TypeScript benefits and hides potential runtime errors. CLI uses `validatedArgs as any` pattern - should define proper union types for tool inputs. Database queries return `any` when they should use schema-derived types.
- **Connected File List**: src/cli.ts, src/tools/*.ts, src/database/global-queries.ts, src/database/workspace-queries.ts

---

## 📊 **PHASE 4: TOOL ABSTRACTION & DATABASE-DRIVEN ARCHITECTURE**

### 🎯 **CURRENT PHASE OBJECTIVES**
**Goal**: Eliminate hardcoded tool patterns and create fully database-driven tool execution system

### ✅ **PHASE 3 COMPLETED (Previous)**
- ✅ Multi-step tool flows with stepId parameter support (69/69 tests passing)
- ✅ Visual workflow builder and UI integration  
- ✅ Perfect test coverage across all components
- ✅ Production-ready architecture with comprehensive documentation

### 🔄 **PHASE 4 IN PROGRESS (8/8 tasks identified)**
1. **Common Tool Schema Base** - Abstract interface for all tools
2. **Tool Consolidation** - Merge redundant add/create-task tools  
3. **Database-Driven Routing** - Replace switch statements with flow execution
4. **Dynamic Instructions** - Generate next step text from database
5. **Centralized Constants** - Single source for tool names
6. **Dynamic Schema Generation** - Runtime stepId enum building
7. **Test Error Handling** - Fix ignored error states in tests
8. **Type Safety Improvements** - Replace any types with proper interfaces

### 📈 **EXPECTED OUTCOMES**
- **Maintainability**: Single tool pattern eliminates code duplication
- **Flexibility**: New tool flows configurable without code changes  
- **Consistency**: Database-driven approach ensures unified behavior
- **Scalability**: System can support unlimited tools and step configurations
