import { useState, useEffect } from 'react'
import { useParams } from '@tanstack/react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { CheckCircle, Clock, AlertCircle, Calendar } from 'lucide-react'
import { TaskCreationDialog } from '@/components/task-creation-dialog'
import { apiClient, type Task, type WorkspaceMetadata } from '@/lib/api-client'

export function TasksPage() {
  const params = useParams({ from: '/workspace/$workspaceId/tasks' })
  const workspaceId = params.workspaceId
  
  const [currentTasks, setCurrentTasks] = useState<Task[]>([])
  const [historyTasks, setHistoryTasks] = useState<Task[]>([])
  const [workspaces, setWorkspaces] = useState<WorkspaceMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [, setIsCreatingTask] = useState(false)

  // Load tasks from API
  useEffect(() => {
    const loadTasks = async () => {
      setLoading(true)
      setError(null)
      
      try {
        // Load workspaces first
        const workspacesResponse = await apiClient.getWorkspaces()
        if (workspacesResponse.error) {
          throw new Error(workspacesResponse.error)
        }
        setWorkspaces(workspacesResponse.data.workspaces)

        // Load tasks for current workspace
        const tasksResponse = await apiClient.getTasks(workspaceId)
        if (tasksResponse.error) {
          throw new Error(tasksResponse.error)
        }
        
        const allTasks = tasksResponse.data.tasks
        setCurrentTasks(allTasks.filter(task => task.status !== 'done' && task.status !== 'dropped'))
        setHistoryTasks(allTasks.filter(task => task.status === 'done' || task.status === 'dropped'))

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tasks')
      } finally {
        setLoading(false)
      }
    }

    loadTasks()

    // Set up real-time updates via SSE
    const unsubscribeTaskUpdates = apiClient.onSSEEvent('task.updated', (event) => {
      const updatedTask = event.data.task
      setCurrentTasks(prev => prev.map(task => 
        task.id === updatedTask.id ? updatedTask : task
      ))
      setHistoryTasks(prev => prev.map(task => 
        task.id === updatedTask.id ? updatedTask : task
      ))
    })

    const unsubscribeTaskCreated = apiClient.onSSEEvent('task.created', (event) => {
      const newTask = event.data.task
      if (newTask.status !== 'done' && newTask.status !== 'dropped') {
        setCurrentTasks(prev => [...prev, newTask])
      } else {
        setHistoryTasks(prev => [...prev, newTask])
      }
    })

    return () => {
      unsubscribeTaskUpdates()
      unsubscribeTaskCreated()
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
              <div className="h-10 w-32 bg-muted animate-pulse rounded mb-2" />
              <div className="h-5 w-48 bg-muted animate-pulse rounded" />
            </div>
          </div>
          <div className="h-9 w-24 bg-muted animate-pulse rounded-xl" />
        </div>
        
        {/* Content Skeleton */}
        <div className="modern-card">
          <div className="p-6 space-y-4">
            <div className="h-6 w-40 bg-muted animate-pulse rounded" />
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
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
        </div>

        <div className="modern-card">
          <div className="p-6 text-center">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
              <AlertCircle size={24} className="text-red-600 dark:text-red-400" />
            </div>
            <h3 className="font-medium mb-2">Failed to Load Tasks</h3>
            <p className="text-muted-foreground text-sm mb-4">{error}</p>
            <Button onClick={() => window.location.reload()} className="rounded-xl">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'done':
        return <CheckCircle size={16} className="text-green-600" />
      case 'in-progress':
        return <Clock size={16} className="text-blue-600" />
      case 'blocked':
        return <AlertCircle size={16} className="text-red-600" />
      case 'review':
        return <CheckCircle size={16} className="text-yellow-600" />
      default:
        return <Calendar size={16} className="text-gray-600" />
    }
  }

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'low':
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

  const TaskCard = ({ task }: { task: Task }) => (
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
                  {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
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
              {task.status.replace('-', ' ').toUpperCase()}
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
            <span>Updated: {formatDate(task.updated_at)}</span>
          </div>
          {task.connected_files && task.connected_files.length > 0 && (
            <span>{task.connected_files.length} file{task.connected_files.length !== 1 ? 's' : ''}</span>
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
        <TaskCreationDialog
          buttonText="Create Task"
          buttonVariant="default"
          className="rounded-xl shadow-sm"
          onTaskCreated={async (newTask) => {
            setIsCreatingTask(true)
            try {
              // TODO: Replace with actual API call when available
              console.log('Creating task:', newTask)
              // Simulate API call
              await new Promise(resolve => setTimeout(resolve, 1000))
              // Refresh tasks after creation
              window.location.reload()
            } catch (error) {
              console.error('Failed to create task:', error)
              setError('Failed to create task. Please try again.')
            } finally {
              setIsCreatingTask(false)
            }
          }}
        />
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
                  <TaskCreationDialog
                    buttonText="Create Task"
                    buttonVariant="default"
                    className="rounded-xl"
                    onTaskCreated={async (newTask) => {
                      setIsCreatingTask(true)
                      try {
                        // TODO: Replace with actual API call when available
                        console.log('Creating task:', newTask)
                        // Simulate API call
                        await new Promise(resolve => setTimeout(resolve, 1000))
                        // Refresh tasks after creation
                        window.location.reload()
                      } catch (error) {
                        console.error('Failed to create task:', error)
                        setError('Failed to create task. Please try again.')
                      } finally {
                        setIsCreatingTask(false)
                      }
                    }}
                  />
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
                    <TaskCard key={task.id} task={task} />
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
