import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Edit, Settings } from 'lucide-react';
import type { FeedbackStep } from '@/lib/api-client';

interface ToolFlow {
  id: string
  tool_name: string
  description: string
  feedback_step_id: string | null
  next_tool: string | null
  is_global: boolean
  workspace_id?: string
}

// Using the imported FeedbackStep type from api-client

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
  // Find the selected feedback step with proper type checking
  const selectedFeedbackStep = React.useMemo(() => {
    if (!flow.feedback_step_id || !Array.isArray(feedbackSteps)) return null;
    return feedbackSteps.find(step => step.id === flow.feedback_step_id) || null;
  }, [flow.feedback_step_id, feedbackSteps]);
  
  const handleFeedbackStepChange = (stepId: string) => {
    if (isEditable && onUpdate) {
      onUpdate(flow.id, { feedback_step_id: stepId === 'none' ? null : stepId })
    }
  }

  const handleNextToolChange = (toolName: string) => {
    if (isEditable && onUpdate) {
      onUpdate(flow.id, { next_tool: toolName === 'none' ? null : toolName })
    }
  }

  return (
    <Card className="w-full hover:shadow-md transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Settings size={16} className="text-primary flex-shrink-0" />
              <CardTitle className="text-base font-semibold truncate">
                {flow.tool_name}
              </CardTitle>
              <Badge variant={flow.is_global ? "secondary" : "default"} className="text-xs">
                {flow.is_global ? "Global" : "Workspace"}
              </Badge>
            </div>
            {flow.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">{flow.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {!isEditable && onClone && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onClone(flow);
                }}
                className="h-8 px-3 hover:cursor-pointer hover:bg-accent"
              >
                <Copy size={14} className="mr-1" />
                Clone
              </Button>
            )}
            {isEditable && onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(flow)}
                className="h-8 px-3"
              >
                <Edit size={14} className="mr-1" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Horizontal workflow with arrows */}
        <div className="flex items-stretch">
          {/* Column 1: Tool Function */}
          <div className="relative flex-1 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-l-lg border-t-2 border-blue-500">
            <div className="text-center">
              <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold mx-auto mb-2">
                🛠️
              </div>
              <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Tool</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 font-mono truncate" title={flow.tool_name}>
                {flow.tool_name}
              </p>
            </div>
            {/* Arrow to next step */}
            <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-4 h-4 text-blue-500">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
              </svg>
            </div>
          </div>

          {/* Column 2: Feedback Step */}
          <div className="relative flex-1 p-3 bg-green-50 dark:bg-green-950/30 border-t-2 border-green-500">
            <div className="text-center">
              <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold mx-auto mb-2">
                🔄
              </div>
              <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">Feedback</p>
              {isEditable ? (
                <Select 
                  value={flow.feedback_step_id || 'none'} 
                  onValueChange={handleFeedbackStepChange}
                  disabled={!isEditable}
                >
                  <SelectTrigger className="h-6 text-xs bg-background">
                    <SelectValue placeholder="Select...">
                      {selectedFeedbackStep?.name || 'No Feedback Step'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Feedback Step</SelectItem>
                    {Array.isArray(feedbackSteps) && feedbackSteps.map((step) => (
                      <SelectItem key={step.id} value={step.id}>
                        {step.name} {step.is_global ? '(Global)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="min-h-6 flex items-center">
                  <p 
                    className={`text-xs truncate ${
                      selectedFeedbackStep 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-muted-foreground italic'
                    }`} 
                    title={selectedFeedbackStep?.name || 'No feedback step configured'}
                  >
                    {selectedFeedbackStep?.name || 'None'}
                  </p>
                </div>
              )}
            </div>
            {/* Arrow to next step */}
            <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-4 h-4 text-green-500">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
              </svg>
            </div>
          </div>

          {/* Column 3: Next Action */}
          <div className="flex-1 p-3 bg-orange-50 dark:bg-orange-950/30 rounded-r-lg border-t-2 border-orange-500">
            <div className="text-center">
              <div className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold mx-auto mb-2">
                ⏭️
              </div>
              <p className="text-xs font-medium text-orange-700 dark:text-orange-300 mb-1">Next</p>
              {isEditable ? (
                <Select 
                  value={flow.next_tool || 'none'} 
                  onValueChange={handleNextToolChange}
                >
                  <SelectTrigger className="h-6 text-xs bg-background">
                    <SelectValue placeholder="Select next tool..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (End of Flow)</SelectItem>
                    {availableTools.map((tool) => (
                      <SelectItem key={tool} value={tool}>
                        {tool}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-xs text-orange-600 dark:text-orange-400 truncate" title={flow.next_tool || 'End'}>
                  {flow.next_tool || 'End'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Delete action for editable flows */}
        {isEditable && onDelete && (
          <div className="pt-3 border-t">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onDelete(flow.id)}
              className="w-full h-8 text-xs"
            >
              Delete Flow
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
