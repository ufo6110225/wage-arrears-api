import sys
import json
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_factory():
    payload = {
        "consecutive_utility_arrears_cycles": 2,
        "industrial_power_drop_pct": 60.0,
        "social_security_drop_pct": 25.0,
        "is_social_security_in_arrears": True,
        "has_asset_frozen_order": False,
        "is_dishonest_executor": False,
        "days_in_abnormal_operation": 0,
        "has_major_tax_evasion": False,
        "has_related_company_crisis": False,
        "has_core_client_crisis": False,
        "national_platform_weekly_complaints": 25,
        "max_repeated_complaints_by_one_person": 0,
        "local_absorption_ratio_below_threshold_weeks": 0,
        "has_high_risk_public_sentiment": False,
        "industry_negative_growth_quarters": 0,
        "is_removed_from_supply_chain": False,
        "short_term_dismissed_dispatch_workers": 0,
        "frequent_legal_rep_or_address_changes": False
    }
    
    response = client.post("/api/v1/predict/factory", json=payload)
    print("Factory response status:", response.status_code)
    print("Factory response JSON:")
    print(json.dumps(response.json(), ensure_ascii=False, indent=2))
    
test_factory()
