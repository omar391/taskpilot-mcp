import { Link, useLocation } from '@tanstack/react-router'
import { Home, Settings, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  {
    label: 'Home',
    path: '/',
    icon: Home,
  },
  {
    label: 'Tool Flows',
    path: '/tool-flows',
    icon: Settings,
  },
  {
    label: 'Feedback Steps',
    path: '/feedback-steps',
    icon: MessageSquare,
  },
]

export function FloatingNav() {
  const location = useLocation()

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
