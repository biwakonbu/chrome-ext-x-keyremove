/**
 * X (x.com) のキーボードショートカットを無効化するコンテンツスクリプト。
 *
 * 目的:
 *   X は j/k/r/n/m/g+h/Space/./? などのシングルキーショートカットをデフォルトで有効にしている。
 *   これが macSKK をはじめとする IME 入力と競合し、入力がおかしくなったり
 *   ショートカットが誤発火したりする原因になる。
 *
 * 仕組み:
 *   document_start の時点で window 上のキャプチャフェーズに keydown リスナを登録する。
 *   キャプチャフェーズ（ターゲット到達前）の最上流でイベントを捕捉し、
 *   stopImmediatePropagation() で X 側のリスナ（React ルートにバインドされている）へ
 *   伝播するのを遮断する。
 *
 * 安全性の担保（最重要）:
 *   入力中（IME 変換中・テキスト入力欄にフォーカス中）のキーイベントは一切遮断しない。
 *   誤ってエディタのキーイベントを止めると、IME の composition が破綻して
 *   「入力中のバッファが全部展開される」「選択範囲の削除が壊れる」などの深刻な不具合に
 *   つながるため、編集中かどうかを複数の信号で多重に判定する。
 *
 *   ※ preventDefault() は呼ばない。IME 入力やスクロールなど Chrome 既定の挙動を
 *      壊さないため、伝播だけを止める方針（安全側）。
 */

(function () {
  'use strict';

  /**
   * テキスト入力系の INPUT type かどうか。
   * @param {HTMLInputElement} el
   * @returns {boolean}
   */
  function isTextInputType(el) {
    var type = (el.type || 'text').toLowerCase();
    return (
      type === 'text' ||
      type === 'search' ||
      type === 'url' ||
      type === 'email' ||
      type === 'password' ||
      type === 'tel' ||
      type === 'number' ||
      type === 'date' ||
      type === 'datetime-local' ||
      type === 'month' ||
      type === 'time' ||
      type === 'week' ||
      type === ''
    );
  }

  /**
   * 要素が編集可能（テキスト入力欄）かどうかを判定する。
   *
   * 重要: contenteditable の検出には属性文字列比較（="true" / =""）ではなく
   * DOM プロパティ element.isContentEditable を使う。
   * これにより contenteditable="plaintext-only" や、値のバリエーション違い
   * （X / DraftJS のエディタで使われる）も正しく「編集中」と判定できる。
   * また祖先が contenteditable な場合も isContentEditable が true になるため、
   * エディタ内の子要素が target になったケースも取りこぼさない。
   *
   * @param {EventTarget | null} el
   * @returns {boolean}
   */
  function isEditableElement(el) {
    if (!(el instanceof Element)) {
      return false;
    }

    // contenteditable 系（true / plaintext-only / designMode 含む）。
    // 属性値によらず DOM が正しく判定してくれるため、これが最も確実。
    if (el.isContentEditable) {
      return true;
    }

    var tag = el.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') {
      return true;
    }
    if (tag === 'INPUT') {
      // テキスト入力系でなければ入力欄扱いしない（button/submit/checkbox/radio 等）
      return isTextInputType(/** @type {HTMLInputElement} */ (el));
    }

    // ARIA の編集系 role の念のためのフォールバック
    var role = el.getAttribute && el.getAttribute('role');
    if (role === 'textbox' || role === 'searchbox' || role === 'combobox') {
      return true;
    }

    return false;
  }

  /**
   * 現在「編集中」とみなせるかを複数の信号で判定する（多重ガード）。
   * いずれか一つでも編集中を示せば true を返す（安全側に倒す）。
   *
   * @param {KeyboardEvent} e
   * @returns {boolean} true のときはイベントを絶対に遮断してはいけない
   */
  function isEditingContext(e) {
    // 1) IME 変換中（composition）のイベントは絶対に通す。
    //    macSKK 等で composition 系の DOM イベントが飛んでいる間は isComposing が true になる。
    if (e.isComposing) {
      return true;
    }
    // keyCode 229 は IME がイベントを処理中であることを示す古い慣習の印。
    if (typeof e.keyCode === 'number' && e.keyCode === 229) {
      return true;
    }

    // 2) イベントの実ターゲットが編集可能要素なら通す。
    //    Shadow DOM 内の要素がターゲットの場合、window/document レベルでは
    //    e.target がシャドウホストに retarget されて編集判定を取りこぼすため、
    //    composedPath() の先頭（シャドウ境界を越えた実ターゲット）を優先する。
    if (typeof e.composedPath === 'function') {
      var path = e.composedPath();
      if (path.length > 0 && isEditableElement(path[0])) {
        return true;
      }
    }
    if (isEditableElement(e.target)) {
      return true;
    }

    // 3) フォールバック: 現在フォーカスされている要素（activeElement）が
    //    編集可能な場合も通す。target と activeElement が一時的に異なる稀なケース対策。
    if (isEditableElement(document.activeElement)) {
      return true;
    }

    return false;
  }

  /**
   * メインハンドラ（キャプチャフェーズ）。
   * @param {KeyboardEvent} e
   */
  function handleKeyDown(e) {
    // 編集中は一切干渉しない（IME / タイピング / 編集操作を保護）
    if (isEditingContext(e)) {
      return;
    }

    // 修飾キー付き（Ctrl/Cmd/Alt）は Chrome / OS / ユーザ設定に委ね、X の
    // シングルキーショートカットの対象ではないので通す。
    if (e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }

    var key = e.key;
    if (key == null) {
      return;
    }
    // 印字可能な単体キー（長さ1）のみを X のショートカット候補として扱う。
    // 長さ2以上（Shift/Control/Arrow*/Enter/Tab/Backspace/Delete/Escape/F1.. など）は通す。
    if (key.length !== 1) {
      return;
    }

    // ここに到達 = テキスト入力欄外で押された印字可能な単体キー。
    // X のショートカット（j/k/r/n/m/./g/Space 相当の文字 など）になり得るため、
    // X 側リスナへの伝播だけを止める。preventDefault は呼ばない。
    e.stopImmediatePropagation();
  }

  // document_start 時点では DOM が未構築だが、window オブジェクト自体は存在する。
  // キャプチャフェーズは window → document → … → target の順で流れるため、
  // window に登録すればイベント経路の最上流で捕捉できる。X が React ルートは
  // もちろん、将来 document や window にキャプチャリスナを付けても遮断できる
  // （page script より先に実行されるコンテンツスクリプトのため、同じ window 上でも
  //   登録順で必ず先に発火する）。
  // ※ keydown のみ監視する（keyup/keypress の監視は干渉リスクを減らすため廃止。
  //    X のショートカットは keydown ベースで動作する）。
  window.addEventListener('keydown', handleKeyDown, true /* capture phase */);
})();
