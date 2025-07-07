# TaskPilot MCP Server Architecture

## Phase 3: Remote Hosting & UI Integration Architecture Decisions

### Overview

This document captures the confirmed architectural decisions made during Phase 3 development for remote hosting and UI integration capabilities. These decisions represent the current production architecture after extensive implementation and testing.

### 1. Composite Feedback Step Approach (Option A)

**Decision**: Use single composite feedback step for multiple rule contexts instead of separate feedback steps.

**Implementation**:
- Single "workspace_context" feedback step for start/init tools
- Variable substitution combines: standard rules + workspace rules + analytical framework
- LLM receives comprehensive context in one response

**Alternative Rejected**: Separate feedback steps for each rule type (would require multiple LLM calls)

**Benefits**: Single context delivery, reduced API calls, comprehensive rule awareness, improved LLM context understanding.

### 2. Workspace Lifecycle Management 

**Decision**: Implement automatic workspace lifecycle with timing-based status transitions.

**Lifecycle States**:
- **Active**: Recent interaction (MCP call, API request, or UI activity)
- **Idle**: No activity for 5 minutes → automatic transition
- **Inactive**: Idle for additional 5 minutes → automatic transition

**Activity Tracking**:
- MCP tool executions
- REST API requests  
- Task updates
- UI interactions

**Benefits**: Automatic resource management, clear status indication, performance optimization.

### 3. SSE+REST Hybrid Communication Pattern

**Decision**: Use Server-Sent Events (SSE) for real-time updates combined with REST API for commands.

**Architecture**:
- **REST Endpoints**: HTTP commands from UI to backend
- **SSE Stream**: Real-time events from backend to UI
- **Dual Protocol Support**: MCP over SSE + REST API on same port (3001)

**SSE Event Types**:
- `workspace.status_changed` - Workspace lifecycle updates
- `task.updated` - Task progress changes
- `task.created` - New task notifications

**Benefits**: Real-time UI updates, efficient server-to-client communication, proper separation of concerns.

### 4. Database Locations

**Decision**: Split data across two database locations for proper scoping and performance.

**Database Architecture**:
- **Global Database**: `~/.taskpilot/global.db`
  - Workspaces registry and metadata
  - Session management
  - Global tool flows and feedback steps
  - MCP server mappings
  - Cross-workspace shared data

- **Workspace Database**: `{workspace}/.taskpilot/task.db` (per workspace)
  - Task management and tracking
  - GitHub configurations  
  - Remote interface settings
  - Workspace-specific data
  - On-demand initialization when workspace accessed

**Benefits**: Clear data separation, improved performance, proper workspace isolation, reduced database contention.

### 5. Minimal API Endpoint Strategy

**Decision**: Design minimal core endpoints with on-demand expansion during UI development.

**Core 6 REST Endpoints**:
1. `GET /api/workspaces` - List all discovered workspaces
2. `GET /api/workspaces/{id}/tasks` - Get workspace tasks  
3. `GET /api/workspaces/{id}/tool-flows` - Get workspace tool flows
4. `GET /api/workspaces/{id}/feedback-steps` - Get workspace feedback steps
5. `POST /api/workspaces/{id}/tasks` - Create new task
6. `PUT /api/workspaces/{id}/tasks/{taskId}` - Update task

**Benefits**: Prevents endpoint bloat, focused API surface, extensible design, real-time capabilities.

### 6. Drizzle ORM Integration

**Decision**: Replace manual SQL with Drizzle ORM for type safety and developer experience.

**Implementation**:
- TypeScript schema definitions for compile-time safety
- Automatic type inference for queries and results
- Migration system with SQL fallback for development
- Dual database support (global + workspace)

**Benefits**: Type safety, better IDE support, reduced SQL errors, improved maintainability.

### 7. Embedded Data Distribution

**Decision**: Embed all external data files as TypeScript constants for clean distribution.

**Implementation**:
- All JSON seed data embedded in `src/data/embedded-seed-data.ts`
- Database schemas embedded via Drizzle TypeScript definitions  
- No external file dependencies in distribution package

**Benefits**: Single-file distribution, no missing file errors, simplified deployment.

## System Architecture Overview - Prompt Orchestration Flow

