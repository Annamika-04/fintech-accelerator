# Fintech Accelerator — CEO Documentation
> End-to-end overview of the platform: what it does, how it works, and the technology behind it.

---

## 1. What Is This Platform?

This is a **SaaS-ready KYC (Know Your Customer) + AML (Anti-Money Laundering) + Risk Scoring platform** built for fintech companies. It automates the process of verifying who a customer is, checking them against global watchlists, and assigning a risk score — all before they are allowed to transact.

Think of it as a **digital compliance officer** that works 24/7.

---

## 2. Simple Real-World Example Flow

> **Scenario:** Priya wants to open a digital wallet on your platform.

```
Priya signs up
    ↓
She fills in her name, DOB, address
    ↓
She uploads her PAN card photo
    ↓
She takes a selfie
    ↓
[SYSTEM AUTOMATICALLY]
  → Reads text from PAN card (OCR)
  → Compares selfie face to PAN card face (AI)
  → Checks her name against global sanctions/PEP lists (AML)
  → Calculates a risk score (0–100)
    ↓
Score = 12  →  AUTO APPROVED  ✅  (Priya can transact)
Score = 45  →  MANUAL REVIEW  🔍  (Compliance officer reviews)
Score = 90  →  AUTO REJECTED  ❌  (Blocked immediately)
```

---

## 3. End-to-End User Flow (Step by Step)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER JOURNEY FLOWCHART                              │
└─────────────────────────────────────────────────────────────────────────────┘

[1] USER REGISTRATION
    User signs up via email/phone OTP
    → Auth handled by Supabase (JWT tokens)
    → User record created in PostgreSQL
    → Status: REGISTERED

         ↓

[2] SELECT ACCOUNT TYPE
    User chooses: Individual  OR  Corporate
    → Status: TYPE_SELECTED

         ↓

[3] FILL PROFILE
    Individual: Name, DOB, Address, Nationality
    Corporate:  Company name, Registration no., Directors/UBOs
    → Status: PROFILE_COMPLETED

         ↓

[4] UPLOAD DOCUMENTS
    User uploads ID document (PAN card / Aadhaar / Passport)
    → File stored securely in AWS S3
    → Status: DOCUMENTS_UPLOADED
    → [ASYNC] OCR task queued → Celery "ocr" worker

         ↓

[5] CAPTURE SELFIE
    User takes a live selfie via webcam
    → Selfie stored in AWS S3
    → Status: KYC_PENDING
    → [ASYNC] Face verification task queued → Celery "face" worker

         ↓

[6] OCR PROCESSING  (runs in background)
    ┌──────────────────────────────────────────────────────┐
    │  EasyOCR reads the ID document image                 │
    │  Extracts: Name, Date of Birth, PAN/Aadhaar number   │
    │  4 preprocessing strategies tried (best result wins) │
    │  Blur detection → reject if image too blurry         │
    │  Auto-crop document edges (perspective transform)    │
    └──────────────────────────────────────────────────────┘
    → Result saved to DocumentVerification table

         ↓ (parallel with OCR)

[7] FACE VERIFICATION  (runs in background)
    ┌──────────────────────────────────────────────────────┐
    │  DeepFace (Facenet512 model) compares:               │
    │    Selfie photo  ←→  ID document photo               │
    │  Similarity score calculated (0–100%)                │
    │  Image quality checked (blur, brightness)            │
    │  Face cropped from ID before comparison              │
    └──────────────────────────────────────────────────────┘
    → Result saved to FaceVerification table

         ↓ (when BOTH OCR + Face are done)

[8] KYC VALIDATION  (Celery "ai" worker)
    ┌──────────────────────────────────────────────────────┐
    │  Scoring (out of 100 points):                        │
    │    Name match (OCR vs Profile)    → max 25 pts       │
    │    DOB match (OCR vs Profile)     → max 25 pts       │
    │    Face similarity score          → max 30 pts       │
    │    Liveness / image quality       → max 10 pts       │
    │    OCR confidence                 → max 10 pts       │
    └──────────────────────────────────────────────────────┘
    KYC Score ≥ 60  → AML_PENDING  (proceed to AML check)
    KYC Score 40–59 → UNDER_REVIEW (manual review needed)
    KYC Score < 40  → REJECTED

         ↓ (if KYC passes)

