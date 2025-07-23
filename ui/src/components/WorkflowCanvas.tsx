import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Plus, Settings, Trash2, Edit3, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { type ToolFlow, type FeedbackStep } from '@/lib/api-client'

interface WorkflowNode {
  id: string
  type: 'tool' | 'feedback' | 'trigger'
  title: string
  subtitle?: string
  position: { x: number; y: number }
  connections: string[]
  data?: any
}

interface WorkflowCanvasProps {
  flow?: ToolFlow
  feedbackSteps: FeedbackStep[]
  availableTools: string[]
  onSave?: (flow: Partial<ToolFlow>) => Promise<void>
  onCancel?: () => void
  isEditable?: boolean
}

interface DragState {
  isDragging: boolean
  dragStart: { x: number; y: number }
  nodeId: string | null
}

export function WorkflowCanvas({ 
  flow, 
  feedbackSteps, 
  availableTools, 
  onSave, 
  onCancel,
  isEditable = false 
}: WorkflowCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [nodes, setNodes] = useState<WorkflowNode[]>([])
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [editingNode, setEditingNode] = useState<string | null>(null)
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    nodeId: null
  })
  const [isEditMode, setIsEditMode] = useState(false)
  const [flowName, setFlowName] = useState(flow?.tool_name || '')
  const [flowDescription, setFlowDescription] = useState(flow?.description || '')

  // Initialize canvas with existing flow data
  useEffect(() => {
    if (flow) {
      const initialNodes: WorkflowNode[] = []
      
      // Add trigger node
      initialNodes.push({
        id: 'trigger',
        type: 'trigger',
        title: flow.tool_name,
        subtitle: 'Tool Entry Point',
        position: { x: 50, y: 100 },
        connections: flow.feedback_step_id ? ['feedback-1'] : flow.next_tool ? ['tool-1'] : []
      })

      // Add feedback step if exists
      if (flow.feedback_step_id) {
        const feedbackStep = feedbackSteps.find(step => step.id === flow.feedback_step_id)
        initialNodes.push({
          id: 'feedback-1',
          type: 'feedback',
          title: feedbackStep?.name || 'Feedback Step',
          subtitle: 'Analysis & Validation',
          position: { x: 300, y: 100 },
          connections: flow.next_tool ? ['tool-1'] : [],
          data: { feedbackStepId: flow.feedback_step_id }
        })
      }

      // Add next tool if exists
      if (flow.next_tool && flow.next_tool !== 'end') {
        initialNodes.push({
          id: 'tool-1',
          type: 'tool',
          title: flow.next_tool,
          subtitle: 'Next Tool',
          position: { x: flow.feedback_step_id ? 550 : 300, y: 100 },
          connections: [],
          data: { toolName: flow.next_tool }
        })
      }

      setNodes(initialNodes)
      setFlowName(flow.tool_name)
      setFlowDescription(flow.description || '')
    } else {
      // Empty canvas for new flow
      setNodes([])
      setFlowName('')
      setFlowDescription('')
    }
  }, [flow, feedbackSteps])

  // Handle node dragging
  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault()
    e.stopPropagation()
    
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    setDragState({
      isDragging: true,
      dragStart: {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      },
      nodeId
    })
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.isDragging || !dragState.nodeId || !isEditMode) return

    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const currentX = e.clientX - rect.left
    const currentY = e.clientY - rect.top
    
    const deltaX = currentX - dragState.dragStart.x
    const deltaY = currentY - dragState.dragStart.y

    setNodes(prev => prev.map(node => 
      node.id === dragState.nodeId 
        ? { 
            ...node, 
            position: { 
              x: Math.max(0, node.position.x + deltaX),
              y: Math.max(0, node.position.y + deltaY)
            }
          }
        : node
    ))

    setDragState(prev => ({
      ...prev,
      dragStart: { x: currentX, y: currentY }
    }))
  }, [dragState, isEditMode])

  const handleMouseUp = useCallback(() => {
    setDragState({
      isDragging: false,
      dragStart: { x: 0, y: 0 },
      nodeId: null
    })
  }, [])

  // Add new node
  const addNode = (type: 'tool' | 'feedback', afterNodeId?: string) => {
    if (!isEditMode) return

    const newId = `${type}-${Date.now()}`
    const afterNode = afterNodeId ? nodes.find(n => n.id === afterNodeId) : null
    const position = afterNode 
      ? { x: afterNode.position.x + 250, y: afterNode.position.y }
      : { x: 50 + (nodes.length * 250), y: 100 }

    const newNode: WorkflowNode = {
      id: newId,
      type,
      title: type === 'tool' ? 'Select Tool' : 'Select Feedback Step',
      subtitle: type === 'tool' ? 'Tool Action' : 'Analysis Step',
      position,
      connections: [],
      data: {}
    }

    setNodes(prev => {
      const updated = [...prev, newNode]
      
      // Connect the previous node to this new node
      if (afterNodeId) {
        return updated.map(node => 
          node.id === afterNodeId 
            ? { ...node, connections: [...node.connections, newId] }
            : node
        )
      }
      
      return updated
    })

    setEditingNode(newId)
  }

  // Remove node
  const removeNode = (nodeId: string) => {
    if (!isEditMode || nodeId === 'trigger') return

    setNodes(prev => {
      // Remove the node and update connections
      const filtered = prev.filter(n => n.id !== nodeId)
      return filtered.map(node => ({
        ...node,
        connections: node.connections.filter(id => id !== nodeId)
      }))
    })
    
    if (selectedNode === nodeId) setSelectedNode(null)
    if (editingNode === nodeId) setEditingNode(null)
  }

  // Update node data
  const updateNode = (nodeId: string, updates: Partial<WorkflowNode>) => {
    setNodes(prev => prev.map(node => 
      node.id === nodeId ? { ...node, ...updates } : node
    ))
  }

  // Save flow
  const handleSave = async () => {
    if (!onSave) return

    // Convert nodes back to flow format
    const feedbackNode = nodes.find(n => n.type === 'feedback')
    const toolNode = nodes.find(n => n.type === 'tool')

    const flowData: Partial<ToolFlow> = {
      tool_name: flowName,
      description: flowDescription,
      feedback_step_id: feedbackNode?.data?.feedbackStepId || null,
      next_tool: toolNode?.data?.toolName || 'end'
    }

    await onSave(flowData)
    setIsEditMode(false)
  }

  // Render connection lines
  const renderConnections = () => {
    return nodes.flatMap(node => 
      node.connections.map(targetId => {
        const target = nodes.find(n => n.id === targetId)
        if (!target) return null

        const startX = node.position.x + 120
        const startY = node.position.y + 40
        const endX = target.position.x
        const endY = target.position.y + 40

        return (
          <svg
            key={`${node.id}-${targetId}`}
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 1 }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 10 3.5, 0 7"
                  fill="#6b7280"
                />
              </marker>
            </defs>
            <path
              d={`M ${startX} ${startY} Q ${startX + (endX - startX) / 2} ${startY} ${endX} ${endY}`}
              stroke="#6b7280"
              strokeWidth="2"
              fill="none"
              markerEnd="url(#arrowhead)"
            />
          </svg>
        )
      })
    ).filter(Boolean)
  }

  // Render node
  const renderNode = (node: WorkflowNode) => {
    const isSelected = selectedNode === node.id
    const isEditing = editingNode === node.id

    return (
      <div
        key={node.id}
        className={`absolute cursor-pointer transition-all duration-200 ${
          isSelected ? 'z-20' : 'z-10'
        }`}
        style={{
          left: node.position.x,
          top: node.position.y,
          transform: isSelected ? 'scale(1.05)' : 'scale(1)'
        }}
        onMouseDown={isEditMode ? (e) => handleMouseDown(e, node.id) : undefined}
        onClick={() => setSelectedNode(node.id)}
      >
        <Card className={`w-60 ${isSelected ? 'ring-2 ring-blue-500 shadow-lg' : 'shadow-md'} ${
          node.type === 'trigger' ? 'border-green-200 bg-green-50' :
          node.type === 'feedback' ? 'border-blue-200 bg-blue-50' :
          'border-purple-200 bg-purple-50'
        }`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={
                  node.type === 'trigger' ? 'default' :
                  node.type === 'feedback' ? 'secondary' : 'outline'
                }>
                  {node.type}
                </Badge>
                {isEditMode && node.id !== 'trigger' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeNode(node.id)
                    }}
                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
              {isEditMode && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingNode(node.id)
                  }}
                  className="h-6 w-6 p-0"
                >
                  <Edit3 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {isEditing ? (
              <div className="space-y-2">
                {node.type === 'tool' ? (
                  <Select
                    value={node.data?.toolName || ''}
                    onValueChange={(value) => {
                      updateNode(node.id, {
                        title: value,
                        data: { ...node.data, toolName: value }
                      })
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select tool..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTools.map(tool => (
                        <SelectItem key={tool} value={tool}>
                          {tool}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : node.type === 'feedback' ? (
                  <Select
                    value={node.data?.feedbackStepId || ''}
                    onValueChange={(value) => {
                      const feedbackStep = feedbackSteps.find(step => step.id === value)
                      updateNode(node.id, {
                        title: feedbackStep?.name || 'Feedback Step',
                        data: { ...node.data, feedbackStepId: value }
                      })
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select feedback step..." />
                    </SelectTrigger>
                    <SelectContent>
                      {feedbackSteps.map(step => (
                        <SelectItem key={step.id} value={step.id}>
                          {step.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={node.title}
                    onChange={(e) => updateNode(node.id, { title: e.target.value })}
                    placeholder="Enter tool name..."
                  />
                )}
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingNode(null)
                    }}
                  >
                    <Save className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingNode(null)
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <h4 className="font-medium text-sm truncate">{node.title}</h4>
                {node.subtitle && (
                  <p className="text-xs text-muted-foreground">{node.subtitle}</p>
                )}
              </>
            )}
            
            {isEditMode && !isEditing && (
              <div className="flex gap-1 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation()
                    addNode('feedback', node.id)
                  }}
                  className="flex-1 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Feedback
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation()
                    addNode('tool', node.id)
                  }}
                  className="flex-1 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Tool
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900 rounded-lg border">
      {/* Canvas Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white dark:bg-gray-800">
        <div className="flex-1">
          {isEditMode ? (
            <div className="space-y-2">
              <Input
                value={flowName}
                onChange={(e) => setFlowName(e.target.value)}
                placeholder="Flow name..."
                className="font-medium"
              />
              <Input
                value={flowDescription}
                onChange={(e) => setFlowDescription(e.target.value)}
                placeholder="Flow description..."
                className="text-sm"
              />
            </div>
          ) : (
            <div>
              <h3 className="font-medium text-lg">{flow?.tool_name || 'New Workflow'}</h3>
              {flow?.description && (
                <p className="text-sm text-muted-foreground">{flow.description}</p>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {isEditMode ? (
            <>
              <Button size="sm" onClick={handleSave}>
                <Save className="h-4 w-4 mr-1" />
                Save Flow
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsEditMode(false)
                  onCancel?.()
                }}
              >
                Cancel
              </Button>
            </>
          ) : isEditable && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditMode(true)}
            >
              <Edit3 className="h-4 w-4 mr-1" />
              Edit Flow
            </Button>
          )}
        </div>
      </div>

      {/* Canvas Area */}
      <div 
        ref={canvasRef}
        className="relative h-[calc(100%-80px)] overflow-hidden cursor-move"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {renderConnections()}
        {nodes.map(renderNode)}
        
        {/* Empty state */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-4">
              <Settings className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <h3 className="font-medium text-lg">Empty Workflow Canvas</h3>
                <p className="text-muted-foreground">
                  {isEditMode ? 'Click "Edit Flow" to start building your workflow' : 'No workflow configured'}
                </p>
              </div>
              {isEditable && !isEditMode && (
                <Button onClick={() => setIsEditMode(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Workflow
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
