# Email Configuration Documentation

## Overview
This document outlines the complete email system configuration for Therai email infrastructure, including VPS setup, Postfix configuration, OpenDKIM signing, and Supabase edge functions.

## VPS Email Infrastructure

### Server Details
- **Main IP**: 5.161.196.180
- **Floating IP**: 5.161.20.187
- **Domains**: 
  - therai.co (Mail Domain: mail.therai.co)
  - vbase.co (Mail Domain: mail.vbase.co)
  - scai.co (Mail Domain: mail.scai.co)

### DNS Records

#### therai.co
```
A     mail.therai.co        → 5.161.20.187
A     therai.co            → 5.161.20.187
AAAA  mail.therai.co       → 2a01:4ff:f0:4b95::1
MX    therai.co            → mail.therai.co (priority 10)
TXT   therai.co            → "v=spf1 ip4:5.161.20.187 ip6:2a01:4ff:f0:4b95::1 -all"
TXT   default._domainkey   → [DKIM public key]
TXT   _dmarc               → "v=DMARC1; p=quarantine; rua=mailto:info@theraiastro.com; fo=1; adkim=s; aspf=s; pct=100"
```

#### vbase.co
```
A     mail.vbase.co        → 5.161.20.187
A     vbase.co            → 5.161.20.187
AAAA  mail.vbase.co       → 2a01:4ff:f0:4b95::1
MX    vbase.co            → mail.vbase.co (priority 10)
TXT   vbase.co            → "v=spf1 ip4:5.161.20.187 ip6:2a01:4ff:f0:4b95::1 -all"
TXT   default._domainkey.vbase.co   → [DKIM public key - see setup instructions]
TXT   _dmarc.vbase.co      → "v=DMARC1; p=quarantine; rua=mailto:postmaster@vbase.co; fo=1; adkim=s; aspf=s; pct=100"
```

#### scai.co
```
A     mail.scai.co         → 5.161.20.187
A     scai.co             → 5.161.20.187
AAAA  mail.scai.co        → 2a01:4ff:f0:4b95::1
MX    scai.co             → mail.scai.co (priority 10)
TXT   scai.co             → "v=spf1 ip4:5.161.20.187 ip6:2a01:4ff:f0:4b95::1 -all"
TXT   default._domainkey.scai.co    → "v=DKIM1; h=sha256; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtTGZPyesHybKrtragZaRlDbFruz/SvMTMfHioy+YGvcSXvfhdrZObYYHwMEo6lSfRT+ehkUepRGmgHW5UNqTgmUZNuCnpS1rozVJ8Wugy19iEVKSoR1O4ZUIev3cW5y3GUYrTWBCI58Se4N8XMwecD3NtkKr243zd5UpYWKCnSwToRBkA5fHG22jtven2N9sqHVkhrS22DdJVpajLrcNYoNSAMcGFiEMEiad5sojKnAlLTklQ0kklmVJz7AQUzd7AAPbc051YSxUChA6ijwPkKO4icHxy8Ev5QxWFxAreb4FyMWVNFBKfssmP1yn7pr51eLi+GamIA9dtHfebw8sjwIDAQAB"
TXT   _dmarc.scai.co      → "v=DMARC1; p=quarantine; rua=mailto:postmaster@scai.co; fo=1; adkim=s; aspf=s; pct=100"
```

## Postfix Configuration

### Main Configuration File
**Location**: `/etc/postfix/main.cf`

**Key Settings**:
```ini
# Network interfaces
inet_interfaces = 127.0.0.1, [::1], 5.161.20.187

# Domain settings
myhostname = mail.therai.co
mydomain = therai.co
mydestination = $myhostname, localhost, localhost.localdomain

# TLS Configuration
smtpd_tls_cert_file = /etc/letsencrypt/live/mail.therai.co/fullchain.pem
smtpd_tls_key_file = /etc/letsencrypt/live/mail.therai.co/privkey.pem
smtpd_tls_security_level = may

# OpenDKIM Milter Integration
smtpd_milters = inet:localhost:8891
non_smtpd_milters = inet:localhost:8891
milter_default_action = accept
milter_protocol = 6
```

### Master Configuration File
**Location**: `/etc/postfix/master.cf`

**Key Settings**:
```ini
# SMTP service
smtp      inet  n       -       y       -       -       smtpd

# Custom pipe transport for therai domains
therai-flask unix - n n - - pipe
    flags=Fq user=therai 
    argv=/usr/bin/python3 /usr/local/therai/inbox_v187.py
```

## OpenDKIM Configuration

### Main Configuration File
**Location**: `/etc/opendkim.conf`

