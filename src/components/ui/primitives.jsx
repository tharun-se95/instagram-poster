import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

// ─── Switch ─────────────────────────────────────────────────────────────────
const Switch = React.forwardRef(({ className, ...props }, ref) => (
    <SwitchPrimitive.Root
        className={cn(
            "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent",
            "transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "data-[state=checked]:bg-brand data-[state=unchecked]:bg-muted",
            className
        )}
        {...props}
        ref={ref}
    >
        <SwitchPrimitive.Thumb
            className={cn(
                "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0",
                "transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
            )}
        />
    </SwitchPrimitive.Root>
));
Switch.displayName = SwitchPrimitive.Root.displayName;

// ─── Separator ──────────────────────────────────────────────────────────────
const Separator = React.forwardRef(
    ({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
        <SeparatorPrimitive.Root
            ref={ref}
            decorative={decorative}
            orientation={orientation}
            className={cn(
                "shrink-0 bg-border/50",
                orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
                className
            )}
            {...props}
        />
    )
);
Separator.displayName = SeparatorPrimitive.Root.displayName;

// ─── Tooltip ────────────────────────────────────────────────────────────────
const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;
const TooltipContent = React.forwardRef(({ className, sideOffset = 4, ...props }, ref) => (
    <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
            "z-50 overflow-hidden rounded-md glass-card px-3 py-1.5 text-xs text-foreground",
            "animate-fade-in",
            className
        )}
        {...props}
    />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Switch, Separator, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
