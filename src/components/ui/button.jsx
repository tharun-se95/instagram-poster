import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 select-none",
    {
        variants: {
            variant: {
                default:
                    "bg-brand-gradient bg-[length:200%_200%] text-white shadow-glow-sm hover:shadow-glow hover:scale-[1.02] active:scale-[0.98]",
                outline:
                    "border border-white/10 bg-white/[0.04] text-foreground hover:bg-white/[0.08] hover:border-brand/50 backdrop-blur-sm",
                ghost:
                    "text-muted-foreground hover:text-foreground hover:bg-white/[0.06]",
                destructive:
                    "bg-destructive/20 text-destructive border border-destructive/30 hover:bg-destructive/30",
                success:
                    "bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30",
                secondary:
                    "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                link:
                    "text-brand underline-offset-4 hover:underline p-0 h-auto",
            },
            size: {
                default: "h-9 px-4 py-2",
                sm: "h-7 px-3 text-xs",
                lg: "h-11 px-6 text-base",
                icon: "h-9 w-9",
                "icon-sm": "h-7 w-7",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
);

const Button = React.forwardRef(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button";
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        );
    }
);
Button.displayName = "Button";

export { Button, buttonVariants };