```mermaid
graph TB
    subgraph "LLM Interaction Layer"
        LLM[LLM in IDE/CLI]
        USER[Developer]
    end
    
    subgraph "MCP Client Layer"
        CLI[CLI Tool]
        IDE[IDE Extension]
    end
    
    subgraph "TaskPilot MCP Server"
        MCP[MCP Protocol Server]
        ORCHESTRATOR[Prompt Orchestrator]
        
        subgraph "MCP Tools (Return Prompts)"
            T1[taskpilot_start]
            T2[taskpilot_init]
            T3[taskpilot_add]
            T4[taskpilot_status]
            T5[taskpilot_update]
            T6[taskpilot_focus]
            T7[taskpilot_audit]
            T8[taskpilot_github]
            T9[taskpilot_rule_update]
        end
        
        subgraph "Flow Engine"
            TF[Tool Flow Manager]
            FS[Feedback Step Manager]
            PS[Prompt Generator]
        end
    end
    
    subgraph "React Web UI (Monitor/Config Only)"
        WS[Workspace Navigator]
        TM[Tool Flow Manager UI]
        FSM[Feedback Step Manager UI]
    end
    
    subgraph "Data Layer"
        DB[(SQLite Database)]
        SEED[JSON Seed Data]
        API[GitHub API]
    end
    
    USER -->|Asks LLM| LLM
    LLM -->|Calls taskpilot_*| CLI
    LLM -->|Calls taskpilot_*| IDE
    
    CLI --> MCP
    IDE --> MCP
    
    MCP --> ORCHESTRATOR
    ORCHESTRATOR --> T1
    ORCHESTRATOR --> T2
    ORCHESTRATOR --> T3
    ORCHESTRATOR --> T4
    ORCHESTRATOR --> T5
    ORCHESTRATOR --> T6
    ORCHESTRATOR --> T7
    ORCHESTRATOR --> T8
    
    T1 --> TF
    T3 --> TF
    T4 --> TF
    T8 --> TF
    
    TF --> FS
    FS --> PS
    PS -->|prompt_text| ORCHESTRATOR
    ORCHESTRATOR -->|prompt_text| MCP
    MCP -->|prompt_text| CLI
    MCP -->|prompt_text| IDE
    CLI -->|prompt_text| LLM
    IDE -->|prompt_text| LLM
    
    LLM -->|Follows instructions| LLM
    LLM -->|Calls next tool or ends| CLI
    
    Note1[Web UI cannot start LLM flow]
    WS -.->|Monitor only| DB
    TM -.->|Configure flows| DB
    FSM -.->|Configure steps| DB
    
    DB --> TF
    DB --> FS
    SEED --> DB
    API --> DB
```

## Prompt Orchestration Flow

```mermaid
sequenceDiagram
    participant USER as Developer
    participant LLM as LLM (IDE/CLI)
    participant MCP as MCP Server
    participant TF as Tool Flow Manager
    participant FS as Feedback Step Manager
    participant DB as SQLite DB
    
    Note over USER,DB: TaskPilot Prompt Orchestration Flow
    
    USER->>LLM: "Add a new task for user authentication"
    LLM->>MCP: taskpilot_add(description: "user auth", priority: "High")
    
    Note over MCP: Lookup Tool Flow for taskpilot_add
    MCP->>TF: getToolFlow("taskpilot_add", workspace_path)
    TF->>DB: SELECT tool_flow WHERE tool='taskpilot_add'
    DB->>TF: {tool: "taskpilot_add", feedback_step: "analytical_validation", next_tool: "create_task"}
    
    TF->>FS: getFeedbackStep("analytical_validation", workspace_path)
    FS->>DB: SELECT feedback_step WHERE name='analytical_validation'
    DB->>FS: {instructions: "Apply 6-step analytical framework..."}
    
    Note over MCP: Generate Prompt Text
    MCP->>LLM: prompt_text: "I need to validate this task using analytical framework:\n1. Check logical consistency...\n6. Consider alternatives\n\nAfter validation, call taskpilot_create_task if validation passes."
    
    Note over LLM: LLM processes analytical validation
    LLM->>LLM: Apply analytical framework
    LLM->>LLM: Determine validation result
    
    alt Validation Successful
        LLM->>MCP: taskpilot_create_task(validated_data)
        MCP->>DB: INSERT INTO tasks
        MCP->>LLM: prompt_text: "Task created successfully. Task ID: TP-013"
    else Validation Failed
        LLM->>USER: "I notice logical inconsistencies in the requirement..."
        Note over LLM: No next tool called, flow ends
    end
```

