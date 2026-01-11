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
                "bg-sidebar-border/40 p-1 rounded-[14px] group dark:shadow-md border border-sidebar-border/50",
                className
            )}
        >
            <div className="pb-1.5 py-1 pl-3 pr-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-medium leading-none uppercase tracking-wider">
                        {name}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                        <Copy className="w-3 h-3" />
                    </Button>
                    <Button variant="outline" className="text-[10px] h-6 px-2 bg-background/50 hover:bg-background border-sidebar-border">
                        View Details
                    </Button>
                </div>
            </div>
            <div className="h-full">
                {children}
            </div>
        </div>
    );
};

export default DashboardWrapper;
