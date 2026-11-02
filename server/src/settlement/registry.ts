import { config } from "../config.js";
import { HashKeyHSPSettlementAdapter } from "./hspAdapter.js";

let hsp: HashKeyHSPSettlementAdapter | null = null;

export function hspAdapter(): HashKeyHSPSettlementAdapter {
  if (!hsp) hsp = new HashKeyHSPSettlementAdapter(config().hsp);
  return hsp;
}

/** Test hook. */
export function setHspAdapter(adapter: HashKeyHSPSettlementAdapter | null) {
  hsp = adapter;
}
