import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Edit, Settings } from 'lucide-react';
import type { FeedbackStep } from '@/lib/api-client';

interface ToolFlow {
  id: string;
  tool_name: string;
  description: string;
  feedback_step_id: string | null;
  next_tool: string | null;
  is_global: boolean;
  workspace_id?: string;
}

interface ToolFlowCardProps {
  flow: ToolFlow;
  feedbackSteps: FeedbackStep[];
  availableTools: string[];
  isEditable: boolean;
  onEdit?: (flow: ToolFlow) => void;
  onClone?: (flow: ToolFlow) => void;
  onUpdate?: (flowId: string, updates: Partial<ToolFlow>) => void;
  onDelete?: (flowId: string) => void;
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
    if (!flow.feedback_step_id) return null;
    
    // If we have feedback steps array, try to find a match
    if (Array.isArray(feedbackSteps) && feedbackSteps.length > 0) {
      const step = feedbackSteps.find(step => step.id === flow.feedback_step_id);
      if (step) return step;
      
      // If no match found but we have a feedback_step_id, create a minimal step object
      return {
        id: flow.feedback_step_id,
        name: flow.feedback_step_id.split('_').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' '),
        description: '',
        template_content: '',
        variable_schema: {},
        is_global: true
      };
    }
    
    // If no feedback steps array but we have a feedback_step_id, create a minimal step object
    return {
      id: flow.feedback_step_id,
      name: flow.feedback_step_id.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' '),
      description: '',
      template_content: '',
      variable_schema: {},
      is_global: true
    };
  }, [flow, feedbackSteps]);
  
  const handleFeedbackStepChange = (stepId: string) => {
    if (isEditable && onUpdate) {
      onUpdate(flow.id, { feedback_step_id: stepId === 'none' ? null : stepId });
    }
  };

  const handleNextToolChange = (toolName: string) => {
    if (isEditable && onUpdate) {
      onUpdate(flow.id, { next_tool: toolName === 'none' ? null : toolName });
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Settings size={16} className="text-primary flex-shrink-0" />
              <h3 className="text-base font-semibold truncate">
                {flow.tool_name}
              </h3>
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

        {/* Second section - Workflow visualization */}
        <div className="space-y-4">
        {/* Workflow visualization */}
        <div className="flex items-center justify-center p-3 bg-muted/20 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-foreground/90">
              {selectedFeedbackStep?.name || 'No Feedback Step'}
            </div>
            
            <div className="text-muted-foreground mx-1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/>
                <path d="m12 5 7 7-7 7"/>
              </svg>
            </div>
            
            <div className="text-sm font-medium text-foreground/90">
              {flow.next_tool || 'End'}
            </div>
          </div>
        </div>

        {/* Feedback Step Selector (editable) */}
        {isEditable && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Feedback Step</label>
            <Select 
              value={flow.feedback_step_id || 'none'} 
              onValueChange={handleFeedbackStepChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select feedback step" />
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
          </div>
        )}

        {/* Next Tool Selector (editable) */}
        {isEditable && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Next Tool</label>
            <Select 
              value={flow.next_tool || 'none'} 
              onValueChange={handleNextToolChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select next tool" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">End of Flow</SelectItem>
                {availableTools
                  .filter(tool => tool !== flow.tool_name)
                  .map((tool) => (
                    <SelectItem key={tool} value={tool}>
                      {tool}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Delete action for editable flows */}
        {isEditable && onDelete && (
          <div className="pt-3 border-t mt-4">
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
        </div>
      </CardContent>
    </Card>
  );
}
