import { createRouter, createRoute, createRootRoute } from '@tanstack/react-router'
import { HomePage } from './pages/home'
import { TasksPage } from './pages/tasks'
import { ToolFlowsPage } from './pages/tool-flows'
import { FeedbackStepsPage } from './pages/feedback-steps'

// Root route
const rootRoute = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">TaskPilot</h1>
            <p className="text-gray-600">Model Context Protocol Task Manager</p>
          </div>
          
          {/* Content */}
          <div id="router-outlet">
            {/* This is where child routes will render */}
          </div>
        </div>
      </div>
    </div>
  ),
})

// Home route
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

// Workspace routes
const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workspace/$workspaceId',
  component: () => <div>Workspace Layout</div>,
})

const tasksRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/tasks',
  component: TasksPage,
})

const toolFlowsRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/tool-flows',
  component: ToolFlowsPage,
})

const feedbackStepsRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/feedback-steps',
  component: FeedbackStepsPage,
})

// Create the route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  workspaceRoute.addChildren([
    tasksRoute,
    toolFlowsRoute,
    feedbackStepsRoute,
  ]),
])

// Create router
export const router = createRouter({ routeTree })