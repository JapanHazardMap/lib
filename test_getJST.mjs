// Runtime/core/lib/test_getJST.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  syncJST,
  getClockOffset,
  getJSTParts,
  getJSTISOString,
  getJSTISOStringNoMs,
  getJSTTimestamp,
  getJSTCptTs,
  getJSTDate,
  getJSTMillSec,
  getJSTDateMillSec,
} from './getJST.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('getJST.js ユーティリティ検証', () => {
  it('01: 実際のAPIで時刻同期を行い、全関数の出力フォーマットを検証する', async () => {
    const before = getClockOffset();
    assert.equal(before.isSynced, false);
    assert.equal(before.elapsedSec, null);

    const offset = await syncJST();
    const after = getClockOffset();

    console.log('\n--- [1] 実API同期 & 全フォーマット出力確認 ---');
    console.log('Sync Status :', after);
    console.log(`Raw Offset  : ${offset.toFixed(2)} ms`);
    console.log('getJSTParts        :', getJSTParts());
    console.log('getJSTISOString    :', getJSTISOString());
    console.log('getJSTISOStringNoMs:', getJSTISOStringNoMs());
    console.log('getJSTTimestamp    :', getJSTTimestamp());
    console.log('getJSTCptTs        :', getJSTCptTs());
    console.log('getJSTDate         :', getJSTDate());
    console.log('getJSTMillSec      :', getJSTMillSec());
    console.log('getJSTDateMillSec  :', getJSTDateMillSec());

    assert.equal(after.isSynced, true);
    assert.equal(typeof after.elapsedSec, 'number');

    // 正規表現によるフォーマット厳密チェック
    assert.match(getJSTISOString(), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+09:00$/);
    assert.match(getJSTISOStringNoMs(), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/);
    assert.match(getJSTTimestamp(), /^\d{4}-\d{2}-\d{2}_\d{2}:\d{2}:\d{2}$/);
    assert.match(getJSTCptTs(), /^\d{8}T\d{6}_jst$/);
    assert.match(getJSTDate(), /^\d{8}$/);
    assert.match(getJSTMillSec(), /^\d{9}$/);
    assert.match(getJSTDateMillSec(), /^\d{8}T\d{9}_jst$/);
  });

  it('02: キャッシュ有効期限内のスキップ・期限切れ再同期・強制再同期を検証する', async () => {
    // 1回目：強制同期で基準を作成
    await syncJST({ ttlSec: 10, force: true });
    await sleep(60);

    // 2回目（有効期限内）：通信スキップにより elapsedSec が増加し続けること
    const beforeSkip = getClockOffset().elapsedSec;
    await syncJST({ ttlSec: 10 });
    const afterSkip = getClockOffset().elapsedSec;
    assert.ok(afterSkip >= beforeSkip, 'キャッシュ有効期限内は再同期されないこと');

    // 3回目（force: true）：有効期限内でも強制再同期され elapsedSec がリセットされること
    await syncJST({ ttlSec: 10, force: true });
    const afterForce = getClockOffset().elapsedSec;
    assert.ok(afterForce < afterSkip, 'force: true で elapsedSec がリセットされること');

    // 4回目（ttlSec: 0.1 経過後）：期限切れにより自動再同期されること
    await sleep(150);
    const beforeExpire = getClockOffset().elapsedSec;
    await syncJST({ ttlSec: 0.1 });
    const afterExpire = getClockOffset().elapsedSec;
    assert.ok(afterExpire < beforeExpire, 'TTL期限切れで再同期され elapsedSec がリセットされること');
  });

  it('03: 不正なURLを指定した際、エラーで落ちずにフォールバックするか検証する', async () => {
    console.log('\n--- [2] 同期失敗時のフォールバック確認 ---');
    const prevOffset = getClockOffset().offsetMs;

    // 既存のキャッシュを無視して不正なURLへ強制同期を試行
    const returnedOffset = await syncJST({
      customApiUrl: 'https://example.com',
      force: true,
    });

    assert.equal(Math.round(returnedOffset), prevOffset);
    assert.ok(getJSTISOString().endsWith('+09:00'));
  });
});
