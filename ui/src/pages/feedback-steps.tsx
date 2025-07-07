import { useState, useEffect } from 'react'
import { useParams } from '@tanstack/react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FeedbackEditor } from '@/components/feedback-editor'
import { WorkspaceRulesDisplay } from '@/components/workspace-rules-display'
import { CloneToWorkspace } from '@/components/clone-to-workspace'
import { Button } from '@/components/ui/button'
import { Plus, Globe, Building, MessageSquare } from 'lucide-react'
import { apiClient, type FeedbackStep, type WorkspaceMetadata } from '@/lib/api-client'

interface WorkspaceRule {
  id: string
  category: string
  type: 'never' | 'always' | 'remember' | 'don\'t' | 'preference'
  content: string
  confidence: number
  created_at: string
}

export function FeedbackStepsPage() {
  const params = useParams({ from: '/workspace/$workspaceId/feedback-steps' })
  const workspaceId = params.workspaceId
  
  const [globalSteps, setGlobalSteps] = useState<FeedbackStep[]>([])
  const [workspaceSteps, setWorkspaceSteps] = useState<FeedbackStep[]>([])
  const [workspaceRules, setWorkspaceRules] = useState<WorkspaceRule[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>(workspaceId)
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
      // Remove the "Workspace Rules" feedback step since workspace rules
      // should be a separate auto-evolving system, not feedback steps
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
    // Clone directly to current workspace instead of showing dialog
    if (selectedWorkspace) {
      handleCloneToWorkspace(step.id, selectedWorkspace)
    } else {
      // Fallback to dialog if no workspace selected
      setStepToClone(step)
      setShowCloneDialog(true)
    }
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

  return (
    <div className="space-y-8">
      {/* Modern Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-xl">
            <span className="text-3xl">💬</span>
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-green-500 to-green-600 bg-clip-text text-transparent">
              Feedback Steps
            </h1>
            <p className="text-muted-foreground text-lg">
              Manage instruction templates and dynamic rules
            </p>
          </div>
        </div>
      </div>

      {/* Workspace Context */}
      {currentWorkspace && (
        <div className="modern-card">
          <div className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <MessageSquare size={14} className="text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">{currentWorkspace.name}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">
                  {currentWorkspace.path}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Modern Tabs with Enhanced Mobile Support */}
      <Tabs defaultValue="global" className="w-full">
        <TabsList className="grid w-full grid-cols-2 rounded-2xl p-1 bg-muted/30 h-12">
          <TabsTrigger 
            value="global" 
            className="flex items-center gap-2 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200 hover:bg-background/50 px-3 py-2 text-sm font-medium"
          >
            <Globe size={16} className="flex-shrink-0" />
            <span className="hidden sm:inline">Global</span>
            <span className="sm:hidden">Global</span>
          </TabsTrigger>
          <TabsTrigger 
            value="workspace" 
            className="flex items-center gap-2 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200 hover:bg-background/50 px-3 py-2 text-sm font-medium"
          >
            <Building size={16} className="flex-shrink-0" />
            <span className="hidden sm:inline">Workspace</span>
            <span className="sm:hidden">Work</span>
          </TabsTrigger>
        </TabsList>

        {/* Global Tab */}
        <TabsContent value="global" className="space-y-4 mt-6">
          <div className="modern-card">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Globe size={20} className="text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Global Feedback Steps</h3>
                  <p className="text-sm text-muted-foreground">
                    Read-only instruction templates. Clone to customize for your workspace.
                  </p>
                </div>
              </div>
              
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
            </div>
          </div>
        </TabsContent>

        {/* Workspace Tab */}
        <TabsContent value="workspace" className="space-y-4 mt-6">
          {/* Workspace Rules Display - Always show for workspace context */}
          <WorkspaceRulesDisplay
            rules={workspaceRules}
            workspaceName={currentWorkspace?.name || 'Unknown Workspace'}
            lastUpdated={new Date().toISOString()}
            isExpanded={rulesExpanded}
            onToggleExpanded={() => setRulesExpanded(!rulesExpanded)}
          />

          {/* Workspace Feedback Steps */}
          <div className="modern-card">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                    <Building size={20} className="text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Workspace Feedback Steps</h3>
                    <p className="text-sm text-muted-foreground">
                      Custom templates for your specific workspace
                    </p>
                  </div>
                </div>
                <Button size="sm" className="rounded-xl shadow-sm">
                  <Plus size={16} className="mr-2" />
                  New Step
                </Button>
              </div>
              
              {currentWorkspace && (
                <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building size={14} className="text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{currentWorkspace.name}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {currentWorkspace.path}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {currentWorkspaceSteps.length === 0 ? (
                <div className="text-center py-12">
                  <div className="h-16 w-16 mx-auto rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                    <MessageSquare size={24} className="text-muted-foreground" />
                  </div>
                  <h3 className="font-medium mb-2">No custom feedback steps yet</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Clone global steps to customize instruction templates for your specific needs.
                  </p>
                  <Button 
                    variant="outline" 
                    className="rounded-xl"
                    onClick={() => {
                      const globalTab = document.querySelector('[value="global"]') as HTMLButtonElement
                      globalTab?.click()
                    }}
                  >
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
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
