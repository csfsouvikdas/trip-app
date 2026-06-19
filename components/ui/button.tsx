import * as React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "accent";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-apple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none active:scale-[0.98]",
          // Variants
          variant === "default" && "bg-neutral-900 text-neutral-50 hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200 shadow-sm",
          variant === "destructive" && "bg-red-500 text-white hover:bg-red-600 dark:bg-red-900 dark:text-red-50 dark:hover:bg-red-800 shadow-sm",
          variant === "outline" && "border border-neutral-200 bg-transparent hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900",
          variant === "secondary" && "bg-neutral-100 text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-50 dark:hover:bg-neutral-700",
          variant === "ghost" && "hover:bg-neutral-100 dark:hover:bg-neutral-800",
          variant === "link" && "text-neutral-900 underline-offset-4 hover:underline dark:text-neutral-50",
          variant === "accent" && "bg-[hsl(var(--accent))] text-white hover:bg-[hsl(var(--accent))/0.9] shadow-sm",
          // Sizes
          size === "default" && "h-10 px-4 py-2",
          size === "sm" && "h-8 rounded-md px-3 text-xs",
          size === "lg" && "h-12 rounded-xl px-8 text-base",
          size === "icon" && "h-10 w-10",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, cn };
