import { useState, useEffect } from 'react'
import { WorkspaceCard } from '@/components/workspace-card'
import { ConnectionStatus } from '@/components/connection-status'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, RefreshCw, Server } from 'lucide-react'

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
  const [serverStatus, setServerStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected')
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
    setServerStatus('connected')
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

  const connectedCount = workspaces.filter(ws => ws.status === 'connected').length
  const totalTasks = workspaces.reduce((sum, ws) => sum + (ws.taskCount || 0), 0)

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">TaskPilot</h1>
        <p className="text-muted-foreground">
          Monitor and configure your task management workflows
        </p>
      </div>

      {/* Server Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Server size={20} />
              MCP Server Status
            </CardTitle>
            <ConnectionStatus status={serverStatus} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                {connectedCount} workspace{connectedCount !== 1 ? 's' : ''} connected
              </p>
              <p className="text-sm text-muted-foreground">
                {totalTasks} total tasks across all workspaces
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Workspace List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Workspaces</h2>
          <Button size="sm" variant="outline">
            <Plus size={16} className="mr-1" />
            Add Workspace
          </Button>
        </div>

        {workspaces.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground mb-4">
                No workspaces detected. Start by running `taskpilot_start` from your LLM session.
              </p>
              <Button variant="outline">
                Learn More
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {workspaces.map((workspace) => (
              <WorkspaceCard
                key={workspace.id}
                workspace={workspace}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
              />
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="w-full justify-start">
            📊 View Global Tool Flows
          </Button>
          <Button variant="outline" className="w-full justify-start">
            📝 Manage Feedback Steps
          </Button>
          <Button variant="outline" className="w-full justify-start">
            🔧 Server Configuration
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
