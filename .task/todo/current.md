# Current Tasks - Remote Hosting & UI Integration Phase

## Task TP-025: Implement SSE Transport for Remote MCP Server
- **Title**: Replace STDIO with SSE transport for remote hosting capability
- **Description**: 
  - Replace `StdioServerTransport` with `SSEServerTransport` in main server
  - Add HTTP endpoints for client message posting with session management
  - Update configuration for HTTP server mode vs current STDIO
  - Test MCP inspector over HTTP instead of STDIO
  - Ensure MCP protocol compliance maintained
- **Priority**: High
- **Dependencies**: None
- **Status**: Done
- **Progress**: 100%
- **Notes**: ✅ COMPLETED - SSE transport successfully implemented with:
  - Dual mode support: STDIO (default) and SSE (--sse flag)
  - HTTP server with Express.js for SSE endpoint (/sse) and message posting (/message)
  - Session management with automatic cleanup on connection close
  - Health check endpoint (/health) with connection stats
  - CORS support for browser access
  - Backward compatibility with existing STDIO mode
  - Command line args: --sse --port=3001
  - Scripts: bun run start:sse, bun run inspector:sse
- **Connected File List**: src/index.ts, package.json

## Task TP-026: Implement Dual Database Architecture
- **Title**: Split into Global DB + Workspace-specific databases
- **Description**:
  - Create global database in `~/.taskpilot/global.db` for workspace registry and global configs
  - Move workspace-specific data to `{workspace}/.taskpilot/task.db` per workspace
  - Update DatabaseManager to handle both global and workspace connections
  - Migrate current single-DB schema to dual-database pattern
  - Update all services to query appropriate database based on data scope
- **Priority**: High  
- **Dependencies**: None
- **Status**: Done
- **Progress**: 100%
- **Notes**: ✅ COMPLETED - Dual database architecture successfully implemented with:
  - Global DB: ~/.taskpilot/global.db for workspaces, sessions, global tool flows, feedback steps, MCP mappings
  - Workspace DB: {workspace}/.taskpilot/task.db for tasks, GitHub configs, remote interfaces (on-demand initialization)
  - Schema filtering system with @global-only/@workspace-only annotations  
  - DatabaseService providing unified access to both databases
  - Resource endpoints working correctly for global data queries
  - Backward compatibility maintained for existing tools
- **Connected File List**: src/database/connection.ts, src/database/schema.sql, src/services/database-service.ts, src/index.ts

## Task TP-027: Add Drizzle ORM Integration
- **Title**: Replace manual SQL with Drizzle ORM for type safety and migrations
- **Description**:
  - Install and configure Drizzle ORM with SQLite adapter
  - Convert schema.sql to Drizzle schema definitions in TypeScript
  - Replace all manual SQL queries with Drizzle query builder
  - Implement automatic migrations for development environment
  - Ensure schema embedded in code for distribution (no external SQL files)
