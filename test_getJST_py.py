# Runtime/core/python/test_getJST_py.py
# -*- coding: utf-8 -*-

import time
import unittest
from Runtime.core.python import (
    getJST,
    syncJST,
    getClockOffset,
    getJSTNow,
    getJSTParts,
    getJSTISOString,
    getJSTISOStringNoMs,
    getJSTTimestamp,
    getJSTCptTs,
    getJSTDate,
    getJSTMillSec,
    getJSTDateMillSec,
)


class TestJSTUtilities(unittest.TestCase):
    def setUp(self):
        """各テストの前に同期状態とキャッシュ状態をリセット"""
        getJST._clock_offset_ms = 0.0
        getJST._is_synced = False
        getJST._last_sync_mono = None

    def test_01_live_sync_and_formats(self):
        """実際のAPIで時刻同期を行い、全関数の出力フォーマットを検証する"""
        before = getClockOffset()
        self.assertFalse(before["isSynced"])
        self.assertIsNone(before["elapsedSec"])

        syncJST()
        after = getClockOffset()
        self.assertTrue(after["isSynced"])
        self.assertIsNotNone(after["elapsedSec"])

        self.assertRegex(getJSTISOString(), r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+09:00$")
        self.assertRegex(getJSTISOStringNoMs(), r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$")
        self.assertRegex(getJSTTimestamp(), r"^\d{4}-\d{2}-\d{2}_\d{2}:\d{2}:\d{2}$")
        self.assertRegex(getJSTCptTs(), r"^\d{8}T\d{6}_jst$")
        self.assertRegex(getJSTDate(), r"^\d{8}$")
        self.assertRegex(getJSTMillSec(), r"^\d{9}$")
        self.assertRegex(getJSTDateMillSec(), r"^\d{8}T\d{9}_jst$")

    def test_02_cache_ttl_and_force_sync(self):
        """キャッシュ有効期限内のスキップ・期限切れ再同期・強制再同期を検証"""
        # 1回目同期
        syncJST(ttlSec=10)
        first_sync_time = getJST._last_sync_mono
        self.assertIsNotNone(first_sync_time)

        # 2回目（有効期限内）：通信をスキップするため _last_sync_mono が変化しないこと
        time.sleep(0.05)
        syncJST(ttlSec=10)
        self.assertEqual(getJST._last_sync_mono, first_sync_time)

        # 3回目（force=True）：有効期限内でも強制再同期され _last_sync_mono が更新されること
        time.sleep(0.05)
        syncJST(ttlSec=10, force=True)
        second_sync_time = getJST._last_sync_mono
        self.assertGreater(second_sync_time, first_sync_time)

        # 4回目（ttlSec=0.1 経過後）：期限切れにより再同期されること
        time.sleep(0.15)
        syncJST(ttlSec=0.1)
        self.assertGreater(getJST._last_sync_mono, second_sync_time)

    def test_03_fallback_on_invalid_url(self):
        """不正なURLを指定した際、エラーで落ちずにローカル時計へフォールバックするか検証"""
        offset = syncJST(customApiUrl="https://example.com", timeout=1.0)
        status = getClockOffset()
        self.assertEqual(offset, 0.0)
        self.assertFalse(status["isSynced"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
