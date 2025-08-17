import React from "react";
import { cn } from "@/lib/utils";

interface CyberButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "icon";
  children: React.ReactNode;
}

export const CyberButton: React.FC<CyberButtonProps> = ({ 
  variant = "primary", 
  children, 
  className, 
  ...props 
}) => {
  if (variant === "primary") {
    return (
      <button 
        className={cn(
          "w-full h-14 rounded-pill font-medium text-white",
          "gradient-primary hover:gradient-primary-hover",
          "transition-all duration-200 hover:shadow-[var(--shadow-glow-strong)]",
          "active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
          "flex items-center justify-center gap-2",
          className
        )}
        style={{
          boxShadow: "var(--shadow-glow)"
        }}
        {...props}
      >
        {children}
      </button>
    );
  }

  if (variant === "icon") {
    return (
      <button 
        className={cn(
          "w-10 h-10 rounded-lg bg-card-alt border border-border-main",
          "hover:border-accent-primary transition-colors duration-200",
          "flex items-center justify-center",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }

  return (
    <button 
      className={cn(
        "px-4 py-2 rounded-input bg-card-alt border border-border-main",
        "hover:border-accent-primary transition-colors duration-200",
        "text-text-primary",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};