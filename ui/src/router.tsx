import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'
import { FloatingNav } from '@/components/floating-nav'
import { HomePage } from '@/pages/home'
import { ToolFlowsPage } from '@/pages/tool-flows'
import { FeedbackStepsPage } from '@/pages/feedback-steps'

// Root route component
function RootComponent() {
  return (
    <div className="mobile-app">
      <main className="main-content">
        <Outlet />
      </main>
      <FloatingNav />
    </div>
  )
}

// Create root route
const rootRoute = createRootRoute({
  component: RootComponent,
})

// Create home route
const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

// Create tool flows route
const toolFlowsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tool-flows',
  component: ToolFlowsPage,
})

// Create feedback steps route
const feedbackStepsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/feedback-steps',
  component: FeedbackStepsPage,
})

// Create route tree
const routeTree = rootRoute.addChildren([
  homeRoute,
  toolFlowsRoute,
  feedbackStepsRoute,
])

// Create router
export const router = createRouter({ routeTree })
