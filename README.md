# Augment Code Proxy - Vercel

A serverless proxy for Augment Code OAuth authentication, deployed on Vercel.

## Features

- OAuth2 proxy for Augment Code authentication
- Serverless functions (no server maintenance)
- Account management API
- Direct IDEA integration
- Global CDN distribution

## API Endpoints

- `GET /health` - Health check
- `POST /api/accounts` - Add account
- `GET /api/accounts` - List accounts
- `POST /api/login` - Process login
- `GET /authorize` - OAuth authorization endpoint

## Usage

1. Add your Augment Code account:
```bash
curl -X POST https://your-app.vercel.app/api/accounts \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com","accessToken":"your-token"}'
```

2. Configure hosts file:
```
your-vercel-ip auth.augmentcode.com
```

3. Use IDEA normally - it will automatically use the proxy.

## Deployment

This project is designed for Vercel serverless functions.

1. Upload to GitHub
2. Connect to Vercel
3. Deploy automatically

## Support

Check Vercel function logs for debugging.
