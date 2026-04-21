// ========== LISTENING PRACTICE ==========
const Listening = (() => {
  const SCORE_KEY = 'listening_scores';
  let currentItem = null;
  let replaysLeft = 2;
  let score = 0;
  let total = 0;
  let queue = [];
  let answered = [];
  let practiceMode = false;
  let speedOverride = null;
  let selectedLevel = 'n5';

  // ── item bank ──
  const items = [
    // ===== N5 (8 items) =====
    {
      id:"l-n5-1", level:"n5", type:"短い会話", speed:0.75,
      script:"A：すみません、トイレはどこですか。\nB：あちらです。まっすぐいって、みぎです。",
      q:"洗手間在哪裡？",
      options:["直走右轉","直走左轉","在二樓","在外面"], correct:0
    },
    {
      id:"l-n5-2", level:"n5", type:"説明を聞く", speed:0.75,
      script:"きょうは にちようびです。てんきは はれです。あたたかいです。",
      q:"今天是什麼天氣？",
      options:["晴天","雨天","陰天","下雪"], correct:0
    },
    {
      id:"l-n5-3", level:"n5", type:"短い会話", speed:0.75,
      script:"A：なんじに おきますか。\nB：まいにち ろくじに おきます。",
      q:"B每天幾點起床？",
      options:["5點","6點","7點","8點"], correct:1
    },
    {
      id:"l-n5-4", level:"n5", type:"単語聞き取り", speed:0.7,
      script:"わたしは まいにち がっこうで にほんごを べんきょうします。",
      q:"這個人每天學什麼？",
      options:["英語","中文","日語","韓語"], correct:2
    },
    {
      id:"l-n5-5", level:"n5", type:"短い会話", speed:0.75,
      script:"A：このりんごは いくらですか。\nB：ひとつ ひゃくえんです。\nA：じゃ、みっつ ください。",
      q:"A要買幾個蘋果？",
      options:["1個","2個","3個","4個"], correct:2
    },
    {
      id:"l-n5-6", level:"n5", type:"説明を聞く", speed:0.75,
      script:"わたしの かぞくは さんにんです。ちちと ははと わたしです。",
      q:"我的家人有幾個人？",
      options:["2人","3人","4人","5人"], correct:1
    },
    {
      id:"l-n5-7", level:"n5", type:"短い会話", speed:0.75,
      script:"A：すきな たべものは なんですか。\nB：すしが すきです。\nA：わたしも すしが すきです。",
      q:"兩個人都喜歡什麼食物？",
      options:["拉麵","天婦羅","壽司","咖哩"], correct:2
    },
    {
      id:"l-n5-8", level:"n5", type:"単語聞き取り", speed:0.7,
      script:"あした、ともだちと こうえんに いきます。",
      q:"明天要和朋友去哪裡？",
      options:["學校","公園","圖書館","車站"], correct:1
    },

    // ===== N4 (8 items) =====
    {
      id:"l-n4-1", level:"n4", type:"短い会話", speed:0.85,
      script:"A：すみません、大阪城への行き方を教えていただけませんか。\nB：ここからまっすぐ行って、二つ目の信号を右に曲がってください。五分ぐらいで着きますよ。",
      q:"這個人想去哪裡？",
      options:["大阪城","大阪站","通天閣","梅田"], correct:0
    },
    {
      id:"l-n4-2", level:"n4", type:"説明を聞く", speed:0.85,
      script:"たこ焼きは大阪の有名な食べ物です。小麦粉の中にたこを入れて、丸く焼きます。ソースとマヨネーズをかけて食べます。",
      q:"章魚燒的形狀是什麼？",
      options:["四角形","圓形","三角形","長方形"], correct:1
    },
    {
      id:"l-n4-3", level:"n4", type:"短い会話", speed:0.85,
      script:"A：道頓堀でお好み焼きを食べませんか。\nB：いいですね。でも、今日は雨が降りそうですから、デパートの中のレストランはどうですか。\nA：そうですね。そうしましょう。",
      q:"他們決定去哪裡吃？",
      options:["道頓堀的店","百貨公司裡的餐廳","家裡","便利商店"], correct:1
    },
    {
      id:"l-n4-4", level:"n4", type:"単語聞き取り", speed:0.85,
      script:"御堂筋線は大阪の南北を走る地下鉄です。梅田から難波まで約十分で行けます。",
      q:"從梅田到難波大約要多久？",
      options:["約5分鐘","約10分鐘","約20分鐘","約30分鐘"], correct:1
    },
    {
      id:"l-n4-5", level:"n4", type:"短い会話", speed:0.85,
      script:"A：すみません、たこ焼きを二つと、お好み焼きを一つください。\nB：はい。たこ焼きは一つ五百円で、お好み焼きは八百円です。\nA：じゃ、全部でいくらですか。\nB：千八百円です。",
      q:"總共多少錢？",
      options:["1300日圓","1500日圓","1800日圓","2000日圓"], correct:2
    },
    {
      id:"l-n4-6", level:"n4", type:"説明を聞く", speed:0.85,
      script:"この電車は天王寺行きです。次は難波、難波です。お降りの方は、忘れ物のないようにお気をつけください。",
      q:"下一站是哪裡？",
      options:["天王寺","梅田","難波","新大阪"], correct:2
    },
    {
      id:"l-n4-7", level:"n4", type:"短い会話", speed:0.85,
      script:"A：明日のパーティーに何を持っていきますか。\nB：飲み物を持っていこうと思います。Aさんは？\nA：私はケーキを作ります。",
      q:"A要帶什麼去派對？",
      options:["飲料","蛋糕","零食","水果"], correct:1
    },
    {
      id:"l-n4-8", level:"n4", type:"単語聞き取り", speed:0.85,
      script:"先週の日曜日に友達と新世界に行きました。串カツを食べて、通天閣に登りました。とても楽しかったです。",
      q:"他們吃了什麼？",
      options:["章魚燒","拉麵","串炸","壽司"], correct:2
    },

    // ===== N3 (10 items) =====
    {
      id:"l-n3-1", level:"n3", type:"短い会話", speed:0.9,
      script:"A：すみません、大阪城への行き方を教えていただけませんか。\nB：ここからまっすぐ行って、二つ目の信号を右に曲がってください。そのまま五分ほど歩くと、左手に見えてきますよ。\nA：ありがとうございます。歩いてどのくらいかかりますか。\nB：十五分ぐらいですね。",
      q:"大阪城まで歩いて何分ぐらいですか？",
      options:["5分鐘","10分鐘","15分鐘","20分鐘"], correct:2
    },
    {
      id:"l-n3-2", level:"n3", type:"説明を聞く", speed:0.9,
      script:"本日は御堂筋線をご利用いただきありがとうございます。この電車は、なかもず行きです。次は心斎橋、心斎橋です。阪神線へお乗り換えのお客様は、次の難波駅でお降りください。",
      q:"要轉乘阪神線的話，在哪一站下車？",
      options:["心齋橋","難波","梅田","天王寺"], correct:1
    },
    {
      id:"l-n3-3", level:"n3", type:"短い会話", speed:0.9,
      script:"A：来週の出張、大阪のホテルはもう予約した？\nB：まだなんだ。駅の近くで探しているんだけど、どこがいいかな。\nA：梅田周辺なら便利だと思うよ。値段もそんなに高くないし。\nB：じゃ、今日中に予約するよ。ありがとう。",
      q:"B要在哪裡找飯店？",
      options:["難波周邊","梅田周邊","天王寺周邊","心齋橋周邊"], correct:1
    },
    {
      id:"l-n3-4", level:"n3", type:"単語聞き取り", speed:0.9,
      script:"大阪市からのお知らせです。明日は台風の影響で、大雨と強風が予想されます。不要な外出は控えてください。最新情報はウェブサイトで確認できます。",
      q:"明天預計會有什麼天氣？",
      options:["大雪","大雨和強風","地震","高溫"],correct:1
    },
    {
      id:"l-n3-5", level:"n3", type:"短い会話", speed:0.9,
      script:"A：部長、来週の会議の資料ができました。確認していただけますか。\nB：ありがとう。今日中に目を通すから、修正点があれば明日の朝伝えるね。\nA：わかりました。よろしくお願いします。",
      q:"部長什麼時候會告知修改點？",
      options:["今天下午","今天晚上","明天早上","明天下午"], correct:2
    },
    {
      id:"l-n3-6", level:"n3", type:"説明を聞く", speed:0.9,
      script:"道頓堀は大阪を代表する繁華街で、グリコの看板が有名です。通りにはたこ焼きやお好み焼きなど、大阪名物の店がたくさん並んでいます。外国人観光客にも人気のスポットです。",
      q:"道頓堀以什麼看板著名？",
      options:["カニ道楽","グリコ","くいだおれ太郎","づぼらや"], correct:1
    },
    {
      id:"l-n3-7", level:"n3", type:"短い会話", speed:0.9,
      script:"A：すみません、このシャツ、色違いはありますか。\nB：こちらのシャツは白と黒と青がございます。\nA：青はMサイズはありますか。\nB：申し訳ありません、青のMサイズは売り切れてしまいまして。白と黒ならMサイズがございます。\nA：じゃ、白のMをください。",
      q:"客人最後選了什麼？",
      options:["藍色M號","白色M號","黑色M號","青色L號"], correct:1
    },
    {
      id:"l-n3-8", level:"n3", type:"単語聞き取り", speed:0.9,
      script:"来月から、この図書館の開館時間が変わります。平日は午前九時から午後九時まで、土日は午前十時から午後六時までです。月曜日は休館日です。",
      q:"星期一圖書館怎樣？",
      options:["正常開放","延長營業","休館","只開到中午"], correct:2
    },
    {
      id:"l-n3-9", level:"n3", type:"短い会話", speed:0.9,
      script:"A：明日の飲み会、何人ぐらい来るかな。\nB：今のところ、八人かな。田中さんが急に来られなくなったから。\nA：そうか。じゃ、予約の人数を変更しておくね。\nB：お願い。あと、個室がいいんだけど。\nA：わかった、聞いてみるよ。",
      q:"目前有幾個人會來？",
      options:["7人","8人","9人","10人"], correct:1
    },
    {
      id:"l-n3-10", level:"n3", type:"説明を聞く", speed:0.9,
      script:"有馬温泉は大阪から電車で約一時間のところにある、日本三古湯の一つです。金泉と銀泉の二種類のお湯があります。日帰りでも楽しむことができるので、大阪観光のついでに訪れる人も多いです。",
      q:"從大阪到有馬溫泉搭電車要多久？",
      options:["約30分鐘","約1小時","約2小時","約3小時"], correct:1
    },

    // ===== N2 (8 items) =====
    {
      id:"l-n2-1", level:"n2", type:"短い会話", speed:0.95,
      script:"A：来月の大阪出張の件ですが、現地のクライアントとの打ち合わせは午後からですので、午前中は空いています。\nB：じゃ、せっかくだから午前中に工場の視察を入れてもらえますか。\nA：承知しました。先方に連絡しておきます。",
      q:"午前中安排了什麼？",
      options:["與客戶開會","工廠視察","自由時間","報告準備"], correct:1
    },
    {
      id:"l-n2-2", level:"n2", type:"説明を聞く", speed:0.95,
      script:"本日の会議の議題は三点です。一点目は来期の予算について、二点目は新商品の販売戦略について、三点目は人事異動についてです。それぞれ二十分ずつ時間を取りますので、合計一時間の予定です。",
      q:"會議預計多久？",
      options:["30分鐘","40分鐘","1小時","1.5小時"], correct:2
    },
    {
      id:"l-n2-3", level:"n2", type:"短い会話", speed:0.95,
      script:"A：鈴木さん、昨日提出してもらった企画書なんだけど、コンセプトは面白いと思う。ただ、予算の部分がもう少し具体的だといいかな。\nB：わかりました。見積もりを取り直して、金曜日までに修正版を提出します。\nA：お願いします。",
      q:"企劃書需要修改哪個部分？",
      options:["概念","預算","時程","人員配置"], correct:1
    },
    {
      id:"l-n2-4", level:"n2", type:"単語聞き取り", speed:0.95,
      script:"近年、大阪市ではインバウンド需要の急増に対応するため、多言語案内システムの導入を進めています。地下鉄の駅構内では、英語、中国語、韓国語に加え、タイ語での案内も始まりました。",
      q:"新增加了哪種語言的導覽？",
      options:["越南語","印尼語","泰語","法語"], correct:2
    },
    {
      id:"l-n2-5", level:"n2", type:"短い会話", speed:0.95,
      script:"A：今度の社員旅行、どこがいいと思いますか。\nB：沖縄はどうですか。去年は北海道だったから、今年は暖かいところがいいかなと。\nA：沖縄か。予算的に厳しくないですか。\nB：格安航空を使えば、かなり抑えられると思いますよ。\nA：なるほど。じゃ、見積もりを出してもらえますか。",
      q:"他們討論社員旅行要去哪裡？",
      options:["北海道","京都","沖繩","九州"], correct:2
    },
    {
      id:"l-n2-6", level:"n2", type:"説明を聞く", speed:0.95,
      script:"大阪万博では、空飛ぶクルマの実用化に向けた実証実験が行われました。電動で垂直に離着陸できるこの乗り物は、都市部の交通渋滞の解消や、離島へのアクセス改善に期待されています。しかし、安全基準の策定や騒音問題など、課題も残されています。",
      q:"飛行汽車的課題是什麼？",
      options:["太貴","安全基準和噪音問題","電力不足","乘客太少"], correct:1
    },
    {
      id:"l-n2-7", level:"n2", type:"短い会話", speed:0.95,
      script:"A：田中さん、明日のプレゼン資料、最終確認お願いできますか。\nB：はい。何時までに必要ですか。\nA：明日の朝九時からプレゼンなので、今日の五時までにいただけると助かります。\nB：わかりました。四時には送ります。",
      q:"B什麼時候會發送資料？",
      options:["3點","4點","5點","明天早上"],correct:1
    },
    {
      id:"l-n2-8", level:"n2", type:"単語聞き取り", speed:0.95,
      script:"働き方改革の一環として、弊社ではフレックスタイム制を導入いたします。コアタイムは午前十時から午後三時までとし、それ以外の時間は社員が自由に調整できます。来月一日から適用されます。",
      q:"核心時間是幾點到幾點？",
      options:["9點到4點","10點到3點","9點到5點","10點到4點"], correct:1
    },

    // ===== N1 (6 items) =====
    {
      id:"l-n1-1", level:"n1", type:"短い会話", speed:1.0,
      script:"A：先日の提案書について、先方からフィードバックがありまして。全体的な方向性は評価されたんですが、収益モデルの部分でもう少し掘り下げた分析が欲しいと。\nB：なるほど。競合他社との比較データを追加して、差別化ポイントを明確にしたほうがいいかもしれませんね。\nA：そうですね。あと、リスク分析も入れておきましょう。来週水曜日の再提出に間に合いますか。\nB：なんとかしますが、マーケティング部からのデータが必要です。至急手配してもらえますか。",
      q:"對方要求補充什麼？",
      options:["人員配置","收益模型的深入分析","技術細節","法律審查"], correct:1
    },
    {
      id:"l-n1-2", level:"n1", type:"説明を聞く", speed:1.0,
      script:"量子コンピュータの研究開発が世界各国で加速しています。従来のコンピュータが零と一の二進法で計算するのに対し、量子コンピュータは量子ビットを用いることで、膨大な計算を同時に処理できる可能性を秘めています。医薬品開発や気候シミュレーションなど、応用分野は多岐にわたりますが、実用化にはまだ技術的な課題が残されています。",
      q:"量子電腦與傳統電腦的主要區別是什麼？",
      options:["速度更快","使用量子位元可同時處理大量計算","更省電","更小型"], correct:1
    },
    {
      id:"l-n1-3", level:"n1", type:"短い会話", speed:1.0,
      script:"A：今回の人事異動の件ですが、大阪支社の営業部長に田中さんを推薦したいと考えています。\nB：田中さんですか。確かに実績は申し分ないですが、マネジメント経験が浅いのが気になりますね。\nA：その点は承知していますが、彼のリーダーシップと行動力は高く評価されていますし、副部長がベテランですから、サポート体制は整っています。\nB：分かりました。役員会に上げて検討しましょう。",
      q:"B擔心田中的什麼？",
      options:["業績","管理經驗不足","溝通能力","身體狀況"], correct:1
    },
    {
      id:"l-n1-4", level:"n1", type:"単語聞き取り", speed:1.0,
      script:"少子高齢化に伴う労働力不足は、日本経済の構造的な課題である。特に介護、建設、農業といった分野での人手不足は深刻で、外国人材の受け入れ拡大が喫緊の課題となっている。一方で、受け入れ態勢の整備や、多文化共生社会の実現に向けた取り組みも求められている。",
      q:"哪些領域的人手不足特別嚴重？",
      options:["IT、金融、教育","護理、建設、農業","製造、物流、零售","醫療、法律、會計"], correct:1
    },
    {
      id:"l-n1-5", level:"n1", type:"短い会話", speed:1.0,
      script:"A：このプロジェクト、当初の見込みより大幅にコストが超過していますね。\nB：はい。原材料の高騰と、仕様変更の度重なる発生が主な原因です。\nA：今後の対策として、仕様変更のプロセスを厳格化する必要がありますね。承認フローを見直しましょう。\nB：それに加えて、調達先の多様化も検討したいのですが。\nA：いいですね。次回の定例会議でまとめて提案しましょう。",
      q:"成本超支的主要原因是什麼？",
      options:["人員不足","原料漲價和頻繁的規格變更","進度延誤","匯率變動"], correct:1
    },
    {
      id:"l-n1-6", level:"n1", type:"説明を聞く", speed:1.0,
      script:"現代社会における孤独の問題は、もはや個人の問題にとどまらない。イギリスでは孤独担当大臣が設置され、日本でも同様のポストが置かれた。研究によれば、慢性的な孤独は一日十五本の喫煙に匹敵する健康リスクがあるとされ、心血管疾患や認知症のリスクを高めることが分かっている。解決には、制度的な支援とともに、地域コミュニティの再構築が不可欠である。",
      q:"慢性孤獨的健康風險被比喻為什麼？",
      options:["每天喝5杯酒","每天抽15根煙","每天不運動","每天只睡4小時"], correct:1
    }
  ];

  // ── helpers ──
  function getScores() { try { return JSON.parse(localStorage.getItem(SCORE_KEY)) || {}; } catch(e) { return {}; } }
  function saveScores(d) { localStorage.setItem(SCORE_KEY, JSON.stringify(d)); }

  function speakText(text, rate) {
    if (!window.speechSynthesis) { alert(t('ls_no_tts')); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    u.rate = rate || 0.85;
    const voices = speechSynthesis.getVoices();
    const jaVoice = voices.find(v => v.lang.startsWith('ja'));
    if (jaVoice) u.voice = jaVoice;
    speechSynthesis.speak(u);
  }

  // ── UI ──
  function start() {
    const box = document.getElementById('quizBox');
    const scores = getScores();
    const levelStats = ['n5','n4','n3','n2','n1'].map(lv => {
      const s = scores[lv] || { correct: 0, total: 0 };
      const pct = s.total ? Math.round(s.correct / s.total * 100) : 0;
      return `<span style="font-size:11px;color:var(--tx2)">${lv.toUpperCase()}: ${s.correct}/${s.total} (${pct}%)</span>`;
    }).join(' ');

    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 style="margin:0">${t('ls_title')}</h3>
        <button class="qclose" style="width:auto;margin:0;padding:2px 10px" onclick="Listening.close()">✕</button>
      </div>
      <p style="font-size:13px;color:var(--tx2);margin-bottom:6px">${t('ls_subtitle')}</p>
      <p style="font-size:11px;color:var(--tx3);margin-bottom:12px">${t('ls_hint')}</p>
      <div class="qf"><label>${t('quiz_level')}</label><div class="qo" id="lsLevel">
        <button class="on" data-v="n5">N5</button><button data-v="n4">N4</button>
        <button data-v="n3">N3</button><button data-v="n2">N2</button>
        <button data-v="n1">N1</button>
      </div></div>
      <div class="qf"><label>${t('quiz_count')}</label><div class="qo" id="lsCount">
        <button data-v="3">3</button><button class="on" data-v="5">5</button><button data-v="all">${t('ls_all')}</button>
      </div></div>
      <div class="qf"><label>${t('ls_mode')}</label><div class="qo" id="lsMode">
        <button class="on" data-v="test">${t('ls_mode_test')}</button>
        <button data-v="practice">${t('ls_mode_practice')}</button>
      </div></div>
      <div style="margin:10px 0;display:flex;flex-wrap:wrap;gap:4px">${levelStats}</div>
      <button class="qstart" onclick="Listening.begin()">${t('ls_start')}</button>
      <button class="qclose" onclick="Listening.close()">${t('ls_cancel')}</button>`;
    box.querySelectorAll('.qo').forEach(g => {
      g.querySelectorAll('button').forEach(b => {
        b.onclick = () => { g.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); };
      });
    });
    document.getElementById('quizBg').classList.add('show');

    // Warm up speech synthesis
    if (window.speechSynthesis) speechSynthesis.getVoices();
  }

  let lastCountVal = '5';
  function begin() {
    // 從起始面板讀設定；若從結果頁呼叫則面板不存在，沿用上次（防止按鈕無反應）
    const lvEl = document.querySelector('#lsLevel .on');
    const ctEl = document.querySelector('#lsCount .on');
    const mdEl = document.querySelector('#lsMode .on');
    if (lvEl) selectedLevel = lvEl.dataset.v;
    if (ctEl) lastCountVal = ctEl.dataset.v;
    if (mdEl) practiceMode = mdEl.dataset.v === 'practice';

    const pool = items.filter(i => i.level === selectedLevel);
    if (!pool.length) { alert(t('ls_no_data')); return; }

    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const count = lastCountVal === 'all' ? shuffled.length : Math.min(parseInt(lastCountVal), shuffled.length);
    queue = shuffled.slice(0, count);
    score = 0;
    total = queue.length;
    answered = [];
    speedOverride = null;

    renderItem(0);
  }
  // 再聽同一批（不重新抽）
  function retrySame() {
    if (!queue || !queue.length) return begin();
    score = 0;
    total = queue.length;
    answered = [];
    speedOverride = null;
    renderItem(0);
  }

  function renderItem(idx) {
    if (idx >= queue.length) { showResults(); return; }
    currentItem = queue[idx];
    replaysLeft = practiceMode ? 999 : 2;

    const box = document.getElementById('quizBox');
    const rateDisplay = speedOverride || currentItem.speed;

    box.innerHTML = `
      <div class="qhd">
        <span style="display:flex;align-items:center;gap:6px">
          <span class="cf-lv">${currentItem.level.toUpperCase()}</span>
          <span style="font-size:12px">${currentItem.type}</span>
          <span style="font-size:11px;color:var(--tx3)">${idx + 1} / ${queue.length}</span>
        </span>
        <span style="display:flex;align-items:center;gap:6px">
          <span style="font-size:12px;color:var(--tx2)">${t('quiz_score', { n: score })}</span>
          <button class="qclose" style="width:auto;margin:0;padding:2px 10px" onclick="Listening.close()">✕</button>
        </span>
      </div>

      <div style="text-align:center;padding:24px 0">
        <button id="lsPlayBtn" onclick="Listening.play()" style="width:72px;height:72px;border-radius:50%;border:3px solid var(--ac2);background:var(--bg2);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:.2s">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="var(--ac2)" stroke="none"><polygon points="6,3 20,12 6,21"/></svg>
        </button>
        <div style="margin-top:8px;font-size:12px;color:var(--tx2)" id="lsReplayInfo">
          ${practiceMode ? t('ls_practice_info') : t('ls_plays_left', { n: replaysLeft })}
        </div>
      </div>

      ${practiceMode ? `
      <div style="display:flex;justify-content:center;gap:6px;margin-bottom:14px">
        <button onclick="Listening.setSpeed(0.7)" class="ls-speed-btn" style="font-size:11px;padding:4px 10px;border:1px solid var(--bd);border-radius:6px;background:${rateDisplay===0.7?'var(--ac2)':'var(--bg2)'};color:${rateDisplay===0.7?'#fff':'var(--tx2)'};cursor:pointer">0.7x</button>
        <button onclick="Listening.setSpeed(null)" class="ls-speed-btn" style="font-size:11px;padding:4px 10px;border:1px solid var(--bd);border-radius:6px;background:${!speedOverride?'var(--ac2)':'var(--bg2)'};color:${!speedOverride?'#fff':'var(--tx2)'};cursor:pointer">${t('ls_speed_normal')}</button>
        <button onclick="Listening.setSpeed(1.2)" class="ls-speed-btn" style="font-size:11px;padding:4px 10px;border:1px solid var(--bd);border-radius:6px;background:${rateDisplay===1.2?'var(--ac2)':'var(--bg2)'};color:${rateDisplay===1.2?'#fff':'var(--tx2)'};cursor:pointer">1.2x</button>
      </div>` : ''}

      <div style="font-size:15px;font-weight:600;margin-bottom:10px;color:var(--tx)">${currentItem.q}</div>
      <div class="qopts" id="lsOpts">
        ${currentItem.options.map((o, i) => '<button class="qopt" onclick="Listening.answer(' + idx + ',' + i + ')">' + o + '</button>').join('')}
      </div>
      <div id="lsScript" style="display:none;margin-top:12px;padding:12px;background:var(--bg3);border-radius:8px;border:1px solid var(--bd)">
        <div style="font-size:11px;color:var(--tx2);margin-bottom:4px;font-weight:600">${t('ls_script')}</div>
        <div style="font-size:14px;line-height:1.8;color:var(--tx)">${currentItem.script.replace(/\n/g, '<br>')}</div>
      </div>
      <div id="lsNav" style="margin-top:12px"></div>`;

    // Auto-play on render
    setTimeout(() => { play(); }, 300);
  }

  function play() {
    if (replaysLeft <= 0 && !practiceMode) return;
    const rate = speedOverride || currentItem.speed;
    speakText(currentItem.script.replace(/\n/g, '。'), rate);
    if (!practiceMode) {
      replaysLeft--;
      const info = document.getElementById('lsReplayInfo');
      if (info) info.textContent = t('ls_plays_left', { n: replaysLeft });
    }
    const btn = document.getElementById('lsPlayBtn');
    if (btn) {
      if (replaysLeft <= 0 && !practiceMode) {
        btn.style.opacity = '0.3';
        btn.style.cursor = 'not-allowed';
      }
    }
  }

  function setSpeed(s) {
    speedOverride = s;
    // Re-render speed buttons only
    const btns = document.querySelectorAll('.ls-speed-btn');
    if (!btns.length) return;
    const rateDisplay = speedOverride || currentItem.speed;
    const speeds = [0.7, null, 1.2];
    btns.forEach((btn, i) => {
      const spd = speeds[i];
      const active = spd === speedOverride;
      btn.style.background = active ? 'var(--ac2)' : 'var(--bg2)';
      btn.style.color = active ? '#fff' : 'var(--tx2)';
    });
  }

  function answer(qIdx, optIdx) {
    const item = queue[qIdx];
    const correct = optIdx === item.correct;
    if (correct) score++;
    answered.push({ q: item.q, correct, type: item.type });

    const opts = document.querySelectorAll('#lsOpts .qopt');
    opts.forEach((b, i) => {
      b.disabled = true;
      if (i === item.correct) b.classList.add('qcorrect');
      if (i === optIdx && !correct) b.classList.add('qwrong');
    });

    // Show script
    const scriptEl = document.getElementById('lsScript');
    if (scriptEl) scriptEl.style.display = 'block';

    // Show nav
    const navDiv = document.getElementById('lsNav');
    if (qIdx < queue.length - 1) {
      navDiv.innerHTML = `<button class="qstart" onclick="Listening.renderItem(${qIdx + 1})">${t('rd_next')}</button>`;
    } else {
      navDiv.innerHTML = `<button class="qstart" onclick="Listening.showResults()">${t('rd_show_result')}</button>`;
    }

    // Stop synthesis
    if (window.speechSynthesis) speechSynthesis.cancel();
  }

  function showResults() {
    const pct = total > 0 ? Math.round(score / total * 100) : 0;

    // Save scores
    const scores = getScores();
    if (!scores[selectedLevel]) scores[selectedLevel] = { correct: 0, total: 0 };
    scores[selectedLevel].correct += score;
    scores[selectedLevel].total += total;
    saveScores(scores);

    const cls = pct >= 80 ? 'good' : pct >= 50 ? 'ok' : 'bad';
    const box = document.getElementById('quizBox');
    box.innerHTML = `
      <h3>${t('ls_result')}</h3>
      <div class="qscore ${cls}">${score} / ${total} (${pct}%)</div>
      <div style="font-size:13px;color:var(--tx2);margin-bottom:8px">${selectedLevel.toUpperCase()} | ${practiceMode ? t('ls_mode_practice') : t('ls_mode_test')}</div>
      <div class="qresults">${answered.map(a =>
        '<div class="qr ' + (a.correct ? 'ok' : 'ng') + '"><span class="qrc">' + (a.correct ? '✓' : '✗') + '</span><span>' + a.q + '</span><span style="font-size:11px;color:var(--tx3);margin-left:auto">' + a.type + '</span></div>'
      ).join('')}</div>
      <div class="qactions">
        <button class="qstart" onclick="Listening.begin()">下一組</button>
        <button class="qstart" style="background:var(--bg3);color:var(--tx)" onclick="Listening.retrySame()">再聽同一組</button>
        <button class="qclose" onclick="Listening.close()">${t('ls_close')}</button>
      </div>`;
  }

  function close() {
    if (window.speechSynthesis) speechSynthesis.cancel();
    document.getElementById('quizBg').classList.remove('show');
  }

  return { start, begin, retrySame, play, setSpeed, answer, renderItem, showResults, close };
})();
