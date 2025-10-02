# Image Generation - Complete Guide

## 🚀 Quick Start

If images aren't generating, **the #1 most common issue is missing the API key**.

**Quick Fix (2 minutes):**
1. Get API key: https://aistudio.google.com/app/apikey
2. Add to Supabase: Dashboard → Edge Functions → Settings → Add Secret
   - Name: `GEMINI_API_KEY`
   - Value: Your API key
3. Test: Open `test-image-generation.html` in browser

See `QUICK-FIX.md` for details.

---

## 📁 Files Reference

| File | Purpose |
|------|---------|
| `QUICK-FIX.md` | Fast troubleshooting for common issues |
| `TROUBLESHOOTING.md` | Detailed diagnostic steps |
| `IMAGE_GENERATION_FIXES.md` | Technical details of improvements made |
| `test-image-generation.html` | Interactive test tool (open in browser) |
| `src/lib/diagnostics.ts` | Diagnostic utilities |
| `src/components/DiagnosticsPanel.tsx` | UI diagnostic panel |

---

## 🔧 What Was Fixed

### 1. Timeout Handling
- Added 55-second timeout to prevent infinite loading
- Clear error messages when timeouts occur

### 2. Error Handling
- All errors now properly surface to users
- Specific messages for different error types
- Better logging for debugging

### 3. Loading States
- Loading state always clears (even on errors)
- No more stuck "loading" states

### 4. Diagnostic Tools
- Health check endpoint
- Test HTML file for direct testing
- Diagnostic panel component for UI

---

## 🧪 Testing

### Option 1: Test HTML File
```bash
# Open in browser
open test-image-generation.html
```
- Auto-runs health check
- Manual generation test
- Shows detailed error messages

### Option 2: Diagnostic Panel
```tsx
import { DiagnosticsPanel } from '@/components/DiagnosticsPanel';

function MyPage() {
  return <DiagnosticsPanel />;
}
```

### Option 3: Browser Console
- Open DevTools (F12)
- Try generating an image
- Check for error messages

---

## 🐛 Common Issues

### ❌ Missing API Key
**Symptom:** Health check shows `geminiKey: false`
**Fix:** Add `GEMINI_API_KEY` to Supabase Edge Function secrets

### ❌ Timeout Errors
**Symptom:** "Image generation timed out"
**Fix:** Try simpler prompt or check internet connection

### ❌ Filtered Prompts
**Symptom:** "Prompt may have been filtered"
**Fix:** Use more neutral, descriptive language

### ❌ Network Errors
**Symptom:** "Failed to connect"
**Fix:** Check edge function deployment and browser console

---

## 📊 How to Check Logs

### Browser Console (Client-side)
1. Press F12 to open DevTools
2. Go to Console tab
3. Try generating an image
4. Look for logs starting with 🎨, ✅, or ❌

### Supabase Logs (Server-side)
1. Open Supabase Dashboard
2. Navigate to Edge Functions → Logs
3. Try generating an image
4. Check for error messages in logs

---

## ✅ Success Indicators

When everything works correctly:

**Browser Console:**
```
🎨 Calling edge function with prompt: "..."
✅ Edge function response: { images: [...] }
✅ Generated 1 images successfully
```

**UI:**
- Loading spinner appears
- Image generates in 10-30 seconds
- Image displays in preview
- No error toasts
- Loading spinner disappears

---

## 🔑 API Key Requirements

### Getting the Key
1. Go to https://aistudio.google.com/app/apikey
2. Sign in with Google account
3. Create new API key
4. Copy the key (starts with "AIza...")

### Where to Put It
**✅ CORRECT:** Supabase Edge Functions Secrets
- Dashboard → Edge Functions → Settings/Secrets
- Name: `GEMINI_API_KEY`
- Value: Your API key

**❌ WRONG:** Project .env file
- The `.env` file is for frontend environment variables
- Edge functions can't read frontend .env files
- Must be set in Supabase secrets

### Permissions
The API key needs access to:
- Generative Language API (for Imagen)
- Usually enabled by default in AI Studio

---

## 🚦 Current Status

After these fixes, the system now:
- ✅ Times out after 55 seconds (no infinite loading)
- ✅ Shows clear error messages
- ✅ Always clears loading state
- ✅ Provides diagnostic tools
- ✅ Logs all operations for debugging

---

## 💰 Cost & Quotas

**Google AI Studio:**
- Offers free tier for testing
- May require billing for production use
- Check current pricing: https://ai.google.dev

**Supabase:**
- Edge functions have execution limits on free tier
- Storage has size limits on free tier
- Check your plan limits in Dashboard

---

## 🔄 Workflow

1. User enters prompt
2. Frontend calls edge function
3. Edge function calls Google Imagen API
4. Google returns base64 images
5. Images uploaded to Supabase storage
6. Records created in database
7. Images displayed in UI

**Failure Points:**
- Missing API key (most common)
- Network timeout
- Content filtering
- Storage quota exceeded
- Database write failure

Each failure point now has proper error handling and user feedback.

---

## 📞 Support

If you're still having issues:

1. Run `test-image-generation.html` and save the output
2. Check browser console and save error messages
3. Check Supabase edge function logs
4. Review `TROUBLESHOOTING.md`
5. Check that all configuration is correct

Common configuration checklist:
- [ ] GEMINI_API_KEY set in Supabase
- [ ] Edge functions deployed
- [ ] Storage bucket exists
- [ ] Database table exists
- [ ] Internet connection working

---

## 🎯 Next Steps

1. **First:** Configure GEMINI_API_KEY
2. **Test:** Run health check in `test-image-generation.html`
3. **Generate:** Try creating an image with a simple prompt
4. **Debug:** If issues, check `TROUBLESHOOTING.md`

Good luck! 🚀
