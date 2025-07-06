import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToolFlowCard } from '@/components/tool-flow-card'
import { CloneToWorkspace } from '@/components/clone-to-workspace'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Tool Flows</h1>
        <p className="text-muted-foreground">
          Configure workflow sequences and automation rules
        </p>
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
                Global Tool Flows
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                These are read-only global configurations. Click "Clone" to customize them for your workspace.
              </p>
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Workspace Tab */}
        <TabsContent value="workspace" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Building size={20} />
                  Workspace Tool Flows
                </CardTitle>
                <Button size="sm" variant="outline">
                  <Plus size={16} className="mr-1" />
                  New Flow
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

              {currentWorkspaceFlows.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    No custom flows for this workspace yet.
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Clone global flows to customize them for your specific needs.
                  </p>
                  <Button variant="outline" onClick={() => {
                    const globalTab = document.querySelector('[value="global"]') as HTMLButtonElement
                    globalTab?.click()
                  }}>
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
