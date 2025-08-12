// src/components/ui/Button.tsx
import * as React from "react";
import clsx from "clsx";

export type ButtonVariant = "primary" | "secondary" | "destructive";
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const base =
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-50 disabled:pointer-events-none h-10 px-4";

const variantClass: Record<ButtonVariant, string> = {
  primary: "bg-black text-white hover:bg-black/90",
  secondary: "bg-white text-black border hover:bg-black/[0.03]",
  destructive: "bg-red-600 text-white hover:bg-red-700",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(base, variantClass[variant], className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
