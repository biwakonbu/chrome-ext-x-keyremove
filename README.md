# X Keyboard Shortcut Remover

x.com (旧 Twitter) を Chrome で開いているとき、X がデフォルトで設定しているキーボードショートカット（`j` / `k` / `r` / `n` / `m` / `/` / `g`+`h` / `Space` / `.` など）を**すべて無効化**する Chrome 拡張機能です。

## 目的・背景

- X のシングルキーショートカットが **macSKK をはじめとする IME 入力と競合**し、日本語入力がおかしくなることがあります。
- また通常時でも、意図せずショートカットが発火してタイムラインがスクロール／ジャンプしてしまうことがあります。
- 本拡張は X 側がショートカット用に受け取るキーイベントを遮断し、**Chrome 本来の通常状態**（IME 入力も含めて自然に動く状態）に戻すことを目的とします。

## 特徴

- **テキスト入力欄では何もしない** …… 投稿ボックス（compose box）や検索ボックスでのタイピング・日本語入力（macSKK 等）は干渉されません。
- **IME 変換中（`isComposing`）のイベントは絶対に通す** …… 変換中の確定キー等が誤って遮断されるのを防ぎます。
- **伝播のみを阻止** …… `preventDefault()` は呼ばず、Chrome の既定動作（IME・スクロール等）を壊しません。X 側のリスナへの伝播だけを止めます。
- **Chrome 自体のショートカットには影響しません**（Ctrl/Cmd 系などはそのまま動作します）。

## インストール手順

> 本拡張はストアに公開していないため、ソースから読み込みます。x.com 専用で、他のサイトには影響しません。

1. リポジトリをクローンします。

   ```bash
   git clone https://github.com/biwakonbu/chrome-ext-x-keyremove.git
   ```

2. Chrome で `chrome://extensions` を開きます。
3. 右上の **「デベロッパー モード」** をオンにします。
4. 左上の **「パッケージ化されていない拡張機能を読み込む」** をクリックし、クローンした `chrome-ext-x-keyremove` フォルダ（`manifest.json` がある階層）を選択します。
   - ※フォルダ内の個別ファイルではなく、**フォルダ自体**を選んでください。
5. 拡張一覧に **「X Keyboard Shortcut Remover」** が表示されれば完了です。x.com を開く（または開いているタブを再読み込みする）と有効になります。

### アップデート時

`git pull` で最新版を取得したあと、`chrome://extensions` で該当拡張の **更新ボタン（↻）** を押してください。

### アイコンを自分で再生成したい場合

`icons/generate_icons.py` を実行すると 3 サイズの PNG を再生成できます（要 Pillow）。

```bash
python3 icons/generate_icons.py
```

## 動作確認

x.com を開いた状態で以下を確認します。

- [x] タイムライン上で `j` / `k` を押しても次/前のツイートへ移動しない。
- [x] `r` でリプライ画面、`n` で新規ツイート画面、`/` で検索が開かない。
- [x] `Space` でページが大きくスクロールしない（ブラウザ本来のスクロール挙動になる）。
- [x] 投稿ボックスや検索ボックスにフォーカスすれば、**macSKK で正常に日本語入力できる**。
- [x] `Ctrl` / `Cmd` を伴うショートカット（`Cmd+R` の再読み込みなど）は通常通り動く。

## 仕組み

1. `manifest.json` の `content_scripts` を `run_at: "document_start"` で登録し、X 側スクリプトより先にリスナを仕込みます。
2. `document` 上の **キャプチャフェーズ**（`addEventListener` 第3引数 `true`）で `keydown` / `keypress` / `keyup` を購読します。キャプチャフェーズはターゲット到達前に発火するため、X が React ルートにバインドしたリスナより先に捕捉できます。
3. ハンドラ内で以下を順に判定します。
   - `isComposing`（IME 変換中）→ 通す
   - テキスト入力欄（`INPUT` / `TEXTAREA` / `contenteditable` / `role="textbox"`）→ 通す
   - 修飾キーや特殊キー（Shift/Ctrl/Cmd/矢印/Enter/Tab/F1...）→ 通す
   - 上記以外の印字可能な単体キー → **`stopImmediatePropagation()` で伝播のみ阻止**
4. `preventDefault()` は呼ばないため、Chrome 本来の挙動（IME 入力や通常スクロール）は保たれます。

## 制限事項

- X が今後ショートカットの実装（リスナの登録先やイベント種別）を変更した場合、うまく遮断できなくなる可能性があります。その場合は `content.js` の調整で対応できます。
- 本拡張は「X のショートカット無効化」が目的であり、Chrome 自体や OS のショートカットには影響しません。

## ファイル構成

```
chrome-ext-x-keyremove/
├── manifest.json            # 拡張の定義（Manifest V3 / x.com のみ対象）
├── content.js               # キーイベント遮断の本体
├── icons/
│   ├── icon16.png           # 拡張アイコン（16x16）
│   ├── icon48.png           # 拡張アイコン（48x48）
│   ├── icon128.png          # 拡張アイコン（128x128）
│   └── generate_icons.py    # アイコン再生成スクリプト（要 Pillow）
└── README.md                # このファイル
```
