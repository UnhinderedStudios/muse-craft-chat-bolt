import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { runImageGenerationDiagnostics, formatDiagnosticResults, DiagnosticResult } from '@/lib/diagnostics';
import { CircleCheck as CheckCircle2, Circle as XCircle, TriangleAlert as AlertTriangle, Play, Loader as Loader2 } from 'lucide-react';

export const DiagnosticsPanel: React.FC = () => {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  const handleRunDiagnostics = async () => {
    setIsRunning(true);
    setHasRun(false);

    try {
      const diagnosticResults = await runImageGenerationDiagnostics();
      setResults(diagnosticResults);
      setHasRun(true);
      console.log(formatDiagnosticResults(diagnosticResults));
    } catch (error) {
      console.error('Diagnostics failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: 'pass' | 'fail' | 'warning') => {
    switch (status) {
      case 'pass':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const passCount = results.filter(r => r.status === 'pass').length;
  const failCount = results.filter(r => r.status === 'fail').length;
  const warnCount = results.filter(r => r.status === 'warning').length;

  return (
    <Card className="w-full max-w-2xl mx-auto bg-black/40 border-white/10">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <span>Image Generation Diagnostics</span>
          <Button
            onClick={handleRunDiagnostics}
            disabled={isRunning}
            variant="outline"
            size="sm"
            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run Diagnostics
              </>
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasRun && !isRunning && (
          <div className="text-white/60 text-center py-8">
            Click "Run Diagnostics" to check your image generation configuration
          </div>
        )}

        {isRunning && (
          <div className="text-white/60 text-center py-8">
            <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin" />
            Running diagnostics...
          </div>
        )}

        {hasRun && !isRunning && (
          <div className="space-y-4">
            {results.length > 0 && (
              <div className="flex gap-4 mb-6 p-4 bg-white/5 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-white/80">{passCount} Passed</span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span className="text-white/80">{failCount} Failed</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  <span className="text-white/80">{warnCount} Warnings</span>
                </div>
              </div>
            )}

            {results.map((result, index) => (
              <div
                key={index}
                className="p-4 bg-white/5 rounded-lg border border-white/10"
              >
                <div className="flex items-start gap-3">
                  {getStatusIcon(result.status)}
                  <div className="flex-1">
                    <div className="font-medium text-white mb-1">{result.name}</div>
                    <div className="text-sm text-white/60">{result.message}</div>
                    {result.details && (
                      <details className="mt-2">
                        <summary className="text-xs text-white/40 cursor-pointer hover:text-white/60">
                          Show details
                        </summary>
                        <pre className="mt-2 text-xs text-white/60 bg-black/40 p-2 rounded overflow-x-auto">
                          {JSON.stringify(result.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
