# Bizz - Decentralized Quiz Platform

A decentralized quiz application built on Bitcoin using Bitcoin Computer smart contracts.

## Features

- 🎓 Teachers create incentivized quizzes
- 💰 Students earn Bitcoin for correct answers
- 🔐 Trustless escrow via smart contracts
- ⛓️ Fully on-chain verification
- 🚀 Built with Next.js & Bitcoin Computer

## Tech Stack

- **Frontend:** Next.js 14, TypeScript, Tailwind CSS
- **Smart Contracts:** Bitcoin Computer (JavaScript)
- **Storage:** IPFS
- **Network:** Bitcoin/Litecoin Testnet

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone <your-repo-url>
cd bizz
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env.local
# Edit .env.local with your values
```

4. Run development server
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Project Structure
```
bizz/
├── contracts/          # Smart contracts
├── src/
│   ├── app/           # Next.js pages (App Router)
│   ├── components/    # React components
│   ├── lib/           # Utility libraries
│   ├── hooks/         # Custom React hooks
│   └── types/         # TypeScript types
├── scripts/           # Deployment & test scripts
└── docs/              # Documentation
```

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm test:contracts` - Test smart contracts

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.