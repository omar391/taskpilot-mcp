import { RouterProvider } from '@tanstack/react-router'
import { ThemeProvider } from '@/components/theme-provider'
import { router } from './router'

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="taskpilot-theme">
      <RouterProvider router={router} />
    </ThemeProvider>
  )
}

export default App
