import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button system for NeuralForge.
 * Restrained & flat — no fills on secondary actions, no fills on the primary
 * CTA either (border + colored text only). Linear/Raycast aesthetic.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-[13px] font-medium tracking-tight transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 select-none active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "border border-border bg-transparent text-foreground hover:border-border-strong hover:bg-foreground/[0.04]",
        ghost: "text-muted-2 hover:text-foreground hover:bg-foreground/[0.05]",
        outline: "border border-border text-foreground hover:border-border-strong",
        // Primary CTAs: border + colored text, NO background fill.
        instant: "border border-emerald-500/40 text-emerald-400 hover:border-emerald-500/70 hover:text-emerald-300",
        colab: "border border-indigo-400/40 text-indigo-300 hover:border-indigo-400/70 hover:text-indigo-200",
        danger: "border border-rose-500/40 text-rose-400 hover:bg-rose-500/10",
        subtle: "text-muted-2 hover:text-foreground",
      },
      size: {
        default: "h-9 px-3.5",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-5 text-sm",
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
