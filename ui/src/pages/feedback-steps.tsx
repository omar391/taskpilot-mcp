import { useState, useEffect } from 'react'
import { useParams } from '@tanstack/react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FeedbackEditor } from '@/components/feedback-editor'
import { WorkspaceRulesDisplay } from '@/components/workspace-rules-display'
import { PageHeader } from '@/components/page-header'
import { SectionWithContent } from '@/components/ui/section-with-content'
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
  const [workspaces, setWorkspaces] = useState<WorkspaceMetadata[]>([])
  const [rulesExpanded, setRulesExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load feedback steps from API
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      setError(null)
      
      try {
        // Load workspaces
        const workspacesResponse = await apiClient.getWorkspaces()
        if (workspacesResponse.error) {
          throw new Error(workspacesResponse.error)
        }
        setWorkspaces(workspacesResponse.data.workspaces)

        // Load feedback steps
        const feedbackStepsResponse = await apiClient.getFeedbackSteps(workspaceId)
        if (feedbackStepsResponse.error) {
          throw new Error(feedbackStepsResponse.error)
        }
        
        // Safely handle the case where data or feedbackSteps might be undefined
        const allSteps = feedbackStepsResponse.data?.feedbackSteps || []
        setGlobalSteps(Array.isArray(allSteps) ? allSteps.filter(step => step?.is_global) : [])
        setWorkspaceSteps(Array.isArray(allSteps) ? allSteps.filter(step => step && !step.is_global && step.workspace_id === workspaceId) : [])

        // Mock workspace rules for now (no API endpoint yet)
        const mockWorkspaceRules: WorkspaceRule[] = [
          {
            id: 'rule_1',
            category: 'coding_standards',
            type: 'always',
            content: 'Use TypeScript strict mode with proper type annotations',
            confidence: 0.95,
            created_at: new Date().toISOString()
          },
          {
            id: 'rule_2', 
            category: 'testing',
            type: 'remember',
            content: 'Write unit tests for all public methods and API endpoints',
            confidence: 0.88,
            created_at: new Date().toISOString()
          }
        ]
        setWorkspaceRules(mockWorkspaceRules)

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load feedback steps')
      } finally {
        setLoading(false)
      }
    }

    loadData()

    // Set up real-time updates via SSE
    const unsubscribeFeedbackStepUpdated = apiClient.onSSEEvent('feedback-step.updated', (event) => {
      const updatedStep = event.data.feedbackStep
      if (updatedStep.is_global) {
        setGlobalSteps(prev => prev.map(step => 
          step.id === updatedStep.id ? updatedStep : step
        ))
      } else {
        setWorkspaceSteps(prev => prev.map(step => 
          step.id === updatedStep.id ? updatedStep : step
        ))
      }
    })

    const unsubscribeFeedbackStepCreated = apiClient.onSSEEvent('feedback-step.created', (event) => {
      const newStep = event.data.feedbackStep
      if (newStep.is_global) {
        setGlobalSteps(prev => [...prev, newStep])
      } else if (newStep.workspace_id === workspaceId) {
        setWorkspaceSteps(prev => [...prev, newStep])
      }
    })

    return () => {
      unsubscribeFeedbackStepUpdated()
      unsubscribeFeedbackStepCreated()
    }
  }, [workspaceId])

  const currentWorkspace = workspaces.find(w => w.id === workspaceId)

  if (loading) {
    return (
      <div className="space-y-8">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-3xl bg-muted animate-pulse" />
            <div>
              <div className="h-10 w-48 bg-muted animate-pulse rounded mb-2" />
              <div className="h-5 w-64 bg-muted animate-pulse rounded" />
            </div>
          </div>
          <div className="h-9 w-32 bg-muted animate-pulse rounded-xl" />
        </div>
        
        {/* Content Skeleton */}
        <div className="modern-card">
          <div className="p-6 space-y-4">
            <div className="h-6 w-48 bg-muted animate-pulse rounded" />
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-xl">
              <span className="text-3xl">💬</span>
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-500 to-blue-600 bg-clip-text text-transparent">
                Feedback Steps
              </h1>
              <p className="text-muted-foreground text-lg">
                Manage AI interaction feedback templates
              </p>
            </div>
          </div>
        </div>

        <div className="modern-card">
          <div className="p-6 text-center">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
              <MessageSquare size={24} className="text-red-600 dark:text-red-400" />
            </div>
            <h3 className="font-medium mb-2">Failed to Load Feedback Steps</h3>
            <p className="text-muted-foreground text-sm mb-4">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-medium hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  const handleCloneStep = (step: FeedbackStep) => {
    // Clone directly to current workspace 
    if (workspaceId) {
      handleCloneToWorkspace(step.id, workspaceId)
    }
  }

  const handleCloneToWorkspace = async (stepId: string, targetWorkspaceId: string) => {
    const stepToClone = globalSteps.find(s => s.id === stepId)
    if (!stepToClone) return

    // Create new workspace step
    const clonedStep: FeedbackStep = {
      ...stepToClone,
      id: `ws_${Date.now()}`,
      is_global: false,
      workspace_id: targetWorkspaceId
    }

    setWorkspaceSteps(prev => [...prev, clonedStep])
  }

  const handleUpdateWorkspaceStep = (stepId: string, updates: Partial<FeedbackStep>) => {
    setWorkspaceSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, ...updates } : step
    ))
  }

  const currentWorkspaceSteps = workspaceSteps.filter(
    step => step.workspace_id === workspaceId
  )

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <PageHeader
        workspaceName={currentWorkspace?.name}
        workspacePath={currentWorkspace?.path}
        title="Feedback Steps"
        description="Manage AI interaction feedback templates"
        icon={<MessageSquare size={32} className="text-white" />}
      />

      {/* Modern Tabs */}
      <Tabs defaultValue="global" className="w-full">
        <TabsList className="grid w-full grid-cols-2 rounded-2xl p-1 bg-white dark:bg-gray-800 h-12 mb-8 shadow-lg">
          <TabsTrigger 
            value="global" 
            className="flex items-center gap-2 rounded-xl text-gray-600 dark:text-gray-300 data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200 hover:bg-blue-100 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 text-sm font-medium"
          >
            <Globe size={16} className="flex-shrink-0" />
            <span className="hidden sm:inline">Global ({globalSteps.length})</span>
            <span className="sm:hidden">Global</span>
          </TabsTrigger>
          <TabsTrigger 
            value="workspace" 
            className="flex items-center gap-2 rounded-xl text-gray-600 dark:text-gray-300 data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200 hover:bg-blue-100 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 text-sm font-medium"
          >
            <Building size={16} className="flex-shrink-0" />
            <span className="hidden sm:inline">Workspace ({currentWorkspaceSteps.length})</span>
            <span className="sm:hidden">Work</span>
          </TabsTrigger>
        </TabsList>

        {/* Global Tab */}
        <TabsContent value="global" className="space-y-6">
          <SectionWithContent
            icon={<Globe className="h-5 w-5" />}
            iconBgColor="bg-blue-100"
            iconTextColor="text-blue-600"
            title="Global Feedback Steps"
            description="Read-only templates available across all workspaces"
            hasContent={globalSteps.length > 0}
            emptyStateIcon={<Globe className="h-12 w-12" />}
            emptyStateTitle="No global feedback steps"
            emptyStateDescription="Global feedback steps will appear here when available."
          >
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
          </SectionWithContent>
        </TabsContent>

        {/* Workspace Tab */}
        <TabsContent value="workspace" className="space-y-6">
          {/* Workspace Rules Display */}
          <WorkspaceRulesDisplay
            rules={workspaceRules}
            workspaceName={currentWorkspace?.name || 'Unknown Workspace'}
            lastUpdated={new Date().toISOString()}
            isExpanded={rulesExpanded}
            onToggleExpanded={() => setRulesExpanded(!rulesExpanded)}
          />

          <SectionWithContent
            icon={<Building className="h-5 w-5" />}
            iconBgColor="bg-purple-100"
            iconTextColor="text-purple-600"
            title="Workspace Feedback Steps"
            description="Custom templates for this workspace"
            hasContent={currentWorkspaceSteps.length > 0}
            emptyStateIcon={<MessageSquare className="h-12 w-12" />}
            emptyStateTitle="No custom feedback steps yet"
            emptyStateDescription="Clone global steps to customize for your workspace needs."
            actions={
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 shadow-md flex items-center gap-2">
                <Plus size={16} />
                New Step
              </button>
            }
          >
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
          </SectionWithContent>
        </TabsContent>
      </Tabs>
    </div>
  )
}
