import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Copy, Maximize2 } from "lucide-react";

interface DashboardWrapperProps {
    name: string;
    children: React.ReactNode;
    className?: string;
}

export const DashboardWrapper = ({
    name,
    children,
    className,
}: DashboardWrapperProps) => {
    return (
        <div
            className={cn(
                "bg-sidebar-border/40 p-1 pb-[2px] flex flex-col rounded-[14px] group dark:shadow-md border border-sidebar-border/50",
                className
            )}
        >
            <div className="pb-1.5 h-8 py-1 pl-3 pr-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-medium leading-none uppercase tracking-wider">
                        {name}
                    </span>
                </div>

            </div>
            <div className="flex-1 w-full grid">
                {children}
            </div>
        </div >
    );
};

export default DashboardWrapper;
