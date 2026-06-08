/**
 * fMP4 → standard MP4 defragmenter (pure JS, no native dependencies)
 * 
 * fMP4(Fragmented MP4): moov에 mvex 포함, 미디어 데이터가 moof+mdat 쌍으로 분산
 * 일반 MP4: 완전한 stbl을 가진 moov + 하나의 연속 mdat
 *
 * react-native-video / expo-video 모두 fMP4 로컬 파일 seeking에서 0초 리셋 현상 발생
 * → 이 유틸로 추가 시점에 한 번만 변환하면 이후 재생은 항상 안정적
 */

import * as FileSystem from 'expo-file-system';
import { File, Paths } from 'expo-file-system';

const MAX_CONVERT_BYTES = 200 * 1024 * 1024; // 200MB

// ─── 저수준 읽기 헬퍼 ───────────────────────────────────────────────────────

function r32(b: Uint8Array, o: number): number {
  return ((b[o] * 0x1000000) + (b[o+1] << 16) + (b[o+2] << 8) + b[o+3]) >>> 0;
}
function r16(b: Uint8Array, o: number): number { return (b[o] << 8) | b[o+1]; }
function r64(b: Uint8Array, o: number): number {
  return (r32(b, o) * 0x100000000) + r32(b, o + 4);
}
function rs32(b: Uint8Array, o: number): number {
  const v = r32(b, o); return v >= 0x80000000 ? v - 0x100000000 : v;
}
function tag(b: Uint8Array, o: number): string {
  return String.fromCharCode(b[o], b[o+1], b[o+2], b[o+3]);
}

// ─── 박스 스캔 ──────────────────────────────────────────────────────────────

interface Box { type: string; start: number; size: number; end: number }

function scanBoxes(b: Uint8Array, from: number, to: number): Box[] {
  const out: Box[] = [];
  let o = from;
  while (o + 8 <= to) {
    let sz = r32(b, o);
    let headerSize = 8;
    if (sz === 1) {
      if (o + 16 > to) break;
      sz = r64(b, o + 8);
      headerSize = 16;
    }
    
    if (sz < headerSize || sz > 0x7FFFFFFF) {
      console.warn(`[convertMP4] Unusual box size: ${sz} at offset ${o}.`);
      break;
    }
    
    if (o + sz > b.length) {
      out.push({ type: tag(b, o + 4), start: o, size: b.length - o, end: b.length });
      break;
    } 
    
    out.push({ type: tag(b, o + 4), start: o, size: sz, end: o + sz });
    o += sz;
  }
  return out;
}

function findBox(b: Uint8Array, from: number, to: number, t: string): Box | null {
  return scanBoxes(b, from, to).find(x => x.type === t) ?? null;
}

function findBoxes(b: Uint8Array, from: number, to: number, t: string): Box[] {
  return scanBoxes(b, from, to).filter(x => x.type === t);
}

// ─── Writer ──────────────────────────────────────────────────────────────────

class W {
  private parts: Uint8Array[] = [];
  size = 0;

  raw(d: Uint8Array) { this.parts.push(d); this.size += d.length; }
  u8(v: number)  { this.raw(new Uint8Array([v & 0xff])); }
  u16(v: number) { this.raw(new Uint8Array([(v >> 8) & 0xff, v & 0xff])); }
  u24(v: number) { this.raw(new Uint8Array([(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff])); }
  u32(v: number) {
    const n = v >>> 0;
    this.raw(new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]));
  }
  zeros(n: number) { this.raw(new Uint8Array(n)); }
  str4(s: string) { this.raw(new Uint8Array([s.charCodeAt(0), s.charCodeAt(1), s.charCodeAt(2), s.charCodeAt(3)])); }

  box(type: string, payload: W | Uint8Array) {
    const d = payload instanceof W ? payload.build() : payload;
    this.u32(8 + d.length);
    this.str4(type);
    this.raw(d);
  }

  build(): Uint8Array {
    const out = new Uint8Array(this.size);
    let o = 0;
    for (const p of this.parts) { out.set(p, o); o += p.length; }
    return out;
  }
}

