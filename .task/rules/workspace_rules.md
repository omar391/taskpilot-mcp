# TaskPilot MCP Server - Workspace-Specific Rules and Guidelines

## Coding Standards

### TypeScript Guidelines
- Use strict TypeScript configuration with `noImplicitAny`, `strictNullChecks`
- Prefer interfaces over types for object shapes
- Use `const assertions` for immutable data structures
- Follow functional programming patterns where possible
- Use proper error handling with Result/Either patterns

### Node.js/MCP Server Standards
- Follow MCP protocol specifications strictly
- Use async/await over Promises chains
- Implement proper logging with structured format
- Use environment variables for configuration
- Validate all inputs using schema validation (Zod)

### React/Frontend Standards
- Use TypeScript for all React components
- Follow shadcn-ui component patterns
- Use TanStack Router for navigation
- Implement proper loading and error states
- Use React Query for data fetching

## Git Workflow

### Branch Naming
- `feature/TP-XXX-description` for new features
- `bugfix/TP-XXX-description` for bug fixes
- `refactor/TP-XXX-description` for refactoring
- `docs/TP-XXX-description` for documentation

### Commit Message Format
```
TP-XXX: Brief description

- Detailed explanation of changes
- Reference to task requirements
- Any breaking changes noted
```

### PR Process
- Link to task ID in PR description
- Require code review before merge
- Run all tests and linters
- Update task status after merge

## Testing Requirements

### Coverage Expectations
- Minimum 80% code coverage for core MCP tools
- Unit tests for all business logic
- Integration tests for database operations
- E2E tests for critical user workflows

### Testing Frameworks
- **Backend**: Jest for unit/integration tests
- **Frontend**: Vitest + React Testing Library
- **E2E**: Playwright for full workflow testing
- **Database**: In-memory SQLite for test isolation

## Security Guidelines

### Authentication/Authorization
- Use secure token-based authentication for GitHub integration
- Validate and sanitize all user inputs
- Implement rate limiting for API endpoints
- Use HTTPS in production environments

### Data Handling
- Encrypt sensitive configuration data
- Use parameterized queries to prevent SQL injection
- Implement proper session management
- Log security events for audit trail

## Performance Considerations

### Database Optimization
- Use database indexes for frequently queried fields
- Implement connection pooling for SQLite
- Optimize queries to minimize N+1 problems
- Use pagination for large result sets

### Frontend Performance
- Implement code splitting for React components
- Use React.memo for expensive component renders
- Optimize bundle size with tree shaking
- Implement proper caching strategies

## Custom Rules

### MCP Tool Development
- Each tool must implement proper input validation
- Tools should return structured responses with error handling
- Implement the Analytical Thinking Framework in tool logic
- Provide detailed descriptions and examples in tool schemas
- **CRITICAL: NO HARDCODED TEMPLATES** - All response formatting must be in database feedback steps
- Tools must only provide context data and return `orchestrationResult.prompt_text`
- Use `{{context.variable}}` syntax in feedback step templates for variable substitution

### Database Operations
- Use transactions for multi-table operations
- Implement proper migration system for schema changes
- Use soft deletes for audit trail preservation
- Validate data integrity with foreign key constraints

### Task Management Specific
- Task IDs must follow TP-XXX format (TaskPilot prefix)
- Always update task progress when making changes
- Link code changes to specific task IDs
- Maintain dependency chain integrity

### UI/UX Guidelines
- Follow modern design principles with proper spacing
- Implement responsive design for mobile compatibility
- Use consistent color scheme throughout application
- Provide clear feedback for user actions

### Development Workflow
- Phase 1: MCP tools take priority over UI development
- Use SQLite3 for all data persistence (no file-based storage)
- Implement GitHub integration as bidirectional sync
- Follow incremental development with working prototypes

### Error Handling
- Use structured error responses in MCP tools
- Implement proper error boundaries in React components
- Log errors with contextual information
- Provide user-friendly error messages in UI

### Documentation
- Maintain up-to-date API documentation for MCP tools
- Document database schema changes in migrations
- Keep README.md current with setup instructions
- Document any breaking changes in CHANGELOG.md

## Technology Stack Constraints
- **Backend**: Node.js 18+, TypeScript 5+, SQLite3
- **Frontend**: React 18, shadcn-ui, TanStack Router
- **Build Tools**: Vite for frontend, tsc for backend
- **Package Manager**: bun (preferred), fallback to npm only when necessary
- **Deployment**: Docker containerization for production

## Package Management Rules
- **Always use bun instead of npm where possible** for faster performance
- Use `bun install` instead of `npm install`
- Use `bun run` instead of `npm run` for scripts
- Use `bun add` instead of `npm install <package>`
- Only fallback to npm if bun compatibility issues arise