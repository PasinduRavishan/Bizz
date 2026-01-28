#!/bin/bash

# =======================================================
# BIZZ QUIZ PLATFORM - SECRET GENERATION SCRIPT
# =======================================================
# Run this script to generate all required secrets
# Usage: bash generate-secrets.sh

echo "🔐 Generating production secrets for Bizz Quiz Platform..."
echo ""
echo "=================================================="
echo "COPY THESE TO YOUR GITHUB SECRETS & VERCEL ENV VARS"
echo "=================================================="
echo ""

echo "📝 NEXTAUTH_SECRET (NextAuth JWT encryption)"
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)"
echo ""

echo "🔑 WALLET_ENCRYPTION_KEY (User wallet encryption)"
echo "WALLET_ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo ""

echo "🔐 REVEAL_DATA_KEY (Quiz reveal data encryption)"
echo "REVEAL_DATA_KEY=$(openssl rand -hex 32)"
echo ""

echo "=================================================="
echo "MANUAL SETUP REQUIRED"
echo "=================================================="
echo ""

echo "📊 DATABASE_URL (Get from Supabase)"
echo "Format: postgresql://postgres.[PROJECT]:[PASSWORD]@[HOST]:6543/postgres?pgbouncer=true"
echo ""

echo "📊 DIRECT_URL (Get from Supabase)"
echo "Format: postgresql://postgres.[PROJECT]:[PASSWORD]@[HOST]:5432/postgres"
echo ""

echo "🌐 NEXTAUTH_URL_PRODUCTION"
echo "Your production URL, e.g.: https://bizz-quiz.vercel.app"
echo ""

echo "💰 BITCOIN_COMPUTER_MNEMONIC"
echo "Generate with: https://iancoleman.io/bip39/ (12 words)"
echo "⚠️  SECURE THIS - it controls all funds!"
echo ""

echo "📁 PINATA_JWT"
echo "Get from: https://app.pinata.cloud/keys"
echo "Create a new API key with pinning permissions"
echo ""

echo "=================================================="
echo "NEXT STEPS"
echo "=================================================="
echo ""
echo "1. Copy secrets above to GitHub:"
echo "   → https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions"
echo ""
echo "2. Copy secrets to Vercel:"
echo "   → Dashboard → Project → Settings → Environment Variables"
echo ""
echo "3. Get manual values:"
echo "   - Supabase: https://app.supabase.com/project/_/settings/database"
echo "   - Pinata: https://app.pinata.cloud/keys"
echo ""
echo "4. Redeploy:"
echo "   git commit --allow-empty -m 'chore: add env vars'"
echo "   git push origin main"
echo ""
echo "✅ Done! See docs/DEPLOYMENT_GUIDE.md for detailed instructions"