// ─── 트랙 / 샘플 타입 ────────────────────────────────────────────────────────

interface TrexDef { dur: number; size: number; flags: number }

interface TrackMeta {
  id: number;
  timescale: number;
  handler: string;
  stsd: Uint8Array;
  trex: TrexDef;
  trakHeader: Uint8Array;
  samplesPerFragment: number[];
}

interface Sample {
  dts: number;
  dur: number;
  size: number;
  cts: number;
  sync: boolean;
  srcOff: number;
}

// ─── moov 파싱 ────────────────────────────────────────────────────────────────

function parseMoov(buf: Uint8Array, moov: Box): { tracks: TrackMeta[] } {
  const trexMap = new Map<number, TrexDef>();

  const mvex = findBox(buf, moov.start + 8, moov.end, 'mvex');
  if (mvex) {
    for (const trex of findBoxes(buf, mvex.start + 8, mvex.end, 'trex')) {
      const d = buf;
      const o = trex.start;
      const id = r32(d, o + 12);
      trexMap.set(id, { dur: r32(d, o + 20), size: r32(d, o + 24), flags: r32(d, o + 28) });
    }
  }

  const tracks: TrackMeta[] = [];
  for (const trak of findBoxes(buf, moov.start + 8, moov.end, 'trak')) {
    const tkhd = findBox(buf, trak.start + 8, trak.end, 'tkhd');
    if (!tkhd) continue;

    const ver = buf[tkhd.start + 8];
    const id = ver === 1 ? r32(buf, tkhd.start + 28) : r32(buf, tkhd.start + 20);

    const mdia = findBox(buf, trak.start + 8, trak.end, 'mdia');
    if (!mdia) continue;
    const mdhd = findBox(buf, mdia.start + 8, mdia.end, 'mdhd');
    if (!mdhd) continue;
    const mdhdVer = buf[mdhd.start + 8];
    const timescale = mdhdVer === 1 ? r32(buf, mdhd.start + 28) : r32(buf, mdhd.start + 20);

    const hdlr = findBox(buf, mdia.start + 8, mdia.end, 'hdlr');
    const handler = hdlr ? tag(buf, hdlr.start + 16) : 'vide';

    const minf = findBox(buf, mdia.start + 8, mdia.end, 'minf');
    const stbl = minf ? findBox(buf, minf.start + 8, minf.end, 'stbl') : null;
    const stsd = stbl ? findBox(buf, stbl.start + 8, stbl.end, 'stsd') : null;

    tracks.push({
      id,
      timescale,
      handler,
      stsd: stsd ? buf.subarray(stsd.start, stsd.end) : new Uint8Array(0),
      trex: trexMap.get(id) ?? { dur: 0, size: 0, flags: 0 },
      trakHeader: buf.subarray(trak.start, trak.end),
      samplesPerFragment: [],
    });
  }

  return { tracks };
}

// ─── moof 파싱 ────────────────────────────────────────────────────────────────

