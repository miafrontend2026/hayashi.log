// HTTP function:ECPay OrderResultURL — 接 ECPay 結帳完的 user POST,302 redirect 到 account.html
//
// 為什麼需要這個:
//   stayjp.study 是 GitHub Pages,只接受 GET。但 ECPay 結帳完會 POST user 過來。
//   這個 function 純粹做「POST → 302 GET」的轉接,讓 user 安全回到 account.html。
//
// 注意:這只是 UX 的橋梁,真正的 payment 結果驗證是在 ecpayCallback(server-to-server)。
//      這裡不寫 Firestore,不做任何業務邏輯。

import * as functions from "firebase-functions/v2/https";
import { ecpayConfig } from "./utils/constants";

export const ecpayReturn = functions.onRequest(
  {
    region: "asia-east1",
    invoker: "public",
    maxInstances: 10,
    timeoutSeconds: 10,
    memory: "256MiB",
    concurrency: 80,
  },
  async (req, res) => {
    const cfg = ecpayConfig();
    // 不管 POST / GET 都統一 302 到 account.html
    res.redirect(302, `${cfg.siteOrigin}/account.html?from=ecpay`);
  },
);
