import { ActiveGeneration } from "@/hooks/use-concurrent-generation";

interface GenerationLoadingShellProps {
  generation: ActiveGeneration;
  onCancel?: (id: string) => void;
}

export function GenerationLoadingShell({ generation, onCancel }: GenerationLoadingShellProps) {
  return (
    <div className="group relative flex items-center gap-3 p-3 rounded-lg bg-card border border-border hover:border-accent transition-colors">
      {/* Album art placeholder with pulsing animation */}
      <div className="shrink-0 w-12 h-12 rounded-lg bg-muted animate-pulse flex items-center justify-center">
        <div className="w-6 h-6 text-muted-foreground">♪</div>
      </div>
      
      {/* Track info with progress */}
      <div className="flex-1 min-w-0 pr-2">
        <div className="space-y-1">
          {/* Title with generation info */}
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-foreground text-sm truncate">
              {generation.details.title || "Generating Song..."}
            </h3>
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {generation.status}
            </span>
          </div>
          
          {/* Progress text */}
          <p className="text-xs text-muted-foreground truncate">
            {generation.progressText}
          </p>
          
          {/* Progress bar */}
          <div className="w-full bg-muted rounded-full h-1.5">
            <div 
              className="bg-accent-primary h-1.5 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${generation.progress}%` }}
            />
          </div>
        </div>
      </div>
      
      {/* Loading spinner */}
      <div className="shrink-0 w-8 h-8 flex items-center justify-center">
        <div className="relative w-4 h-4">
          {/* Background ring */}
          <div className="absolute inset-0 border-2 border-accent-primary/20 rounded-full"></div>
          {/* Spinning progress ring */}
          <div 
            className="absolute inset-0 border-2 border-transparent border-t-accent-primary rounded-full animate-spin"
            style={{
              filter: 'drop-shadow(0 0 4px rgba(249, 44, 143, 0.4))'
            }}
          />
        </div>
      </div>
      
      {/* Cancel button (appears on hover) */}
      {onCancel && (
        <button
          onClick={() => onCancel(generation.id)}
          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-background/80 hover:bg-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Cancel generation"
        >
          <span className="text-xs text-muted-foreground">×</span>
        </button>
      )}
    </div>
  );
}