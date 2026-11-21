// Runtime/core/lib/getJST.js
/* global fetch, console, performance */
// ------------------------------------------------------------
// JST Utility Functions (with NTP/HTTP Clock Sync & Cache TTL)
// 日本標準時（JST）を扱うためのユーティリティ関数群（キャッシュ有効期限付き時刻ズレ補正機能）
// ------------------------------------------------------------

// 端末の時計と正確な時刻の差分（ミリ秒）
let clockOffsetMs = 0;
let isSynced = false;
let lastSyncPerfMs = null; // performance.now() による単調増加タイマー

const DEFAULT_SYNC_TTL_SEC = 3600;

/**
 * syncJST()
 * ------------------------------------------------------------
 * 外部の公開時刻API（デフォルトは Cloudflare エッジ、フォールバックに WorldTimeAPI）
 * から正確な現在時刻を取得し、端末の時計とのズレ（オフセット）を計算して保存する。
 * キャッシュ有効期限（ttlSec）内の再呼び出しは通信をスキップして現在のオフセット値を返す。
 *
 * @param {object|string} [options] オプションオブジェクト または カスタムURL文字列
 * @param {string} [options.customApiUrl] 任意の時刻同期エンドポイントURL
 * @param {number} [options.ttlSec=3600] キャッシュ有効期限（秒）。0以下で毎回同期
 * @param {boolean} [options.force=false] true の場合は有効期限内でも強制再同期
 * @returns {Promise<number>} 計算されたオフセット値（ミリ秒）
 */
export async function syncJST(options = {}) {
  // 後方互換性：第1引数に文字列が渡された場合もサポート
  const {
    customApiUrl = typeof options === 'string' ? options : undefined,
    ttlSec = DEFAULT_SYNC_TTL_SEC,
    force = false,
  } = typeof options === 'object' && options !== null ? options : {};

  const nowPerf = performance.now();

  if (
    !force &&
    isSynced &&
    lastSyncPerfMs !== null &&
    ttlSec > 0 &&
    (nowPerf - lastSyncPerfMs) / 1000 < ttlSec
  ) {
    return clockOffsetMs;
  }

  const endpoints = customApiUrl
    ? [customApiUrl]
    : [
        'https://www.cloudflare.com' + '/cdn-cgi/trace',
        'https://worldtimeapi.org' + '/api/timezone/Asia/Tokyo',
      ];

  for (const url of endpoints) {
    try {
      const t0 = Date.now();
      const response = await fetch(url, { cache: 'no-store' });
      const t3 = Date.now();

      if (!response.ok) continue;

      const text = await response.text();
      let serverTimeMs = null;

      if (text.trim().startsWith('{')) {
        // JSON形式（WorldTimeAPI など）
        const data = JSON.parse(text);
        if (typeof data.unix_timestamp === 'number') {
          serverTimeMs = data.unix_timestamp;
        } else if (typeof data.unixtime === 'number') {
          serverTimeMs = data.unixtime * 1000;
        }
      } else {
        // Cloudflare cdn-cgi/trace 形式（ts=1795272795.331）
        const match = text.match(/ts=([0-9.]+)/);
        if (match) {
          serverTimeMs = parseFloat(match[1]) * 1000;
        }
      }

      if (typeof serverTimeMs === 'number' && !isNaN(serverTimeMs)) {
        const roundTripTime = t3 - t0;
        clockOffsetMs = serverTimeMs - (t0 + roundTripTime / 2);
        isSynced = true;
        lastSyncPerfMs = performance.now();
        return clockOffsetMs;
      }
    } catch {
      // 次のエンドポイントへフォールバック
    }
  }

  console.warn('[getJST] すべての時刻同期APIに失敗しました。端末の時計を使用します。');
  return clockOffsetMs;
}

/**
 * getClockOffset()
 * ------------------------------------------------------------
 * 現在の補正値（ミリ秒）、同期状態、最終同期からの経過秒数を返す。
 */
export function getClockOffset() {
  const elapsedSec =
    lastSyncPerfMs !== null
      ? Math.round(((performance.now() - lastSyncPerfMs) / 1000) * 100) / 100
      : null;

  return {
    offsetMs: Math.round(clockOffsetMs),
    isSynced,
    elapsedSec,
  };
}

/**
 * 補正済みの現在時刻（Dateオブジェクト）を生成する内部ヘルパー
 */
function getCorrectedDate() {
  return new Date(Date.now() + clockOffsetMs);
}

/**
 * getJSTParts()
 * ------------------------------------------------------------
 * 現在時刻（補正済み）の JST 構成要素を取得する。
 */
export function getJSTParts() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hour12: false,
  });

  // ここで補正済みの Date を使用
  const parts = formatter.formatToParts(getCorrectedDate());

  const get = (type) => parts.find((p) => p.type === type)?.value ?? '';

  return {
    yyyy: get('year'),
    mm: get('month'),
    dd: get('day'),
    hh: get('hour'),
    mi: get('minute'),
    ss: get('second'),
    ms: get('fractionalSecond'),
  };
}

export function getJSTISOString() {
  const { yyyy, mm, dd, hh, mi, ss, ms } = getJSTParts();
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}.${ms}+09:00`;
}

export function getJSTISOStringNoMs() {
  const { yyyy, mm, dd, hh, mi, ss } = getJSTParts();
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}+09:00`;
}

export function getJSTTimestamp() {
  const { yyyy, mm, dd, hh, mi, ss } = getJSTParts();
  return `${yyyy}-${mm}-${dd}_${hh}:${mi}:${ss}`;
}

export function getJSTCptTs() {
  const { yyyy, mm, dd, hh, mi, ss } = getJSTParts();
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}_jst`;
}

export function getJSTDate() {
  const { yyyy, mm, dd } = getJSTParts();
  return `${yyyy}${mm}${dd}`;
}

export function getJSTMillSec() {
  const { hh, mi, ss, ms } = getJSTParts();
  return `${hh}${mi}${ss}${ms}`;
}

export function getJSTDateMillSec() {
  const { yyyy, mm, dd, hh, mi, ss, ms } = getJSTParts();
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}${ms}_jst`;
}
