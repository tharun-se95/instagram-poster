import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * StatCard — used in the dashboard stats row
 * @param {string} label
 * @param {string|number} value
 * @param {React.ElementType} icon - lucide-react icon component
 * @param {string} color - hex colour for the icon accent
 * @param {string} trend - optional e.g. "+12% this week"
 */
export function StatCard({ label, value, icon: Icon, color, trend, className }) {
    return (
        <motion.div
            whileHover={{ scale: 1.02, y: -2 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className={cn(
                "glass-card flex items-center gap-4 p-5 cursor-default",
                className
            )}
            style={{ borderColor: color + "22" }}
        >
            {/* Icon bubble */}
            <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ background: color + "18" }}
            >
                <Icon size={20} style={{ color }} />
            </div>

            {/* Text */}
            <div className="min-w-0">
                <p className="text-2xl font-bold text-foreground tabular-nums leading-none">{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
                {trend && <p className="text-xs mt-1" style={{ color }}>{trend}</p>}
            </div>
        </motion.div>
    );
}

/**
 * SectionHeader — title + optional right-side slot
 */
export function SectionHeader({ title, children, className }) {
    return (
        <div className={cn("flex items-center justify-between mb-4", className)}>
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            {children && <div className="flex items-center gap-2">{children}</div>}
        </div>
    );
}

/**
 * EmptyState — shown when a queue filter has no results
 */
export function EmptyState({ icon: Icon, title, description, action }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16 gap-3 text-center"
        >
            <div className="rounded-2xl bg-muted/50 p-5">
                <Icon size={32} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">{title}</p>
            {description && <p className="text-xs text-muted-foreground max-w-xs">{description}</p>}
            {action}
        </motion.div>
    );
}

/**
 * ServerStatusDot — animated online/offline indicator
 */
export function ServerStatusDot({ online }) {
    return (
        <div className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border",
            online
                ? "bg-green-500/10 text-green-400 border-green-500/25"
                : "bg-red-500/10 text-red-400 border-red-500/25"
        )}>
            <span className={cn(
                "h-1.5 w-1.5 rounded-full",
                online ? "bg-green-400 animate-pulse-glow" : "bg-red-400"
            )} />
            {online ? "Live" : "Offline"}
        </div>
    );
}
