# Voice2Sense Authentication Setup Guide

## ✅ What's Fixed

1. **Email/Password Authentication** - Now uses backend API
2. **OAuth (Google, Facebook, GitHub)** - Uses Supabase directly
3. **Error Logging** - Added console logs for debugging
4. **Backend API Client** - Clean and simplified

## 🚀 Quick Start

### Step 1: Backend Setup

```bash
cd backend
npm install
```

Create `.env` file in backend directory:
```env
PORT=5000
VITE_SUPABASE_URL=https://wakurgyebdiwobzrtlrf.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indha3VyZ3llYmRpd29ienJ0bHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMTk1MzIsImV4cCI6MjA4NTY5NTUzMn0.1P6ntADqYPKHTFoj9lEv33o_WyrxGmbkZ_0QsuVwLhc
SESSION_SECRET=your_random_secret_here
FRONTEND_URL=http://localhost:5173
```

Start backend:
```bash
npm run dev
```

### Step 2: Frontend is Already Configured

The frontend `.env` already has:
```
VITE_API_URL=http://localhost:5000/api
```

### Step 3: Test the Authentication

1. **Email/Password Login** ✅
   - Open http://localhost:5173
   - Try signing up with email/password
   - Should call backend API

2. **Google Login** ✅
   - Click Google button
   - Will redirect to Google's OAuth page
   - Comes back authenticated

3. **Check Browser Console** 
   - Open DevTools (F12)
   - Go to Console tab
   - You'll see logs like:
     - `Auth API URL: http://localhost:5000/api`
     - `Sign up request failed:...` (if there are errors)

## 🔧 How It Works

### Architecture:
```
Frontend (React)
    ├── Email/Password → Backend API → Supabase
    └── OAuth (Google, Facebook, GitHub) → Supabase directly
```

### Email/Password Flow:
1. User enters email/password
2. Frontend calls `authAPI.signUp()` or `authAPI.signIn()`
3. Backend receives request and calls Supabase
4. Supabase returns user + session
5. Backend returns data to frontend
6. Frontend redirects to main page

### OAuth Flow:
1. User clicks Google/Facebook/GitHub button
2. Frontend calls `supabase.auth.signInWithOAuth()`
3. Supabase redirects to provider (Google, etc.)
4. User confirms with provider
5. Provider redirects back to app
6. Supabase handles session automatically

## ⚙️ Backend API Endpoints

| Endpoint | Method | Body | Response |
|----------|--------|------|----------|
| `/api/auth/signup` | POST | `{email, password, name}` | `{user, message}` |
| `/api/auth/signin` | POST | `{email, password}` | `{user, session}` |
| `/api/auth/logout` | POST | - | `{message}` |
| `/api/auth/refresh` | POST | `{refreshToken}` | `{session}` |
| `/api/health` | GET | - | `{status}` |

## 📊 Debugging Checklist

If something doesn't work:

1. **Check Backend is Running**
   ```bash
   curl http://localhost:5000/api/health
   ```
   Should return: `{"status":"Backend is running"}`

2. **Check API URL**
   - Open DevTools Console
   - Should see: `Auth API URL: http://localhost:5000/api`

3. **Check Supabase Credentials**
   - Verify in `backend/.env`:
     - `VITE_SUPABASE_URL` is correct
     - `VITE_SUPABASE_PUBLISHABLE_KEY` is correct

4. **Check CORS**
   - If getting CORS error, ensure:
     - `FRONTEND_URL=http://localhost:5173` in backend `.env`
     - Backend is listening on port 5000

5. **Check Supabase OAuth Setup**
   - Go to Supabase Dashboard
   - Project → Authentication → Providers
   - Ensure Google/Facebook/GitHub are enabled
   - Check redirect URLs are set

## 🆘 Common Errors & Fixes

### "Cannot POST /api/auth/signup"
- Backend is not running
- Fix: Run `npm run dev` in backend folder

### "CORS error"
- Frontend URL mismatch
- Fix: Check `FRONTEND_URL` in backend `.env`

### "Google sign in failed"
- OAuth not configured in Supabase
- Fix: Enable Google OAuth in Supabase dashboard

### "Email/password login not working"
- Wrong Supabase credentials
- Fix: Verify `VITE_SUPABASE_*` in backend `.env`

## 📝 Files Modified

- ✅ `backend/src/server.js` - Express server
- ✅ `backend/src/routes/authRoutes.js` - API routes
- ✅ `backend/src/controllers/authController.js` - Auth logic
- ✅ `src/pages/Auth.tsx` - Frontend auth page
- ✅ `src/integrations/api/authAPI.ts` - API client
- ✅ `.env` - API URL configuration

## 🎯 Next Steps

1. Start backend: `npm run dev`
2. Start frontend: `npm run dev`
3. Open http://localhost:5173
4. Test sign up with email/password
5. Test Google login
6. Check DevTools Console for any errors

## 📞 Support

Check the console for detailed error messages. They'll tell you exactly what went wrong!
