"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import {
  Select as RadixSelect,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from "@radix-ui/react-select"

export function Select({
  children,
  ...props
}: React.ComponentProps<typeof RadixSelect>) {
  return <RadixSelect {...props}>{children}</RadixSelect>
}

Select.Trigger = SelectTrigger
Select.Value = SelectValue
Select.Content = SelectContent
Select.Viewport = SelectViewport
Select.Group = SelectGroup
Select.Label = SelectLabel
Select.Item = SelectItem
Select.Separator = SelectSeparator
Select.Slot = Slot
