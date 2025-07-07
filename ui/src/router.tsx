import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'
import { FloatingNav } from '@/components/floating-nav'
import { HomePage } from '@/pages/home'
import { TasksPage } from '@/pages/tasks'
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

// Workspace layout component
function WorkspaceLayout() {
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

// Create workspace parent route
const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workspace/$workspaceId',
  component: WorkspaceLayout,
})

// Create tasks route (workspace-scoped)
const tasksRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/tasks',
  component: TasksPage,
})

// Create tool flows route (now workspace-scoped)
const toolFlowsRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/tool-flows',
  component: ToolFlowsPage,
})

// Create feedback steps route (now workspace-scoped)
const feedbackStepsRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/feedback-steps',
  component: FeedbackStepsPage,
})

// Create route tree
const routeTree = rootRoute.addChildren([
  homeRoute,
  workspaceRoute.addChildren([
    tasksRoute,
    toolFlowsRoute,
    feedbackStepsRoute,
  ]),
])

// Create router
export const router = createRouter({ routeTree })
