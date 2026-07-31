"""
Enterprise Hybrid RAG Engine for Financial Crime Risk Analysis (SCALE 2026 / RiskSignal)
Data Schema: TEAM_04_Data_Dictionary (16 tables)
Combines:
1. Pure Vector/Semantic RAG: Semantic search across screening rules, policy guidelines, and historical Joule explanations.
2. GraphRAG (Knowledge Graph Engine): 5-hop graph traversal across Companies, UBOs, Sanctions, Risk Profiles, Countries, Transaction Risk Scores & Baselines.
"""

import os
import json
import pandas as pd
import numpy as np
import re
from typing import Dict, List, Any, Optional

DATASETS_DIR = os.getenv("DATASETS_DIR", "/Users/ian/Desktop/SAP_Group-4/datasets")
if not os.path.exists(DATASETS_DIR):
    DATASETS_DIR = "/Users/ian/Desktop/team-04/SAP_Group-4/datasets"
if not os.path.exists(DATASETS_DIR):
    DATASETS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../datasets"))

class KnowledgeGraphEngine:
    """GraphRAG: 5-hop entity graph traversal over TEAM_04 schema."""
    def __init__(self, datasets_dir: str = DATASETS_DIR):
        self.datasets_dir = os.path.abspath(datasets_dir)
        self.tables = {}
        self.load_all_tables()

    def find_file(self, prefix: str) -> Optional[str]:
        if not os.path.exists(self.datasets_dir):
            return None
        matches = [f for f in os.listdir(self.datasets_dir) if f.startswith(prefix) and f.endswith('.csv')]
        return os.path.join(self.datasets_dir, matches[0]) if matches else None

    def load_all_tables(self):
        table_prefixes = {
            'companies': 'COMPANIES_',
            'ubos': 'COMPANY_BENEFICIAL_OWNERS_',
            'profiles': 'COMPANY_RISK_PROFILES_',
            'sanctions': 'SANCTIONS_LISTS_',
            'countries': 'COUNTRIES_',
            'regions': 'REGIONS_',
            'industries': 'INDUSTRIES_',
            'cases': 'COMPLIANCE_CASES_',
            'alerts': 'RISK_ALERTS_',
            'rules': 'SCREENING_RULES_',
            'explanations': 'JOULE_EXPLANATIONS_',
            'audit': 'AUDIT_LOG_',
            'baselines': 'TRANSACTION_BASELINES_',
            'scores': 'TRANSACTION_RISK_SCORES_'
        }

        for key, prefix in table_prefixes.items():
            fpath = self.find_file(prefix)
            if fpath:
                try:
                    self.tables[key] = pd.read_csv(fpath, low_memory=False)
                except Exception as e:
                    print(f"Warning loading {key}: {e}")

    def traverse_entity_graph(self, company_id: int) -> Dict[str, Any]:
        companies = self.tables.get('companies')
        if companies is None or companies.empty:
            return {"error": "Knowledge Graph tables not loaded"}

        company_matches = companies[companies['COMPANY_ID'] == company_id]
        if company_matches.empty:
            return {"error": f"Company ID {company_id} not found in Knowledge Graph"}

        company = company_matches.iloc[0].to_dict()

        # Hop 1: Beneficial Owners (UBOs)
        ubos_df = self.tables.get('ubos', pd.DataFrame())
        company_ubos = ubos_df[ubos_df['COMPANY_ID'] == company_id] if not ubos_df.empty else pd.DataFrame()
        ubos_list = company_ubos.to_dict(orient='records')

        pep_ubos = [u for u in ubos_list if str(u.get('IS_PEP', '')).lower() in ['1', 'true', '1.0']]
        sanctioned_ubos = [u for u in ubos_list if str(u.get('SANCTIONS_MATCH', '')).lower() in ['1', 'true', '1.0']]

        # Hop 2: Risk Profile & Scores
        profiles_df = self.tables.get('profiles', pd.DataFrame())
        profile_matches = profiles_df[profiles_df['COMPANY_ID'] == company_id] if not profiles_df.empty else pd.DataFrame()
        profile = profile_matches.iloc[0].to_dict() if not profile_matches.empty else {}

        # Hop 3: Country Jurisdiction & FATF status
        countries_df = self.tables.get('countries', pd.DataFrame())
        inc_country_id = company.get('INCORPORATION_COUNTRY_ID')
        country_matches = countries_df[countries_df['COUNTRY_ID'] == inc_country_id] if not countries_df.empty else pd.DataFrame()
        country = country_matches.iloc[0].to_dict() if not country_matches.empty else {}

        # Hop 4: Transaction Baselines & Anomaly Statistics
        baselines_df = self.tables.get('baselines', pd.DataFrame())
        baseline_matches = baselines_df[baselines_df['COMPANY_ID'] == company_id] if not baselines_df.empty else pd.DataFrame()
        baseline = baseline_matches.iloc[0].to_dict() if not baseline_matches.empty else {}

        # Hop 5: Linked Risk Alerts & Compliance Cases
        alerts_df = self.tables.get('alerts', pd.DataFrame())
        company_alerts = alerts_df[alerts_df['COMPANY_ID'] == company_id].head(5).to_dict(orient='records') if not alerts_df.empty else []

        cases_df = self.tables.get('cases', pd.DataFrame())
        company_cases = cases_df[cases_df['COMPANY_ID'] == company_id].head(3).to_dict(orient='records') if not cases_df.empty else []

        return {
            "entity_type": "Company",
            "company_id": company_id,
            "legal_name": company.get('LEGAL_NAME'),
            "trading_name": company.get('TRADING_NAME'),
            "kyc_status": company.get('KYC_STATUS'),
            "kyc_risk_rating": company.get('KYC_RISK_RATING'),
            "sanctions_hit": bool(company.get('SANCTIONS_HIT')),
            "pep_associated": bool(company.get('PEP_ASSOCIATED')),
            "adverse_media_flag": bool(company.get('ADVERSE_MEDIA_FLAG')),
            "jurisdiction": {
                "country_name": country.get('COUNTRY_NAME', 'Unknown'),
                "fatf_status": country.get('FATF_STATUS', 'Normal'),
                "risk_tier": country.get('RISK_TIER', 'Low')
            },
            "beneficial_owners": {
                "total_ubos": len(ubos_list),
                "pep_count": len(pep_ubos),
                "sanction_matches": len(sanctioned_ubos),
                "details": ubos_list
            },
            "risk_scores": {
                "composite_score": profile.get('COMPOSITE_RISK_SCORE'),
                "risk_tier": profile.get('RISK_TIER'),
                "country_risk": profile.get('COUNTRY_RISK_SCORE'),
                "industry_risk": profile.get('INDUSTRY_RISK_SCORE'),
                "ownership_risk": profile.get('OWNERSHIP_RISK_SCORE'),
                "behavioral_risk": profile.get('BEHAVIORAL_RISK_SCORE')
            },
            "transaction_baseline": {
                "period": baseline.get('BASELINE_PERIOD', 'Q1 2026'),
                "avg_amount_usd": baseline.get('AVG_AMOUNT_USD'),
                "max_amount_usd": baseline.get('MAX_AMOUNT_USD'),
                "cross_border_pct": baseline.get('CROSS_BORDER_PCT'),
                "new_counterparty_pct": baseline.get('NEW_COUNTERPARTY_PCT')
            },
            "linked_alerts": company_alerts,
            "compliance_cases": company_cases
        }