[9] AML SCREENING  (Celery "aml" worker)
    ┌──────────────────────────────────────────────────────┐
    │  Name checked against 3 watchlists:                  │
    │    1. Sanctions List  (OFAC-equivalent)              │
    │    2. PEP List        (Politically Exposed Persons)  │
    │    3. Adverse Media   (News/fraud reports)           │
    │                                                      │
    │  Primary: Demo local watchlist (for testing)         │
    │  Production: OpenSanctions API (real-time)           │
    └──────────────────────────────────────────────────────┘
    → AML Score calculated
    → Case created if any flag triggered

         ↓

[10] RISK SCORING  (calculated after AML)
    ┌──────────────────────────────────────────────────────┐
    │  7 risk dimensions scored:                           │
    │    KYC Risk          (doc/face quality)   max 25     │
    │    AML Risk          (sanctions/PEP)      max 50     │
    │    Geographic Risk   (high-risk country)  max 20     │
    │    Behavioural Risk  (login anomalies)    max 15     │
    │    Transaction Risk  (velocity)           max 15     │
    │    Device/IP Risk    (IP reputation)      max 15     │
    │    Ownership Risk    (complex structure)  max 15     │
    └──────────────────────────────────────────────────────┘
    Final Score 0–29   → AUTO_APPROVE
    Final Score 30–59  → MANUAL_REVIEW
    Final Score 60–84  → COMPLIANCE_ESCALATION
    Final Score 85–100 → AUTO_REJECT

         ↓

[11] AI SUMMARY  (Groq LLM)
    Groq API (llama3-70b-8192) generates a 3-sentence
    compliance summary of the KYC result for the officer.

         ↓

[12] FINAL DECISION
    ┌─────────────────────────────────────────────────────┐
    │  AUTO_APPROVE         → User onboarded ✅           │
    │  MANUAL_REVIEW        → Compliance officer reviews  │
    │  COMPLIANCE_ESCALATION→ Senior review required      │
    │  AUTO_REJECT          → User blocked ❌             │
    └─────────────────────────────────────────────────────┘
    → Status: APPROVED / REJECTED / FROZEN
    → Full audit trail written to audit_logs table
```

---

## 4. KYC Scoring Logic — Explained Simply

> "How confident are we that this person is who they claim to be?"

| Check | Max Points | How It Works |
|---|---|---|
| Name Match | 25 | OCR reads name from ID → fuzzy-matched against profile name. ≥85% match = full score |
| DOB Match | 25 | OCR reads date of birth → exact match against profile DOB |
| Face Similarity | 30 | DeepFace AI compares selfie to ID photo. ≥60% similarity = partial score |
| Liveness | 10 | Checks selfie is not blurry and has good lighting |
| OCR Confidence | 10 | How clearly the OCR could read the document |

**Example — Priya (clean case):**
- Name: "Priya Sharma" matches OCR "PRIYA SHARMA" → 25 pts
- DOB: 1990-05-12 matches → 25 pts
- Face similarity: 87% → 28 pts
- Liveness: clear selfie → 10 pts
- OCR confidence: 82% → 10 pts
- **Total: 98/100 → AML_PENDING ✅**

**Example — Suspicious case:**
- Name: "John Smith" vs OCR "JOHN SMYTH" → partial → 12 pts
- DOB: mismatch → 0 pts
- Face similarity: 45% (different person) → 0 pts → **IMMEDIATE REJECTION**

---

## 5. AML Screening Logic — Explained Simply

> "Is this person on any watchlist?"

Three checks run against the user's name:

```
User Name: "John Illegal"
    ↓
Check 1: SANCTIONS LIST
    → Match found! (score 98/100, reason: Terror financing)
    → Flag: SANCTIONS_MATCH (severity: CRITICAL)
    → Decision: AUTO_REJECT ❌

User Name: "Minister Demo"
    ↓
Check 1: Sanctions → No match
Check 2: PEP LIST
    → Match found! (Former State Minister, score 88/100)
    → Flag: PEP_MATCH (severity: HIGH)
    → Decision: MANUAL_REVIEW 🔍

User Name: "Fraud News User"
    ↓
