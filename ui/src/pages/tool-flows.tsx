import React, { useState, useEffect } from 'react'
import { useParams } from '@tanstack/react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToolFlowCard } from '@/components/tool-flow-card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { Globe, Building, AlertCircle, RefreshCw, Settings, Plus } from 'lucide-react'
import { apiClient, type ToolFlow, type FeedbackStep, type WorkspaceMetadata } from '@/lib/api-client'
import { tailwindClasses } from '@/lib/design-system'

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
  const [feedbackSteps, setFeedbackSteps] = useState<FeedbackStep[]>([])
  const [, setWorkspaces] = useState<WorkspaceMetadata[]>([])
  const [currentWorkspace, setCurrentWorkspace] = useState<Partial<WorkspaceMetadata> & { path: string }>({ path: 'Loading...' })

  // Load workspaces
  useEffect(() => {
    const loadWorkspaces = async () => {
      try {
        const response = await apiClient.getWorkspaces()
        if (response.error) {
          console.error('Failed to load workspaces:', response.error)
          return
        }
        setWorkspaces(response.data.workspaces)
        const workspace = response.data.workspaces.find((w: WorkspaceMetadata) => w.id === workspaceId)
        if (workspace) {
          setCurrentWorkspace(workspace)
        }
      } catch (err) {
        console.error('Error loading workspaces:', err)
      }
    }
    
    loadWorkspaces()
  }, [workspaceId])

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

  // Process feedback steps from API response
  const processFeedbackSteps = (feedbackSteps: any[]): FeedbackStep[] => {
    return feedbackSteps.map(step => ({
      id: step.id,
      name: step.name || `Feedback Step ${step.id.slice(0, 6)}`,
      description: step.description || '',
      template_content: step.template_content || '',
      variable_schema: step.variable_schema || {},
      is_global: step.is_global || false,
      ...(step.workspace_id && { workspace_id: step.workspace_id })
    }));
  }

  // Handle flow updates
  const handleUpdateFlow = async (flowId: string, updates: Partial<ToolFlow>) => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call when available
      // const response = await apiClient.updateToolFlow(workspaceId, flowId, updates)
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
      
      // Update local state
      setGlobalFlows(prev => 
        prev.map(flow => 
          flow.id === flowId ? { ...flow, ...updates } : flow
        )
      );
      setWorkspaceFlows(prev => 
        prev.map(flow => 
          flow.id === flowId ? { ...flow, ...updates } : flow
        )
      );
    } catch (err) {
      console.error('Failed to update flow:', err);
      setError('Failed to update tool flow. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  }
  
  // Handle edit flow
  const handleEditFlow = (flow: ToolFlow) => {
    // TODO: Implement edit flow
    console.log('Edit flow:', flow);
  };
  
  // Helper to get feedback step for a flow
  const getFeedbackStepForFlow = (flow: ToolFlow): FeedbackStep | null => {
    console.log('getFeedbackStepForFlow - flow:', flow);
    console.log('getFeedbackStepForFlow - available feedbackSteps:', feedbackSteps);
    
    if (!flow.feedback_step_id) {
      console.log('No feedback_step_id for flow:', flow.id);
      return null;
    }
    
    const foundStep = feedbackSteps.find(step => step.id === flow.feedback_step_id);
    console.log('Found step for flow:', { 
      flowId: flow.id, 
      feedbackStepId: flow.feedback_step_id, 
      foundStep 
    });
    
    return foundStep || null;
  };

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
    let isMounted = true;
    
    const loadToolFlows = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('Fetching tool flows for workspace:', workspaceId);
        const [flowsResponse, feedbackStepsResponse] = await Promise.all([
          apiClient.getToolFlows(workspaceId),
          apiClient.getFeedbackSteps(workspaceId)
        ]);
        
        if (!isMounted) return;
        
        if (flowsResponse.error) {
          throw new Error(flowsResponse.error);
        }

        // The API returns separate arrays for global and workspace flows
        const { global_flows = [], workspace_flows = [], available_tools = [] } = flowsResponse.data || {};
        
        console.log('Global flows from API:', global_flows);
        console.log('Workspace flows from API:', workspace_flows);
        console.log('Available tools from API:', available_tools);
        
        // Process feedback steps first to ensure they're available when rendering flows
        let feedbackStepsList: FeedbackStep[] = [];
        console.log('Raw feedback steps response:', feedbackStepsResponse);
        
        if (!feedbackStepsResponse.error && feedbackStepsResponse.data) {
          // Check if we have the new structure with global_steps and workspace_steps
          if (feedbackStepsResponse.data.global_steps || feedbackStepsResponse.data.workspace_steps) {
            console.log('Found new feedback steps structure');
            const globalSteps = feedbackStepsResponse.data.global_steps || [];
            const workspaceSteps = feedbackStepsResponse.data.workspace_steps || [];
            
            console.log('Global steps from API:', globalSteps);
            console.log('Workspace steps from API:', workspaceSteps);
            
            // Combine and process all steps
            const allSteps = [...globalSteps, ...workspaceSteps];
            feedbackStepsList = processFeedbackSteps(allSteps);
          } 
          // Fallback to old structure if available
          else if (feedbackStepsResponse.data.feedbackSteps) {
            console.log('Found old feedback steps structure');
            feedbackStepsList = processFeedbackSteps(feedbackStepsResponse.data.feedbackSteps);
          }
          
          console.log('Processed feedback steps:', feedbackStepsList);
          console.log('Feedback step IDs:', feedbackStepsList.map(s => s.id));
          
          // Find any flows that reference non-existent feedback steps
          const allFlows = [...(global_flows || []), ...(workspace_flows || [])];
          const feedbackStepIds = new Set(feedbackStepsList.map(s => s.id));
          
          allFlows.forEach(flow => {
            if (flow.feedback_step_id && !feedbackStepIds.has(flow.feedback_step_id)) {
              console.warn(`Flow ${flow.id} references non-existent feedback step:`, flow.feedback_step_id);
              console.warn('Available feedback step IDs:', Array.from(feedbackStepIds));
            } else if (flow.feedback_step_id) {
              console.log(`Flow ${flow.id} has valid feedback step:`, flow.feedback_step_id);
            }
          });
          
          setFeedbackSteps(feedbackStepsList);
        } else {
          console.error('Error fetching feedback steps:', feedbackStepsResponse.error);
        }
        
        // Update available tools from the API response
        setAvailableTools(available_tools);
        
        // Set the flows directly from the API response
        setGlobalFlows(global_flows);
        setWorkspaceFlows(workspace_flows);
        
      } catch (err) {
        if (!isMounted) return;
        console.error('Error loading tool flows:', err);
        setError(err instanceof Error ? err.message : 'Failed to load tool flows');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadToolFlows();
    
    return () => {
      isMounted = false;
    };
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)]">
        <div className="relative">
          <div className={`h-16 w-16 rounded-full ${tailwindClasses.animation.spin} border-4 border-t-primary border-r-primary/30 border-b-primary/30 border-l-primary/30`}></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <RefreshCw className="h-6 w-6 text-primary" />
          </div>
        </div>
        <h3 className="mt-4 text-lg font-medium text-foreground">Loading Tool Flows</h3>
        <p className="mt-1 text-muted-foreground">Fetching your workflow configurations...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container max-w-4xl mx-auto p-6">
        <div className={`${tailwindClasses.alert.base} ${tailwindClasses.alert.destructive}`}>
          <AlertCircle className="h-5 w-5" />
          <div className="ml-4 flex-1">
            <div className="flex items-center justify-between">
              <h3 className={`${tailwindClasses.typography.title} text-destructive`}>
                Error Loading Tool Flows
              </h3>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setError(null)}
                aria-label="Dismiss error"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="mt-2 text-sm text-destructive/90">
              <p>{error}</p>
            </div>
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
                className="border-destructive/50 text-destructive hover:bg-destructive/5"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Workspace info with defaults
  const workspaceInfo = {
    name: currentWorkspace.name || 'Workspace',
    path: currentWorkspace.path || 'Loading...'
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        workspaceName={workspaceInfo.name}
        workspacePath={workspaceInfo.path}
        title="Tool Flows"
        description="Manage and configure your tool workflows. Create custom flows between tools and feedback steps."
        icon={<Settings className="h-6 w-6 text-white" />}
      />

      {/* Redesigned Tabs */}
      <Tabs defaultValue="global" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-12 p-1 bg-white dark:bg-gray-800 rounded-xl mb-8 shadow-lg">
          <TabsTrigger 
            value="global" 
            className="flex items-center gap-2 text-sm font-medium transition-all duration-200 rounded-lg text-gray-600 dark:text-gray-300 data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-sm hover:bg-blue-100 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400"
          >
            <Globe className="h-4 w-4" />
            Global Flows
          </TabsTrigger>
          <TabsTrigger 
            value="workspace" 
            className="flex items-center gap-2 text-sm font-medium transition-all duration-200 rounded-lg text-gray-600 dark:text-gray-300 data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-sm hover:bg-blue-100 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400"
          >
            <Building className="h-4 w-4" />
            Workspace Flows
          </TabsTrigger>
        </TabsList>
          
        <TabsContent value="global" className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-2">
              <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <Globe size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Global Tool Flows
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Predefined flows available across all workspaces
                </p>
              </div>
            </div>
          
            {globalFlows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                <div className="rounded-full bg-gray-100 dark:bg-gray-700 p-4 mb-6 border border-gray-200 dark:border-gray-600 shadow-sm">
                  <Globe className="h-8 w-8 text-gray-600 dark:text-gray-400" />
                </div>
                <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Global Flows</h4>
                <p className="text-gray-600 dark:text-gray-400 text-center max-w-md mb-6">
                  There are no global tool flows available at the moment
                </p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {globalFlows.map((flow) => {
                  const flowFeedbackStep = getFeedbackStepForFlow(flow);
                  return (
                    <ToolFlowCard
                      key={flow.id}
                      flow={flow}
                      feedbackSteps={flowFeedbackStep ? [flowFeedbackStep] : []}
                      availableTools={availableTools}
                      isEditable={!flow.is_global}
                      onEdit={handleEditFlow}
                      onClone={handleCloneFlow}
                      onUpdate={handleUpdateFlow}
                      onDelete={handleDeleteFlow}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="workspace" className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-2">
              <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <Building size={20} className="text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Workspace Tool Flows
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Create and manage flows specific to this workspace
                </p>
              </div>
            </div>
            
            {workspaceFlows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                <div className="rounded-full bg-gray-100 dark:bg-gray-700 p-4 mb-6 border border-gray-200 dark:border-gray-600 shadow-sm">
                  <Building className="h-8 w-8 text-gray-600 dark:text-gray-400" />
                </div>
                <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Workspace Flows</h4>
                <p className="text-gray-600 dark:text-gray-400 text-center max-w-md mb-6">
                  Get started by creating your first workspace tool flow
                </p>
                <button className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-all duration-200 shadow-lg flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create Flow
                </button>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {workspaceFlows.map((flow) => {
                  const flowFeedbackStep = getFeedbackStepForFlow(flow);
                  return (
                    <ToolFlowCard
                      key={flow.id}
                      flow={flow}
                      feedbackSteps={flowFeedbackStep ? [flowFeedbackStep] : []}
                      availableTools={availableTools}
                      isEditable={!flow.is_global}
                      onEdit={handleEditFlow}
                      onClone={handleCloneFlow}
                      onUpdate={handleUpdateFlow}
                      onDelete={handleDeleteFlow}
                    />
                  );
                })}
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
        <div className="container max-w-4xl mx-auto p-6">
          <div className={`${tailwindClasses.alert.base} ${tailwindClasses.alert.destructive}`}>
            <AlertCircle className="h-5 w-5" />
            <div className="ml-4">
              <h3 className={`${tailwindClasses.typography.title} text-destructive`}>
                Something went wrong
              </h3>
              <div className="mt-2 text-sm text-destructive/90">
                <p>An unexpected error occurred while loading the tool flows.</p>
              </div>
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.reload()}
                  className="border-destructive/50 text-destructive hover:bg-destructive/5"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reload Page
                </Button>
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
