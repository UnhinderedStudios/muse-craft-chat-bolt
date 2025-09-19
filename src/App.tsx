import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DragProvider } from "@/contexts/DragContext";
import { DragOverlay } from "@/components/drag/DragOverlay";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { SessionManagerProvider } from "@/contexts/SessionManagerContext";
import { GlobalPlayerProvider } from "@/contexts/GlobalPlayerContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <SessionManagerProvider>
        <GlobalPlayerProvider>
        <DragProvider>
          <Toaster />
          <Sonner />
          <DragOverlay />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </DragProvider>
        </GlobalPlayerProvider>
      </SessionManagerProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
