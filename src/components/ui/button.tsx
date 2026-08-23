import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-[13px] font-semibold tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 select-none active:scale-[0.97]",
  {
    variants: {
      variant: {
        default: "border border-border bg-surface text-foreground shadow-sm hover:border-border-strong hover:bg-surface-2 hover:shadow-md",
        ghost: "text-muted-2 hover:text-foreground hover:bg-foreground/[0.05] rounded-xl",
        outline: "border border-border text-foreground hover:border-border-strong hover:bg-foreground/[0.03]",
        instant: "border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/50 shadow-sm hover:shadow-[0_0_16px_-4px_var(--glow-primary)]",
        colab: "border border-accent-2/30 bg-accent-2/10 text-accent-2 hover:bg-accent-2/20 hover:border-accent-2/50 shadow-sm hover:shadow-[0_0_16px_-4px_var(--glow-accent)]",
        primary: "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 hover:brightness-110",
        danger: "border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/50",
        subtle: "text-muted-2 hover:text-foreground hover:bg-foreground/[0.04]",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-6 text-sm",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
