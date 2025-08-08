"use client"

import { DayPicker } from "react-day-picker"
import "react-day-picker/dist/style.css"

export function Calendar({
  className,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays
      className={className}
      {...props}
    />
  )
}
