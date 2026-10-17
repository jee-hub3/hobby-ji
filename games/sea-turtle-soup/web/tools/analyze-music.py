#!/usr/bin/env python3
"""배경음악 분석: render-music.js가 만든 WAV를 ffmpeg ebur128/astats와 numpy로 재고 docs/MUSIC.md 5장, 8.2의 목표와 비교한다.

  python3 tools/analyze-music.py                       분석 묶음 전부를 재고 표를 출력. 하나라도 실패하면 exit 1
  python3 tools/analyze-music.py --previews <dir>      미리듣기 WAV를 MP3(-q:a 2)와 스펙트로그램 PNG로 <dir>에 만든다
  옵션: --dir <music-out> (기본 web/music-out), --report <json> (기본 web/docs/music/report.json), --quiet (실패와 요약만)
필요: ffmpeg, python3 + numpy
"""
import json, math, os, re, subprocess, sys, tempfile
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def opt(k, d=None):
    return sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
DIR = os.path.abspath(opt('--dir', os.path.join(ROOT, 'music-out')))
REPORT = os.path.abspath(opt('--report', os.path.join(ROOT, 'docs', 'music', 'report.json')))
QUIET = '--quiet' in sys.argv

# ---------------------------------------------------------------- 입출력
def read_wav(path):
    with open(path, 'rb') as f:
        b = f.read()
    assert b[:4] == b'RIFF' and b[8:12] == b'WAVE', path
    i, fmt, data = 12, None, None
    while i < len(b) - 8:
        cid, n = b[i:i + 4], int.from_bytes(b[i + 4:i + 8], 'little')
        if cid == b'fmt ':
            fmt = (int.from_bytes(b[i + 8:i + 10], 'little'), int.from_bytes(b[i + 10:i + 12], 'little'), int.from_bytes(b[i + 12:i + 16], 'little'), int.from_bytes(b[i + 22:i + 24], 'little'))
        elif cid == b'data':
            data = b[i + 8:i + 8 + n]
        i += 8 + n + (n & 1)
    tag, ch, sr, bits = fmt
    assert tag == 3 and bits == 32, 'float32 WAV expected'
    x = np.frombuffer(data, dtype='<f4').reshape(-1, ch).T.astype(np.float64)
    return x, sr

def write_wav(path, x, sr):
    d = np.ascontiguousarray(x.T.astype('<f4')).tobytes()
    h = b'RIFF' + (36 + len(d)).to_bytes(4, 'little') + b'WAVEfmt ' + (16).to_bytes(4, 'little') + (3).to_bytes(2, 'little') + (x.shape[0]).to_bytes(2, 'little')
    h += sr.to_bytes(4, 'little') + (sr * 4 * x.shape[0]).to_bytes(4, 'little') + (4 * x.shape[0]).to_bytes(2, 'little') + (32).to_bytes(2, 'little') + b'data' + len(d).to_bytes(4, 'little')
    with open(path, 'wb') as f:
        f.write(h + d)

FRAME = re.compile(r't:\s*([\d.]+)\s+TARGET:\S+\s+LUFS\s+M:\s*(-?[\d.]+|-inf)\s+S:\s*(-?[\d.]+|-inf)')
def ebur(path, start=None, end=None, frames=False):
    """ffmpeg ebur128. 구간을 주면 atrim으로 잘라 그 구간의 I, LRA, 트루 피크를 잰다. frames=True면 100 ms마다 (t, M, S)."""
    af = ('atrim=start=%g:end=%g,asetpts=PTS-STARTPTS,' % (start, end) if start is not None else '') + 'ebur128=peak=true' + (':framelog=verbose' if frames else '')
    r = subprocess.run(['ffmpeg', '-nostats', '-hide_banner'] + (['-loglevel', 'verbose'] if frames else []) + ['-i', path, '-af', af, '-f', 'null', '-'], capture_output=True, text=True)
    err = r.stderr
    summ = err[err.rfind('Summary:'):]
    def num(label):
        m = re.search(label + r':\s*(-?[\d.]+|-inf)', summ)
        return float(m.group(1)) if m and m.group(1) != '-inf' else -math.inf
    out = {'I': num(r'\bI'), 'LRA': num('LRA'), 'TP': num('Peak')}
    if frames:
        fr = [(float(a), float(m) if m != '-inf' else -120.0, float(s) if s != '-inf' else -120.0) for a, m, s in FRAME.findall(err[:err.rfind('Summary:')])]
        out['frames'] = np.array(fr)
    return out