function parseMoof(
  buf: Uint8Array,
  moof: Box,
  mdatBodyStart: number,
  tracks: TrackMeta[],
  samplesByTrack: Map<number, Sample[]>,
  chunkOffsetsByTrack: Map<number, number[]>,
  currentNewMdatOffset: number,
) {
  for (const traf of findBoxes(buf, moof.start + 8, moof.end, 'traf')) {
    const tfhd = findBox(buf, traf.start + 8, traf.end, 'tfhd');
    if (!tfhd) continue;

    const tfhdFlags = r32(buf, tfhd.start + 8) & 0xffffff;
    let o = tfhd.start + 12;
    const trackId = r32(buf, o); o += 4;

    let baseDataOffset = moof.start;
    if (tfhdFlags & 0x000001) { baseDataOffset = r32(buf, o) * 0x100000000 + r32(buf, o + 4); o += 8; }
    
    let defDur = 0, defSize = 0, defFlags = 0;
    if (tfhdFlags & 0x000002) { o += 4; } // sample_description_index
    if (tfhdFlags & 0x000008) { defDur   = r32(buf, o); o += 4; }
    if (tfhdFlags & 0x000010) { defSize  = r32(buf, o); o += 4; }
    if (tfhdFlags & 0x000020) { defFlags = r32(buf, o); o += 4; }

    const track = tracks.find(t => t.id === trackId);
    if (!track) continue;
    if (!samplesByTrack.has(trackId)) samplesByTrack.set(trackId, []);
    if (!chunkOffsetsByTrack.has(trackId)) chunkOffsetsByTrack.set(trackId, []);

    const trex = track.trex;
    if (!defDur)   defDur   = trex.dur;
    if (!defSize)  defSize  = trex.size;
    if (!defFlags) defFlags = trex.flags;

    const tfdt = findBox(buf, traf.start + 8, traf.end, 'tfdt');
    let curDts = 0;
    if (tfdt) {
      const tdVer = buf[tfdt.start + 8];
      curDts = tdVer === 1
        ? r32(buf, tfdt.start + 12) * 0x100000000 + r32(buf, tfdt.start + 16)
        : r32(buf, tfdt.start + 12);
    } else {
      const prev = samplesByTrack.get(trackId)!;
      if (prev.length > 0) curDts = prev[prev.length - 1].dts + prev[prev.length - 1].dur;
    }

    for (const trun of findBoxes(buf, traf.start + 8, traf.end, 'trun')) {
      const trunFlags = r32(buf, trun.start + 8) & 0xffffff;
      let p = trun.start + 12;
      const sampleCount = r32(buf, p); p += 4;

      let dataOffset = 0;
      if (trunFlags & 0x000001) { dataOffset = rs32(buf, p); p += 4; }
      
      let firstSampleFlags = defFlags;
      if (trunFlags & 0x000004) { firstSampleFlags = r32(buf, p); p += 4; }

      const origAbsOffset = baseDataOffset + dataOffset;
      const offsetInMdatBody = origAbsOffset - mdatBodyStart;
      chunkOffsetsByTrack.get(trackId)!.push(currentNewMdatOffset + offsetInMdatBody);
      track.samplesPerFragment.push(sampleCount);

      for (let i = 0; i < sampleCount; i++) {
        let dur = defDur, size = defSize, flags = (i === 0) ? firstSampleFlags : defFlags;
        let cts = 0;

        if (trunFlags & 0x000100) { dur   = r32(buf, p); p += 4; }
        if (trunFlags & 0x000200) { size  = r32(buf, p); p += 4; }
        if (trunFlags & 0x000400) { flags = r32(buf, p); p += 4; }
        if (trunFlags & 0x000800) { cts   = rs32(buf, p); p += 4; }

        const isSync = !((flags >> 16) & 0x01);
        samplesByTrack.get(trackId)!.push({ dts: curDts, dur, size, cts, sync: isSync, srcOff: 0 });
        curDts += dur;
      }
    }
  }
}

// ─── stbl 빌드 ───────────────────────────────────────────────────────────────

