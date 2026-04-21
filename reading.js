// ========== READING PRACTICE ==========
const Reading = (() => {
  const SCORE_KEY = 'reading_scores';
  let currentPassage = null;
  let currentQ = 0;
  let score = 0;
  let answered = [];
  let timerInterval = null;
  let timerSeconds = 0;
  let timerEnabled = true;
  let furiganaVisible = true;
  let selectedLevel = 'n5';

  // ── passage bank ──
  const passages = [
    // ===== N5 (10 passages) =====
    {
      id:"r-n5-1", level:"n5", type:"日常会話", title:"あいさつ",
      passage:"<ruby>田中<rt>たなか</rt></ruby>さん：おはようございます。<ruby>今日<rt>きょう</rt></ruby>はいい<ruby>天気<rt>てんき</rt></ruby>ですね。\n<ruby>山田<rt>やまだ</rt></ruby>さん：そうですね。<ruby>今日<rt>きょう</rt></ruby>は<ruby>暖<rt>あたた</rt></ruby>かいです。",
      questions:[
        {q:"今天的天氣怎麼樣？",options:["天氣很好","下雨了","很冷","颳風了"],correct:0,explanation:"田中說「いい天気ですね」（天氣真好呢），山田也同意「暖かいです」（很暖和）。"}
      ]
    },
    {
      id:"r-n5-2", level:"n5", type:"お知らせ", title:"お店のお知らせ",
      passage:"このみせは<ruby>毎日<rt>まいにち</rt></ruby><ruby>午前<rt>ごぜん</rt></ruby>10<ruby>時<rt>じ</rt></ruby>から<ruby>午後<rt>ごご</rt></ruby>8<ruby>時<rt>じ</rt></ruby>までです。\n<ruby>日曜日<rt>にちようび</rt></ruby>はやすみです。",
      questions:[
        {q:"這家店星期天營業嗎？",options:["營業","不營業","只有上午營業","只有下午營業"],correct:1,explanation:"文中說「日曜日はやすみです」（星期天休息）。"}
      ]
    },
    {
      id:"r-n5-3", level:"n5", type:"メール", title:"ともだちへのメール",
      passage:"マリアさんへ\n<ruby>来週<rt>らいしゅう</rt></ruby>の<ruby>土曜日<rt>どようび</rt></ruby>に<ruby>映画<rt>えいが</rt></ruby>を<ruby>見<rt>み</rt></ruby>ませんか。<ruby>午後<rt>ごご</rt></ruby>2<ruby>時<rt>じ</rt></ruby>に<ruby>駅<rt>えき</rt></ruby>で<ruby>会<rt>あ</rt></ruby>いましょう。\nたかし",
      questions:[
        {q:"他們約在哪裡見面？",options:["電影院","車站","學校","家裡"],correct:1,explanation:"メール中「駅で会いましょう」（在車站見面吧）。"}
      ]
    },
    {
      id:"r-n5-4", level:"n5", type:"説明文", title:"わたしの部屋",
      passage:"わたしの<ruby>部屋<rt>へや</rt></ruby>はちいさいです。<ruby>机<rt>つくえ</rt></ruby>の<ruby>上<rt>うえ</rt></ruby>にパソコンがあります。\n<ruby>窓<rt>まど</rt></ruby>のそばに<ruby>花<rt>はな</rt></ruby>があります。",
      questions:[
        {q:"桌子上有什麼？",options:["花","電腦","書","電話"],correct:1,explanation:"「机の上にパソコンがあります」（桌子上有電腦）。"}
      ]
    },
    {
      id:"r-n5-5", level:"n5", type:"日常会話", title:"レストランで",
      passage:"<ruby>店員<rt>てんいん</rt></ruby>：いらっしゃいませ。なにになさいますか。\nおきゃく：コーヒーをひとつと、ケーキをひとつおねがいします。\n<ruby>店員<rt>てんいん</rt></ruby>：かしこまりました。",
      questions:[
        {q:"客人點了什麼？",options:["咖啡和蛋糕","紅茶和蛋糕","咖啡和三明治","果汁和蛋糕"],correct:0,explanation:"「コーヒーをひとつと、ケーキをひとつ」（一杯咖啡和一個蛋糕）。"}
      ]
    },
    {
      id:"r-n5-6", level:"n5", type:"お知らせ", title:"学校のお知らせ",
      passage:"<ruby>明日<rt>あした</rt></ruby>は<ruby>学校<rt>がっこう</rt></ruby>のテストです。\n<ruby>朝<rt>あさ</rt></ruby>9<ruby>時<rt>じ</rt></ruby>にきてください。えんぴつを<ruby>持<rt>も</rt></ruby>ってきてください。",
      questions:[
        {q:"明天要帶什麼？",options:["課本","鉛筆","橡皮擦","筆記本"],correct:1,explanation:"「えんぴつを持ってきてください」（請帶鉛筆來）。"}
      ]
    },
    {
      id:"r-n5-7", level:"n5", type:"日常会話", title:"バスで",
      passage:"A：すみません、この<ruby>バス<rt>ばす</rt></ruby>は<ruby>大阪駅<rt>おおさかえき</rt></ruby>にいきますか。\nB：いいえ、いきません。<ruby>次<rt>つぎ</rt></ruby>のバスにのってください。",
      questions:[
        {q:"這班公車去大阪站嗎？",options:["去","不去","已經過了","馬上到"],correct:1,explanation:"Bが「いいえ、いきません」（不去）と答えている。"}
      ]
    },
    {
      id:"r-n5-8", level:"n5", type:"説明文", title:"わたしのかぞく",
      passage:"わたしの<ruby>家族<rt>かぞく</rt></ruby>は4<ruby>人<rt>にん</rt></ruby>です。<ruby>父<rt>ちち</rt></ruby>と<ruby>母<rt>はは</rt></ruby>と<ruby>姉<rt>あね</rt></ruby>とわたしです。\n<ruby>姉<rt>あね</rt></ruby>は<ruby>大学生<rt>だいがくせい</rt></ruby>です。わたしは<ruby>高校生<rt>こうこうせい</rt></ruby>です。",
      questions:[
        {q:"我是什麼身份？",options:["大學生","高中生","國中生","上班族"],correct:1,explanation:"「わたしは高校生です」（我是高中生）。"}
      ]
    },
    {
      id:"r-n5-9", level:"n5", type:"メール", title:"先生へのメール",
      passage:"<ruby>先生<rt>せんせい</rt></ruby>へ\n<ruby>今日<rt>きょう</rt></ruby>はかぜで<ruby>学校<rt>がっこう</rt></ruby>をやすみます。すみません。\nリン",
      questions:[
        {q:"リン為什麼請假？",options:["肚子痛","感冒了","有事","遲到了"],correct:1,explanation:"「かぜで学校をやすみます」（因為感冒所以學校請假）。"}
      ]
    },
    {
      id:"r-n5-10", level:"n5", type:"お知らせ", title:"としょかん",
      passage:"<ruby>図書館<rt>としょかん</rt></ruby>はげつようびからきんようびまでです。\n<ruby>朝<rt>あさ</rt></ruby>9<ruby>時<rt>じ</rt></ruby>から<ruby>夕方<rt>ゆうがた</rt></ruby>5<ruby>時<rt>じ</rt></ruby>までです。\n<ruby>本<rt>ほん</rt></ruby>は2<ruby>週間<rt>しゅうかん</rt></ruby><ruby>借<rt>か</rt></ruby>りることができます。",
      questions:[
        {q:"書可以借多久？",options:["一週","兩週","三天","一個月"],correct:1,explanation:"「本は2週間借りることができます」（書可以借兩週）。"}
      ]
    },

    // ===== N4 (12 passages) =====
    {
      id:"r-n4-1", level:"n4", type:"お知らせ", title:"大阪市立図書館のお知らせ",
      passage:"<ruby>大阪<rt>おおさか</rt></ruby><ruby>市立<rt>しりつ</rt></ruby><ruby>図書館<rt>としょかん</rt></ruby>からのお<ruby>知<rt>し</rt></ruby>らせです。<ruby>来月<rt>らいげつ</rt></ruby>から<ruby>開館<rt>かいかん</rt></ruby><ruby>時間<rt>じかん</rt></ruby>が<ruby>変更<rt>へんこう</rt></ruby>になります。\n<ruby>月曜日<rt>げつようび</rt></ruby>から<ruby>金曜日<rt>きんようび</rt></ruby>は<ruby>午前<rt>ごぜん</rt></ruby>9<ruby>時<rt>じ</rt></ruby>から<ruby>午後<rt>ごご</rt></ruby>8<ruby>時<rt>じ</rt></ruby>までです。\n<ruby>土曜日<rt>どようび</rt></ruby>と<ruby>日曜日<rt>にちようび</rt></ruby>は<ruby>午前<rt>ごぜん</rt></ruby>10<ruby>時<rt>じ</rt></ruby>から<ruby>午後<rt>ごご</rt></ruby>5<ruby>時<rt>じ</rt></ruby>までです。",
      questions:[
        {q:"週末的開館時間到幾點？",options:["下午5點","下午8點","下午6點","下午3點"],correct:0,explanation:"「土曜日と日曜日は午前10時から午後5時まで」（週六日是上午10點到下午5點）。"},
        {q:"這個通知是關於什麼的？",options:["開館時間變更","休館日變更","新書上架","借書規則"],correct:0,explanation:"「開館時間が変更になります」（開館時間會變更）。"}
      ]
    },
    {
      id:"r-n4-2", level:"n4", type:"メール", title:"友達へのメール",
      passage:"ゆきさんへ\n<ruby>先週<rt>せんしゅう</rt></ruby>は<ruby>一緒<rt>いっしょ</rt></ruby>に<ruby>道頓堀<rt>どうとんぼり</rt></ruby>に<ruby>行<rt>い</rt></ruby>けて<ruby>楽<rt>たの</rt></ruby>しかったです。たこ<ruby>焼<rt>や</rt></ruby>きがとてもおいしかったですね。\n<ruby>今度<rt>こんど</rt></ruby>は<ruby>大阪城<rt>おおさかじょう</rt></ruby>に<ruby>行<rt>い</rt></ruby>きませんか。<ruby>来月<rt>らいげつ</rt></ruby>の<ruby>日曜日<rt>にちようび</rt></ruby>はどうですか。\nまり",
      questions:[
        {q:"上週她們去了哪裡？",options:["大阪城","道頓堀","梅田","難波"],correct:1,explanation:"「先週は一緒に道頓堀に行けて」（上週一起去了道頓堀）。"},
        {q:"まり提議下次去哪裡？",options:["道頓堀","通天閣","大阪城","USJ"],correct:2,explanation:"「今度は大阪城に行きませんか」（下次去大阪城好嗎）。"}
      ]
    },
    {
      id:"r-n4-3", level:"n4", type:"説明文", title:"わたしのまち",
      passage:"わたしは<ruby>大阪<rt>おおさか</rt></ruby>の<ruby>梅田<rt>うめだ</rt></ruby>に<ruby>住<rt>す</rt></ruby>んでいます。<ruby>梅田<rt>うめだ</rt></ruby>は<ruby>大<rt>おお</rt></ruby>きい<ruby>町<rt>まち</rt></ruby>で、<ruby>百貨店<rt>ひゃっかてん</rt></ruby>やレストランがたくさんあります。\n<ruby>駅<rt>えき</rt></ruby>から<ruby>歩<rt>ある</rt></ruby>いて10<ruby>分<rt>ぷん</rt></ruby>のところに<ruby>公園<rt>こうえん</rt></ruby>もあります。<ruby>休<rt>やす</rt></ruby>みの<ruby>日<rt>ひ</rt></ruby>はよくそこで<ruby>散歩<rt>さんぽ</rt></ruby>します。",
      questions:[
        {q:"作者住在哪裡？",options:["難波","梅田","天王寺","心齋橋"],correct:1,explanation:"「大阪の梅田に住んでいます」（住在大阪的梅田）。"},
        {q:"休息日經常做什麼？",options:["購物","在公園散步","去餐廳","看電影"],correct:1,explanation:"「休みの日はよくそこで散歩します」（休息日經常在那裡散步）。"}
      ]
    },
    {
      id:"r-n4-4", level:"n4", type:"日常会話", title:"道を聞く",
      passage:"A：すみません、<ruby>梅田駅<rt>うめだえき</rt></ruby>はどこですか。\nB：まっすぐ<ruby>行<rt>い</rt></ruby>って、<ruby>二<rt>ふた</rt></ruby>つ<ruby>目<rt>め</rt></ruby>の<ruby>信号<rt>しんごう</rt></ruby>を<ruby>右<rt>みぎ</rt></ruby>に<ruby>曲<rt>ま</rt></ruby>がってください。5<ruby>分<rt>ふん</rt></ruby>ぐらいで<ruby>着<rt>つ</rt></ruby>きます。\nA：ありがとうございます。",
      questions:[
        {q:"梅田站大約幾分鐘到？",options:["3分鐘","5分鐘","10分鐘","15分鐘"],correct:1,explanation:"「5分ぐらいで着きます」（大約5分鐘就到）。"}
      ]
    },
    {
      id:"r-n4-5", level:"n4", type:"お知らせ", title:"お祭りのお知らせ",
      passage:"<ruby>天神祭<rt>てんじんまつり</rt></ruby>のお<ruby>知<rt>し</rt></ruby>らせ\n<ruby>日時<rt>にちじ</rt></ruby>：7<ruby>月<rt>がつ</rt></ruby>25<ruby>日<rt>にち</rt></ruby>（<ruby>土<rt>ど</rt></ruby>）<ruby>午後<rt>ごご</rt></ruby>4<ruby>時<rt>じ</rt></ruby>から\n<ruby>場所<rt>ばしょ</rt></ruby>：<ruby>天満宮<rt>てんまんぐう</rt></ruby>\n<ruby>花火<rt>はなび</rt></ruby>は<ruby>午後<rt>ごご</rt></ruby>7<ruby>時<rt>じ</rt></ruby>からです。<ruby>浴衣<rt>ゆかた</rt></ruby>で<ruby>来<rt>き</rt></ruby>てください。",
      questions:[
        {q:"花火幾點開始？",options:["下午4點","下午5點","晚上7點","晚上8點"],correct:2,explanation:"「花火は午後7時から」（煙火從下午7點開始）。"},
        {q:"建議穿什麼去？",options:["西裝","浴衣","和服","便服"],correct:1,explanation:"「浴衣で来てください」（請穿浴衣來）。"}
      ]
    },
    {
      id:"r-n4-6", level:"n4", type:"メール", title:"先生へのメール",
      passage:"<ruby>田中<rt>たなか</rt></ruby><ruby>先生<rt>せんせい</rt></ruby>へ\nいつもお<ruby>世話<rt>せわ</rt></ruby>になっております。\n<ruby>来週<rt>らいしゅう</rt></ruby>の<ruby>水曜日<rt>すいようび</rt></ruby>のじゅぎょうですが、<ruby>病院<rt>びょういん</rt></ruby>に<ruby>行<rt>い</rt></ruby>かなければならないので、おやすみさせていただきたいです。\n<ruby>宿題<rt>しゅくだい</rt></ruby>は<ruby>木曜日<rt>もくようび</rt></ruby>に<ruby>出<rt>だ</rt></ruby>します。\nリン",
      questions:[
        {q:"リン為什麼要請假？",options:["感冒","要去醫院","家裡有事","要旅行"],correct:1,explanation:"「病院に行かなければならない」（必須去醫院）。"},
        {q:"作業什麼時候交？",options:["星期三","星期四","星期五","下週"],correct:1,explanation:"「宿題は木曜日に出します」（作業星期四交）。"}
      ]
    },
    {
      id:"r-n4-7", level:"n4", type:"説明文", title:"日本の季節",
      passage:"<ruby>日本<rt>にほん</rt></ruby>には<ruby>四<rt>よっ</rt></ruby>つの<ruby>季節<rt>きせつ</rt></ruby>があります。<ruby>春<rt>はる</rt></ruby>は3<ruby>月<rt>がつ</rt></ruby>から5<ruby>月<rt>がつ</rt></ruby>で、<ruby>桜<rt>さくら</rt></ruby>がきれいです。\n<ruby>夏<rt>なつ</rt></ruby>はとても<ruby>暑<rt>あつ</rt></ruby>くて、<ruby>花火<rt>はなび</rt></ruby><ruby>大会<rt>たいかい</rt></ruby>があります。<ruby>秋<rt>あき</rt></ruby>は<ruby>紅葉<rt>もみじ</rt></ruby>がきれいで、<ruby>食<rt>た</rt></ruby>べ<ruby>物<rt>もの</rt></ruby>もおいしいです。\n<ruby>冬<rt>ふゆ</rt></ruby>は<ruby>寒<rt>さむ</rt></ruby>いですが、<ruby>雪<rt>ゆき</rt></ruby>がふる<ruby>所<rt>ところ</rt></ruby>もあります。",
      questions:[
        {q:"春天有什麼特色？",options:["煙火","楓葉","櫻花","下雪"],correct:2,explanation:"「春は…桜がきれいです」（春天櫻花很美）。"},
        {q:"秋天的特色是什麼？",options:["很熱","楓葉漂亮、食物美味","下雪","櫻花"],correct:1,explanation:"「秋は紅葉がきれいで、食べ物もおいしい」（秋天楓葉漂亮，食物也好吃）。"}
      ]
    },
    {
      id:"r-n4-8", level:"n4", type:"日常会話", title:"買い物",
      passage:"<ruby>客<rt>きゃく</rt></ruby>：すみません、このTシャツのMサイズはありますか。\n<ruby>店員<rt>てんいん</rt></ruby>：すみません、Mサイズは<ruby>売<rt>う</rt></ruby>り<ruby>切<rt>き</rt></ruby>れです。Lサイズならあります。\n<ruby>客<rt>きゃく</rt></ruby>：じゃ、Lサイズをください。",
      questions:[
        {q:"客人最後買了什麼尺寸？",options:["S","M","L","XL"],correct:2,explanation:"Mサイズは売り切れだったので、「Lサイズをください」（請給我L號）と言った。"}
      ]
    },
    {
      id:"r-n4-9", level:"n4", type:"お知らせ", title:"マンションのお知らせ",
      passage:"<ruby>住民<rt>じゅうみん</rt></ruby>の<ruby>皆<rt>みな</rt></ruby>さまへ\n<ruby>来週<rt>らいしゅう</rt></ruby>の<ruby>火曜日<rt>かようび</rt></ruby>に<ruby>水道<rt>すいどう</rt></ruby><ruby>工事<rt>こうじ</rt></ruby>があります。<ruby>午前<rt>ごぜん</rt></ruby>10<ruby>時<rt>じ</rt></ruby>から<ruby>午後<rt>ごご</rt></ruby>3<ruby>時<rt>じ</rt></ruby>まで<ruby>水<rt>みず</rt></ruby>が<ruby>使<rt>つか</rt></ruby>えません。\n<ruby>水<rt>みず</rt></ruby>を<ruby>準備<rt>じゅんび</rt></ruby>しておいてください。",
      questions:[
        {q:"什麼時間不能用水？",options:["上午10點到下午3點","上午9點到下午5點","早上8點到中午12點","全天"],correct:0,explanation:"「午前10時から午後3時まで水が使えません」。"}
      ]
    },
    {
      id:"r-n4-10", level:"n4", type:"説明文", title:"たこ焼き",
      passage:"たこ<ruby>焼<rt>や</rt></ruby>きは<ruby>大阪<rt>おおさか</rt></ruby>の<ruby>有名<rt>ゆうめい</rt></ruby>な<ruby>食<rt>た</rt></ruby>べ<ruby>物<rt>もの</rt></ruby>です。<ruby>小麦粉<rt>こむぎこ</rt></ruby>の<ruby>生地<rt>きじ</rt></ruby>の<ruby>中<rt>なか</rt></ruby>にたこを<ruby>入<rt>い</rt></ruby>れて、<ruby>丸<rt>まる</rt></ruby>く<ruby>焼<rt>や</rt></ruby>きます。\nソースとマヨネーズをかけて<ruby>食<rt>た</rt></ruby>べます。<ruby>道頓堀<rt>どうとんぼり</rt></ruby>にはたこ<ruby>焼<rt>や</rt></ruby>きの<ruby>店<rt>みせ</rt></ruby>がたくさんあります。\n<ruby>一<rt>ひと</rt></ruby>つ500<ruby>円<rt>えん</rt></ruby>ぐらいで<ruby>買<rt>か</rt></ruby>えます。",
      questions:[
        {q:"章魚燒裡面放什麼？",options:["蝦子","章魚","魷魚","花枝"],correct:1,explanation:"「生地の中にたこを入れて」（在麵糊中放入章魚）。"},
        {q:"道頓堀有很多什麼店？",options:["拉麵店","章魚燒店","壽司店","咖啡店"],correct:1,explanation:"「道頓堀にはたこ焼きの店がたくさんあります」。"}
      ]
    },
    {
      id:"r-n4-11", level:"n4", type:"日常会話", title:"電車の中で",
      passage:"<ruby>車内<rt>しゃない</rt></ruby>アナウンス：<ruby>次<rt>つぎ</rt></ruby>は<ruby>梅田<rt>うめだ</rt></ruby>、<ruby>梅田<rt>うめだ</rt></ruby>です。<ruby>御堂筋線<rt>みどうすじせん</rt></ruby>と<ruby>阪急線<rt>はんきゅうせん</rt></ruby>はお<ruby>乗<rt>の</rt></ruby>り<ruby>換<rt>か</rt></ruby>えください。\nA：<ruby>次<rt>つぎ</rt></ruby>で<ruby>降<rt>お</rt></ruby>りますか。\nB：いいえ、わたしは<ruby>新大阪<rt>しんおおさか</rt></ruby>までです。",
      questions:[
        {q:"B是要在哪一站下車？",options:["梅田","新大阪","難波","天王寺"],correct:1,explanation:"Bが「わたしは新大阪まで」（我到新大阪）。"}
      ]
    },
    {
      id:"r-n4-12", level:"n4", type:"メール", title:"アルバイトの連絡",
      passage:"<ruby>店長<rt>てんちょう</rt></ruby>へ\n<ruby>明日<rt>あした</rt></ruby>のシフトですが、<ruby>熱<rt>ねつ</rt></ruby>が<ruby>出<rt>で</rt></ruby>たので<ruby>休<rt>やす</rt></ruby>ませていただけませんか。\n<ruby>木村<rt>きむら</rt></ruby>さんに<ruby>代<rt>か</rt></ruby>わりをお<ruby>願<rt>ねが</rt></ruby>いしましたが、まだ<ruby>返事<rt>へんじ</rt></ruby>がありません。\nよろしくお<ruby>願<rt>ねが</rt></ruby>いします。\nたなか",
      questions:[
        {q:"たなか為什麼要請假？",options:["有事","發燒了","要旅行","要搬家"],correct:1,explanation:"「熱が出たので」（因為發燒了）。"},
        {q:"木村的回覆如何？",options:["答應了","拒絕了","還沒回覆","沒有聯繫"],correct:2,explanation:"「まだ返事がありません」（還沒有回覆）。"}
      ]
    },

    // ===== N3 (15 passages) =====
    {
      id:"r-n3-1", level:"n3", type:"お知らせ", title:"図書館のお知らせ",
      passage:"<ruby>大阪<rt>おおさか</rt></ruby><ruby>市立<rt>しりつ</rt></ruby><ruby>中央<rt>ちゅうおう</rt></ruby><ruby>図書館<rt>としょかん</rt></ruby>からのお<ruby>知<rt>し</rt></ruby>らせです。<ruby>来月<rt>らいげつ</rt></ruby>より<ruby>開館<rt>かいかん</rt></ruby><ruby>時間<rt>じかん</rt></ruby>が<ruby>変更<rt>へんこう</rt></ruby>になります。\n<ruby>平日<rt>へいじつ</rt></ruby>は<ruby>午前<rt>ごぜん</rt></ruby>9<ruby>時<rt>じ</rt></ruby>から<ruby>午後<rt>ごご</rt></ruby>9<ruby>時<rt>じ</rt></ruby>までに<ruby>延長<rt>えんちょう</rt></ruby>されます。<ruby>土日<rt>どにち</rt></ruby>は<ruby>変更<rt>へんこう</rt></ruby>ありません。\nまた、<ruby>自習室<rt>じしゅうしつ</rt></ruby>の<ruby>利用<rt>りよう</rt></ruby>には<ruby>事前<rt>じぜん</rt></ruby><ruby>予約<rt>よやく</rt></ruby>が<ruby>必要<rt>ひつよう</rt></ruby>になります。<ruby>予約<rt>よやく</rt></ruby>はウェブサイトからお<ruby>願<rt>ねが</rt></ruby>いいたします。",
      questions:[
        {q:"平日的開館時間有什麼變化？",options:["延長了","縮短了","不變","休館"],correct:0,explanation:"「平日は午前9時から午後9時までに延長されます」。"},
        {q:"自習室需要什麼？",options:["會員證","事前預約","額外費用","介紹信"],correct:1,explanation:"「自習室の利用には事前予約が必要」（自習室需要事前預約）。"}
      ]
    },
    {
      id:"r-n3-2", level:"n3", type:"メール", title:"会社のメール",
      passage:"<ruby>各位<rt>かくい</rt></ruby>\n<ruby>来週<rt>らいしゅう</rt></ruby><ruby>月曜日<rt>げつようび</rt></ruby>の<ruby>会議<rt>かいぎ</rt></ruby>について<ruby>連絡<rt>れんらく</rt></ruby>いたします。\n<ruby>会議室<rt>かいぎしつ</rt></ruby>が<ruby>変更<rt>へんこう</rt></ruby>になり、3<ruby>階<rt>かい</rt></ruby>のA<ruby>会議室<rt>かいぎしつ</rt></ruby>から5<ruby>階<rt>かい</rt></ruby>のB<ruby>会議室<rt>かいぎしつ</rt></ruby>に<ruby>変<rt>か</rt></ruby>わりました。\n<ruby>時間<rt>じかん</rt></ruby>は<ruby>予定<rt>よてい</rt></ruby><ruby>通<rt>どお</rt></ruby>り<ruby>午後<rt>ごご</rt></ruby>2<ruby>時<rt>じ</rt></ruby>からです。<ruby>資料<rt>しりょう</rt></ruby>は<ruby>事前<rt>じぜん</rt></ruby>にメールで<ruby>送<rt>おく</rt></ruby>りますので、<ruby>目<rt>め</rt></ruby>を<ruby>通<rt>とお</rt></ruby>しておいてください。\n<ruby>田中<rt>たなか</rt></ruby>",
      questions:[
        {q:"會議室變更到哪裡？",options:["3樓A會議室","5樓B會議室","2樓C會議室","1樓大廳"],correct:1,explanation:"「5階のB会議室に変わりました」。"},
        {q:"資料會怎麼發送？",options:["當天發","事前用email發送","放在會議室","自行下載"],correct:1,explanation:"「資料は事前にメールで送ります」。"}
      ]
    },
    {
      id:"r-n3-3", level:"n3", type:"説明文", title:"大阪の食文化",
      passage:"<ruby>大阪<rt>おおさか</rt></ruby>は「<ruby>食<rt>く</rt></ruby>い<ruby>倒<rt>だお</rt></ruby>れの<ruby>街<rt>まち</rt></ruby>」として<ruby>有名<rt>ゆうめい</rt></ruby>です。<ruby>道頓堀<rt>どうとんぼり</rt></ruby>や<ruby>新世界<rt>しんせかい</rt></ruby>には<ruby>安<rt>やす</rt></ruby>くておいしいお<ruby>店<rt>みせ</rt></ruby>がたくさんあります。\n<ruby>代表的<rt>だいひょうてき</rt></ruby>な<ruby>料理<rt>りょうり</rt></ruby>としては、たこ<ruby>焼<rt>や</rt></ruby>き、お<ruby>好<rt>この</rt></ruby>み<ruby>焼<rt>や</rt></ruby>き、<ruby>串<rt>くし</rt></ruby>カツなどがあります。\n<ruby>最近<rt>さいきん</rt></ruby>は<ruby>外国人<rt>がいこくじん</rt></ruby><ruby>観光客<rt>かんこうきゃく</rt></ruby>にも<ruby>人気<rt>にんき</rt></ruby>で、<ruby>英語<rt>えいご</rt></ruby>メニューを<ruby>置<rt>お</rt></ruby>いている<ruby>店<rt>みせ</rt></ruby>も<ruby>増<rt>ふ</rt></ruby>えています。",
      questions:[
        {q:"大阪被稱為什麼？",options:["水之都","食い倒れの街","天下的台所","笑いの都"],correct:1,explanation:"「大阪は『食い倒れの街』として有名です」。"},
        {q:"最近增加了什麼？",options:["新的餐廳","外國觀光客","有英文菜單的店","日本料理教室"],correct:2,explanation:"「英語メニューを置いている店も増えています」。"}
      ]
    },
    {
      id:"r-n3-4", level:"n3", type:"日常会話", title:"病院で",
      passage:"<ruby>医者<rt>いしゃ</rt></ruby>：どうしましたか。\n<ruby>患者<rt>かんじゃ</rt></ruby>：3<ruby>日<rt>にち</rt></ruby><ruby>前<rt>まえ</rt></ruby>から<ruby>熱<rt>ねつ</rt></ruby>が<ruby>下<rt>さ</rt></ruby>がらなくて、<ruby>咳<rt>せき</rt></ruby>も<ruby>出<rt>で</rt></ruby>ます。\n<ruby>医者<rt>いしゃ</rt></ruby>：<ruby>喉<rt>のど</rt></ruby>を<ruby>見<rt>み</rt></ruby>せてください。ああ、<ruby>少<rt>すこ</rt></ruby>し<ruby>赤<rt>あか</rt></ruby>くなっていますね。<ruby>薬<rt>くすり</rt></ruby>を<ruby>出<rt>だ</rt></ruby>しますので、<ruby>食後<rt>しょくご</rt></ruby>に<ruby>飲<rt>の</rt></ruby>んでください。\n<ruby>患者<rt>かんじゃ</rt></ruby>：わかりました。ありがとうございます。",
      questions:[
        {q:"患者的症狀是什麼？",options:["頭痛和嘔吐","發燒和咳嗽","肚子痛","全身無力"],correct:1,explanation:"「熱が下がらなくて、咳も出ます」（發燒不退，還有咳嗽）。"},
        {q:"藥應該什麼時候吃？",options:["飯前","飯後","睡前","任何時候"],correct:1,explanation:"「食後に飲んでください」（請在飯後服用）。"}
      ]
    },
    {
      id:"r-n3-5", level:"n3", type:"お知らせ", title:"マンションのルール",
      passage:"<ruby>入居者<rt>にゅうきょしゃ</rt></ruby>の<ruby>皆<rt>みな</rt></ruby>さまへ\nゴミ<ruby>出<rt>だ</rt></ruby>しのルールが<ruby>変<rt>か</rt></ruby>わりました。<ruby>燃<rt>も</rt></ruby>えるゴミは<ruby>月<rt>げつ</rt></ruby>・<ruby>水<rt>すい</rt></ruby>・<ruby>金<rt>きん</rt></ruby>の<ruby>朝<rt>あさ</rt></ruby>8<ruby>時<rt>じ</rt></ruby>までに<ruby>出<rt>だ</rt></ruby>してください。\nペットボトルは<ruby>毎週<rt>まいしゅう</rt></ruby><ruby>木曜日<rt>もくようび</rt></ruby>です。<ruby>分別<rt>ぶんべつ</rt></ruby>をしないで<ruby>出<rt>だ</rt></ruby>した<ruby>場合<rt>ばあい</rt></ruby>は、<ruby>回収<rt>かいしゅう</rt></ruby>されませんのでご<ruby>注意<rt>ちゅうい</rt></ruby>ください。\nまた、<ruby>夜<rt>よる</rt></ruby>10<ruby>時<rt>じ</rt></ruby><ruby>以降<rt>いこう</rt></ruby>にゴミを<ruby>出<rt>だ</rt></ruby>すことは<ruby>禁止<rt>きんし</rt></ruby>されています。",
      questions:[
        {q:"可燃垃圾要在什麼時間之前丟？",options:["早上7點","早上8點","早上9點","早上10點"],correct:1,explanation:"「朝8時までに出してください」。"},
        {q:"不分類的話會怎樣？",options:["會被罰款","不會被收走","會被退回","會收到警告"],correct:1,explanation:"「分別をしないで出した場合は、回収されません」（不分類的話不會被回收）。"}
      ]
    },
    {
      id:"r-n3-6", level:"n3", type:"メール", title:"旅行の相談",
      passage:"<ruby>佐藤<rt>さとう</rt></ruby>さんへ\n<ruby>来月<rt>らいげつ</rt></ruby>の<ruby>京都<rt>きょうと</rt></ruby><ruby>旅行<rt>りょこう</rt></ruby>の<ruby>件<rt>けん</rt></ruby>ですが、<ruby>宿泊先<rt>しゅくはくさき</rt></ruby>は<ruby>決<rt>き</rt></ruby>まりましたか。\nできれば<ruby>駅<rt>えき</rt></ruby>から<ruby>近<rt>ちか</rt></ruby>いホテルがいいと<ruby>思<rt>おも</rt></ruby>います。<ruby>予算<rt>よさん</rt></ruby>は<ruby>一泊<rt>いっぱく</rt></ruby>1<ruby>万円<rt>まんえん</rt></ruby><ruby>以内<rt>いない</rt></ruby>で<ruby>探<rt>さが</rt></ruby>せませんか。\nそれから、<ruby>初日<rt>しょにち</rt></ruby>は<ruby>嵐山<rt>あらしやま</rt></ruby>に<ruby>行<rt>い</rt></ruby>きたいのですが、どうですか。\nよろしく。\n<ruby>鈴木<rt>すずき</rt></ruby>",
      questions:[
        {q:"住宿的預算是多少？",options:["一晚5000日圓以內","一晚10000日圓以內","一晚15000日圓以內","一晚20000日圓以內"],correct:1,explanation:"「予算は一泊1万円以内で」。"},
        {q:"第一天想去哪裡？",options:["金閣寺","清水寺","嵐山","伏見稻荷"],correct:2,explanation:"「初日は嵐山に行きたい」。"}
      ]
    },
    {
      id:"r-n3-7", level:"n3", type:"説明文", title:"御堂筋線について",
      passage:"<ruby>御堂筋線<rt>みどうすじせん</rt></ruby>は<ruby>大阪<rt>おおさか</rt></ruby>メトロの<ruby>路線<rt>ろせん</rt></ruby>の<ruby>一<rt>ひと</rt></ruby>つで、<ruby>大阪<rt>おおさか</rt></ruby>を<ruby>南北<rt>なんぼく</rt></ruby>に<ruby>走<rt>はし</rt></ruby>っています。\n<ruby>梅田<rt>うめだ</rt></ruby>から<ruby>難波<rt>なんば</rt></ruby>、<ruby>天王寺<rt>てんのうじ</rt></ruby>まで<ruby>通<rt>とお</rt></ruby>っていて、<ruby>通勤<rt>つうきん</rt></ruby><ruby>時間<rt>じかん</rt></ruby><ruby>帯<rt>たい</rt></ruby>はとても<ruby>混雑<rt>こんざつ</rt></ruby>します。\n<ruby>一日<rt>いちにち</rt></ruby>の<ruby>利用者<rt>りようしゃ</rt></ruby><ruby>数<rt>すう</rt></ruby>は<ruby>約<rt>やく</rt></ruby>100<ruby>万人<rt>まんにん</rt></ruby>で、<ruby>日本<rt>にほん</rt></ruby>で<ruby>最<rt>もっと</rt></ruby>も<ruby>利用者<rt>りようしゃ</rt></ruby>が<ruby>多<rt>おお</rt></ruby>い<ruby>地下鉄<rt>ちかてつ</rt></ruby><ruby>路線<rt>ろせん</rt></ruby>の<ruby>一<rt>ひと</rt></ruby>つです。",
      questions:[
        {q:"御堂筋線在大阪怎麼行駛？",options:["東西方向","南北方向","環狀","斜向"],correct:1,explanation:"「大阪を南北に走っています」。"},
        {q:"每天約有多少人使用？",options:["約10萬人","約50萬人","約100萬人","約200萬人"],correct:2,explanation:"「一日の利用者数は約100万人」。"}
      ]
    },
    {
      id:"r-n3-8", level:"n3", type:"日常会話", title:"アルバイトの面接",
      passage:"<ruby>店長<rt>てんちょう</rt></ruby>：<ruby>週<rt>しゅう</rt></ruby>に<ruby>何<rt>なん</rt></ruby><ruby>日<rt>にち</rt></ruby>ぐらい<ruby>働<rt>はたら</rt></ruby>けますか。\nリン：<ruby>大学<rt>だいがく</rt></ruby>のじゅぎょうがない<ruby>火曜日<rt>かようび</rt></ruby>と<ruby>木曜日<rt>もくようび</rt></ruby>、それから<ruby>土曜日<rt>どようび</rt></ruby>も<ruby>大丈夫<rt>だいじょうぶ</rt></ruby>です。\n<ruby>店長<rt>てんちょう</rt></ruby>：<ruby>時間<rt>じかん</rt></ruby><ruby>帯<rt>たい</rt></ruby>はどうですか。\nリン：<ruby>午後<rt>ごご</rt></ruby>1<ruby>時<rt>じ</rt></ruby>から6<ruby>時<rt>じ</rt></ruby>まで<ruby>働<rt>はたら</rt></ruby>けます。\n<ruby>店長<rt>てんちょう</rt></ruby>：わかりました。では、<ruby>来週<rt>らいしゅう</rt></ruby>から<ruby>来<rt>き</rt></ruby>てください。",
      questions:[
        {q:"リン一週可以工作幾天？",options:["2天","3天","4天","5天"],correct:1,explanation:"火曜日、木曜日、土曜日の3日。"},
        {q:"面試結果如何？",options:["不合格","要再面試","合格了","要等通知"],correct:2,explanation:"「来週から来てください」（下週開始來上班），表示被錄取了。"}
      ]
    },
    {
      id:"r-n3-9", level:"n3", type:"説明文", title:"日本のコンビニ",
      passage:"<ruby>日本<rt>にほん</rt></ruby>のコンビニは24<ruby>時間<rt>じかん</rt></ruby><ruby>営業<rt>えいぎょう</rt></ruby>で、<ruby>食<rt>た</rt></ruby>べ<ruby>物<rt>もの</rt></ruby>や<ruby>飲<rt>の</rt></ruby>み<ruby>物<rt>もの</rt></ruby>だけでなく、さまざまなサービスを<ruby>提供<rt>ていきょう</rt></ruby>しています。\nATMで<ruby>現金<rt>げんきん</rt></ruby>を<ruby>引<rt>ひ</rt></ruby>き<ruby>出<rt>だ</rt></ruby>したり、<ruby>公共料金<rt>こうきょうりょうきん</rt></ruby>を<ruby>払<rt>はら</rt></ruby>ったり、<ruby>宅配便<rt>たくはいびん</rt></ruby>を<ruby>送<rt>おく</rt></ruby>ったりすることができます。\n<ruby>最近<rt>さいきん</rt></ruby>ではコピー<ruby>機<rt>き</rt></ruby>で<ruby>住民票<rt>じゅうみんひょう</rt></ruby>なども<ruby>取<rt>と</rt></ruby>れるようになりました。",
      questions:[
        {q:"日本的便利商店營業多久？",options:["早上7點到晚上11點","24小時","早上6點到凌晨0點","早上8點到晚上10點"],correct:1,explanation:"「24時間営業」。"},
        {q:"最近可以用影印機做什麼？",options:["列印照片","取得住民票","掃描文件","傳真"],correct:1,explanation:"「コピー機で住民票なども取れるようになりました」。"}
      ]
    },
    {
      id:"r-n3-10", level:"n3", type:"お知らせ", title:"台風のお知らせ",
      passage:"<ruby>大阪<rt>おおさか</rt></ruby><ruby>市<rt>し</rt></ruby>からの<ruby>緊急<rt>きんきゅう</rt></ruby>お<ruby>知<rt>し</rt></ruby>らせ\n<ruby>台風<rt>たいふう</rt></ruby>15<ruby>号<rt>ごう</rt></ruby>が<ruby>明日<rt>あした</rt></ruby>の<ruby>午後<rt>ごご</rt></ruby>から<ruby>大阪<rt>おおさか</rt></ruby>に<ruby>接近<rt>せっきん</rt></ruby>する<ruby>見込<rt>みこ</rt></ruby>みです。\n<ruby>不要<rt>ふよう</rt></ruby>な<ruby>外出<rt>がいしゅつ</rt></ruby>を<ruby>控<rt>ひか</rt></ruby>え、<ruby>食料<rt>しょくりょう</rt></ruby>や<ruby>水<rt>みず</rt></ruby>を<ruby>準備<rt>じゅんび</rt></ruby>しておいてください。\n<ruby>最新<rt>さいしん</rt></ruby><ruby>情報<rt>じょうほう</rt></ruby>は<ruby>大阪<rt>おおさか</rt></ruby><ruby>市<rt>し</rt></ruby>のウェブサイトで<ruby>確認<rt>かくにん</rt></ruby>してください。",
      questions:[
        {q:"颱風預計什麼時候接近大阪？",options:["今天下午","明天下午","明天早上","後天"],correct:1,explanation:"「明日の午後から大阪に接近する見込み」。"},
        {q:"通知建議做什麼？",options:["早點回家","避免不必要的外出","去避難所","打電話確認"],correct:1,explanation:"「不要な外出を控え」（避免不必要的外出）。"}
      ]
    },
    {
      id:"r-n3-11", level:"n3", type:"メール", title:"お礼のメール",
      passage:"<ruby>山本<rt>やまもと</rt></ruby><ruby>部長<rt>ぶちょう</rt></ruby>\nお<ruby>疲<rt>つか</rt></ruby>れさまです。<ruby>昨日<rt>きのう</rt></ruby>は<ruby>歓迎会<rt>かんげいかい</rt></ruby>を<ruby>開<rt>ひら</rt></ruby>いていただき、ありがとうございました。\n<ruby>皆<rt>みな</rt></ruby>さんと<ruby>話<rt>はな</rt></ruby>すことができて、とても<ruby>嬉<rt>うれ</rt></ruby>しかったです。\nこれから<ruby>一日<rt>いちにち</rt></ruby>も<ruby>早<rt>はや</rt></ruby>く<ruby>仕事<rt>しごと</rt></ruby>を<ruby>覚<rt>おぼ</rt></ruby>えて、チームに<ruby>貢献<rt>こうけん</rt></ruby>できるよう<ruby>頑張<rt>がんば</rt></ruby>ります。\nよろしくお<ruby>願<rt>ねが</rt></ruby>いいたします。\n<ruby>新入社員<rt>しんにゅうしゃいん</rt></ruby> <ruby>佐々木<rt>ささき</rt></ruby>",
      questions:[
        {q:"昨天舉辦了什麼？",options:["送別會","忘年會","歡迎會","會議"],correct:2,explanation:"「歓迎会を開いていただき」（舉辦了歡迎會）。"},
        {q:"佐々木的身份是什麼？",options:["部長","資深員工","新進員工","打工仔"],correct:2,explanation:"署名に「新入社員 佐々木」とある。"}
      ]
    },
    {
      id:"r-n3-12", level:"n3", type:"説明文", title:"日本の電車マナー",
      passage:"<ruby>日本<rt>にほん</rt></ruby>の<ruby>電車<rt>でんしゃ</rt></ruby>には<ruby>守<rt>まも</rt></ruby>るべきマナーがあります。<ruby>車内<rt>しゃない</rt></ruby>では<ruby>携帯電話<rt>けいたいでんわ</rt></ruby>での<ruby>通話<rt>つうわ</rt></ruby>を<ruby>控<rt>ひか</rt></ruby>え、マナーモードにしましょう。\n<ruby>優先席<rt>ゆうせんせき</rt></ruby>の<ruby>近<rt>ちか</rt></ruby>くでは<ruby>電源<rt>でんげん</rt></ruby>をお<ruby>切<rt>き</rt></ruby>りください。<ruby>大<rt>おお</rt></ruby>きな<ruby>声<rt>こえ</rt></ruby>での<ruby>会話<rt>かいわ</rt></ruby>も<ruby>迷惑<rt>めいわく</rt></ruby>になります。\nまた、リュックサックは<ruby>前<rt>まえ</rt></ruby>に<ruby>抱<rt>かか</rt></ruby>えるか、<ruby>網棚<rt>あみだな</rt></ruby>に<ruby>置<rt>お</rt></ruby>くようにしましょう。",
      questions:[
        {q:"博愛座附近應該怎麼做？",options:["切換靜音模式","關閉電源","小聲講話","把包包放好"],correct:1,explanation:"「優先席の近くでは電源をお切りください」（博愛座附近請關閉電源）。"},
        {q:"背包應該怎麼處理？",options:["背在背後","抱在前面或放行李架","放地上","放座位上"],correct:1,explanation:"「リュックサックは前に抱えるか、網棚に置く」。"}
      ]
    },
    {
      id:"r-n3-13", level:"n3", type:"日常会話", title:"引っ越しの相談",
      passage:"A：<ruby>来月<rt>らいげつ</rt></ruby><ruby>引<rt>ひ</rt></ruby>っ<ruby>越<rt>こ</rt></ruby>すことになったんだ。\nB：え、<ruby>本当<rt>ほんとう</rt></ruby>？どこに？\nA：<ruby>会社<rt>かいしゃ</rt></ruby>の<ruby>近<rt>ちか</rt></ruby>くの<ruby>難波<rt>なんば</rt></ruby>に。<ruby>通勤<rt>つうきん</rt></ruby><ruby>時間<rt>じかん</rt></ruby>が<ruby>半分<rt>はんぶん</rt></ruby>になるんだ。\nB：いいね。<ruby>引<rt>ひ</rt></ruby>っ<ruby>越<rt>こ</rt></ruby>し、<ruby>手伝<rt>てつだ</rt></ruby>おうか。\nA：ありがとう、<ruby>助<rt>たす</rt></ruby>かるよ。",
      questions:[
        {q:"A為什麼要搬家？",options:["房租便宜","離公司近","房子太小","結婚了"],correct:1,explanation:"「会社の近くの難波に。通勤時間が半分になる」（搬到公司附近的難波，通勤時間減半）。"}
      ]
    },
    {
      id:"r-n3-14", level:"n3", type:"お知らせ", title:"イベントのお知らせ",
      passage:"<ruby>大阪<rt>おおさか</rt></ruby><ruby>国際<rt>こくさい</rt></ruby><ruby>交流<rt>こうりゅう</rt></ruby>フェスティバル\n<ruby>日時<rt>にちじ</rt></ruby>：11<ruby>月<rt>がつ</rt></ruby>3<ruby>日<rt>にち</rt></ruby>（<ruby>祝<rt>しゅく</rt></ruby>）10:00〜16:00\n<ruby>場所<rt>ばしょ</rt></ruby>：<ruby>大阪城<rt>おおさかじょう</rt></ruby><ruby>公園<rt>こうえん</rt></ruby>\n<ruby>世界<rt>せかい</rt></ruby>の<ruby>料理<rt>りょうり</rt></ruby>、<ruby>音楽<rt>おんがく</rt></ruby>、ダンスが<ruby>楽<rt>たの</rt></ruby>しめます。<ruby>入場<rt>にゅうじょう</rt></ruby><ruby>無料<rt>むりょう</rt></ruby>。\nお<ruby>子<rt>こ</rt></ruby>さま<ruby>向<rt>む</rt></ruby>けのワークショップもあります。<ruby>雨天<rt>うてん</rt></ruby><ruby>中止<rt>ちゅうし</rt></ruby>。",
      questions:[
        {q:"入場需要費用嗎？",options:["需要","免費","兒童免費","需要預約"],correct:1,explanation:"「入場無料」（免費入場）。"},
        {q:"下雨的話怎麼辦？",options:["照常舉行","延期","取消","移到室內"],correct:2,explanation:"「雨天中止」（下雨取消）。"}
      ]
    },
    {
      id:"r-n3-15", level:"n3", type:"説明文", title:"日本の温泉",
      passage:"<ruby>日本<rt>にほん</rt></ruby>には<ruby>各地<rt>かくち</rt></ruby>に<ruby>温泉<rt>おんせん</rt></ruby>があり、<ruby>古<rt>ふる</rt></ruby>くから<ruby>人々<rt>ひとびと</rt></ruby>に<ruby>親<rt>した</rt></ruby>しまれてきました。\n<ruby>温泉<rt>おんせん</rt></ruby>に<ruby>入<rt>はい</rt></ruby>る<ruby>前<rt>まえ</rt></ruby>には<ruby>体<rt>からだ</rt></ruby>を<ruby>洗<rt>あら</rt></ruby>い、タオルを<ruby>湯船<rt>ゆぶね</rt></ruby>に<ruby>入<rt>い</rt></ruby>れないのがルールです。\n<ruby>有馬温泉<rt>ありまおんせん</rt></ruby>は<ruby>大阪<rt>おおさか</rt></ruby>から<ruby>近<rt>ちか</rt></ruby>く、<ruby>日帰<rt>ひがえ</rt></ruby>りで<ruby>楽<rt>たの</rt></ruby>しむことができます。<ruby>金泉<rt>きんせん</rt></ruby>と<ruby>銀泉<rt>ぎんせん</rt></ruby>の2<ruby>種類<rt>しゅるい</rt></ruby>のお<ruby>湯<rt>ゆ</rt></ruby>が<ruby>有名<rt>ゆうめい</rt></ruby>です。",
      questions:[
        {q:"泡溫泉前應該先做什麼？",options:["先休息","先洗身體","先喝水","先換衣服"],correct:1,explanation:"「温泉に入る前には体を洗い」（泡溫泉前先洗身體）。"},
        {q:"有馬溫泉有幾種泉水？",options:["1種","2種","3種","4種"],correct:1,explanation:"「金泉と銀泉の2種類のお湯が有名」（金泉和銀泉兩種）。"}
      ]
    },

    // ===== N2 (13 passages) =====
    {
      id:"r-n2-1", level:"n2", type:"新聞記事風", title:"大阪万博の最新情報",
      passage:"2025<ruby>年<rt>ねん</rt></ruby>に<ruby>開催<rt>かいさい</rt></ruby>された<ruby>大阪<rt>おおさか</rt></ruby>・<ruby>関西<rt>かんさい</rt></ruby><ruby>万博<rt>ばんぱく</rt></ruby>では、「いのち<ruby>輝<rt>かがや</rt></ruby>く<ruby>未来社会<rt>みらいしゃかい</rt></ruby>のデザイン」をテーマに、<ruby>世界<rt>せかい</rt></ruby>150<ruby>以上<rt>いじょう</rt></ruby>の<ruby>国<rt>くに</rt></ruby>と<ruby>地域<rt>ちいき</rt></ruby>が<ruby>参加<rt>さんか</rt></ruby>しました。\n<ruby>会場<rt>かいじょう</rt></ruby>の<ruby>夢洲<rt>ゆめしま</rt></ruby>は<ruby>大阪湾<rt>おおさかわん</rt></ruby>の<ruby>人工島<rt>じんこうとう</rt></ruby>で、<ruby>最新<rt>さいしん</rt></ruby>の<ruby>技術<rt>ぎじゅつ</rt></ruby>を<ruby>駆使<rt>くし</rt></ruby>したパビリオンが<ruby>並<rt>なら</rt></ruby>びました。\n<ruby>来場者<rt>らいじょうしゃ</rt></ruby><ruby>数<rt>すう</rt></ruby>は<ruby>当初<rt>とうしょ</rt></ruby>の<ruby>予想<rt>よそう</rt></ruby>を<ruby>上回<rt>うわまわ</rt></ruby>り、<ruby>経済<rt>けいざい</rt></ruby><ruby>効果<rt>こうか</rt></ruby>も<ruby>大<rt>おお</rt></ruby>きいと<ruby>報告<rt>ほうこく</rt></ruby>されています。\nしかし、<ruby>建設<rt>けんせつ</rt></ruby><ruby>費用<rt>ひよう</rt></ruby>の<ruby>超過<rt>ちょうか</rt></ruby>や<ruby>環境<rt>かんきょう</rt></ruby>への<ruby>影響<rt>えいきょう</rt></ruby>について<ruby>批判<rt>ひはん</rt></ruby>の<ruby>声<rt>こえ</rt></ruby>も<ruby>少<rt>すく</rt></ruby>なくありませんでした。",
      questions:[
        {q:"萬博的會場在哪裡？",options:["梅田","夢洲","南港","舞洲"],correct:1,explanation:"「会場の夢洲は大阪湾の人工島」。"},
        {q:"來場者數與預期相比如何？",options:["低於預期","符合預期","超過預期","沒有公布"],correct:2,explanation:"「来場者数は当初の予想を上回り」（來場者數超過當初預想）。"},
        {q:"對萬博有哪些批評？",options:["交通不便","建設費用超支和環境影響","規模太小","時間太短"],correct:1,explanation:"「建設費用の超過や環境への影響について批判の声も少なくなかった」。"}
      ]
    },
    {
      id:"r-n2-2", level:"n2", type:"説明文", title:"リモートワークの課題",
      passage:"コロナ<ruby>禍<rt>か</rt></ruby>を<ruby>きっかけ<rt>きっかけ</rt></ruby>に<ruby>急速<rt>きゅうそく</rt></ruby>に<ruby>普及<rt>ふきゅう</rt></ruby>したリモートワークだが、<ruby>数年<rt>すうねん</rt></ruby>が<ruby>経<rt>た</rt></ruby>ち、さまざまな<ruby>課題<rt>かだい</rt></ruby>が<ruby>浮<rt>う</rt></ruby>き<ruby>彫<rt>ぼ</rt></ruby>りになっている。\nコミュニケーション<ruby>不足<rt>ぶそく</rt></ruby>による<ruby>情報共有<rt>じょうほうきょうゆう</rt></ruby>の<ruby>遅<rt>おく</rt></ruby>れ、<ruby>若手社員<rt>わかてしゃいん</rt></ruby>の<ruby>育成<rt>いくせい</rt></ruby>の<ruby>難<rt>むずか</rt></ruby>しさ、そして<ruby>仕事<rt>しごと</rt></ruby>と<ruby>私生活<rt>しせいかつ</rt></ruby>の<ruby>境界<rt>きょうかい</rt></ruby>が<ruby>曖昧<rt>あいまい</rt></ruby>になるという<ruby>問題<rt>もんだい</rt></ruby>がある。\n<ruby>一方<rt>いっぽう</rt></ruby>で、<ruby>通勤<rt>つうきん</rt></ruby><ruby>時間<rt>じかん</rt></ruby>の<ruby>削減<rt>さくげん</rt></ruby>や<ruby>柔軟<rt>じゅうなん</rt></ruby>な<ruby>働<rt>はたら</rt></ruby>き<ruby>方<rt>かた</rt></ruby>の<ruby>実現<rt>じつげん</rt></ruby>など、メリットも<ruby>大<rt>おお</rt></ruby>きい。\n<ruby>多<rt>おお</rt></ruby>くの<ruby>企業<rt>きぎょう</rt></ruby>がハイブリッド<ruby>型<rt>がた</rt></ruby>の<ruby>勤務<rt>きんむ</rt></ruby><ruby>体制<rt>たいせい</rt></ruby>を<ruby>模索<rt>もさく</rt></ruby>している。",
      questions:[
        {q:"遠端工作的課題不包括以下哪項？",options:["溝通不足","培養年輕員工困難","辦公室不夠","工作與私生活界線模糊"],correct:2,explanation:"文中提到的課題是溝通不足、年輕員工培養困難、工作與私生活界線模糊，沒有提到辦公室不夠。"},
        {q:"許多企業正在探索什麼？",options:["完全遠端","混合型工作制度","取消遠端","增加加班"],correct:1,explanation:"「多くの企業がハイブリッド型の勤務体制を模索している」。"}
      ]
    },
    {
      id:"r-n2-3", level:"n2", type:"メール", title:"取引先へのメール",
      passage:"<ruby>株式会社<rt>かぶしきがいしゃ</rt></ruby>サクラ <ruby>営業部<rt>えいぎょうぶ</rt></ruby> <ruby>鈴木<rt>すずき</rt></ruby><ruby>様<rt>さま</rt></ruby>\n\nいつも<ruby>大変<rt>たいへん</rt></ruby>お<ruby>世話<rt>せわ</rt></ruby>になっております。\n<ruby>先日<rt>せんじつ</rt></ruby>ご<ruby>依頼<rt>いらい</rt></ruby>いただいた<ruby>見積書<rt>みつもりしょ</rt></ruby>を<ruby>添付<rt>てんぷ</rt></ruby>いたします。\n<ruby>納期<rt>のうき</rt></ruby>につきましては、ご<ruby>注文<rt>ちゅうもん</rt></ruby><ruby>確定<rt>かくてい</rt></ruby>から2<ruby>週間<rt>しゅうかん</rt></ruby>を<ruby>目安<rt>めやす</rt></ruby>にしております。\nなお、<ruby>年末<rt>ねんまつ</rt></ruby>は<ruby>混雑<rt>こんざつ</rt></ruby>が<ruby>予想<rt>よそう</rt></ruby>されますので、お<ruby>早<rt>はや</rt></ruby>めのご<ruby>注文<rt>ちゅうもん</rt></ruby>をお<ruby>勧<rt>すす</rt></ruby>めいたします。\nご<ruby>不明<rt>ふめい</rt></ruby>な<ruby>点<rt>てん</rt></ruby>がございましたら、お<ruby>気軽<rt>きがる</rt></ruby>にお<ruby>問<rt>と</rt></ruby>い<ruby>合<rt>あ</rt></ruby>わせください。\n\n<ruby>田中<rt>たなか</rt></ruby><ruby>商事<rt>しょうじ</rt></ruby> <ruby>営業<rt>えいぎょう</rt></ruby><ruby>課<rt>か</rt></ruby> <ruby>佐藤<rt>さとう</rt></ruby>",
      questions:[
        {q:"交期大約需要多久？",options:["1週","2週","3週","1個月"],correct:1,explanation:"「ご注文確定から2週間を目安にしております」。"},
        {q:"為什麼建議早點下單？",options:["要漲價","年末會很忙","庫存不足","要停止生產"],correct:1,explanation:"「年末は混雑が予想されますので、お早めのご注文を」。"}
      ]
    },
    {
      id:"r-n2-4", level:"n2", type:"新聞記事風", title:"少子高齢化の影響",
      passage:"<ruby>日本<rt>にほん</rt></ruby>の<ruby>少子高齢化<rt>しょうしこうれいか</rt></ruby>は<ruby>深刻<rt>しんこく</rt></ruby>さを<ruby>増<rt>ま</rt></ruby>しており、<ruby>労働力<rt>ろうどうりょく</rt></ruby><ruby>不足<rt>ぶそく</rt></ruby>が<ruby>様々<rt>さまざま</rt></ruby>な<ruby>業界<rt>ぎょうかい</rt></ruby>に<ruby>影響<rt>えいきょう</rt></ruby>を<ruby>及<rt>およ</rt></ruby>ぼしている。\n<ruby>特<rt>とく</rt></ruby>に<ruby>介護<rt>かいご</rt></ruby>や<ruby>建設<rt>けんせつ</rt></ruby>、<ruby>飲食<rt>いんしょく</rt></ruby><ruby>業界<rt>ぎょうかい</rt></ruby>では<ruby>人手<rt>ひとで</rt></ruby><ruby>不足<rt>ぶそく</rt></ruby>が<ruby>顕著<rt>けんちょ</rt></ruby>で、<ruby>外国人<rt>がいこくじん</rt></ruby><ruby>労働者<rt>ろうどうしゃ</rt></ruby>の<ruby>受<rt>う</rt></ruby>け<ruby>入<rt>い</rt></ruby>れ<ruby>拡大<rt>かくだい</rt></ruby>が<ruby>議論<rt>ぎろん</rt></ruby>されている。\n<ruby>政府<rt>せいふ</rt></ruby>は<ruby>子育<rt>こそだ</rt></ruby>て<ruby>支援<rt>しえん</rt></ruby>の<ruby>充実<rt>じゅうじつ</rt></ruby>や<ruby>女性<rt>じょせい</rt></ruby>の<ruby>社会進出<rt>しゃかいしんしゅつ</rt></ruby>の<ruby>促進<rt>そくしん</rt></ruby>などの<ruby>対策<rt>たいさく</rt></ruby>を<ruby>打<rt>う</rt></ruby>ち<ruby>出<rt>だ</rt></ruby>しているが、<ruby>効果<rt>こうか</rt></ruby>が<ruby>表<rt>あらわ</rt></ruby>れるには<ruby>時間<rt>じかん</rt></ruby>がかかると<ruby>見<rt>み</rt></ruby>られている。",
      questions:[
        {q:"勞動力不足特別嚴重的行業是？",options:["IT業","教育業","護理、建設、餐飲業","金融業"],correct:2,explanation:"「特に介護や建設、飲食業界では人手不足が顕著」。"},
        {q:"政府的對策不包括以下哪項？",options:["充實育兒支援","促進女性社會參與","降低稅率","上述都有提到"],correct:2,explanation:"文中提到了育兒支援和促進女性社會參與，沒有提到降低稅率。"}
      ]
    },
    {
      id:"r-n2-5", level:"n2", type:"説明文", title:"食品ロスの問題",
      passage:"<ruby>日本<rt>にほん</rt></ruby>では<ruby>年間<rt>ねんかん</rt></ruby><ruby>約<rt>やく</rt></ruby>600<ruby>万<rt>まん</rt></ruby>トンの<ruby>食品<rt>しょくひん</rt></ruby>が<ruby>廃棄<rt>はいき</rt></ruby>されており、そのうち<ruby>約<rt>やく</rt></ruby><ruby>半分<rt>はんぶん</rt></ruby>は<ruby>家庭<rt>かてい</rt></ruby>から<ruby>出<rt>で</rt></ruby>ている。\nまだ<ruby>食<rt>た</rt></ruby>べられるのに<ruby>捨<rt>す</rt></ruby>てられる「<ruby>食品<rt>しょくひん</rt></ruby>ロス」を<ruby>減<rt>へ</rt></ruby>らすため、<ruby>賞味期限<rt>しょうみきげん</rt></ruby>の<ruby>見直<rt>みなお</rt></ruby>しや、フードバンクの<ruby>活用<rt>かつよう</rt></ruby>が<ruby>進<rt>すす</rt></ruby>んでいる。\nスーパーでは<ruby>値引<rt>ねび</rt></ruby>きシールを<ruby>貼<rt>は</rt></ruby>って<ruby>売<rt>う</rt></ruby>り<ruby>切<rt>き</rt></ruby>る<ruby>工夫<rt>くふう</rt></ruby>をしたり、アプリで<ruby>余<rt>あま</rt></ruby>った<ruby>食品<rt>しょくひん</rt></ruby>を<ruby>安<rt>やす</rt></ruby>く<ruby>提供<rt>ていきょう</rt></ruby>するサービスも<ruby>登場<rt>とうじょう</rt></ruby>している。\n<ruby>消費者<rt>しょうひしゃ</rt></ruby>も<ruby>必要<rt>ひつよう</rt></ruby>な<ruby>量<rt>りょう</rt></ruby>だけ<ruby>買<rt>か</rt></ruby>う<ruby>意識<rt>いしき</rt></ruby>が<ruby>大切<rt>たいせつ</rt></ruby>だ。",
      questions:[
        {q:"日本每年大約廢棄多少食品？",options:["約300萬噸","約600萬噸","約900萬噸","約1200萬噸"],correct:1,explanation:"「年間約600万トンの食品が廃棄されており」。"},
        {q:"食品浪費約有多少來自家庭？",options:["約三分之一","約一半","約四分之三","幾乎全部"],correct:1,explanation:"「そのうち約半分は家庭から出ている」。"}
      ]
    },
    {
      id:"r-n2-6", level:"n2", type:"メール", title:"クレームへの対応",
      passage:"<ruby>山田<rt>やまだ</rt></ruby><ruby>様<rt>さま</rt></ruby>\n\nこの<ruby>度<rt>たび</rt></ruby>は<ruby>弊社<rt>へいしゃ</rt></ruby><ruby>製品<rt>せいひん</rt></ruby>に<ruby>不具合<rt>ふぐあい</rt></ruby>がございまして、<ruby>誠<rt>まこと</rt></ruby>に<ruby>申<rt>もう</rt></ruby>し<ruby>訳<rt>わけ</rt></ruby>ございません。\nお<ruby>送<rt>おく</rt></ruby>りいただいた<ruby>写真<rt>しゃしん</rt></ruby>を<ruby>確認<rt>かくにん</rt></ruby>したところ、<ruby>製造<rt>せいぞう</rt></ruby><ruby>過程<rt>かてい</rt></ruby>での<ruby>不備<rt>ふび</rt></ruby>が<ruby>原因<rt>げんいん</rt></ruby>と<ruby>判明<rt>はんめい</rt></ruby>いたしました。\n<ruby>代替品<rt>だいたいひん</rt></ruby>を<ruby>本日<rt>ほんじつ</rt></ruby><ruby>発送<rt>はっそう</rt></ruby>いたしますので、2〜3<ruby>日<rt>にち</rt></ruby>ほどお<ruby>待<rt>ま</rt></ruby>ちいただければ<ruby>幸<rt>さいわ</rt></ruby>いです。\n<ruby>不良品<rt>ふりょうひん</rt></ruby>につきましては、<ruby>同封<rt>どうふう</rt></ruby>の<ruby>着払<rt>ちゃくばら</rt></ruby>い<ruby>伝票<rt>でんぴょう</rt></ruby>にてご<ruby>返送<rt>へんそう</rt></ruby>ください。\n<ruby>今後<rt>こんご</rt></ruby>このようなことがないよう、<ruby>品質管理<rt>ひんしつかんり</rt></ruby>を<ruby>徹底<rt>てってい</rt></ruby>してまいります。",
      questions:[
        {q:"不良品的原因是什麼？",options:["運送過程中的損壞","製造過程中的問題","原料不良","設計錯誤"],correct:1,explanation:"「製造過程での不備が原因と判明」。"},
        {q:"不良品要怎麼退回？",options:["自費寄回","用附上的到付傳票寄回","自行丟棄","拿到門市"],correct:1,explanation:"「同封の着払い伝票にてご返送ください」。"}
      ]
    },
    {
      id:"r-n2-7", level:"n2", type:"新聞記事風", title:"AI技術の進展",
      passage:"<ruby>人工知能<rt>じんこうちのう</rt></ruby>（AI）<ruby>技術<rt>ぎじゅつ</rt></ruby>の<ruby>進展<rt>しんてん</rt></ruby>が<ruby>目覚<rt>めざ</rt></ruby>ましい。<ruby>特<rt>とく</rt></ruby>に<ruby>生成<rt>せいせい</rt></ruby>AIの<ruby>登場<rt>とうじょう</rt></ruby>により、<ruby>文章作成<rt>ぶんしょうさくせい</rt></ruby>や<ruby>画像生成<rt>がぞうせいせい</rt></ruby>、プログラミングなど、<ruby>従来<rt>じゅうらい</rt></ruby>は<ruby>人間<rt>にんげん</rt></ruby>にしかできないと<ruby>思<rt>おも</rt></ruby>われていた<ruby>作業<rt>さぎょう</rt></ruby>が<ruby>自動化<rt>じどうか</rt></ruby>されつつある。\n<ruby>教育<rt>きょういく</rt></ruby><ruby>現場<rt>げんば</rt></ruby>では、AIを<ruby>活用<rt>かつよう</rt></ruby>した<ruby>個別<rt>こべつ</rt></ruby><ruby>指導<rt>しどう</rt></ruby>の<ruby>可能性<rt>かのうせい</rt></ruby>が<ruby>注目<rt>ちゅうもく</rt></ruby>されている。\n<ruby>一方<rt>いっぽう</rt></ruby>、<ruby>著作権<rt>ちょさくけん</rt></ruby>の<ruby>問題<rt>もんだい</rt></ruby>や<ruby>雇用<rt>こよう</rt></ruby>への<ruby>影響<rt>えいきょう</rt></ruby>など、<ruby>社会的<rt>しゃかいてき</rt></ruby>な<ruby>課題<rt>かだい</rt></ruby>も<ruby>山積<rt>さんせき</rt></ruby>している。",
      questions:[
        {q:"在教育現場，AI的什麼可能性受到關注？",options:["自動批改","個別指導","翻譯","管理"],correct:1,explanation:"「AIを活用した個別指導の可能性が注目されている」。"},
        {q:"AI帶來的社會課題包括？",options:["著作權問題和就業影響","電力不足","網路安全","通貨膨脹"],correct:0,explanation:"「著作権の問題や雇用への影響など、社会的な課題も山積」。"}
      ]
    },
    {
      id:"r-n2-8", level:"n2", type:"説明文", title:"日本の敬語",
      passage:"<ruby>敬語<rt>けいご</rt></ruby>は<ruby>日本語<rt>にほんご</rt></ruby>の<ruby>特徴的<rt>とくちょうてき</rt></ruby>な<ruby>表現<rt>ひょうげん</rt></ruby>で、<ruby>尊敬語<rt>そんけいご</rt></ruby>・<ruby>謙譲語<rt>けんじょうご</rt></ruby>・<ruby>丁寧語<rt>ていねいご</rt></ruby>の3<ruby>種類<rt>しゅるい</rt></ruby>に<ruby>大別<rt>たいべつ</rt></ruby>される。\n<ruby>尊敬語<rt>そんけいご</rt></ruby>は<ruby>相手<rt>あいて</rt></ruby>の<ruby>動作<rt>どうさ</rt></ruby>を<ruby>高<rt>たか</rt></ruby>める<ruby>表現<rt>ひょうげん</rt></ruby>で、<ruby>謙譲語<rt>けんじょうご</rt></ruby>は<ruby>自分<rt>じぶん</rt></ruby>の<ruby>動作<rt>どうさ</rt></ruby>を<ruby>低<rt>ひく</rt></ruby>める<ruby>表現<rt>ひょうげん</rt></ruby>である。\n<ruby>日常<rt>にちじょう</rt></ruby><ruby>会話<rt>かいわ</rt></ruby>だけでなく、ビジネスシーンでは<ruby>正<rt>ただ</rt></ruby>しい<ruby>敬語<rt>けいご</rt></ruby>の<ruby>使用<rt>しよう</rt></ruby>が<ruby>不可欠<rt>ふかけつ</rt></ruby>である。\nしかし、<ruby>若者<rt>わかもの</rt></ruby>の<ruby>間<rt>あいだ</rt></ruby>では<ruby>敬語<rt>けいご</rt></ruby>の<ruby>使<rt>つか</rt></ruby>い<ruby>方<rt>かた</rt></ruby>が<ruby>乱<rt>みだ</rt></ruby>れてきているとの<ruby>指摘<rt>してき</rt></ruby>もあり、<ruby>議論<rt>ぎろん</rt></ruby>を<ruby>呼<rt>よ</rt></ruby>んでいる。",
      questions:[
        {q:"敬語分為幾類？",options:["2類","3類","4類","5類"],correct:1,explanation:"「尊敬語・謙譲語・丁寧語の3種類に大別される」。"},
        {q:"關於年輕人的敬語使用，有什麼指摘？",options:["使用太多","用法混亂","不再使用","越來越好"],correct:1,explanation:"「若者の間では敬語の使い方が乱れてきている」。"}
      ]
    },
    {
      id:"r-n2-9", level:"n2", type:"日常会話", title:"就職活動の相談",
      passage:"A：<ruby>就活<rt>しゅうかつ</rt></ruby>、どう？<ruby>順調<rt>じゅんちょう</rt></ruby>？\nB：いや、<ruby>全然<rt>ぜんぜん</rt></ruby>。もう10<ruby>社<rt>しゃ</rt></ruby><ruby>以上<rt>いじょう</rt></ruby><ruby>受<rt>う</rt></ruby>けたけど、<ruby>全部<rt>ぜんぶ</rt></ruby>だめだった。<ruby>面接<rt>めんせつ</rt></ruby>で<ruby>緊張<rt>きんちょう</rt></ruby>しすぎるんだよね。\nA：そっか。でも、<ruby>数<rt>かず</rt></ruby>をこなすうちに<ruby>慣<rt>な</rt></ruby>れてくるよ。<ruby>面接<rt>めんせつ</rt></ruby>の<ruby>練習<rt>れんしゅう</rt></ruby>、<ruby>手伝<rt>てつだ</rt></ruby>おうか？\nB：<ruby>本当<rt>ほんとう</rt></ruby>に？それは<ruby>助<rt>たす</rt></ruby>かる。<ruby>自己<rt>じこ</rt></ruby>PRがうまく<ruby>言<rt>い</rt></ruby>えないんだ。\nA：じゃあ、<ruby>今度<rt>こんど</rt></ruby>カフェで<ruby>練習<rt>れんしゅう</rt></ruby>しよう。",
      questions:[
        {q:"B已經應徵了幾家公司？",options:["5家以上","10家以上","20家以上","3家以上"],correct:1,explanation:"「もう10社以上受けた」。"},
        {q:"B的問題是什麼？",options:["履歷寫不好","面試太緊張","找不到想去的公司","英語不好"],correct:1,explanation:"「面接で緊張しすぎる」。"}
      ]
    },
    {
      id:"r-n2-10", level:"n2", type:"説明文", title:"持続可能な社会",
      passage:"SDGs（<ruby>持続<rt>じぞく</rt></ruby><ruby>可能<rt>かのう</rt></ruby>な<ruby>開発<rt>かいはつ</rt></ruby><ruby>目標<rt>もくひょう</rt></ruby>）への<ruby>関心<rt>かんしん</rt></ruby>が<ruby>世界的<rt>せかいてき</rt></ruby>に<ruby>高<rt>たか</rt></ruby>まっている。\n<ruby>日本<rt>にほん</rt></ruby>でも<ruby>企業<rt>きぎょう</rt></ruby>や<ruby>自治体<rt>じちたい</rt></ruby>が<ruby>積極的<rt>せっきょくてき</rt></ruby>に<ruby>取<rt>と</rt></ruby>り<ruby>組<rt>く</rt></ruby>んでおり、<ruby>再生<rt>さいせい</rt></ruby>エネルギーの<ruby>導入<rt>どうにゅう</rt></ruby>やプラスチック<ruby>削減<rt>さくげん</rt></ruby>などが<ruby>進<rt>すす</rt></ruby>められている。\n<ruby>大阪<rt>おおさか</rt></ruby><ruby>市<rt>し</rt></ruby>では2025<ruby>年<rt>ねん</rt></ruby>の<ruby>万博<rt>ばんぱく</rt></ruby>を<ruby>契機<rt>けいき</rt></ruby>に、<ruby>水素<rt>すいそ</rt></ruby>バスの<ruby>運行<rt>うんこう</rt></ruby>やゴミの<ruby>分別<rt>ぶんべつ</rt></ruby><ruby>徹底<rt>てってい</rt></ruby>など、<ruby>環境<rt>かんきょう</rt></ruby>に<ruby>配慮<rt>はいりょ</rt></ruby>した<ruby>街<rt>まち</rt></ruby>づくりを<ruby>推進<rt>すいしん</rt></ruby>している。\n<ruby>個人<rt>こじん</rt></ruby>レベルでも、マイバッグの<ruby>持参<rt>じさん</rt></ruby>やフードロス<ruby>削減<rt>さくげん</rt></ruby>など、<ruby>身近<rt>みぢか</rt></ruby>なところから<ruby>始<rt>はじ</rt></ruby>められることは<ruby>多<rt>おお</rt></ruby>い。",
      questions:[
        {q:"大阪市以什麼為契機推進環保？",options:["奧運","萬博","G20","國際會議"],correct:1,explanation:"「2025年の万博を契機に」。"},
        {q:"個人層面可以做什麼？",options:["購買電動車","自備購物袋和減少食物浪費","安裝太陽能板","種樹"],correct:1,explanation:"「マイバッグの持参やフードロス削減」。"}
      ]
    },
    {
      id:"r-n2-11", level:"n2", type:"メール", title:"研修の案内",
      passage:"<ruby>社員<rt>しゃいん</rt></ruby><ruby>各位<rt>かくい</rt></ruby>\n\n<ruby>来月<rt>らいげつ</rt></ruby>の<ruby>新入社員<rt>しんにゅうしゃいん</rt></ruby><ruby>研修<rt>けんしゅう</rt></ruby>について<ruby>以下<rt>いか</rt></ruby>の<ruby>通<rt>とお</rt></ruby>りお<ruby>知<rt>し</rt></ruby>らせいたします。\n<ruby>日程<rt>にってい</rt></ruby>：4<ruby>月<rt>がつ</rt></ruby>8<ruby>日<rt>にち</rt></ruby>（<ruby>月<rt>げつ</rt></ruby>）〜12<ruby>日<rt>にち</rt></ruby>（<ruby>金<rt>きん</rt></ruby>）\n<ruby>場所<rt>ばしょ</rt></ruby>：<ruby>本社<rt>ほんしゃ</rt></ruby>5<ruby>階<rt>かい</rt></ruby><ruby>研修<rt>けんしゅう</rt></ruby>ルーム\n<ruby>内容<rt>ないよう</rt></ruby>：ビジネスマナー、<ruby>情報<rt>じょうほう</rt></ruby>セキュリティ、<ruby>各部署<rt>かくぶしょ</rt></ruby><ruby>紹介<rt>しょうかい</rt></ruby>\n<ruby>持<rt>も</rt></ruby>ち<ruby>物<rt>もの</rt></ruby>：<ruby>筆記<rt>ひっき</rt></ruby><ruby>用具<rt>ようぐ</rt></ruby>、ノートPC\n<ruby>初日<rt>しょにち</rt></ruby>は9<ruby>時<rt>じ</rt></ruby><ruby>集合<rt>しゅうごう</rt></ruby>です。<ruby>遅刻<rt>ちこく</rt></ruby>のないようお<ruby>願<rt>ねが</rt></ruby>いします。\n\n<ruby>人事<rt>じんじ</rt></ruby><ruby>部<rt>ぶ</rt></ruby>",
      questions:[
        {q:"研修期間是幾天？",options:["3天","5天","7天","10天"],correct:1,explanation:"4月8日（月）〜12日（金）は5日間。"},
        {q:"需要帶什麼？",options:["筆記用具和筆記型電腦","名片和西裝","課本和字典","身份證"],correct:0,explanation:"「持ち物：筆記用具、ノートPC」。"}
      ]
    },
    {
      id:"r-n2-12", level:"n2", type:"新聞記事風", title:"観光客の急増",
      passage:"<ruby>円安<rt>えんやす</rt></ruby>の<ruby>影響<rt>えいきょう</rt></ruby>もあり、<ruby>訪日<rt>ほうにち</rt></ruby><ruby>外国人<rt>がいこくじん</rt></ruby><ruby>観光客<rt>かんこうきゃく</rt></ruby>が<ruby>急増<rt>きゅうぞう</rt></ruby>している。<ruby>大阪<rt>おおさか</rt></ruby>では<ruby>道頓堀<rt>どうとんぼり</rt></ruby>や<ruby>心斎橋<rt>しんさいばし</rt></ruby><ruby>周辺<rt>しゅうへん</rt></ruby>が<ruby>観光客<rt>かんこうきゃく</rt></ruby>で<ruby>溢<rt>あふ</rt></ruby>れ、<ruby>地元<rt>じもと</rt></ruby><ruby>住民<rt>じゅうみん</rt></ruby>との<ruby>共存<rt>きょうぞん</rt></ruby>が<ruby>課題<rt>かだい</rt></ruby>となっている。\nオーバーツーリズム<ruby>対策<rt>たいさく</rt></ruby>として、<ruby>混雑<rt>こんざつ</rt></ruby><ruby>状況<rt>じょうきょう</rt></ruby>の<ruby>可視化<rt>かしか</rt></ruby>アプリの<ruby>導入<rt>どうにゅう</rt></ruby>や、<ruby>分散型<rt>ぶんさんがた</rt></ruby><ruby>観光<rt>かんこう</rt></ruby>の<ruby>推進<rt>すいしん</rt></ruby>が<ruby>検討<rt>けんとう</rt></ruby>されている。\n<ruby>一方<rt>いっぽう</rt></ruby>、<ruby>インバウンド<rt>いんばうんど</rt></ruby><ruby>需要<rt>じゅよう</rt></ruby>は<ruby>地域<rt>ちいき</rt></ruby><ruby>経済<rt>けいざい</rt></ruby>の<ruby>活性化<rt>かっせいか</rt></ruby>に<ruby>大<rt>おお</rt></ruby>きく<ruby>貢献<rt>こうけん</rt></ruby>しており、<ruby>バランス<rt>ばらんす</rt></ruby>の<ruby>取<rt>と</rt></ruby>れた<ruby>施策<rt>しさく</rt></ruby>が<ruby>求<rt>もと</rt></ruby>められている。",
      questions:[
        {q:"外國觀光客急增的原因之一是？",options:["機票便宜","日圓貶值","新景點開幕","簽證放寬"],correct:1,explanation:"「円安の影響もあり」。"},
        {q:"對抗過度觀光的措施包括？",options:["限制入境","導入擁擠狀況可視化app","提高入場費","減少航班"],correct:1,explanation:"「混雑状況の可視化アプリの導入」。"}
      ]
    },
    {
      id:"r-n2-13", level:"n2", type:"説明文", title:"日本の住宅事情",
      passage:"<ruby>日本<rt>にほん</rt></ruby>の<ruby>都市部<rt>としぶ</rt></ruby>では<ruby>住宅<rt>じゅうたく</rt></ruby><ruby>価格<rt>かかく</rt></ruby>が<ruby>高騰<rt>こうとう</rt></ruby>しており、<ruby>若<rt>わか</rt></ruby>い<ruby>世代<rt>せだい</rt></ruby>のマイホーム<ruby>取得<rt>しゅとく</rt></ruby>が<ruby>難<rt>むずか</rt></ruby>しくなっている。\n<ruby>特<rt>とく</rt></ruby>に<ruby>東京<rt>とうきょう</rt></ruby>や<ruby>大阪<rt>おおさか</rt></ruby>の<ruby>中心部<rt>ちゅうしんぶ</rt></ruby>では、マンションの<ruby>平均<rt>へいきん</rt></ruby><ruby>価格<rt>かかく</rt></ruby>が<ruby>年収<rt>ねんしゅう</rt></ruby>の10<ruby>倍<rt>ばい</rt></ruby>を<ruby>超<rt>こ</rt></ruby>えるケースも<ruby>珍<rt>めずら</rt></ruby>しくない。\nそのため、<ruby>郊外<rt>こうがい</rt></ruby>に<ruby>住<rt>す</rt></ruby>むか、<ruby>賃貸<rt>ちんたい</rt></ruby>を<ruby>選<rt>えら</rt></ruby>ぶ<ruby>人<rt>ひと</rt></ruby>が<ruby>増<rt>ふ</rt></ruby>えている。\n<ruby>最近<rt>さいきん</rt></ruby>では<ruby>中古<rt>ちゅうこ</rt></ruby>マンションをリノベーションして<ruby>住<rt>す</rt></ruby>むという<ruby>選択肢<rt>せんたくし</rt></ruby>も<ruby>注目<rt>ちゅうもく</rt></ruby>されている。",
      questions:[
        {q:"都市中心的公寓均價大約是年收入的幾倍？",options:["5倍","8倍","超過10倍","20倍"],correct:2,explanation:"「平均価格が年収の10倍を超えるケースも珍しくない」。"},
        {q:"最近受關注的住宅方式是？",options:["建新房","翻新中古公寓","合租","住公營住宅"],correct:1,explanation:"「中古マンションをリノベーションして住む」。"}
      ]
    },

    // ===== N1 (10 passages) =====
    {
      id:"r-n1-1", level:"n1", type:"新聞記事風", title:"地方創生の取り組み",
      passage:"<ruby>地方<rt>ちほう</rt></ruby><ruby>創生<rt>そうせい</rt></ruby>が<ruby>叫<rt>さけ</rt></ruby>ばれて<ruby>久<rt>ひさ</rt></ruby>しいが、<ruby>人口<rt>じんこう</rt></ruby><ruby>減少<rt>げんしょう</rt></ruby>に<ruby>歯止<rt>はど</rt></ruby>めがかからない<ruby>自治体<rt>じちたい</rt></ruby>は<ruby>依然<rt>いぜん</rt></ruby>として<ruby>多<rt>おお</rt></ruby>い。\nしかし、<ruby>独自<rt>どくじ</rt></ruby>の<ruby>施策<rt>しさく</rt></ruby>で<ruby>成功<rt>せいこう</rt></ruby>を<ruby>収<rt>おさ</rt></ruby>めている<ruby>自治体<rt>じちたい</rt></ruby>も<ruby>存在<rt>そんざい</rt></ruby>する。<ruby>例<rt>たと</rt></ruby>えば、<ruby>徳島県<rt>とくしまけん</rt></ruby><ruby>神山町<rt>かみやまちょう</rt></ruby>では、IT<ruby>企業<rt>きぎょう</rt></ruby>のサテライトオフィスを<ruby>誘致<rt>ゆうち</rt></ruby>し、<ruby>都会<rt>とかい</rt></ruby>から<ruby>若者<rt>わかもの</rt></ruby>を<ruby>呼<rt>よ</rt></ruby>び<ruby>込<rt>こ</rt></ruby>むことに<ruby>成功<rt>せいこう</rt></ruby>した。\n<ruby>地域<rt>ちいき</rt></ruby>の<ruby>特色<rt>とくしょく</rt></ruby>を<ruby>活<rt>い</rt></ruby>かしたブランディングや、<ruby>移住<rt>いじゅう</rt></ruby><ruby>支援<rt>しえん</rt></ruby><ruby>制度<rt>せいど</rt></ruby>の<ruby>充実<rt>じゅうじつ</rt></ruby>が<ruby>鍵<rt>かぎ</rt></ruby>を<ruby>握<rt>にぎ</rt></ruby>っている。\nとはいえ、<ruby>一過性<rt>いっかせい</rt></ruby>のブームに<ruby>終<rt>お</rt></ruby>わらせないためには、<ruby>持続<rt>じぞく</rt></ruby><ruby>可能<rt>かのう</rt></ruby>な<ruby>産業<rt>さんぎょう</rt></ruby><ruby>基盤<rt>きばん</rt></ruby>の<ruby>構築<rt>こうちく</rt></ruby>が<ruby>不可欠<rt>ふかけつ</rt></ruby>であり、<ruby>行政<rt>ぎょうせい</rt></ruby>と<ruby>民間<rt>みんかん</rt></ruby>の<ruby>連携<rt>れんけい</rt></ruby>が<ruby>重要<rt>じゅうよう</rt></ruby>だ。",
      questions:[
        {q:"神山町成功的秘訣是什麼？",options:["發展觀光","吸引IT企業設立衛星辦公室","種植有機蔬菜","建設工廠"],correct:1,explanation:"「IT企業のサテライトオフィスを誘致し、都会から若者を呼び込むことに成功した」。"},
        {q:"為了不讓地方創生成為一時的風潮，什麼是不可或缺的？",options:["政府補助","持續可能的產業基礎建設","大型活動","觀光開發"],correct:1,explanation:"「持続可能な産業基盤の構築が不可欠」。"},
        {q:"文中認為什麼是關鍵？",options:["增加人口","地域特色的品牌化和移住支援","降低稅率","建設新幹線"],correct:1,explanation:"「地域の特色を活かしたブランディングや、移住支援制度の充実が鍵を握っている」。"}
      ]
    },
    {
      id:"r-n1-2", level:"n1", type:"エッセイ", title:"言葉と文化",
      passage:"<ruby>言葉<rt>ことば</rt></ruby>は<ruby>単<rt>たん</rt></ruby>なるコミュニケーションの<ruby>道具<rt>どうぐ</rt></ruby>ではなく、その<ruby>国<rt>くに</rt></ruby>の<ruby>文化<rt>ぶんか</rt></ruby>や<ruby>価値観<rt>かちかん</rt></ruby>を<ruby>映<rt>うつ</rt></ruby>し<ruby>出<rt>だ</rt></ruby>す<ruby>鏡<rt>かがみ</rt></ruby>でもある。\n<ruby>日本語<rt>にほんご</rt></ruby>には「<ruby>空気<rt>くうき</rt></ruby>を<ruby>読<rt>よ</rt></ruby>む」「<ruby>察<rt>さっ</rt></ruby>する」といった<ruby>表現<rt>ひょうげん</rt></ruby>があるが、これらは<ruby>直接的<rt>ちょくせつてき</rt></ruby>な<ruby>言語化<rt>げんごか</rt></ruby>を<ruby>避<rt>さ</rt></ruby>け、<ruby>暗黙<rt>あんもく</rt></ruby>の<ruby>了解<rt>りょうかい</rt></ruby>を<ruby>重視<rt>じゅうし</rt></ruby>する<ruby>日本<rt>にほん</rt></ruby><ruby>文化<rt>ぶんか</rt></ruby>の<ruby>特質<rt>とくしつ</rt></ruby>を<ruby>反映<rt>はんえい</rt></ruby>している。\n<ruby>一方<rt>いっぽう</rt></ruby>、グローバル<ruby>化<rt>か</rt></ruby>が<ruby>進<rt>すす</rt></ruby>む<ruby>現代<rt>げんだい</rt></ruby>では、<ruby>異<rt>こと</rt></ruby>なる<ruby>文化<rt>ぶんか</rt></ruby><ruby>背景<rt>はいけい</rt></ruby>を<ruby>持<rt>も</rt></ruby>つ<ruby>人々<rt>ひとびと</rt></ruby>との<ruby>意思疎通<rt>いしそつう</rt></ruby>において、<ruby>明確<rt>めいかく</rt></ruby>な<ruby>言語化<rt>げんごか</rt></ruby>が<ruby>求<rt>もと</rt></ruby>められる<ruby>場面<rt>ばめん</rt></ruby>も<ruby>増<rt>ふ</rt></ruby>えている。\nこの<ruby>二<rt>ふた</rt></ruby>つの<ruby>価値観<rt>かちかん</rt></ruby>をいかに<ruby>調和<rt>ちょうわ</rt></ruby>させるかが、<ruby>現代<rt>げんだい</rt></ruby><ruby>日本人<rt>にほんじん</rt></ruby>に<ruby>問<rt>と</rt></ruby>われている<ruby>課題<rt>かだい</rt></ruby>だろう。",
      questions:[
        {q:"作者認為語言是什麼？",options:["溝通工具","反映文化和價值觀的鏡子","學習的手段","歷史紀錄"],correct:1,explanation:"「言葉は…その国の文化や価値観を映し出す鏡でもある」。"},
        {q:"「空気を読む」反映了日本文化的什麼特質？",options:["直接表達的文化","重視暗默理解的文化","注重形式的文化","追求效率的文化"],correct:1,explanation:"「暗黙の了解を重視する日本文化の特質を反映している」。"}
      ]
    },
    {
      id:"r-n1-3", level:"n1", type:"新聞記事風", title:"量子コンピュータの展望",
      passage:"<ruby>量子<rt>りょうし</rt></ruby>コンピュータの<ruby>研究開発<rt>けんきゅうかいはつ</rt></ruby>が<ruby>世界各国<rt>せかいかっこく</rt></ruby>で<ruby>加速<rt>かそく</rt></ruby>している。<ruby>従来<rt>じゅうらい</rt></ruby>のコンピュータでは<ruby>解<rt>と</rt></ruby>くのに<ruby>数万年<rt>すうまんねん</rt></ruby>かかる<ruby>計算<rt>けいさん</rt></ruby>を、わずか<ruby>数分<rt>すうふん</rt></ruby>で<ruby>処理<rt>しょり</rt></ruby>できる<ruby>可能性<rt>かのうせい</rt></ruby>を<ruby>秘<rt>ひ</rt></ruby>めている。\n<ruby>医薬品<rt>いやくひん</rt></ruby><ruby>開発<rt>かいはつ</rt></ruby>や<ruby>気候<rt>きこう</rt></ruby>シミュレーション、<ruby>暗号<rt>あんごう</rt></ruby><ruby>解読<rt>かいどく</rt></ruby>など、<ruby>応用<rt>おうよう</rt></ruby><ruby>分野<rt>ぶんや</rt></ruby>は<ruby>多岐<rt>たき</rt></ruby>にわたる。\nただし、<ruby>現時点<rt>げんじてん</rt></ruby>では<ruby>動作<rt>どうさ</rt></ruby><ruby>環境<rt>かんきょう</rt></ruby>の<ruby>維持<rt>いじ</rt></ruby>が<ruby>困難<rt>こんなん</rt></ruby>で、<ruby>極低温<rt>きょくていおん</rt></ruby><ruby>環境<rt>かんきょう</rt></ruby>が<ruby>必要<rt>ひつよう</rt></ruby>なものが<ruby>多<rt>おお</rt></ruby>く、<ruby>実用化<rt>じつようか</rt></ruby>にはまだ<ruby>課題<rt>かだい</rt></ruby>が<ruby>残<rt>のこ</rt></ruby>されている。\n<ruby>日本<rt>にほん</rt></ruby>も<ruby>理化学研究所<rt>りかがくけんきゅうじょ</rt></ruby>を<ruby>中心<rt>ちゅうしん</rt></ruby>に<ruby>研究<rt>けんきゅう</rt></ruby>を<ruby>推進<rt>すいしん</rt></ruby>しているが、<ruby>米中<rt>べいちゅう</rt></ruby>に<ruby>比<rt>くら</rt></ruby>べると<ruby>投資<rt>とうし</rt></ruby><ruby>規模<rt>きぼ</rt></ruby>で<ruby>後<rt>おく</rt></ruby>れを<ruby>取<rt>と</rt></ruby>っている。",
      questions:[
        {q:"量子電腦目前實用化的課題是什麼？",options:["太貴","需要極低溫環境","太大","耗電太多"],correct:1,explanation:"「極低温環境が必要なものが多く、実用化にはまだ課題」。"},
        {q:"日本在量子電腦研究方面與美中相比如何？",options:["領先","相當","投資規模落後","已放棄"],correct:2,explanation:"「米中に比べると投資規模で後れを取っている」。"}
      ]
    },
    {
      id:"r-n1-4", level:"n1", type:"エッセイ", title:"読書の意義",
      passage:"インターネットの<ruby>普及<rt>ふきゅう</rt></ruby>により、<ruby>情報<rt>じょうほう</rt></ruby>を<ruby>得<rt>え</rt></ruby>る<ruby>手段<rt>しゅだん</rt></ruby>は<ruby>飛躍的<rt>ひやくてき</rt></ruby>に<ruby>増<rt>ふ</rt></ruby>えた。しかし、<ruby>断片的<rt>だんぺんてき</rt></ruby>な<ruby>情報<rt>じょうほう</rt></ruby>の<ruby>摂取<rt>せっしゅ</rt></ruby>と<ruby>読書<rt>どくしょ</rt></ruby>は<ruby>本質的<rt>ほんしつてき</rt></ruby>に<ruby>異<rt>こと</rt></ruby>なるものである。\n<ruby>読書<rt>どくしょ</rt></ruby>は<ruby>筆者<rt>ひっしゃ</rt></ruby>の<ruby>思考<rt>しこう</rt></ruby>の<ruby>流<rt>なが</rt></ruby>れを<ruby>追体験<rt>ついたいけん</rt></ruby>し、<ruby>自<rt>みずか</rt></ruby>らの<ruby>思考<rt>しこう</rt></ruby>を<ruby>深<rt>ふか</rt></ruby>める<ruby>行為<rt>こうい</rt></ruby>である。<ruby>他者<rt>たしゃ</rt></ruby>の<ruby>視点<rt>してん</rt></ruby>を<ruby>内面化<rt>ないめんか</rt></ruby>することで、<ruby>共感力<rt>きょうかんりょく</rt></ruby>や<ruby>想像力<rt>そうぞうりょく</rt></ruby>が<ruby>養<rt>やしな</rt></ruby>われるのだ。\n<ruby>活字<rt>かつじ</rt></ruby><ruby>離<rt>ばな</rt></ruby>れが<ruby>叫<rt>さけ</rt></ruby>ばれる<ruby>昨今<rt>さっこん</rt></ruby>だが、だからこそ<ruby>読書<rt>どくしょ</rt></ruby>の<ruby>価値<rt>かち</rt></ruby>を<ruby>再認識<rt>さいにんしき</rt></ruby>する<ruby>必要<rt>ひつよう</rt></ruby>があるのではないだろうか。",
      questions:[
        {q:"作者認為讀書與網路獲取資訊有何不同？",options:["速度不同","讀書能追體驗作者的思考並加深自己的思考","沒有不同","讀書比較無聊"],correct:1,explanation:"「読書は筆者の思考の流れを追体験し、自らの思考を深める行為」。"},
        {q:"讀書能培養什麼？",options:["記憶力","共感力和想像力","語言能力","分析力"],correct:1,explanation:"「共感力や想像力が養われる」。"}
      ]
    },
    {
      id:"r-n1-5", level:"n1", type:"説明文", title:"日本の伝統芸能",
      passage:"<ruby>能<rt>のう</rt></ruby>や<ruby>歌舞伎<rt>かぶき</rt></ruby>、<ruby>文楽<rt>ぶんらく</rt></ruby>に<ruby>代表<rt>だいひょう</rt></ruby>される<ruby>日本<rt>にほん</rt></ruby>の<ruby>伝統芸能<rt>でんとうげいのう</rt></ruby>は、ユネスコの<ruby>無形文化遺産<rt>むけいぶんかいさん</rt></ruby>にも<ruby>登録<rt>とうろく</rt></ruby>されている<ruby>世界<rt>せかい</rt></ruby>に<ruby>誇<rt>ほこ</rt></ruby>るべき<ruby>文化<rt>ぶんか</rt></ruby><ruby>資産<rt>しさん</rt></ruby>である。\nしかし、<ruby>観客<rt>かんきゃく</rt></ruby>の<ruby>高齢化<rt>こうれいか</rt></ruby>や<ruby>後継者<rt>こうけいしゃ</rt></ruby><ruby>不足<rt>ぶそく</rt></ruby>が<ruby>深刻<rt>しんこく</rt></ruby>な<ruby>問題<rt>もんだい</rt></ruby>となっている。\n<ruby>近年<rt>きんねん</rt></ruby>では、デジタル<ruby>技術<rt>ぎじゅつ</rt></ruby>を<ruby>活用<rt>かつよう</rt></ruby>した<ruby>演出<rt>えんしゅつ</rt></ruby>や、<ruby>若者<rt>わかもの</rt></ruby><ruby>向<rt>む</rt></ruby>けのワークショップなど、<ruby>新<rt>あたら</rt></ruby>しい<ruby>試<rt>こころ</rt></ruby>みも<ruby>行<rt>おこな</rt></ruby>われている。\n<ruby>伝統<rt>でんとう</rt></ruby>を<ruby>守<rt>まも</rt></ruby>りながらも<ruby>時代<rt>じだい</rt></ruby>に<ruby>適応<rt>てきおう</rt></ruby>していく<ruby>柔軟性<rt>じゅうなんせい</rt></ruby>が、<ruby>伝統芸能<rt>でんとうげいのう</rt></ruby>の<ruby>存続<rt>そんぞく</rt></ruby>には<ruby>不可欠<rt>ふかけつ</rt></ruby>だろう。",
      questions:[
        {q:"傳統藝能面臨的嚴重問題是什麼？",options:["場地不足","觀眾高齡化和後繼者不足","政府不支持","費用太高"],correct:1,explanation:"「観客の高齢化や後継者不足が深刻な問題」。"},
        {q:"為了傳統藝能的存續，什麼是不可或缺的？",options:["更多資金","守護傳統同時適應時代的柔軟性","擴大規模","國際化"],correct:1,explanation:"「伝統を守りながらも時代に適応していく柔軟性が…不可欠」。"}
      ]
    },
    {
      id:"r-n1-6", level:"n1", type:"新聞記事風", title:"多言語社会への対応",
      passage:"<ruby>外国人<rt>がいこくじん</rt></ruby><ruby>住民<rt>じゅうみん</rt></ruby>の<ruby>増加<rt>ぞうか</rt></ruby>に<ruby>伴<rt>ともな</rt></ruby>い、<ruby>行政<rt>ぎょうせい</rt></ruby>サービスの<ruby>多言語<rt>たげんご</rt></ruby><ruby>対応<rt>たいおう</rt></ruby>が<ruby>急務<rt>きゅうむ</rt></ruby>となっている。\n<ruby>大阪<rt>おおさか</rt></ruby><ruby>市<rt>し</rt></ruby>では、<ruby>窓口<rt>まどぐち</rt></ruby>でのAI<ruby>通訳<rt>つうやく</rt></ruby>サービスの<ruby>導入<rt>どうにゅう</rt></ruby>や、「やさしい<ruby>日本語<rt>にほんご</rt></ruby>」での<ruby>情報<rt>じょうほう</rt></ruby><ruby>発信<rt>はっしん</rt></ruby>に<ruby>取<rt>と</rt></ruby>り<ruby>組<rt>く</rt></ruby>んでいる。\nしかし、<ruby>医療<rt>いりょう</rt></ruby>や<ruby>法律<rt>ほうりつ</rt></ruby>など<ruby>専門性<rt>せんもんせい</rt></ruby>の<ruby>高<rt>たか</rt></ruby>い<ruby>分野<rt>ぶんや</rt></ruby>では、AIだけでは<ruby>対応<rt>たいおう</rt></ruby>しきれない<ruby>場面<rt>ばめん</rt></ruby>も<ruby>多<rt>おお</rt></ruby>く、<ruby>人材<rt>じんざい</rt></ruby><ruby>育成<rt>いくせい</rt></ruby>も<ruby>並行<rt>へいこう</rt></ruby>して<ruby>進<rt>すす</rt></ruby>める<ruby>必要<rt>ひつよう</rt></ruby>がある。\n<ruby>多文化<rt>たぶんか</rt></ruby><ruby>共生<rt>きょうせい</rt></ruby><ruby>社会<rt>しゃかい</rt></ruby>の<ruby>実現<rt>じつげん</rt></ruby>には、<ruby>言語<rt>げんご</rt></ruby>の<ruby>壁<rt>かべ</rt></ruby>を<ruby>取<rt>と</rt></ruby>り<ruby>除<rt>のぞ</rt></ruby>くだけでなく、<ruby>文化<rt>ぶんか</rt></ruby>や<ruby>習慣<rt>しゅうかん</rt></ruby>の<ruby>相互<rt>そうご</rt></ruby><ruby>理解<rt>りかい</rt></ruby>も<ruby>欠<rt>か</rt></ruby>かせない。",
      questions:[
        {q:"大阪市導入了什麼服務？",options:["免費日語課","AI翻譯服務和淺顯日語資訊發送","外國人優惠","多語言警察"],correct:1,explanation:"「AI通訳サービスの導入や、『やさしい日本語』での情報発信」。"},
        {q:"在醫療和法律等專業領域，有什麼問題？",options:["費用太高","僅靠AI無法完全應對","外國人不想使用","翻譯品質差"],correct:1,explanation:"「AIだけでは対応しきれない場面も多く」。"}
      ]
    },
    {
      id:"r-n1-7", level:"n1", type:"エッセイ", title:"都市と自然の共存",
      passage:"<ruby>都市<rt>とし</rt></ruby><ruby>開発<rt>かいはつ</rt></ruby>と<ruby>自然<rt>しぜん</rt></ruby><ruby>保護<rt>ほご</rt></ruby>は、しばしば<ruby>対立<rt>たいりつ</rt></ruby><ruby>概念<rt>がいねん</rt></ruby>として<ruby>捉<rt>とら</rt></ruby>えられてきた。しかし、<ruby>近年<rt>きんねん</rt></ruby>の<ruby>都市計画<rt>としけいかく</rt></ruby>では、<ruby>両者<rt>りょうしゃ</rt></ruby>の<ruby>共存<rt>きょうぞん</rt></ruby>を<ruby>目指<rt>めざ</rt></ruby>す<ruby>動<rt>うご</rt></ruby>きが<ruby>加速<rt>かそく</rt></ruby>している。\n<ruby>大阪<rt>おおさか</rt></ruby>の<ruby>中之島<rt>なかのしま</rt></ruby>では、<ruby>都心<rt>としん</rt></ruby>にありながらも<ruby>緑地<rt>りょくち</rt></ruby>を<ruby>確保<rt>かくほ</rt></ruby>し、<ruby>水辺<rt>みずべ</rt></ruby>の<ruby>景観<rt>けいかん</rt></ruby>を<ruby>活<rt>い</rt></ruby>かした<ruby>再開発<rt>さいかいはつ</rt></ruby>が<ruby>進<rt>すす</rt></ruby>んでいる。\n<ruby>都市<rt>とし</rt></ruby>の<ruby>中<rt>なか</rt></ruby>に<ruby>自然<rt>しぜん</rt></ruby>を<ruby>取<rt>と</rt></ruby>り<ruby>込<rt>こ</rt></ruby>むことは、ヒートアイランド<ruby>現象<rt>げんしょう</rt></ruby>の<ruby>緩和<rt>かんわ</rt></ruby>や<ruby>生物<rt>せいぶつ</rt></ruby><ruby>多様性<rt>たようせい</rt></ruby>の<ruby>維持<rt>いじ</rt></ruby>だけでなく、<ruby>住民<rt>じゅうみん</rt></ruby>の<ruby>精神的<rt>せいしんてき</rt></ruby><ruby>健康<rt>けんこう</rt></ruby>にも<ruby>寄与<rt>きよ</rt></ruby>するとされる。\n<ruby>持続<rt>じぞく</rt></ruby><ruby>可能<rt>かのう</rt></ruby>な<ruby>都市<rt>とし</rt></ruby>の<ruby>あり方<rt>ありかた</rt></ruby>を<ruby>考<rt>かんが</rt></ruby>える<ruby>上<rt>うえ</rt></ruby>で、<ruby>自然<rt>しぜん</rt></ruby>との<ruby>関係<rt>かんけい</rt></ruby>を<ruby>見直<rt>みなお</rt></ruby>すことは<ruby>避<rt>さ</rt></ruby>けて<ruby>通<rt>とお</rt></ruby>れない<ruby>課題<rt>かだい</rt></ruby>である。",
      questions:[
        {q:"中之島的再開發有什麼特色？",options:["建設高樓","確保綠地並活用水邊景觀","建設商業設施","擴大道路"],correct:1,explanation:"「緑地を確保し、水辺の景観を活かした再開発」。"},
        {q:"在都市中融入自然的效果不包括以下哪項？",options:["緩和熱島效應","維持生物多樣性","提升經濟效益","對居民精神健康有益"],correct:2,explanation:"文中提到了熱島效應緩和、生物多樣性維持和精神健康，沒有提到經濟效益。"}
      ]
    },
    {
      id:"r-n1-8", level:"n1", type:"説明文", title:"言語習得のメカニズム",
      passage:"<ruby>第二<rt>だいに</rt></ruby><ruby>言語<rt>げんご</rt></ruby><ruby>習得<rt>しゅうとく</rt></ruby>の<ruby>研究<rt>けんきゅう</rt></ruby>によれば、<ruby>成人<rt>せいじん</rt></ruby>の<ruby>言語<rt>げんご</rt></ruby><ruby>学習<rt>がくしゅう</rt></ruby>は<ruby>母語<rt>ぼご</rt></ruby><ruby>習得<rt>しゅうとく</rt></ruby>とは<ruby>異<rt>こと</rt></ruby>なるプロセスを<ruby>辿<rt>たど</rt></ruby>る。\n<ruby>臨界期<rt>りんかいき</rt></ruby><ruby>仮説<rt>かせつ</rt></ruby>では、<ruby>思春期<rt>ししゅんき</rt></ruby>を<ruby>過<rt>す</rt></ruby>ぎると<ruby>言語<rt>げんご</rt></ruby><ruby>習得<rt>しゅうとく</rt></ruby>の<ruby>能力<rt>のうりょく</rt></ruby>が<ruby>低下<rt>ていか</rt></ruby>するとされるが、<ruby>近年<rt>きんねん</rt></ruby>の<ruby>研究<rt>けんきゅう</rt></ruby>では<ruby>動機<rt>どうき</rt></ruby>づけや<ruby>学習<rt>がくしゅう</rt></ruby><ruby>環境<rt>かんきょう</rt></ruby>の<ruby>質<rt>しつ</rt></ruby>が<ruby>習得<rt>しゅうとく</rt></ruby><ruby>成果<rt>せいか</rt></ruby>に<ruby>大<rt>おお</rt></ruby>きく<ruby>影響<rt>えいきょう</rt></ruby>することが<ruby>明<rt>あき</rt></ruby>らかになっている。\n<ruby>特<rt>とく</rt></ruby>に、<ruby>目標<rt>もくひょう</rt></ruby><ruby>言語<rt>げんご</rt></ruby>を<ruby>使<rt>つか</rt></ruby>って<ruby>実際<rt>じっさい</rt></ruby>にコミュニケーションを<ruby>取<rt>と</rt></ruby>る<ruby>機会<rt>きかい</rt></ruby>が<ruby>多<rt>おお</rt></ruby>いほど、<ruby>習得<rt>しゅうとく</rt></ruby>が<ruby>促進<rt>そくしん</rt></ruby>されるという<ruby>報告<rt>ほうこく</rt></ruby>がある。\n<ruby>教室<rt>きょうしつ</rt></ruby>での<ruby>学習<rt>がくしゅう</rt></ruby>と<ruby>実践<rt>じっせん</rt></ruby>の<ruby>バランス<rt>ばらんす</rt></ruby>が、<ruby>効果的<rt>こうかてき</rt></ruby>な<ruby>言語<rt>げんご</rt></ruby><ruby>習得<rt>しゅうとく</rt></ruby>の<ruby>鍵<rt>かぎ</rt></ruby>を<ruby>握<rt>にぎ</rt></ruby>っている。",
      questions:[
        {q:"臨界期假說認為什麼？",options:["成人學不了外語","過了青春期語言習得能力下降","嬰兒學語言最快","每個人都有語言天賦"],correct:1,explanation:"「思春期を過ぎると言語習得の能力が低下する」。"},
        {q:"什麼越多，語言習得就越被促進？",options:["學習時間","實際使用目標語言溝通的機會","背單字的量","文法練習"],correct:1,explanation:"「目標言語を使って実際にコミュニケーションを取る機会が多いほど、習得が促進される」。"}
      ]
    },
    {
      id:"r-n1-9", level:"n1", type:"新聞記事風", title:"働き方改革の現状",
      passage:"<ruby>働<rt>はたら</rt></ruby>き<ruby>方<rt>かた</rt></ruby><ruby>改革<rt>かいかく</rt></ruby><ruby>関連法<rt>かんれんほう</rt></ruby>の<ruby>施行<rt>しこう</rt></ruby>から<ruby>数年<rt>すうねん</rt></ruby>が<ruby>経過<rt>けいか</rt></ruby>し、<ruby>長時間<rt>ちょうじかん</rt></ruby><ruby>労働<rt>ろうどう</rt></ruby>の<ruby>是正<rt>ぜせい</rt></ruby>は<ruby>一定<rt>いってい</rt></ruby>の<ruby>成果<rt>せいか</rt></ruby>を<ruby>見<rt>み</rt></ruby>せている。しかし、<ruby>形式的<rt>けいしきてき</rt></ruby>な<ruby>残業<rt>ざんぎょう</rt></ruby><ruby>削減<rt>さくげん</rt></ruby>にとどまり、<ruby>実質的<rt>じっしつてき</rt></ruby>な<ruby>生産性<rt>せいさんせい</rt></ruby><ruby>向上<rt>こうじょう</rt></ruby>に<ruby>結<rt>むす</rt></ruby>びついていないケースも<ruby>散見<rt>さんけん</rt></ruby>される。\n<ruby>管理職<rt>かんりしょく</rt></ruby>の<ruby>意識改革<rt>いしきかいかく</rt></ruby>や、<ruby>業務<rt>ぎょうむ</rt></ruby>プロセスの<ruby>根本的<rt>こんぽんてき</rt></ruby>な<ruby>見直<rt>みなお</rt></ruby>しなしには、<ruby>真<rt>しん</rt></ruby>の<ruby>改革<rt>かいかく</rt></ruby>は<ruby>実現<rt>じつげん</rt></ruby>しない。\n<ruby>従業員<rt>じゅうぎょういん</rt></ruby>の<ruby>健康<rt>けんこう</rt></ruby>と<ruby>幸福度<rt>こうふくど</rt></ruby>を<ruby>重視<rt>じゅうし</rt></ruby>する「ウェルビーイング<ruby>経営<rt>けいえい</rt></ruby>」の<ruby>概念<rt>がいねん</rt></ruby>が<ruby>広<rt>ひろ</rt></ruby>まりつつある<ruby>中<rt>なか</rt></ruby>、<ruby>企業<rt>きぎょう</rt></ruby>には<ruby>より<rt>より</rt></ruby><ruby>本質的<rt>ほんしつてき</rt></ruby>な<ruby>変革<rt>へんかく</rt></ruby>が<ruby>求<rt>もと</rt></ruby>められている。",
      questions:[
        {q:"工作方式改革存在什麼問題？",options:["完全沒有效果","形式上減少加班但未實質提高生產力","加班反而增加","員工反對"],correct:1,explanation:"「形式的な残業削減にとどまり、実質的な生産性向上に結びついていない」。"},
        {q:"什麼概念正在擴散？",options:["績效主義","Well-being經營","終身僱用","年功序列"],correct:1,explanation:"「ウェルビーイング経営の概念が広まりつつある」。"}
      ]
    },
    {
      id:"r-n1-10", level:"n1", type:"エッセイ", title:"孤独と社会",
      passage:"<ruby>現代<rt>げんだい</rt></ruby><ruby>社会<rt>しゃかい</rt></ruby>において、「<ruby>孤独<rt>こどく</rt></ruby>」は<ruby>個人<rt>こじん</rt></ruby>の<ruby>問題<rt>もんだい</rt></ruby>にとどまらず、<ruby>社会的<rt>しゃかいてき</rt></ruby><ruby>課題<rt>かだい</rt></ruby>として<ruby>認識<rt>にんしき</rt></ruby>されるようになった。\nイギリスに<ruby>続<rt>つづ</rt></ruby>き<ruby>日本<rt>にほん</rt></ruby>でも「<ruby>孤独<rt>こどく</rt></ruby>・<ruby>孤立<rt>こりつ</rt></ruby><ruby>対策<rt>たいさく</rt></ruby><ruby>担当<rt>たんとう</rt></ruby><ruby>大臣<rt>だいじん</rt></ruby>」が<ruby>設置<rt>せっち</rt></ruby>された。<ruby>単身<rt>たんしん</rt></ruby><ruby>世帯<rt>せたい</rt></ruby>の<ruby>増加<rt>ぞうか</rt></ruby>、<ruby>地域<rt>ちいき</rt></ruby>コミュニティの<ruby>希薄化<rt>きはくか</rt></ruby>、SNS<ruby>上<rt>じょう</rt></ruby>の<ruby>表面的<rt>ひょうめんてき</rt></ruby>なつながりなど、<ruby>孤独<rt>こどく</rt></ruby>を<ruby>生<rt>う</rt></ruby>む<ruby>構造的<rt>こうぞうてき</rt></ruby><ruby>要因<rt>よういん</rt></ruby>は<ruby>複雑<rt>ふくざつ</rt></ruby>に<ruby>絡<rt>から</rt></ruby>み<ruby>合<rt>あ</rt></ruby>っている。\n<ruby>孤独<rt>こどく</rt></ruby>は<ruby>心身<rt>しんしん</rt></ruby>の<ruby>健康<rt>けんこう</rt></ruby>に<ruby>深刻<rt>しんこく</rt></ruby>な<ruby>影響<rt>えいきょう</rt></ruby>を<ruby>及<rt>およ</rt></ruby>ぼすことが<ruby>医学的<rt>いがくてき</rt></ruby>にも<ruby>証明<rt>しょうめい</rt></ruby>されており、<ruby>一日<rt>いちにち</rt></ruby>15<ruby>本<rt>ほん</rt></ruby>の<ruby>喫煙<rt>きつえん</rt></ruby>に<ruby>匹敵<rt>ひってき</rt></ruby>する<ruby>健康<rt>けんこう</rt></ruby>リスクがあるという<ruby>研究<rt>けんきゅう</rt></ruby>もある。\n<ruby>解決<rt>かいけつ</rt></ruby>には、<ruby>制度的<rt>せいどてき</rt></ruby>な<ruby>支援<rt>しえん</rt></ruby>だけでなく、<ruby>人<rt>ひと</rt></ruby>と<ruby>人<rt>ひと</rt></ruby>とのつながりを<ruby>再構築<rt>さいこうちく</rt></ruby>する<ruby>草の根<rt>くさのね</rt></ruby>レベルの<ruby>取<rt>と</rt></ruby>り<ruby>組<rt>く</rt></ruby>みが<ruby>求<rt>もと</rt></ruby>められている。",
      questions:[
        {q:"孤獨的健康風險被比喻為什麼？",options:["每天喝酒","每天抽15根煙","不運動","不吃早餐"],correct:1,explanation:"「一日15本の喫煙に匹敵する健康リスクがある」。"},
        {q:"產生孤獨的結構性因素不包括以下哪項？",options:["單身家庭增加","地域社群弱化","經濟衰退","SNS上表面的連結"],correct:2,explanation:"文中提到的是單身世帯增加、地域社群弱化、SNS上的表面連結，沒有提到經濟衰退。"},
        {q:"解決孤獨問題需要什麼？",options:["只靠政府制度","制度支援加上重建人際連結的草根行動","增加SNS使用","建設更多設施"],correct:1,explanation:"「制度的な支援だけでなく、人と人とのつながりを再構築する草の根レベルの取り組み」。"}
      ]
    }
  ];

  // ── helpers ──
  function getScores() { try { return JSON.parse(localStorage.getItem(SCORE_KEY)) || {}; } catch(e) { return {}; } }
  function saveScores(d) { localStorage.setItem(SCORE_KEY, JSON.stringify(d)); }

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2,'0')}`;
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
        <h3 style="margin:0">${t('rd_title')}</h3>
        <button class="qclose" style="width:auto;margin:0;padding:2px 10px" onclick="Reading.close()">✕</button>
      </div>
      <p style="font-size:13px;color:var(--tx2);margin-bottom:12px">${t('rd_subtitle')}</p>
      <div class="qf"><label>${t('quiz_level')}</label><div class="qo" id="rdLevel">
        <button class="on" data-v="n5">N5</button><button data-v="n4">N4</button>
        <button data-v="n3">N3</button><button data-v="n2">N2</button>
        <button data-v="n1">N1</button>
      </div></div>
      <div class="qf"><label>${t('rd_timer')}</label><div class="qo" id="rdTimer">
        <button class="on" data-v="1">${t('rd_timer_on')}</button><button data-v="0">${t('rd_timer_off')}</button>
      </div></div>
      <div style="margin:10px 0;display:flex;flex-wrap:wrap;gap:4px">${levelStats}</div>
      <button class="qstart" onclick="Reading.begin()">${t('rd_start')}</button>
      <button class="qclose" onclick="Reading.close()">${t('rd_cancel')}</button>`;
    box.querySelectorAll('.qo').forEach(g => {
      g.querySelectorAll('button').forEach(b => {
        b.onclick = () => { g.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); };
      });
    });
    document.getElementById('quizBg').classList.add('show');
  }

  function begin() {
    // 從起始面板讀設定；若從結果頁呼叫則面板不存在，沿用上次設定（防止按鈕無反應）
    const lvEl = document.querySelector('#rdLevel .on');
    const tmEl = document.querySelector('#rdTimer .on');
    if (lvEl) selectedLevel = lvEl.dataset.v;
    if (tmEl) timerEnabled = tmEl.dataset.v === '1';
    const pool = passages.filter(p => p.level === selectedLevel);
    if (!pool.length) { alert(t('rd_no_data')); return; }
    currentPassage = pool[Math.floor(Math.random() * pool.length)];
    currentQ = 0;
    score = 0;
    answered = [];
    timerSeconds = 0;
    renderPassage();
  }
  // 再讀同一篇（不重新抽）
  function retrySame() {
    if (!currentPassage) return begin();
    currentQ = 0;
    score = 0;
    answered = [];
    timerSeconds = 0;
    renderPassage();
  }

  function renderPassage() {
    const p = currentPassage;
    const box = document.getElementById('quizBox');

    if (timerEnabled) {
      if (timerInterval) clearInterval(timerInterval);
      timerSeconds = 0;
      timerInterval = setInterval(() => {
        timerSeconds++;
        const el = document.getElementById('rdTimer');
        if (el) el.textContent = formatTime(timerSeconds);
      }, 1000);
    }

    const passageHtml = p.passage.replace(/\n/g, '<br>');
    box.innerHTML = `
      <div class="qhd">
        <span style="display:flex;align-items:center;gap:6px">
          <span class="cf-lv">${p.level.toUpperCase()}</span>
          <span>${p.type}</span>
        </span>
        <span style="display:flex;align-items:center;gap:8px">
          ${timerEnabled ? '<span id="rdTimer" style="font-variant-numeric:tabular-nums">0:00</span>' : ''}
          <button class="qclose" style="width:auto;margin:0;padding:2px 10px" onclick="Reading.close()">✕</button>
        </span>
      </div>
      <h4 style="margin-bottom:10px;color:var(--tx)">${p.title}</h4>
      <div id="rdPassage" style="background:var(--bg3);padding:16px;border-radius:8px;line-height:2;font-size:15px;margin-bottom:12px;border:1px solid var(--bd);color:var(--tx)">${passageHtml}</div>
      <div style="display:flex;gap:6px;margin-bottom:14px">
        <button onclick="Reading.toggleFurigana()" style="font-size:11px;padding:4px 10px;border:1px solid var(--bd);border-radius:6px;background:var(--bg2);color:var(--tx2);cursor:pointer" id="rdFuriBtn">${t('rd_furigana_show')}</button>
      </div>
      <div id="rdQuestions"></div>
      <div id="rdNav" style="margin-top:12px"></div>`;

    furiganaVisible = true;
    renderQuestion();
  }

  function renderQuestion() {
    const p = currentPassage;
    if (currentQ >= p.questions.length) { showPassageResults(); return; }
    const q = p.questions[currentQ];
    const qDiv = document.getElementById('rdQuestions');
    qDiv.innerHTML = `
      <div style="font-size:13px;color:var(--tx2);margin-bottom:6px">問題 ${currentQ + 1} / ${p.questions.length}</div>
      <div style="font-size:15px;font-weight:600;margin-bottom:10px;color:var(--tx)">${q.q}</div>
      <div class="qopts">${q.options.map((o, i) => '<button class="qopt" onclick="Reading.answer(' + i + ')">' + o + '</button>').join('')}</div>`;
  }

  function answer(idx) {
    const q = currentPassage.questions[currentQ];
    const correct = idx === q.correct;
    if (correct) score++;
    answered.push({ q: q.q, correct, chosenIdx: idx, correctIdx: q.correct, options: q.options });

    const opts = document.querySelectorAll('#rdQuestions .qopt');
    opts.forEach((b, i) => {
      b.disabled = true;
      if (i === q.correct) b.classList.add('qcorrect');
      if (i === idx && !correct) b.classList.add('qwrong');
    });

    // Show explanation
    const qDiv = document.getElementById('rdQuestions');
    const expDiv = document.createElement('div');
    expDiv.style.cssText = 'margin-top:10px;padding:10px;border-radius:8px;font-size:13px;background:var(--note-bg);color:var(--note-tx);border-left:3px solid var(--ac)';
    expDiv.innerHTML = `<b>${correct ? '✓ 正確' : '✗ 錯誤'}</b>　${q.explanation}`;
    qDiv.appendChild(expDiv);

    const navDiv = document.getElementById('rdNav');
    if (currentQ < currentPassage.questions.length - 1) {
      navDiv.innerHTML = `<button class="qstart" onclick="Reading.nextQ()">${t('rd_next')}</button>`;
    } else {
      navDiv.innerHTML = `<button class="qstart" onclick="Reading.showPassageResults()">${t('rd_show_result')}</button>`;
    }
  }

  function nextQ() {
    currentQ++;
    renderQuestion();
    document.getElementById('rdNav').innerHTML = '';
  }

  function showPassageResults() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    const p = currentPassage;
    const total = p.questions.length;
    const pct = Math.round(score / total * 100);

    // Save scores
    const scores = getScores();
    if (!scores[selectedLevel]) scores[selectedLevel] = { correct: 0, total: 0 };
    scores[selectedLevel].correct += score;
    scores[selectedLevel].total += total;
    saveScores(scores);

    const cls = pct >= 80 ? 'good' : pct >= 50 ? 'ok' : 'bad';
    const box = document.getElementById('quizBox');
    box.innerHTML = `
      <h3>${t('rd_title')}</h3>
      <div class="qscore ${cls}">${score} / ${total} (${pct}%)</div>
      ${timerEnabled ? `<div style="text-align:center;font-size:13px;color:var(--tx2);margin-bottom:8px">${t('rd_time_used', { t: formatTime(timerSeconds) })}</div>` : ''}
      <div style="font-size:13px;color:var(--tx2);margin-bottom:8px">${p.title}（${p.level.toUpperCase()}）</div>
      <div class="qresults">${answered.map(a =>
        '<div class="qr ' + (a.correct ? 'ok' : 'ng') + '"><span class="qrc">' + (a.correct ? '✓' : '✗') + '</span><span>' + a.q + '</span></div>'
      ).join('')}</div>
      <div class="qactions">
        <button class="qstart" onclick="Reading.begin()">下一篇</button>
        <button class="qstart" style="background:var(--bg3);color:var(--tx)" onclick="Reading.retrySame()">再讀同一篇</button>
        <button class="qclose" onclick="Reading.close()">${t('ls_close')}</button>
      </div>`;
  }

  function toggleFurigana() {
    furiganaVisible = !furiganaVisible;
    const passage = document.getElementById('rdPassage');
    if (passage) {
      passage.querySelectorAll('rt').forEach(rt => {
        rt.style.visibility = furiganaVisible ? 'visible' : 'hidden';
      });
    }
    const btn = document.getElementById('rdFuriBtn');
    if (btn) btn.textContent = furiganaVisible ? t('rd_furigana_show') : t('rd_furigana_hide');
  }

  function close() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    document.getElementById('quizBg').classList.remove('show');
  }

  return { start, begin, retrySame, answer, nextQ, showPassageResults, toggleFurigana, close };
})();
