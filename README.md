# RiskSignal

RiskSignal is a working front-end demo and reference architecture for explainable, human-accountable financial-crime risk operations on SAP.

The demo addresses three connected problems:

1. **Outdated detection:** replace static thresholds alone with evidence-backed rules, narrow anomaly models and transparent weighted scoring.
2. **Operational inefficiency:** prioritise the investigation queue by risk and SLA, then support investigators with grounded summaries and drafts.
3. **Regulatory intensity:** retain the score breakdown, evidence, model version, prompts, outputs and named officer decision for audit.

## Run the demo

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Demo flow

1. Open **Control center** to see the live risk posture and prioritised queue.
2. Open **Workflow studio** and run transaction `TX-882190` through all 12 controls spanning Problems 1, 2 and 3.
3. Switch between the Singapore and United States demonstration jurisdiction packs.
4. Select case **RC-2048** in the **Case queue**.
5. Inspect the score and the four evidence-backed risk factors.
6. Ask Joule why the transaction is high risk, request a summary, or generate a draft SAR narrative.
7. Release or escalate the case. The demo records that the officer—not AI—made the decision.
8. Open **Architecture** to inspect the SAP-aligned layers, control gates and agent workflow.

The current demo uses realistic synthetic transactions and deterministic responses. It does not connect to a production SAP tenant, run a trained model or file a real SAR.

## Solution map

| Capability | Proposed production service |
| --- | --- |
| Investigator cockpit | SAP Build Work Zone or SAP Build Apps |
| Conversational assistance and custom agents | Joule and Joule Studio |
| Case workflow, approvals and automation | SAP Build Process Automation |
| Transaction, customer, case and evidence data | SAP HANA Cloud |
| ERP transaction source | SAP S/4HANA |
| Narrow model lifecycle and endpoints | SAP AI Core, or a governed bank-hosted endpoint |
| Operational and model reporting | SAP Analytics Cloud |
| Customer-service handoff | SAP Service Cloud |

SAP Intelligent Robotic Process Automation is represented by **SAP Build Process Automation**, which is the current workflow and robotic-process-automation layer in this design.

## Design decisions

- A transparent weighted score remains the production decision-support contract. Every score contribution carries a reason code and evidence reference.
- Narrow models detect bounded patterns such as transaction anomalies, network anomalies and document-category mismatch. Generative AI does not calculate the risk score.
- Missing mandatory information adds a defined risk contribution and blocks straight-through processing. Ambiguous information triggers review; it does not automatically make a transaction medium risk.
- Llama Guard 3 may screen prompts and model outputs, but it is not the business orchestrator or the compliance decision-maker.
- Release, hold, escalation and SAR filing always require an authorised human.

See [docs/WORKFLOWS.md](docs/WORKFLOWS.md) for the complete Problem 1–3 workflows, [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the reference architecture and [Skills.md](Skills.md) for the governance-source contract.

## Primary product and regulatory references

- [SAP Joule documentation](https://help.sap.com/docs/JOULE)
- [SAP Joule Studio integration with SAP Build](https://help.sap.com/docs/Joule_Studio/45f9d2b8914b4f0ba731570ff9a85313/259112f367c84f6faa83e52a627188c3.html)
- [SAP Joule content-based agents and human approval](https://help.sap.com/docs/Joule_Studio/45f9d2b8914b4f0ba731570ff9a85313/7bd0afe3ce774b2dbef3c3c0114a39ec.html)
- [MAS FEAT principles](https://www.mas.gov.sg/publications/monographs-or-information-paper/2018/FEAT)
- [Federal Reserve SR 11-7 model-risk guidance](https://www.federalreserve.gov/supervisionreg/srletters/sr1107.htm)
- [FinCEN SAR supporting-documentation guidance](https://www.fincen.gov/resources/statutes-regulations/guidance/suspicious-activity-report-supporting-documentation)

The regulatory view uses Singapore and the United States as demonstrative jurisdiction packs because the source notes did not identify the two jurisdictions. Replace or extend these packs before a production pilot.
