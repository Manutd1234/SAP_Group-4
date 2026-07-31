"""
SAP AI Core Workflow Training Script (SCALE 2026 / RiskSignal)
Trains Enterprise Financial Crime Risk & Anomaly Classifier on 150,000 transaction records.
Schema: TEAM_04_Data_Dictionary
"""

import sys
import os

# Import enterprise trainer
from train_fincrime import EnterpriseFinCrimeTrainer

if __name__ == '__main__':
    print("==========================================")
    print("  SAP AI Core Financial Crime ML Training ")
    print("==========================================")
    
    datasets_dir = os.getenv("DATASETS_DIR", "/Users/ian/Desktop/SAP_Group-4/datasets")
    if not os.path.exists(datasets_dir):
        datasets_dir = "/Users/ian/Desktop/team-04/SAP_Group-4/datasets"
    if not os.path.exists(datasets_dir):
        datasets_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data"))

    output_dir = os.getenv("MODEL_OUT_DIR", os.path.join(os.path.dirname(__file__), "../model"))

    trainer = EnterpriseFinCrimeTrainer(datasets_dir=datasets_dir, output_dir=output_dir)
    acc = trainer.train_and_evaluate()

    print(f"\n[SUCCESS] SAP AI Core ML Model Training Completed. Accuracy: {acc * 100:.2f}%")