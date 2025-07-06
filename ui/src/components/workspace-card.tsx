import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Folder, Clock, Activity } from 'lucide-react'

interface WorkspaceCardProps {
  workspace: {
    id: string
    name: string
    path: string
    status: 'connected' | 'disconnected' | 'error'
    lastActivity?: string
    taskCount?: number
    activeTask?: string
  }
  onConnect?: (id: string) => void
  onDisconnect?: (id: string) => void
}

export function WorkspaceCard({ workspace, onConnect, onDisconnect }: WorkspaceCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'disconnected':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatLastActivity = (timestamp?: string) => {
    if (!timestamp) return 'Never'
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return `${Math.floor(diffMins / 1440)}d ago`
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Folder size={20} />
            {workspace.name}
          </CardTitle>
          <Badge variant="secondary" className={getStatusColor(workspace.status)}>
            {workspace.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          <p className="font-mono text-xs truncate">{workspace.path}</p>
        </div>
        
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <Clock size={16} />
            <span>{formatLastActivity(workspace.lastActivity)}</span>
          </div>
          {workspace.taskCount !== undefined && (
            <div className="flex items-center gap-1">
              <Activity size={16} />
              <span>{workspace.taskCount} tasks</span>
            </div>
          )}
        </div>

        {workspace.activeTask && (
          <div className="text-xs bg-muted p-2 rounded">
            <span className="font-medium">Active:</span> {workspace.activeTask}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {workspace.status === 'connected' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDisconnect?.(workspace.id)}
              className="flex-1"
            >
              Disconnect
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => onConnect?.(workspace.id)}
              className="flex-1"
            >
              Connect
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
