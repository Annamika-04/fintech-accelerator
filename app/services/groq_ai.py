from groq import Groq
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_client = Groq(api_key=settings.GROQ_API_KEY)


def generate_kyc_summary(extracted_fields: dict, risk_score: int, decision: str) -> str:
    prompt = (
        f"You are a KYC compliance officer. Summarize the following KYC data concisely.\n\n"
        f"Extracted Document Fields: {extracted_fields}\n"
        f"Risk Score: {risk_score}/100\n"
        f"Decision: {decision}\n\n"
        f"Provide a 3-sentence compliance summary highlighting key risk factors."
    )
    try:
        response = _client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.3,
        )
        return response.choices[0].message.content.strip()
    except Exception as exc:
        logger.error("groq_summary_failed", error=str(exc))
        return f"Summary unavailable. Risk Score: {risk_score}, Decision: {decision}"
