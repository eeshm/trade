export { createTestWallet, signMessage, type TestWallet } from "./wallet.ts";
export { setTestPrice } from "./price.ts";
export { authenticateWallet, createAuthenticatedUser } from "./auth.ts";
export {
  createWsClient,
  sendAndWaitFor,
  waitForMessage,
  authenticateWs,
  subscribeToChannel,
  closeWs,
  type WsMessage,
} from "./websocket.ts";
export {
  setTestPriceForCandles,
  processTestPriceTick,
  getTestCurrentCandle,
  getTestBucketStart,
} from "./candles.ts";
