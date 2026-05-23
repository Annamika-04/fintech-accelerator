DEMO_SANCTIONS = [
    {
        "name": "John Illegal",
        "country": "North Korovia",
        "reason": "Terror financing investigation",
        "risk_level": "CRITICAL",
        "match_score": 98,
        "action": "REJECT",
    },
    {
        "name": "Rajesh Fraud",
        "country": "Freedonia",
        "reason": "International financial fraud",
        "risk_level": "CRITICAL",
        "match_score": 96,
        "action": "REJECT",
    },
    {
        "name": "Global Blacklist User",
        "country": "Sanctioned Territory",
        "reason": "OFAC-equivalent sanctions list",
        "risk_level": "CRITICAL",
        "match_score": 99,
        "action": "REJECT",
    },
    {
        "name": "Nikhil Kumar",
        "country": "India",
        "reason": "Demo sanctions match for Aadhaar/KYC walkthrough",
        "risk_level": "CRITICAL",
        "match_score": 97,
        "action": "REJECT",
    },
]


DEMO_PEP = [
    {
        "name": "Minister Demo",
        "country": "India",
        "position": "Former State Minister",
        "risk_level": "HIGH",
        "match_score": 88,
        "action": "MANUAL_REVIEW",
    },
    {
        "name": "Political Test User",
        "country": "India",
        "position": "Member of Parliament",
        "risk_level": "HIGH",
        "match_score": 91,
        "action": "MANUAL_REVIEW",
    },
    {
        "name": "Vikram Governance",
        "country": "Singapore",
        "position": "Government Procurement Director",
        "risk_level": "MEDIUM",
        "match_score": 84,
        "action": "ENHANCED_DUE_DILIGENCE",
    },
    {
        "name": "Rahul Mishra",
        "country": "India",
        "position": "Former Municipal Development Committee Member",
        "document_hint": "Aadhaar demo ID ending 2170",
        "risk_level": "HIGH",
        "match_score": 89,
        "action": "MANUAL_REVIEW",
    },
    {
        "name": "Elon Musk",
        "country": "India",
        "position": "Demo politically exposed profile simulation",
        "document_hint": "Aadhaar demo ID ending 2345",
        "risk_level": "HIGH",
        "match_score": 90,
        "action": "MANUAL_REVIEW",
    },
]


DEMO_ADVERSE_MEDIA = [
    {
        "name": "Fraud News User",
        "country": "India",
        "headline": "Linked to ongoing cyber fraud investigation",
        "risk_level": "MEDIUM",
        "match_score": 76,
        "action": "ESCALATE",
    },
    {
        "name": "Money Laundering Demo",
        "country": "UAE",
        "headline": "Mentioned in suspicious transaction reports",
        "risk_level": "HIGH",
        "match_score": 81,
        "action": "ESCALATE",
    },
    {
        "name": "Scam Alert Person",
        "country": "UK",
        "headline": "Named in consumer scam complaints",
        "risk_level": "LOW",
        "match_score": 67,
        "action": "REVIEW",
    },
    {
        "name": "Manish Das",
        "country": "India",
        "headline": "Named in demo adverse media report for suspicious account activity",
        "document_hint": "Aadhaar demo ID ending 9012",
        "risk_level": "MEDIUM",
        "match_score": 78,
        "action": "ESCALATE",
    },
]


SANCTIONS_LOOKUP = {item["name"].lower(): item for item in DEMO_SANCTIONS}
PEP_LOOKUP = {item["name"].lower(): item for item in DEMO_PEP}
ADVERSE_MEDIA_LOOKUP = {item["name"].lower(): item for item in DEMO_ADVERSE_MEDIA}
