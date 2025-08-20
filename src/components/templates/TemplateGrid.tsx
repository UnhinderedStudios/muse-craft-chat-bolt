import { CyberCard } from "@/components/cyber/CyberCard";
import { CyberButton } from "@/components/cyber/CyberButton";
import { Spinner } from "@/components/ui/spinner";

interface TemplateGridProps {
  albumCovers: any;
  isGeneratingCovers: boolean;
  onGenerateCovers: () => void;
  busy: boolean;
}

export function TemplateGrid({
  albumCovers,
  isGeneratingCovers,
  onGenerateCovers,
  busy
}: TemplateGridProps) {
  return (
    <CyberCard className="h-full">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-medium text-cyber-primary">Templates</h3>
        <CyberButton
          onClick={onGenerateCovers}
          disabled={busy || isGeneratingCovers}
          variant="secondary"
        >
          {isGeneratingCovers ? <Spinner className="w-4 h-4" /> : "Generate"}
        </CyberButton>
      </div>
      
      <div className="grid grid-cols-1 gap-4 h-[calc(100%-80px)] overflow-y-auto">
        {albumCovers ? (
          <>
            <div className="aspect-square relative group cursor-pointer bg-black/20 rounded-lg overflow-hidden border border-cyber-accent/30 hover:border-cyber-primary/50 transition-colors">
              <img
                src={albumCovers.cover1}
                alt="Album Cover 1"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="aspect-square relative group cursor-pointer bg-black/20 rounded-lg overflow-hidden border border-cyber-accent/30 hover:border-cyber-primary/50 transition-colors">
              <img
                src={albumCovers.cover2}
                alt="Album Cover 2"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            No templates generated yet
          </div>
        )}
      </div>
    </CyberCard>
  );
}