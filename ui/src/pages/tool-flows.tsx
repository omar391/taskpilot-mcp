import { useState, useEffect } from 'react'
import { useParams } from '@tanstack/react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToolFlowCard } from '@/components/tool-flow-card'
import { Button } from '@/components/ui/button'
import { Plus, Globe, Building, Settings } from 'lucide-react'
import { apiClient, type ToolFlow, type FeedbackStep, type WorkspaceMetadata } from '@/lib/api-client'

export function ToolFlowsPage() {
  const params = useParams({ from: '/workspace/$workspaceId/tool-flows' })
  const workspaceId = params.workspaceId
  
  const [globalFlows, setGlobalFlows] = useState<ToolFlow[]>([])
  const [workspaceFlows, setWorkspaceFlows] = useState<ToolFlow[]>([])
  const [feedbackSteps, setFeedbackSteps] = useState<FeedbackStep[]>([])
  const [workspaces, setWorkspaces] = useState<WorkspaceMetadata[]>([])
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>(workspaceId)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  // Load data from API
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      setError(null)
      
      try {
        // Load workspaces first
        const workspacesResponse = await apiClient.getWorkspaces()
        if (workspacesResponse.error) {
          throw new Error(workspacesResponse.error)
        }
        setWorkspaces(workspacesResponse.data.workspaces)

        // Load tool flows for current workspace
        const toolFlowsResponse = await apiClient.getToolFlows(workspaceId)
        if (toolFlowsResponse.error) {
          throw new Error(toolFlowsResponse.error)
        }
        
        // Separate global and workspace-specific flows
        const allFlows = toolFlowsResponse.data.toolFlows
        setGlobalFlows(allFlows.filter(flow => flow.is_global))
        setWorkspaceFlows(allFlows.filter(flow => !flow.is_global))

        // Load feedback steps for current workspace
        const feedbackResponse = await apiClient.getFeedbackSteps(workspaceId)
        if (feedbackResponse.error) {
          throw new Error(feedbackResponse.error)
        }
        setFeedbackSteps(feedbackResponse.data.feedbackSteps)

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [workspaceId])

  const handleCloneFlow = (flow: ToolFlow) => {
    // Directly clone to current workspace without dialog
    const clonedFlow: ToolFlow = {
      ...flow,
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
      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="h-12 w-12 mx-auto rounded-full border-4 border-gray-200 border-t-blue-500 animate-spin mb-4" />
          <p className="text-gray-600">Loading tool flows...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-center py-12">
          <div className="h-12 w-12 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h3 className="text-lg font-semibold text-red-600 mb-3">Failed to Load Tool Flows</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      )}

      {/* Content - only show when not loading and no error */}
      {!loading && !error && (
        <>
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

      {/* Workspace Context */}
      {currentWorkspace && (
        <div className="modern-card">
          <div className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Settings size={14} className="text-primary" />
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

      {/* Enhanced Tab Design with Improved Mobile Support */}
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
        </>
      )}
    </div>
  )
}
