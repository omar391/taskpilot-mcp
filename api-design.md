# TaskPilot UI Integration API Design

## Overview
This document defines the minimal REST API endpoints required for TaskPilot UI integration, based on analysis of UI pages: home, tasks, tool-flows, and feedback-steps.

## API Design Principles
- **Minimal endpoint set**: Target 6 core endpoints to avoid bloat
- **Resource-based URLs**: Follow RESTful conventions
- **Consistent response format**: Standardized JSON structure
- **Efficient data fetching**: Single endpoints return complete data needed per page
- **Real-time updates**: SSE events for dynamic content
- **On-demand expansion**: Audit during integration to add missing endpoints

## Core REST Endpoints

### 1. GET /api/workspaces
**Purpose**: List all workspaces with summary information
**Used by**: Home page
**Response**:
```json
{
  "workspaces": [
    {
      "id": "uuid",
      "name": "string",
      "path": "string", 
      "status": "connected|disconnected|error",
      "last_activity": "ISO8601",
      "task_count": "number",
      "active_task": "string|null",
      "created_at": "ISO8601",
      "updated_at": "ISO8601"
    }
  ]
}
```

### 2. GET /api/workspaces/{id}/tasks
**Purpose**: Get all tasks for a workspace with filtering
**Used by**: Tasks page
**Query params**: `status=current|history`, `limit`, `offset`
**Response**:
```json
{
  "tasks": [
    {
      "id": "string",
      "title": "string",
      "description": "string", 
      "priority": "High|Medium|Low",
      "status": "Backlog|In-Progress|Blocked|Review|Done|Dropped",
      "progress": "number",
      "parent_task_id": "string|null",
      "blocked_by_task_id": "string|null",
      "connected_files": ["string"],
      "notes": "string|null",
      "github_issue_number": "number|null",
      "github_url": "string|null",
      "created_at": "ISO8601",
      "updated_at": "ISO8601",
      "completed_at": "ISO8601|null"
    }
  ],
  "workspace": {
    "id": "string",
    "name": "string", 
    "path": "string"
  },
  "total": "number",
  "page": "number"
}
```

### 3. GET /api/workspaces/{id}/tool-flows
**Purpose**: Get tool flows (global and workspace-specific)
**Used by**: Tool flows page
**Query params**: `type=global|workspace|all`
**Response**:
```json
{
  "global_flows": [
    {
      "id": "string",
      "tool_name": "string",
      "steps": [
        {
          "id": "string",
          "step_order": "number",
          "system_tool_fn": "string", 
          "feedback_step": "string|null",
          "next_tool": "string|null"
        }
      ],
      "created_at": "ISO8601",
      "updated_at": "ISO8601"
    }
  ],
  "workspace_flows": [
    {
      "id": "string",
      "tool_name": "string",
      "workspace_id": "string",
      "steps": [...],
      "created_at": "ISO8601", 
      "updated_at": "ISO8601"
    }
  ],
  "available_tools": ["string"],
  "workspace": {
    "id": "string",
    "name": "string",
    "path": "string"
  }
}
```

### 4. GET /api/workspaces/{id}/feedback-steps  
**Purpose**: Get feedback steps (global and workspace-specific)
**Used by**: Feedback steps page
**Query params**: `type=global|workspace|all`
**Response**:
```json
{
  "global_steps": [
    {
      "id": "string",
      "name": "string",
      "instructions": "string",
      "metadata": "object",
      "created_at": "ISO8601",
      "updated_at": "ISO8601"
    }
  ],
  "workspace_steps": [
    {
      "id": "string", 
      "name": "string",
      "instructions": "string",
      "metadata": "object",
      "created_at": "ISO8601",
      "updated_at": "ISO8601"
    }
  ],
  "workspace_rules": [
    {
      "id": "string",
      "category": "string",
      "type": "never|always|remember|don't|preference",
      "content": "string",
      "confidence": "number",
      "created_at": "ISO8601"
    }
  ],
  "workspace": {
    "id": "string",
    "name": "string",
    "path": "string"
  }
}
```

