import { useState, useEffect } from 'react'
import { useParams } from '@tanstack/react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Plus, CheckCircle, Clock, AlertCircle, Calendar } from 'lucide-react'

interface Task {
  id: string
  title: string
  description: string
  priority: 'High' | 'Medium' | 'Low'
  status: 'Backlog' | 'In-Progress' | 'Blocked' | 'Review' | 'Done' | 'Dropped'
  progress: number
  dependencies?: string[]
  connectedFiles?: string[]
  notes?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
  workspaceId: string
}

interface Workspace {
  id: string
  name: string
  path: string
}

export function TasksPage() {
  const params = useParams({ from: '/workspace/$workspaceId/tasks' })
  const workspaceId = params.workspaceId
  
  const [currentTasks, setCurrentTasks] = useState<Task[]>([])
  const [historyTasks, setHistoryTasks] = useState<Task[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])

  // Mock data for development - will be replaced with real API calls
  useEffect(() => {
    const mockCurrentTasks: Task[] = [
      {
        id: 'TP-017',
        title: 'Add Tasks menu with Current and History tabs',
        description: 'Create new Tasks navigation item in floating nav with two tabs for task management functionality within workspace context.',
        priority: 'High',
        status: 'In-Progress',
        progress: 20,
        dependencies: ['TP-016'],
        connectedFiles: ['ui/src/pages/tasks.tsx', 'ui/src/components/floating-nav.tsx', 'ui/src/router.tsx'],
        notes: 'Implementation started - creating Tasks page component with tab navigation',
        createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        updatedAt: new Date().toISOString(),
        workspaceId: workspaceId
      },
      {
        id: 'TP-018',
        title: 'Improve tab design consistency across existing pages',
        description: 'Enhance visual design of tab components used in Tool Flows and Feedback Steps pages.',
        priority: 'Medium',
        status: 'Backlog',
        progress: 0,
        dependencies: ['TP-017'],
        connectedFiles: ['ui/src/pages/tool-flows.tsx', 'ui/src/pages/feedback-steps.tsx'],
        notes: 'Waiting for TP-017 completion',
        createdAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
        updatedAt: new Date(Date.now() - 1800000).toISOString(), // 30 mins ago
        workspaceId: workspaceId
      },
      {
        id: 'TP-019',
        title: 'Remove clone popup from Tools Flow',
        description: 'Remove clone-to-workspace dialog since users have already entered workspace context.',
        priority: 'Medium',
        status: 'Backlog',
        progress: 0,
        dependencies: ['TP-016'],
        connectedFiles: ['ui/src/pages/tool-flows.tsx', 'ui/src/components/clone-to-workspace.tsx'],
        notes: 'Ready to start - dependency completed',
        createdAt: new Date(Date.now() - 10800000).toISOString(), // 3 hours ago
        updatedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        workspaceId: workspaceId
      }
    ]

    const mockHistoryTasks: Task[] = [
      {
        id: 'TP-015',
        title: 'Make workspace cards clickable for navigation',
        description: 'Implement clickable workspace cards on the home page that navigate users into workspace-specific pages.',
        priority: 'High',
        status: 'Done',
        progress: 100,
        dependencies: ['TP-014'],
        connectedFiles: ['ui/src/pages/home.tsx', 'ui/src/router.tsx', 'ui/src/components/floating-nav.tsx'],
        notes: 'Successfully implemented workspace-based routing and clickable navigation',
        createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        updatedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        completedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        workspaceId: workspaceId
      },
      {
        id: 'TP-016',
        title: 'Implement conditional floating navigation',
        description: 'Modify floating navigation to only appear when users are inside workspace pages.',
        priority: 'High',
        status: 'Done',
        progress: 100,
        dependencies: ['TP-015'],
        connectedFiles: ['ui/src/components/floating-nav.tsx'],
        notes: 'Completed as part of TP-015 implementation',
        createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        updatedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        completedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        workspaceId: workspaceId
      }
    ]

    const mockWorkspaces: Workspace[] = [
      {
        id: '1',
        name: 'TaskPilot MCP',
        path: '/Volumes/Projects/business/AstronLab/omar391/taskpilot-mcp'
      },
      {
        id: '2',
        name: 'Demo Project',
        path: '/Users/demo/projects/demo-app'
      }
    ]

    setCurrentTasks(mockCurrentTasks)
    setHistoryTasks(mockHistoryTasks)
    setWorkspaces(mockWorkspaces)
  }, [workspaceId])

  const currentWorkspace = workspaces.find(w => w.id === workspaceId)

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'Done':
        return <CheckCircle size={16} className="text-green-600" />
      case 'In-Progress':
        return <Clock size={16} className="text-blue-600" />
      case 'Blocked':
        return <AlertCircle size={16} className="text-red-600" />
      case 'Review':
        return <CheckCircle size={16} className="text-yellow-600" />
      default:
        return <Calendar size={16} className="text-gray-600" />
    }
  }

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'High':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'Low':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return `${Math.floor(diffMins / 1440)}d ago`
  }

  const TaskCard = ({ task, showCompletedDate = false }: { task: Task; showCompletedDate?: boolean }) => (
    <div className="modern-card hover:shadow-md transition-shadow duration-200">
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {getStatusIcon(task.status)}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-lg truncate">{task.id}</h3>
                <span className={`px-2 py-1 rounded-md text-xs font-medium ${getPriorityColor(task.priority)}`}>
                  {task.priority}
                </span>
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                {task.title}
              </p>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {task.description}
              </p>
            </div>
          </div>
          
          {/* Progress & Status */}
          <div className="text-right shrink-0">
            <div className="text-lg font-bold text-primary">
              {task.progress}%
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">
              {task.status.replace('-', ' ')}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${task.progress}%` }}
          />
        </div>

        {/* Metadata */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>Updated: {formatDate(task.updatedAt)}</span>
            {showCompletedDate && task.completedAt && (
              <span>Completed: {formatDate(task.completedAt)}</span>
            )}
          </div>
          {task.connectedFiles && (
            <span>{task.connectedFiles.length} file{task.connectedFiles.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {/* Dependencies */}
        {task.dependencies && task.dependencies.length > 0 && (
          <div className="pt-3 border-t border-border/50">
            <span className="text-xs text-muted-foreground">
              Depends on: {task.dependencies.join(', ')}
            </span>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-8">
      {/* Modern Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-xl">
            <span className="text-3xl">📋</span>
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-500 to-purple-600 bg-clip-text text-transparent">
              Tasks
            </h1>
            <p className="text-muted-foreground text-lg">
              Manage your workspace tasks and track progress
            </p>
          </div>
        </div>
        <Button size="sm" className="rounded-xl shadow-sm">
          <Plus size={16} className="mr-2" />
          New Task
        </Button>
      </div>

      {/* Workspace Context */}
      {currentWorkspace && (
        <div className="modern-card">
          <div className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar size={14} className="text-primary" />
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

      {/* Modern Tabs with Enhanced Mobile Support */}
      <Tabs defaultValue="current" className="w-full">
        <TabsList className="grid w-full grid-cols-2 rounded-2xl p-1 bg-muted/30 h-12">
          <TabsTrigger 
            value="current" 
            className="flex items-center gap-2 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200 hover:bg-background/50 px-3 py-2 text-sm font-medium"
          >
            <Clock size={16} className="flex-shrink-0" />
            <span className="hidden sm:inline">Current ({currentTasks.length})</span>
            <span className="sm:hidden">Current</span>
          </TabsTrigger>
          <TabsTrigger 
            value="history" 
            className="flex items-center gap-2 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200 hover:bg-background/50 px-3 py-2 text-sm font-medium"
          >
            <CheckCircle size={16} className="flex-shrink-0" />
            <span className="hidden sm:inline">History ({historyTasks.length})</span>
            <span className="sm:hidden">History</span>
          </TabsTrigger>
        </TabsList>

        {/* Current Tasks Tab */}
        <TabsContent value="current" className="space-y-4 mt-6">
          <div className="modern-card">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Clock size={20} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Active Tasks</h3>
                  <p className="text-sm text-muted-foreground">
                    Tasks currently in progress or pending
                  </p>
                </div>
              </div>
              
              {currentTasks.length === 0 ? (
                <div className="text-center py-12">
                  <div className="h-16 w-16 mx-auto rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                    <Calendar size={24} className="text-muted-foreground" />
                  </div>
                  <h3 className="font-medium mb-2">No active tasks</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Create your first task to get started with this workspace.
                  </p>
                  <Button className="rounded-xl">
                    <Plus size={16} className="mr-2" />
                    Create Task
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {currentTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* History Tasks Tab */}
        <TabsContent value="history" className="space-y-4 mt-6">
          <div className="modern-card">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle size={20} className="text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Completed Tasks</h3>
                  <p className="text-sm text-muted-foreground">
                    Tasks that have been finished or dropped
                  </p>
                </div>
              </div>
              
              {historyTasks.length === 0 ? (
                <div className="text-center py-12">
                  <div className="h-16 w-16 mx-auto rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                    <CheckCircle size={24} className="text-muted-foreground" />
                  </div>
                  <h3 className="font-medium mb-2">No completed tasks yet</h3>
                  <p className="text-muted-foreground text-sm">
                    Completed tasks will appear here for reference and tracking.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {historyTasks.map((task) => (
                    <TaskCard key={task.id} task={task} showCompletedDate={true} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
