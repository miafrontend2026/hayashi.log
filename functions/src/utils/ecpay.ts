// ECPay (綠界) 請求簽名工具
//
// 文件:https://developers.ecpay.com.tw/?p=2856
//
// CheckMacValue 演算法:
//   1. 把所有參數 key 按 ASCII 升序排
//   2. 串成 "HashKey=X&key1=val1&key2=val2&...&HashIV=Y"
//   3. URL encode(用 ECPay 規則)
//   4. 轉小寫
//   5. SHA256(或 MD5)雜湊
//   6. 轉大寫

import crypto from "crypto";
import { ecpayConfig } from "./constants";

/** ECPay 的 URL encode 規則,跟 JS 內建的有幾個差異 */
function ecpayUrlEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/%20/g, "+")
    .replace(/%21/g, "!")
    .replace(/%2A/g, "*")
    .replace(/%28/g, "(")
    .replace(/%29/g, ")");
}

/** 算 CheckMacValue。HashKey/HashIV 從 ecpayConfig() 取 */
export function checkMacValue(params: Record<string, string | number>): string {
  const { hashKey, hashIV } = ecpayConfig();

  // 1+2. sort & 串字串
  const sortedKeys = Object.keys(params).sort();
  const kvPairs = sortedKeys
    .filter(k => k !== "CheckMacValue")
    .map(k => `${k}=${params[k]}`);
  const raw = `HashKey=${hashKey}&${kvPairs.join("&")}&HashIV=${hashIV}`;

  // 3. URL encode
  const encoded = ecpayUrlEncode(raw);

  // 4. lowercase
  const lower = encoded.toLowerCase();

  // 5+6. SHA256 → uppercase hex
  return crypto.createHash("sha256").update(lower).digest("hex").toUpperCase();
}

/** 驗證 ECPay callback 的 CheckMacValue */
export function verifyCheckMacValue(params: Record<string, string>): boolean {
  const provided = params.CheckMacValue;
  if (!provided) return false;
  const computed = checkMacValue(params);
  return provided.toUpperCase() === computed;
}

/** 生成綠界 timestamp 格式:YYYY/MM/DD HH:mm:ss(台北時區) */
export function ecpayDateTimeTW(d = new Date()): string {
  const tw = new Date(d.getTime() + 8 * 60 * 60 * 1000); // UTC+8
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${tw.getUTCFullYear()}/${pad(tw.getUTCMonth() + 1)}/${pad(tw.getUTCDate())} ${pad(tw.getUTCHours())}:${pad(tw.getUTCMinutes())}:${pad(tw.getUTCSeconds())}`;
}

/** 生成綠界訂單號:s_<timestamp>_<random6> (20 字內) */
export function generateMerchantTradeNo(): string {
  const ts = Date.now().toString().slice(-10);
  const rand = Math.random().toString(36).slice(2, 8);
  return `s${ts}${rand}`.slice(0, 20);
}
