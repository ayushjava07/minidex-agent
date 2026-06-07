import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import toast, { Toaster } from "react-hot-toast";
import { ERC20_ABI, MINIDEX_ABI } from "./contracts";

const SEPOLIA_CHAIN_ID = 11155111;

function shortAddress(address) {
  if (!address) return "Not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function parseAmount(value, decimals) {
  if (!value) return 0n;
  try {
    return ethers.parseUnits(value, decimals);
  } catch {
    return 0n;
  }
}

function computeAmountOut(amountIn, reserveIn, reserveOut) {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  return (amountIn * reserveOut) / (reserveIn + amountIn);
}

export default function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [address, setAddress] = useState("");
  const [ethBalance, setEthBalance] = useState("0");

  const [tokenAAddress, setTokenAAddress] = useState("");
  const [tokenBAddress, setTokenBAddress] = useState("");
  const [miniDexAddress, setMiniDexAddress] = useState("");

  const [tokenADecimals, setTokenADecimals] = useState(18);
  const [tokenBDecimals, setTokenBDecimals] = useState(18);

  const [reserveA, setReserveA] = useState(0n);
  const [reserveB, setReserveB] = useState(0n);

  const [swapAmountA, setSwapAmountA] = useState("");
  const [swapAmountB, setSwapAmountB] = useState("");
  const [liquidityAddA, setLiquidityAddA] = useState("");
  const [liquidityAddB, setLiquidityAddB] = useState("");
  const [liquidityRemoveA, setLiquidityRemoveA] = useState("");
  const [liquidityRemoveB, setLiquidityRemoveB] = useState("");

  const [loadingAction, setLoadingAction] = useState("");
  const [txHistory, setTxHistory] = useState([]);
  const [agentStatus, setAgentStatus] = useState({
    deployAgent: "active",
    monitorAgent: "active",
    reportAgent: "active",
    latestCid: "-",
    latestReport: "-"
  });

  const contractsReady = useMemo(() => {
    return (
      signer &&
      ethers.isAddress(tokenAAddress) &&
      ethers.isAddress(tokenBAddress) &&
      ethers.isAddress(miniDexAddress)
    );
  }, [signer, tokenAAddress, tokenBAddress, miniDexAddress]);

  const dexContract = useMemo(() => {
    if (!contractsReady) return null;
    return new ethers.Contract(miniDexAddress, MINIDEX_ABI, signer);
  }, [contractsReady, miniDexAddress, signer]);

  const tokenAContract = useMemo(() => {
    if (!contractsReady) return null;
    return new ethers.Contract(tokenAAddress, ERC20_ABI, signer);
  }, [contractsReady, tokenAAddress, signer]);

  const tokenBContract = useMemo(() => {
    if (!contractsReady) return null;
    return new ethers.Contract(tokenBAddress, ERC20_ABI, signer);
  }, [contractsReady, tokenBAddress, signer]);

  async function connectWallet() {
    try {
      if (!window.ethereum) throw new Error("MetaMask not found.");
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const network = await browserProvider.getNetwork();
      if (Number(network.chainId) !== SEPOLIA_CHAIN_ID) {
        throw new Error("Please switch MetaMask to Sepolia.");
      }
      const walletSigner = await browserProvider.getSigner();
      const walletAddress = await walletSigner.getAddress();
      const balance = await browserProvider.getBalance(walletAddress);

      setProvider(browserProvider);
      setSigner(walletSigner);
      setAddress(walletAddress);
      setEthBalance(ethers.formatEther(balance));
      toast.success("Wallet connected.");
    } catch (error) {
      toast.error(error.message || "Wallet connection failed.");
    }
  }

  function disconnectWallet() {
    setProvider(null);
    setSigner(null);
    setAddress("");
    setEthBalance("0");
    toast.success("Wallet disconnected.");
  }

  async function refreshEthBalance() {
    if (!provider || !address) return;
    const balance = await provider.getBalance(address);
    setEthBalance(ethers.formatEther(balance));
  }

  async function refreshReserves() {
    if (!dexContract) return;
    try {
      const [a, b] = await dexContract.getReserves();
      setReserveA(a);
      setReserveB(b);
    } catch {
      // Skip noisy errors when addresses are unset/invalid.
    }
  }

  async function refreshTokenMeta() {
    if (!tokenAContract || !tokenBContract) return;
    try {
      const [aDecimals, bDecimals] = await Promise.all([
        tokenAContract.decimals(),
        tokenBContract.decimals()
      ]);
      setTokenADecimals(Number(aDecimals));
      setTokenBDecimals(Number(bDecimals));
    } catch {
      setTokenADecimals(18);
      setTokenBDecimals(18);
    }
  }

  useEffect(() => {
    refreshTokenMeta();
    refreshReserves();
  }, [tokenAContract, tokenBContract, dexContract]);

  useEffect(() => {
    if (!dexContract) return;
    const timer = setInterval(() => {
      refreshReserves();
    }, 10000);
    return () => clearInterval(timer);
  }, [dexContract]);

  useEffect(() => {
    fetch("/agent-status.json")
      .then((res) => res.json())
      .then((data) => setAgentStatus(data))
      .catch(() => {
        setAgentStatus((prev) => ({ ...prev, latestReport: "Unable to fetch agent status." }));
      });
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = () => connectWallet();
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
    };
  }, []);

  async function runWithFeedback(actionName, txAction) {
    const toastId = toast.loading(`${actionName} in progress...`);
    try {
      setLoadingAction(actionName);
      const tx = await txAction();
      await tx.wait();
      await Promise.all([refreshReserves(), refreshEthBalance()]);
      toast.success(`${actionName} successful.`, { id: toastId });
    } catch (error) {
      toast.error(error.reason || error.message || `${actionName} failed.`, { id: toastId });
    } finally {
      setLoadingAction("");
    }
  }

  async function approveToken(tokenContract, amount) {
    const tx = await tokenContract.approve(miniDexAddress, amount);
    await tx.wait();
  }

  async function handleSwapAforB() {
    if (!dexContract || !tokenAContract) return;
    const amountIn = parseAmount(swapAmountA, tokenADecimals);
    if (amountIn <= 0n) return;

    await runWithFeedback("Swap A→B", async () => {
      await approveToken(tokenAContract, amountIn);
      const tx = await dexContract.swap(tokenAAddress, amountIn);

      const amountOut = computeAmountOut(amountIn, reserveA, reserveB);
      const newItem = {
        id: `${Date.now()}-a-b`,
        timestamp: new Date().toLocaleString(),
        direction: "A→B",
        amountIn: `${swapAmountA}`,
        amountOut: ethers.formatUnits(amountOut, tokenBDecimals)
      };
      setTxHistory((prev) => [newItem, ...prev].slice(0, 5));
      return tx;
    });
  }

  async function handleSwapBforA() {
    if (!dexContract || !tokenBContract) return;
    const amountIn = parseAmount(swapAmountB, tokenBDecimals);
    if (amountIn <= 0n) return;

    await runWithFeedback("Swap B→A", async () => {
      await approveToken(tokenBContract, amountIn);
      const tx = await dexContract.swap(tokenBAddress, amountIn);

      const amountOut = computeAmountOut(amountIn, reserveB, reserveA);
      const newItem = {
        id: `${Date.now()}-b-a`,
        timestamp: new Date().toLocaleString(),
        direction: "B→A",
        amountIn: `${swapAmountB}`,
        amountOut: ethers.formatUnits(amountOut, tokenADecimals)
      };
      setTxHistory((prev) => [newItem, ...prev].slice(0, 5));
      return tx;
    });
  }

  async function handleAddLiquidity() {
    if (!dexContract || !tokenAContract || !tokenBContract) return;
    const amountA = parseAmount(liquidityAddA, tokenADecimals);
    const amountB = parseAmount(liquidityAddB, tokenBDecimals);
    if (amountA <= 0n || amountB <= 0n) return;

    await runWithFeedback("Add Liquidity", async () => {
      await approveToken(tokenAContract, amountA);
      await approveToken(tokenBContract, amountB);
      return dexContract.addLiquidity(amountA, amountB);
    });
  }

  async function handleRemoveLiquidity() {
    if (!dexContract) return;
    const amountA = parseAmount(liquidityRemoveA, tokenADecimals);
    const amountB = parseAmount(liquidityRemoveB, tokenBDecimals);
    if (amountA <= 0n || amountB <= 0n) return;

    await runWithFeedback("Remove Liquidity", async () => {
      return dexContract.removeLiquidity(amountA, amountB);
    });
  }

  const estimatedOutB = useMemo(() => {
    const amountIn = parseAmount(swapAmountA, tokenADecimals);
    const out = computeAmountOut(amountIn, reserveA, reserveB);
    return ethers.formatUnits(out, tokenBDecimals);
  }, [swapAmountA, reserveA, reserveB, tokenADecimals, tokenBDecimals]);

  const estimatedOutA = useMemo(() => {
    const amountIn = parseAmount(swapAmountB, tokenBDecimals);
    const out = computeAmountOut(amountIn, reserveB, reserveA);
    return ethers.formatUnits(out, tokenADecimals);
  }, [swapAmountB, reserveA, reserveB, tokenADecimals, tokenBDecimals]);

  const exchangeRate = reserveA > 0n ? Number(ethers.formatUnits(reserveB, tokenBDecimals)) / Number(ethers.formatUnits(reserveA, tokenADecimals)) : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Toaster position="top-right" />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">MiniDEX Dashboard</h1>
              <p className="text-sm font-medium text-slate-500">Network: Sepolia Testnet</p>
            </div>
            <div className="flex flex-col gap-2 text-sm md:items-end">
              <p className="font-medium">Wallet: <span className="font-mono text-indigo-600">{shortAddress(address)}</span></p>
              <p className="font-medium">ETH Balance: <span className="text-slate-700">{Number(ethBalance || 0).toFixed(4)}</span></p>
              {!address ? (
                <button onClick={connectWallet} className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-indigo-700">
                  Connect MetaMask
                </button>
              ) : (
                <button onClick={disconnectWallet} className="mt-2 rounded-lg bg-slate-100 px-4 py-2 font-semibold text-slate-700 transition-colors hover:bg-slate-200">
                  Disconnect
                </button>
              )}
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Contract Addresses</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">Token A</label>
              <input className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" placeholder="0x..." value={tokenAAddress} onChange={(e) => setTokenAAddress(e.target.value.trim())} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">Token B</label>
              <input className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" placeholder="0x..." value={tokenBAddress} onChange={(e) => setTokenBAddress(e.target.value.trim())} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">MiniDEX</label>
              <input className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" placeholder="0x..." value={miniDexAddress} onChange={(e) => setMiniDexAddress(e.target.value.trim())} />
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">Swap Panel</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Swap Token A</label>
                <input className="w-full rounded-lg border border-slate-300 bg-white p-2.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" placeholder="Amount" value={swapAmountA} onChange={(e) => setSwapAmountA(e.target.value)} />
                <p className="text-xs font-medium text-slate-500">Estimated Token B out: <span className="text-indigo-600">{estimatedOutB}</span></p>
                <button disabled={!contractsReady || loadingAction === "Swap A→B"} onClick={handleSwapAforB} className="w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {loadingAction === "Swap A→B" ? "Swapping..." : "Swap A→B"}
                </button>
              </div>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400 font-bold">OR</span></div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Swap Token B</label>
                <input className="w-full rounded-lg border border-slate-300 bg-white p-2.5 focus:border-purple-500 focus:ring-1 focus:ring-purple-500" placeholder="Amount" value={swapAmountB} onChange={(e) => setSwapAmountB(e.target.value)} />
                <p className="text-xs font-medium text-slate-500">Estimated Token A out: <span className="text-purple-600">{estimatedOutA}</span></p>
                <button disabled={!contractsReady || loadingAction === "Swap B→A"} onClick={handleSwapBforA} className="w-full rounded-lg bg-purple-600 py-3 font-semibold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {loadingAction === "Swap B→A" ? "Swapping..." : "Swap B→A"}
                </button>
              </div>
              <p className="text-center text-sm font-medium text-slate-600">Exchange rate: <span className="text-slate-900">{Number.isFinite(exchangeRate) ? exchangeRate.toFixed(6) : "0.000000"}</span> B per A</p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">Liquidity Panel</h2>
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-sm font-bold uppercase text-slate-500">Add Liquidity</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="Token A" value={liquidityAddA} onChange={(e) => setLiquidityAddA(e.target.value)} />
                  <input className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="Token B" value={liquidityAddB} onChange={(e) => setLiquidityAddB(e.target.value)} />
                </div>
                <button disabled={!contractsReady || loadingAction === "Add Liquidity"} onClick={handleAddLiquidity} className="w-full rounded-lg bg-emerald-600 py-3 font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {loadingAction === "Add Liquidity" ? "Adding..." : "Add Liquidity"}
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-bold uppercase text-slate-500">Remove Liquidity</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500" placeholder="Token A" value={liquidityRemoveA} onChange={(e) => setLiquidityRemoveA(e.target.value)} />
                  <input className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500" placeholder="Token B" value={liquidityRemoveB} onChange={(e) => setLiquidityRemoveB(e.target.value)} />
                </div>
                <button disabled={!contractsReady || loadingAction === "Remove Liquidity"} onClick={handleRemoveLiquidity} className="w-full rounded-lg bg-rose-600 py-3 font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {loadingAction === "Remove Liquidity" ? "Removing..." : "Remove Liquidity"}
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">Pool Stats Panel</h2>
            <div className="space-y-3">
              <div className="flex justify-between rounded-lg bg-slate-50 p-3">
                <span className="text-sm font-medium text-slate-600">Reserve A</span>
                <span className="font-mono font-bold text-slate-900">{ethers.formatUnits(reserveA, tokenADecimals)}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-slate-50 p-3">
                <span className="text-sm font-medium text-slate-600">Reserve B</span>
                <span className="font-mono font-bold text-slate-900">{ethers.formatUnits(reserveB, tokenBDecimals)}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-indigo-50 p-3">
                <span className="text-sm font-medium text-indigo-700">Price Ratio (B/A)</span>
                <span className="font-mono font-bold text-indigo-900">{Number.isFinite(exchangeRate) ? exchangeRate.toFixed(6) : "0.000000"}</span>
              </div>
              <p className="text-center text-xs font-medium text-slate-400 italic">Auto-refreshes every 10 seconds</p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">Agent Status Panel</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-medium text-slate-600">Deploy Agent</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${agentStatus.deployAgent === "active" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                  {agentStatus.deployAgent.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-medium text-slate-600">Monitor Agent</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${agentStatus.monitorAgent === "active" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                  {agentStatus.monitorAgent.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-medium text-slate-600">Report Agent</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${agentStatus.reportAgent === "active" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                  {agentStatus.reportAgent.toUpperCase()}
                </span>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-slate-600">Latest CID</p>
                <p className="break-all font-mono text-xs text-indigo-600">{agentStatus.latestCid}</p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-slate-600">Latest Report</p>
                <p className="text-slate-800 leading-relaxed">{agentStatus.latestReport}</p>
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Transaction History (Last 5 Swaps)</h2>
          {txHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <p className="text-sm font-medium">No swaps detected yet.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Direction</th>
                    <th className="px-4 py-3">Amount In</th>
                    <th className="px-4 py-3">Amount Out</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {txHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-600">{item.timestamp}</td>
                      <td className="px-4 py-3"><span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${item.direction === "A→B" ? "bg-indigo-100 text-indigo-700" : "bg-purple-100 text-purple-700"}`}>{item.direction}</span></td>
                      <td className="px-4 py-3 font-mono text-slate-700">{item.amountIn}</td>
                      <td className="px-4 py-3 font-mono text-slate-900 font-bold">{item.amountOut}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
