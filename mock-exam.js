// ========== JLPT MOCK EXAM ==========
const MockExam = (() => {
  let examLevel = 'n3';
  let sections = [];
  let currentSection = 0;
  let currentQ = 0;
  let answers = [];
  let startTime = 0;
  let sectionStart = 0;
  let timerInterval = null;
  let sectionTimeLimit = 0; // ms

  // ── Reading Passage Bank ──
  const PASSAGES = [
    // ── N5 ──
    {level:'n5',text:'わたしは まいあさ 7じに おきます。あさごはんを たべてから、がっこうに いきます。がっこうは 9じから 3じまでです。3じに うちに かえります。',q:'この人は まいあさ なんじに おきますか。',opts:['6じ','7じ','8じ','9じ'],ans:1},
    {level:'n5',text:'きのう ともだちと えいがを みました。えいがは とても おもしろかったです。えいがの あとで、レストランで ばんごはんを たべました。',q:'きのう なにを しましたか。',opts:['べんきょうした','りょこうした','えいがを みた','かいものした'],ans:2},
    {level:'n5',text:'わたしの へやは ちいさいですが、まどが おおきくて あかるいです。つくえの うえに パソコンと ほんが あります。まいにち ここで べんきょうします。',q:'この人の へやは どんな へやですか。',opts:['おおきくて くらい','ちいさくて くらい','おおきくて あかるい','ちいさくて あかるい'],ans:3},
    {level:'n5',text:'スーパーで りんごと ぎゅうにゅうを かいました。りんごは 3つで 300えんでした。ぎゅうにゅうは 1ぽん 200えんでした。ぜんぶで 500えんでした。',q:'ぜんぶで いくらでしたか。',opts:['300えん','200えん','500えん','600えん'],ans:2},

    // ── N4 ──
    {level:'n4',text:'来週の金曜日にクラスのパーティーがあります。場所は学校の食堂です。時間は午後5時から8時までです。食べ物は みんなで持ってきてください。飲み物は先生が買ってくれます。',q:'飲み物はだれが用意しますか。',opts:['学生が持ってくる','先生が買う','学校が準備する','パーティーにない'],ans:1},
    {level:'n4',text:'田中さんは毎日電車で会社に通っています。朝は電車が混んでいるので、いつも早く家を出ます。会社まで1時間ぐらいかかります。最近、会社の近くに引っ越そうと思っています。',q:'田中さんはどうして引っ越したいですか。',opts:['会社がきらいだから','電車が好きだから','通勤が大変だから','家賃が高いから'],ans:2},
    {level:'n4',text:'お知らせ：来月から図書館の開館時間が変わります。月曜日から金曜日は午前9時から午後8時まで、土曜日と日曜日は午前10時から午後5時までです。毎週水曜日は休みです。',q:'土曜日は何時まで開いていますか。',opts:['午後8時','午後5時','午後6時','午後7時'],ans:1},
    {level:'n4',text:'昨日、友達にメールを書きました。「来週の日曜日にハイキングに行きませんか。天気がよかったら、山に登りましょう。雨だったら、映画を見に行きましょう。」と書きました。',q:'雨の日はどうしますか。',opts:['ハイキングに行く','山に登る','映画を見る','うちにいる'],ans:2},

    // ── N3 ──
    {level:'n3',text:'最近、日本では「食品ロス」が問題になっている。まだ食べられるのに捨てられる食品が年間約600万トンもある。この問題を解決するために、スーパーでは値引きを行ったり、フードバンクに寄付したりする取り組みが広がっている。',q:'この文章の主なテーマは何ですか。',opts:['スーパーの経営問題','日本の食糧不足','食べ物の廃棄問題と対策','フードバンクの歴史'],ans:2},
    {level:'n3',text:'先日、会社で新しいプロジェクトが始まりました。チームは5人で、私はリーダーを任されました。経験が少ないので不安でしたが、上司に「失敗を恐れずにやってみなさい」と言われ、やる気が出ました。',q:'この人はなぜやる気が出ましたか。',opts:['経験が多いから','チームが大きいから','上司に励まされたから','給料が上がったから'],ans:2},
    {level:'n3',text:'お客様各位：8月10日から15日まで、夏季休業とさせていただきます。休業中のお問い合わせにつきましては、16日以降に順次ご対応いたします。ご不便をおかけしますが、ご理解のほどよろしくお願いいたします。',q:'このお知らせは何について書かれていますか。',opts:['新商品の案内','営業時間の変更','夏休みの休業案内','社員募集'],ans:2},
    {level:'n3',text:'山田さんは毎朝6時に起きて、近くの公園を走っています。最初は1キロも走れませんでしたが、半年続けた結果、今では5キロ走れるようになりました。来月のマラソン大会に出る予定です。',q:'山田さんについて正しいものはどれですか。',opts:['最初から5キロ走れた','半年前に走り始めた','マラソン大会で優勝した','毎晩走っている'],ans:1},
    {level:'n3',text:'最近、リモートワークが増えたことで、地方に移住する人が多くなっている。都会に比べて家賃が安く、自然が豊かなのが魅力だという。一方で、買い物が不便だったり、近所付き合いに慣れないという声もある。',q:'地方移住のデメリットとして挙げられているのは何ですか。',opts:['家賃が高い','自然がない','買い物が不便','仕事がない'],ans:2},
    {level:'n3',text:'佐藤さんへ\n先日はお忙しい中、面接のお時間をいただきありがとうございました。御社の事業内容に大変興味を持ちました。ぜひ一緒に働かせていただきたいと思っております。ご検討のほど、よろしくお願いいたします。',q:'このメールは何のために書かれましたか。',opts:['退職の報告','面接のお礼','会議の連絡','商品の注文'],ans:1},

    // ── N2 ──
    {level:'n2',text:'日本の少子高齢化は深刻な問題となっている。出生率の低下に伴い、労働人口が減少し、社会保障制度の維持が困難になりつつある。政府は子育て支援策の拡充や、外国人労働者の受け入れ拡大などの対策を講じているが、根本的な解決には至っていない。',q:'筆者が述べている主な問題は何ですか。',opts:['外国人労働者の増加','教育制度の改革','少子高齢化による社会への影響','子育て支援策の効果'],ans:2},
    {level:'n2',text:'近年、AIの発展により多くの職業が自動化される可能性が指摘されている。しかし、AIに置き換えられない仕事もある。例えば、人の感情を理解し共感する能力が求められるカウンセラーや、創造的なアイデアを生み出すデザイナーなどである。',q:'AIに置き換えにくい仕事の特徴は何ですか。',opts:['単純作業が多い','データ処理が中心','人間的な感情や創造性が必要','給料が低い'],ans:2},
    {level:'n2',text:'このたび弊社は、環境への配慮から、すべての製品パッケージをプラスチックから紙素材に変更することを決定いたしました。2024年4月より順次切り替えを行います。品質には一切影響ございませんので、引き続きご愛顧のほどお願い申し上げます。',q:'この文章で伝えたいことは何ですか。',opts:['商品の値上げ','新商品の発売','包装材料の変更','工場の移転'],ans:2},
    {level:'n2',text:'「空気を読む」という表現は日本特有のコミュニケーション文化を表している。場の雰囲気を察して適切に振る舞うことが重視されるが、これは外国人にとって理解しにくい概念でもある。近年では、空気を読みすぎることへの弊害も指摘されている。',q:'「空気を読む」について述べられていないことはどれですか。',opts:['日本特有の文化である','外国人には難しい','弊害も指摘されている','若者には必要ない'],ans:3},

    // ── N1 ──
    {level:'n1',text:'言語は単なるコミュニケーションの手段ではなく、その民族の世界観や価値観を映し出す鏡でもある。例えば、日本語には自然現象を表す語彙が豊富であり、これは日本人が四季の変化に敏感であることと無関係ではないだろう。言語を学ぶということは、異なる世界の見方を獲得することに他ならない。',q:'筆者の主張として最も適切なものはどれですか。',opts:['日本語は世界で最も難しい言語だ','言語学習は文化や世界観の理解につながる','自然現象の語彙は不要だ','コミュニケーション手段は言語だけだ'],ans:1},
    {level:'n1',text:'現代社会において、情報の真偽を見極める力、いわゆるメディアリテラシーの重要性が増している。SNSの普及により、誰もが情報の発信者となりうる時代において、根拠のない情報が瞬時に拡散される危険性がある。我々は受け取った情報を鵜呑みにせず、複数の情報源を比較検討する姿勢が求められている。',q:'筆者が最も伝えたいことは何ですか。',opts:['SNSを使うべきではない','情報は一つの情報源で十分だ','情報を批判的に検証する力が必要だ','メディアは信頼できない'],ans:2},
    {level:'n1',text:'日本の伝統芸能である能は、室町時代に観阿弥・世阿弥父子によって大成された。能の特徴は、最小限の動きと象徴的な表現によって深い感情を表現する点にある。世阿弥が著した「花伝書」には、芸術論のみならず、人生哲学ともいえる深遠な思想が記されており、現代のビジネスにも通じる教訓が含まれている。',q:'「花伝書」について述べられていることはどれですか。',opts:['能の歴史だけが書かれている','芸術論と人生哲学が含まれている','室町時代の政治について書かれている','現代には関係がない'],ans:1},
    {level:'n1',text:'持続可能な開発目標（SDGs）の達成に向けて、企業の果たすべき役割は大きい。利益の追求のみならず、環境保全や社会貢献を経営戦略に組み込むことが、長期的な企業価値の向上につながるとの認識が広まっている。いわゆるESG投資の拡大は、こうした意識変革を如実に物語っている。',q:'ESG投資の拡大は何を示していますか。',opts:['企業の利益が増加したこと','環境問題が解決したこと','社会的責任への意識が変わったこと','政府の規制が厳しくなったこと'],ans:2},
  ];

  // ── Sentence templates for 文脈規定 ──
  const CONTEXT_TEMPLATES = {
    n5: [
      {s:'毎日＿＿を飲みます。',filter:c=>c==='名',category:'飲食'},
      {s:'＿＿に友達と会います。',filter:c=>c==='名',category:'時間'},
      {s:'＿＿で日本語を勉強します。',filter:c=>c==='名',category:'場所'},
      {s:'天気が＿＿です。',filter:c=>c==='い形'||c==='な形',category:'天気'},
      {s:'この本は＿＿です。',filter:c=>c==='い形'||c==='な形',category:'形容'},
    ],
    n4: [
      {s:'試験に＿＿ように、毎日勉強している。',filter:c=>c==='動',category:'動詞'},
      {s:'先生に＿＿と言われた。',filter:c=>c==='動',category:'動詞'},
      {s:'＿＿のに、とても高い。',filter:c=>c==='い形'||c==='な形',category:'形容'},
      {s:'＿＿ために、早起きしました。',filter:c=>c==='名'||c==='動',category:'目的'},
    ],
    n3: [
      {s:'彼は＿＿として知られている。',filter:c=>c==='名',category:'身分'},
      {s:'この問題＿＿、調査を行った。',filter:c=>c==='名',category:'主題'},
      {s:'経験＿＿、この仕事は難しい。',filter:c=>c==='名',category:'判断'},
      {s:'天気が＿＿ので、出かけましょう。',filter:c=>c==='い形'||c==='な形',category:'天気'},
    ],
    n2: [
      {s:'環境問題は＿＿にわたって議論されてきた。',filter:c=>c==='名',category:'時間'},
      {s:'＿＿に関する報告書を提出した。',filter:c=>c==='名',category:'主題'},
      {s:'彼女は努力した＿＿、合格した。',filter:c=>c==='名',category:'結果'},
    ],
    n1: [
      {s:'この法案は長年の議論＿＿、成立した。',filter:c=>c==='名',category:'経過'},
      {s:'経済危機を＿＿として、社会が変化した。',filter:c=>c==='名',category:'契機'},
    ],
  };

  // ── Usage sentences for 用法 (Q type 4) ──
  function generateUsageSentences(word, vocabData) {
    // Return 4 sentences: one correct usage, 3 incorrect
    const w = word.w;
    const m = word.m;
    // We'll pick 3 wrong words and make sentences that don't fit
    const wrongs = vocabData.filter(d => d.w !== w && d.c === word.c)
      .sort(() => Math.random() - 0.5).slice(0, 3);

    const correctSentence = makeUsageSentence(word, true);
    const wrongSentences = wrongs.map(wr => makeUsageSentence(wr, false, w));

    const all = [
      { text: correctSentence, correct: true },
      ...wrongSentences.map(s => ({ text: s, correct: false }))
    ].sort(() => Math.random() - 0.5);

    return { sentences: all, correctIdx: all.findIndex(a => a.correct) };
  }

  function makeUsageSentence(word, isCorrect, replaceWith) {
    const templates = {
      '名': ['{w}はとても大切です。', '昨日{w}を見ました。', '{w}が好きです。', '{w}について話しました。'],
      '動': ['{w}ことが大好きです。', '毎日{w}ています。', 'もっと{w}たいです。'],
      'い形': ['この部屋は{w}です。', 'とても{w}料理でした。', '{w}天気ですね。'],
      'な形': ['彼女は{w}な人です。', 'この町は{w}です。', '{w}な場所に行きたい。'],
      '副': ['{w}勉強しました。', '{w}歩きます。'],
    };
    const cat = word.c || '名';
    const t = templates[cat] || templates['名'];
    const tmpl = t[Math.floor(Math.random() * t.length)];
    const w = isCorrect ? word.w : (replaceWith || word.w);
    return tmpl.replace('{w}', '<u>' + w + '</u>');
  }

  // ── Helper: get vocab data ──
  function getVocab(lv) {
    if (lv === 'n5') return typeof VOCAB_N5 !== 'undefined' ? VOCAB_N5 : [];
    if (lv === 'n4') return typeof VOCAB_N4 !== 'undefined' ? VOCAB_N4 : [];
    if (lv === 'n3') return typeof VOCAB_N3 !== 'undefined' ? VOCAB_N3 : [];
    if (lv === 'n2') return typeof VOCAB_N2 !== 'undefined' ? VOCAB_N2 : [];
    if (lv === 'n1') return typeof VOCAB_N1 !== 'undefined' ? VOCAB_N1 : [];
    return [];
  }

  function getGrammar(lv) {
    if (lv === 'n5') return typeof N5 !== 'undefined' ? N5 : [];
    if (lv === 'n4') return typeof N4 !== 'undefined' ? N4 : [];
    if (lv === 'n3') return typeof N3 !== 'undefined' ? N3 : [];
    if (lv === 'n2') return typeof N2 !== 'undefined' ? N2 : [];
    if (lv === 'n1') return typeof N1 !== 'undefined' ? N1 : [];
    return [];
  }

  function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

  // ── Start: level selection UI ──
  function start() {
    const box = document.getElementById('quizBox');
    const history = getHistory();
    let histHTML = '';
    if (history.length) {
      const last3 = history.slice(-3).reverse();
      histHTML = '<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--bd)"><div style="font-size:12px;color:var(--tx2);font-weight:600;margin-bottom:6px">最近成績</div>';
      last3.forEach(h => {
        const pct = Math.round(h.totalScore / h.totalQuestions * 100);
        const cls = pct >= 60 ? 'good' : 'bad';
        const date = new Date(h.date).toLocaleDateString('zh-TW', {month:'short',day:'numeric'});
        histHTML += '<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;color:var(--tx)">' +
          '<span>' + date + ' ' + h.level.toUpperCase() + '</span>' +
          '<span style="color:var(--' + (cls === 'good' ? 'correct-tx' : 'wrong-tx') + ')">' + h.totalScore + '/' + h.totalQuestions + ' (' + pct + '%)</span></div>';
      });
      histHTML += '</div>';
    }

    box.innerHTML =
      '<h3 style="margin-bottom:8px">JLPT 模擬考</h3>' +
      '<div style="font-size:12px;color:var(--tx2);margin-bottom:12px">模擬真實 JLPT 考試，含文字語彙 + 文法讀解兩大部分</div>' +
      '<div class="qf"><label>級別</label><div class="qo" id="meLevel">' +
        '<button data-v="n5">N5</button><button data-v="n4">N4</button>' +
        '<button class="on" data-v="n3">N3</button><button data-v="n2">N2</button><button data-v="n1">N1</button>' +
      '</div></div>' +
      '<div style="background:var(--bg3);border-radius:8px;padding:12px;margin:12px 0;font-size:12px;color:var(--tx2);line-height:1.6">' +
        '<div style="font-weight:600;color:var(--tx);margin-bottom:4px">考試結構</div>' +
        '<div>第一部分：文字・語彙 — 25 題 / 15 分鐘</div>' +
        '<div>第二部分：文法・讀解 — 25 題 / 25 分鐘</div>' +
        '<div style="margin-top:4px;color:var(--ac)">合格基準：總分 60% 以上</div>' +
      '</div>' +
      '<button class="qstart" onclick="MockExam.beginExam()">開始模擬考</button>' +
      '<button class="qclose" onclick="MockExam.close()">取消</button>' +
      histHTML;

    box.querySelectorAll('.qo').forEach(g => {
      g.querySelectorAll('button').forEach(b => {
        b.onclick = () => { g.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); };
      });
    });
    document.getElementById('quizBg').classList.add('show');
  }

  // ── Begin exam ──
  function beginExam() {
    examLevel = document.querySelector('#meLevel .on').dataset.v;
    const vocab = getVocab(examLevel);
    const grammar = getGrammar(examLevel);

    if (!vocab.length || vocab.length < 10) {
      alert('此級別單字資料不足，無法生成模擬考'); return;
    }

    sections = [];
    currentSection = 0;
    currentQ = 0;
    answers = [];

    // Generate both sections
    sections.push(generateVocabSection(examLevel, vocab));
    sections.push(generateGrammarSection(examLevel, grammar, vocab));

    // Start section 1
    startSection();
  }

  // ── Generate vocab section (25 questions) ──
  function generateVocabSection(level, vocab) {
    const questions = [];
    const kanjiWords = vocab.filter(v => v.w !== v.r);
    const allWords = shuffle(vocab);

    // Type 1: 漢字讀音 (7 questions)
    const t1words = shuffle(kanjiWords).slice(0, 7);
    t1words.forEach(word => {
      const wrongs = shuffle(kanjiWords.filter(w => w.r !== word.r))
        .slice(0, 3).map(w => w.r);
      const opts = shuffle([word.r, ...wrongs]);
      questions.push({
        type: 1,
        typeName: '漢字讀音',
        prompt: '以下劃線單字的讀音是什麼？',
        display: '<span style="font-size:28px;font-weight:700"><u>' + word.w + '</u></span>',
        options: opts,
        correctIdx: opts.indexOf(word.r),
        word: word,
      });
    });

    // Type 2: 文脈規定 (7 questions)
    const t2words = shuffle(allWords).slice(0, 7);
    t2words.forEach(word => {
      const templates = CONTEXT_TEMPLATES[level] || CONTEXT_TEMPLATES.n3;
      const tmpl = templates[Math.floor(Math.random() * templates.length)];
      const wrongs = shuffle(vocab.filter(w => w.w !== word.w && w.m !== word.m))
        .slice(0, 3).map(w => w.w);
      const opts = shuffle([word.w, ...wrongs]);
      questions.push({
        type: 2,
        typeName: '文脈規定',
        prompt: '選出最適合填入＿＿的詞語',
        display: '<div style="font-size:16px;line-height:1.8">' + tmpl.s + '</div><div style="font-size:13px;color:var(--tx2);margin-top:4px">正確答案的意思：' + word.m + '</div>',
        options: opts,
        correctIdx: opts.indexOf(word.w),
        word: word,
      });
    });

    // Type 3: 言い換え (6 questions)
    const t3words = shuffle(allWords).slice(0, 6);
    t3words.forEach(word => {
      const wrongs = shuffle(vocab.filter(w => w.m !== word.m))
        .slice(0, 3).map(w => w.m);
      const opts = shuffle([word.m, ...wrongs]);
      questions.push({
        type: 3,
        typeName: '言い換え',
        prompt: '以下劃線部分的意思是什麼？',
        display: '<div style="font-size:16px;line-height:1.8">「<u>' + word.w + '</u>」的意思最接近哪個選項？</div>' +
          (word.w !== word.r ? '<div style="font-size:13px;color:var(--tx2)">讀音：' + word.r + '</div>' : ''),
        options: opts,
        correctIdx: opts.indexOf(word.m),
        word: word,
      });
    });

    // Type 4: 用法 (5 questions)
    const t4words = shuffle(allWords).slice(0, 5);
    t4words.forEach(word => {
      const usage = generateUsageSentences(word, vocab);
      questions.push({
        type: 4,
        typeName: '用法',
        prompt: '以下哪個句子中「' + word.w + '」（' + word.m + '）的用法正確？',
        display: '',
        options: usage.sentences.map(s => s.text),
        correctIdx: usage.correctIdx,
        word: word,
        isHTML: true,
      });
    });

    return {
      name: '文字・語彙',
      timeLimit: 15 * 60 * 1000,
      questions: shuffle(questions),
    };
  }

  // ── Generate grammar section (25 questions) ──
  function generateGrammarSection(level, grammar, vocab) {
    const questions = [];

    // Type 5: 文法形式判斷 (10 questions)
    if (grammar.length >= 4) {
      const t5items = shuffle(grammar).slice(0, 10);
      t5items.forEach(item => {
        const ex = item.eg && item.eg[0] ? item.eg[0] : null;
        if (!ex) return;
        // Strip <em> tags to get pattern, then create blank
        const pattern = item.t.replace(/^～/g, '').replace(/～$/g, '');
        const sentence = ex.j.replace(/<em>/g, '').replace(/<\/em>/g, '');
        // Create blank by removing the grammar pattern
        const blankSentence = sentence.replace(new RegExp(escapeRegex(pattern.replace(/～/g, '.*?')), 'g'), '＿＿') || sentence;

        const wrongs = shuffle(grammar.filter(g => g.t !== item.t))
          .slice(0, 3).map(g => g.t);
        const opts = shuffle([item.t, ...wrongs]);

        questions.push({
          type: 5,
          typeName: '文法形式判斷',
          prompt: '選出最適合填入＿＿的文法',
          display: '<div style="font-size:15px;line-height:1.8">' + highlightBlank(blankSentence) + '</div>' +
            '<div style="font-size:12px;color:var(--tx2);margin-top:4px">(' + ex.z + ')</div>',
          options: opts,
          correctIdx: opts.indexOf(item.t),
          grammar: item,
        });
      });
    }

    // Type 6: 文の組み立て (8 questions)
    if (grammar.length >= 4) {
      const t6items = shuffle(grammar.filter(g => g.eg && g.eg.length > 0)).slice(0, 8);
      t6items.forEach(item => {
        const ex = item.eg[Math.floor(Math.random() * item.eg.length)];
        const sentence = ex.j.replace(/<em>/g, '').replace(/<\/em>/g, '');
        // Split into fragments
        const fragments = splitSentence(sentence);
        if (fragments.length < 2) return;

        const correctOrder = fragments.join('');
        const shuffledFrags = shuffle(fragments);
        // Generate 3 wrong arrangements
        const arrangements = [fragments.join('')];
        for (let i = 0; i < 10 && arrangements.length < 4; i++) {
          const attempt = shuffle(fragments).join('');
          if (!arrangements.includes(attempt)) arrangements.push(attempt);
        }
        // If not enough wrong arrangements, fill with modified versions
        while (arrangements.length < 4) {
          arrangements.push(shuffle(fragments).join(''));
        }
        const opts = shuffle(arrangements);
        questions.push({
          type: 6,
          typeName: '文の組み立て',
          prompt: '將以下片段排列成正確的句子',
          display: '<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:8px 0">' +
            shuffledFrags.map(f => '<span style="padding:4px 10px;background:var(--bg3);border:1px solid var(--bd);border-radius:6px;font-size:14px">' + f + '</span>').join('') +
            '</div><div style="font-size:12px;color:var(--tx2);margin-top:4px">(' + ex.z + ')</div>',
          options: opts,
          correctIdx: opts.indexOf(correctOrder),
          grammar: item,
        });
      });
    }

    // Type 7: 短文讀解 (7 questions)
    const levelPassages = PASSAGES.filter(p => p.level === level);
    const extraPassages = PASSAGES.filter(p => {
      const levels = ['n5', 'n4', 'n3', 'n2', 'n1'];
      const li = levels.indexOf(level);
      const pi = levels.indexOf(p.level);
      return Math.abs(li - pi) <= 1 && p.level !== level;
    });
    const passagePool = shuffle([...levelPassages, ...shuffle(extraPassages).slice(0, 3)]);
    const selectedPassages = passagePool.slice(0, Math.min(7, passagePool.length));

    selectedPassages.forEach(p => {
      questions.push({
        type: 7,
        typeName: '短文讀解',
        prompt: '閱讀以下短文，回答問題',
        display: '<div style="background:var(--bg3);padding:12px;border-radius:8px;font-size:14px;line-height:1.8;margin-bottom:10px;white-space:pre-wrap">' + p.text + '</div>' +
          '<div style="font-size:14px;font-weight:600;color:var(--tx)">' + p.q + '</div>',
        options: p.opts,
        correctIdx: p.ans,
      });
    });

    // Fill remaining if needed (ensure 25 total)
    while (questions.length < 25 && grammar.length >= 4) {
      const item = grammar[Math.floor(Math.random() * grammar.length)];
      const wrongs = shuffle(grammar.filter(g => g.t !== item.t)).slice(0, 3).map(g => g.t);
      const opts = shuffle([item.t, ...wrongs]);
      questions.push({
        type: 5,
        typeName: '文法形式判斷',
        prompt: '以下哪個文法的意思是「' + item.ex.substring(0, 15) + '...」？',
        display: '<div style="font-size:14px;line-height:1.8">' + item.ex + '</div>' +
          '<div style="font-size:12px;color:var(--tx2);margin-top:4px">接続：' + item.p + '</div>',
        options: opts,
        correctIdx: opts.indexOf(item.t),
        grammar: item,
      });
    }

    return {
      name: '文法・讀解',
      timeLimit: 25 * 60 * 1000,
      questions: shuffle(questions).slice(0, 25),
    };
  }

  // ── Utility ──
  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function highlightBlank(s) {
    return s.replace(/＿＿/g, '<span style="display:inline-block;width:60px;border-bottom:2px solid var(--ac2);margin:0 2px">&nbsp;</span>');
  }

  function splitSentence(s) {
    // Split a Japanese sentence into 3-4 roughly equal parts
    const len = s.length;
    if (len < 6) return [s];
    const partSize = Math.ceil(len / 4);
    const parts = [];
    // Try splitting at natural points (particles, etc.)
    const breakPoints = ['、', 'は', 'が', 'を', 'に', 'で', 'と', 'も', 'の'];
    let start = 0;
    let partCount = 0;
    const targetParts = Math.min(4, Math.max(2, Math.floor(len / 4)));

    for (let i = partSize; i < len && partCount < targetParts - 1; i++) {
      if (breakPoints.includes(s[i]) || i - start >= partSize + 2) {
        parts.push(s.substring(start, i + 1));
        start = i + 1;
        partCount++;
        i = start + partSize - 1;
      }
    }
    if (start < len) parts.push(s.substring(start));
    return parts.length >= 2 ? parts : [s.substring(0, Math.floor(len / 2)), s.substring(Math.floor(len / 2))];
  }

  // ── Section control ──
  function startSection() {
    const section = sections[currentSection];
    currentQ = 0;
    if (!answers[currentSection]) answers[currentSection] = new Array(section.questions.length).fill(null);
    sectionStart = Date.now();
    sectionTimeLimit = section.timeLimit;

    // Show section intro
    showSectionIntro();
  }

  function showSectionIntro() {
    const section = sections[currentSection];
    const box = document.getElementById('quizBox');
    const sectionNum = currentSection + 1;
    const totalSections = sections.length;
    const mins = Math.round(section.timeLimit / 60000);

    box.innerHTML =
      '<div style="text-align:center;padding:20px 0">' +
        '<div style="font-size:12px;color:var(--tx2);margin-bottom:8px">JLPT ' + examLevel.toUpperCase() + ' 模擬考</div>' +
        '<div style="font-size:32px;font-weight:700;margin:12px 0;color:var(--tx)">第 ' + sectionNum + ' 部分</div>' +
        '<div style="font-size:20px;font-weight:600;color:var(--ac2);margin-bottom:8px">' + section.name + '</div>' +
        '<div style="font-size:14px;color:var(--tx2);margin-bottom:16px">' + section.questions.length + ' 題 ／ ' + mins + ' 分鐘</div>' +
        '<div style="background:var(--bg3);border-radius:8px;padding:12px;margin:16px 0;font-size:13px;color:var(--tx2);text-align:left;line-height:1.7">' +
          getQuestionTypeSummary(section) +
        '</div>' +
        '<button class="qstart" onclick="MockExam.startTimer()">開始作答</button>' +
        (currentSection > 0 ? '' : '<button class="qclose" onclick="MockExam.close()">放棄</button>') +
      '</div>';
  }

  function getQuestionTypeSummary(section) {
    const types = {};
    section.questions.forEach(q => {
      if (!types[q.typeName]) types[q.typeName] = 0;
      types[q.typeName]++;
    });
    return Object.entries(types).map(([name, count]) => '・' + name + '：' + count + ' 題').join('<br>');
  }

  function startTimer() {
    startTime = Date.now();
    renderQuestion();
    timerInterval = setInterval(updateTimer, 1000);
  }

  function updateTimer() {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, sectionTimeLimit - elapsed);
    const timerEl = document.getElementById('meTimer');
    if (timerEl) {
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      timerEl.textContent = m + ':' + (s < 10 ? '0' : '') + s;

      // Warn when < 2 minutes
      if (remaining < 120000) timerEl.style.color = 'var(--wrong-bd)';
      else if (remaining < 300000) timerEl.style.color = 'var(--ok-tx)';
    }

    // Time's up
    if (remaining <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      // Auto-submit remaining as wrong
      const section = sections[currentSection];
      for (let i = 0; i < section.questions.length; i++) {
        if (answers[currentSection][i] === null) {
          answers[currentSection][i] = -1; // unanswered
        }
      }
      if (currentSection < sections.length - 1) {
        currentSection++;
        startSection();
      } else {
        showResults();
      }
    }
  }

  // ── Render question ──
  function renderQuestion() {
    const section = sections[currentSection];
    const q = section.questions[currentQ];
    const box = document.getElementById('quizBox');
    const total = section.questions.length;
    const answered = answers[currentSection].filter(a => a !== null).length;

    // Progress bar
    const pct = Math.round((currentQ) / total * 100);

    box.innerHTML =
      // Header
      '<div class="qhd" style="align-items:center">' +
        '<span style="font-weight:600">' + section.name + '</span>' +
        '<span id="meTimer" style="font-weight:700;font-size:15px;font-variant-numeric:tabular-nums">--:--</span>' +
        '<button class="qclose" style="width:auto;margin:0;padding:2px 10px" onclick="MockExam.close()">✕</button>' +
      '</div>' +
      // Progress bar
      '<div style="height:4px;background:var(--prog-empty);border-radius:2px;margin-bottom:14px;overflow:hidden">' +
        '<div style="height:100%;width:' + pct + '%;background:var(--ac2);border-radius:2px;transition:width .3s"></div>' +
      '</div>' +
      // Question number & type
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
        '<span style="font-size:13px;color:var(--tx2)">' + (currentQ + 1) + ' / ' + total + '</span>' +
        '<span style="font-size:11px;padding:2px 8px;background:var(--bg3);border-radius:4px;color:var(--tx2)">' + q.typeName + '</span>' +
      '</div>' +
      // Prompt
      '<div style="font-size:14px;font-weight:600;color:var(--tx);margin-bottom:10px">' + q.prompt + '</div>' +
      // Display
      (q.display ? '<div style="margin-bottom:14px">' + q.display + '</div>' : '') +
      // Options
      '<div class="qopts" style="grid-template-columns:1fr">' +
        q.options.map((o, i) =>
          '<button class="qopt me-opt" data-idx="' + i + '" onclick="MockExam.answer(' + i + ')"' +
          (q.isHTML ? ' style="text-align:left;font-size:13px;line-height:1.6"' : '') +
          '>' + (q.isHTML ? o : escapeHTML(o)) + '</button>'
        ).join('') +
      '</div>';

    updateTimer();
  }

  function escapeHTML(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── Answer ──
  function answer(idx) {
    const section = sections[currentSection];
    const q = section.questions[currentQ];
    const correct = idx === q.correctIdx;
    answers[currentSection][currentQ] = idx;

    // Highlight correct/wrong
    const opts = document.querySelectorAll('.me-opt');
    opts.forEach((b, i) => {
      b.disabled = true;
      b.style.pointerEvents = 'none';
      if (i === q.correctIdx) b.classList.add('qcorrect');
      if (i === idx && !correct) b.classList.add('qwrong');
    });

    // SRS record for vocab questions
    if (q.word && typeof SRS !== 'undefined' && SRS.record) {
      SRS.record(examLevel, q.word.w, correct);
    }

    setTimeout(() => {
      currentQ++;
      if (currentQ >= section.questions.length) {
        // Section done
        clearInterval(timerInterval);
        timerInterval = null;
        if (currentSection < sections.length - 1) {
          currentSection++;
          startSection();
        } else {
          showResults();
        }
      } else {
        renderQuestion();
      }
    }, correct ? 400 : 900);
  }

  // ── Results ──
  function showResults() {
    clearInterval(timerInterval);
    timerInterval = null;

    const totalTime = Date.now() - sectionStart; // approximate
    const sectionResults = sections.map((section, si) => {
      let correct = 0;
      let unanswered = 0;
      const typeScores = {};
      section.questions.forEach((q, qi) => {
        const ans = answers[si] ? answers[si][qi] : null;
        const isCorrect = ans === q.correctIdx;
        if (isCorrect) correct++;
        if (ans === null || ans === -1) unanswered++;
        const tn = q.typeName;
        if (!typeScores[tn]) typeScores[tn] = { correct: 0, total: 0 };
        typeScores[tn].total++;
        if (isCorrect) typeScores[tn].correct++;
      });
      return {
        name: section.name,
        correct,
        total: section.questions.length,
        unanswered,
        typeScores,
      };
    });

    const totalScore = sectionResults.reduce((a, s) => a + s.correct, 0);
    const totalQuestions = sectionResults.reduce((a, s) => a + s.total, 0);
    const totalPct = Math.round(totalScore / totalQuestions * 100);
    const passed = totalPct >= 60;

    // Also check per-section pass (JLPT requires each section >= baseline)
    const sectionPass = sectionResults.every(s => (s.correct / s.total) >= 0.3);
    const finalPass = passed && sectionPass;

    // Calculate total elapsed time
    const totalElapsed = Date.now() - (startTime || Date.now());
    const mins = Math.floor(totalElapsed / 60000);
    const secs = Math.floor((totalElapsed % 60000) / 1000);
    const timeStr = mins + ':' + (secs < 10 ? '0' : '') + secs;

    // Save to history
    saveHistory({
      date: new Date().toISOString(),
      level: examLevel,
      totalScore,
      totalQuestions,
      sections: sectionResults.map(s => ({ name: s.name, correct: s.correct, total: s.total })),
      timeUsed: timeStr,
      passed: finalPass,
    });

    // Find weak areas
    const weakAreas = [];
    sectionResults.forEach(sr => {
      Object.entries(sr.typeScores).forEach(([type, score]) => {
        if (score.total >= 2 && (score.correct / score.total) < 0.5) {
          weakAreas.push(type);
        }
      });
    });

    // Build result HTML
    const box = document.getElementById('quizBox');
    let html = '<div style="text-align:center;padding:8px 0">' +
      '<div style="font-size:12px;color:var(--tx2)">JLPT ' + examLevel.toUpperCase() + ' 模擬考結果</div>' +
      '<div class="qscore ' + (totalPct >= 80 ? 'good' : totalPct >= 60 ? 'ok' : 'bad') + '" style="font-size:40px">' +
        totalScore + ' / ' + totalQuestions +
      '</div>' +
      '<div style="font-size:14px;color:var(--tx2);margin-bottom:16px">' + totalPct + '%</div>' +
      '</div>';

    // Section breakdown
    html += '<div style="border:1px solid var(--bd);border-radius:8px;overflow:hidden;margin-bottom:14px">';
    sectionResults.forEach(sr => {
      const pct = Math.round(sr.correct / sr.total * 100);
      html += '<div style="display:flex;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--bd);font-size:14px">' +
        '<span style="color:var(--tx)">' + sr.name + '</span>' +
        '<span style="font-weight:600;color:' + (pct >= 60 ? 'var(--correct-tx)' : 'var(--wrong-tx)') + '">' + sr.correct + '/' + sr.total + ' (' + pct + '%)</span>' +
      '</div>';
    });
    html += '<div style="display:flex;justify-content:space-between;padding:10px 14px;font-size:14px;background:var(--bg3)">' +
      '<span style="font-weight:600;color:var(--tx)">用時</span>' +
      '<span style="color:var(--tx2)">' + timeStr + '</span>' +
    '</div>';
    html += '</div>';

    // Pass/Fail
    html += '<div style="text-align:center;padding:12px;border-radius:8px;margin-bottom:14px;' +
      (finalPass
        ? 'background:var(--correct-bg);color:var(--correct-tx);border:1px solid var(--correct-bd)'
        : 'background:var(--wrong-bg);color:var(--wrong-tx);border:1px solid var(--wrong-bd)') +
      '">' +
      '<div style="font-size:20px;font-weight:700">' + (finalPass ? '合格ライン達成！' : '不合格') + '</div>' +
      '<div style="font-size:12px;margin-top:4px">合格基準：總分 60% 以上 + 各科 30% 以上</div>' +
    '</div>';

    // Weak areas
    if (weakAreas.length) {
      html += '<div style="background:var(--note-bg);color:var(--note-tx);padding:10px 14px;border-radius:8px;margin-bottom:14px;font-size:13px">' +
        '<div style="font-weight:600;margin-bottom:4px">需加強的題型</div>' +
        weakAreas.map(w => '・' + w).join('<br>') +
      '</div>';
    }

    // Type-level breakdown
    html += '<div style="margin-bottom:14px"><div style="font-size:12px;color:var(--tx2);font-weight:600;margin-bottom:6px">各題型成績</div>';
    sectionResults.forEach(sr => {
      Object.entries(sr.typeScores).forEach(([type, score]) => {
        const p = Math.round(score.correct / score.total * 100);
        html += '<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;color:var(--tx)">' +
          '<span>' + type + '</span>' +
          '<span style="color:' + (p >= 60 ? 'var(--correct-tx)' : p >= 40 ? 'var(--ok-tx)' : 'var(--wrong-tx)') + '">' +
            score.correct + '/' + score.total + ' (' + p + '%)</span>' +
        '</div>';
      });
    });
    html += '</div>';

    // Actions
    html += '<div class="qactions">' +
      '<button class="qstart" onclick="MockExam.beginExam()">再考一次</button>' +
      '<button class="qclose" onclick="MockExam.close()">返回</button>' +
    '</div>';

    box.innerHTML = html;
  }

  // ── History ──
  function getHistory() {
    try { return JSON.parse(localStorage.getItem('mock_exam_history')) || []; }
    catch (e) { return []; }
  }

  function saveHistory(result) {
    const h = getHistory();
    h.push(result);
    if (h.length > 100) h.splice(0, h.length - 100);
    localStorage.setItem('mock_exam_history', JSON.stringify(h));
  }

  // ── Close ──
  function close() {
    clearInterval(timerInterval);
    timerInterval = null;
    document.getElementById('quizBg').classList.remove('show');
  }

  return { start, beginExam, startTimer, answer, close };
})();
