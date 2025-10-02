# Quick Fix: Images Not Generating

## 🔥 Most Likely Issue: Missing API Key

### The Fix (2 minutes):

1. **Get a Google AI API Key**
   - Go to: https://aistudio.google.com/app/apikey
   - Sign in
   - Click "Create API Key"
   - Copy the key (starts with "AIza...")

2. **Add it to Supabase**
   - Open your Supabase Dashboard
   - Go to: **Edge Functions** → **Settings** (or Secrets)
   - Add new secret:
     - Name: `GEMINI_API_KEY`
     - Value: (paste your API key)
   - Save

3. **Test it**
   - Open `test-image-generation.html` in your browser
   - Click "Test Health Endpoint"
   - Should show: ✅ Health check PASSED - API key is configured

That's it! Try generating an image now.

---

## 🧪 Quick Test

Open `test-image-generation.html` in your browser to:
- ✅ Check if API key is configured
- ✅ Test image generation
- ✅ See detailed error messages

---

## 🐛 Other Common Issues

### Issue: Still not working after adding API key
**Try:** Wait 30 seconds and refresh your page

### Issue: "No images generated. Prompt may have been filtered"
**Try:** Use a simpler, more neutral prompt like "A blue sky"

### Issue: "Image generation timed out"
**Try:**
1. Check your internet connection
2. Try a shorter/simpler prompt
3. Wait a minute and try again

### Issue: "Failed to connect to image generation service"
**Try:**
1. Check if edge functions are deployed in Supabase
2. Check browser console for CORS or network errors

---

## 📊 Where to Look for Errors

1. **Browser Console** (F12)
   - Shows client-side errors
   - Look for red error messages

2. **Supabase Edge Function Logs**
   - Dashboard → Edge Functions → Logs
   - Shows server-side errors

3. **Test File**
   - Open `test-image-generation.html`
   - Automatic health check + manual test

---

## ✅ Success Looks Like

When working correctly:
```
🎯 Imagen Edge Function Debug:
  📝 Received prompt: "your prompt"
  🤖 Model: imagen-4.0-generate-001
✅ Success! Generated 1 images
```

---

## 🆘 Still Stuck?

Check `TROUBLESHOOTING.md` for detailed steps.

Or run the diagnostic panel:
```tsx
import { DiagnosticsPanel } from '@/components/DiagnosticsPanel';
<DiagnosticsPanel />
```
