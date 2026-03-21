import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors",
    {
        variants: {
            variant: {
                default: "bg-brand/20 text-brand-to border-brand/30",
                outline: "border-border text-muted-foreground",
                pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
                approved: "bg-green-500/15 text-green-400 border-green-500/30",
                posted: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
                rejected: "bg-red-500/15 text-red-400 border-red-500/30",
                failed: "bg-red-500/15 text-red-400 border-red-500/30",
                posting: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
                online: "bg-green-500/15 text-green-400 border-green-500/30",
                offline: "bg-red-500/15 text-red-400 border-red-500/30",
            },
        },
        defaultVariants: { variant: "default" },
    }
);

/** Maps queue status strings to badge variants automatically */
const STATUS_VARIANT_MAP = {
    PENDING: "pending",
    APPROVED: "approved",
    POSTED: "posted",
    REJECTED: "rejected",
    FAILED: "failed",
    POSTING: "posting",
};

function Badge({ className, variant, status, children, ...props }) {
    const resolvedVariant = status
        ? STATUS_VARIANT_MAP[status] ?? "outline"
        : variant;
    return (
        <span className={cn(badgeVariants({ variant: resolvedVariant }), className)} {...props}>
            {children ?? status}
        </span>
    );
}

export { Badge, badgeVariants };
