import { Badge } from '@/components/ui/badge'
import { Wifi, WifiOff, AlertCircle, CheckCircle2 } from 'lucide-react'

interface ConnectionStatusProps {
  status: 'connected' | 'disconnected' | 'error' | 'connecting'
  message?: string
  showIcon?: boolean
  className?: string
}

export function ConnectionStatus({ 
  status, 
  message, 
  showIcon = true, 
  className 
}: ConnectionStatusProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'connected':
        return {
          icon: CheckCircle2,
          label: 'Connected',
          variant: 'default' as const,
          className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-800'
        }
      case 'connecting':
        return {
          icon: Wifi,
          label: 'Connecting...',
          variant: 'secondary' as const,
          className: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-800'
        }
      case 'error':
        return {
          icon: AlertCircle,
          label: 'Error',
          variant: 'destructive' as const,
          className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-800'
        }
      case 'disconnected':
      default:
        return {
          icon: WifiOff,
          label: 'Disconnected',
          variant: 'outline' as const,
          className: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:border-gray-800'
        }
    }
  }

  const config = getStatusConfig(status)
  const Icon = config.icon

  return (
    <Badge 
      variant={config.variant}
      className={`${config.className} ${className || ''}`}
    >
      {showIcon && <Icon size={12} className="mr-1" />}
      {message || config.label}
    </Badge>
  )
}
