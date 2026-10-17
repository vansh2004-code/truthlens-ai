"""Temporal consistency analysis over per-frame scores of usable (face, adequate-quality) frames."""
from statistics import mean, median, pstdev


def analyze_temporal(points: list[dict], threshold: float) -> dict:
    """points: [{timestamp, score, flagged}] sorted by time. Returns descriptive statistics.
    These describe model-output behavior over time; they are not independent proof of manipulation."""
    if len(points) < 2:
        return {"performed": False, "reason": "Fewer than 2 usable frames; temporal analysis not possible.", "intervals": []}
    scores = [p["score"] for p in points]
    diffs = [abs(b - a) for a, b in zip(scores, scores[1:])]
    sd = pstdev(diffs) if len(diffs) > 1 else 0.0
    md = mean(diffs)
    spike_cut = max(0.35, md + sd)
    spikes = [
        {"from": points[i]["timestamp"], "to": points[i + 1]["timestamp"], "delta": round(d, 3)}
        for i, d in enumerate(diffs) if d >= spike_cut
    ]
    intervals, start, last = [], None, None
    for p in points:
        if p["flagged"]:
            if start is None:
                start = p
            last = p
        elif start is not None:
            intervals.append({"start": start["timestamp"], "end": last["timestamp"]})
            start = None
    if start is not None:
        intervals.append({"start": start["timestamp"], "end": last["timestamp"]})
    for iv in intervals:
        iv["mean_score"] = round(mean(p["score"] for p in points if iv["start"] <= p["timestamp"] <= iv["end"]), 3)
    return {
        "performed": True,
        "frames_considered": len(points),
        "score_mean": round(mean(scores), 4),
        "score_median": round(median(scores), 4),
        "score_std": round(pstdev(scores), 4),
        "mean_abs_frame_delta": round(md, 4),
        "spikes": spikes,
        "suspicious_intervals": intervals,
        "pattern": (
            "sustained" if intervals and len(intervals) == 1 and sum(p["flagged"] for p in points) / len(points) > 0.6
            else "intermittent" if intervals else "none"
        ),
        "note": "Temporal statistics describe how the model's scores vary over time. Large swings can also come from "
                "compression, motion, lighting or occlusion and are not proof of manipulation.",
    }
