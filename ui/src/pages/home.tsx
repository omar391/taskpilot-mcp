import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Link } from '@tanstack/react-router'
import { Folder } from 'lucide-react'
import { tailwindClasses, designSystem } from '@/lib/design-system'
import { apiClient, type WorkspaceMetadata } from '@/lib/api-client'
import { GettingStarted } from '@/components/getting-started'
import { ConnectionStatus } from '@/components/connection-status'

export function HomePage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error' | 'connecting'>('connecting')

  // Load workspaces from API
  useEffect(() => {
    const loadWorkspaces = async () => {
      setLoading(true)
      setError(null)
      setConnectionStatus('connecting')
      
      try {
        const response = await apiClient.getWorkspaces()
        
        if (response.error) {
          setError(response.error)
          setConnectionStatus('error')
        } else {
          setWorkspaces(response.data.workspaces)
          setConnectionStatus('connected')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load workspaces')
        setConnectionStatus('error')
      } finally {
        setLoading(false)
      }
    }

    loadWorkspaces()

    // Set up real-time updates via SSE
    const unsubscribeWorkspaceUpdates = apiClient.onSSEEvent('workspace.status_changed', (event) => {
      setWorkspaces(prev => {
        const workspaceId = event.data.workspaceId
        return prev.map(ws => 
          ws.id === workspaceId 
            ? { ...ws, ...event.data.changes }
            : ws
        )
      })
    })

    return () => {
      unsubscribeWorkspaceUpdates()
    }
  }, [])



  
  const totalTasks = workspaces.reduce((sum, ws) => sum + (ws.task_count || 0), 0)
  
  const activeWorkspaces = workspaces.filter(ws => ws.status === 'active')
  const inactiveWorkspaces = workspaces.filter(ws => ws.status !== 'active')

  return (
    <div className="space-y-8">
      {/* Connection Status */}
      <div className="flex justify-end">
        <ConnectionStatus 
          status={connectionStatus}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border"
        />
      </div>

      {/* Loading State */}
      {loading && (
        <div className={`${tailwindClasses.card.base} ${tailwindClasses.card.hover}`}>
          <div className="text-center py-12">
            <div 
              className="h-12 w-12 mx-auto rounded-full border-4 border-gray-200 border-t-blue-500 animate-spin mb-4"
            />
            <p className={tailwindClasses.typography.subtitle}>Loading workspaces...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className={`${tailwindClasses.card.base}`} style={{ borderColor: designSystem.colors.accent.orange }}>
          <div className="text-center py-12">
            <div 
              className="h-12 w-12 mx-auto rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: `${designSystem.colors.accent.orange}20` }}
            >
              <span className="text-2xl">⚠️</span>
            </div>
            <h3 
              className={`${tailwindClasses.typography.title} mb-3`}
              style={{ color: designSystem.colors.accent.orange }}
            >
              Failed to Load Workspaces
            </h3>
            <p className={`${tailwindClasses.typography.subtitle} mb-4`}>
              {error}
            </p>
            <Button 
              onClick={() => window.location.reload()}
              className="rounded-xl"
              style={{
                backgroundColor: designSystem.colors.accent.orange,
                color: 'white'
              }}
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Content - only show when not loading and no error */}
      {!loading && !error && (
        <>
          {/* No Workspaces - Prominent Getting Started Hint */}
          {workspaces.length === 0 && <GettingStarted />}

          {/* Show Active Workspaces first if any exist */}
      {activeWorkspaces.length > 0 && (
        <div className={`${tailwindClasses.card.base} ${tailwindClasses.card.hover}`}>
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div 
                  className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl flex items-center justify-center shadow-lg shrink-0"
                  style={{ 
                    background: `linear-gradient(135deg, ${designSystem.colors.accent.green}, ${designSystem.colors.accent.green}dd)` 
                  }}
                >
                  <span className="text-xl sm:text-2xl">⚡</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h2 
                    className={`${tailwindClasses.typography.title} text-xl sm:text-2xl`}
                    style={{ 
                      background: `linear-gradient(to right, ${designSystem.colors.accent.green}, ${designSystem.colors.accent.green}dd)`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      fontWeight: '700'
                    }}
                  >
                    Active Workspaces
                  </h2>
                  <p className={`${tailwindClasses.typography.subtitle} text-sm sm:text-base`}>
                    {activeWorkspaces.length} workspace{activeWorkspaces.length !== 1 ? 's' : ''} connected
                  </p>
                </div>
              </div>
              
              {/* Status Overview - responsive */}
              <div className="flex items-center justify-between sm:justify-end gap-4">
                <span className="text-sm text-gray-500 sm:hidden">Total Tasks:</span>
                <div className="text-right shrink-0">
                  <div 
                    className="text-2xl sm:text-3xl font-bold"
                    style={{ color: designSystem.colors.accent.green }}
                  >
                    {totalTasks}
                  </div>
                  <div className={`${tailwindClasses.typography.caption} uppercase tracking-wide hidden sm:block`}>
                    Total Tasks
                  </div>
                </div>
              </div>
            </div>

            {/* Active Workspace List */}
            <div className="space-y-4">
              {activeWorkspaces.map((workspace) => (
                <Link
                  key={workspace.id}
                  to="/workspace/$workspaceId/tasks"
                  params={{ workspaceId: workspace.id }}
                  className={`${tailwindClasses.listItem.base} ${tailwindClasses.listItem.hover} block cursor-pointer`}
                >
                  <div 
                    className="w-1 h-full rounded-sm mr-3 md:mr-4"
                    style={{ backgroundColor: designSystem.colors.accent.green }}
                  />
                  
                  {/* Responsive layout container */}
                  <div className="flex-1 space-y-3">
                    {/* Header row - responsive */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div 
                          className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${designSystem.colors.accent.green}20` }}
                        >
                          <Folder size={18} style={{ color: designSystem.colors.accent.green }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 
                            className={`${tailwindClasses.typography.title} truncate`}
                            style={{ color: designSystem.colors.neutral[900] }}
                          >
                            {workspace.name}
                          </h3>
                          {/* Path - responsive with better breaking */}
                          <div className="flex items-center gap-2 mt-1">
                            <p 
                              className={`${tailwindClasses.typography.caption} font-mono break-all sm:break-normal sm:truncate`}
                              style={{ color: designSystem.colors.neutral[600] }}
                              title={workspace.path}
                            >
                              {workspace.path}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Task count - responsive positioning */}
                      {workspace.task_count && (
                        <div className="flex items-center justify-between sm:justify-end gap-2">
                          <span className="text-sm text-gray-500 sm:hidden">Tasks:</span>
                          <div className="text-right shrink-0">
                            <div 
                              className="text-lg font-bold"
                              style={{ color: designSystem.colors.accent.green }}
                            >
                              {workspace.task_count}
                            </div>
                            <div 
                              className={`${tailwindClasses.typography.caption} hidden sm:block`}
                              style={{ color: designSystem.colors.accent.green }}
                            >
                              tasks
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Active task block - always full width */}
                    {workspace.active_task && (
                      <div 
                        className="p-3 rounded-lg border"
                        style={{ 
                          backgroundColor: designSystem.colors.neutral[50],
                          borderColor: `${designSystem.colors.accent.green}30`
                        }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div 
                            className="h-1.5 w-1.5 rounded-full animate-pulse shrink-0"
                            style={{ backgroundColor: designSystem.colors.accent.green }}
                          />
                          <span 
                            className={`${tailwindClasses.typography.caption} font-medium uppercase tracking-wide`}
                            style={{ color: designSystem.colors.accent.green }}
                          >
                            ACTIVE TASK
                          </span>
                        </div>
                        <p 
                          className={`${tailwindClasses.typography.subtitle} font-medium break-words`}
                          style={{ color: designSystem.colors.neutral[900] }}
                        >
                          {workspace.active_task}
                        </p>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Available Workspaces - only show if there are inactive workspaces */}
      {inactiveWorkspaces.length > 0 && (
        <div className={`${tailwindClasses.card.base} ${tailwindClasses.card.hover}`}>
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div 
                className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl flex items-center justify-center shadow-lg shrink-0"
                style={{ 
                  background: `linear-gradient(135deg, ${designSystem.colors.neutral[500]}, ${designSystem.colors.neutral[600]})` 
                }}
              >
                <span className="text-xl sm:text-2xl">💤</span>
              </div>
              <div className="min-w-0 flex-1">
                <h2 
                  className={`${tailwindClasses.typography.title} text-xl sm:text-2xl`}
                  style={{ 
                    background: `linear-gradient(to right, ${designSystem.colors.neutral[500]}, ${designSystem.colors.neutral[600]})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontWeight: '700'
                  }}
                >
                  Available Workspaces
                </h2>
                <p className={`${tailwindClasses.typography.subtitle} text-sm sm:text-base`}>
                  {inactiveWorkspaces.length} workspace{inactiveWorkspaces.length !== 1 ? 's' : ''} ready to connect
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {inactiveWorkspaces.map((workspace) => (
                <Link
                  key={workspace.id}
                  to="/workspace/$workspaceId/tasks"
                  params={{ workspaceId: workspace.id }}
                  className={`${tailwindClasses.listItem.base} ${tailwindClasses.listItem.hover} block cursor-pointer`}
                >
                  <div 
                    className="w-1 h-full rounded-sm mr-3 md:mr-4"
                    style={{ backgroundColor: designSystem.colors.neutral[300] }}
                  />
                  
                  {/* Responsive layout for inactive workspaces */}
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div 
                          className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: designSystem.colors.neutral[100] }}
                        >
                          <Folder size={18} style={{ color: designSystem.colors.neutral[600] }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 
                            className={`${tailwindClasses.typography.title} truncate`}
                            style={{ color: designSystem.colors.neutral[900] }}
                          >
                            {workspace.name}
                          </h3>
                          <p 
                            className={`${tailwindClasses.typography.caption} font-mono break-all sm:break-normal sm:truncate`}
                            style={{ color: designSystem.colors.neutral[600] }}
                            title={workspace.path}
                          >
                            {workspace.path}
                          </p>
                          {workspace.last_activity && (
                            <p 
                              className={`${tailwindClasses.typography.caption} mt-1`}
                              style={{ color: designSystem.colors.neutral[500] }}
                            >
                              Last active: {formatLastActivity(workspace.last_activity)}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Status and task info - responsive */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        {workspace.status === 'error' && (
                          <div className="flex items-center gap-1">
                            <span 
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: designSystem.colors.accent.orange }}
                            />
                            <span 
                              className={tailwindClasses.typography.caption}
                              style={{ color: designSystem.colors.accent.orange }}
                            >
                              Error
                            </span>
                          </div>
                        )}
                        
                        {workspace.task_count && (
                          <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-0">
                            <span className="text-sm text-gray-500 sm:hidden">Tasks:</span>
                            <div 
                              className={`${tailwindClasses.typography.subtitle} font-medium`}
                              style={{ color: designSystem.colors.neutral[600] }}
                            >
                              {workspace.task_count} tasks
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  )

  function formatLastActivity(timestamp: string) {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return `${Math.floor(diffMins / 1440)}d ago`
  }
}
