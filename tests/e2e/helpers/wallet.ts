import nacl from "tweetnacl";
import bs58 from "bs58";

export type TestWallet = {
  publicKey: string;
  secretKey: Uint8Array;
};

export const createTestWallet = (): TestWallet => {
  const keyPair = nacl.sign.keyPair();
  return {
    publicKey: bs58.encode(keyPair.publicKey),
    secretKey: keyPair.secretKey,
  };
};

export const signMessage = (wallet: TestWallet, message: string): string => {
  const messageBytes = new TextEncoder().encode(message);
  const signatureBytes = nacl.sign.detached(messageBytes, wallet.secretKey);
  return bs58.encode(signatureBytes);
};
