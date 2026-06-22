# StarPass Backend

NestJS API and Soroban event indexer for StarPass — a creator membership platform on Stellar where fans mint on-chain access passes to exclusive content tiers.

[![CI](https://github.com/laugh-tales/starpass-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/laugh-tales/starpass-backend/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What It Does

StarPass Backend provides:
- **REST API** for creators, fans, tiers, and passes
- **Stellar auth** — login with a signed Stellar keypair challenge
- **Soroban event indexer** — syncs on-chain events to PostgreSQL for fast queries
- **Access gating** — `GET /passes/check/:fanAddress/creator/:creatorAddress` returns whether a fan has a valid pass
- **Swagger docs** at `/api/docs`

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/auth/challenge` | Get challenge message to sign |
| `POST` | `/auth/login` | Login with signed challenge |
| `GET` | `/creators` | List all creators |
| `GET` | `/creators/:address` | Get creator profile |
| `POST` | `/creators/register` | Register as creator (auth required) |
| `PATCH` | `/creators/profile` | Update creator profile (auth required) |
| `POST` | `/creators/:id/blocks` | Block a fan from purchasing creator passes (auth required) |
| `DELETE` | `/creators/:id/blocks/:fanAddress` | Unblock a fan for a creator (auth required) |
| `GET` | `/tiers/creator/:address` | Get all tiers for a creator |
| `GET` | `/passes/check/:fanAddress/tier/:tierId` | Check if fan has valid pass for tier |
| `GET` | `/passes/check/:fanAddress/creator/:creatorAddress` | Check if fan has any valid pass from creator |
| `GET` | `/passes` | List passes with filtering and pagination |
| `GET` | `/passes/fan/:address` | Get all passes for a fan |
| `GET` | `/fans/:address` | Get fan profile |
| `GET` | `/fans/:address/subscriptions` | Get fan's active subscriptions |

## Tech Stack

- **Framework:** NestJS 10
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** Stellar keypair signature verification + JWT
- **Indexer:** Polls Soroban RPC for contract events every 10 seconds
- **Docs:** Swagger/OpenAPI at `/api/docs`

## Setup

**Prerequisites:**
- Node.js 20+
- PostgreSQL
- A deployed StarPass contract (see [starpass-contracts](https://github.com/laugh-tales/starpass-contracts))

```bash
# Clone
git clone https://github.com/laugh-tales/starpass-backend
cd starpass-backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL, JWT_SECRET, and STARPASS_CONTRACT_ID

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Start development server
npm run start:dev
```

API available at `http://localhost:4000`
Swagger docs at `http://localhost:4000/api/docs`

## Project Structure

```
starpass-backend/
├── src/
│   ├── auth/              # Stellar signature auth + JWT
│   ├── creators/          # Creator registration and profiles
│   ├── fans/              # Fan profiles and subscriptions
│   ├── tiers/             # Membership tier management
│   ├── passes/            # Pass access checking and gating
│   ├── indexer/           # Soroban event indexer
│   ├── stellar/           # Stellar SDK service
│   └── common/            # Prisma, guards, decorators
├── prisma/
│   └── schema.prisma      # Database schema
├── .github/workflows/
│   └── ci.yml             # CI pipeline
└── .env.example           # Environment variables template
```

## Event Indexer

The indexer polls the StarPass Soroban contract every 10 seconds for new events and syncs them to PostgreSQL. This enables fast queries without hitting the blockchain on every request.

Events indexed:
- `creator_registered` — creates user and creator records
- `tier_created` — syncs tier data
- `tier_deactivated` — marks tier inactive
- `pass_minted` — creates pass record for fan access checking

## Contributing

This project participates in the [Stellar Wave Program](https://drips.network/wave/stellar) on Drips. Contributors earn USDC rewards for resolving issues.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup and contribution guidelines.

## Related Repositories

| Repo | Description |
|---|---|
| [starpass-contracts](https://github.com/laugh-tales/starpass-contracts) | Soroban smart contracts |
| [starpass-frontend](https://github.com/laugh-tales/starpass-frontend) | Next.js creator and fan dashboard |

## License

MIT