function buildStbl(
  stsd: Uint8Array,
  samples: Sample[],
  chunkOffsets: number[],
  samplesPerChunk: number[],
): Uint8Array {
  const sttsPairs: number[] = [];
  let sttsEntries = 0, prevDur = -1, runCount = 0;
  for (const s of samples) {
    if (s.dur === prevDur) { runCount++; }
    else { if (prevDur >= 0) { sttsPairs.push(runCount, prevDur); sttsEntries++; } prevDur = s.dur; runCount = 1; }
  }
  if (runCount > 0) { sttsPairs.push(runCount, prevDur); sttsEntries++; }
  const sttsPayload = new W();
  sttsPayload.u32(0); sttsPayload.u32(sttsEntries);
  for (let i = 0; i < sttsPairs.length; i += 2) { sttsPayload.u32(sttsPairs[i]); sttsPayload.u32(sttsPairs[i+1]); }

  const hasCts = samples.some(s => s.cts !== 0);
  let cttsPayload: W | null = null;
  if (hasCts) {
    cttsPayload = new W();
    cttsPayload.u32(0x01000000);
    cttsPayload.u32(samples.length);
    for (const s of samples) { cttsPayload.u32(1); cttsPayload.u32(s.cts >>> 0); }
  }

  const syncIdxs: number[] = [];
  samples.forEach((s, i) => { if (s.sync) syncIdxs.push(i + 1); });
  let stssPayload: W | null = null;
  if (syncIdxs.length > 0 && syncIdxs.length < samples.length) {
    stssPayload = new W();
    stssPayload.u32(0); stssPayload.u32(syncIdxs.length);
    for (const idx of syncIdxs) stssPayload.u32(idx);
  }

  const stscPayload = new W();
  stscPayload.u32(0);
  stscPayload.u32(samplesPerChunk.length);
  for (let i = 0; i < samplesPerChunk.length; i++) {
    stscPayload.u32(i + 1);
    stscPayload.u32(samplesPerChunk[i]);
    stscPayload.u32(1);
  }

  const stszPayload = new W();
  stszPayload.u32(0); stszPayload.u32(0); stszPayload.u32(samples.length);
  for (const s of samples) stszPayload.u32(s.size);

  const stcoPayload = new W();
  stcoPayload.u32(0);
  stcoPayload.u32(chunkOffsets.length);
  for (const off of chunkOffsets) stcoPayload.u32(off);

  const out = new W();
  out.raw(stsd);
  out.box('stts', sttsPayload.build());
  if (cttsPayload) out.box('ctts', cttsPayload.build());
  if (stssPayload) out.box('stss', stssPayload.build());
  out.box('stsc', stscPayload.build());
  out.box('stsz', stszPayload.build());
  out.box('stco', stcoPayload.build());
  return out.build();
}

// ─── moov 재구성 ────────────────────────────────────────────────────────────

function rebuildMoov(
  buf: Uint8Array,
  moov: Box,
  tracks: TrackMeta[],
  samplesByTrack: Map<number, Sample[]>,
  chunkOffsetsByTrack: Map<number, number[]>,
): Uint8Array {
  const out = new W();
  for (const child of scanBoxes(buf, moov.start + 8, moov.end)) {
    if (child.type === 'mvex') continue;
    if (child.type === 'trak') {
      const tkhd = findBox(buf, child.start + 8, child.end, 'tkhd');
      if (tkhd) {
        const ver = buf[tkhd.start + 8];
        const tid = ver === 1 ? r32(buf, tkhd.start + 28) : r32(buf, tkhd.start + 20);
        const track = tracks.find(t => t.id === tid);
        if (track) {
          const samples = samplesByTrack.get(track.id) ?? [];
          const chunkOffsets = chunkOffsetsByTrack.get(track.id) ?? [];
          const newStbl = buildStbl(track.stsd, samples, chunkOffsets, track.samplesPerFragment);
          const trakOut = new W();
          for (const tc of scanBoxes(buf, child.start + 8, child.end)) {
            if (tc.type !== 'mdia') { trakOut.raw(buf.subarray(tc.start, tc.end)); continue; }
            const mdiaOut = new W();
            for (const mc of scanBoxes(buf, tc.start + 8, tc.end)) {
              if (mc.type !== 'minf') { mdiaOut.raw(buf.subarray(mc.start, mc.end)); continue; }
              const minfOut = new W();
              for (const mnc of scanBoxes(buf, mc.start + 8, mc.end)) {
                if (mnc.type !== 'stbl') { minfOut.raw(buf.subarray(mnc.start, mnc.end)); continue; }
                minfOut.box('stbl', newStbl);
              }
              mdiaOut.box('minf', minfOut.build());
            }
            trakOut.box('mdia', mdiaOut.build());
          }
          out.box('trak', trakOut.build());
          continue;
        }
      }
    }
    out.raw(buf.subarray(child.start, child.end));
  }
  return out.build();
}

// ─── Fast-start: late-moov 표준 MP4 → moov를 파일 앞으로 이동 ──────────────

