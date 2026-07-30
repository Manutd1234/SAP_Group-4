"""Train the bounded RiskSignal transaction classifier."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score
from sklearn.model_selection import train_test_split

FEATURES = [
    "amount",
    "customer_baseline_amount",
    "transfer_count_30m",
    "new_route",
    "beneficiary_missing",
    "counterparty_risk",
]
TARGET = "suspicious"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True, help="CSV file or directory")
    parser.add_argument("--output", required=True, help="Model output directory")
    return parser.parse_args()


def resolve_csv(path_value: str) -> Path:
    path = Path(path_value)
    if path.is_file():
        return path
    candidates = sorted(path.rglob("*.csv"))
    if not candidates:
        raise FileNotFoundError(f"No CSV dataset found under {path}")
    return candidates[0]


def main() -> None:
    args = parse_args()
    data_path = resolve_csv(args.data)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    frame = pd.read_csv(data_path)
    missing = set(FEATURES + [TARGET]) - set(frame.columns)
    if missing:
        raise ValueError(f"Dataset is missing columns: {sorted(missing)}")

    x = frame[FEATURES].fillna(0)
    y = frame[TARGET].astype(int)
    if y.nunique() < 2:
        raise ValueError("Training data must contain both target classes")

    test_size = max(2, round(len(frame) * 0.25))
    x_train, x_test, y_train, y_test = train_test_split(
        x,
        y,
        test_size=test_size,
        random_state=42,
        stratify=y,
    )

    model = RandomForestClassifier(
        n_estimators=160,
        max_depth=5,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
    )
    model.fit(x_train, y_train)
    predictions = model.predict(x_test)

    metrics = {
        "accuracy": accuracy_score(y_test, predictions),
        "precision": precision_score(y_test, predictions, zero_division=0),
        "recall": recall_score(y_test, predictions, zero_division=0),
        "training_rows": len(x_train),
        "test_rows": len(x_test),
        "features": FEATURES,
        "decision_boundary": (
            "Model output is a signal only. The governed weighted scoring "
            "service and an authorised officer determine workflow actions."
        ),
    }
    bundle = {
        "model": model,
        "features": FEATURES,
        "model_name": "risksignal-transaction-classifier",
        "model_version": "1.0.0",
    }

    joblib.dump(bundle, output_dir / "risk_model.joblib")
    (output_dir / "metrics.json").write_text(
        json.dumps(metrics, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(metrics))


if __name__ == "__main__":
    main()
