import { createFileRoute } from '@tanstack/react-router'

import { ModeToggle } from '@/components/mode-toggle'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold">Welcome to TanStack Start</h1>
        <ModeToggle />
      </div>
      <p className="mt-4 text-lg">
        Edit <code>src/routes/index.tsx</code> to get started.
      </p>
      <Button variant="outline">shadcn button</Button>
    </div>
  )
}
