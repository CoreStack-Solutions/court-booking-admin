"use client";

import * as LabelPrimitive from "@radix-ui/react-label";
import * as React from "react";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

// Memoizar el asterisco con tooltip para evitar re-renders infinitos
const RequiredIndicator = React.memo(
    ({ tooltip }: { tooltip: string }) => (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className="text-destructive font-bold cursor-help leading-none">
                    *
                </span>
            </TooltipTrigger>
            <TooltipContent>
                <p>{tooltip}</p>
            </TooltipContent>
        </Tooltip>
    ),
    (prev, next) => prev.tooltip === next.tooltip,
);
RequiredIndicator.displayName = "RequiredIndicator";

function Label({
    className,
    required,
    requiredTooltip = "Este campo es obligatorio",
    children,
    ...props
}: React.ComponentProps<typeof LabelPrimitive.Root> & {
    required?: boolean;
    requiredTooltip?: string;
}) {
    if (required) {
        return (
            <LabelPrimitive.Root
                data-slot="label"
                className={cn(
                    "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
                    className,
                )}
                {...props}
            >
                {children}
                <RequiredIndicator tooltip={requiredTooltip} />
            </LabelPrimitive.Root>
        );
    }

    return (
        <LabelPrimitive.Root
            data-slot="label"
            className={cn(
                "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
                className,
            )}
            {...props}
        >
            {children}
        </LabelPrimitive.Root>
    );
}

export { Label };
