import React, { forwardRef } from "react";

interface DateMaskInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    maskFormat?: "YYYY-MM-DD" | "YYYY-MM";
}

export const DateMaskInput = forwardRef<HTMLInputElement, DateMaskInputProps>(
    ({ onChange, maskFormat = "YYYY-MM-DD", ...props }, ref) => {
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const nativeEvent = e.nativeEvent as InputEvent;
            
            // Allow backspacing without interference if they're exactly at a hyphen
            if (nativeEvent.inputType === "deleteContentBackward") {
                if (onChange) onChange(e);
                return;
            }

            const isMonthMode = maskFormat === "YYYY-MM";
            const maxLen = isMonthMode ? 6 : 8;

            let val = e.target.value.replace(/\D/g, "");
            if (val.length > maxLen) val = val.slice(0, maxLen);
            
            let formatted = val;
            if (val.length >= 5) {
                formatted = `${val.slice(0, 4)}-${val.slice(4)}`;
            }
            if (!isMonthMode && val.length >= 7) {
                formatted = `${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6)}`;
            }
            
            e.target.value = formatted;
            if (onChange) {
                onChange(e);
            }
        };

        return <input ref={ref} onChange={handleChange} {...props} />;
    }
);
DateMaskInput.displayName = "DateMaskInput";