**Key Settings**:
```ini
# Socket configuration
Socket inet:8891@localhost

# Key and signing
KeyTable /etc/opendkim/key.table
SigningTable /etc/opendkim/signing.table

# Trust and hosts
TrustAnchorFile /usr/share/dns/root.key
ExternalIgnoreList /etc/opendkim/trusted.hosts
InternalHosts /etc/opendkim/trusted.hosts

# Logging
Syslog yes
SyslogSuccess yes
LogWhy yes
```

### Signing Table
**Location**: `/etc/opendkim/signing.table`

**Current Entries**:
```
# therai.co domain
@therai.co                    default._domainkey.therai.co
noreply@therai.co            default._domainkey.therai.co
no-reply@therai.co           default._domainkey.therai.co
info@therai.co               default._domainkey.therai.co
hello@therai.co              default._domainkey.therai.co
contact@therai.co            default._domainkey.therai.co
help@therai.co               default._domainkey.therai.co
marketing@therai.co          default._domainkey.therai.co
admin@therai.co              default._domainkey.therai.co
legal@therai.co              default._domainkey.therai.co
hr@therai.co                 default._domainkey.therai.co
dev@therai.co                default._domainkey.therai.co

# vbase.co domain
@vbase.co                    default._domainkey.vbase.co
noreply@vbase.co            default._domainkey.vbase.co
support@vbase.co            default._domainkey.vbase.co

# scai.co domain
@scai.co                    default._domainkey.scai.co
noreply@scai.co            default._domainkey.scai.co
support@scai.co            default._domainkey.scai.co
hello@scai.co              default._domainkey.scai.co
contact@scai.co            default._domainkey.scai.co
info@scai.co               default._domainkey.scai.co
```

### Key Table
**Location**: `/etc/opendkim/key.table`

**Current Entries**:
```
default._domainkey.therai.co therai.co:default:/etc/opendkim/keys/therai.co/default.private
default._domainkey.vbase.co vbase.co:default:/etc/opendkim/keys/vbase.co/default.private
default._domainkey.scai.co scai.co:default:/etc/opendkim/keys/scai.co/default.private
```

### DKIM Keys

#### therai.co
**Location**: `/etc/opendkim/keys/therai.co/`
- `default.private` - Private key for signing
- `default.txt` - Public key for DNS

#### vbase.co
**Location**: `/etc/opendkim/keys/vbase.co/`
- `default.private` - Private key for signing
- `default.txt` - Public key for DNS

#### scai.co
**Location**: `/etc/opendkim/keys/scai.co/`
- `default.private` - Private key for signing
- `default.txt` - Public key for DNS

## Email Processing Scripts

### Incoming Email Handler
**Location**: `/usr/local/therai/inbox_v187.py`

**Purpose**: Processes incoming emails and forwards to Supabase edge function

**Key Features**:
- Receives emails from Postfix via pipe transport
- Extracts email content and metadata
- Forwards to `inboundMessenger` edge function
- Handles domain/slug validation

### Outbound Email Handler
**Location**: `/opt/send_outbound.py`

**Purpose**: Processes outbound emails from Supabase edge functions

**Key Features**:
- Receives JSON payload from edge functions
- Validates email data
- Injects emails into Postfix for delivery
- Logs all email attempts

## Supabase Edge Functions

### Inbound Email Processing
**Function**: `inboundMessenger`

**Purpose**: Processes incoming emails from VPS

**Key Features**:
- Validates email format and direction
- Extracts clean email addresses
- Saves to `email_messages` table
- Handles domain/slug validation

### Outbound Email Processing
**Function**: `outbound-messenger`

**Purpose**: Sends emails via VPS SMTP endpoint

**Key Features**:
- Validates email data
- Sends payload to VPS SMTP endpoint
- Logs VPS response
- Saves to database only if VPS approves

### Verification Email
**Function**: `verification-emailer`

**Purpose**: Sends verification emails during signup

**Key Features**:
- Uses same SMTP endpoint as outbound-messenger
- Sends verification emails with templates
- Handles signup flow

## Database Configuration

### Email Messages Table
**Table**: `public.email_messages`

**Key Columns**:
- `id` - Primary key
- `from_email` - Sender email
- `to_email` - Recipient email
- `subject` - Email subject
- `body` - Email content
- `direction` - 'inbound' or 'outgoing'
- `raw_headers` - VPS response data
- `created_at` - Timestamp

### Domain Slugs Table
**Table**: `public.domain_slugs`

**Purpose**: Validates domain/slug combinations

**Current Configuration**:
```sql
UPDATE public.domain_slugs 
SET 
    info = true,
    media = true,
    billing = true,
    support = true,
    noreply = true,
    hello = true,
    contact = true,
    help = true,
    marketing = true,
    admin = true,
    legal = true,
    hr = true,
    dev = true
WHERE domain = 'therai.co';
```

