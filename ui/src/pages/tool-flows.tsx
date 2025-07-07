import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToolFlowCard } from '@/components/tool-flow-card'
import { CloneToWorkspace } from '@/components/clone-to-workspace'
import { Button } from '@/components/ui/button'
import { Plus, Globe, Building } from 'lucide-react'

interface ToolFlow {
  id: string
  tool_name: string
  description: string
  feedback_step_id: string | null
  next_tool: string | null
  is_global: boolean
  workspace_id?: string
}

interface FeedbackStep {
  id: string
  name: string
  description: string
}

interface Workspace {
  id: string
  name: string
  path: string
}

export function ToolFlowsPage() {
  const [globalFlows, setGlobalFlows] = useState<ToolFlow[]>([])
  const [workspaceFlows, setWorkspaceFlows] = useState<ToolFlow[]>([])
  const [feedbackSteps, setFeedbackSteps] = useState<FeedbackStep[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('')
  const [showCloneDialog, setShowCloneDialog] = useState(false)
  const [flowToClone, setFlowToClone] = useState<ToolFlow | null>(null)

  // Available MCP tools
  const availableTools = [
    'taskpilot_start',
    'taskpilot_init', 
    'taskpilot_add',
    'taskpilot_create_task',
    'taskpilot_status',
    'taskpilot_update',
    'taskpilot_focus',
    'taskpilot_audit',
    'taskpilot_github',
    'taskpilot_rule_update',
    'taskpilot_remote_interface'
  ]

  // Mock data for development - will be replaced with real API calls
  useEffect(() => {
    const mockGlobalFlows: ToolFlow[] = [
      {
        id: 'gf_001',
        tool_name: 'taskpilot_add',
        description: 'Analytical validation workflow for new task creation',
        feedback_step_id: 'analytical_validation',
        next_tool: 'taskpilot_create_task',
        is_global: true
      },
      {
        id: 'gf_002',
        tool_name: 'taskpilot_focus',
        description: 'Task focusing with implementation guidance',
        feedback_step_id: 'task_focus_context',
        next_tool: null,
        is_global: true
      },
      {
        id: 'gf_003',
        tool_name: 'taskpilot_audit',
        description: 'Project health checking and cleanup recommendations',
        feedback_step_id: 'audit_analysis',
        next_tool: null,
        is_global: true
      }
    ]

    const mockWorkspaceFlows: ToolFlow[] = [
      {
        id: 'wf_001',
        tool_name: 'taskpilot_add',
        description: 'Custom team review workflow for task creation',
        feedback_step_id: 'team_review',
        next_tool: 'taskpilot_create_task',
        is_global: false,
        workspace_id: 'ws_001'
      }
    ]

    const mockFeedbackSteps: FeedbackStep[] = [
      {
        id: 'analytical_validation',
        name: 'Analytical Validation',
        description: 'Apply 6-step analytical thinking framework'
      },
      {
        id: 'task_focus_context',
        name: 'Task Focus Context',
        description: 'Provide implementation guidance and context'
      },
      {
        id: 'audit_analysis',
        name: 'Audit Analysis',
        description: 'Project health analysis and recommendations'
      },
      {
        id: 'team_review',
        name: 'Team Review',
        description: 'Custom team review process'
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

    setGlobalFlows(mockGlobalFlows)
    setWorkspaceFlows(mockWorkspaceFlows)
    setFeedbackSteps(mockFeedbackSteps)
    setWorkspaces(mockWorkspaces)
    if (mockWorkspaces.length > 0) {
      setSelectedWorkspace(mockWorkspaces[0].id)
    }
  }, [])

  const handleCloneFlow = (flow: ToolFlow) => {
    setFlowToClone(flow)
    setShowCloneDialog(true)
  }

  const handleCloneToWorkspace = async (flowId: string, workspaceId: string) => {
    const flowToClone = globalFlows.find(f => f.id === flowId)
    if (!flowToClone) return

    // Create new workspace flow
    const clonedFlow: ToolFlow = {
      ...flowToClone,
      id: `wf_${Date.now()}`,
      is_global: false,
      workspace_id: workspaceId
    }

    setWorkspaceFlows(prev => [...prev, clonedFlow])
  }

  const handleUpdateWorkspaceFlow = (flowId: string, updates: Partial<ToolFlow>) => {
    setWorkspaceFlows(prev => prev.map(flow => 
      flow.id === flowId ? { ...flow, ...updates } : flow
    ))
  }

  const handleDeleteWorkspaceFlow = (flowId: string) => {
    setWorkspaceFlows(prev => prev.filter(flow => flow.id !== flowId))
  }

  const currentWorkspaceFlows = workspaceFlows.filter(
    flow => flow.workspace_id === selectedWorkspace
  )

  const currentWorkspace = workspaces.find(w => w.id === selectedWorkspace)

  return (
    <div className="space-y-8">
      {/* Modern Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-xl">
            <span className="text-3xl">⚡</span>
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-500 to-blue-600 bg-clip-text text-transparent">
              Tool Flows
            </h1>
            <p className="text-muted-foreground text-lg">
              Configure workflow sequences and automation rules
            </p>
          </div>
        </div>
      </div>

      {/* Clone Dialog */}
      {showCloneDialog && flowToClone && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md">
            <CloneToWorkspace
              flow={flowToClone}
              workspaces={workspaces}
              onClone={handleCloneToWorkspace}
              onClose={() => {
                setShowCloneDialog(false)
                setFlowToClone(null)
              }}
            />
          </div>
        </div>
      )}

      {/* Modern Tabs */}
      <Tabs defaultValue="global" className="w-full">
        <TabsList className="grid w-full grid-cols-2 rounded-2xl p-1 bg-muted/30">
          <TabsTrigger 
            value="global" 
            className="flex items-center gap-2 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Globe size={16} />
            Global
          </TabsTrigger>
          <TabsTrigger 
            value="workspace" 
            className="flex items-center gap-2 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Building size={16} />
            Workspace
          </TabsTrigger>
        </TabsList>

        {/* Global Tab */}
        <TabsContent value="global" className="space-y-4 mt-6">
          <div className="modern-card">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Globe size={20} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Global Tool Flows</h3>
                  <p className="text-sm text-muted-foreground">
                    Read-only configurations. Clone to customize for your workspace.
                  </p>
                </div>
              </div>
              
              <div className="space-y-3">
                {globalFlows.map((flow) => (
                  <ToolFlowCard
                    key={flow.id}
                    flow={flow}
                    feedbackSteps={feedbackSteps}
                    availableTools={availableTools}
                    isEditable={false}
                    onClone={handleCloneFlow}
                  />
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Workspace Tab */}
        <TabsContent value="workspace" className="space-y-4 mt-6">
          <div className="modern-card">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Building size={20} className="text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Workspace Tool Flows</h3>
                    <p className="text-sm text-muted-foreground">
                      Custom configurations for your specific workspace
                    </p>
                  </div>
                </div>
                <Button size="sm" className="rounded-xl shadow-sm">
                  <Plus size={16} className="mr-2" />
                  New Flow
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

              {currentWorkspaceFlows.length === 0 ? (
                <div className="text-center py-12">
                  <div className="h-16 w-16 mx-auto rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                    <Building size={24} className="text-muted-foreground" />
                  </div>
                  <h3 className="font-medium mb-2">No custom flows yet</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Clone global flows to customize them for your specific needs.
                  </p>
                  <Button 
                    variant="outline" 
                    className="rounded-xl"
                    onClick={() => {
                      const globalTab = document.querySelector('[value="global"]') as HTMLButtonElement
                      globalTab?.click()
                    }}
                  >
                    Browse Global Flows
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {currentWorkspaceFlows.map((flow) => (
                    <ToolFlowCard
                      key={flow.id}
                      flow={flow}
                      feedbackSteps={feedbackSteps}
                      availableTools={availableTools}
                      isEditable={true}
                      onUpdate={handleUpdateWorkspaceFlow}
                      onDelete={handleDeleteWorkspaceFlow}
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
