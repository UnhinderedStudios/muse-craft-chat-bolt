import React from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface SessionsPanelProps {
  className?: string;
}

const navItems = [
  { id: 'generators', label: 'Generators', active: true },
  { id: 'explore', label: 'Explore', active: false },
  { id: 'playlists', label: 'Playlists', active: false },
  { id: 'artists', label: 'Artists', active: false },
  { id: 'support', label: 'Support', active: false },
  { id: 'learn', label: 'Learn', active: false },
  { id: 'more', label: 'More', active: false },
];

export function SessionsPanel({ className }: SessionsPanelProps) {

  return (
    <div className={cn("h-full bg-[#151515] rounded-2xl flex flex-col p-6", className)}>
      {/* Brand Title */}
      <div className="shrink-0 mb-8">
        <h1 className="text-white text-2xl font-semibold tracking-wide">Soundify</h1>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.id}>
              <button
                className={cn(
                  "w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-3",
                  item.active
                    ? "bg-white/5 text-white"
                    : "text-white/70 hover:text-white/90 hover:bg-white/3"
                )}
              >
                {item.active && (
                  <div className="w-2 h-2 rounded-full bg-[#ff006b] shadow-[0_0_8px_#ff006b]" />
                )}
                <span className={item.active ? "ml-0" : "ml-5"}>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Profile Section */}
      <div className="shrink-0 mt-auto">
        {/* Profile Card */}
        <div className="flex items-center gap-3 p-4 bg-white/3 rounded-lg mb-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src="/lovable-uploads/1584f62c-0eb0-4c5e-9da2-b0a744581697.png" alt="Sir Brom" />
            <AvatarFallback className="bg-white/10 text-white text-sm">SB</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="text-white font-medium text-sm mb-1">Sir Brom</div>
            <div className="text-white/60 text-xs leading-tight">
              <div>Pro Plan – Monthly</div>
              <div>Credits – 232,323</div>
            </div>
          </div>
        </div>

        {/* Upgrade Link */}
        <button className="text-white/50 hover:text-white/70 text-sm transition-colors">
          Upgrade / Top Up
        </button>
      </div>
    </div>
  );
}