function patchStcoOffsets(moovBuf: Uint8Array, delta: number): Uint8Array {
  const out = new Uint8Array(moovBuf);
  const CONTAINERS = new Set(['moov','trak','mdia','minf','stbl','edts','udta','dinf','meta','ilst']);

  function walk(from: number, to: number) {
    for (const box of scanBoxes(out, from, to)) {
      if (box.type === 'stco') {
        const count = r32(out, box.start + 12);
        for (let i = 0; i < count; i++) {
          const off = box.start + 16 + i * 4;
          const newVal = (r32(out, off) + delta) >>> 0;
          out[off]   = (newVal >>> 24) & 0xff;
          out[off+1] = (newVal >>> 16) & 0xff;
          out[off+2] = (newVal >>> 8)  & 0xff;
          out[off+3] =  newVal         & 0xff;
        }
      } else if (box.type === 'co64') {
        const count = r32(out, box.start + 12);
        for (let i = 0; i < count; i++) {
          const off = box.start + 16 + i * 8;
          const loOld = r32(out, off + 4);
          const loNew = (loOld + delta) >>> 0;
          const hiNew = (r32(out, off) + (loOld + delta > 0xFFFFFFFF ? 1 : 0)) >>> 0;
          out[off]   = (hiNew >>> 24) & 0xff;
          out[off+1] = (hiNew >>> 16) & 0xff;
          out[off+2] = (hiNew >>> 8)  & 0xff;
          out[off+3] =  hiNew         & 0xff;
          out[off+4] = (loNew >>> 24) & 0xff;
          out[off+5] = (loNew >>> 16) & 0xff;
          out[off+6] = (loNew >>> 8)  & 0xff;
          out[off+7] =  loNew         & 0xff;
        }
      } else if (CONTAINERS.has(box.type)) {
        walk(box.start + 8, box.end);
      }
    }
  }
  walk(8, out.length);
  return out;
}

function faststartBuffer(buf: Uint8Array, top: Box[]): Uint8Array[] | null {
  const ftypBox = top.find(b => b.type === 'ftyp');
  const moovBox = top.find(b => b.type === 'moov');
  const firstMdat = top.find(b => b.type === 'mdat');

  if (!moovBox || !firstMdat) return null;
  if (moovBox.start < firstMdat.start) return null; // already fast-start

  const ftypData = ftypBox ? buf.subarray(ftypBox.start, ftypBox.end) : new Uint8Array(0);
  const moovData = buf.subarray(moovBox.start, moovBox.end);

  // moov를 mdat 앞으로 이동하면 mdat의 절대 위치가 moov.size만큼 증가
  const patchedMoov = patchStcoOffsets(moovData, moovData.length);

  const rest: Uint8Array[] = [];
  for (const box of top) {
    if (box.type === 'ftyp' || box.type === 'moov') continue;
    rest.push(buf.subarray(box.start, box.end));
  }

  console.log(`[convertMP4] fast-start 적용: moov(${(moovData.length/1024).toFixed(1)}KB) → 파일 앞으로 이동`);
  return [ftypData, patchedMoov, ...rest];
}

// ─── 메인 변환 함수 ──────────────────────────────────────────────────────────

