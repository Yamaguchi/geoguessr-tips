# world-110m.json

出典: [Natural Earth](https://www.naturalearthdata.com/) 110m Admin 0 – Countries
（[nvkelso/natural-earth-vector](https://github.com/nvkelso/natural-earth-vector) 配布のGeoJSON、パブリックドメイン）

`name` / `name_ja` / `iso_a2` / `iso_a3` / `continent` プロパティとgeometryのみを抽出して軽量化している。

国別Tipsデータ（`flags/`・`domains.json`）は、いずれもこのファイルの`name_ja`（177件、重複なし）をキーに紐付けている。

# flags/

出典: [flag-icons](https://github.com/lipis/flag-icons)（npm配布, MIT License）。詳細は`flags/README.md`参照。
SVG本体は`public/flags/`にあり、ここには`manifest.json`（メタデータ）のみを置いている。

# domains.json

各国のccTLD（国別コードトップレベルドメイン）一覧。

出典: [トップレベルドメイン一覧 - Wikipedia](https://ja.wikipedia.org/wiki/%E3%83%88%E3%83%83%E3%83%97%E3%83%AC%E3%83%99%E3%83%AB%E3%83%89%E3%83%A1%E3%82%A4%E3%83%B3%E4%B8%80%E8%A6%A7)
「国別コードトップレベルドメイン」節（2026-07-25取得）のwikitextをパースして生成した。

```json
{
  "name_ja": "イギリス",
  "name": "United Kingdom",
  "iso_a2": "GB",
  "tld": [".gb", ".uk"]
}
```

- `tld`: 配列。イギリスの`.gb`/`.uk`のように1国に複数のccTLDが割り当てられている場合がある。
- Wikipedia側の国名表記（英語, `{{flag|...}}`テンプレートの引数）は`world-110m.json`の`name`と
  完全一致しないことがあるため、取得スクリプト内でエイリアス変換して突き合わせている
  （例: `Czech Republic`→`Czechia`, `Republic of Korea`→`South Korea`）。
- `.tp`（東ティモールの旧コード。2015年に無効化）、`.su`（ソビエト連邦の旧コード）、
  `.krd`（クルディスタン。国家ではなく地域）は対象外とした。
- `world-110m.json`に含まれる177件中174件が対応。以下3件はccTLD自体が存在しないため未掲載
  （`manifest`のような`null`フィールドは持たず、単純にエントリが存在しない）。
  - コソボ共和国（ccTLD未割当）
  - 北キプロス・トルコ共和国（未承認国家）
  - ソマリランド（未承認国家）
- Andorra・Malta・Singapore・Vatican Cityなど、`world-110m.json`（110m解像度）に
  そもそも含まれない小国・属領のccTLDは対象外。
