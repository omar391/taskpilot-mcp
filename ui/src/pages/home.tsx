import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Link } from '@tanstack/react-router'
import { Folder } from 'lucide-react'
import { tailwindClasses, designSystem } from '@/lib/design-system'

interface Workspace {
  id: string
  name: string
  path: string
  status: 'connected' | 'disconnected' | 'error'
  lastActivity?: string
  taskCount?: number
  activeTask?: string
}

export function HomePage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])

  // Mock data for development - will be replaced with real API calls
  useEffect(() => {
    // Simulate initial data load
    const mockWorkspaces: Workspace[] = [
      {
        id: '1',
        name: 'TaskPilot MCP',
        path: '/Volumes/Projects/business/AstronLab/omar391/taskpilot-mcp',
        status: 'connected',
        lastActivity: new Date(Date.now() - 300000).toISOString(), // 5 mins ago
        taskCount: 12,
        activeTask: 'TP-011: Implement Home Screen'
      },
      {
        id: '2', 
        name: 'Demo Project',
        path: '/Users/demo/projects/demo-app',
        status: 'disconnected',
        lastActivity: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        taskCount: 5
      }
    ]
    
    setWorkspaces(mockWorkspaces)
  }, [])



  
  const totalTasks = workspaces.reduce((sum, ws) => sum + (ws.taskCount || 0), 0)
  
  const activeWorkspaces = workspaces.filter(ws => ws.status === 'connected')
  const inactiveWorkspaces = workspaces.filter(ws => ws.status !== 'connected')

  return (
    <div className="space-y-8">
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
                  to="/workspace/$workspaceId/tool-flows"
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
                      {workspace.taskCount && (
                        <div className="flex items-center justify-between sm:justify-end gap-2">
                          <span className="text-sm text-gray-500 sm:hidden">Tasks:</span>
                          <div className="text-right shrink-0">
                            <div 
                              className="text-lg font-bold"
                              style={{ color: designSystem.colors.accent.green }}
                            >
                              {workspace.taskCount}
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
                    {workspace.activeTask && (
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
                          {workspace.activeTask}
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

      {/* Available Workspaces */}
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
                {inactiveWorkspaces.length > 0 
                  ? `${inactiveWorkspaces.length} workspace${inactiveWorkspaces.length !== 1 ? 's' : ''} ready to connect`
                  : 'No workspaces detected'
                }
              </p>
            </div>
          </div>

          {inactiveWorkspaces.length === 0 ? (
            <div className="text-center py-12">
              <div 
                className="h-20 w-20 mx-auto rounded-3xl flex items-center justify-center mb-6"
                style={{ backgroundColor: designSystem.colors.neutral[100] }}
              >
                <Folder size={32} style={{ color: designSystem.colors.neutral[400] }} />
              </div>
              <div>
                <h3 
                  className={`${tailwindClasses.typography.title} mb-3`}
                  style={{ fontSize: '1.25rem' }}
                >
                  No workspaces detected
                </h3>
                <p 
                  className={`${tailwindClasses.typography.subtitle} mb-6 max-w-md mx-auto`}
                >
                  Start by running <code 
                    className="px-2 py-1 rounded text-sm font-mono"
                    style={{ backgroundColor: designSystem.colors.neutral[100] }}
                  >taskpilot_start</code> from your LLM session to initialize a workspace.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button 
                    variant="outline" 
                    className="rounded-xl"
                    style={{
                      borderColor: designSystem.colors.neutral[300],
                      color: designSystem.colors.neutral[700]
                    }}
                  >
                    <span className="text-lg mr-2">📖</span>
                    Learn More
                  </Button>
                  <Button 
                    className="rounded-xl"
                    style={{
                      backgroundColor: designSystem.colors.accent.blue,
                      color: 'white'
                    }}
                  >
                    <span className="text-lg mr-2">🚀</span>
                    Quick Start Guide
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {inactiveWorkspaces.map((workspace) => (
                <Link
                  key={workspace.id}
                  to="/workspace/$workspaceId/tool-flows"
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
                          {workspace.lastActivity && (
                            <p 
                              className={`${tailwindClasses.typography.caption} mt-1`}
                              style={{ color: designSystem.colors.neutral[500] }}
                            >
                              Last active: {formatLastActivity(workspace.lastActivity)}
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
                        
                        {workspace.taskCount && (
                          <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-0">
                            <span className="text-sm text-gray-500 sm:hidden">Tasks:</span>
                            <div 
                              className={`${tailwindClasses.typography.subtitle} font-medium`}
                              style={{ color: designSystem.colors.neutral[600] }}
                            >
                              {workspace.taskCount} tasks
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
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
