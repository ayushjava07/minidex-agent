import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

const agentStatus = {
  deployAgent: "active",
  monitorAgent: "inactive",
  reportAgent: "active",
  latestCid: "bafy-test-cid",
  latestReport: "Pool is healthy."
};

describe("MiniDEX dashboard", () => {
  beforeEach(() => {
    delete window.ethereum;
    global.fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue(agentStatus)
    });
  });

  it("keeps transaction actions disabled until wallet and contracts are ready", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "Swap A→B" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Swap B→A" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add Liquidity" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove Liquidity" })).toBeDisabled();
  });

  it("hydrates agent status from the status endpoint", async () => {
    render(<App />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/agent-status.json"));
    expect(await screen.findByText("bafy-test-cid")).toBeInTheDocument();
    expect(screen.getByText("Pool is healthy.")).toBeInTheDocument();
    expect(screen.getByText("INACTIVE")).toBeInTheDocument();
  });

  it("shows a user-visible error when MetaMask is unavailable", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Connect MetaMask" }));

    expect(await screen.findByText("MetaMask not found.")).toBeInTheDocument();
  });
});
