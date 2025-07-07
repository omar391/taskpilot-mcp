# Current Tasks

# Current Tasks

## Task ID: TP-021
- **Title**: Redesign Tool Flow cards with 3-segment minimal layout
- **Description**: Simplify Tool Flow cards to show 3 key segments in a minimal card design. Reduce visual complexity while maintaining essential information display.
- **Priority**: Medium
- **Dependencies**: TP-020 ✅
- **Status**: Backlog
- **Progress**: 0%
- **Notes**: Redesign ToolFlowCard component with minimal 3-segment layout, improve information hierarchy and visual clarity.
- **Connected File List**: ui/src/components/tool-flow-card.tsx, ui/src/pages/tool-flows.tsx

## Task ID: TP-022
- **Title**: Redesign Feedback Steps cards with collapsible template data
- **Description**: Create minimal Feedback Steps cards where template data is collapsed by default and expandable on click. Improve readability and reduce visual clutter.
- **Priority**: Medium
- **Dependencies**: TP-021
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
1. **Priority**: Focus on TP-020 (workspace name headers) as next task
2. Progress through remaining UI/UX improvements sequentially
3. Each task builds upon previous improvements for cohesive user experience
