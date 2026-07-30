# RiskSignal narrow AI on SAP AI Core

This folder is the SAP AI Core application surface for RiskSignal.

## SAP AI Launchpad application settings

Use these values when creating the application:

| Field | Value |
| --- | --- |
| Application Name | `risksignal-aicore` |
| Repository | `https://github.com/Manutd1234/SAP_Group-4` |
| Path in Repository | `narrow_ai/templates` |
| Revision after the PR is merged | `HEAD` |
| Revision for testing the current PR | `agent/complete-risk-workflows` |

The workshop guide uses the same required repository layout: the application path points to the folder containing the SAP AI Core `WorkflowTemplate` and `ServingTemplate` YAML files.

Do not create two SAP AI Core applications that use the same repository, revision and path. SAP documents this combination as a unique application source.

## Repository layout

```text
narrow_ai/
├── application-config.json     # AI Core application API payload
├── data/
│   └── sample_transactions.csv # synthetic local test data
├── Dockerfile                  # one image for training and serving
├── requirements.txt
├── src/
│   ├── hana_features.py        # optional HANA Cloud feature retrieval
│   ├── serve.py                # KServe-compatible HTTP service
│   └── train.py                # bounded risk-classification training
└── templates/
    ├── risksignal-serving.yaml
    └── risksignal-training.yaml
```

Only `narrow_ai/templates` is synchronized as the SAP AI Core application path. Source code and Docker files remain outside that path and are delivered through the container image.

## Before synchronizing

1. Merge the GitHub pull request, or set the application revision to `agent/complete-risk-workflows` for branch testing.
2. Build and publish `ghcr.io/manutd1234/risksignal-narrow-ai:latest`.
   - The repository workflow does this on changes under `narrow_ai/`.
3. If the GHCR package is private, create the SAP AI Core Docker registry secret named `docker-registry-secret`.
4. Register the object store secret used for training artifacts.
5. Connect the GitHub repository in SAP AI Launchpad.
6. Create the application with the values above.
7. Synchronize and confirm both templates show `Synced`.

## Local smoke test

```bash
cd narrow_ai
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python src/train.py \
  --data data/sample_transactions.csv \
  --output .local/model
MODEL_PATH=.local/model/risk_model.joblib \
  uvicorn src.serve:app --host 0.0.0.0 --port 9001
```

Example inference request:

```bash
curl -X POST http://localhost:9001/v1/models/risksignal:predict \
  -H 'Content-Type: application/json' \
  -d '{
    "instances": [{
      "amount": 247500,
      "customer_baseline_amount": 66892,
      "transfer_count_30m": 4,
      "new_route": 1,
      "beneficiary_missing": 1,
      "counterparty_risk": 0.82
    }]
  }'
```

## SAP libraries

- `sap-ai-sdk-core` is the SAP Cloud SDK for AI package for SAP AI Core administration and lifecycle management.
- `hana-ml` provides the Python machine-learning client for SAP HANA.
- `hdbcli` is the Python SAP HANA database driver.

The container uses `hana-ml` and `hdbcli` for optional HANA feature retrieval. The AI Core SDK is listed in `requirements-sdk.txt` for administration clients and automation, not the model-serving runtime.

Useful official references:

- [SAP AI Core libraries and SDKs](https://help.sap.com/docs/sap-ai-core/sap-ai-core-service-guide/libraries-and-sdks)
- [Python Machine Learning Client for SAP HANA](https://help.sap.com/doc/1d0ebfe5e8dd44d09606814d83308d4b/2.0.07/en-US/hana_ml.html)
- [SAP HANA HDB Client package](https://help.sap.com/docs/SAP_HANA_EXPRESS_EDITION/32c9e0c8afba4c87814e61d6a1141280/c9dd856688dd4f75927f7495916abbc7.html)
- [Create an SAP AI Core application to synchronize repository folders](https://help.sap.com/docs/sap-ai-core/sap-ai-core-service-guide/create-application-to-sync-your-folders)

## Secret handling

Never commit SAP AI Core service keys, HANA passwords, object-store credentials, Docker tokens or GitHub personal access tokens. Configure them in SAP BTP, SAP AI Core secrets, GitHub Actions secrets or a local untracked `.env` file.
