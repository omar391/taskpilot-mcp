# Current Tasks

## Task ID: TP-016
- **Title**: Implement conditional floating navigation (hide on home page)  
- **Description**: Modify floating navigation to only appear when users are inside workspace pages. Remove floating nav from home page but show it on workspace-specific pages (Tasks, Tool Flows, Feedback Steps).
- **Priority**: High
- **Dependencies**: TP-015 ✅ 
- **Status**: Done
- **Progress**: 100%
- **Notes**: ✅ TASK ALREADY COMPLETED as part of TP-015! 
  
  The FloatingNav component was updated in TP-015 to be conditional:
  - Returns `null` on home page (no workspace context)
  - Shows navigation only when `workspaceId` parameter exists
  - Verified working through manual testing of routes
  
  **Implementation Details:**
  - Updated `floating-nav.tsx` to check for `workspaceId` parameter
  - Conditional rendering: workspace context = show nav, home = hide nav
  - Navigation items dynamically built based on workspace context
- **Connected File List**: ui/src/components/floating-nav.tsx
- **Status**: Backlog
- **Progress**: 0%
- **Notes**: Update router structure to conditionally render FloatingNav based on current route. Home page should not show floating nav.
- **Connected File List**: ui/src/components/floating-nav.tsx, ui/src/router.tsx, ui/src/App.tsx

## Task ID: TP-017
- **Title**: Add Tasks menu with Current and History tabs
- **Description**: Create new Tasks navigation item in floating nav with two tabs: "Current" (active tasks) and "History" (completed tasks). This provides task management functionality within workspace context.
- **Priority**: High
- **Dependencies**: TP-016
- **Status**: Backlog
- **Progress**: 0%
- **Notes**: Create new Tasks page component with tab navigation, implement Current and History views, update floating navigation to include Tasks menu item.
- **Connected File List**: ui/src/pages/tasks.tsx, ui/src/components/floating-nav.tsx, ui/src/router.tsx

## Task ID: TP-018
- **Title**: Improve tab design consistency across existing pages
- **Description**: Enhance visual design of tab components used in Tool Flows and Feedback Steps pages. Current tab design needs better styling, spacing, and visual hierarchy improvements.
- **Priority**: Medium
- **Dependencies**: TP-017
- **Status**: Backlog
- **Progress**: 0%
- **Notes**: Update tab styling in existing pages to match design system, improve accessibility and mobile responsiveness.
- **Connected File List**: ui/src/pages/tool-flows.tsx, ui/src/pages/feedback-steps.tsx, ui/src/components/ui/tabs.tsx

## Task ID: TP-019
- **Title**: Remove clone popup from Tools Flow (workspace context assumed)
- **Description**: Remove clone-to-workspace dialog from Tools Flow page since users have already entered a workspace context. Simplify the interface by removing redundant workspace selection.
- **Priority**: Medium
- **Dependencies**: TP-016
- **Status**: Backlog
- **Progress**: 0%
- **Notes**: Update Tools Flow page to assume current workspace context, remove CloneToWorkspace dialog component usage, streamline user flow.
- **Connected File List**: ui/src/pages/tool-flows.tsx, ui/src/components/clone-to-workspace.tsx

## Task ID: TP-020
- **Title**: Add workspace name header to task-related pages
- **Description**: Display current workspace name in headers of Tasks, Tool Flows, and Feedback Steps pages. This provides clear context about which workspace the user is working in.
- **Priority**: Medium
- **Dependencies**: TP-016
- **Status**: Backlog
- **Progress**: 0%
- **Notes**: Add workspace context to page headers, ensure consistent workspace name display across all workspace-scoped pages.
- **Connected File List**: ui/src/pages/tasks.tsx, ui/src/pages/tool-flows.tsx, ui/src/pages/feedback-steps.tsx

## Task ID: TP-021
- **Title**: Redesign Tool Flow cards with 3-segment minimal layout
- **Description**: Simplify Tool Flow cards to show 3 key segments in a minimal card design. Reduce visual complexity while maintaining essential information display.
- **Priority**: Medium
- **Dependencies**: TP-019
- **Status**: Backlog
- **Progress**: 0%
- **Notes**: Redesign ToolFlowCard component with minimal 3-segment layout, improve information hierarchy and visual clarity.
- **Connected File List**: ui/src/components/tool-flow-card.tsx, ui/src/pages/tool-flows.tsx

## Task ID: TP-022
- **Title**: Redesign Feedback Steps cards with collapsible template data
- **Description**: Create minimal Feedback Steps cards where template data is collapsed by default and expandable on click. Improve readability and reduce visual clutter.
- **Priority**: Medium
- **Dependencies**: TP-020
- **Status**: Backlog
- **Progress**: 0%
- **Notes**: Update FeedbackEditor component to use collapsible design, implement expand/collapse functionality for template content.
- **Connected File List**: ui/src/components/feedback-editor.tsx, ui/src/pages/feedback-steps.tsx

## Task ID: TP-023
- **Title**: Add clone button to Global Feedback Steps cards
- **Description**: Implement missing clone functionality for Global Feedback Steps. Users should be able to copy global feedback steps to their workspace for customization.
- **Priority**: Medium
- **Dependencies**: TP-022
- **Status**: Backlog
- **Progress**: 0%
- **Notes**: Add clone button to global feedback step cards, implement clone-to-workspace functionality that was missing from the global feedback steps section.
- **Connected File List**: ui/src/components/feedback-editor.tsx, ui/src/pages/feedback-steps.tsx

## Task ID: TP-024
- **Title**: Investigate and resolve immutable workspace rules source
- **Description**: Research and identify the source of the immutable "Workspace Rules" section that appears in the UI. Determine if this should be global rules, workspace rules, or needs to be removed/modified according to the design document.
- **Priority**: Low
- **Dependencies**: TP-023
- **Status**: Backlog
- **Progress**: 0%
- **Notes**: Investigate WorkspaceRulesDisplay component usage, trace data flow, ensure consistency with design document that specifies Global rules are immutable and workspace rules are auto-evolving.
- **Connected File List**: ui/src/components/workspace-rules-display.tsx, ui/src/pages/feedback-steps.tsx

---

## Next Actions
1. **Priority**: Focus on TP-015 (clickable workspace cards) as foundation
2. Implement workspace-based routing structure
3. Progress through tasks sequentially respecting dependencies
4. Each task can be completed and tested independently
