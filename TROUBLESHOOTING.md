# Image Generation Troubleshooting Guide

## Quick Test

1. Open `test-image-generation.html` in your browser
2. It will automatically run a health check
3. Look for the results to identify the issue

## Most Common Issue: Missing GEMINI_API_KEY

### Symptoms:
- Images don't generate (stuck loading or immediate failure)
- Error message: "Server configuration error: GEMINI_API_KEY not set"
- Health check shows `geminiKey: false`

### Solution:

**You MUST configure the GEMINI_API_KEY in Supabase Edge Function secrets:**

1. Go to your Supabase Dashboard
2. Navigate to: **Edge Functions** → **Settings** (or Secrets)
3. Add a new secret:
   - Name: `GEMINI_API_KEY`
   - Value: Your Google AI Studio API key

**How to get a GEMINI_API_KEY:**

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key" or "Get API Key"
4. Copy the API key
5. Add it to Supabase Edge Function secrets (see above)

**Important Notes:**
- The API key must be set in Supabase Edge Functions, NOT in your `.env` file
- After setting the key, edge functions will automatically use it
- You may need to redeploy the edge function after adding the secret

## Step-by-Step Diagnosis

### Step 1: Check Browser Console

Open your browser's developer console (F12) and look for errors when you try to generate an image.

**Common errors and fixes:**

#### Error: "Server configuration error: GEMINI_API_KEY not set"
→ **Fix:** Configure GEMINI_API_KEY in Supabase (see above)

#### Error: "Image generation timed out"
→ **Fix:** Try a simpler prompt, or check your internet connection

#### Error: "Failed to invoke edge function"
→ **Fix:** Check that your edge functions are deployed in Supabase

#### Error: "No images generated. The prompt may have been filtered"
→ **Fix:** Your prompt violated Google's content policy. Try a more neutral prompt.

### Step 2: Run Health Check

Use the test file:
```bash
# Open test-image-generation.html in your browser
# Or navigate to it in your deployed app
```

The health check will tell you:
- ✅ API key is configured
- ❌ API key is missing
- ⚠️ Other configuration issues

### Step 3: Check Supabase Edge Function Logs

1. Go to Supabase Dashboard
2. Navigate to **Edge Functions** → Your Function → **Logs**
3. Look for error messages when you try to generate an image

**Common log errors:**

#### "Missing GEMINI_API_KEY"
→ Configure the API key in secrets

#### "PERMISSION_DENIED" or "API_KEY_INVALID"
→ Your API key is invalid or doesn't have access to the Imagen API

#### "RESOURCE_EXHAUSTED" or "QUOTA_EXCEEDED"
→ You've exceeded your Google API quota. Check Google Cloud Console.

#### Timeout or no response
→ Network issue or Google API is slow. The 55s timeout should handle this.

### Step 4: Verify Edge Function Deployment

Run this command to check if the edge function is properly deployed:

```bash
# In Supabase Dashboard, check Edge Functions list
# Ensure "generate-album-cover" is listed and active
```

### Step 5: Test with Simple Prompt

Try generating an image with a very simple, neutral prompt:
- "A blue sky"
- "A red apple"
- "Abstract colorful shapes"

If simple prompts work but complex ones don't, your prompts are being filtered.

## Configuration Checklist

- [ ] GEMINI_API_KEY configured in Supabase Edge Functions
- [ ] Edge functions deployed to Supabase
- [ ] Storage bucket "album-covers" exists and is accessible
- [ ] Database table "album_covers" exists
- [ ] Internet connection is working
- [ ] Google AI Studio API key is valid
- [ ] You have quota remaining on Google Cloud

## Testing the Fix

After configuring the API key:

1. Wait 30 seconds for the configuration to propagate
2. Refresh your browser page
3. Try generating an image with a simple prompt
4. Check the browser console for success messages

**Expected console output on success:**
```
🎯 [timestamp] Imagen Edge Function Debug:
  📝 Received prompt: your prompt here
  🤖 Model: imagen-4.0-generate-001
✅ [timestamp] Success! Generated 1 images
```

## Still Not Working?

If you've completed all steps above and it still doesn't work:

### Check Google AI API Status
- Visit [Google Cloud Status](https://status.cloud.google.com/)
- Verify the Imagen API is operational

### Verify API Permissions
- Go to [Google Cloud Console](https://console.cloud.google.com/)
- Check that your API key has permissions for "Generative Language API"
- Ensure billing is enabled if required

### Check Rate Limits
- Google may rate-limit requests
- Wait a few minutes and try again
- Check your quota in Google Cloud Console

### Contact Support
If all else fails:
1. Save your browser console logs
2. Save your Supabase edge function logs
3. Note the exact error messages you're seeing
4. Provide this information when seeking help

## FAQ

**Q: Do I need a Google Cloud account?**
A: You need a Google account to get an API key from Google AI Studio. Billing may be required depending on usage.

**Q: Is the API key free?**
A: Google AI Studio offers free tier access, but check current pricing at [ai.google.dev](https://ai.google.dev)

**Q: Where do I add the API key?**
A: In Supabase Dashboard → Edge Functions → Settings/Secrets, NOT in your .env file

**Q: Do I need to redeploy after adding the key?**
A: Usually no, but you may need to redeploy the edge function if it doesn't work immediately

**Q: Why do some prompts fail?**
A: Google filters prompts that violate their content policy. Use neutral, descriptive language.

## Emergency Fallback

If you need to quickly disable image generation:
1. Comment out the generation calls in your UI
2. Or set a feature flag to disable the feature
3. Fix the configuration issue
4. Re-enable the feature

## Success Indicators

When everything is working correctly, you should see:
1. Health check passes (geminiKey: true)
2. Images generate in 10-30 seconds
3. No error messages in console
4. Generated images display in the UI
5. Images are saved to Supabase storage
