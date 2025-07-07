import { Link, useLocation, useParams } from '@tanstack/react-router'
import { CheckSquare, Settings, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

export function FloatingNav() {
  const location = useLocation()
  const params = useParams({ strict: false })
  const workspaceId = params?.workspaceId

  // If we're in a workspace context, show workspace-scoped navigation
  if (workspaceId) {
    const navItems = [
      {
        label: 'Tasks',
        path: `/workspace/${workspaceId}/tasks`,
        icon: CheckSquare,
      },
      {
        label: 'Tool Flows',
        path: `/workspace/${workspaceId}/tool-flows`,
        icon: Settings,
      },
      {
        label: 'Feedback Steps',
        path: `/workspace/${workspaceId}/feedback-steps`,
        icon: MessageSquare,
      },
    ]

    return (
      <nav className="floating-nav">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn('nav-item', isActive && 'active')}
            >
              <Icon size={20} />
              <span className="text-xs mt-1 font-medium">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    )
  }

  // Default navigation for home page (no floating nav shown)
  return null
}
