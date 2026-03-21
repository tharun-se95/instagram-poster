/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: { "2xl": "1400px" },
        },
        extend: {
            colors: {
                // ── Brand ─────────────────────────────────────────
                brand: {
                    DEFAULT: "#6c5ce7",
                    from: "#6c5ce7",
                    via: "#a78bfa",
                    to: "#c4b5fd",
                },
                // ── Background layers (light theme) ───────────────
                base: "#f8f7ff",
                surface: "#ffffff",
                overlay: "#f0eeff",
                header: "#0d1535",
                glass: "rgba(108,92,231,0.06)",
                // ── ShadCN CSS variable mapping ───────────────────
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                // ── Status colours ────────────────────────────────
                status: {
                    pending: "#f59e0b",
                    approved: "#22c55e",
                    posted: "#6c5ce7",
                    rejected: "#ef4444",
                    failed: "#ef4444",
                    posting: "#06b6d4",
                },
            },
            // ── Border radius ─────────────────────────────────────
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            // ── Box shadow (light mode) ───────────────────────────
            boxShadow: {
                glass: "0 2px 12px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)",
                card: "0 2px 8px rgba(0,0,0,0.06)",
                glow: "0 0 20px rgba(108,92,231,0.25)",
                "glow-sm": "0 0 10px rgba(108,92,231,0.15)",
            },
            // ── Gradients ─────────────────────────────────────────
            backgroundImage: {
                "brand-gradient": "linear-gradient(135deg, #6c5ce7, #a78bfa)",
                "card-gradient": "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,1) 100%)",
                "glow-radial": "radial-gradient(ellipse at top left, rgba(108,92,231,0.06) 0%, transparent 60%)",
            },
            // ── Animations ────────────────────────────────────────
            keyframes: {
                "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
                "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
                "pulse-glow": { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.5" } },
                "slide-up": { from: { opacity: "0", transform: "translateY(10px)" }, to: { opacity: "1", transform: "translateY(0)" } },
                "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                "pulse-glow": "pulse-glow 2s ease-in-out infinite",
                "slide-up": "slide-up 0.3s ease-out",
                "fade-in": "fade-in 0.2s ease-out",
            },
        },
    },
    plugins: [],
};
