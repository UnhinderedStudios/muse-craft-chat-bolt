import { supabase } from "@/integrations/supabase/client";

export interface DiagnosticResult {
  name: string;
  status: "pass" | "fail" | "warning";
  message: string;
  details?: any;
}

export async function runImageGenerationDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];

  // 1. Check Supabase connection
  try {
    const { data, error } = await supabase.from('album_covers').select('id').limit(1);
    if (error) {
      results.push({
        name: "Supabase Connection",
        status: "fail",
        message: "Failed to connect to Supabase database",
        details: error
      });
    } else {
      results.push({
        name: "Supabase Connection",
        status: "pass",
        message: "Successfully connected to Supabase"
      });
    }
  } catch (e) {
    results.push({
      name: "Supabase Connection",
      status: "fail",
      message: "Exception while connecting to Supabase",
      details: e
    });
  }

  // 2. Check album cover generation health
  try {
    const { data, error } = await supabase.functions.invoke('generate-album-cover/health');

    if (error) {
      results.push({
        name: "Album Cover API Health",
        status: "fail",
        message: "Health check endpoint failed",
        details: error
      });
    } else if (!data?.ok) {
      results.push({
        name: "Album Cover API Health",
        status: "fail",
        message: "Health check returned not OK",
        details: data
      });
    } else if (!data?.geminiKey) {
      results.push({
        name: "Album Cover API Health",
        status: "fail",
        message: "GEMINI_API_KEY not configured in edge function",
        details: { keyLength: data?.keyLength || 0 }
      });
    } else {
      results.push({
        name: "Album Cover API Health",
        status: "pass",
        message: `Edge function healthy. Using model: ${data.model}`,
        details: data
      });
    }
  } catch (e) {
    results.push({
      name: "Album Cover API Health",
      status: "fail",
      message: "Exception while checking health",
      details: e
    });
  }

  // 3. Check storage permissions
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) {
      results.push({
        name: "Storage Permissions",
        status: "fail",
        message: "Cannot list storage buckets",
        details: error
      });
    } else {
      const albumCoversBucket = buckets?.find(b => b.name === 'album-covers');
      if (!albumCoversBucket) {
        results.push({
          name: "Storage Permissions",
          status: "warning",
          message: "album-covers bucket not found",
          details: { availableBuckets: buckets?.map(b => b.name) }
        });
      } else {
        results.push({
          name: "Storage Permissions",
          status: "pass",
          message: "album-covers bucket accessible"
        });
      }
    }
  } catch (e) {
    results.push({
      name: "Storage Permissions",
      status: "fail",
      message: "Exception while checking storage",
      details: e
    });
  }

  // 4. Test a simple generation (optional, commented out to avoid quota usage)
  // Uncomment this to test actual generation
  /*
  try {
    const testPrompt = "Simple test album cover";
    const { data, error } = await supabase.functions.invoke('generate-album-cover', {
      body: { prompt: testPrompt, aspectRatio: "1:1", n: 1 }
    });

    if (error) {
      results.push({
        name: "Test Generation",
        status: "fail",
        message: "Test generation failed",
        details: error
      });
    } else if (data?.error) {
      results.push({
        name: "Test Generation",
        status: "fail",
        message: data.error,
        details: data
      });
    } else if (!data?.images || data.images.length === 0) {
      results.push({
        name: "Test Generation",
        status: "fail",
        message: "No images returned from test generation",
        details: data
      });
    } else {
      results.push({
        name: "Test Generation",
        status: "pass",
        message: `Successfully generated ${data.images.length} test image(s)`
      });
    }
  } catch (e) {
    results.push({
      name: "Test Generation",
      status: "fail",
      message: "Exception during test generation",
      details: e
    });
  }
  */

  return results;
}

export function formatDiagnosticResults(results: DiagnosticResult[]): string {
  let output = "Image Generation Diagnostics\n";
  output += "============================\n\n";

  for (const result of results) {
    const statusIcon = result.status === "pass" ? "✅" : result.status === "warning" ? "⚠️" : "❌";
    output += `${statusIcon} ${result.name}: ${result.status.toUpperCase()}\n`;
    output += `   ${result.message}\n`;
    if (result.details) {
      output += `   Details: ${JSON.stringify(result.details, null, 2)}\n`;
    }
    output += "\n";
  }

  const passCount = results.filter(r => r.status === "pass").length;
  const failCount = results.filter(r => r.status === "fail").length;
  const warnCount = results.filter(r => r.status === "warning").length;

  output += `\nSummary: ${passCount} passed, ${failCount} failed, ${warnCount} warnings\n`;

  return output;
}
