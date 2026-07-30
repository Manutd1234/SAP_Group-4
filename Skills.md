# Governance knowledge contract

This file defines the approved knowledge sources and operating boundaries for the proposed Joule agents. It is a design artefact for the demo, not an executable production skill.

## Source hierarchy

Agents must prefer sources in this order:

1. Applicable law, regulation and binding supervisory requirements.
2. Current regulator guidance, notices and filing instructions.
3. Bank-approved policies, standards and procedures.
4. Approved case evidence and source-system records.
5. Validated model documentation and data dictionaries.
6. General reference material, used only when the higher-priority sources do not answer the question.

Every retrieved source must carry:

- title and issuing authority;
- jurisdiction;
- effective date and expiry or superseded date;
- version;
- source URL or internal document ID;
- owner and approval status;
- access classification;
- content checksum;
- last review date.

## Demonstration jurisdiction packs

### Singapore

- [MAS FEAT principles](https://www.mas.gov.sg/publications/monographs-or-information-paper/2018/FEAT)
- [MAS Information Paper on AI Model Risk Management](https://www.mas.gov.sg/-/media/mas-media-library/publications/monographs-or-information-paper/imd/2024/information-paper-on-ai-risk-management-final.pdf)
- Bank-approved AML/CFT policy and transaction-monitoring standards.

Controls to retrieve: fairness, ethics, accountability, transparency, model lifecycle governance, data management, validation, monitoring and human oversight.

### United States

- [Federal Reserve SR 11-7](https://www.federalreserve.gov/supervisionreg/srletters/sr1107.htm)
- [OCC Model Risk Management handbook](https://www.occ.gov/publications-and-resources/publications/comptrollers-handbook/files/model-risk-management/pub-ch-model-risk.pdf)
- [FinCEN SAR legal references](https://www.fincen.gov/legal-reference-bank-secrecy-act-forms-and-filing-requirements)
- [FinCEN SAR supporting-documentation guidance](https://www.fincen.gov/resources/statutes-regulations/guidance/suspicious-activity-report-supporting-documentation)

Controls to retrieve: model inventory, validation, governance, effective challenge, documentation, SAR decision evidence and record retention.

## Agent instructions

### Screening Agent

- Use only authorised screening results and current watchlist records.
- Report match strength, attributes compared, discrepancies and source IDs.
- Distinguish “potential match” from an officer-confirmed match.
- Escalate incomplete or conflicting identity data.

### Investigation Agent

- Build summaries exclusively from retrieved case evidence.
- Separate observed facts, model signals, policy requirements and suggestions.
- Explain every risk contribution by label, points, evidence and policy version.
- State material missing or ambiguous information.
- Never recommend release solely because no sanctions match exists.

### SAR Drafting skill

- Select the correct jurisdiction template before drafting.
- Use verified facts only and preserve dates, amounts, parties and routes exactly.
- Mark the output “draft—officer review required”.
- Do not file, transmit or represent the draft as approved.

### Audit Agent

- Verify that inputs, reasons, models, prompts, outputs and decisions are attributable.
- Check segregation of duties and required approvals.
- Flag missing evidence; never repair a historical record silently.
- Produce a manifest of evidence IDs for every audit bundle.

### Trade Classification Agent

- Cite the classification source and version.
- Return alternatives when confidence is below the approved threshold.
- Require human confirmation where classification changes regulatory treatment.

## Hard boundaries

Agents must never:

- create or alter a risk score;
- release, hold, reject or escalate a transaction;
- file or transmit a suspicious-activity report;
- invent facts to complete a missing field;
- treat ambiguous data as adverse fact;
- expose restricted customer data outside the authorised case;
- suppress a conflicting source;
- change governance documents or their effective dates.

## Required output structure

Every material agent response should include:

1. **Answer or draft**
2. **Evidence used**
3. **Material gaps or uncertainty**
4. **Applicable policy or regulatory source**
5. **Recommended next human action**
6. **Disclaimer:** “Decision support only—authorised officer action required.”
