import { Decimal } from "decimal.js";
import { setPrice } from "@repo/pricing";

export async function setTestPrice(symbol: string, price: string | number): Promise<void> {
  await setPrice(symbol, new Decimal(price));
}
