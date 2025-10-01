import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { debounce } from "@/lib/utils";

export type PanelId =
  | "chat"
  | "sessions"
  | "tracklist"
  | "karaoke"
  | "template"
  | "form";

export type ResizeDirection = "horizontal" | "vertical" | "both";

export interface PanelDimensions {
  width?: number;
  height?: number;
}

export interface PanelConstraints {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
}

interface PanelConfig {
  id: PanelId;
  defaultWidth?: number;
  defaultHeight?: number;
  constraints: PanelConstraints;
  direction: ResizeDirection;
}

const FIXED_ELEMENTS = {
  MENU_WIDTH: 0,
  HEADER_HEIGHT: 0,
  DOCK_HEIGHT: 80,
};

const PANEL_CONFIGS: Record<PanelId, PanelConfig> = {
  chat: {
    id: "chat",
    defaultHeight: 640,
    defaultWidth: 800,
    constraints: {
      minWidth: 400,
      maxWidth: 1200,
      minHeight: 440,
      maxHeight: 940,
    },
    direction: "both",
  },
  sessions: {
    id: "sessions",
    defaultHeight: 400,
    defaultWidth: 280,
    constraints: {
      minWidth: 220,
      maxWidth: 450,
      minHeight: 250,
      maxHeight: 800,
    },
    direction: "both",
  },
  tracklist: {
    id: "tracklist",
    defaultHeight: 600,
    defaultWidth: 320,
    constraints: {
      minWidth: 280,
      maxWidth: 500,
      minHeight: 350,
      maxHeight: 1000,
    },
    direction: "both",
  },
  karaoke: {
    id: "karaoke",
    defaultHeight: 400,
    defaultWidth: 350,
    constraints: {
      minWidth: 300,
      maxWidth: 600,
      minHeight: 300,
      maxHeight: 700,
    },
    direction: "both",
  },
  template: {
    id: "template",
    defaultHeight: 400,
    defaultWidth: 300,
    constraints: {
      minWidth: 250,
      maxWidth: 450,
      minHeight: 280,
      maxHeight: 800,
    },
    direction: "both",
  },
  form: {
    id: "form",
    defaultHeight: 400,
    defaultWidth: 600,
    constraints: {
      minWidth: 450,
      maxWidth: 900,
      minHeight: 280,
      maxHeight: 700,
    },
    direction: "both",
  },
};

function getSessionKey(): string {
  let key = localStorage.getItem("panel_session_key");
  if (!key) {
    key = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem("panel_session_key", key);
  }
  return key;
}

export function usePanelResize(panelId: PanelId) {
  const config = PANEL_CONFIGS[panelId];
  const [dimensions, setDimensions] = useState<PanelDimensions>({
    width: config.defaultWidth,
    height: config.defaultHeight,
  });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<"width" | "height" | null>(null);
  const loadedRef = useRef(false);

  const calculateConstraints = useCallback((): PanelConstraints => {
    const viewport = {
      width: window.innerWidth - FIXED_ELEMENTS.MENU_WIDTH,
      height: window.innerHeight - FIXED_ELEMENTS.HEADER_HEIGHT - FIXED_ELEMENTS.DOCK_HEIGHT,
    };

    return {
      minWidth: config.constraints.minWidth,
      maxWidth: Math.min(config.constraints.maxWidth, viewport.width * 0.9),
      minHeight: config.constraints.minHeight,
      maxHeight: Math.min(config.constraints.maxHeight, viewport.height * 0.9),
    };
  }, [config.constraints]);

  const clampDimensions = useCallback(
    (dims: PanelDimensions): PanelDimensions => {
      const constraints = calculateConstraints();
      return {
        width: dims.width
          ? Math.max(constraints.minWidth, Math.min(constraints.maxWidth, dims.width))
          : undefined,
        height: dims.height
          ? Math.max(constraints.minHeight, Math.min(constraints.maxHeight, dims.height))
          : undefined,
      };
    },
    [calculateConstraints]
  );

  const loadDimensions = useCallback(async () => {
    if (loadedRef.current) return;

    try {
      const sessionKey = getSessionKey();
      const { data, error } = await supabase
        .from("panel_dimensions")
        .select("width, height")
        .eq("panel_id", panelId)
        .eq("session_key", sessionKey)
        .eq("layout_preset", "default")
        .maybeSingle();

      if (error) {
        console.warn(`[PanelResize] Error loading ${panelId}:`, error);
        return;
      }

      if (data) {
        const loadedDims = clampDimensions({
          width: data.width || config.defaultWidth,
          height: data.height || config.defaultHeight,
        });
        setDimensions(loadedDims);
        loadedRef.current = true;
      }
    } catch (err) {
      console.error(`[PanelResize] Failed to load ${panelId}:`, err);
    }
  }, [panelId, config, clampDimensions]);

  const saveDimensions = useCallback(
    debounce(async (dims: PanelDimensions) => {
      try {
        const sessionKey = getSessionKey();
        const { error } = await supabase.from("panel_dimensions").upsert(
          {
            panel_id: panelId,
            session_key: sessionKey,
            width: dims.width || null,
            height: dims.height || null,
            layout_preset: "default",
          },
          {
            onConflict: "user_id,session_key,panel_id,layout_preset",
          }
        );

        if (error) {
          console.warn(`[PanelResize] Error saving ${panelId}:`, error);
        }
      } catch (err) {
        console.error(`[PanelResize] Failed to save ${panelId}:`, err);
      }
    }, 500),
    [panelId]
  );

  useEffect(() => {
    loadDimensions();
  }, [loadDimensions]);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, direction: "width" | "height") => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      setResizeDirection(direction);

      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = dimensions.width || config.defaultWidth || 300;
      const startHeight = dimensions.height || config.defaultHeight || 300;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const constraints = calculateConstraints();

        if (direction === "width" && config.direction !== "vertical") {
          const deltaX = moveEvent.clientX - startX;
          const proposedWidth = startWidth + deltaX;

          if (startWidth <= constraints.minWidth && deltaX < 0) {
            return;
          }
          if (startWidth >= constraints.maxWidth && deltaX > 0) {
            return;
          }

          const newWidth = Math.max(
            constraints.minWidth,
            Math.min(constraints.maxWidth, proposedWidth)
          );

          if (newWidth !== dimensions.width) {
            setDimensions((prev) => ({ ...prev, width: newWidth }));
          }
        }

        if (direction === "height" && config.direction !== "horizontal") {
          const deltaY = moveEvent.clientY - startY;
          const proposedHeight = startHeight + deltaY;

          if (startHeight <= constraints.minHeight && deltaY < 0) {
            return;
          }
          if (startHeight >= constraints.maxHeight && deltaY > 0) {
            return;
          }

          const newHeight = Math.max(
            constraints.minHeight,
            Math.min(constraints.maxHeight, proposedHeight)
          );

          if (newHeight !== dimensions.height) {
            setDimensions((prev) => ({ ...prev, height: newHeight }));
          }
        }
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        setResizeDirection(null);
        saveDimensions(dimensions);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [dimensions, config, calculateConstraints, saveDimensions]
  );

  const resetToDefault = useCallback(() => {
    const defaultDims = {
      width: config.defaultWidth,
      height: config.defaultHeight,
    };
    setDimensions(defaultDims);
    saveDimensions(defaultDims);
  }, [config, saveDimensions]);

  return {
    dimensions,
    isResizing,
    resizeDirection,
    constraints: calculateConstraints(),
    handleResizeStart,
    resetToDefault,
    canResizeWidth: config.direction !== "vertical",
    canResizeHeight: config.direction !== "horizontal",
  };
}
