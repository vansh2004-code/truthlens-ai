import pytest

from app.services import validation as v


def test_signature_ok_and_mismatch():
    mp4 = b"\x00\x00\x00\x18ftypisom" + b"\x00" * 50
    assert v.check_signature("a.mp4", mp4)[0] == ".mp4"
    with pytest.raises(v.ValidationError) as e:
        v.check_signature("a.webm", mp4)
    assert e.value.code == "signature_mismatch"


def test_rejects_unknown_extension_and_garbage():
    with pytest.raises(v.ValidationError) as e:
        v.check_signature("a.exe", b"MZ" + b"\x00" * 60)
    assert e.value.code == "unsupported_extension"
    with pytest.raises(v.ValidationError) as e:
        v.check_signature("a.mp4", b"not a video at all" * 4)
    assert e.value.code == "bad_signature"


def test_probe_valid_and_corrupt(sample_video, tmp_path):
    info = v.probe(sample_video)
    assert (info.width, info.height) == (320, 240) and info.has_audio and 3.5 < info.duration < 4.5
    bad = tmp_path / "bad.mp4"
    bad.write_bytes(b"\x00\x00\x00\x18ftypisom" + b"\xff" * 4096)
    with pytest.raises(v.ValidationError) as e:
        v.probe(bad)
    assert e.value.code in ("malformed_media", "no_video_stream", "no_duration")