function defragmentBuffer(buf: Uint8Array): Uint8Array[] {
  const top = scanBoxes(buf, 0, buf.length);
  console.log('[convertMP4] 상위 박스 목록:', top.map(b => `${b.type}(${(b.size/1024/1024).toFixed(2)}MB)`).join(', '));

  const ftypBox = top.find(b => b.type === 'ftyp');
  const moovBox = top.find(b => b.type === 'moov');
  if (!moovBox) return [buf];

  // moof 없음 → 표준 MP4; moov가 mdat 뒤에 있으면 fast-start로 재배치
  if (!top.some(b => b.type === 'moof')) {
    return faststartBuffer(buf, top) ?? [buf];
  }

  const { tracks } = parseMoov(buf, moovBox);
  tracks.forEach(t => t.samplesPerFragment = []);

  const samplesByTrack = new Map<number, Sample[]>();
  const chunkOffsetsByTrack = new Map<number, number[]>();
  const mdatChunks: Uint8Array[] = [];
  let currentNewMdatOffset = 0;

  for (let i = 0; i < top.length; i++) {
    if (top[i].type !== 'moof') continue;
    const moof = top[i];
    let mdat: Box | undefined;
    for (let j = i + 1; j < top.length; j++) { if (top[j].type === 'mdat') { mdat = top[j]; break; } }
    if (!mdat) continue;

    const mdatHeaderSize = r32(buf, mdat.start) === 1 ? 16 : 8;
    const mdatBodyStart = mdat.start + mdatHeaderSize;
    const mdatBodyLen = mdat.size - mdatHeaderSize;

    parseMoof(buf, moof, mdatBodyStart, tracks, samplesByTrack, chunkOffsetsByTrack, currentNewMdatOffset);
    
    mdatChunks.push(buf.subarray(mdatBodyStart, mdat.end));
    currentNewMdatOffset += mdatBodyLen;
  }

  if (mdatChunks.length === 0) return [buf];

  // Dummy pass to get moov length
  const dummyMoov = rebuildMoov(buf, moovBox, tracks, samplesByTrack, chunkOffsetsByTrack);
  const ftypData = ftypBox ? buf.subarray(ftypBox.start, ftypBox.end) : new Uint8Array(0);
  const mdatStart = ftypData.length + (8 + dummyMoov.length) + 8;

  // Real offsets
  for (const [_, offsets] of chunkOffsetsByTrack) {
    for (let k = 0; k < offsets.length; k++) offsets[k] += mdatStart;
  }

  const finalMoov = rebuildMoov(buf, moovBox, tracks, samplesByTrack, chunkOffsetsByTrack);
  const mdatTotalSize = currentNewMdatOffset;

  const parts: Uint8Array[] = [];
  parts.push(ftypData);
  const moovW = new W(); moovW.box('moov', finalMoov); parts.push(moovW.build());
  const mdatHeaderW = new W(); mdatHeaderW.u32(8 + mdatTotalSize); mdatHeaderW.str4('mdat'); parts.push(mdatHeaderW.build());
  for (const chunk of mdatChunks) parts.push(chunk);

  return parts;
}


// ─── 공개 API ────────────────────────────────────────────────────────────────

function find4CC(buf: Uint8Array, type: string): number {
  const t0 = type.charCodeAt(0), t1 = type.charCodeAt(1), t2 = type.charCodeAt(2), t3 = type.charCodeAt(3);
  for (let i = 0; i < buf.length - 4; i++) {
    if (buf[i] === t0 && buf[i+1] === t1 && buf[i+2] === t2 && buf[i+3] === t3) return i;
  }
  return -1;
}

async function writePartsToFile(path: string, parts: Uint8Array[], onProgress?: (ratio: number) => void) {
  console.log(`[convertMP4] 단계 6: 파일 저장 시작 (파트 수: ${parts.length})`);
  
  // FileHandle API (SDK 54) 시도
  const file = new File(path);
  try {
    const handle = file.open();
    let written = 0;
    const total = parts.reduce((s, p) => s + p.length, 0);
    
    for (const part of parts) {
      const MAX_WRITE = 1024 * 1024 * 2;
      for (let offset = 0; offset < part.length; offset += MAX_WRITE) {
        const chunk = part.subarray(offset, Math.min(offset + MAX_WRITE, part.length));
        handle.writeBytes(chunk);
        written += chunk.length;
        if (onProgress) onProgress(0.85 + (written / total) * 0.15);
      }
    }
    handle.close();
    console.log(`[convertMP4] 단계 6 완료: ${written} 바이트 저장됨`);
  } catch (e) {
    console.warn('[convertMP4] modern write failed, falling back to legacy:', e);
    // Legacy fallback (OOM risk but better than nothing)
    // Note: append:true with base64 often fails, so we do one big write if small enough
    const total = parts.reduce((s, p) => s + p.length, 0);
    if (total > 50 * 1024 * 1024) throw new Error('파일이 너무 커서 레거시 저장 방식을 사용할 수 없습니다.');
    
    const fullBuf = new Uint8Array(total);
    let o = 0;
    for (const p of parts) { fullBuf.set(p, o); o += p.length; }
    
    // btoa is safe for Latin1
    let binary = '';
    for (let i = 0; i < fullBuf.length; i += 8192) {
      binary += String.fromCharCode(...(fullBuf.subarray(i, i + 8192) as any));
    }
    const b64 = btoa(binary);
    await FileSystem.writeAsStringAsync(path, b64, { encoding: 'base64' });
  }
}

