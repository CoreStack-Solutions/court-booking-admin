import * as React from 'react'
import { Clock } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface TimePickerProps {
  value: string // e.g. "07:30" or "18:00"
  onChange: (value: string) => void
  disabled?: boolean
  label?: string
}

export function TimePicker({ value, onChange, disabled, label }: TimePickerProps) {
  const [open, setOpen] = React.useState(false)

  // Generate hours from 06:00 to 23:30 in 30-minute intervals
  const timeSlots = React.useMemo(() => {
    const slots = []
    for (let h = 6; h <= 23; h++) {
      const hourStr = String(h).padStart(2, '0')
      slots.push(`${hourStr}:00`)
      slots.push(`${hourStr}:30`)
    }
    slots.push('00:00')
    return slots
  }, [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal text-left gap-2',
            !value && 'text-muted-foreground'
          )}
        >
          <span className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground shrink-0" />
            {value || label || 'Seleccionar hora'}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1 max-h-64 overflow-y-auto" align="start">
        <div className="grid grid-cols-2 gap-1 p-1">
          {timeSlots.map((slot) => {
            const isSelected = value === slot
            return (
              <Button
                key={slot}
                variant={isSelected ? 'default' : 'ghost'}
                size="sm"
                onClick={() => {
                  onChange(slot)
                  setOpen(false)
                }}
                className={cn(
                  'justify-center text-xs font-semibold h-8',
                  isSelected && 'bg-primary text-primary-foreground font-bold'
                )}
              >
                {slot}
              </Button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