## Service Management

### Systemd Services
```bash
# Postfix
systemctl status postfix
systemctl restart postfix
systemctl reload postfix

# OpenDKIM
systemctl status opendkim
systemctl restart opendkim
systemctl reload opendkim
```

### Service Dependencies
**File**: `/etc/systemd/system/postfix.service.d/override.conf`
```ini
[Unit]
After=opendkim.service
Requires=opendkim.service
```

## Logging and Monitoring

### Log Locations
- **Postfix**: `/var/log/mail.log`
- **OpenDKIM**: `journalctl -u opendkim`
- **Outbound**: `/var/log/outbound_sender.log`

### Log Rotation Configuration
**Postfix logs** (`/var/log/mail.log`):
- **Rotation**: Weekly
- **Retention**: 4 weeks
- **Compression**: Yes (gzip)
- **Config**: `/etc/logrotate.d/rsyslog`

**Outbound sender logs** (`/var/log/outbound_sender.log`):
- **Rotation**: Daily
- **Retention**: 7 days
- **Compression**: Yes (gzip)
- **Config**: `/etc/logrotate.d/outbound-sender`

### Key Log Patterns
```bash
# Check incoming connections
tail -f /var/log/mail.log | grep -i "connect\|ehlo\|helo"

# Check DKIM signing
tail -f /var/log/mail.log | grep -i dkim

# Check outbound email processing
tail -f /var/log/outbound_sender.log
```

### Log Management Commands
```bash
# Check log sizes
du -h /var/log/mail.log* /var/log/outbound_sender.log*

# Test log rotation
logrotate -d /etc/logrotate.d/outbound-sender

# Force log rotation
logrotate -f /etc/logrotate.d/outbound-sender

# Check logrotate status
cat /var/lib/logrotate/status | grep -E "(mail|outbound)"
```

## Troubleshooting Commands

### Check Service Status
```bash
# Check all email services
systemctl status postfix opendkim

# Check listening ports
netstat -tlnp | grep :25
netstat -tlnp | grep :8891
```

### Test Email Flow
```bash
# Test local email delivery
echo "Test message" | mail -s "Test Subject" info@therai.co

# Test external connection
telnet 5.161.20.187 25

# Check DNS resolution
dig MX therai.co
dig A mail.therai.co
```

### Validate Configuration
```bash
# Check Postfix configuration
postfix check

# Check OpenDKIM configuration
opendkim-testkey -d therai.co -s default

# Check TLS certificates
openssl s_client -connect mail.therai.co:25 -starttls smtp
```

## vbase.co Domain Setup

### Complete VPS Configuration for vbase.co

Follow these steps to set up email infrastructure for vbase.co on your VPS:

#### Step 1: Generate DKIM Keys for vbase.co
```bash
# Create directory for vbase.co keys
sudo mkdir -p /etc/opendkim/keys/vbase.co
cd /etc/opendkim/keys/vbase.co

# Generate DKIM key pair
sudo opendkim-genkey -b 2048 -d vbase.co -D /etc/opendkim/keys/vbase.co -s default -v

# Set proper ownership
sudo chown opendkim:opendkim /etc/opendkim/keys/vbase.co/default.private
sudo chmod 600 /etc/opendkim/keys/vbase.co/default.private

# Display the public key for DNS
cat /etc/opendkim/keys/vbase.co/default.txt
```

Copy the DKIM public key from `default.txt` and add it to your DNS as a TXT record:
- **Name**: `default._domainkey.vbase.co`
- **Value**: The content from default.txt (e.g., `v=DKIM1; k=rsa; p=MIIBIjANBg...`)

#### Step 2: Update OpenDKIM Key Table
```bash
# Edit the key table
sudo nano /etc/opendkim/key.table

# Add this line:
default._domainkey.vbase.co vbase.co:default:/etc/opendkim/keys/vbase.co/default.private
```

#### Step 3: Update OpenDKIM Signing Table
```bash
# Edit the signing table
sudo nano /etc/opendkim/signing.table

# Add these lines:
@vbase.co                    default._domainkey.vbase.co
noreply@vbase.co            default._domainkey.vbase.co
support@vbase.co            default._domainkey.vbase.co
```

#### Step 4: Configure DNS Records for vbase.co

Add the following DNS records to your vbase.co domain:

```
# A Records
A     mail.vbase.co        → 5.161.20.187
A     vbase.co            → 5.161.20.187  (if not already pointing elsewhere)

# AAAA Record (IPv6)
AAAA  mail.vbase.co       → 2a01:4ff:f0:4b95::1

# MX Record
MX    vbase.co            → mail.vbase.co (priority 10)

# SPF Record
TXT   vbase.co            → "v=spf1 ip4:5.161.20.187 ip6:2a01:4ff:f0:4b95::1 -all"

# DKIM Record (from Step 1)
TXT   default._domainkey.vbase.co → [Your DKIM public key from default.txt]

# DMARC Record
TXT   _dmarc.vbase.co     → "v=DMARC1; p=quarantine; rua=mailto:postmaster@vbase.co; fo=1; adkim=s; aspf=s; pct=100"
```

