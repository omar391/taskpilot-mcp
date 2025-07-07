import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div 
                  className="h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg"
                  style={{ 
                    background: `linear-gradient(135deg, ${designSystem.colors.accent.green}, ${designSystem.colors.accent.green}dd)` 
                  }}
                >
                  <span className="text-2xl">⚡</span>
                </div>
                <div>
                  <h2 
                    className={tailwindClasses.typography.title}
                    style={{ 
                      background: `linear-gradient(to right, ${designSystem.colors.accent.green}, ${designSystem.colors.accent.green}dd)`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      fontSize: '1.5rem',
                      fontWeight: '700'
                    }}
                  >
                    Active Workspaces
                  </h2>
                  <p className={tailwindClasses.typography.subtitle}>
                    {activeWorkspaces.length} workspace{activeWorkspaces.length !== 1 ? 's' : ''} connected
                  </p>
                </div>
              </div>
              
              {/* Status Overview */}
              <div className="text-right">
                <div 
                  className="text-3xl font-bold"
                  style={{ color: designSystem.colors.accent.green }}
                >
                  {totalTasks}
                </div>
                <div className={`${tailwindClasses.typography.caption} uppercase tracking-wide`}>
                  Total Tasks
                </div>
              </div>
            </div>

            {/* Active Workspace List */}
            <div className="space-y-4">
              {activeWorkspaces.map((workspace) => (
                <div key={workspace.id} className={`${tailwindClasses.listItem.base} ${tailwindClasses.listItem.hover}`}>
                  <div 
                    className="w-1 h-full rounded-sm mr-4"
                    style={{ backgroundColor: designSystem.colors.accent.green }}
                  />
                  <div className="flex items-center justify-between flex-1">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div 
                        className="h-10 w-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${designSystem.colors.accent.green}20` }}
                      >
                        <Folder size={18} style={{ color: designSystem.colors.accent.green }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 
                          className={tailwindClasses.typography.title}
                          style={{ color: designSystem.colors.neutral[900] }}
                        >
                          {workspace.name}
                        </h3>
                        <p 
                          className={`${tailwindClasses.typography.caption} font-mono`}
                          style={{ color: designSystem.colors.neutral[600] }}
                        >
                          {workspace.path}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {workspace.taskCount && (
                        <div className="text-right">
                          <div 
                            className="text-lg font-bold"
                            style={{ color: designSystem.colors.accent.green }}
                          >
                            {workspace.taskCount}
                          </div>
                          <div 
                            className={tailwindClasses.typography.caption}
                            style={{ color: designSystem.colors.accent.green }}
                          >
                            tasks
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {workspace.activeTask && (
                    <div 
                      className="mt-3 p-3 rounded-lg border"
                      style={{ 
                        backgroundColor: designSystem.colors.neutral[50],
                        borderColor: `${designSystem.colors.accent.green}30`
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div 
                          className="h-1.5 w-1.5 rounded-full animate-pulse"
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
                        className={`${tailwindClasses.typography.subtitle} font-medium`}
                        style={{ color: designSystem.colors.neutral[900] }}
                      >
                        {workspace.activeTask}
                      </p>
                    </div>
                  )}
                </div>
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
              className="h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ 
                background: `linear-gradient(135deg, ${designSystem.colors.neutral[500]}, ${designSystem.colors.neutral[600]})` 
              }}
            >
              <span className="text-2xl">💤</span>
            </div>
            <div>
              <h2 
                className={tailwindClasses.typography.title}
                style={{ 
                  background: `linear-gradient(to right, ${designSystem.colors.neutral[500]}, ${designSystem.colors.neutral[600]})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontSize: '1.5rem',
                  fontWeight: '700'
                }}
              >
                Available Workspaces
              </h2>
              <p className={tailwindClasses.typography.subtitle}>
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
                <div key={workspace.id} className={`${tailwindClasses.listItem.base} ${tailwindClasses.listItem.hover}`}>
                  <div 
                    className="w-1 h-full rounded-sm mr-4"
                    style={{ backgroundColor: designSystem.colors.neutral[300] }}
                  />
                  <div className="flex items-center justify-between flex-1">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div 
                        className="h-10 w-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: designSystem.colors.neutral[100] }}
                      >
                        <Folder size={18} style={{ color: designSystem.colors.neutral[600] }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 
                          className={tailwindClasses.typography.title}
                          style={{ color: designSystem.colors.neutral[900] }}
                        >
                          {workspace.name}
                        </h3>
                        <p 
                          className={`${tailwindClasses.typography.caption} font-mono`}
                          style={{ color: designSystem.colors.neutral[600] }}
                        >
                          {workspace.path}
                        </p>
                        {workspace.lastActivity && (
                          <p 
                            className={tailwindClasses.typography.caption}
                            style={{ color: designSystem.colors.neutral[500], marginTop: '0.25rem' }}
                          >
                            Last active: {formatLastActivity(workspace.lastActivity)}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
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
                        <div className="text-right">
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
