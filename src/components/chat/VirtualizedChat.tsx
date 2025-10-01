import React, { memo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChatBubble } from "./ChatBubble";
import { Spinner } from "@/components/ui/spinner";
import { ImageAnalysisLoader } from "@/components/ui/image-analysis-loader";
import { logger } from "@/lib/logger";

interface ChatFeedItem {
  type?: string;
  id?: string;
  role?: "user" | "assistant";
  content?: string;
  isAnalyzingImage?: boolean;
  isReadingText?: boolean;
}

interface VirtualizedChatProps {
  chatFeed: ChatFeedItem[];
  scrollerRef: React.RefObject<HTMLDivElement>;
  bottomPad: number;
}

const GAP_PX = 16;

export const VirtualizedChat = memo<VirtualizedChatProps>(({ chatFeed, scrollerRef, bottomPad }) => {
  try {
    const virtualizer = useVirtualizer({
      count: chatFeed.length,
      getScrollElement: () => scrollerRef.current,
      estimateSize: () => 100,
      overscan: 5,
    });

    return (
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
          paddingBottom: bottomPad,
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const m = chatFeed[virtualItem.index];
          return (
            <div
              key={virtualItem.key}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {m?.type === "status" && m?.id === "__status__" ? (
                <div className="space-y-3" role="status" aria-live="polite">
                  {m.isAnalyzingImage && <ImageAnalysisLoader text="Analyzing Image..." />}
                  {m.isReadingText && <ImageAnalysisLoader text="Reading Document..." />}
                  {!m.isAnalyzingImage && !m.isReadingText && <Spinner />}
                </div>
              ) : (
                <ChatBubble role={m.role!} content={m.content!} />
              )}
              <div style={{ height: GAP_PX }} />
            </div>
          );
        })}
      </div>
    );
  } catch (error) {
    logger.warn('Virtualization failed, falling back to regular rendering:', error);
    return (
      <>
        {chatFeed.map((m, i) => {
          if (m?.type === "status" && m?.id === "__status__") {
            return (
              <div key="__status__" className="space-y-3" role="status" aria-live="polite">
                {m.isAnalyzingImage && <ImageAnalysisLoader text="Analyzing Image..." />}
                {m.isReadingText && <ImageAnalysisLoader text="Reading Document..." />}
                {!m.isAnalyzingImage && !m.isReadingText && <Spinner />}
              </div>
            );
          }
          return <ChatBubble key={i} role={m.role!} content={m.content!} />;
        })}
      </>
    );
  }
});

VirtualizedChat.displayName = 'VirtualizedChat';
