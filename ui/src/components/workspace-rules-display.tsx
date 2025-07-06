import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Scroll, Clock, AlertCircle } from 'lucide-react'

interface WorkspaceRule {
  id: string
  category: string
  type: 'never' | 'always' | 'remember' | 'don\'t' | 'preference'
  content: string
  confidence: number
  created_at: string
}

interface WorkspaceRulesDisplayProps {
  rules: WorkspaceRule[]
  workspaceName: string
  lastUpdated?: string
  isExpanded?: boolean
  onToggleExpanded?: () => void
}

export function WorkspaceRulesDisplay({
  rules,
  workspaceName,
  lastUpdated,
  isExpanded = false,
  onToggleExpanded
}: WorkspaceRulesDisplayProps) {
  const getRuleTypeColor = (type: string) => {
    switch (type) {
      case 'never':
      case 'don\'t':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'always':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'remember':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'preference':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const formatLastUpdated = (timestamp?: string) => {
    if (!timestamp) return 'Never'
    const date = new Date(timestamp)
    return date.toLocaleString()
  }

  const groupedRules = rules.reduce((acc, rule) => {
    if (!acc[rule.category]) {
      acc[rule.category] = []
    }
    acc[rule.category].push(rule)
    return acc
  }, {} as Record<string, WorkspaceRule[]>)

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Scroll size={20} />
            Workspace Rules
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {rules.length} rule{rules.length !== 1 ? 's' : ''}
            </Badge>
            {onToggleExpanded && (
              <button
                onClick={onToggleExpanded}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {isExpanded ? 'Collapse' : 'Expand'}
              </button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock size={16} />
            <span>Last updated: {formatLastUpdated(lastUpdated)}</span>
          </div>
        </div>

        <div className="text-sm">
          <p className="font-medium mb-2">Workspace: {workspaceName}</p>
          <p className="text-muted-foreground text-xs">
            These rules are automatically generated from your interactions and feedback.
          </p>
        </div>

        {rules.length === 0 ? (
          <div className="text-center py-6">
            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">
              No workspace rules yet. Rules will be automatically created as you provide feedback.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedRules).map(([category, categoryRules]) => (
              <div key={category} className="space-y-2">
                <h4 className="font-medium text-sm capitalize">
                  {category.replace('_', ' ')}
                </h4>
                <div className="space-y-2">
                  {categoryRules.slice(0, isExpanded ? undefined : 3).map((rule) => (
                    <div
                      key={rule.id}
                      className="flex items-start gap-3 p-3 border rounded-lg"
                    >
                      <Badge 
                        variant="secondary" 
                        className={`${getRuleTypeColor(rule.type)} text-xs`}
                      >
                        {rule.type}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{rule.content}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            Confidence: {Math.round(rule.confidence * 100)}%
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(rule.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!isExpanded && categoryRules.length > 3 && (
                    <button
                      onClick={onToggleExpanded}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      +{categoryRules.length - 3} more rules...
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
