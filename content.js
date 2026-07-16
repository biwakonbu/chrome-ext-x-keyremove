/**
 * X (x.com) のキーボードショートカットを無効化するコンテンツスクリプト。
 *
 * 目的:
 *   X は j/k/r/n/m/g+h/Space/./? などのシングルキーショートカットをデフォルトで有効にしている。
 *   これが macSKK をはじめとする IME 入力と競合し、入力がおかしくなったり
 *   ショートカットが誤発火したりする原因になる。
 *
 * 仕組み:
 *   document_start の時点で document 上のキャプチャフェーズに keydown/keypress/keyup
 *   リスナを登録する。キャプチャフェーズ（ターゲット到達前）でイベントを捕捉し、
 *   stopImmediatePropagation() で X 側のリスナ（React ルートにバインドされている）
 *   へ伝播するのを遮断する。
 *
 *   ※ preventDefault() は呼ばない。IME 入力やスクロールなど Chrome 既定の挙動を
 *      壊さないため、伝播だけを止める方針（安全側）。
 *
 *   ※ テキスト入力欄（INPUT / TEXTAREA / contenteditable / role="textbox"）や
 *      IME 変換中（isComposing）のイベントは何もせず通す。これにより通常のタイピング
 *      と日本語入力が阻害されない。
 */

(function () {
  'use strict';

  /**
   * イベントターゲットがテキスト入力可能な要素かどうかを判定する。
   * X の compose box は contenteditable な div で role="textbox" を持つため、
   * これらを包括的にチェックする。
   *
   * @param {EventTarget | null} target
   * @returns {boolean}
   */
  function isEditableTarget(target) {
    if (!(target instanceof Element)) {
      return false;
    }

    // INPUT / TEXTAREA / SELECT は入力欄。ただし type=button など入力ではないものは除外。
    var tag = target.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') {
      return true;
    }
    if (tag === 'INPUT') {
      var type = (target.getAttribute('type') || 'text').toLowerCase();
      // テキスト入力系でなければ入力欄扱いしない（button/submit/checkbox/radio 等）
      var textLike = {
        text: true,
        search: true,
        url: true,
        email: true,
        password: true,
        tel: true,
        number: true
      };
      return textLike[type] === true;
    }

    // contenteditable な要素
    var ce = target.getAttribute('contenteditable');
    if (ce === 'true' || ce === '') {
      return true;
    }

    // ARIA role="textbox"
    if (target.getAttribute('role') === 'textbox') {
      return true;
    }

    // closest で親方向にたどって contenteditable / role=textbox を探す
    // （X は入れ子構造になることがあるため）
    var closest = target.closest('[contenteditable="true"], [contenteditable=""], [role="textbox"]');
    if (closest !== null) {
      return true;
    }

    return false;
  }

  /**
   * 修飾キー等、明らかに文字入力ではないキーかどうか。
   * e.key の長さが 2 以上（"Shift", "ArrowDown", "F1", "Dead" など）のものは
   * シングルキーショートカットの対象になり得ないためそのまま通す。
   *
   * @param {KeyboardEvent} e
   * @returns {boolean} true のときは「通すべき（無効化対象ではない）」
   */
  function isModifierOrSpecialKey(e) {
    // 何らかの修飾キーが押されている場合は X のシングルキーショートカットの対象外。
    // （Ctrl/Cmd を伴う操作は Chrome や OS、ユーザ設定に委ねる）
    if (e.ctrlKey || e.metaKey || e.altKey) {
      return true;
    }
    var key = e.key;
    if (key == null) {
      return false;
    }
    // 長さ 2 以上のキー名（Shift, Control, Alt, Meta, Arrow*, Page*, Home, End,
    // Escape, Enter, Tab, Backspace, Delete, F1..F19, Dead, etc.）は対象外。
    // Shift 単体押下は key==="Shift" でここで弾かれる。
    if (key.length >= 2) {
      return true;
    }
    return false;
  }

  /**
   * メインのハンドラ。キャプチャフェーズでイベントを捕捉し、
   * 必要に応じて X 側への伝播を止める。
   *
   * @param {KeyboardEvent} e
   */
  function handleKeyEvent(e) {
    // 1) IME 変換中のイベントは絶対に通す（macSKK の確定キー等を遮断しない）
    if (e.isComposing) {
      return;
    }
    // keyCode 229 は IME がイベントを処理中であることを示す古い慣習の印。
    if (typeof e.keyCode === 'number' && e.keyCode === 229) {
      return;
    }

    // 2) テキスト入力中はそのまま通す（タイピング・日本語入力を保護）
    if (isEditableTarget(e.target)) {
      return;
    }

    // 3) 修飾キーや特殊キー（Shift/Ctrl/Cmd/矢印/Enter/Tab ...）は X の
    //    シングルキーショートカットではないので通す。
    if (isModifierOrSpecialKey(e)) {
      return;
    }

    // 4) ここに到達した = テキスト入力欄外で押された印字可能な単体キー。
    //    X のショートカット（j/k/r/n/m/./g/Space など）になり得るため、
    //    X 側リスナへの伝播だけを止める。preventDefault は呼ばない。
    e.stopImmediatePropagation();
  }

  // document_start 時点では DOM が未構築だが、document オブジェクト自体は存在する。
  // document をキャプチャフェーズで購読すれば、その後 X が React ルートに
  // バインドする keydown リスナよりも前に捕捉できる。
  var EVENTS = ['keydown', 'keypress', 'keyup'];
  for (var i = 0; i < EVENTS.length; i++) {
    document.addEventListener(EVENTS[i], handleKeyEvent, true /* capture phase */);
  }
})();
