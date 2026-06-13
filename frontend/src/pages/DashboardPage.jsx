import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import toast, { Toaster } from "react-hot-toast";
import { ERC20_ABI, MINIDEX_ABI } from "../contracts";

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

export default function DashboardPage() {
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
    deployAgent: "active", monitorAgent: "active", reportAgent: "active", latestCid: "-", latestReport: "-"
  });

  const contractsReady = useMemo(() => {
    return signer && ethers.isAddress(tokenAAddress) && ethers.isAddress(tokenBAddress) && ethers.isAddress(miniDexAddress);
  }, [signer, tokenAAddress, tokenBAddress, miniDexAddress]);

  const dexContract = useMemo(() => contractsReady ? new ethers.Contract(miniDexAddress, MINIDEX_ABI, signer) : null, [contractsReady, miniDexAddress, signer]);
  const tokenAContract = useMemo(() => contractsReady ? new ethers.Contract(tokenAAddress, ERC20_ABI, signer) : null, [contractsReady, tokenAAddress, signer]);
  const tokenBContract = useMemo(() => contractsReady ? new ethers.Contract(tokenBAddress, ERC20_ABI, signer) : null, [contractsReady, tokenBAddress, signer]);

  async function connectWallet() {
    try {
      if (!window.ethereum) throw new Error("MetaMask not found.");
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const network = await browserProvider.getNetwork();
      if (Number(network.chainId) !== SEPOLIA_CHAIN_ID) throw new Error("Please switch MetaMask to Sepolia.");
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
    setProvider(null); setSigner(null); setAddress(""); setEthBalance("0");
    toast.success("Wallet disconnected.");
  }

  async function refreshEthBalance() {
    if (!provider || !address) return;
    const balance = await provider.getBalance(address);
    setEthBalance(ethers.formatEther(balance));
  }

  async function refreshReserves() {
    if (!dexContract) return;
    try { const [a, b] = await dexContract.getReserves(); setReserveA(a); setReserveB(b); } catch {}
  }

  async function refreshTokenMeta() {
    if (!tokenAContract || !tokenBContract) return;
    try {
      const [aDecimals, bDecimals] = await Promise.all([tokenAContract.decimals(), tokenBContract.decimals()]);
      setTokenADecimals(Number(aDecimals)); setTokenBDecimals(Number(bDecimals));
    } catch { setTokenADecimals(18); setTokenBDecimals(18); }
  }

  useEffect(() => { refreshTokenMeta(); refreshReserves() }, [tokenAContract, tokenBContract, dexContract]);
  useEffect(() => { if (!dexContract) return; const t = setInterval(refreshReserves, 10000); return () => clearInterval(t) }, [dexContract]);
  useEffect(() => {
    fetch("/api/agent-status").then(r => r.json()).then(d => setAgentStatus(d)).catch(() => {});
  }, []);
  useEffect(() => {
    if (!window.ethereum) return;
    const h = () => connectWallet();
    window.ethereum.on("accountsChanged", h);
    return () => window.ethereum.removeListener("accountsChanged", h);
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
    } finally { setLoadingAction(""); }
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
      setTxHistory(prev => [{ id: `${Date.now()}-a-b`, timestamp: new Date().toLocaleString(), direction: "A→B", amountIn: `${swapAmountA}`, amountOut: ethers.formatUnits(amountOut, tokenBDecimals) }, ...prev].slice(0, 5));
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
      setTxHistory(prev => [{ id: `${Date.now()}-b-a`, timestamp: new Date().toLocaleString(), direction: "B→A", amountIn: `${swapAmountB}`, amountOut: ethers.formatUnits(amountOut, tokenADecimals) }, ...prev].slice(0, 5));
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
    await runWithFeedback("Remove Liquidity", async () => dexContract.removeLiquidity(amountA, amountB));
  }

  const estimatedOutB = useMemo(() => { const a = parseAmount(swapAmountA, tokenADecimals); return ethers.formatUnits(computeAmountOut(a, reserveA, reserveB), tokenBDecimals) }, [swapAmountA, reserveA, reserveB, tokenADecimals, tokenBDecimals]);
  const estimatedOutA = useMemo(() => { const a = parseAmount(swapAmountB, tokenBDecimals); return ethers.formatUnits(computeAmountOut(a, reserveB, reserveA), tokenADecimals) }, [swapAmountB, reserveA, reserveB, tokenADecimals, tokenBDecimals]);
  const exchangeRate = reserveA > 0n ? Number(ethers.formatUnits(reserveB, tokenBDecimals)) / Number(ethers.formatUnits(reserveA, tokenADecimals)) : 0;

  return (
    <div>
      <Toaster position="top-right" />
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-surface-border dark:bg-surface-card">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">MiniDEX Dashboard</h1>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Network: Sepolia Testnet</p>
            </div>
            <div className="flex flex-col gap-2 text-sm md:items-end">
              <p className="font-medium text-slate-700 dark:text-slate-300">Wallet: <span className="font-mono text-filecoin-600 dark:text-filecoin-400">{shortAddress(address)}</span></p>
              <p className="font-medium text-slate-700 dark:text-slate-300">ETH Balance: <span className="text-slate-700 dark:text-slate-300">{Number(ethBalance || 0).toFixed(4)}</span></p>
              {!address ? (
                <button onClick={connectWallet} className="btn-primary mt-2">Connect MetaMask</button>
              ) : (
                <button onClick={disconnectWallet} className="btn-secondary mt-2">Disconnect</button>
              )}
            </div>
          </div>
        </header>

        <section className="glass p-6">
          <h2 className="mb-4 text-xl font-semibold text-slate-900 dark:text-white">Contract Addresses</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Token A</label>
              <input className="input-field" placeholder="0x..." value={tokenAAddress} onChange={(e) => setTokenAAddress(e.target.value.trim())} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Token B</label>
              <input className="input-field" placeholder="0x..." value={tokenBAddress} onChange={(e) => setTokenBAddress(e.target.value.trim())} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">MiniDEX</label>
              <input className="input-field" placeholder="0x..." value={miniDexAddress} onChange={(e) => setMiniDexAddress(e.target.value.trim())} />
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="glass p-6">
            <h2 className="mb-4 text-xl font-semibold text-slate-900 dark:text-white">Swap Panel</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Swap Token A</label>
                <input className="input-field font-mono" placeholder="Amount" value={swapAmountA} onChange={(e) => setSwapAmountA(e.target.value)} />
                <p className="text-xs font-medium text-slate-500">Estimated Token B out: <span className="text-filecoin-600">{estimatedOutB}</span></p>
                <button disabled={!contractsReady || loadingAction === "Swap A→B"} onClick={handleSwapAforB} className="btn-primary w-full">
                  {loadingAction === "Swap A→B" ? "Swapping..." : "Swap A→B"}
                </button>
              </div>
              <div className="relative py-2"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100 dark:border-surface-border"></div></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400 dark:bg-surface-card dark:text-slate-500 font-bold">OR</span></div></div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Swap Token B</label>
                <input className="input-field font-mono" placeholder="Amount" value={swapAmountB} onChange={(e) => setSwapAmountB(e.target.value)} />
                <p className="text-xs font-medium text-slate-500">Estimated Token A out: <span className="text-purple-600">{estimatedOutA}</span></p>
                <button disabled={!contractsReady || loadingAction === "Swap B→A"} onClick={handleSwapBforA} className="btn-primary w-full !bg-purple-600 hover:!bg-purple-700">
                  {loadingAction === "Swap B→A" ? "Swapping..." : "Swap B→A"}
                </button>
              </div>
              <p className="text-center text-sm font-medium text-slate-600 dark:text-slate-400">Exchange rate: <span className="text-slate-900 dark:text-white">{Number.isFinite(exchangeRate) ? exchangeRate.toFixed(6) : "0.000000"}</span> B per A</p>
            </div>
          </section>

          <section className="glass p-6">
            <h2 className="mb-4 text-xl font-semibold text-slate-900 dark:text-white">Liquidity Panel</h2>
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-sm font-bold uppercase text-slate-500 dark:text-slate-400">Add Liquidity</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className="input-field" placeholder="Token A" value={liquidityAddA} onChange={(e) => setLiquidityAddA(e.target.value)} />
                  <input className="input-field" placeholder="Token B" value={liquidityAddB} onChange={(e) => setLiquidityAddB(e.target.value)} />
                </div>
                <button disabled={!contractsReady || loadingAction === "Add Liquidity"} onClick={handleAddLiquidity} className="btn-primary w-full !bg-emerald-600 hover:!bg-emerald-700">
                  {loadingAction === "Add Liquidity" ? "Adding..." : "Add Liquidity"}
                </button>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-bold uppercase text-slate-500 dark:text-slate-400">Remove Liquidity</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className="input-field" placeholder="Token A" value={liquidityRemoveA} onChange={(e) => setLiquidityRemoveA(e.target.value)} />
                  <input className="input-field" placeholder="Token B" value={liquidityRemoveB} onChange={(e) => setLiquidityRemoveB(e.target.value)} />
                </div>
                <button disabled={!contractsReady || loadingAction === "Remove Liquidity"} onClick={handleRemoveLiquidity} className="btn-primary w-full !bg-rose-600 hover:!bg-rose-700">
                  {loadingAction === "Remove Liquidity" ? "Removing..." : "Remove Liquidity"}
                </button>
              </div>
            </div>
          </section>

          <section className="glass p-6">
            <h2 className="mb-4 text-xl font-semibold text-slate-900 dark:text-white">Pool Stats</h2>
            <div className="space-y-3">
              <div className="flex justify-between rounded-lg bg-slate-50 p-3 dark:bg-surface-dark">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Reserve A</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{ethers.formatUnits(reserveA, tokenADecimals)}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-slate-50 p-3 dark:bg-surface-dark">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Reserve B</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{ethers.formatUnits(reserveB, tokenBDecimals)}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-filecoin-50 p-3 dark:bg-filecoin-950/40">
                <span className="text-sm font-medium text-filecoin-700 dark:text-filecoin-300">Price Ratio (B/A)</span>
                <span className="font-mono font-bold text-filecoin-900 dark:text-filecoin-100">{Number.isFinite(exchangeRate) ? exchangeRate.toFixed(6) : "0.000000"}</span>
              </div>
              <p className="text-center text-xs font-medium text-slate-400 italic">Auto-refreshes every 10 seconds</p>
            </div>
          </section>

          <section className="glass p-6">
            <h2 className="mb-4 text-xl font-semibold text-slate-900 dark:text-white">Agent Status</h2>
            <div className="space-y-3 text-sm">
              {["deployAgent", "monitorAgent", "reportAgent"].map(key => (
                <div key={key} className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-surface-border">
                  <span className="font-medium text-slate-600 dark:text-slate-400">{key.replace("Agent", "").replace(/^[a-z]/, c => c.toUpperCase())} Agent</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${agentStatus[key] === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"}`}>
                    {agentStatus[key]?.toUpperCase() || "UNKNOWN"}
                  </span>
                </div>
              ))}
              <div className="space-y-1"><p className="font-medium text-slate-600 dark:text-slate-400">Latest CID</p><p className="break-all font-mono text-xs text-filecoin-600 dark:text-filecoin-400">{agentStatus.latestCid}</p></div>
              <div className="space-y-1"><p className="font-medium text-slate-600 dark:text-slate-400">Latest Report</p><p className="text-slate-800 dark:text-slate-200 leading-relaxed">{agentStatus.latestReport}</p></div>
            </div>
          </section>
        </div>

        <section className="glass p-6">
          <h2 className="mb-4 text-xl font-semibold text-slate-900 dark:text-white">Transaction History (Last 5 Swaps)</h2>
          {txHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <p className="text-sm font-medium">No swaps detected yet.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-surface-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500 dark:bg-surface-dark dark:text-slate-400">
                  <tr><th className="px-4 py-3">Timestamp</th><th className="px-4 py-3">Direction</th><th className="px-4 py-3">Amount In</th><th className="px-4 py-3">Amount Out</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-surface-border">
                  {txHistory.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-surface-dark/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">{item.timestamp}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${item.direction === "A→B" ? "bg-filecoin-100 text-filecoin-700 dark:bg-filecoin-900/40 dark:text-filecoin-300" : "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"}`}>{item.direction}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300">{item.amountIn}</td>
                      <td className="px-4 py-3 font-mono text-slate-900 dark:text-white font-bold">{item.amountOut}</td>
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