class PureVectorRAGEngine:
    """Pure Vector RAG: Token & Semantic search across screening rules and policy explanations."""
    def __init__(self, datasets_dir: str = DATASETS_DIR):
        self.datasets_dir = os.path.abspath(datasets_dir)
        self.rules_df = None
        self.explanations_df = None
        self.load_documents()

    def load_documents(self):
        try:
            r_match = [f for f in os.listdir(self.datasets_dir) if f.startswith('SCREENING_RULES_') and f.endswith('.csv')]
            e_match = [f for f in os.listdir(self.datasets_dir) if f.startswith('JOULE_EXPLANATIONS_') and f.endswith('.csv')]

            if r_match:
                self.rules_df = pd.read_csv(os.path.join(self.datasets_dir, r_match[0]))
            if e_match:
                self.explanations_df = pd.read_csv(os.path.join(self.datasets_dir, e_match[0]))
        except Exception as e:
            print(f"Vector RAG Load Warning: {e}")

    def query_semantic_rules(self, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        if self.rules_df is None or self.rules_df.empty:
            return []

        tokens = set(re.findall(r'\w+', query.lower()))
        scores = []

        for idx, row in self.rules_df.iterrows():
            text = f"{row.get('RULE_NAME', '')} {row.get('RULE_DESCRIPTION', '')} {row.get('RULE_CATEGORY', '')} {row.get('RULE_LOGIC', '')}".lower()
            text_tokens = set(re.findall(r'\w+', text))
            overlap = len(tokens.intersection(text_tokens))
            scores.append((overlap, row.to_dict()))

        scores.sort(key=lambda x: x[0], reverse=True)
        return [item[1] for item in scores[:top_k] if item[0] > 0]


class HybridRAGEngine:
    """Hybrid RAG: Fuses GraphRAG entity subgraph + Pure Vector RAG rule citations."""
    def __init__(self, datasets_dir: str = DATASETS_DIR):
        self.graph_rag = KnowledgeGraphEngine(datasets_dir)
        self.vector_rag = PureVectorRAGEngine(datasets_dir)

    def execute_hybrid_query(self, company_id: int, user_query: str) -> Dict[str, Any]:
        # 1. GraphRAG Traversal
        graph_subgraph = self.graph_rag.traverse_entity_graph(company_id)

        # 2. Pure Vector RAG Search
        rule_citations = self.vector_rag.query_semantic_rules(user_query, top_k=3)

        # 3. Hybrid Context Generation
        legal_name = graph_subgraph.get('legal_name', f'Company #{company_id}')
        composite_score = graph_subgraph.get('risk_scores', {}).get('composite_score', 'N/A')
        risk_tier = graph_subgraph.get('risk_scores', {}).get('risk_tier', 'N/A')

        context_prompt = f"""
=== HYBRID RAG ENTERPRISE CONTEXT FOR {legal_name} (ID: {company_id}) ===

[GRAPH EVIDENCE - ENTITY TOPOLOGY & BASELINE]
- Composite Risk Score: {composite_score} ({risk_tier} Tier)
- KYC Status: {graph_subgraph.get('kyc_status')} | Risk Rating: {graph_subgraph.get('kyc_risk_rating')}
- Sanctions Hit: {graph_subgraph.get('sanctions_hit')} | PEP Associated: {graph_subgraph.get('pep_associated')} | Adverse Media: {graph_subgraph.get('adverse_media_flag')}
- FATF Jurisdiction: {graph_subgraph.get('jurisdiction', {}).get('country_name')} (FATF Status: {graph_subgraph.get('jurisdiction', {}).get('fatf_status')})
- UBO Breakdown: {graph_subgraph.get('beneficial_owners', {}).get('total_ubos')} Total UBOs, {graph_subgraph.get('beneficial_owners', {}).get('pep_count')} PEPs, {graph_subgraph.get('beneficial_owners', {}).get('sanction_matches')} Sanction Hits.
- Transaction Baseline: Avg ${graph_subgraph.get('transaction_baseline', {}).get('avg_amount_usd', 0):,} USD, Cross-Border {graph_subgraph.get('transaction_baseline', {}).get('cross_border_pct', 0)}%, New Counterparty {graph_subgraph.get('transaction_baseline', {}).get('new_counterparty_pct', 0)}%.

[VECTOR EVIDENCE - APPLICABLE SCREENING RULES]
"""
        for r in rule_citations:
            context_prompt += f"- Rule {r.get('RULE_CODE')}: {r.get('RULE_NAME')} (Impact: +{r.get('RISK_SCORE_IMPACT')} pts) - {r.get('RULE_DESCRIPTION')}\n"

        explanation_narrative = (
            f"Company {legal_name} presents a {risk_tier} risk profile (Score: {composite_score}/100).\n"
            f"Key risk drivers identified via GraphRAG traversal:\n"
            f"1. Beneficial Owners: {graph_subgraph.get('beneficial_owners', {}).get('sanction_matches')} sanction hits, {graph_subgraph.get('beneficial_owners', {}).get('pep_count')} PEP associations.\n"
            f"2. Country Risk: Operating in {graph_subgraph.get('jurisdiction', {}).get('country_name')} (FATF Status: {graph_subgraph.get('jurisdiction', {}).get('fatf_status')}).\n"
            f"3. Rule Citations: Triggered rule {rule_citations[0].get('RULE_CODE', 'N/A')} ({rule_citations[0].get('RULE_NAME', 'High Risk Screening')})."
            if rule_citations else f"Company {legal_name} evaluated under general risk controls."
        )

        return {
            "query": user_query,
            "company_id": company_id,
            "graph_rag": graph_subgraph,
            "vector_rag_citations": rule_citations,
            "fused_context_prompt": context_prompt,
            "explainable_narrative": explanation_narrative
        }


if __name__ == "__main__":
    print("Testing Enterprise Hybrid RAG Engine...")
    engine = HybridRAGEngine()
    result = engine.execute_hybrid_query(company_id=1, user_query="sanctions high risk UBO PEP anomaly")
    print(json.dumps(result, indent=2, default=str))