#### Step 5: Update VPS Scripts (if needed)

The existing scripts at `/opt/send_outbound.py` and `/usr/local/therai/inbox_v187.py` should work with vbase.co without modification, as they handle multiple domains dynamically.

#### Step 6: Restart Services
```bash
# Restart OpenDKIM to load new keys
sudo systemctl restart opendkim

# Verify OpenDKIM is running
sudo systemctl status opendkim

# Test DKIM key
sudo opendkim-testkey -d vbase.co -s default -vvv

# Reload Postfix (if needed)
sudo systemctl reload postfix
```

#### Step 7: Verify DNS Configuration
```bash
# Check MX records
dig MX vbase.co

# Check A record for mail server
dig A mail.vbase.co

# Check SPF record
dig TXT vbase.co

# Check DKIM record
dig TXT default._domainkey.vbase.co

# Check DMARC record
dig TXT _dmarc.vbase.co
```

#### Step 8: Database Configuration

Add vbase.co to the domain_slugs table in your Supabase database:

```sql
-- Insert vbase.co domain with noreply and support slugs
INSERT INTO public.domain_slugs (domain, noreply, support)
VALUES ('vbase.co', true, true)
ON CONFLICT (domain) DO UPDATE
SET noreply = true, support = true;
```

### Email Addresses Available for vbase.co
- `noreply@vbase.co` - For automated/no-reply emails
- `support@vbase.co` - For customer support emails

## Adding New Email Addresses/Slugs

### 1. Update OpenDKIM Signing Table
```bash
# Edit signing table
nano /etc/opendkim/signing.table

# Add new email address
newemail@therai.co    default._domainkey.therai.co

# Reload OpenDKIM
systemctl reload opendkim
```

### 2. Update Domain Slugs Table
```sql
-- Add new slug column if needed
ALTER TABLE public.domain_slugs 
ADD COLUMN IF NOT EXISTS newslug boolean DEFAULT false;

-- Enable slug for domain
UPDATE public.domain_slugs 
SET newslug = true
WHERE domain = 'therai.co';
```

### 3. Update VPS Scripts
- Modify `/usr/local/therai/inbox_v187.py` if needed
- Update `/opt/send_outbound.py` if needed

## Security Considerations

### Firewall Rules
- Port 25 (SMTP) - Open for incoming mail
- Port 587 (Submission) - Not configured
- Port 465 (SMTPS) - Not configured

### TLS Configuration
- Uses Let's Encrypt certificates
- TLS security level: `may` (optional but preferred)
- Self-signed certificates for internal communication

### DKIM Security
- 2048-bit RSA keys
- Relaxed/simple canonicalization
- Headers: From, To, Subject, Date, Message-ID

## Backup and Recovery

### Critical Files to Backup
- `/etc/postfix/main.cf`
- `/etc/postfix/master.cf`
- `/etc/opendkim/opendkim.conf`
- `/etc/opendkim/signing.table`
- `/etc/opendkim/key.table`
- `/etc/opendkim/keys/therai.co/`
- `/usr/local/therai/inbox_v187.py`
- `/opt/send_outbound.py`

### Database Backups
- `public.email_messages` table
- `public.domain_slugs` table
- `public.email_notification_templates` table

## Environment Variables

### Supabase Edge Functions
- `OUTBOUND_SMTP_ENDPOINT` - VPS SMTP endpoint URL
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key

### VPS Environment
- No additional environment variables required
- Configuration via files only

## Maintenance Schedule

### Daily
- Monitor email logs for errors
- Check service status

### Weekly
- Review email delivery rates
- Check DKIM key rotation (if needed)

### Monthly
- Review and update domain slugs
- Check TLS certificate expiration
- Review firewall rules

## Support Contacts

### VPS Provider
- [VPS Provider Support]

### Domain Registrar
- [Domain Registrar Support]

### Supabase Support
- [Supabase Support]

---

**Last Updated**: 2025-12-06
**Version**: 1.1
**Maintainer**: Therai Development Team

## Changelog

### Version 1.1 (2025-12-06)
- Added scai.co domain configuration
- Added DKIM keys for scai.co
- Added email addresses: noreply@scai.co, support@scai.co, hello@scai.co, contact@scai.co, info@scai.co

### Version 1.0 (2025-09-17)
- Initial documentation for therai.co and vbase.co
