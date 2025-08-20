import React from "react";
import { cn } from "@/lib/utils";

interface CyberCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "alt";
}

export const CyberCard: React.FC<CyberCardProps> = ({ 
  children, 
  className, 
  variant = "default",
  ...props
}) => {
  return (
    <div 
      {...props}
      className={cn(
        "rounded-card p-6 border border-border-main",
        variant === "default" ? "bg-card" : "bg-card-alt",
        "shadow-[var(--shadow-card)]",
        className
      )}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {children}
    </div>
  );
};