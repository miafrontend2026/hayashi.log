// Stay-jp-notes 訂閱方案配置
// 改價要同時改:pricing.html / home.html / stayjp-app/src/lib/subscription.ts

export const EARLY_BIRD_LIMIT = 100;

export type PlanKey = "monthly" | "yearly" | "yearly_early_bird" | "lifetime";
export type Source = "web" | "app";
export type SubStatus = "active" | "cancelled" | "expired" | "refunded";

export const PLANS: Record<PlanKey, {
  price_twd: number;
  period_days: number;
  ecpay_period_type: "M" | "Y";
  ecpay_frequency: number;
  display_name: string;
}> = {
  monthly: {
    price_twd: 149,
    period_days: 30,
    ecpay_period_type: "M",
    ecpay_frequency: 1,
    display_name: "月費",
  },
  yearly: {
    price_twd: 1490,
    period_days: 365,
    ecpay_period_type: "Y",
    ecpay_frequency: 1,
    display_name: "年費",
  },
  yearly_early_bird: {
    price_twd: 990,
    period_days: 365,
    ecpay_period_type: "Y",
    ecpay_frequency: 1,
    display_name: "早期鳥年費",
  },
  lifetime: {
    price_twd: 2990,
    period_days: 365 * 100,    // 100 年 ~= 終身,實際 willRenew=false
    ecpay_period_type: "M",     // 不續扣
    ecpay_frequency: 1,
    display_name: "終身方案",
  },
};

// 退費規則(全自動)
export const REFUND_POLICY = {
  full_refund_days: 7,             // 首次訂閱 7 天內全退
  blacklist_after_refunds: 2,      // 退費滿 2 次 email 永久 blacklist
  no_early_bird_after_refunds: 1,  // 退費 1 次後不享早鳥
};

// 失敗扣款 retry 排程(天數)
export const RETRY_SCHEDULE_DAYS = [1, 3, 7, 14];

// 環境設定 — 從 functions config 讀
export function ecpayConfig() {
  return {
    merchantId: process.env.ECPAY_MERCHANT_ID || "3002607",     // sandbox default
    hashKey:    process.env.ECPAY_HASH_KEY    || "pwFHCqoQZGmho4w6",
    hashIV:     process.env.ECPAY_HASH_IV     || "EkRm7iFT261dpevs",
    isProduction: process.env.ECPAY_PRODUCTION === "true",
    siteOrigin: process.env.SITE_ORIGIN || "https://stayjp.study",
    // 綠界 ECPay 的 callback URL — stayjp.study 是 GitHub Pages,沒有 /api/* proxy
    // 改用 Cloud Function 直接 public URL
    callbackUrl: process.env.ECPAY_CALLBACK_URL || "https://ecpaycallback-lsd7okt5qa-de.a.run.app",
    // user POST redirect URL — ECPay 結帳完把 user 送到這個 function,function 302 轉到 account.html
    returnUrl: process.env.ECPAY_RETURN_URL || "https://ecpayreturn-lsd7okt5qa-de.a.run.app",
  };
}

export function ecpayEndpoint() {
  const cfg = ecpayConfig();
  return cfg.isProduction
    ? "https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5"
    : "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5";
}

// 信用卡單筆退費 / 取消授權 — DoAction Action=R / E / N (限該筆 TradeNo)
export function ecpayRefundEndpoint() {
  const cfg = ecpayConfig();
  return cfg.isProduction
    ? "https://payment.ecpay.com.tw/CreditDetail/DoAction"
    : "https://payment-stage.ecpay.com.tw/CreditDetail/DoAction";
}

// 定期定額 停止訂閱 — PeriodAction Action=CancelRevoke (用 MerchantTradeNo)
export function ecpayPeriodActionEndpoint() {
  const cfg = ecpayConfig();
  return cfg.isProduction
    ? "https://payment.ecpay.com.tw/Cashier/CreditCardPeriodAction"
    : "https://payment-stage.ecpay.com.tw/Cashier/CreditCardPeriodAction";
}
