import React, { useState, useEffect } from 'react'
import { useParams } from '@tanstack/react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToolFlowCard } from '@/components/tool-flow-card'
import { Button } from '@/components/ui/button'
import { Plus, Globe, Building } from 'lucide-react'
import { apiClient, type ToolFlow } from '@/lib/api-client'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback: React.ReactNode
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, { hasError: boolean }> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    console.error('Error in ErrorBoundary:', error)
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error in ToolFlowsPage:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

export function ToolFlowsPage() {
  const params = useParams({ from: '/workspace/$workspaceId/tool-flows' })
  const workspaceId = params.workspaceId
  
  const [globalFlows, setGlobalFlows] = useState<ToolFlow[]>([])
  const [workspaceFlows, setWorkspaceFlows] = useState<ToolFlow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [availableTools, setAvailableTools] = useState<string[]>([])
  const [feedbackSteps, setFeedbackSteps] = useState<Record<string, any[]>>({})
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false)

  // Handle clone flow
  const handleCloneFlow = async (flow: ToolFlow) => {
    try {
      const response = await apiClient.cloneToolFlow(workspaceId, flow.id)
      if (response.error || !response.data?.toolFlow) {
        throw new Error(response.error || 'Failed to clone flow')
      }
      setWorkspaceFlows(prev => [...prev, response.data.toolFlow])
      // TODO: Replace with toast notification
      console.log('Flow cloned successfully')
    } catch (err) {
      console.error('Failed to clone flow:', err)
      setError('Failed to clone flow. Please try again.')
    }
  }
  
  // Available tools are now included in the tool flows response

  // Fetch feedback steps for a flow
  const fetchFeedbackSteps = async (flowId: string) => {
    try {
      setIsLoadingFeedback(true)
      const response = await apiClient.getGlobalToolFlowFeedbackSteps(workspaceId)
      if (response.error || !response.data?.feedbackStepsByFlow) {
        throw new Error(response.error || 'Failed to fetch feedback steps')
      }
      const steps = response.data.feedbackStepsByFlow[flowId] || []
      setFeedbackSteps(prev => ({
        ...prev,
        [flowId]: steps
      }))
      return steps
    } catch (err) {
      console.error(`Failed to fetch feedback steps for flow ${flowId}:`, err)
      return []
    } finally {
      setIsLoadingFeedback(false)
    }
  }

  // Handle flow updates
  const handleUpdateFlow = async (flowId: string, updates: Partial<ToolFlow>) => {
    try {
      setLoading(true)
      // TODO: Replace with actual API call when available
      // const response = await apiClient.updateToolFlow(workspaceId, flowId, updates)
      await new Promise(resolve => setTimeout(resolve, 500)) // Simulate API delay
      
      // Update local state
      setGlobalFlows(prev => 
        prev.map(flow => 
          flow.id === flowId ? { ...flow, ...updates } : flow
        )
      )
      setWorkspaceFlows(prev => 
        prev.map(flow => 
          flow.id === flowId ? { ...flow, ...updates } : flow
        )
      )
    } catch (err) {
      console.error('Failed to update flow:', err)
      setError('Failed to update tool flow. Please try again.')
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Handle flow deletion
  const handleDeleteFlow = async (flowId: string) => {
    if (!confirm('Are you sure you want to delete this tool flow? This action cannot be undone.')) {
      return
    }
    try {
      setLoading(true)
      const response = await apiClient.deleteToolFlow(workspaceId, flowId)
      if (response.error || !response.data?.success) {
        throw new Error(response.error || 'Failed to delete flow')
      }
      setGlobalFlows(prev => prev.filter(flow => flow.id !== flowId))
      setWorkspaceFlows(prev => prev.filter(flow => flow.id !== flowId))
    } catch (err) {
      console.error('Failed to delete flow:', err)
      setError('Failed to delete tool flow. Please try again.')
      throw err
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const loadToolFlows = async () => {
      try {
        setLoading(true)
        setError(null)
        
        console.log('Fetching tool flows for workspace:', workspaceId)
        const response = await apiClient.getToolFlows(workspaceId)
        console.log('API Response:', response)
        
        if (response.error) {
          throw new Error(response.error)
        }

        // The API now returns separate arrays for global and workspace flows
        const { global_flows = [], workspace_flows = [], available_tools = [] } = response.data || {};
        
        console.log('Global flows from API:', global_flows);
        console.log('Workspace flows from API:', workspace_flows);
        console.log('Available tools from API:', available_tools);
        
        // Update available tools from the API response
        setAvailableTools(available_tools);
        
        // Set the flows directly from the API response
        setGlobalFlows(global_flows);
        setWorkspaceFlows(workspace_flows);
        
      } catch (err) {
        console.error('Error loading tool flows:', err)
        setError(err instanceof Error ? err.message : 'Failed to load tool flows')
      } finally {
        setLoading(false)
      }
    }

    loadToolFlows()
  }, [workspaceId])

  if (loading || isLoadingFeedback) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
        <span className="ml-4 text-gray-600">Loading tool flows...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <div className="flex justify-between items-start">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <button
                  type="button"
                  className="ml-4 rounded-md bg-red-50 px-2 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100"
                  onClick={() => setError(null)}
                  aria-label="Dismiss error"
                >
                  Dismiss
                </button>
              </div>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-24">
      <Tabs defaultValue="global" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-2 rounded-2xl p-1 bg-muted/30 h-12">
          <TabsTrigger 
            value="global" 
            className="flex items-center gap-2 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200 hover:bg-background/50 px-3 py-2 text-sm font-medium"
          >
            <Globe className="h-4 w-4" />
            Global Flows
          </TabsTrigger>
          <TabsTrigger 
            value="workspace" 
            className="flex items-center gap-2 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200 hover:bg-background/50 px-3 py-2 text-sm font-medium"
          >
            <Building className="h-4 w-4" />
            Workspace Flows
          </TabsTrigger>
        </TabsList>

        <TabsContent value="global" className="mt-6">
          <div className="space-y-4">
            {globalFlows.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No global tool flows found
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {globalFlows.map((flow) => (
                  <ToolFlowCard 
                    key={flow.id}
                    flow={flow}
                    feedbackSteps={feedbackSteps[flow.id] || []}
                    availableTools={availableTools}
                    isEditable={!flow.is_global}
                    onUpdate={handleUpdateFlow}
                    onDelete={handleDeleteFlow}
                    onClone={!flow.is_global ? undefined : handleCloneFlow}
                    onEdit={() => {
                      // Load feedback steps when editing
                      if (!feedbackSteps[flow.id]) {
                        fetchFeedbackSteps(flow.id)
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="workspace" className="mt-6">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Workspace Flow
              </Button>
            </div>
            
            {workspaceFlows.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No workspace tool flows found
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {workspaceFlows.map((flow) => (
                  <ToolFlowCard 
                    key={flow.id}
                    flow={flow}
                    feedbackSteps={feedbackSteps[flow.id] || []}
                    availableTools={availableTools}
                    isEditable={!flow.is_global}
                    onUpdate={handleUpdateFlow}
                    onDelete={handleDeleteFlow}
                    onClone={!flow.is_global ? undefined : handleCloneFlow}
                    onEdit={() => {
                      // Load feedback steps when editing
                      if (!feedbackSteps[flow.id]) {
                        fetchFeedbackSteps(flow.id)
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function ToolFlowsPageWithBoundary() {
  return (
    <ErrorBoundary
      fallback={
        <div className="p-6 max-w-4xl mx-auto">
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Something went wrong</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>An unexpected error occurred. Please try again.</p>
                </div>
                <div className="mt-4">
                  <button
                    type="button"
                    className="rounded-md bg-red-50 px-2 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100"
                    onClick={() => window.location.reload()}
                  >
                    Reload page
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <ToolFlowsPage />
    </ErrorBoundary>
  )
}
