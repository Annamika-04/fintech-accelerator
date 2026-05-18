# AWS Setup Guide — KYC + AML Platform

## 1. Cognito User Pool Setup

```bash
# Create User Pool
aws cognito-idp create-user-pool \
  --pool-name kyc-platform-users \
  --policies '{"PasswordPolicy":{"MinimumLength":12,"RequireUppercase":true,"RequireLowercase":true,"RequireNumbers":true,"RequireSymbols":true}}' \
  --mfa-configuration OPTIONAL \
  --auto-verified-attributes email \
  --schema '[{"Name":"role","AttributeDataType":"String","Mutable":true}]'

# Create App Client (no secret for SPA)
aws cognito-idp create-user-pool-client \
  --user-pool-id ap-south-1_XXXXXXXXX \
  --client-name kyc-frontend \
  --no-generate-secret \
  --explicit-auth-flows ALLOW_USER_SRP_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --access-token-validity 1 \
  --refresh-token-validity 30 \
  --token-validity-units '{"AccessToken":"hours","RefreshToken":"days"}'

# Create Groups (one per role)
for GROUP in customer kyc_officer aml_analyst compliance_manager auditor admin; do
  aws cognito-idp create-group \
    --user-pool-id ap-south-1_XXXXXXXXX \
    --group-name $GROUP
done
```

## 2. S3 Bucket Setup

```bash
# Create private bucket
aws s3api create-bucket \
  --bucket kyc-documents-prod \
  --region ap-south-1 \
  --create-bucket-configuration LocationConstraint=ap-south-1

# Block all public access
aws s3api put-public-access-block \
  --bucket kyc-documents-prod \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket kyc-documents-prod \
  --versioning-configuration Status=Enabled

# Enable KMS encryption
aws s3api put-bucket-encryption \
  --bucket kyc-documents-prod \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "aws:kms"
      },
      "BucketKeyEnabled": true
    }]
  }'

# Lifecycle: auto-delete temp uploads after 1 day
aws s3api put-bucket-lifecycle-configuration \
  --bucket kyc-documents-prod \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "expire-pending-uploads",
      "Filter": {"Prefix": "temp/"},
      "Status": "Enabled",
      "Expiration": {"Days": 1}
    }]
  }'
```

## 3. Textract — No setup needed
Textract is API-based. Ensure your IAM role has `textract:AnalyzeDocument` permission.
Supported document formats: JPEG, PNG, PDF, TIFF.

## 4. Rekognition — No setup needed
Rekognition is API-based. Ensure your IAM role has `rekognition:CompareFaces` permission.
Recommended thresholds:
- SimilarityThreshold: 90.0 (strict)
- ConfidenceThreshold: 99.0

## 5. Secrets Manager

```bash
# Store all secrets
aws secretsmanager create-secret \
  --name kyc/prod/database \
  --secret-string '{"url":"postgresql+asyncpg://user:pass@rds-host:5432/kyc_db"}'

aws secretsmanager create-secret \
  --name kyc/prod/groq \
  --secret-string '{"api_key":"your-groq-key"}'

aws secretsmanager create-secret \
  --name kyc/prod/opensanctions \
  --secret-string '{"api_key":"your-opensanctions-key"}'
```

## 6. RDS PostgreSQL

```bash
aws rds create-db-instance \
  --db-instance-identifier kyc-postgres \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 16.2 \
  --master-username kyc_user \
  --master-user-password <strong-password> \
  --allocated-storage 100 \
  --storage-type gp3 \
  --storage-encrypted \
  --vpc-security-group-ids sg-xxxxxxxx \
  --db-subnet-group-name kyc-subnet-group \
  --backup-retention-period 7 \
  --multi-az \
  --no-publicly-accessible
```

## 7. ElastiCache Redis

```bash
aws elasticache create-replication-group \
  --replication-group-id kyc-redis \
  --description "KYC Celery broker" \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --engine-version 7.0 \
  --num-cache-clusters 2 \
  --at-rest-encryption-enabled \
  --transit-encryption-enabled
```

## 8. IAM Role for ECS Task

```bash
# Create role
aws iam create-role \
  --role-name kyc-ecs-task-role \
  --assume-role-policy-document file://ecs-trust-policy.json

# Attach custom policy
aws iam put-role-policy \
  --role-name kyc-ecs-task-role \
  --policy-name kyc-platform-policy \
  --policy-document file://iam_policy.json
```

## 9. CloudWatch Log Groups

```bash
aws logs create-log-group --log-group-name /kyc/api
aws logs create-log-group --log-group-name /kyc/workers
aws logs put-retention-policy --log-group-name /kyc/api --retention-in-days 90
aws logs put-retention-policy --log-group-name /kyc/workers --retention-in-days 90
```

## 10. VPC Recommendations

```
Public Subnet  → ALB
Private Subnet → ECS Fargate (API + Workers)
Private Subnet → RDS PostgreSQL
Private Subnet → ElastiCache Redis
NAT Gateway    → Outbound internet for workers (Groq, OpenSanctions)
```

Security Groups:
- ALB SG: inbound 443 from 0.0.0.0/0
- ECS SG: inbound 8000 from ALB SG only
- RDS SG: inbound 5432 from ECS SG only
- Redis SG: inbound 6379 from ECS SG only