- **Priority**: Medium
- **Dependencies**: TP-026
- **Status**: Backlog
- **Progress**: 0%
- **Notes**: Eliminates manual SQL errors and improves type safety
- **Connected File List**: src/database/*, package.json

## Task TP-028: Design Minimal UI Integration API
- **Title**: Identify minimal REST endpoints needed for UI functionality
- **Description**:
  - Analyze UI pages (home, tool-flows, feedback-steps, tasks) for exact data needs
  - Design minimal REST API endpoints avoiding endpoint bloat (target: 6 core endpoints)
  - Plan SSE events for real-time task progress updates and workspace status changes
  - Document API schema with OpenAPI specification
  - Consider efficient data fetching and caching patterns
  - Include UI audit step to add endpoints on-demand if needed during integration
- **Priority**: High
- **Dependencies**: TP-026
- **Status**: Backlog
- **Progress**: 0%
- **Notes**: Start with minimal endpoint set, audit UI during integration to add any missing endpoints on-demand
- **Connected File List**: ui/src/pages/*.tsx, API documentation

## Task TP-029: Implement HTTP Server with REST + SSE
- **Title**: Add HTTP server alongside MCP server for UI communication
- **Description**:
  - Add Express.js server for REST API endpoints (UI→Server commands)
  - Implement SSE for real-time workspace/task updates (Server→UI streaming)
  - Create middleware for CORS, error handling, request validation
  - Ensure HTTP server operates independently of MCP server
  - Add health check and service discovery endpoints
  - Implement workspace lifecycle: Active (recent interaction) → Idle (5min) → Inactive (5min more)
- **Priority**: High
- **Dependencies**: TP-025, TP-028
- **Status**: Backlog
- **Progress**: 0%
- **Notes**: Confirmed SSE+REST hybrid pattern with refined workspace lifecycle timing
- **Connected File List**: src/index.ts, src/api/*.ts, src/http-server.ts

## Task TP-030: Fix Start/Init Tool Flow Context
- **Title**: Update start/init tools to return workspace rules as feedback step
- **Description**:
  - Modify global-tool-flows-db-seed.json to add feedback steps for start/init tools
  - Create "workspace_context" composite feedback step containing standard + workspace rules + analytical framework
  - Update start/init tool implementations to return comprehensive workspace context via variable substitution
  - Test that LLM receives proper rule context immediately on workspace initialization
  - Verify analytical framework rules are properly communicated using Option A (composite feedback step)
- **Priority**: High
- **Dependencies**: None
- **Status**: Done
- **Progress**: 100%
- **Notes**: ✅ COMPLETED - Composite feedback step successfully provides comprehensive workspace context with global rules, analytical framework, and workspace-specific rules to LLM on start/init
- **Connected File List**: src/data/global-tool-flows-db-seed.json, src/data/global-feedback-steps-db-seed.json, src/tools/start.ts, src/tools/init.ts, src/database/schema.sql, src/database/connection.ts

## Task TP-031: Implement Global Workspace Registry
- **Title**: Create workspace discovery and management system
- **Description**:
  - Design global database schema for workspace registry and metadata
  - Implement automatic workspace scanning and registration service
  - Create workspace lifecycle management (active/inactive/error status)
  - Add workspace metadata storage (name, path, last activity, task counts)
  - Enable UI to discover and display workspaces without requiring MCP tool calls
- **Priority**: High
- **Dependencies**: TP-026
- **Status**: Backlog
- **Progress**: 0%
- **Notes**: Enables UI workspace discovery independent of LLM sessions
- **Connected File List**: src/services/workspace-registry.ts, src/database/global-schema.sql

## Task TP-032: Update UI with Real API Integration
- **Title**: Replace mock data with actual API calls and real-time updates
- **Description**:
  - Replace all mock data in UI pages with real API client implementation
  - Implement robust API client with error handling and retry logic
  - Add proper loading states and error boundaries throughout UI
  - Implement real-time updates via SSE for task progress and workspace status
  - Test complete UI functionality with real backend data
  - Conduct UI audit during integration to identify any missing endpoints and add on-demand
- **Priority**: Medium
- **Dependencies**: TP-029, TP-031
- **Status**: Backlog
- **Progress**: 0%
- **Notes**: Final integration step with UI audit to catch any missing API requirements
- **Connected File List**: ui/src/pages/*.tsx, ui/src/lib/api-client.ts

## Task TP-033: Distribution and Deployment Optimization
- **Title**: Optimize for simple distribution without external files
- **Description**:
  - Embed all database schemas in TypeScript code (no external SQL files)
  - Bundle all required assets into single distribution package
  - Create simple deployment scripts for both local and remote hosting
  - Test distribution package in clean environment without dev dependencies
  - Document complete deployment and configuration process
- **Priority**: Low
- **Dependencies**: TP-027
- **Status**: Backlog
- **Progress**: 0%
- **Notes**: Ensure clean distribution following design goal of simple TS code only
- **Connected File List**: package.json, build scripts, deployment documentation

## Task TP-034: Document Phase 3 Architecture Decisions
- **Title**: Document confirmed architectural decisions for remote hosting phase
- **Description**:
  - Document composite feedback step approach (Option A) for multiple rule contexts
  - Document workspace lifecycle: Active → Idle (5min) → Inactive (5min) timing
  - Document SSE+REST hybrid communication pattern
  - Document database locations: ~/.taskpilot/global.db and {workspace}/.taskpilot/task.db
  - Document SSE event types for real-time updates
  - Document minimal API endpoint strategy with on-demand addition during UI audit
  - Update architecture.md with Phase 3 remote hosting patterns
- **Priority**: Low
- **Dependencies**: None
- **Status**: Backlog
- **Progress**: 0%
- **Notes**: Capture confirmed architectural decisions from brainstorming session
- **Connected File List**: .task/architecture.md, .task/project.md

---

## Recently Completed (2025-07-07)
- ✅ TP-021: Tool Flow cards redesigned with horizontal 3-column layout
- ✅ TP-022: Feedback Steps cards with collapsible template data  
- ✅ TP-023: Clone buttons added to Global Feedback Steps
- ✅ TP-024: Workspace rules system properly separated from feedback steps

All previous tasks moved to: `.task/todo/done_2025-07-07.md`
