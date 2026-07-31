import joblib
import time
import logging
import os
import numpy as np
from flask import Flask, request

app = Flask(__name__)
classifier = None
scaler = None
log = logging.getLogger("classifier-logger")
log.setLevel(os.environ.get("LOGLEVEL", "INFO"))

def init():
    global classifier, scaler
    print("app starting...")
    model_dir = os.getenv("MODEL_DIR", "/mnt/models/")
    
    # Robust fallback for local Docker / SAP AI Core execution
    if not os.path.exists(model_dir) or not os.listdir(model_dir):
        print(f"Notice: MODEL_DIR '{model_dir}' empty or missing. Falling back to local model directory '/app/model/'...")
        model_dir = "/app/model/"
        if not os.path.exists(model_dir):
            model_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../model/"))

    if not os.path.exists(model_dir):
        os.makedirs(model_dir, exist_ok=True)

    dirs = os.listdir(model_dir)
    print(f"Contents of model directory ({model_dir}): {dirs}")

    log.info("Loading model from: %s", model_dir)
    model_path = os.path.join(model_dir, "classifier.pkl")
    scaler_path = os.path.join(model_dir, "fincrime_scaler.pkl")

    if os.path.exists(model_path):
        classifier = joblib.load(model_path)
        print("Classifier model successfully loaded.")
    else:
        print(f"Warning: Model file not found at {model_path}")

    if os.path.exists(scaler_path):
        scaler = joblib.load(scaler_path)
        print("Feature scaler successfully loaded.")

@app.route("/v1/models/classifier:infer", methods=["POST"])
@app.route("/v1/models/{}:infer".format("classifier"), methods=["POST"])
def infer():
    time.sleep(0.01)
    global classifier, scaler
    input_json = dict(request.json or {})
    input_data = input_json.get('data')

    if classifier is None:
        return {"error": "Model not initialized"}, 500

    # Handles structured financial transaction risk scoring input
    if isinstance(input_data, dict) or (isinstance(input_data, list) and isinstance(input_data[0], (int, float))):
        if isinstance(input_data, dict):
            features = [
                float(input_data.get('OVERALL_RISK_SCORE', 0.0)),
                float(input_data.get('AMOUNT_RISK_SCORE', 0.0)),
                float(input_data.get('FREQUENCY_RISK_SCORE', 0.0)),
                float(input_data.get('GEOGRAPHY_RISK_SCORE', 0.0)),
                float(input_data.get('COUNTERPARTY_RISK_SCORE', 0.0)),
                float(input_data.get('PATTERN_RISK_SCORE', 0.0)),
                float(input_data.get('VELOCITY_RISK_SCORE', 0.0)),
                float(max([input_data.get('AMOUNT_RISK_SCORE', 0.0), input_data.get('FREQUENCY_RISK_SCORE', 0.0), input_data.get('GEOGRAPHY_RISK_SCORE', 0.0)])),
                float(np.mean([input_data.get('AMOUNT_RISK_SCORE', 0.0), input_data.get('FREQUENCY_RISK_SCORE', 0.0), input_data.get('GEOGRAPHY_RISK_SCORE', 0.0)])),
                float(np.std([input_data.get('AMOUNT_RISK_SCORE', 0.0), input_data.get('FREQUENCY_RISK_SCORE', 0.0), input_data.get('GEOGRAPHY_RISK_SCORE', 0.0)])),
                int(sum(1 for v in [input_data.get('AMOUNT_RISK_SCORE', 0.0), input_data.get('FREQUENCY_RISK_SCORE', 0.0), input_data.get('GEOGRAPHY_RISK_SCORE', 0.0)] if v > 50.0)),
                int(bool(input_data.get('IS_ANOMALY', False)))
            ]
        else:
            features = input_data

        X_in = np.array([features])
        if scaler is not None:
            X_in = scaler.transform(X_in)

        predicted_tier = classifier.predict(X_in)[0]
        return {
            "risk_tier": str(predicted_tier),
            "is_high_risk": str(predicted_tier).upper() == "HIGH",
            "status": "success"
        }
    
    # Fallback legacy text message prediction
    predicted = classifier.predict([str(input_data)])
    is_spam = predicted[0] == 'spam' or str(predicted[0]).upper() == 'HIGH'
    return {
        "spam": bool(is_spam),
        "prediction": str(predicted[0])
    }

if __name__ == '__main__':
    init()
    app.run(host="0.0.0.0", debug=False, port=9001)
