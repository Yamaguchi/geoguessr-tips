# tips-images

Tip記事（`tips/*.md`）に添付する画像の置き場。

## ルール

- 出典はWikimedia CommonsのCCライセンス画像（CC0 / CC BY / CC BY-SA）のみを使う。Google Street View・GeoGuessr自体のスクリーンショットは著作権上使用しない。
- ダウンロード前に対象ファイルのライセンスページで正確なライセンス名・著作者名を確認する。
- ファイル名は`{国や地域}-{内容}.jpg`のような分かりやすいslugにする。
- 容量を抑えるため、長辺800px程度にリサイズしてから配置する（例: `sips -Z 800 <file> --out <file>`）。
- 対応するTipのfrontmatterに`image`（ファイル名のみ）と`image_credit`（著作者名・ライセンス名・"via Wikimedia Commons"を含む表示用クレジット文字列）を必ず設定する。CC BY / CC BY-SA は著作者表示が必須のため省略不可。
