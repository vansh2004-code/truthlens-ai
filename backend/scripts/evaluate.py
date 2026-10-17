"""Reproducible evaluation on a labeled dataset you are licensed to use.
Layout: <root>/{train,val,test}/{real,fake}/*.mp4 ; only the 'test' split is scored; the threshold is picked on 'val'.
Reports precision/recall/F1/ROC-AUC/confusion matrix. Writes nothing if the dataset is missing. No numbers are invented.
Usage: python scripts/evaluate.py /path/to/dataset"""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[1]))
from app.ml.faces import HaarFaceDetector  # noqa: E402
from app.ml.hf_classifier import HFImageClassifier  # noqa: E402
from app.ml.pipeline import run_pipeline  # noqa: E402
from app.services.validation import probe  # noqa: E402


def video_score(p: Path, clf, det):
    info = probe(p)
    r = run_pipeline("eval", p, info.duration, False, clf, det)
    return r.score


def collect(root: Path, split: str, clf, det):
    ys, ss = [], []
    for label, y in (("real", 0), ("fake", 1)):
        for p in sorted((root / split / label).glob("*.*")):
            try:
                s = video_score(p, clf, det)
            except Exception as e:  # noqa: BLE001
                print("skip", p.name, type(e).__name__)
                continue
            if s is not None:
                ys.append(y); ss.append(s)
    return np.array(ys), np.array(ss)


def metrics(y, s, thr):
    from sklearn.metrics import confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score

    pred = (s >= thr).astype(int)
    return {"threshold": thr, "n": int(len(y)), "precision": precision_score(y, pred, zero_division=0), "recall": recall_score(y, pred, zero_division=0),
            "f1": f1_score(y, pred, zero_division=0), "roc_auc": roc_auc_score(y, s) if len(set(y)) > 1 else None,
            "confusion_matrix[[TN,FP],[FN,TP]]": confusion_matrix(y, pred, labels=[0, 1]).tolist()}


if __name__ == "__main__":
    if len(sys.argv) != 2 or not Path(sys.argv[1]).is_dir():
        sys.exit("Dataset directory not found. See docs/TESTING.md. No evaluation was run.")
    root = Path(sys.argv[1])
    clf, det = HFImageClassifier(), HaarFaceDetector()
    yv, sv = collect(root, "val", clf, det)
    thr = max(np.unique(sv), key=lambda t: metrics(yv, sv, t)["f1"]) if len(sv) else 0.7
    yt, st = collect(root, "test", clf, det)
    out = {"model": clf.model_id, "val_selected_threshold": float(thr), "test": metrics(yt, st, float(thr))}
    print(json.dumps(out, indent=2, default=float))
