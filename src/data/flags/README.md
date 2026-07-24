# flags

出典: [flag-icons](https://github.com/lipis/flag-icons)（npm配布, MIT License, v7.5.0時点）

`flags/4x3/*.svg` のうち、`world-110m.json` に含まれる国に対応するファイルのみを抽出している。
ファイル名はISO 3166-1 alpha-2コード（小文字）+ `.svg`。Kosovo (`xk`) など、flag-iconsが独自に採番している非公式コードもそのまま利用している。

SVG実体は`public/flags/`に配置している（Viteのバンドル対象外にして、JSにインライン化されず
静的ファイルとして配信されるようにするため）。このディレクトリの`manifest.json`はメタデータのみを保持する。

## manifest.json

`world-110m.json` の各Featureに対して、対応する国旗ファイル名（`public/flags/`配下）を紐づけたインデックス。

```json
{
  "name_ja": "日本",
  "name": "Japan",
  "iso_a2": "JP",
  "flag": "jp.svg"
}
```

- `iso_a2`: `world-110m.json` 上の値（そのまま）。
- `flag`: 対応する国旗ファイル名。`flags/` 配下の同名ファイルを参照する。該当なしは`null`。

## 既知の欠落・補正

- `world-110m.json` は Norway・France・Kosovo の `iso_a2` が `-99`（Natural Earthのプレースホルダ）、
  中華民国（Taiwan）が `CN-TW` という独自コードになっているため、`name_ja` をキーに実コード
  （`no` / `fr` / `xk` / `tw`）へ補正してから国旗を割り当てている。
- 以下2件はISO 3166-1に正式なコードがない未承認国家のため、対応する国旗ファイルが存在しない
  （`manifest.json` 上は `flag: null`）。
  - ソマリランド
  - 北キプロス・トルコ共和国
