import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FeedbackEditor } from '@/components/feedback-editor'
import { WorkspaceRulesDisplay } from '@/components/workspace-rules-display'
import { CloneToWorkspace } from '@/components/clone-to-workspace'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Globe, Building, MessageSquare } from 'lucide-react'

interface FeedbackStep {
  id: string
  name: string
  description: string
  template: string
  is_global: boolean
  workspace_id?: string
  variables?: string[]
}

interface WorkspaceRule {
  id: string
  category: string
  type: 'never' | 'always' | 'remember' | 'don\'t' | 'preference'
  content: string
  confidence: number
  created_at: string
}

interface Workspace {
  id: string
  name: string
  path: string
}

export function FeedbackStepsPage() {
  const [globalSteps, setGlobalSteps] = useState<FeedbackStep[]>([])
  const [workspaceSteps, setWorkspaceSteps] = useState<FeedbackStep[]>([])
  const [workspaceRules, setWorkspaceRules] = useState<WorkspaceRule[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('')
  const [showCloneDialog, setShowCloneDialog] = useState(false)
  const [stepToClone, setStepToClone] = useState<FeedbackStep | null>(null)
  const [rulesExpanded, setRulesExpanded] = useState(false)

  // Mock data for development - will be replaced with real API calls
  useEffect(() => {
    const mockGlobalSteps: FeedbackStep[] = [
      {
        id: 'analytical_validation',
        name: 'Analytical Validation',
        description: 'Apply the 6-step analytical thinking framework to validate requirements and decisions',
        template: `# Analytical Validation for {{context.workspace_name}}

Apply the Analytical Thinking Framework:

1. **Logical Consistency**: Evaluate {{context.user_feedback}} for internal coherence
2. **Evidence Quality**: Assess supporting data reliability  
3. **Hidden Assumptions**: Identify unstated premises
4. **Cognitive Biases**: Detect emotional reasoning or confirmation bias
5. **Causal Relationships**: Verify claimed cause-and-effect relationships
6. **Alternative Perspectives**: Consider competing explanations

**Validation Result**: {{context.validation_result}}
**Analysis Time**: {{context.analysis_time}}`,
        is_global: true,
        variables: ['workspace_name', 'user_feedback', 'validation_result', 'analysis_time']
      },
      {
        id: 'task_focus_context',
        name: 'Task Focus Context',
        description: 'Provide comprehensive context and implementation guidance when focusing on a task',
        template: `# Task Focus: {{context.task_title}}

**Task ID**: {{context.task_id}}
**Current Status**: In-Progress (auto-updated from Backlog)

## Implementation Guidance
{{context.task_description}}

## Connected Files
{{context.connected_files}}

## Dependencies & Blockers
{{context.dependencies_info}}

**Focus Time**: {{context.analysis_time}}
Ready to implement. Proceed with systematic approach.`,
        is_global: true,
        variables: ['task_title', 'task_id', 'task_description', 'connected_files', 'dependencies_info', 'analysis_time']
      },
      {
        id: 'github_integration_result',
        name: 'GitHub Integration Result',
        description: 'Report results of GitHub integration actions and sync operations',
        template: `# GitHub Integration for {{context.workspace_name}}

**Action**: {{context.github_action}}
**Status**: {{context.operation_status}}

## Results
{{context.integration_details}}

{{context.sync_summary}}

**Operation Time**: {{context.analysis_time}}`,
        is_global: true,
        variables: ['workspace_name', 'github_action', 'operation_status', 'integration_details', 'sync_summary', 'analysis_time']
      }
    ]

    const mockWorkspaceSteps: FeedbackStep[] = [
      {
        id: 'workspace_rules',
        name: 'Workspace Rules',
        description: 'Dynamic workspace-specific rules and guidelines automatically updated from user interactions',
        template: `# Workspace Rules for {{context.workspace_name}}

## Coding Standards
- Always use const or let instead of var for variable declarations
- Prefer interfaces over types for object shapes
- Use async/await over Promise chains

## Testing Requirements  
- Remember to run unit tests after each task completion
- Don't commit code without proper test coverage

## File Management
- Never create files exceeding 300 lines without splitting
- Always update connected_files list when modifying tasks

**Last Updated**: {{context.analysis_time}}
**Active Rules**: {{context.rule_count}}`,
        is_global: false,
        workspace_id: 'ws_001',
        variables: ['workspace_name', 'analysis_time', 'rule_count']
      }
    ]

    const mockWorkspaceRules: WorkspaceRule[] = [
      {
        id: 'rule_001',
        category: 'coding_standards',
        type: 'never',
        content: 'Never use var, always use const or let for variable declarations',
        confidence: 0.95,
        created_at: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: 'rule_002',
        category: 'testing',
        type: 'always',
        content: 'Always run unit tests after task completion before marking as done',
        confidence: 0.90,
        created_at: new Date(Date.now() - 172800000).toISOString()
      },
      {
        id: 'rule_003',
        category: 'file_management',
        type: 'remember',
        content: 'Remember to update connected_files list when modifying tasks',
        confidence: 0.85,
        created_at: new Date(Date.now() - 259200000).toISOString()
      },
      {
        id: 'rule_004',
        category: 'api_design',
        type: 'preference',
        content: 'Prefer REST API patterns over GraphQL for simple CRUD operations',
        confidence: 0.75,
        created_at: new Date(Date.now() - 345600000).toISOString()
      }
    ]

    const mockWorkspaces: Workspace[] = [
      {
        id: 'ws_001',
        name: 'TaskPilot MCP',
        path: '/Volumes/Projects/business/AstronLab/omar391/taskpilot-mcp'
      },
      {
        id: 'ws_002',
        name: 'Demo Project',
        path: '/Users/demo/projects/demo-app'
      }
    ]

    setGlobalSteps(mockGlobalSteps)
    setWorkspaceSteps(mockWorkspaceSteps)
    setWorkspaceRules(mockWorkspaceRules)
    setWorkspaces(mockWorkspaces)
    if (mockWorkspaces.length > 0) {
      setSelectedWorkspace(mockWorkspaces[0].id)
    }
  }, [])

  const handleCloneStep = (step: FeedbackStep) => {
    setStepToClone(step)
    setShowCloneDialog(true)
  }

  const handleCloneToWorkspace = async (stepId: string, workspaceId: string) => {
    const stepToClone = globalSteps.find(s => s.id === stepId)
    if (!stepToClone) return

    // Create new workspace step
    const clonedStep: FeedbackStep = {
      ...stepToClone,
      id: `ws_${Date.now()}`,
      is_global: false,
      workspace_id: workspaceId
    }

    setWorkspaceSteps(prev => [...prev, clonedStep])
  }

  const handleUpdateWorkspaceStep = (stepId: string, updates: Partial<FeedbackStep>) => {
    setWorkspaceSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, ...updates } : step
    ))
  }

  const currentWorkspaceSteps = workspaceSteps.filter(
    step => step.workspace_id === selectedWorkspace
  )

  const currentWorkspace = workspaces.find(w => w.id === selectedWorkspace)
  const workspaceRulesStep = currentWorkspaceSteps.find(step => step.name === 'Workspace Rules')

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Feedback Steps</h1>
        <p className="text-muted-foreground">
          Manage instruction templates and dynamic rules
        </p>
      </div>

      {/* Clone Dialog */}
      {showCloneDialog && stepToClone && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md">
            <CloneToWorkspace
              flow={stepToClone as any} // Type compatibility
              workspaces={workspaces}
              onClone={handleCloneToWorkspace}
              onClose={() => {
                setShowCloneDialog(false)
                setStepToClone(null)
              }}
            />
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="global" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="global" className="flex items-center gap-2">
            <Globe size={16} />
            Global
          </TabsTrigger>
          <TabsTrigger value="workspace" className="flex items-center gap-2">
            <Building size={16} />
            Workspace
          </TabsTrigger>
        </TabsList>

        {/* Global Tab */}
        <TabsContent value="global" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe size={20} />
                Global Feedback Steps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                These are read-only global instruction templates. Click "Clone" to customize them for your workspace.
              </p>
              <div className="space-y-4">
                {globalSteps.map((step) => (
                  <FeedbackEditor
                    key={step.id}
                    feedbackStep={step}
                    isEditable={false}
                    onClone={handleCloneStep}
                    showVariableHelper={true}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Workspace Tab */}
        <TabsContent value="workspace" className="space-y-4">
          {/* Workspace Rules Display */}
          {workspaceRulesStep && (
            <WorkspaceRulesDisplay
              rules={workspaceRules}
              workspaceName={currentWorkspace?.name || 'Unknown Workspace'}
              lastUpdated={new Date().toISOString()}
              isExpanded={rulesExpanded}
              onToggleExpanded={() => setRulesExpanded(!rulesExpanded)}
            />
          )}

          {/* Workspace Feedback Steps */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Building size={20} />
                  Workspace Feedback Steps
                </CardTitle>
                <Button size="sm" variant="outline">
                  <Plus size={16} className="mr-1" />
                  New Step
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {currentWorkspace && (
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground">
                    <strong>Current Workspace:</strong> {currentWorkspace.name}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {currentWorkspace.path}
                  </p>
                </div>
              )}

              {currentWorkspaceSteps.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground mb-4">
                    No custom feedback steps for this workspace yet.
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Clone global steps to customize instruction templates for your specific needs.
                  </p>
                  <Button variant="outline" onClick={() => {
                    const globalTab = document.querySelector('[value="global"]') as HTMLButtonElement
                    globalTab?.click()
                  }}>
                    Browse Global Steps
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {currentWorkspaceSteps.map((step) => (
                    <FeedbackEditor
                      key={step.id}
                      feedbackStep={step}
                      isEditable={true}
                      onSave={(updates) => handleUpdateWorkspaceStep(step.id, updates)}
                      showVariableHelper={true}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
