# -*- coding: utf-8 -*-
"""HWP 배포용(distribution) 문서의 ViewText 스트림을 복호화해 본문 텍스트를 뽑는다.

알고리즘:
  1) ViewText/SectionN 의 첫 레코드(HWPTAG_DISTRIBUTE_DOC_DATA, 256바이트)에서
     MSVC rand() 호환 LCG + XOR 로 256바이트 payload를 복호화.
  2) AES-128 키 = payload[4 + (payload[0] & 0x0F) : +16].
  3) 나머지 스트림을 AES-128-ECB 로 복호화.
  4) (압축 플래그가 켜져 있으면) raw-deflate 로 압축 해제 -> 섹션 레코드 스트림.
  5) HWPTAG_PARA_TEXT 레코드의 UTF-16LE 텍스트를 제어문자 처리하며 추출.
"""
import struct
import zlib
import olefile
from Crypto.Cipher import AES

HWPTAG_BEGIN = 0x10
HWPTAG_PARA_TEXT = HWPTAG_BEGIN + 51  # 67

# PARA_TEXT 안의 제어문자 폭(wchar 단위). 확장/인라인 제어는 8 wchar(16바이트) 차지.
EXTENDED_CTRL = {1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23}
# 단일 제어(1 wchar): 0, 10, 13, 24~31


class _Lcg:
    """MSVC CRT rand() 호환 선형합동난수."""
    def __init__(self, seed):
        self.seed = seed & 0xFFFFFFFF

    def rand(self):
        self.seed = (self.seed * 214013 + 2531011) & 0xFFFFFFFF
        return (self.seed >> 16) & 0x7FFF


def _decode_payload(payload):
    """256바이트 payload를 LCG+XOR로 복호화."""
    data = bytearray(payload)
    seed = struct.unpack("<I", data[:4])[0]
    lcg = _Lcg(seed)
    n = 0
    key = 0
    for i in range(256):
        if n == 0:
            key = lcg.rand() & 0xFF
            n = (lcg.rand() & 0x0F) + 1
        if i >= 4:
            data[i] ^= key
        n -= 1
    return bytes(data)


def decrypt_viewtext(stream):
    """ViewText 스트림 -> 압축 해제된 섹션 레코드 바이트."""
    header = struct.unpack("<I", stream[:4])[0]
    tag = header & 0x3FF
    size = (header >> 20) & 0xFFF
    if tag != 28 or size != 256:
        raise ValueError(f"예상과 다른 첫 레코드: tag={tag}, size={size}")
    payload = _decode_payload(stream[4:4 + 256])
    offset = 4 + (payload[0] & 0x0F)
    aes_key = payload[offset:offset + 16]
    body = stream[4 + 256:]
    dec = AES.new(aes_key, AES.MODE_ECB).decrypt(body)
    # raw-deflate 압축 해제 (배포용 문서는 보통 압축됨)
    try:
        return zlib.decompress(dec, -15)
    except zlib.error:
        return dec  # 비압축인 경우 그대로


def iter_records(buf):
    """섹션 레코드 스트림을 순회: (tag, level, payload) 생성."""
    pos = 0
    n = len(buf)
    while pos + 4 <= n:
        header = struct.unpack("<I", buf[pos:pos + 4])[0]
        tag = header & 0x3FF
        level = (header >> 10) & 0x3FF
        size = (header >> 20) & 0xFFF
        pos += 4
        if size == 0xFFF:  # 확장 크기
            size = struct.unpack("<I", buf[pos:pos + 4])[0]
            pos += 4
        payload = buf[pos:pos + size]
        pos += size
        yield tag, level, payload


def _decode_para_text(payload):
    """PARA_TEXT payload(UTF-16LE + 인라인 제어문자) -> 일반 텍스트."""
    out = []
    i = 0
    n = len(payload)
    while i + 2 <= n:
        code = struct.unpack("<H", payload[i:i + 2])[0]
        if code in EXTENDED_CTRL:
            i += 16  # 제어 1 + 데이터 6 + 제어 1 = 8 wchar
            continue
        if code in (10, 13):
            out.append("\n")
            i += 2
            continue
        if code < 32:
            i += 2  # 기타 단일 제어문자 무시
            continue
        if 0xD800 <= code <= 0xDBFF and i + 4 <= n:  # UTF-16 상위 대리(보충면 한자)
            low = struct.unpack("<H", payload[i + 2:i + 4])[0]
            if 0xDC00 <= low <= 0xDFFF:
                out.append(chr(0x10000 + ((code - 0xD800) << 10) + (low - 0xDC00)))
                i += 4
                continue
        out.append(chr(code))
        i += 2
    return "".join(out)


def extract_text(path):
    """HWP 파일 -> 섹션별 본문 텍스트 리스트."""
    ole = olefile.OleFileIO(path)
    sections = []
    streams = ["/".join(s) for s in ole.listdir()]
    view_secs = sorted(s for s in streams if s.startswith("ViewText/Section"))
    for sec in view_secs:
        raw = ole.openstream(sec).read()
        buf = decrypt_viewtext(raw)
        paras = []
        for tag, level, payload in iter_records(buf):
            if tag == HWPTAG_PARA_TEXT:
                paras.append(_decode_para_text(payload))
        sections.append("\n".join(paras))
    ole.close()
    return sections


if __name__ == "__main__":
    import sys
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    secs = extract_text(sys.argv[1])
    full = "\n".join(secs)
    print(f"sections: {len(secs)}, chars: {len(full)}")
    print(full[:2000])