## Web UI Workspace Navigation Flow

```mermaid
sequenceDiagram
    participant USER as Developer
    participant UI as React Web UI
    participant MCP as MCP Server (via API)
    participant DB as SQLite DB
    
    Note over USER,DB: Web UI Monitoring & Configuration
    
    USER->>UI: Navigate to TaskPilot Web UI
    UI->>MCP: GET /api/workspaces
    MCP->>DB: SELECT DISTINCT workspace_path FROM sessions
    DB->>MCP: ['/project1', '/project2', '/project3']
    MCP->>UI: {connected: ['/project1'], disconnected: ['/project2', '/project3']}
    
    Note over UI: Display workspace list on home page
    
    USER->>UI: Click on '/project1' workspace
    UI->>UI: Navigate to /workspace/project1
    UI->>MCP: GET /api/workspace/project1/tasks
    MCP->>DB: SELECT tasks WHERE workspace_path='/project1'
    MCP->>UI: [task_list]
    
    USER->>UI: Click "Tool Flows" menu
    UI->>MCP: GET /api/workspace/project1/tool-flows
    MCP->>DB: SELECT tool_flows WHERE workspace_path='/project1' OR is_global=true
    MCP->>UI: {global: [...], workspace: [...]}
    
    USER->>UI: Edit workspace tool flow
    UI->>MCP: PUT /api/workspace/project1/tool-flows/taskpilot_add
    MCP->>DB: UPDATE tool_flows SET feedback_steps=...
    
    Note over UI: Changes only affect workspace view, global remains immutable
```

## Database Schema

```mermaid
erDiagram
    WORKSPACES {
        string path PK
        string name
        boolean is_connected
        datetime last_active
        datetime created_at
    }
    
    TASKS {
        string id PK
        string workspace_path FK
        string title
        text description
        enum priority
        enum status
        integer progress
        string parent_task_id FK
        string blocked_by_task_id FK
        json connected_files
        text notes
        datetime created_at
        datetime updated_at
        datetime completed_at
        string github_issue_id
    }
    
    TOOL_FLOWS {
        integer id PK
        string tool_name
        string workspace_path FK
        boolean is_global
        json flow_steps
        integer order_index
        datetime created_at
        datetime updated_at
    }
    
    FEEDBACK_STEPS {
        integer id PK
        string name
        string workspace_path FK
        boolean is_global
        text instructions
        json metadata
        datetime created_at
        datetime updated_at
    }
    
    REMOTE_TASK_INTERFACES {
        integer id PK
        string workspace_path FK
        string interface_type
        string interface_name
        string project_url
        json connection_config
        boolean is_active
        datetime created_at
        datetime updated_at
    }
    
    PROJECT_CONFIG {
        string workspace_path FK
        string key
        text value
        datetime updated_at
    }
    
    SESSIONS {
        string id PK
        string workspace_path FK
        datetime started_at
        datetime last_activity
        boolean is_active
    }
    
    WORKSPACES ||--o{ TASKS : "contains"
    WORKSPACES ||--o{ TOOL_FLOWS : "has"
    WORKSPACES ||--o{ FEEDBACK_STEPS : "has"
    WORKSPACES ||--o{ REMOTE_TASK_INTERFACES : "connects"
    WORKSPACES ||--o{ PROJECT_CONFIG : "configures"
    WORKSPACES ||--o{ SESSIONS : "hosts"
    TASKS ||--o{ TASKS : "parent_child"
    TASKS ||--o{ TASKS : "blocks"
```

## Tool Flow Structure (JSON Schema)

