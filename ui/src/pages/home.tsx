import { useState, useEffect } from 'react'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Plus, RefreshCw, Folder } from 'lucide-react'

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
  const [isRefreshing, setIsRefreshing] = useState(false)

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

  const handleRefresh = async () => {
    setIsRefreshing(true)
    // Simulate refresh delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsRefreshing(false)
  }

  const handleConnect = async (workspaceId: string) => {
    setWorkspaces(prev => prev.map(ws => 
      ws.id === workspaceId 
        ? { ...ws, status: 'connected', lastActivity: new Date().toISOString() }
        : ws
    ))
  }

  const handleDisconnect = async (workspaceId: string) => {
    setWorkspaces(prev => prev.map(ws => 
      ws.id === workspaceId 
        ? { ...ws, status: 'disconnected' }
        : ws
    ))
  }

  
  const totalTasks = workspaces.reduce((sum, ws) => sum + (ws.taskCount || 0), 0)
  
  const activeWorkspaces = workspaces.filter(ws => ws.status === 'connected')
  const inactiveWorkspaces = workspaces.filter(ws => ws.status !== 'connected')

  return (
    <div className="space-y-8">
      {/* Modern Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-xl">
            <span className="text-3xl">🚀</span>
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              TaskPilot
            </h1>
            <p className="text-muted-foreground text-lg">
              Intelligent task management workflows
            </p>
          </div>
        </div>
        <ThemeToggle />
      </div>

      {/* Two Card Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Active Workspaces Card - Only shown if there are active workspaces */}
        {activeWorkspaces.length > 0 && (
          <div className="modern-card">
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg">
                    <span className="text-2xl">⚡</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 bg-clip-text text-transparent">
                      Active Workspaces
                    </h2>
                    <p className="text-muted-foreground">
                      {activeWorkspaces.length} workspace{activeWorkspaces.length !== 1 ? 's' : ''} connected
                    </p>
                  </div>
                </div>
                
                {/* Status Overview */}
                <div className="text-right">
                  <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                    {totalTasks}
                  </div>
                  <div className="text-sm text-muted-foreground uppercase tracking-wide">
                    Total Tasks
                  </div>
                </div>
              </div>

              {/* Active Workspace List */}
              <div className="space-y-4">
                {activeWorkspaces.map((workspace) => (
                  <div key={workspace.id} className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                          <Folder size={18} className="text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-emerald-900 dark:text-emerald-100 truncate">
                            {workspace.name}
                          </h3>
                          <p className="text-xs text-emerald-700 dark:text-emerald-300 font-mono truncate">
                            {workspace.path}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {workspace.taskCount && (
                          <div className="text-right">
                            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                              {workspace.taskCount}
                            </div>
                            <div className="text-xs text-emerald-600 dark:text-emerald-400">
                              tasks
                            </div>
                          </div>
                        )}
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDisconnect(workspace.id)}
                          className="rounded-lg border-emerald-300 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                        >
                          Disconnect
                        </Button>
                      </div>
                    </div>
                    
                    {workspace.activeTask && (
                      <div className="mt-3 p-3 rounded-lg bg-white dark:bg-emerald-950/50 border border-emerald-200/50 dark:border-emerald-800/50">
                        <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-1">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                          ACTIVE TASK
                        </div>
                        <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                          {workspace.activeTask}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="w-full rounded-xl border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
              >
                <RefreshCw size={16} className={isRefreshing ? 'animate-spin mr-2' : 'mr-2'} />
                {isRefreshing ? 'Refreshing...' : 'Refresh Status'}
              </Button>
            </div>
          </div>
        )}

        {/* Inactive Workspaces Card - Always shown */}
        <div className="modern-card">
          <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center shadow-lg">
                  <span className="text-2xl">💤</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-500 to-slate-600 bg-clip-text text-transparent">
                    Available Workspaces
                  </h2>
                  <p className="text-muted-foreground">
                    {inactiveWorkspaces.length > 0 
                      ? `${inactiveWorkspaces.length} workspace${inactiveWorkspaces.length !== 1 ? 's' : ''} ready to connect`
                      : 'No workspaces detected'
                    }
                  </p>
                </div>
              </div>
              
              <Button size="sm" className="rounded-xl shadow-sm">
                <Plus size={16} className="mr-2" />
                Add Workspace
              </Button>
            </div>

            {inactiveWorkspaces.length === 0 ? (
              <div className="text-center py-12">
                <div className="h-20 w-20 mx-auto rounded-3xl bg-muted/50 flex items-center justify-center mb-6">
                  <Folder size={32} className="text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-medium text-xl mb-3">No workspaces detected</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Start by running <code className="px-2 py-1 bg-muted rounded text-sm font-mono">taskpilot_start</code> from your LLM session to initialize a workspace.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button variant="outline" className="rounded-xl">
                      <span className="text-lg mr-2">📖</span>
                      Learn More
                    </Button>
                    <Button className="rounded-xl">
                      <span className="text-lg mr-2">🚀</span>
                      Quick Start Guide
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {inactiveWorkspaces.map((workspace) => (
                  <div key={workspace.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-900/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-900/30 flex items-center justify-center">
                          <Folder size={18} className="text-slate-600 dark:text-slate-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {workspace.name}
                          </h3>
                          <p className="text-xs text-slate-600 dark:text-slate-400 font-mono truncate">
                            {workspace.path}
                          </p>
                          {workspace.lastActivity && (
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                              Last active: {formatLastActivity(workspace.lastActivity)}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {workspace.status === 'error' && (
                          <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                            <span className="h-2 w-2 rounded-full bg-red-500"></span>
                            <span className="text-xs">Error</span>
                          </div>
                        )}
                        
                        <Button
                          size="sm"
                          onClick={() => handleConnect(workspace.id)}
                          className="rounded-lg bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                        >
                          Connect
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
