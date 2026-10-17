"""JSON and PDF reports. Reports restate results with their limitations; they never upgrade a score into a verdict of authenticity."""
import io
import json
from datetime import datetime, timezone

from ..models import Analysis
from . import storage

VERDICT_LABEL = {
    "potential_manipulation": "Potential manipulation detected",
    "no_strong_indicators": "No strong manipulation indicators detected",
    "inconclusive": "Inconclusive",
    "failed": "Analysis failed",
}
DISCLAIMER = ("This report is an automated, model-based assessment intended to support human review. Scores are uncalibrated and "
              "are not probabilities. It cannot prove that a video is authentic or manipulated.")


def report_dict(a: Analysis) -> dict:
    m = a.media
    return {
        "report_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "disclaimer": DISCLAIMER,
        "analysis": {
            "id": a.id, "status": a.status.value, "verdict": a.verdict.value if a.verdict else None,
            "verdict_label": VERDICT_LABEL.get(a.verdict.value) if a.verdict else None,
            "score": a.score, "score_note": "Uncalibrated model score (median over usable face frames); not a probability.",
            "explanation": a.explanation, "created_at": a.created_at.isoformat(), "duration_ms": a.duration_ms,
            "processing_config": a.config,
        },
        "media": {"filename": m.original_filename, "sha256": m.sha256, "size_bytes": m.size_bytes, "container": m.container,
                  "codec": m.codec, "duration_seconds": m.duration_seconds, "resolution": f"{m.width}x{m.height}", "fps": m.fps, "has_audio": m.has_audio},
        "models": [{"name": i.model_name, "version": i.model_version, "device": i.device, "frames_analyzed": i.frames_analyzed,
                    "mean_score": i.mean_score, "max_score": i.max_score, "flagged_fraction": i.flagged_fraction, "details": i.details} for i in a.inferences],
        "temporal_analysis": a.temporal,
        "audio_analysis": a.audio,
        "frames": [{"index": f.frame_index, "timestamp_s": f.timestamp, "face_detected": f.face_detected, "track_id": f.track_id,
                    "score": f.score, "flagged": f.flagged, "quality": f.quality, "note": f.note} for f in a.frames],
        "limitations": a.limitations,
    }


def build_json_report(a: Analysis) -> bytes:
    return json.dumps(report_dict(a), indent=2).encode()


def build_pdf_report(a: Analysis) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    d = report_dict(a)
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
                            title=f"TruthLens AI report {a.id}", author="TruthLens AI")
    ss = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=ss["Title"], fontSize=20, textColor=colors.HexColor("#0b1020"), alignment=0)
    h2 = ParagraphStyle("h2", parent=ss["Heading2"], fontSize=12, textColor=colors.HexColor("#3b4cca"), spaceBefore=10)
    body = ParagraphStyle("b", parent=ss["BodyText"], fontSize=9.5, leading=13)
    small = ParagraphStyle("s", parent=body, fontSize=8, textColor=colors.HexColor("#555555"))
    esc = lambda t: str(t).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")  # noqa: E731
    story = [Paragraph("TruthLens AI — Media Forensics Report", h1), Paragraph(f"Analysis {a.id}", small), Spacer(1, 6)]
    story += [Paragraph("Result", h2), Paragraph(f"<b>{esc(d['analysis']['verdict_label'] or d['analysis']['status'])}</b>", body)]
    if a.score is not None:
        story.append(Paragraph(f"Median model score: {a.score:.3f} (uncalibrated, not a probability)", body))
    story += [Paragraph(esc(a.explanation), body), Paragraph("Video", h2)]
    m = d["media"]
    story.append(Table([["File", m["filename"]], ["SHA-256", m["sha256"][:32] + "…"], ["Duration", f"{m['duration_seconds']:.1f}s"],
                        ["Resolution / FPS", f"{m['resolution']} @ {m['fps']}"], ["Audio track", "yes" if m["has_audio"] else "no"]],
                       colWidths=[38 * mm, 130 * mm], style=TableStyle([("FONTSIZE", (0, 0), (-1, -1), 8.5), ("GRID", (0, 0), (-1, -1), 0.25, colors.lightgrey)])))
    story.append(Paragraph("Models", h2))
    for mo in d["models"]:
        story.append(Paragraph(f"{esc(mo['name'])} — version {esc(mo['version'])} on {esc(mo['device'])}; {mo['frames_analyzed']} frames scored.", body))
    t = d["temporal_analysis"]
    story.append(Paragraph("Temporal analysis", h2))
    if t.get("performed"):
        ivs = ", ".join(f"{i['start']:.1f}–{i['end']:.1f}s" for i in t["suspicious_intervals"]) or "none"
        story.append(Paragraph(f"Frames considered: {t['frames_considered']}. Pattern: {t['pattern']}. Flagged intervals: {ivs}.", body))
    else:
        story.append(Paragraph(esc(t.get("reason", "Not performed.")), body))
    au = d["audio_analysis"]
    story += [Paragraph("Audio", h2), Paragraph("Not performed: " + esc(au.get("reason", "")) if au.get("status") != "performed" else f"Mean audio score {au['mean_score']} (uncalibrated).", body)]
    top = sorted([f for f in a.frames if f.overlay_key], key=lambda f: -(f.score or 0))[:4]
    if top:
        story.append(Paragraph("Highest-scoring evidence (input-gradient saliency; indicative only)", h2))
        row = []
        for f in top:
            try:
                row.append([Image(str(storage.safe_path("frames", f.overlay_key)), 38 * mm, 38 * mm), Paragraph(f"t={f.timestamp:.1f}s<br/>score {f.score:.2f}", small)])
            except Exception:  # noqa: BLE001
                continue
        if row:
            story.append(Table([[c[0] for c in row], [c[1] for c in row]], style=TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER")])))
    story.append(Paragraph("Frame log", h2))
    rows = [["#", "Time (s)", "Face", "Score", "Flagged", "Note"]] + [
        [f["index"], f"{f['timestamp_s']:.1f}", "yes" if f["face_detected"] else "no", "" if f["score"] is None else f"{f['score']:.2f}", "yes" if f["flagged"] else "", esc(f["note"])[:60]]
        for f in d["frames"][:80]]
    story.append(Table(rows, repeatRows=1, style=TableStyle([("FONTSIZE", (0, 0), (-1, -1), 7), ("GRID", (0, 0), (-1, -1), 0.25, colors.lightgrey), ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8ebff"))])))
    story.append(Paragraph("Limitations", h2))
    story += [Paragraph("• " + esc(x), body) for x in d["limitations"]]
    story += [Spacer(1, 8), Paragraph(esc(DISCLAIMER), small)]
    doc.build(story)
    return buf.getvalue()