```json
{
  "tool_name": "taskpilot_add",
  "workspace_path": "/path/to/project",
  "is_global": false,
  "flow_steps": [
    {
      "step_order": 1,
      "system_tool_fn": "taskpilot_add",
      "feedback_step": "analytical_validation",
      "next_tool": "taskpilot_create_task"
    },
    {
      "step_order": 2,
      "system_tool_fn": "taskpilot_create_task",
      "feedback_step": "post_task_validation",
      "next_tool": "end"
    }
  ]
}
```

## Feedback Step Structure (JSON Schema)

```json
{
  "name": "analytical_validation",
  "workspace_path": "/path/to/project",
  "is_global": true,
  "instructions": "Apply the 6-step analytical thinking framework:\n1. **Logical Consistency**: Evaluate statements for internal coherence and contradictions\n2. **Evidence Quality**: Assess the strength and reliability of supporting data/reasoning\n3. **Hidden Assumptions**: Identify unstated premises that may affect outcomes\n4. **Cognitive Biases**: Detect emotional reasoning, confirmation bias, or wishful thinking\n5. **Causal Relationships**: Verify claimed cause-and-effect relationships are valid\n6. **Alternative Perspectives**: Consider competing explanations or approaches\n\nIf validation passes, proceed to create the task. If validation fails, provide constructive feedback with specific suggestions for improvement.",
  "metadata": {
    "category": "validation",
    "required_tools": ["taskpilot_create_task"],
    "timeout_minutes": 5
  }
}
```

## Web UI Structure - Mobile App Style Interface

### Floating Static Navigation
```mermaid
graph TB
    subgraph FloatingNav ["📱 Static Bottom Navigation"]
        HOME_NAV["🏠 Home"]
        TOOLS_NAV["🔄 Tool Flows"]
        FEEDBACK_NAV["📝 Feedback Steps"]
    end
    
    subgraph MainScreen ["Main Screen Area"]
        CONTENT["Dynamic Content Based on Nav Selection"]
    end
    
    FloatingNav --- MainScreen
```

### Home Screen - Workspace List
```mermaid
graph TB
    HOME_SCREEN["🏠 Home Screen"] --> WS_CONNECTED["Connected Workspaces ✅"]
    HOME_SCREEN --> WS_DISCONNECTED["Disconnected Workspaces ❌"]
    
    WS_CONNECTED --> WS_CARD1["Project Alpha<br/>/home/user/project1<br/>Last Active: 2 min ago"]
    WS_DISCONNECTED --> WS_CARD2["Project Beta<br/>/var/www/webapp<br/>Last Active: 2 days ago"]
```

### Tool Flows Screen
```mermaid
graph TB
    TOOLS_SCREEN["🔄 Tool Flows Screen"] --> TOOLS_TABS["Tab Navigation"]
    
    TOOLS_TABS --> TF_GLOBAL["Global Tab<br/>(Read-only)"]
    TOOLS_TABS --> TF_WORKSPACE["Workspace Tab<br/>(Editable)"]
    
    TF_GLOBAL --> TF_GLOBAL_ITEMS["taskpilot_add<br/>taskpilot_status<br/>taskpilot_github<br/>[Edit Button] → Clone to Workspace"]
    
    TF_WORKSPACE --> TF_WS_ITEMS["Custom taskpilot_add<br/>Modified workflows<br/>[Edit/Delete Buttons]"]
```

### Feedback Steps Screen
```mermaid
graph TB
    FEEDBACK_SCREEN["📝 Feedback Steps Screen"] --> FEEDBACK_TABS["Tab Navigation"]
    
    FEEDBACK_TABS --> FS_GLOBAL["Global Tab<br/>(Read-only)"]
    FEEDBACK_TABS --> FS_WORKSPACE["Workspace Tab<br/>(Editable)"]
    
    FS_GLOBAL --> FS_GLOBAL_ITEMS["analytical_validation<br/>post_task_validation<br/>code_review<br/>[Edit Button] → Clone to Workspace"]
    
    FS_WORKSPACE --> FS_WS_ITEMS["workspace_rules (dynamic)<br/>custom_validation<br/>[Edit/Delete Buttons]"]
```

## Tool Flow Card Structure (3-Part Unit Block)

**Important**: Not all 3 blocks are required. Feedback steps and next tool calls are optional depending on the tool's purpose.

