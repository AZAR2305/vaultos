import { ethers, BrowserProvider, parseEther } from 'ethers';

let provider: BrowserProvider | null = null;
let signer: ethers.Signer | null = null;

export const connectWallet = async (): Promise<void> => {
    if (window.ethereum) {
        provider = new BrowserProvider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        signer = await provider.getSigner();
    } else {
        console.error("Please install a web3 wallet like MetaMask.");
    }
};

export const getWalletAddress = async (): Promise<string | null> => {
    if (signer) {
        return await signer.getAddress();
    }
    return null;
};

export const sendTransaction = async (to: string, amount: string): Promise<void> => {
    if (signer) {
        const tx = {
            to,
            value: parseEther(amount),
        };
        await signer.sendTransaction(tx);
    } else {
        console.error("Wallet not connected.");
    }
};

export const getProvider = (): BrowserProvider | null => {
    return provider;
};