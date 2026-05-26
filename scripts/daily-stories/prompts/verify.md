你是 JLPT N{LEVEL} 嚴格考官。下面是一篇給 N{LEVEL} 學習者的短文。檢查 6 條,任一條不過就 fail。

【文章】
{STORY_JSON}

【目標 20 詞】
{VOCAB_LIST}

【檢查清單】
1. **20 詞全用到** — 列出沒用到的詞(部分匹配也算用到,例如「人」在「男の人」裡算)
2. **文法不超 N{LEVEL}** — 列出疑似超綱的句型 / 詞彙
3. **「方」用法** — 是敬語量詞嗎?有沒有被誤用為「方面」?
4. **連貫性** — 前後句意接得上嗎?有沒有答非所問?
5. **中譯準確自然** — 列出可改善的譯句(過於直譯/有錯誤)
6. **N{LEVEL} 看得懂** — 漢字 / 句型 / 主題是否適合該級別

【輸出格式】嚴格 JSON,**只輸出 JSON 物件不要任何包裹**:
{
  "pass": true | false,
  "missing_vocab": ["..."],
  "grammar_issues": ["..."],
  "fang_issue": "" | "說明 '方' 怎麼錯了",
  "coherence_issue": "" | "說明哪句答非所問",
  "translation_issues": ["..."],
  "level_issues": ["..."],
  "suggested_fix": "" | "如果 pass=false,具體建議怎麼改"
}

只要 missing_vocab 不為空 OR 任一 issue 有內容 → pass=false。