### Complete Flow Example (taskpilot_add)
```mermaid
graph LR
    A["1. System Tool Function<br/>taskpilot_add"] --> B["2. Feedback Step (Optional)<br/>analytical_validation"]
    B --> C["3. Next Tool (Optional)<br/>taskpilot_create_task"]
```

### Simple Flow Example (taskpilot_create_task)
```mermaid
graph LR
    A["1. System Tool Function<br/>taskpilot_create_task"] --> B["2. Feedback Step<br/>(none)"]
    B --> C["3. Next Tool<br/>end"]
```

### Flow Examples by Tool Type

| Tool | System Function | Feedback Step | Next Tool | Reason |
|------|----------------|---------------|-----------|---------|
| `taskpilot_add` | ✓ | analytical_validation | taskpilot_create_task | Needs validation before creation |
| `taskpilot_create_task` | ✓ | (none) | end | Direct execution, no feedback needed |
| `taskpilot_status` | ✓ | status_analysis | end | Analysis only, no follow-up |
| `taskpilot_github` | ✓ | github_validation | taskpilot_update | May need task updates after sync |
| `taskpilot_rule_update` | ✓ | (none) | end | Direct rule creation, no feedback needed |

### UI Component Structure
```mermaid
graph TB
    CARD["Tool Flow Card"] --> PART1["Part 1: System Tool Function<br/>(Always Required)"]
    CARD --> PART2["Part 2: Feedback Step Dropdown<br/>(Optional - can be 'none')"]
    CARD --> PART3["Part 3: Next Tool Dropdown<br/>(Optional - can be 'end')"]
    
    PART2 --> FS_OPTIONS["Options:<br/>• analytical_validation<br/>• post_task_validation<br/>• (none)"]
    PART3 --> NT_OPTIONS["Options:<br/>• taskpilot_create_task<br/>• taskpilot_update<br/>• end"]
```

## Web UI Routing Structure - Mobile App Style

### Simplified Mobile-Style Navigation
```mermaid
graph TB
    HOME["🏠 Home Page<br/>Workspace List"] --> NAV["📱 Floating Static Nav"]
    
    NAV --> HOME_TAB["🏠 Home"]
    NAV --> TOOLS_TAB["🔄 Tool Flows"]
    NAV --> FEEDBACK_TAB["📝 Feedback Steps"]
    
    TOOLS_TAB --> TF_GLOBAL["Global Tab"]
    TOOLS_TAB --> TF_WORKSPACE["Workspace Tab"]
    
    FEEDBACK_TAB --> FS_GLOBAL["Global Tab"]
    FEEDBACK_TAB --> FS_WORKSPACE["Workspace Tab"]
    
    TF_GLOBAL --> TF_EDIT["Edit Button → Clone to Workspace"]
    FS_GLOBAL --> FS_EDIT["Edit Button → Clone to Workspace"]
```

### Workspace-Based Routing
```mermaid
graph LR
    ROOT["/"] --> WORKSPACE["/workspace/{path}"]
    WORKSPACE --> HOME_VIEW["Home View"]
    WORKSPACE --> TOOLS_VIEW["Tool Flows View"]
    WORKSPACE --> FEEDBACK_VIEW["Feedback Steps View"]
```

### Default Fallback Logic
```
If workspace variant exists:
  Use workspace version
Else:
  Use global variant (read-only)
  Show "Edit" button to clone to workspace
```

## Analytical Thinking Framework Implementation

