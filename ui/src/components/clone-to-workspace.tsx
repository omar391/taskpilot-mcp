import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Copy, Check } from 'lucide-react'

interface Workspace {
  id: string
  name: string
  path: string
}

interface ToolFlow {
  id: string
  tool_name: string
  description: string
  feedback_step_id: string | null
  next_tool: string | null
  is_global: boolean
}

interface CloneToWorkspaceProps {
  flow: ToolFlow
  workspaces: Workspace[]
  onClone: (flowId: string, workspaceId: string) => Promise<void>
  onClose: () => void
}

export function CloneToWorkspace({
  flow,
  workspaces,
  onClone,
  onClose
}: CloneToWorkspaceProps) {
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('')
  const [isCloning, setIsCloning] = useState(false)
  const [isCloned, setIsCloned] = useState(false)

  const handleClone = async () => {
    if (!selectedWorkspace) return

    setIsCloning(true)
    try {
      await onClone(flow.id, selectedWorkspace)
      setIsCloned(true)
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (error) {
      console.error('Failed to clone flow:', error)
    } finally {
      setIsCloning(false)
    }
  }

  if (isCloned) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 bg-green-100 text-green-700 rounded-full">
              <Check size={24} />
            </div>
            <h3 className="text-lg font-semibold">Flow Cloned Successfully!</h3>
            <p className="text-sm text-muted-foreground">
              {flow.tool_name} has been cloned to your workspace and is now editable.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Copy size={20} />
          Clone to Workspace
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground mb-2">
            Clone <strong>{flow.tool_name}</strong> to a workspace to customize its configuration.
          </p>
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Tool:</strong> {flow.tool_name}
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>Description:</strong> {flow.description}
            </p>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">
            Select Workspace
          </label>
          <Select value={selectedWorkspace} onValueChange={setSelectedWorkspace}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a workspace..." />
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((workspace) => (
                <SelectItem key={workspace.id} value={workspace.id}>
                  <div className="flex flex-col">
                    <span>{workspace.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {workspace.path}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleClone}
            disabled={!selectedWorkspace || isCloning}
            className="flex-1"
          >
            {isCloning ? 'Cloning...' : 'Clone Flow'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
