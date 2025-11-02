# Security Setup Guide

## Environment Variables Setup

**⚠️ IMPORTANT: Never commit actual API keys to version control!**

### Frontend Setup

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Fill in your actual API keys in `.env`:
   - `VITE_GOOGLE_MAPS_API_KEY`: Your Google Maps JavaScript API key
   - `VITE_SUPABASE_URL`: Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key

### Backend Setup

1. Copy the server environment template:
   ```bash
   cp server/.env.example server/.env
   ```

2. Fill in your actual values in `server/.env`:
   - `FIREBASE_DB_URL`: Your Firebase Realtime Database URL
   - `VITE_SOCKET_URL`: Your Socket.io server URL
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key

## API Key Security

### If Your Keys Were Exposed:

1. **Google Maps API Key**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to APIs & Services > Credentials
   - Delete the exposed key and create a new one
   - Update your `.env` file with the new key

2. **Supabase Keys**:
   - Go to [Supabase Dashboard](https://supabase.com/dashboard)
   - Navigate to Settings > API
   - Reset your keys if needed
   - Update both `.env` and `server/.env` files

### Best Practices:

- Never commit `.env` files to version control
- Use different API keys for development and production
- Regularly rotate your API keys
- Set up API key restrictions (domain/IP restrictions)
- Monitor API key usage in your provider dashboards

## File Structure

```
├── .env.example          # Template for frontend environment variables
├── .env                  # Your actual frontend environment variables (gitignored)
├── server/
│   ├── .env.example      # Template for backend environment variables
│   └── .env             # Your actual backend environment variables (gitignored)
└── .gitignore           # Contains .env patterns to prevent committing secrets
```