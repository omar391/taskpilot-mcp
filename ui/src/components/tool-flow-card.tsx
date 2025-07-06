import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Copy, Edit, Settings, ArrowRight, Play } from 'lucide-react'

interface ToolFlow {
  id: string
  tool_name: string
  description: string
  feedback_step_id: string | null
  next_tool: string | null
  is_global: boolean
  workspace_id?: string
}

interface FeedbackStep {
  id: string
  name: string
  description: string
}

interface ToolFlowCardProps {
  flow: ToolFlow
  feedbackSteps: FeedbackStep[]
  availableTools: string[]
  isEditable: boolean
  onEdit?: (flow: ToolFlow) => void
  onClone?: (flow: ToolFlow) => void
  onUpdate?: (flowId: string, updates: Partial<ToolFlow>) => void
  onDelete?: (flowId: string) => void
}

export function ToolFlowCard({
  flow,
  feedbackSteps,
  availableTools,
  isEditable,
  onEdit,
  onClone,
  onUpdate,
  onDelete
}: ToolFlowCardProps) {
  const selectedFeedbackStep = feedbackSteps.find(step => step.id === flow.feedback_step_id)
  
  const handleFeedbackStepChange = (stepId: string) => {
    if (isEditable && onUpdate) {
      onUpdate(flow.id, { feedback_step_id: stepId === 'none' ? null : stepId })
    }
  }

  const handleNextToolChange = (toolName: string) => {
    if (isEditable && onUpdate) {
      onUpdate(flow.id, { next_tool: toolName === 'end' ? null : toolName })
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings size={20} />
            {flow.tool_name}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={flow.is_global ? "secondary" : "default"}>
              {flow.is_global ? "Global" : "Workspace"}
            </Badge>
            {!isEditable && onClone && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onClone(flow)}
              >
                <Copy size={16} className="mr-1" />
                Clone
              </Button>
            )}
            {isEditable && onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(flow)}
              >
                <Edit size={16} className="mr-1" />
                Edit
              </Button>
            )}
          </div>
        </div>
        {flow.description && (
          <p className="text-sm text-muted-foreground">{flow.description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Three-part workflow visualization */}
        <div className="grid grid-cols-1 gap-3">
          {/* Part 1: System Tool Function */}
          <div className="flex items-center gap-3 p-3 border rounded-lg">
            <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
              1
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">System Tool Function</p>
              <p className="text-xs text-muted-foreground font-mono">{flow.tool_name}</p>
            </div>
            <Play size={16} className="text-blue-600" />
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <ArrowRight size={16} className="text-muted-foreground" />
          </div>

          {/* Part 2: Feedback Step */}
          <div className="flex items-center gap-3 p-3 border rounded-lg">
            <div className="flex items-center justify-center w-8 h-8 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
              2
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Feedback Step</p>
              {isEditable ? (
                <Select value={flow.feedback_step_id || 'none'} onValueChange={handleFeedbackStepChange}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select feedback step..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No feedback step</SelectItem>
                    {feedbackSteps.map((step) => (
                      <SelectItem key={step.id} value={step.id}>
                        {step.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {selectedFeedbackStep?.name || 'No feedback step'}
                </p>
              )}
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <ArrowRight size={16} className="text-muted-foreground" />
          </div>

          {/* Part 3: Next Tool or End */}
          <div className="flex items-center gap-3 p-3 border rounded-lg">
            <div className="flex items-center justify-center w-8 h-8 bg-orange-100 text-orange-700 rounded-full text-sm font-semibold">
              3
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Next Action</p>
              {isEditable ? (
                <Select value={flow.next_tool || 'end'} onValueChange={handleNextToolChange}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select next tool..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="end">End workflow</SelectItem>
                    {availableTools.map((tool) => (
                      <SelectItem key={tool} value={tool}>
                        {tool}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-xs text-muted-foreground font-mono">
                  {flow.next_tool || 'End workflow'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Actions for editable flows */}
        {isEditable && onDelete && (
          <div className="pt-2 border-t">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onDelete(flow.id)}
              className="w-full"
            >
              Delete Flow
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