### 5. POST /api/workspaces/{id}/tasks
**Purpose**: Create new task
**Used by**: Tasks page (new task button)
**Request body**:
```json
{
  "title": "string",
  "description": "string",
  "priority": "High|Medium|Low",
  "parent_task_id": "string|null"
}
```
**Response**:
```json
{
  "task": {
    "id": "string",
    "title": "string", 
    "description": "string",
    "priority": "High|Medium|Low",
    "status": "Backlog",
    "progress": 0,
    "created_at": "ISO8601",
    "updated_at": "ISO8601"
  }
}
```

### 6. PUT /api/workspaces/{id}/tasks/{taskId}
**Purpose**: Update task properties
**Used by**: Tasks page (task updates)
**Request body**:
```json
{
  "field": "title|description|priority|status|progress|notes",
  "value": "string|number",
  "reason": "string"
}
```
**Response**:
```json
{
  "task": {
    "id": "string",
    "updated_at": "ISO8601",
    "[field]": "updated_value"
  }
}
```

## Server-Sent Events (SSE)

### SSE Endpoint: /api/events
**Purpose**: Real-time updates for UI components
**Event types**:

#### workspace.status_changed
```json
{
  "type": "workspace.status_changed",
  "data": {
    "workspace_id": "string",
    "status": "connected|disconnected|error",
    "last_activity": "ISO8601"
  }
}
```

#### task.updated
```json
{
  "type": "task.updated", 
  "data": {
    "workspace_id": "string",
    "task": {
      "id": "string",
      "status": "string",
      "progress": "number",
      "updated_at": "ISO8601"
    }
  }
}
```

#### task.created
```json
{
  "type": "task.created",
  "data": {
    "workspace_id": "string", 
    "task": {
      "id": "string",
      "title": "string",
      "status": "string",
      "created_at": "ISO8601"
    }
  }
}
```

## Error Response Format
```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": "object|null"
  }
}
```

## Status Codes
- `200` - Success
- `201` - Created  
- `400` - Bad Request
- `404` - Not Found
- `422` - Validation Error
- `500` - Internal Server Error

## Implementation Notes

### Database Mapping
- **Global data**: Use global database (`~/.taskpilot/global.db`)
- **Workspace data**: Use workspace database (`{workspace}/.taskpilot/task.db`)
- **Cross-database queries**: Use DatabaseService for coordinated access

### Caching Strategy
- **Workspaces list**: Cache for 30 seconds
- **Tasks**: Cache invalidated on updates
- **Tool flows/feedback steps**: Cache until modified

### Rate Limiting
- **GET endpoints**: 100 requests/minute per client
- **POST/PUT endpoints**: 30 requests/minute per client
- **SSE connections**: 5 concurrent connections per client

### Authentication
- **Development**: No authentication required
- **Production**: Token-based authentication when deployed

### CORS Configuration
- **Origins**: `http://localhost:*` for development
- **Methods**: `GET, POST, PUT, DELETE, OPTIONS`
- **Headers**: `Content-Type, Authorization`

## Future Endpoints (On-Demand)
These endpoints may be added during UI integration if needed:

- `GET /api/workspaces/{id}/github-config` - GitHub integration settings
- `POST /api/workspaces/{id}/tool-flows` - Create custom tool flow
- `DELETE /api/workspaces/{id}/tasks/{taskId}` - Delete task
- `GET /api/workspaces/{id}/remote-interfaces` - Remote integrations
- `POST /api/workspaces/{id}/feedback-steps` - Create workspace feedback step
- `GET /api/health` - Server health check (already implemented)

## OpenAPI Specification
A complete OpenAPI 3.0 specification will be generated automatically from the implemented endpoints using swagger-jsdoc and served at `/api/docs`.

## Implementation Priority
1. **Phase 1**: Endpoints 1-4 (read-only data)
2. **Phase 2**: Endpoints 5-6 (task creation/updates) 
3. **Phase 3**: SSE events for real-time updates
4. **Phase 4**: Additional endpoints based on integration needs
