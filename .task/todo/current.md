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
- **Status**: In-Progress
- **Progress**: 85%
- **Notes**: Major progress made - Drizzle ORM foundation complete:
  - ✅ Installed drizzle-orm, better-sqlite3, drizzle-kit packages
  - ✅ Created TypeScript schema definitions (global-schema.ts, workspace-schema.ts, relations.ts)
  - ✅ Built new DrizzleDatabaseManager with dual database type support
  - ✅ Created comprehensive GlobalDatabaseService with type-safe queries
  - ✅ Created WorkspaceDatabaseService for workspace-specific operations
  - ✅ All schema tables converted to TypeScript with proper type inference
  - ✅ Migration system setup with SQL fallback for development
  - ✅ Integration into main server initialized successfully
  - 🔄 TODO: Convert remaining tool implementations to use Drizzle services
  - 🔄 TODO: Update services to use new query layer instead of manual SQL
  - 🔄 TODO: Test complete database operations with new ORM
- **Connected File List**: src/database/drizzle-connection.ts, src/database/global-queries.ts, src/database/workspace-queries.ts, src/database/schema/*, drizzle.config.ts, src/index.ts, package.json

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
- **Status**: Done
- **Progress**: 100%
- **Notes**: ✅ COMPLETED - Minimal API design successfully created with:
  - 6 core REST endpoints: GET /workspaces, GET /workspaces/{id}/tasks, GET /workspaces/{id}/tool-flows, GET /workspaces/{id}/feedback-steps, POST /workspaces/{id}/tasks, PUT /workspaces/{id}/tasks/{taskId}
  - SSE events for real-time updates: workspace.status_changed, task.updated, task.created
  - Complete API documentation with request/response schemas
  - Database mapping strategy using dual database architecture
  - Caching, rate limiting, and error handling specifications
  - On-demand expansion plan for additional endpoints during integration
  - OpenAPI specification plan for automatic documentation
- **Connected File List**: api-design.md, ui/src/pages/*.tsx

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
- **Status**: Done
- **Progress**: 100%
- **Notes**: ✅ COMPLETED - HTTP server with REST + SSE successfully implemented:
  - 6 REST API endpoints: GET /api/workspaces, GET /workspaces/{id}/tasks, GET /workspaces/{id}/tool-flows, GET /workspaces/{id}/feedback-steps, POST /workspaces/{id}/tasks, PUT /workspaces/{id}/tasks/{taskId}
  - SSE event system: /api/events endpoint for real-time UI updates
  - Complete middleware stack: CORS, rate limiting, error handling, request validation
  - Dual server architecture: MCP server (SSE transport) + REST API server operating independently
  - Enhanced health check with both MCP and SSE client counts
  - Database schema updated with workspace status column
  - All endpoints tested and working correctly
  - Error handling for missing workspace tables (graceful degradation)
- **Connected File List**: src/index.ts, src/api/router.ts, src/api/types.ts, src/api/middleware.ts, src/api/workspaces.ts, src/api/tasks.ts, src/api/tool-flows.ts, src/api/feedback-steps.ts, src/database/schema.sql

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
- **Status**: Done
- **Progress**: 100%
- **Notes**: ✅ COMPLETED - Complete UI-backend integration successfully implemented:
  - Comprehensive TypeScript API client (415 lines) with error handling, retry logic, and SSE support
  - All UI pages updated to use real API calls: HomePage, tool-flows, tasks, feedback-steps
  - Loading states and error handling implemented across all components
  - Fixed type mismatches between API schema and UI components (template_content vs template)
  - Tasks page restored with proper API integration and error handling
  - FeedbackEditor component updated to match API types
  - Real-time SSE update system working for workspace status and task changes
  - Backend-frontend integration tested and verified working correctly
  - All mock data replaced with live API data retrieval
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
