"""Optional SAP HANA Cloud feature retrieval for RiskSignal training."""

from __future__ import annotations

import os

from hana_ml.dataframe import ConnectionContext, DataFrame


def connection_from_environment() -> ConnectionContext:
    required = ["HANA_ADDRESS", "HANA_PORT", "HANA_USER", "HANA_PASSWORD"]
    missing = [name for name in required if not os.getenv(name)]
    if missing:
        raise RuntimeError(f"Missing HANA environment variables: {missing}")

    return ConnectionContext(
        address=os.environ["HANA_ADDRESS"],
        port=int(os.environ["HANA_PORT"]),
        user=os.environ["HANA_USER"],
        password=os.environ["HANA_PASSWORD"],
        encrypt=os.getenv("HANA_ENCRYPT", "true").lower() == "true",
        sslValidateCertificate=(
            os.getenv("HANA_SSL_VALIDATE_CERTIFICATE", "true").lower() == "true"
        ),
    )


def load_feature_frame() -> DataFrame:
    query = os.getenv(
        "HANA_FEATURE_QUERY",
        'SELECT * FROM "RISKSIGNAL_FEATURES"',
    )
    connection = connection_from_environment()
    return connection.sql(query)