```mermaid
flowchart TD
    INPUT[Task/Requirement Input] --> FRAMEWORK{Analytical Framework}
    
    FRAMEWORK --> LC[1. Logical Consistency Check]
    LC --> LCQ{Coherent & Non-contradictory?}
    LCQ -->|No| LCFIX[Suggest Logical Fixes]
    LCQ -->|Yes| EQ[2. Evidence Quality Assessment]
    
    EQ --> EQQ{Strong Supporting Evidence?}
    EQQ -->|No| EQFIX[Request Better Evidence]
    EQQ -->|Yes| HA[3. Hidden Assumptions Check]
    
    HA --> HAQ{Unstated Premises Identified?}
    HAQ -->|Yes| HAFIX[Expose & Validate Assumptions]
    HAQ -->|No| CB[4. Cognitive Bias Detection]
    
    CB --> CBQ{Emotional/Confirmation Bias?}
    CBQ -->|Yes| CBFIX[Challenge Biased Reasoning]
    CBQ -->|No| CR[5. Causal Relationships]
    
    CR --> CRQ{Valid Cause-Effect Claims?}
    CRQ -->|No| CRFIX[Verify Causal Links]
    CRQ -->|Yes| AP[6. Alternative Perspectives]
    
    AP --> APQ{Competing Views Considered?}
    APQ -->|No| APFIX[Explore Alternatives]
    APQ -->|Yes| VALID[Validation Passed]
    
    LCFIX --> FEEDBACK[Constructive Feedback]
    EQFIX --> FEEDBACK
    HAFIX --> FEEDBACK
    CBFIX --> FEEDBACK
    CRFIX --> FEEDBACK
    APFIX --> FEEDBACK
    
    FEEDBACK --> RETRY[User Revises Input]
    RETRY --> FRAMEWORK
    
    VALID --> APPROVE[Approve Task Creation]
```

## Workspace Rules Management System

### Dynamic Feedback Step Updates

Workspace rules are managed as dynamic feedback steps that get updated when trigger phrases are detected. There is no separate `workspace_rules` table - instead, workspace feedback steps are modified to include new rules.

#### Trigger Phrases Detection
```
Trigger Words: "never", "always", "remember", "don't", "do not"

Examples:
- "Never use var, always use const or let"
- "Remember to add unit tests for all new functions"
- "Don't commit without running the linter"
- "Always update the changelog when adding features"
```

#### Rule Update Flow (Feedback Step Modification)
```mermaid
sequenceDiagram
    participant USER as Developer
    participant LLM as LLM (IDE/CLI)
    participant MCP as MCP Server
    participant RD as Rule Detector
    participant FSM as Feedback Step Manager
    participant DB as SQLite DB
    
    USER->>LLM: "Never use var, always use const or let"
    Note over LLM: LLM detects instruction pattern
    LLM->>MCP: taskpilot_rule_update(user_feedback, workspace_path)
    
    MCP->>RD: detectTriggerPhrases(user_feedback)
    RD->>RD: Parse for "never", "always", etc.
    RD->>MCP: {trigger: "never", content: "use var", category: "coding_style"}
    
    MCP->>FSM: updateWorkspaceFeedbackStep("workspace_rules", new_rule, workspace_path)
    FSM->>DB: UPDATE feedback_steps SET instructions = instructions + new_rule
    FSM->>MCP: feedback_step_updated
    
    MCP->>LLM: "Workspace rule added to feedback step: Never use var, always use const or let"
```

#### Global + Workspace Rules Integration
- **Global Rules**: Base guidelines in global feedback steps (immutable)
- **Workspace Rules**: Dynamic additions to workspace feedback steps (editable)
- **LLM Context**: Both global and workspace rules provided in `taskpilot_start` and `taskpilot_init` responses

## Global Configuration Seed Structure

### Global Tool Flows (JSON Database Seed)
```json
{
  "global_tool_flows": [
    {
      "tool_name": "taskpilot_add",
      "flow_steps": [
        {
          "step_order": 1,
          "system_tool_fn": "taskpilot_add",
          "feedback_step": "analytical_validation",
          "next_tool": "taskpilot_create_task"
        }
      ]
    },
    {
      "tool_name": "taskpilot_status",
      "flow_steps": [
        {
          "step_order": 1,
          "system_tool_fn": "taskpilot_status",
          "feedback_step": "status_analysis",
          "next_tool": "end"
        }
      ]
    },
    {
      "tool_name": "taskpilot_rule_update",
      "flow_steps": [
        {
          "step_order": 1,
          "system_tool_fn": "taskpilot_rule_update",
          "feedback_step": null,
          "next_tool": "end"
        }
      ]
    }
  ]
}
```

