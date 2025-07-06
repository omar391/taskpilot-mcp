import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Edit, Save, X, Copy } from 'lucide-react'

interface FeedbackStep {
  id: string
  name: string
  description: string
  template: string
  is_global: boolean
  workspace_id?: string
  variables?: string[]
}

interface FeedbackEditorProps {
  feedbackStep: FeedbackStep
  isEditable: boolean
  onEdit?: () => void
  onSave?: (updates: Partial<FeedbackStep>) => void
  onCancel?: () => void
  onClone?: (feedbackStep: FeedbackStep) => void
  showVariableHelper?: boolean
}

export function FeedbackEditor({
  feedbackStep,
  isEditable,
  onEdit,
  onSave,
  onCancel,
  onClone,
  showVariableHelper = true
}: FeedbackEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedTemplate, setEditedTemplate] = useState(feedbackStep.template)
  const [editedDescription, setEditedDescription] = useState(feedbackStep.description)

  const handleSave = () => {
    if (onSave) {
      onSave({
        template: editedTemplate,
        description: editedDescription
      })
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditedTemplate(feedbackStep.template)
    setEditedDescription(feedbackStep.description)
    setIsEditing(false)
    if (onCancel) {
      onCancel()
    }
  }

  const handleEdit = () => {
    setIsEditing(true)
    if (onEdit) {
      onEdit()
    }
  }

  const extractVariables = (template: string): string[] => {
    const matches = template.match(/\{\{context\.(\w+)\}\}/g) || []
    return [...new Set(matches.map(match => match.replace(/[{}]/g, '').replace('context.', '')))]
  }

  const variables = extractVariables(isEditing ? editedTemplate : feedbackStep.template)

  const commonVariables = [
    'workspace_name',
    'task_count',
    'task_id',
    'task_title',
    'analysis_time',
    'user_feedback',
    'validation_result',
    'error_message',
    'success_message'
  ]

  const insertVariable = (variable: string) => {
    const variableText = `{{context.${variable}}}`
    const textarea = document.getElementById(`template-${feedbackStep.id}`) as HTMLTextAreaElement
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newValue = editedTemplate.substring(0, start) + variableText + editedTemplate.substring(end)
      setEditedTemplate(newValue)
      
      // Set cursor position after the inserted variable
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + variableText.length, start + variableText.length)
      }, 0)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Edit size={20} />
            {feedbackStep.name}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={feedbackStep.is_global ? "secondary" : "default"}>
              {feedbackStep.is_global ? "Global" : "Workspace"}
            </Badge>
            {!isEditable && !feedbackStep.is_global && onClone && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onClone(feedbackStep)}
              >
                <Copy size={16} className="mr-1" />
                Clone
              </Button>
            )}
            {isEditable && !isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleEdit}
              >
                <Edit size={16} className="mr-1" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Description */}
        <div>
          <label className="text-sm font-medium mb-2 block">Description</label>
          {isEditing ? (
            <Textarea
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              placeholder="Describe what this feedback step does..."
              className="min-h-[60px]"
            />
          ) : (
            <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
              {feedbackStep.description}
            </p>
          )}
        </div>

        {/* Template */}
        <div>
          <label className="text-sm font-medium mb-2 block">Template</label>
          {isEditing ? (
            <Textarea
              id={`template-${feedbackStep.id}`}
              value={editedTemplate}
              onChange={(e) => setEditedTemplate(e.target.value)}
              placeholder="Enter template with {{context.variable}} syntax..."
              className="min-h-[120px] font-mono text-sm"
            />
          ) : (
            <div className="p-3 bg-muted rounded-lg">
              <pre className="text-sm whitespace-pre-wrap font-mono">
                {feedbackStep.template}
              </pre>
            </div>
          )}
        </div>

        {/* Variables Helper */}
        {showVariableHelper && variables.length > 0 && (
          <div>
            <label className="text-sm font-medium mb-2 block">Template Variables</label>
            <div className="flex flex-wrap gap-2">
              {variables.map((variable) => (
                <Badge key={variable} variant="outline" className="text-xs">
                  context.{variable}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Variable Inserter for Editing */}
        {isEditing && showVariableHelper && (
          <div>
            <label className="text-sm font-medium mb-2 block">Insert Variable</label>
            <Select onValueChange={insertVariable}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Choose a variable to insert..." />
              </SelectTrigger>
              <SelectContent>
                {commonVariables.map((variable) => (
                  <SelectItem key={variable} value={variable}>
                    context.{variable}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Edit Actions */}
        {isEditing && (
          <div className="flex gap-2 pt-2 border-t">
            <Button
              onClick={handleSave}
              size="sm"
              className="flex-1"
            >
              <Save size={16} className="mr-1" />
              Save Changes
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              size="sm"
              className="flex-1"
            >
              <X size={16} className="mr-1" />
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
