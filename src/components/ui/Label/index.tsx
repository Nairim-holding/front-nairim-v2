import React from "react";

export interface LabelProps {
    id?: string;
    svg?: React.ReactNode;
    label?: string;
    required?: boolean;
}

export default function Label({ id, svg, label, required }: LabelProps) {
    if (!label) return null;
    
    return (
        <label htmlFor={id} className="flex items-center gap-4 pl-2 mb-2 max-h-[20px]">
            {svg && svg}
            <p className="text-content-secondary text-[14px] font-normal">
                {label}
                {required && <span className="text-red-600">*</span>}
            </p>
        </label>
    );
}