# Vercel Deployment Guide for Bizz Monorepo

## Issue
When deploying this monorepo to Vercel, you may encounter:
```
Error: The file "/vercel/path0/.next/routes-manifest.json" couldn't be found.
```

This happens because Vercel needs to be configured to look in the correct directory for the Next.js app.

## ✅ Quick Fix

**In your Vercel project settings:**

1. Go to **Settings** → **General** → **Root Directory**
2. Click **Edit**
3. Set Root Directory to: `packages/web`
4. Click **Save**
5. Redeploy

That's it! This tells Vercel that your Next.js app lives in `packages/web`, not at the root.

---

## Solution Details

### Option 1: Configure via Vercel Dashboard (Recommended)

1. Go to your project settings on Vercel
2. Navigate to **Settings** → **General**
3. Under **Build & Development Settings**:
   - **Root Directory**: Set to `packages/web` ⭐ **MOST IMPORTANT**
   - **Framework Preset**: Next.js (should auto-detect)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: Leave as `.next` (default)
   - **Install Command**: `npm install` (default)

4. Under **Environment Variables**:
   - Add all required env vars from `.env.local.example`
   - Especially: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, Bitcoin Computer keys, etc.

5. Redeploy

### Option 2: Configure via vercel.json

Create `packages/web/vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "installCommand": "npm install --prefix=../../ && npm install"
}
```

Then in Vercel project settings:
- Set **Root Directory** to `packages/web`

### Why This Happens

This is a monorepo with the following structure:
```
bizz/
├── packages/
│   ├── web/          ← Next.js app lives here
│   │   ├── .next/    ← Build output
│   │   └── package.json
│   ├── contracts/
│   └── tests/
└── package.json      ← Root workspace config
```

By default, Vercel looks for `.next` at the project root, but in our monorepo it's in `packages/web/.next`.

## Environment Variables Required

Make sure these are set in Vercel:

### Database
- `DATABASE_URL`

### NextAuth
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

### Bitcoin Computer
- `NEXT_PUBLIC_BITCOIN_COMPUTER_CHAIN` (e.g., "LTC")
- `NEXT_PUBLIC_BITCOIN_COMPUTER_NETWORK` (e.g., "testnet")
- `NEXT_PUBLIC_BITCOIN_COMPUTER_URL`
- `BITCOIN_COMPUTER_MNEMONIC`
- `CUSTODIAL_WALLET_MNEMONIC`

### IPFS (if using)
- `NEXT_PUBLIC_IPFS_GATEWAY`
- `IPFS_PROJECT_ID`
- `IPFS_PROJECT_SECRET`

## Build Process

The build process:
1. Vercel installs dependencies from root (`npm install`)
2. Workspace dependencies are linked (contracts → web)
3. Build script runs: `npm run build` (defined in root package.json)
   - This runs: `npm run build -w @bizz/contracts && npm run build -w @bizz/web`
4. Contracts are built first (TypeScript → JavaScript deploy files)
5. Web app is built (Next.js build with contracts imported)

## Troubleshooting

### If build still fails:

1. **Check the build logs** for the actual error
2. **Verify workspace dependencies** are resolving:
   ```json
   {
     "dependencies": {
       "@bizz/contracts": "*"
     }
   }
   ```
3. **Ensure TypeScript builds** correctly:
   ```bash
   npm run build -w @bizz/contracts
   ```
4. **Test locally**:
   ```bash
   npm run build
   npm run start
   ```

### Common Issues:

- **prisma generate fails**: Ensure `DATABASE_URL` is set
- **Contract imports fail**: Build contracts before web
- **Module not found**: Check workspace dependencies in package.json
