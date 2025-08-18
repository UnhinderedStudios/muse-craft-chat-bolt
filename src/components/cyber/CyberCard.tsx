import React from "react";
import { cn } from "@/lib/utils";

interface CyberCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "alt";
}

export const CyberCard: React.FC<CyberCardProps> = ({ 
  children, 
  className, 
  variant = "default" 
}) => {
  return (
    <div 
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