export async function isFragmentedMP4(filePath: string): Promise<boolean> {
  try {
    const file = new File(filePath);
    if (!file.exists) return false;
    const fileSize = file.size;

    const headLen = Math.min(fileSize, 2 * 1024 * 1024);
    const handle = file.open();
    const headBuf = handle.readBytes(headLen);
    handle.close();
    
    if (find4CC(headBuf, 'moof') !== -1) return true;
    const moovPos = find4CC(headBuf, 'moov');
    if (moovPos !== -1) {
      const moovLimit = Math.min(headBuf.length, moovPos + 1024 * 512);
      if (find4CC(headBuf.subarray(moovPos, moovLimit), 'mvex') !== -1) return true;
      if (moovPos < 1024 * 1024) return false;
    }

    if (fileSize > 2 * 1024 * 1024) {
      const tailLen = Math.min(fileSize - headLen, 2 * 1024 * 1024);
      const tailHandle = file.open();
      tailHandle.offset = fileSize - tailLen;
      const tailBuf = tailHandle.readBytes(tailLen);
      tailHandle.close();
      if (find4CC(tailBuf, 'moof') !== -1 || find4CC(tailBuf, 'moov') !== -1) return true;
    }
    return false; 
  } catch (e) { return true; }
}

export async function ensureStandardMP4(inputPath: string, onProgress?: (ratio: number) => void): Promise<string> {
  // 이미 변환된 파일은 다시 하지 않음 (무한 루프 방지)
  if (inputPath.includes('pip_converted_')) return inputPath;

  let input: Uint8Array | null = null;
  let outputParts: Uint8Array[] | null = null;

  try {
    const file = new File(inputPath);
    if (!file.exists) return inputPath;
    const fileSize = file.size;

    console.log(`[convertMP4] 단계 3: 용량 체크 (${(fileSize / 1024 / 1024).toFixed(2)}MB)`);
    if (fileSize > MAX_CONVERT_BYTES) return inputPath;

    console.log('[convertMP4] 단계 4: 변환 필요 여부 확인 중...');
    if (!(await isFragmentedMP4(inputPath))) {
      console.log('[convertMP4] 변환 불필요');
      return inputPath;
    }

    console.log(`[convertMP4] 단계 5: 변환 시작...`);
    onProgress?.(0.05);

    input = new Uint8Array(fileSize);
    const readHandle = file.open();
    const readChunkSize = 1024 * 1024 * 4; 
    for (let offset = 0; offset < fileSize; offset += readChunkSize) {
      const length = Math.min(readChunkSize, fileSize - offset);
      readHandle.offset = offset;
      const chunkBuf = readHandle.readBytes(length);
      input.set(chunkBuf, offset);
      onProgress?.(0.05 + (offset / fileSize) * 0.45);
    }
    readHandle.close();
    
    outputParts = defragmentBuffer(input);
    input = null;
    console.log('[convertMP4] 단계 5 완료: 변환 로직 성공');
    onProgress?.(0.85);

    const ext = inputPath.includes('.') ? inputPath.split('.').pop() : 'mp4';
    const outPath = `${Paths.cache.uri}/pip_converted_${Date.now()}.${ext}`;
    await writePartsToFile(outPath, outputParts, onProgress);
    outputParts = null; 

    console.log('[convertMP4] 최종 성공! 저장 경로:', outPath);
    onProgress?.(1.0);
    return outPath;
  } catch (err: any) {
    console.error('[convertMP4] 변환 에러 발생:', err);
    return inputPath;
  } finally {
    input = null; outputParts = null;
  }
}
