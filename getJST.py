# Runtime/core/python/getJST.py
# -*- coding: utf-8 -*-
"""
JST Utility Functions (with NTP/HTTP Clock Sync & Cache TTL)
日本標準時（JST）を扱うためのユーティリティ関数群（キャッシュ有効期限付き時刻ズレ補正機能）
"""

import json
import math
import re
import time
import urllib.request
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

# JST timezone (UTC+9)
JST = timezone(timedelta(hours=9))

# 端末の時計と正確な時刻の差分（ミリ秒）
_clock_offset_ms: float = 0.0
_is_synced: bool = False
_last_sync_mono: Optional[float] = None  # 最終同期時のモノトニック時刻（秒）

# デフォルトのキャッシュ有効期限（秒）：1時間
DEFAULT_SYNC_TTL_SEC: float = 3600.0


def _now_ms() -> float:
    """現在のローカルエポック時刻（ミリ秒）を取得する内部ヘルパー"""
    return time.time() * 1000.0


def syncJST(
    customApiUrl: Optional[str] = None,
    timeout: float = 5.0,
    ttlSec: float = DEFAULT_SYNC_TTL_SEC,
    force: bool = False,
) -> float:
    """
    外部の公開時刻APIから正確な現在時刻を取得し、端末の時計とのズレ（オフセット）を計算して保存する。
    キャッシュ有効期限（ttlSec）内の再呼び出しは通信をスキップして現在のオフセット値を返す。

    :param customApiUrl: 任意の時刻同期エンドポイントURL（省略時は内蔵のフォールバックリストを使用）
    :param timeout: リクエストのタイムアウト秒数
    :param ttlSec: キャッシュ有効期限（秒）。デフォルトは 3600秒（1時間）。0以下で毎回同期
    :param force: True の場合、有効期限内でも強制的に再同期を実行する
    :return: 計算されたオフセット値（ミリ秒）
    """
    global _clock_offset_ms, _is_synced, _last_sync_mono

    now_mono = time.monotonic()

    # 有効期限内であれば通信をスキップして現在の補正値を返す
    if (
        not force
        and _is_synced
        and _last_sync_mono is not None
        and ttlSec > 0
        and (now_mono - _last_sync_mono) < ttlSec
    ):
        return _clock_offset_ms

    endpoints = (
        [customApiUrl]
        if customApiUrl
        else [
            "https://cloudflare.com" + "/cdn-cgi/trace",
            "https://worldtimeapi.org" + "/api/timezone/Asia/Tokyo",
        ]
    )

    headers = {
        "Cache-Control": "no-store",
        "User-Agent": "Mozilla/5.0 (Python JST Sync)",
    }

    for url in endpoints:
        try:
            req = urllib.request.Request(url, headers=headers)
            t0 = _now_ms()
            with urllib.request.urlopen(req, timeout=timeout) as response:
                status = getattr(response, "status", 200)
                if status != 200:
                    continue
                text = response.read().decode("utf-8")
            t3 = _now_ms()

            server_time_ms: Optional[float] = None

            if text.strip().startswith("{"):
                # JSON形式（WorldTimeAPI など）
                data = json.loads(text)
                if isinstance(data.get("unix_timestamp"), (int, float)):
                    server_time_ms = float(data["unix_timestamp"])
                elif isinstance(data.get("unixtime"), (int, float)):
                    server_time_ms = float(data["unixtime"]) * 1000.0
            else:
                # Cloudflare cdn-cgi/trace 形式（ts=1795272795.331）
                match = re.search(r"ts=([0-9.]+)", text)
                if match:
                    server_time_ms = float(match.group(1)) * 1000.0

            if server_time_ms is not None and not math.isnan(server_time_ms):
                round_trip_time = t3 - t0
                _clock_offset_ms = server_time_ms - (t0 + round_trip_time / 2.0)
                _is_synced = True
                _last_sync_mono = time.monotonic()
                return _clock_offset_ms

        except Exception:
            # 次のエンドポイントへフォールバック
            continue

    print("[getJST] すべての時刻同期APIに失敗しました。端末の時計を使用します。")
    return _clock_offset_ms


def getClockOffset() -> Dict[str, Any]:
    """
    現在の補正値（ミリ秒）、同期状態、最終同期からの経過秒数を返す。
    """
    elapsed_sec = (
        round(time.monotonic() - _last_sync_mono, 2)
        if _last_sync_mono is not None
        else None
    )
    return {
        "offsetMs": round(_clock_offset_ms),
        "isSynced": _is_synced,
        "elapsedSec": elapsed_sec,
    }


def getJSTNow() -> datetime:
    """
    Internal helper: return current corrected JST datetime.
    """
    corrected_sec = (_now_ms() + _clock_offset_ms) / 1000.0
    return datetime.fromtimestamp(corrected_sec, tz=JST)


def getJSTParts() -> Dict[str, str]:
    """
    現在時刻（補正済み）の JST 構成要素を取得する。
    """
    now = getJSTNow()
    return {
        "yyyy": f"{now.year:04d}",
        "mm": f"{now.month:02d}",
        "dd": f"{now.day:02d}",
        "hh": f"{now.hour:02d}",
        "mi": f"{now.minute:02d}",
        "ss": f"{now.second:02d}",
        "ms": f"{int(now.microsecond / 1000):03d}",
    }


def getJSTISOString() -> str:
    p = getJSTParts()
    return f"{p['yyyy']}-{p['mm']}-{p['dd']}T{p['hh']}:{p['mi']}:{p['ss']}.{p['ms']}+09:00"


def getJSTISOStringNoMs() -> str:
    p = getJSTParts()
    return f"{p['yyyy']}-{p['mm']}-{p['dd']}T{p['hh']}:{p['mi']}:{p['ss']}+09:00"


def getJSTTimestamp() -> str:
    p = getJSTParts()
    return f"{p['yyyy']}-{p['mm']}-{p['dd']}_{p['hh']}:{p['mi']}:{p['ss']}"


def getJSTCptTs() -> str:
    p = getJSTParts()
    return f"{p['yyyy']}{p['mm']}{p['dd']}T{p['hh']}{p['mi']}{p['ss']}_jst"


def getJSTDate() -> str:
    p = getJSTParts()
    return f"{p['yyyy']}{p['mm']}{p['dd']}"


def getJSTMillSec() -> str:
    p = getJSTParts()
    return f"{p['hh']}{p['mi']}{p['ss']}{p['ms']}"


def getJSTDateMillSec() -> str:
    p = getJSTParts()
    return f"{p['yyyy']}{p['mm']}{p['dd']}T{p['hh']}{p['mi']}{p['ss']}{p['ms']}_jst"