### Global Feedback Steps (JSON Database Seed)
```json
{
  "global_feedback_steps": [
    {
      "name": "analytical_validation",
      "instructions": "Apply the 6-step analytical thinking framework:\n1. **Logical Consistency**: Evaluate statements for internal coherence and contradictions\n2. **Evidence Quality**: Assess the strength and reliability of supporting data/reasoning\n3. **Hidden Assumptions**: Identify unstated premises that may affect outcomes\n4. **Cognitive Biases**: Detect emotional reasoning, confirmation bias, or wishful thinking\n5. **Causal Relationships**: Verify claimed cause-and-effect relationships are valid\n6. **Alternative Perspectives**: Consider competing explanations or approaches\n\nIf validation passes, call the next tool. If validation fails, provide constructive feedback.",
      "metadata": {
        "category": "validation",
        "timeout_minutes": 5
      }
    },
    {
      "name": "post_task_validation",
      "instructions": "After task completion:\n1. Run all relevant unit tests for modified code\n2. Check code formatting and linting\n3. Verify task progress is accurately recorded\n4. Update connected file list\n5. Create git commit with task reference\n\nOnly mark task as 100% complete when all checks pass.",
      "metadata": {
        "category": "completion",
        "timeout_minutes": 10
      }
    }
  ]
}
```

### Database Seed File Naming Convention

**CRITICAL DESIGN PRINCIPLE**: All JSON files used for database seeding must follow the `*-db-seed.json` naming pattern to clearly distinguish them from regular configuration files.

**File Structure:**
- `src/data/global-tool-flows-db-seed.json` - Tool flow configurations for database seeding
- `src/data/global-feedback-steps-db-seed.json` - Feedback step templates for database seeding
- Future seed files: `[feature]-db-seed.json` pattern

**Template Engine Design Rules:**
1. **NO HARDCODED TEMPLATES** - All response formatting must be in database-stored feedback steps
2. **Variable Substitution**: Use `{{context.variable}}` syntax in feedback step templates
3. **MCP Tools**: Only provide context data and return `orchestrationResult.prompt_text`
4. **Database First**: JSON files are seed data - all lookups happen against database, not files
5. **Template Storage**: All templates stored in `feedback_steps` table with `{{context.variable}}` placeholders

### Remote Task Interfaces Configuration

```json
{
  "remote_task_interfaces": [
    {
      "interface_type": "github",
      "interface_name": "GitHub Issues",
      "example_config": {
        "repository_url": "https://github.com/owner/repo",
        "access_token": "encrypted_token",
        "webhook_url": "https://api.github.com/repos/owner/repo/hooks",
        "sync_enabled": true
      }
    },
    {
      "interface_type": "jira",
      "interface_name": "Jira Software",
      "example_config": {
        "project_url": "https://company.atlassian.net/browse/PROJECT",
        "api_endpoint": "https://company.atlassian.net/rest/api/3",
        "username": "user@company.com",
        "api_token": "encrypted_token",
        "project_key": "PROJECT"
      }
    },
    {
      "interface_type": "linear",
      "interface_name": "Linear",
      "example_config": {
        "team_url": "https://linear.app/company/team/TEAM",
        "api_endpoint": "https://api.linear.app/graphql",
        "api_key": "encrypted_key",
        "team_id": "team_uuid"
      }
    }
  ]
}
```

## Component Interaction Matrix

| Component | taskpilot_start | taskpilot_add | taskpilot_status | taskpilot_github | taskpilot_rule_update |
|-----------|----------------|---------------|------------------|------------------|-----------------------|
| Flow Orchestrator | ✓ Primary | ✓ Primary | ✓ Primary | ✓ Primary | ✓ Primary |
| Feedback Manager | ✓ Context | ✓ Primary | ✓ Analysis | ✓ Validation | ○ Minimal |
| Session Manager | ✓ Primary | ○ Minimal | ○ Minimal | ○ Minimal | ○ Minimal |
| Rule Detector | ○ Minimal | ○ Minimal | ○ Minimal | ○ Minimal | ✓ Primary |
| Workspace Rule Manager | ✓ Context | ○ Minimal | ○ Minimal | ○ Minimal | ✓ Primary |
| Prompt Generator | ✓ Primary | ✓ Primary | ✓ Primary | ✓ Primary | ✓ Primary |
| Database | ✓ Read/Write | ✓ Read | ✓ Read | ✓ Read/Write | ✓ Write |

**Legend:**
- ✓ Primary: Core functionality dependency
- ○ Minimal: Basic interaction only