# MiniDEX Frontend UI

A modern, responsive React-based dashboard for interacting with the MiniDEX smart contracts and monitoring automated agents.

## 🏛 Architecture Overview

The frontend is built as a single-page application (SPA) using **React 18** and **Vite**. The architecture follows a modular, state-driven approach:

### 1. State Management
- **React Hooks:** Uses `useState`, `useEffect`, and `useMemo` for local state and derived data (e.g., exchange rates, estimated outputs).
- **Blockchain Sync:** `useEffect` hooks handle periodic polling of contract reserves and wallet balances to ensure the UI remains "live."

### 2. Blockchain Interaction (`ethers.js`)
- **Provider/Signer:** Connects to MetaMask (Browser Provider) to fetch the user's signer for transaction authorization.
- **Contract Instances:** Dynamically creates contract instances for Token A, Token B, and MiniDEX using standard ABIs.
- **Transaction Flow:** Implements an "Approve-then-Execute" pattern for ERC20 interactions.

### 3. Component Structure
The UI is organized into logical functional panels:
- **Header:** Wallet connectivity and account status.
- **Contract Configuration:** Dynamic input for contract addresses.
- **Swap Panel:** Logic for computing and executing automated swaps.
- **Liquidity Panel:** Management of pool depth.
- **Pool Stats:** Real-time visualization of reserves and price ratios.
- **Agent Status:** Monitoring of external system agents (Deploy, Monitor, Report).

### 4. Styling & UX
- **Tailwind CSS:** Utilizes a utility-first approach for a clean, light-themed design.
- **React Hot Toast:** Provides non-blocking, asynchronous feedback for transaction lifecycles (loading, success, error).

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MetaMask extension installed in your browser

### Installation
```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install
```

### Development
```bash
npm run dev
```

### Build
```bash
npm run build
```

## 🛠 Configuration
The application is configured to interact with the **Sepolia Testnet** (Chain ID: 11155111). Ensure your MetaMask is set to the correct network before interacting with the dashboard.
