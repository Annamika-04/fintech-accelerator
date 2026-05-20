# Diagnostics Guide

## Database Connection Issue: `socket.gaierror: [Errno 11001] getaddrinfo failed`

This error means your machine cannot resolve the hostname `db.hrkfafbihexdwfovguzd.supabase.co`.

### Root Causes

1. **No Internet Connection** - Machine is offline
2. **DNS Failure** - Cannot resolve domain names
3. **Firewall/VPN** - Network is blocked
4. **Corporate Proxy** - Network intercepting connections
5. **ISP Issues** - DNS server down

### Diagnostic Steps

#### Step 1: Check Internet Connectivity
```powershell
ping google.com
```

If this fails, you have no internet connection. Check your network.

#### Step 2: Test DNS Resolution
```powershell
nslookup db.hrkfafbihexdwfovguzd.supabase.co
```

**Expected output:** An IP address (e.g., `1.2.3.4`)

**If it fails:** DNS resolution is broken. Try:
- Restart your router
- Change DNS to public (8.8.8.8, 1.1.1.1)
- Check firewall rules

#### Step 3: Test Connection to Supabase
```powershell
# Test HTTPS connection
curl -I https://db.hrkfafbihexdwfovguzd.supabase.co:5432

# Or use telnet
telnet db.hrkfafbihexdwfovguzd.supabase.co 5432
```

#### Step 4: Verify .env DATABASE_URL Format

Your current DATABASE_URL:
```
postgresql+asyncpg://postgres:Fintech%40onedata@db.hrkfafbihexdwfovguzd.supabase.co:5432/postgres
```

**Checklist:**
- ✅ Protocol: `postgresql+asyncpg://` (correct)
- ✅ User: `postgres` (default)
- ✅ Password: `Fintech%40onedata` (@ encoded as %40)
- ✅ Host: `db.hrkfafbihexdwfovguzd.supabase.co` (correct)
- ✅ Port: `5432` (correct)
- ✅ Database: `postgres` (correct)

### Fixes

#### Option 1: Fix Internet/DNS
```powershell
# Use Google Public DNS
netsh interface ipv4 set dnsservers "Ethernet" static 8.8.8.8
netsh interface ipv4 add dnsservers "Ethernet" 8.8.4.4

# Flush DNS cache
ipconfig /flushdns

# Restart your connection
```

#### Option 2: Check Firewall
- **Windows Firewall:** Allow Python through firewall
- **Corporate VPN:** Disconnect and reconnect
- **Antivirus:** Check if it's blocking connections

#### Option 3: Use Different Database Host
If Supabase is unreachable, switch to local development:

```env
# Local PostgreSQL
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/fintech

# Or use SQLite (development only)
DATABASE_URL=sqlite+aiosqlite:///./fintech.db
```

### Testing After Fix

Run the verification script:
```bash
python verify_setup.py
```

Or manually test:
```bash
python -c "import asyncio; from app.db.session import engine; asyncio.run(engine.connect())"
```

## If Database Connection Works But OTP Still Fails

Check the API response:
```bash
curl -X POST http://localhost:8000/api/v1/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210"}'
```

**Common responses:**
- `200 OK` - OTP sent (check backend logs for OTP code)
- `429 Too Many Requests` - Rate limited (wait 5 minutes)
- `422 Unprocessable Entity` - Invalid phone format
- `500 Internal Server Error` - Check logs

## Backend Logs

Run backend with verbose logging:
```bash
# Unix/Mac
DEBUG=true uvicorn app.main:app --reload --log-level debug

# Windows PowerShell
$env:DEBUG="true"; uvicorn app.main:app --reload --log-level debug
```

Watch for:
- `"event": "http_request"` - HTTP logs
- `ERROR` - Any exceptions
- Connection pool info - Database pool status
