var getJST = (() => {
  var l = Object.defineProperty;
  var T = Object.getOwnPropertyDescriptor;
  var S = Object.getOwnPropertyNames;
  var g = Object.prototype.hasOwnProperty;
  var w = (t, n) => {
      for (var e in n) l(t, e, { get: n[e], enumerable: !0 });
    },
    x = (t, n, e, r) => {
      if ((n && typeof n == 'object') || typeof n == 'function')
        for (let o of S(n))
          !g.call(t, o) &&
            o !== e &&
            l(t, o, { get: () => n[o], enumerable: !(r = T(n, o)) || r.enumerable });
      return t;
    };
  var J = (t) => x(l({}, '__esModule', { value: !0 }), t);
  var j = {};
  w(j, {
    getClockOffset: () => _,
    getJSTCptTs: () => O,
    getJSTDate: () => P,
    getJSTDateMillSec: () => I,
    getJSTISOString: () => C,
    getJSTISOStringNoMs: () => k,
    getJSTMillSec: () => b,
    getJSTParts: () => c,
    getJSTTimestamp: () => N,
    syncJST: () => M,
  });
  var m = 0,
    d = !1,
    f = null,
    D = 3600;
  async function M(t = {}) {
    let {
        customApiUrl: n = typeof t == 'string' ? t : void 0,
        ttlSec: e = D,
        force: r = !1,
      } = typeof t == 'object' && t !== null ? t : {},
      o = performance.now();
    if (!r && d && f !== null && e > 0 && (o - f) / 1e3 < e) return m;
    let s = n
      ? [n]
      : [
          'https://www.cloudflare.com/cdn-cgi/trace',
          'https://worldtimeapi.org/api/timezone/Asia/Tokyo',
        ];
    for (let u of s)
      try {
        let $ = Date.now(),
          p = await fetch(u, { cache: 'no-store' }),
          h = Date.now();
        if (!p.ok) continue;
        let y = await p.text(),
          a = null;
        if (y.trim().startsWith('{')) {
          let i = JSON.parse(y);
          typeof i.unix_timestamp == 'number'
            ? (a = i.unix_timestamp)
            : typeof i.unixtime == 'number' && (a = i.unixtime * 1e3);
        } else {
          let i = y.match(/ts=([0-9.]+)/);
          i && (a = parseFloat(i[1]) * 1e3);
        }
        if (typeof a == 'number' && !isNaN(a)) {
          let i = h - $;
          return ((m = a - ($ + i / 2)), (d = !0), (f = performance.now()), m);
        }
      } catch {}
    return (
      console.warn(
        '[getJST] \u3059\u3079\u3066\u306E\u6642\u523B\u540C\u671FAPI\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002\u7AEF\u672B\u306E\u6642\u8A08\u3092\u4F7F\u7528\u3057\u307E\u3059\u3002',
      ),
      m
    );
  }
  function _() {
    let t = f !== null ? Math.round(((performance.now() - f) / 1e3) * 100) / 100 : null;
    return { offsetMs: Math.round(m), isSynced: d, elapsedSec: t };
  }
  function A() {
    return new Date(Date.now() + m);
  }
  function c() {
    let n = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
        hour12: !1,
      }).formatToParts(A()),
      e = (r) => n.find((o) => o.type === r)?.value ?? '';
    return {
      yyyy: e('year'),
      mm: e('month'),
      dd: e('day'),
      hh: e('hour'),
      mi: e('minute'),
      ss: e('second'),
      ms: e('fractionalSecond'),
    };
  }
  function C() {
    let { yyyy: t, mm: n, dd: e, hh: r, mi: o, ss: s, ms: u } = c();
    return `${t}-${n}-${e}T${r}:${o}:${s}.${u}+09:00`;
  }
  function k() {
    let { yyyy: t, mm: n, dd: e, hh: r, mi: o, ss: s } = c();
    return `${t}-${n}-${e}T${r}:${o}:${s}+09:00`;
  }
  function N() {
    let { yyyy: t, mm: n, dd: e, hh: r, mi: o, ss: s } = c();
    return `${t}-${n}-${e}_${r}:${o}:${s}`;
  }
  function O() {
    let { yyyy: t, mm: n, dd: e, hh: r, mi: o, ss: s } = c();
    return `${t}${n}${e}T${r}${o}${s}_jst`;
  }
  function P() {
    let { yyyy: t, mm: n, dd: e } = c();
    return `${t}${n}${e}`;
  }
  function b() {
    let { hh: t, mi: n, ss: e, ms: r } = c();
    return `${t}${n}${e}${r}`;
  }
  function I() {
    let { yyyy: t, mm: n, dd: e, hh: r, mi: o, ss: s, ms: u } = c();
    return `${t}${n}${e}T${r}${o}${s}${u}_jst`;
  }
  return J(j);
})();
