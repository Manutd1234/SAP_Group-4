"""Serve RiskSignal model signals through a KServe-compatible HTTP API."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


class PredictionRequest(BaseModel):
    instances: list[dict[str, float | int]] = Field(min_length=1, max_length=500)


app = FastAPI(
    title="RiskSignal narrow AI",
    version="1.0.0",
    description="Bounded anomaly signal for governed financial-crime scoring.",
)
_bundle: dict[str, Any] | None = None


def locate_model() -> Path:
    configured = Path(os.getenv("MODEL_PATH", "/app/model/risk_model.joblib"))
    if configured.is_file():
        return configured

    storage_uri = os.getenv("STORAGE_URI")
    if storage_uri:
        storage_path = Path(storage_uri)
        if storage_path.is_file():
            return storage_path
        candidates = sorted(storage_path.rglob("risk_model.joblib"))
        if candidates:
            return candidates[0]

    candidates = sorted(Path("/mnt/models").rglob("risk_model.joblib"))
    if candidates:
        return candidates[0]
    raise FileNotFoundError("risk_model.joblib was not found")


def get_bundle() -> dict[str, Any]:
    global _bundle
    if _bundle is None:
        _bundle = joblib.load(locate_model())
    return _bundle


def risk_band(probability: float) -> str:
    if probability >= 0.70:
        return "high"
    if probability >= 0.45:
        return "medium"
    return "low"


@app.get("/healthz")
def health() -> dict[str, str]:
    try:
        bundle = get_bundle()
    except (FileNotFoundError, OSError):
        return {"status": "starting", "model": "unavailable"}
    return {"status": "ready", "model": str(bundle["model_name"])}


@app.post("/v1/models/risksignal:predict")
def predict(request: PredictionRequest) -> dict[str, Any]:
    try:
        bundle = get_bundle()
    except (FileNotFoundError, OSError) as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    features: list[str] = bundle["features"]
    frame = pd.DataFrame(request.instances)
    missing = set(features) - set(frame.columns)
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Missing model features: {sorted(missing)}",
        )

    probabilities = bundle["model"].predict_proba(frame[features].fillna(0))[:, 1]
    predictions = [
        {
            "risk_probability": round(float(probability), 6),
            "risk_band": risk_band(float(probability)),
            "model_signal_only": True,
        }
        for probability in probabilities
    ]
    return {
        "model_name": bundle["model_name"],
        "model_version": bundle["model_version"],
        "predictions": predictions,
        "decision_boundary": (
            "This model does not release, hold, escalate or report transactions."
        ),
    }