# ---------------------------------------------------------------- 지표 (8.2)
def emean(v):
    v = np.asarray(v)
    return 10 * math.log10(np.mean(10 ** (v / 10))) if len(v) else -math.inf

def welch(mono, sr):
    n, hop = 8192, 4096
    w = np.hanning(n)
    cnt = max(1, (len(mono) - n) // hop + 1)
    P = np.zeros(n // 2 + 1)
    for i in range(cnt):
        seg = mono[i * hop:i * hop + n]
        if len(seg) < n:
            break
        P += np.abs(np.fft.rfft(seg * w)) ** 2
    return np.fft.rfftfreq(n, 1 / sr), P

def fft_mask(x, sr, mask_fn):
    X = np.fft.rfft(x, axis=-1)
    f = np.fft.rfftfreq(x.shape[-1], 1 / sr)
    return np.fft.irfft(X * mask_fn(f), n=x.shape[-1], axis=-1)

def bandpass(x, sr, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / sr)
    X[(f < lo) | (f > hi)] = 0
    return np.fft.irfft(X, n=len(x))

def beat_index(mono, sr, lo, hi):
    """M1, M2 (MUSIC.md 9.6): 대역 [lo, hi] Hz의 맥놀이 지수. 5 ms RMS 포락선에서 3–30 Hz 출렁임만 남기고,
    1초 창마다 sqrt(2)·std / 평균. 고른 음은 0에 가깝고, 같은 크기 사인 둘이 몇 Hz 떨어져 있으면 1에 가깝다"""
    y = bandpass(mono, sr, lo, hi)
    n = int(round(0.005 * sr))
    k = len(y) // n
    env = np.sqrt(np.mean(y[:k * n].reshape(k, n) ** 2, axis=1))
    fl = bandpass(env - env.mean(), sr / n, 3, 30)
    return np.array([math.sqrt(2) * fl[i:i + 200].std() / (env[i:i + 200].mean() + 1e-12) for i in range(0, k - 200, 200)])

def slow_am(mono, sr):
    """M3 (MUSIC.md 9.7-2): 느린 진폭 변조(맥놀이가 1초 안팎으로 출렁이는 것). ERB 폭 대역(중심 120–1400 Hz, 로그 간격 22개)마다
    20 ms RMS 포락선 → dB → 0.3–3 Hz 성분만 → 10초 창마다 p95 - p5. 중심 300–1000 Hz이고 가장 센 대역에서 20 dB 안인 대역만 보고,
    (대역별 창 중앙값의 최대, 대역별 창 최댓값의 최대, 중앙값이 가장 큰 대역의 중심 Hz)를 돌려준다"""
    X = np.fft.rfft(mono)
    f = np.fft.rfftfreq(len(mono), 1 / sr)
    n = int(round(0.02 * sr))
    res = []
    for c in np.geomspace(120, 1400, 22):
        e = 24.7 * (4.37e-3 * c + 1)
        y = np.fft.irfft(np.where((f >= c - e / 2) & (f <= c + e / 2), X, 0), n=len(mono))
        k = len(y) // n
        env = np.sqrt(np.mean(y[:k * n].reshape(k, n) ** 2, axis=1)) + 1e-12
        d = 20 * np.log10(env)
        am = bandpass(d - d.mean(), 1 / 0.02, 0.3, 3.0)
        W = int(10 / 0.02)
        dep = [np.percentile(am[i:i + W], 95) - np.percentile(am[i:i + W], 5) for i in range(0, len(am) - W, W)]
        res.append((float(c), 20 * math.log10(env.mean()), float(np.median(dep)), float(np.max(dep))))
    top = max(r[1] for r in res)
    sel = [r for r in res if 300 <= r[0] <= 1000 and r[1] > top - 20]
    if not sel:
        return 0.0, 0.0, 0.0
    worst = max(sel, key=lambda r: r[2])
    return worst[2], max(r[3] for r in sel), worst[0]

def rms_frames(x, n):
    k = len(x) // n
    return np.sqrt(np.mean(x[:k * n].reshape(k, n) ** 2, axis=1))

def rise(frames, a, b, skip=0.5):
    """L4: max_t [M(t) - min M[t-3s, t]], 구간 [a, b), 첫 0.5 s와 -70 LUFS 미만 제외"""
    t, M = frames[:, 0], frames[:, 1]
    ok = (t >= a + skip) & (t < b) & (M >= -70)
    tt, mm = t[ok], M[ok]
    best = 0.0
    j = 0
    for i in range(len(tt)):
        while tt[j] < tt[i] - 3.0 - 1e-9:
            j += 1
        best = max(best, mm[i] - mm[j:i + 1].min())
    return best

def measure(path, w0, w1, bed=False):
    x, sr = read_wav(path)
    a, b = int(w0 * sr), int(w1 * sr)
    seg = x[:, a:b]
    mono = seg.mean(axis=0)
    full = ebur(path, frames=True)
    win = ebur(path, w0, w1)
    m = {'sr': sr, 'I': win['I'], 'LRA': win['LRA'], 'TP': full['TP'], 'frames': full['frames']}
    fr = full['frames']
    sm = fr[(fr[:, 0] >= w0 + 3) & (fr[:, 0] <= w1), 2]
    m['Smin'] = float(sm.min()) if len(sm) else -120
    m['peak'] = 20 * math.log10(np.abs(x).max() + 1e-12)
    m['crest'] = max(20 * math.log10((np.abs(c).max() + 1e-12) / (np.sqrt(np.mean(c ** 2)) + 1e-12)) for c in seg)
    m['dc'] = float(max(abs(c.mean()) for c in seg))
    f, P = welch(mono, sr)
    band = f >= 20
    tot = P[band].sum()
    m['hf4k'] = 100 * P[f >= 4000].sum() / tot
    m['hf8k'] = 100 * P[f >= 8000].sum() / tot
    m['centroid'] = float((f[band] * P[band]).sum() / tot)
    m['low120'] = 100 * P[(f >= 20) & (f < 120)].sum() / tot
    m['b2k4k'] = float(P[(f >= 2000) & (f < 4000)].sum())  # 4.8 자정 - 오후 비교용 (절대값)
    for key, lo, hi in (('M1', 40, 120), ('M2', 120, 250)):
        bi = beat_index(mono, sr, lo, hi)
        m[key] = float(np.percentile(bi, 90))
        m[key + 'max'] = float(bi.max())
        m[key + 'arr'] = bi  # 1초 창 k = [w0 + k, w0 + k + 1). 큐 구간 M2(9.7-3)가 쓴다
    if bed:  # 9.7: 느린 진폭 변조(M3)와 대역별 좌우 균형(S7)은 바탕 렌더에서만
        m['M3med'], m['M3max'], m['M3hz'] = slow_am(mono, sr)
        fL, PL = welch(seg[0], sr)
        _, PR = welch(seg[1], sr)
        for lo, hi in ((120, 250), (250, 500)):
            b = (fL >= lo) & (fL < hi)
            m['LR%d' % lo] = 10 * math.log10(PL[b].sum() / PR[b].sum())
    ph = fft_mask(seg, sr, lambda fq: 1 / np.sqrt(1 + (250 / np.maximum(fq, 1e-3)) ** 8))
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tf:
        tmp = tf.name
    try:
        write_wav(tmp, ph, sr)
        m['phone'] = win['I'] - ebur(tmp)['I']
    finally:
        os.unlink(tmp)
    m['corr'] = float(np.corrcoef(seg[0], seg[1])[0, 1])
    n10 = int(0.01 * sr)
    r = 20 * np.log10(rms_frames(mono, n10) + 1e-12)
    ker = np.ones(10) / 10
    prev = np.convolve(r, ker, 'full')[9:len(r) - 1]  # 직전 10프레임 평균(dB)
    m['trans'] = float((r[10:] - prev[:len(r) - 10]).max()) if len(r) > 10 else 0.0
    # 구간 끝을 50 ms 테이퍼로 닫고 양 끝 0.1 s는 빼고 본다 (FFT 마스크가 끝과 처음을 이어 붙여 생기는 가짜 클릭 방지)
    tap = np.ones(seg.shape[1]); k = int(0.05 * sr); ramp = 0.5 - 0.5 * np.cos(np.pi * np.arange(k) / k)
    tap[:k], tap[-k:] = ramp, ramp[::-1]
    hp = fft_mask(seg * tap, sr, lambda fq: (fq >= 6000).astype(float))
    edge = int(0.1 / 0.01)
    m['click'] = max(20 * math.log10(rms_frames(c, n10)[edge:-edge].max() + 1e-12) for c in hp)
    return m

# ---------------------------------------------------------------- 목표 판정
rows, fails = [], []
def check(render, metric, value, ok, target):
    rows.append({'render': render, 'metric': metric, 'value': None if value is None else round(float(value), 4), 'target': target, 'pass': bool(ok)})
    if not ok:
        fails.append(rows[-1])

def info(render, metric, value, note):
    rows.append({'render': render, 'metric': metric, 'value': round(float(value), 4), 'target': note, 'pass': True, 'info': True})

def rng_ok(v, a, b):
    return a - 1e-9 <= v <= b + 1e-9

BED_RISE = {'menu': 3.5, 'play': 3.0, 'thinking': 3.0, 'solved': 3.5, 'gaveup': 3.0}

def common(name, m, kind):
    cue = kind in ('cue', 'x', 'preview')
    check(name, 'P1 true peak dBTP', m['TP'], m['TP'] <= -10, '<= -10')
    check(name, 'P2 sample peak dBFS', m['peak'], m['peak'] <= -10, '<= -10')
    check(name, 'P3 crest dB', m['crest'], m['crest'] <= 18, '<= 18')
    check(name, 'P4 DC', m['dc'], m['dc'] <= 1e-4, '<= 1e-4')
    check(name, 'T1 transient dB', m['trans'], m['trans'] <= 8, '<= 8')
    check(name, 'T2 click dBFS', m['click'], m['click'] <= -55, '<= -55')
    if kind == 'preview':
        return
    check(name, 'L3 LRA', m['LRA'], m['LRA'] <= (5.0 if cue else 3.5), '<= %s' % (5.0 if cue else 3.5))
    check(name, 'L5 min S - I', m['Smin'] - m['I'], m['Smin'] >= m['I'] - 4, '>= -4')
    check(name, 'S1 >4k %', m['hf4k'], m['hf4k'] <= 0.5, '<= 0.5')
    check(name, 'S2 >8k %', m['hf8k'], m['hf8k'] <= 0.05, '<= 0.05')
    hi = 550 if cue else 450
    check(name, 'S3 centroid Hz', m['centroid'], rng_ok(m['centroid'], 150, hi), '150..%d' % hi)
    check(name, 'S4 <120 Hz %', m['low120'], rng_ok(m['low120'], 10, 40), '10..40')
    check(name, 'S5 phone loss LU', m['phone'], m['phone'] <= 6, '<= 6')
    check(name, 'S6 L/R corr', m['corr'], m['corr'] >= 0.3, '>= 0.3')

def beats(name, m):  # 9.6: 저역 맥놀이. 바탕과 전환 렌더
    check(name, 'M1 beat 40-120 Hz p90', m['M1'], m['M1'] <= 0.25, '<= 0.25')
    check(name, 'M2 beat 120-250 Hz p90', m['M2'], m['M2'] <= 0.25, '<= 0.25')

def slow_beats(name, m):  # 9.7-2: 패드의 느린 맥놀이. 건반을 뺀 쌍둥이 렌더에서
    check(name, 'M3 slow AM 300-1000 Hz median dB', m['M3med'], m['M3med'] <= 6, '<= 6 (band %.0f Hz)' % m['M3hz'])
    check(name, 'M3 slow AM 300-1000 Hz max dB', m['M3max'], m['M3max'] <= 12, '<= 12')

def bed_extra(name, m):  # 9.7: 대역별 좌우 균형(S7). 전체 믹스의 M3는 참고값(건반 음의 감쇠가 섞임)
    info(name, 'M3 full mix median dB', m['M3med'], '(info) keys envelopes included; checked on -nokeys')
    for lo in (120, 250):  # 렌더 하나(90초)는 지속음의 직접음-잔향 간섭 때문에 ±1.5 dB 안팎으로 흩어진다. 기울기는 아래 평균(S7m)이 본다
        v = m['LR%d' % lo]
        check(name, 'S7 L-R %d-%d Hz dB' % (lo, 2 * lo), v, abs(v) <= 2.0, '|x| <= 2.0')

def cue_beats(name, m, w0, T, secs):  # 9.7-3: 큐가 들어오는 [T, T+secs)의 120–250 Hz 맥놀이. M2 정의(1초 창 p90)와 0.25 넘는 창의 수
    a = m['M2arr'][int(round(T - w0)):int(round(T - w0 + secs))]
    p90, k = float(np.percentile(a, 90)), int((a > 0.25).sum())
    check(name, 'M2 cue [T,T+%d) p90' % secs, p90, p90 <= 0.25, '<= 0.25')
    check(name, 'M2 cue [T,T+%d) windows > 0.25' % secs, k, k <= 1, '<= 1')  # 큐 근처의 화성 산책 교대 하나는 1초 창 하나를 0.3–0.6으로 올릴 수 있다 (바탕도 같음)
    info(name, 'M2 cue [T,T+%d) max' % secs, float(a.max()), '(info)')

def analyze(mf):
    R = mf['renders']
    meas = {}
    names = [n for n, r in R.items() if r['set'] == 'analysis']
    missing = [n for n in names if not os.path.exists(os.path.join(DIR, R[n]['file']))]
    if missing:
        print('missing renders:', missing)
        sys.exit(1)
    from concurrent.futures import ProcessPoolExecutor
    with ProcessPoolExecutor(max_workers=min(4, os.cpu_count() or 1)) as ex:
        res = dict(zip(names, ex.map(measure, [os.path.join(DIR, R[n]['file']) for n in names], [R[n]['window'][0] for n in names], [R[n]['window'][1] for n in names], [R[n]['kind'] in ('bed', 'bedpad') for n in names])))
    for n in names:
        r = R[n]
        meas[n] = res[n]
        if not QUIET:
            m = meas[n]
            print('  measured %-22s I %6.2f  LRA %4.1f  TP %6.1f  rise %4.2f  cent %5.0f  low %4.1f%%  phone %4.1f  corr %4.2f  trans %4.1f  click %6.1f  beat %.2f/%.2f' % (
                n, m['I'], m['LRA'], m['TP'], rise(m['frames'], r['window'][0], r['window'][1]), m['centroid'], m['low120'], m['phone'], m['corr'], m['trans'], m['click'], m['M1'], m['M2'])
                + ('  M3 %4.1f/%4.1f dB @%4.0f Hz  L-R %+4.1f/%+4.1f dB' % (m['M3med'], m['M3max'], m['M3hz'], m['LR120'], m['LR250']) if 'M3med' in m else ''), flush=True)
    playI = {(r['seed'], r['theme']): meas[n]['I'] for n, r in R.items() if n in meas and r['kind'] == 'bed' and r['scene'] == 'play'}
    sceneI = {}
    for n in names:
        r, m = R[n], meas[n]
        kind = r['kind']
        if kind == 'solo':
            continue
        if kind == 'bedpad':
            slow_beats(n, m)
            continue
        common(n, m, kind)
        w0, w1 = r['window']
        if kind == 'bed':
            sc, key = r['scene'], (r['seed'], r['theme'])
            sceneI[(sc, r['seed'], r['theme'])] = m['I']
            if sc == 'play':
                check(n, 'L1 I LUFS', m['I'], rng_ok(m['I'], -30, -28), '-29 +-1')
            elif sc == 'menu':
                check(n, 'L1 I LUFS', m['I'], rng_ok(m['I'], -28.5, -26.5), '-27.5 +-1')
                check(n, 'L2 menu - play LU', m['I'] - playI[key], rng_ok(m['I'] - playI[key], 0.8, 2.5), '+0.8..+2.5')
            else:
                lim = {'thinking': (-1.0, 0.3), 'solved': (0.5, 2.5), 'gaveup': (-1.0, 1.0)}[sc]
                check(n, 'L1 %s - play LU' % sc, m['I'] - playI[key], rng_ok(m['I'] - playI[key], *lim), '%+.1f..%+.1f' % lim)
            lr = rise(m['frames'], w0, w1)
            check(n, 'L4 rise LU', lr, lr <= BED_RISE[sc], '<= %s' % BED_RISE[sc])
            beats(n, m)
            bed_extra(n, m)
            continue
        fr, T = m['frames'], r.get('T')
        t, S = fr[:, 0], fr[:, 2]
        if kind == 'x':
            lr = rise(fr, w0, w1)
            check(n, 'X1 rise LU', lr, lr <= 3.5, '<= 3.5')
            beats(n, m)
            continue
        bed = emean(S[(t >= T - 15) & (t < T)])
        cue = r['cue']
        if cue == 'chapter':
            sel = (t >= T) & (t < T + 12)
            pk = S[sel].max() - bed
            pt = t[sel][S[sel].argmax()] - T
            ret = emean(S[(t >= T + 12) & (t < T + 22)]) - bed
            m['C1'] = pk  # 9.6: 시드 12개 모두, 실시간 예약(live) 렌더도 같은 목표
            check(n, 'C1 breath peak - bed LU', pk, rng_ok(pk, 1.5, 4.0), '+1.5..+4.0')
            check(n, 'C2 peak time s', pt, rng_ok(pt, 3, 9), '3..9')
            check(n, 'C3 return LU', ret, rng_ok(ret, -1.5, 2.0), '-1.5..+2.0')
            lr = rise(fr, T - 5, T + 20, skip=0)
            check(n, 'L4 rise [T-5,T+20) LU', lr, lr <= 4.0, '<= 4.0')
            cue_beats(n, m, w0, T, 8)
        else:
            pk = S[(t >= T) & (t < T + 20)].max() - bed
            lr = rise(fr, w0, w1)
            if cue == 'solved':
                check(n, 'C4 solve peak - bed LU', pk, rng_ok(pk, 1.5, 4.0), '+1.5..+4.0')
                check(n, 'L4 rise LU', lr, lr <= 4.0, '<= 4.0')
                cue_beats(n, m, w0, T, 20)
            elif cue == 'gaveup':
                check(n, 'C6 give-up peak - bed LU', pk, pk <= 1.5, '<= +1.5')
                check(n, 'L4 rise LU', lr, lr <= 3.5, '<= 3.5')
            else:  # 다시 열기: 도착 바탕(완식 바탕) 위로 치솟지 않는지 본다. [T-15, T) 대비 값은 참고로 남긴다 (MUSIC.md 9장)
                dest = emean(S[(t >= T + 20) & (t < T + 30)])
                over = S[(t >= T) & (t < T + 20)].max() - dest
                check(n, 'C8 reopen peak - dest bed LU', over, over <= 1.5, '<= +1.5')
                info(n, 'C8 literal peak - [T-15,T) LU', pk, '(info) solved bed - play + S swing')
                lr = rise(fr, T - 5, T + 20, skip=0)
                check(n, 'L4 rise [T-5,T+20) LU', lr, lr <= 3.5, '<= 3.5')
            if cue in ('solved', 'gaveup'):
                after = ebur(os.path.join(DIR, r['file']), T + 30, T + 90)['I'] - playI[(r['seed'], 'night')]
                if cue == 'solved':
                    check(n, 'C5 solved bed - play LU', after, rng_ok(after, 0.5, 2.5), '+0.5..+2.5')
                else:
                    check(n, 'C7 give-up bed - play LU', after, rng_ok(after, -1.0, 1.0), '-1.0..+1.0')
    for live in (False, True):
        c1 = {R[n]['seed']: meas[n]['C1'] for n in names if 'C1' in meas[n] and bool(R[n].get('live')) == live}
        for a, b in ((1, 5), (1, 12)):
            v = [c1[k] for k in range(a, b + 1) if k in c1]
            if len(v) == b - a + 1:
                med = float(np.median(v))
                check('cue-chapter%s-s%d..%d' % ('-live' if live else '', a, b), 'C1 median LU', med, rng_ok(med, 2.0, 3.5), '+2.0..+3.5')
    for sc in ('menu', 'play'):
        for seed in (1, 2, 3):
            d = abs(sceneI[(sc, seed, 'night')] - sceneI[(sc, seed, 'day')])
            check('bed-%s-s%d' % (sc, seed), '4.8 |night - day| LU', d, d <= 1.0, '<= 1.0')
            hf = 10 * math.log10(meas['bed-%s-night-s%d' % (sc, seed)]['b2k4k'] / meas['bed-%s-day-s%d' % (sc, seed)]['b2k4k'])
            check('bed-%s-s%d' % (sc, seed), '4.8 night - day 2-4 kHz dB', hf, hf <= 3.0, '<= +3.0')
    beds = [n for n in names if R[n]['kind'] == 'bed']  # 9.7: 대역별 좌우 균형의 기울기. 모든 바탕 렌더의 평균
    for lo in (120, 250):
        mu = float(np.mean([meas[n]['LR%d' % lo] for n in beds]))
        check('bed-* (%d renders)' % len(beds), 'S7m mean L-R %d-%d Hz dB' % (lo, 2 * lo), mu, abs(mu) <= 0.5, '|x| <= 0.5')
    full = meas['bed-play-night-s1']['I']
    for solo, (mid, tol) in {'pad': (-1.3, 1.0), 'drone': (-8.0, 1.5), 'texture': (-12.5, 1.5)}.items():
        d = meas['solo-' + solo]['I'] - full
        check('solo-' + solo, 'B1 solo - mix LU', d, rng_ok(d, mid - tol, mid + tol), '%+.1f +-%.1f' % (mid, tol))
    # 9.7-12: 건반은 드문 음이라 90초 게이트 음량이 시드마다 -9…-15 LU로 흩어진다(잔향의 음높이별 이득이 무작위, 9.2-1). 그래서 시드 8개의 중앙값으로 잰다.
    # 목표 중심 -12.0: 2차 구현의 시드 1–8 중앙값 -11.25에서, 엇갈림 뒤 8초 동안 건반을 여리게 친 만큼(-1.0 LU) 옮겼다. 시드 하나하나는 참고로 남긴다
    kb = []
    for seed in range(1, 9):
        d = meas['solo-keys' + ('' if seed == 1 else '-s%d' % seed)]['I'] - meas['bed-play-night-s%d' % seed]['I']
        kb.append(d)
        info('solo-keys-s%d' % seed, 'B1 keys solo - mix LU (one seed)', d, '(info) seed spread')
    med = float(np.median(kb))
    check('solo-keys-s1..8', 'B1 keys solo - mix median LU', med, rng_ok(med, -13.5, -10.5), '-12.0 +-1.5')
    sp = R['bed-play-night-s1']
    speed = sp['duration'] / (sp['renderMs'] / 1000)
    check('bed-play-night-s1', 'R1 render speed x', speed, speed >= 8, '>= 8')
    det = mf.get('determinism') or {}
    check('render x3', 'R2 deterministic', 1 if det.get('identical') else 0, det.get('identical') and det.get('seedsDiffer'), 'identical, seeds differ')
    check('all renders', 'page errors', len(mf.get('pageErrors', [])), not mf.get('pageErrors'), '0')
    for n, r in R.items():  # 노드 정리: 렌더가 끝나면 살아 있는 오실레이터는 LFO와 마지막 소리뿐
        if r['set'] == 'analysis':
            check(n, 'live oscillators at end', r.get('voicesAfter', 0), r.get('voicesAfter', 0) <= 50, '<= 50')
    return meas

def previews(mf, dest):
    os.makedirs(dest, exist_ok=True)
    out = []
    for n, r in mf['renders'].items():
        if r['set'] != 'preview':
            continue
        src = os.path.join(DIR, r['file'])
        if not os.path.exists(src):
            continue
        m = measure(src, r['window'][0], r['window'][1])
        common(n, m, 'preview')
        mp3, png = os.path.join(dest, n + '.mp3'), os.path.join(dest, n + '.png')
        subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-codec:a', 'libmp3lame', '-q:a', '2', mp3], check=True)
        subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-lavfi', 'showspectrumpic=s=1200x480:legend=1:stop=8000:scale=log', png], check=True)
        lr = rise(m['frames'], r['window'][0], r['window'][1])
        out.append({'file': os.path.basename(mp3), 'seconds': r['duration'], 'note': r.get('note', ''), 'I': round(m['I'], 1), 'TP': round(m['TP'], 1), 'rise': round(lr, 2), 'centroid': round(m['centroid']), 'hf4k%': round(m['hf4k'], 4)})
        print('  preview %-16s I %6.1f LUFS  TP %6.1f  rise %4.2f  centroid %4.0f Hz  -> %s' % (n, m['I'], m['TP'], lr, m['centroid'], mp3))
    with open(os.path.join(dest, 'previews.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    return out

def main():
    mf = json.load(open(os.path.join(DIR, 'manifest.json'), encoding='utf-8'))
    pv = opt('--previews')
    if pv:
        previews(mf, os.path.abspath(pv))
    if not pv or '--all' in sys.argv:
        analyze(mf)
    width = max((len(r['render']) for r in rows), default=10)
    if not QUIET:
        print()
        print('%-*s  %-30s %12s  %-24s %s' % (width, 'render', 'metric', 'value', 'target', 'result'))
        for r in rows:
            print('%-*s  %-30s %12s  %-24s %s' % (width, r['render'], r['metric'], '%.4g' % r['value'] if r['value'] is not None else '-', r['target'], 'info' if r.get('info') else 'PASS' if r['pass'] else 'FAIL'))
    for r in fails:
        print('FAIL %s %s = %s (target %s)' % (r['render'], r['metric'], r['value'], r['target']))
    if not pv or '--all' in sys.argv:
        os.makedirs(os.path.dirname(REPORT), exist_ok=True)
        with open(REPORT, 'w', encoding='utf-8') as f:
            json.dump({'sampleRate': mf.get('sampleRate'), 'renderedAt': mf.get('renderedAt'), 'musicJsBytes': mf.get('musicJsBytes'), 'checks': sum(1 for r in rows if not r.get('info')), 'failed': len(fails), 'rows': rows}, f, ensure_ascii=False, indent=1)
    print('MUSIC ANALYSIS: %s (%d checks, %d failed)' % ('ALL PASS' if not fails else 'FAILED', sum(1 for r in rows if not r.get('info')), len(fails)))
    sys.exit(1 if fails else 0)

if __name__ == '__main__':
    main()