Check 1: Sanctions → No match
Check 2: PEP → No match
Check 3: ADVERSE MEDIA
    → Match found! (Cyber fraud investigation, score 76/100)
    → Flag: ADVERSE_MEDIA_MATCH (severity: MEDIUM)
    → Decision: COMPLIANCE_ESCALATION 🔍

User Name: "Priya Sharma"
    ↓
All 3 checks → No match
    → AML Score: 0 → LOW_RISK ✅
```

**AML Score Calculation:**
- Sanctioned person: +95 points → AUTO_REJECT
- PEP match: +65 points → MANUAL_REVIEW
- Adverse media: +65 points → COMPLIANCE_ESCALATION
- No match: 0 points → LOW_RISK

---

## 6. Risk Scoring Logic — Explained Simply

> "What is the overall risk of doing business with this person?"

```
Example: Priya (clean Indian user)
┌─────────────────────────────────────────────┐
│ KYC Risk:          0  (face similarity 87%) │
│ AML Risk:          0  (no watchlist match)  │
│ Geographic Risk:   0  (India = not high-risk│
│ Behavioural Risk:  0  (normal login)        │
│ Transaction Risk:  0  (low velocity)        │
│ Device/IP Risk:    2  (minor IP flag)       │
│ Ownership Risk:    0  (no complex structure)│
│ ─────────────────────────────────────────── │
│ FINAL SCORE:       2  → AUTO_APPROVE ✅     │
└─────────────────────────────────────────────┘

Example: Suspicious corporate user
┌─────────────────────────────────────────────┐
│ KYC Risk:         20  (low doc confidence)  │
│ AML Risk:         25  (PEP match)           │
│ Geographic Risk:  20  (Russia = high-risk)  │
│ Behavioural Risk: 15  (login anomaly)       │
│ Transaction Risk: 15  (>100 tx/day)         │
│ Device/IP Risk:   10  (flagged IP)          │
│ Ownership Risk:   15  (complex ownership)   │
│ ─────────────────────────────────────────── │
│ FINAL SCORE:     100  → AUTO_REJECT ❌      │
└─────────────────────────────────────────────┘
```

**High-Risk Countries (automatic +20 points):**
Iran, North Korea, Syria, Cuba, Sudan, Myanmar, Belarus, Russia, Venezuela

---

## 7. Technology Stack

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Python | 3.11+ | Core language |
| FastAPI | 0.111.0 | REST API framework (async) |
| SQLAlchemy | 2.0.30 | Database ORM |
| Alembic | 1.13.1 | Database migrations |
| Celery | 5.4.0 | Async task queue (OCR, Face, AML, AI workers) |
| Redis | 5.0.4 | Task broker + distributed locks |
| asyncpg | 0.29.0 | Async PostgreSQL driver |
| Pydantic | 2.7.1 | Data validation & settings |
| Uvicorn | 0.29.0 | ASGI server |
| Gunicorn | 26.0.0 | Production process manager |

### AI / ML
| Technology | Version | Purpose |
|---|---|---|
| DeepFace | 0.0.100 | Face verification (Facenet512 model) |
| EasyOCR | 1.7.2 | Document text extraction |
| OpenCV | 4.13.0.92 | Image preprocessing (blur, crop, enhance) |
| TensorFlow | 2.21.0 | DeepFace backend |
| PyTorch | 2.12.0 | DeepFace backend (alternative) |
| Keras | 3.14.1 | Neural network layer |
| RapidFuzz | 3.14.5 | Fuzzy name matching |
| NumPy | 2.4.6 | Numerical operations |

### AI / LLM
| Technology | Version | Purpose |
|---|---|---|
| Groq SDK | 0.8.0 | LLM API client |
| **Model** | **llama3-70b-8192** | Compliance summary generation |

### Authentication & Database
| Technology | Version | Purpose |
|---|---|---|
| Supabase | 2.4.6 | Auth (JWT), PostgreSQL hosting |
| PyJWT | 2.12.1 | JWT token validation |
| bcrypt | 5.0.0 | Password hashing |

### AWS Services
| Service | Purpose |
|---|---|
| AWS S3 | Document & selfie image storage |
| AWS Rekognition | (Available, currently using DeepFace locally) |
| AWS Textract | (Available, currently using EasyOCR locally) |
| AWS Region | ap-south-1 (Mumbai) |

### AML Data Provider
| Service | Purpose |
|---|---|
| OpenSanctions API | Real-time global sanctions/PEP screening |
| Demo Local Watchlist | Built-in test data for demos |

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 18.3.1 | UI framework |
| TypeScript | 5.5.3 | Type-safe JavaScript |
| Vite | 5.3.4 | Build tool |
| TailwindCSS | 3.4.6 | Styling |
| Zustand | 5.0.13 | State management |
| TanStack Query | 5.100.11 | API data fetching & caching |
| React Router | 6.26.0 | Client-side routing |
| Recharts | 3.8.1 | Risk score charts |
| Framer Motion | 12.39.0 | Animations |
| Supabase JS | 2.106.0 | Auth client |
| Axios | 1.7.2 | HTTP client |

### Infrastructure
| Technology | Purpose |
|---|---|
| Docker + Docker Compose | Containerized deployment |
| Redis 7 (Alpine) | Message broker for Celery |
| Celery Flower | Task monitoring dashboard (port 5555) |
| PostgreSQL (via Supabase) | Primary database |

---

## 8. System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SYSTEM ARCHITECTURE                                │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────┐
  │   USER BROWSER   │
  │  React + Vite    │
  │  TypeScript      │
  │  TailwindCSS     │
  └────────┬─────────┘
           │ HTTPS REST API calls
           ▼
  ┌──────────────────────────────────────────────────────────────────────────┐
  │                        FASTAPI BACKEND  (port 8000)                      │
  │                                                                          │
  │  /api/v1/auth          → Login, OTP, JWT                                 │
  │  /api/v1/onboarding    → Profile, Documents, Status                      │
  │  /api/v1/documents     → Upload to S3, trigger OCR                       │
  │  /api/v1/face          → Upload selfie, trigger face check               │
  │  /api/v1/aml           → Manual AML screening trigger                    │
  │  /api/v1/risk          → Risk score calculation                          │
  │  /api/v1/cases         → Compliance case management                      │
  │  /api/v1/admin         → Admin overrides                                 │
  └──────────┬───────────────────────────────────────────────────────────────┘
             │                              │
             │ Enqueue tasks                │ Read/Write
             ▼                              ▼
  ┌─────────────────────┐        ┌──────────────────────┐
  │   REDIS (broker)    │        │  POSTGRESQL          │
  │   redis:7-alpine    │        │  (via Supabase)      │
  │                     │        │                      │
  │  Queues:            │        │  Tables:             │
  │  - ocr              │        │  - users             │
  │  - face             │        │  - onboarding_state  │
  │  - aml              │        │  - individual_profiles│
  │  - ai               │        │  - corporate_profiles│
  └──────┬──────────────┘        │  - documents         │
         │                       │  - face_verifications│
         │ Workers consume       │  - aml_screenings    │
         ▼                       │  - risk_scores       │
  ┌──────────────────────────────│  - cases             │
  │      CELERY WORKERS          │  - audit_logs        │
  │                              │  - alerts            │
  │  worker_ocr  (2 threads)     └──────────────────────┘
  │    → EasyOCR extracts text
  │    → OpenCV preprocesses image
  │    → Saves to DocumentVerification
  │
  │  worker_face (2 threads)
  │    → DeepFace Facenet512 compares faces
  │    → OpenCV quality checks
  │    → Saves to FaceVerification
  │
  │  worker_aml  (2 threads)
  │    → Checks Demo Watchlist / OpenSanctions API
  │    → Saves to AMLScreening
  │    → Creates Case if flagged
  │
  │  worker_ai   (1 thread)
  │    → Runs KYC validation scoring
  │    → Calls Groq (llama3-70b-8192) for summary
  │    → Updates OnboardingState
  └──────────────────────────────────────────────────────┘
             │
             ▼
  ┌──────────────────────────────────────────────────────┐
  │              EXTERNAL SERVICES                       │
  │                                                      │
  │  AWS S3          → Document/selfie storage           │
  │  Supabase Auth   → User authentication               │
  │  OpenSanctions   → Real-time AML watchlist API       │
  │  Groq API        → LLM (llama3-70b-8192) summaries   │
  └──────────────────────────────────────────────────────┘
```

---

## 9. Celery Worker Architecture

The platform uses **4 dedicated worker queues** to process tasks in parallel:

```
Document Upload
    → [ocr queue]   worker_ocr   → EasyOCR → DocumentVerification

Selfie Upload
    → [face queue]  worker_face  → DeepFace → FaceVerification

Both done?
    → [ai queue]    worker_ai    → KYC Scoring → OnboardingState

KYC passes?
    → [aml queue]   worker_aml   → AML Screening → AMLScreening + Case
```

Each task has:
- **Max 3 retries** with exponential backoff
- **Redis distributed lock** (prevents duplicate processing)
- **Structured logging** (structlog) for full audit trail

---

## 10. Role-Based Access Control

| Role | Permissions |
|---|---|
| `user` | Submit own KYC, view own status |
| `kyc_officer` | View all KYC results, calculate risk scores, make decisions |
| `aml_analyst` | Trigger AML screening, view AML results |
| `compliance_manager` | All of the above + approve/reject/freeze users |
| `auditor` | Read-only access to all records |
| `admin` | Full access including admin overrides |

---

## 11. Onboarding State Machine

```
REGISTERED
    ↓
TYPE_SELECTED
    ↓
PROFILE_COMPLETED
    ↓
DOCUMENTS_UPLOADED
    ↓
KYC_PENDING
    ↓
AML_PENDING ──────────────────────────────────────────┐
    ↓                                                  │
UNDER_REVIEW ←── (KYC score 40–59 OR AML flagged)     │
    ↓                                                  │
APPROVED ✅  /  REJECTED ❌  /  FROZEN 🔒              │
                                                       │
(Sanctioned user skips UNDER_REVIEW → REJECTED) ←─────┘
```

Every state transition is:
- Validated (cannot skip steps)
- Logged to `audit_logs` table with IP address, user agent, actor ID
- Emitted as a workflow event for downstream processing

---

## 12. Key Business Metrics the Platform Tracks

| Metric | Where |
|---|---|
| KYC Score (0–100) | `onboarding_state.kyc_score` |
| AML Score (0–100) | `onboarding_state.aml_score` |
| Final Risk Score (0–100) | `onboarding_state.final_score` |
| Face Similarity % | `face_verifications.similarity_score` |
| OCR Confidence % | `document_verifications.confidence_scores` |
| Open Cases | `cases` table (sanctions_hit, pep_match, aml_alert) |
| Audit Trail | `audit_logs` table (every action timestamped) |

---

## 13. Demo Watchlist (Built-in Test Data)

The platform ships with a built-in demo watchlist for testing and demonstrations:

| Name | Type | Risk Level | Decision |
|---|---|---|---|
| John Illegal | Sanctions | CRITICAL | AUTO_REJECT |
| Nikhil Kumar | Sanctions | CRITICAL | AUTO_REJECT |
| Global Blacklist User | Sanctions | CRITICAL | AUTO_REJECT |
| Minister Demo | PEP | HIGH | MANUAL_REVIEW |
| Elon Musk | PEP (demo) | HIGH | MANUAL_REVIEW |
| Rahul Mishra | PEP | HIGH | MANUAL_REVIEW |
| Fraud News User | Adverse Media | MEDIUM | ESCALATE |
| Manish Das | Adverse Media | MEDIUM | ESCALATE |

In production, these are replaced by the **OpenSanctions API** (real global database).

---

## 14. Summary for CEO

| Capability | Technology Used |
|---|---|
| User Authentication | Supabase (JWT) + Phone OTP |
| Document OCR | EasyOCR 1.7.2 + OpenCV 4.13 |
| Face Verification | DeepFace 0.0.100 (Facenet512 model) |
| AML Screening | OpenSanctions API + Demo Watchlist |
| Risk Scoring | Custom rule-based engine (7 dimensions) |
| AI Compliance Summary | Groq API — **llama3-70b-8192** |
| Async Processing | Celery 5.4.0 + Redis 7 (4 worker queues) |
| Database | PostgreSQL via Supabase |
| File Storage | AWS S3 (ap-south-1) |
| Frontend | React 18 + TypeScript + TailwindCSS |
| Deployment | Docker Compose (6 containers) |
| Audit Trail | Full immutable log of every action |

**The platform is designed to:**
1. Onboard users in minutes (not days)
2. Automatically reject high-risk users without human intervention
3. Flag borderline cases for human review
4. Maintain a complete audit trail for regulatory compliance
5. Scale horizontally by adding more Celery workers
