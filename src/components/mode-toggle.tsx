import { Check, Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme } from '@/components/theme-provider'

export function ModeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="icon" />}>
        <Sun className="size-4 scale-100 rotate-0 transition-all motion-reduce:transition-none dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute size-4 scale-0 rotate-90 transition-all motion-reduce:transition-none dark:scale-100 dark:rotate-0" />
        <span className="sr-only">Cambiar tema</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(['Claro', 'Oscuro', 'Sistema'] as const).map((label, index) => {
          const option = (['light', 'dark', 'system'] as const)[index]
          return (
            <DropdownMenuItem key={option} onClick={() => setTheme(option)}>
              <span>{label}</span>
              {theme === option && <Check className="ml-auto" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
