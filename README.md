# 🧬 Federated Genetic Algorithm Test Impact Analysis (TIA) Optimizer

> **Evolve your CI pipeline** — An intelligent test optimization system that uses Genetic Algorithms to select the minimum set of tests needed when you change code, reducing CI pipeline times by up to 95%.

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-43853D?logo=nodedotjs)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%2B%20Auth-FFCA28?logo=firebase)](https://firebase.google.com)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

---

## 🏗️ Architecture

This system uses a **federated execution model** — all code execution stays on your machine. The backend is a pure mathematical optimization service that never touches your source code.

```
┌──────────────────────────────────────────────────────────────┐
│                      Developer's Machine                      │
│                                                                │
│  ┌─────────────┐    git diff     ┌──────────────────────┐     │
│  │  Your Code   │ ──────────────▶│   smart-test CLI     │     │
│  │  Repository  │                │                      │     │
│  └─────────────┘                │  1. Parse git diff    │     │
│                                  │  2. Load coverage map │     │
│                                  │  3. Intersect locally │     │
│                                  │  4. Execute tests     │     │
│                                  └──────────┬───────────┘     │
│                                              │ Minimal         │
│                                              │ JSON payload    │
└──────────────────────────────────────────────┼────────────────┘
                                               │
                                               ▼
                              ┌────────────────────────────────┐
                              │    Backend Microservice         │
                              │                                │
                              │  • Genetic Algorithm Engine    │
                              │  • Worker Threads (non-block)  │
                              │  • Greedy Fallback Algorithm   │
                              │  • Firebase (Firestore + Auth) │
                              │  • Telemetry Aggregation       │
                              └────────────────────────────────┘
                                               │
                                               ▼
                              ┌────────────────────────────────┐
                              │    Frontend Dashboard          │
                              │                                │
                              │  • Real-time GA visualization  │
                              │  • Performance comparison      │
                              │  • Test selection reasoning    │
                              │  • Historical telemetry        │
                              └────────────────────────────────┘
```

### Key Security Feature
The backend **never clones your repo, installs packages, or runs your code**. It processes only lightweight text payloads (file paths, line numbers, test identifiers). Your IP is safe.

---

## 🧪 How the Genetic Algorithm Works

The GA explores millions of test combinations to find the optimal subset:

| Parameter | Value | Description |
|-----------|-------|-------------|
| Population | 100 chromosomes | Each is a binary array (1=test selected, 0=omitted) |
| Fitness Function | `F(c) = α·Coverage - β·Time - Penalty` | Maximizes coverage, minimizes time |
| Selection | Tournament (k=5) | Maintains genetic diversity |
| Crossover | Multi-point (2-point) | Combines traits from parent solutions |
| Mutation | Bit-flip (2% rate) | Explores new combinations |
| Elitism | Top 5% | Best solutions never destroyed |
| Time Limit | 3 seconds | Hard ceiling to keep API fast |

**Critical constraint**: Any test subset that misses even one modified line receives a massive -1000 penalty, ensuring correctness is never sacrificed for speed.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ 
- A Firebase project with Firestore and Google Auth enabled
- Git

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd CI-Pipeline-Optimizer

# Install backend
cd backend-microservice
npm install

# Install frontend
cd ../frontend-dashboard
npm install
```

### 2. Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Firestore Database** (start in test mode)
3. Enable **Google Authentication** in Authentication → Sign-in method
4. Generate a **service account key** (Project Settings → Service Accounts → Generate New Private Key)
5. Save the JSON file as `backend-microservice/serviceAccountKey.json`
6. Copy your web app's Firebase config to `frontend-dashboard/src/config/firebase.js`

### 3. Start the Backend

```bash
cd backend-microservice
cp .env.example .env
# Edit .env with your Firebase credentials
npm run dev
```

### 4. Start the Frontend

```bash
cd frontend-dashboard
npm run dev
# Open http://localhost:5173
```

### 5. Use the CLI (in any project)

```bash
# Install globally
npm install -g ./cli-tool

# Initialize with your API key (from the dashboard)
smart-test init <YOUR_API_KEY>

# Run optimized tests
smart-test run
```

---

## 📁 Project Structure

```
CI Pipeline Optimizer/
├── backend-microservice/       # Express.js API + GA Engine
│   ├── src/
│   │   ├── server.js           # Entry point
│   │   ├── engine/
│   │   │   ├── ga.js           # Genetic Algorithm core
│   │   │   ├── worker.js       # Worker thread wrapper
│   │   │   └── greedy.js       # Greedy fallback
│   │   ├── middleware/auth.js  # Firebase + API key auth
│   │   ├── routes/             # All API endpoints
│   │   ├── services/firebase.js
│   │   └── utils/apiKey.js
│   └── package.json
│
├── frontend-dashboard/         # React + Vite Dashboard
│   ├── src/
│   │   ├── pages/              # Login, Dashboard, RepoDetail
│   │   ├── components/         # Reusable UI components
│   │   ├── contexts/           # Auth state management
│   │   ├── config/firebase.js  # Firebase client config
│   │   └── index.css           # Glassmorphism design system
│   └── package.json
│
├── cli-tool/                   # smart-test CLI
│   ├── bin/smart-test.js       # Entry point
│   ├── src/
│   │   ├── init.js             # Cold Start command
│   │   ├── run.js              # Optimization command
│   │   ├── diff.js             # Git diff parser
│   │   ├── coverage.js         # Coverage intersection
│   │   └── api.js              # Backend client
│   └── package.json
│
└── README.md
```

---

## 🔌 API Reference

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/health` | GET | None | Health check |
| `/api/v1/optimize` | POST | API Key | Run GA optimization |
| `/api/v1/telemetry` | POST | API Key | Submit run metrics |
| `/api/v1/baseline` | POST | API Key | Upload coverage baseline |
| `/api/v1/repos` | GET/POST | Bearer | Repository CRUD |
| `/api/v1/dashboard/metrics` | GET | Bearer | Aggregated stats |
| `/api/v1/dashboard/telemetry/:id` | GET | Bearer | Time-series data |
| `/api/v1/auth/api-key` | POST/GET | Bearer | API key management |

---

## 🔄 User Workflow

### Phase 1: Setup (One-time)
1. **Sign in** to the dashboard with Google
2. **Generate** an API key from the dashboard
3. **Install** the CLI: `npm install -g smart-test-tia`
4. **Initialize**: `smart-test init <API_KEY>` (runs full test suite with coverage)

### Phase 2: Daily Use
1. **Write code** — modify files as usual
2. **Run**: `smart-test run` instead of `npm test`
3. The CLI extracts your diff, intersects with coverage, sends to GA, and runs only the necessary tests
4. View results in the dashboard

---

## 📊 Dashboard Features

- **Executive Metrics** — Total hours saved, optimization percentage
- **Performance Comparison** — Side-by-side naive vs. optimized view
- **GA Evolution Graph** — Watch the algorithm converge in real-time
- **Test Selection Matrix** — See exactly why each test was chosen
- **Historical Telemetry** — Track optimization trends over time

---

## 🛠️ Tech Stack

| Component | Technologies |
|-----------|-------------|
| Backend | Node.js, Express.js, Worker Threads |
| Frontend | React 19, Vite, Recharts, Vanilla CSS |
| Database | Firebase Firestore |
| Auth | Firebase Auth (Google Sign-in) |
| CLI | Node.js (zero external deps) |
| Algorithm | Custom Genetic Algorithm with greedy fallback |

---

## 📝 License

MIT License — see [LICENSE](LICENSE) for details.
