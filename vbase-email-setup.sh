#!/bin/bash
# vbase.co Email Setup Script
# This script sets up the email infrastructure for vbase.co on the VPS

set -e  # Exit on error

echo "========================================="
echo "vbase.co Email Setup Script"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}→ $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root (use sudo)"
    exit 1
fi

print_info "Starting vbase.co email setup..."
echo ""

# Step 1: Create DKIM keys
print_info "Step 1: Generating DKIM keys for vbase.co..."
mkdir -p /etc/opendkim/keys/vbase.co
cd /etc/opendkim/keys/vbase.co

if [ -f "default.private" ]; then
    print_info "DKIM keys already exist. Skipping generation..."
else
    opendkim-genkey -b 2048 -d vbase.co -D /etc/opendkim/keys/vbase.co -s default -v
    chown opendkim:opendkim /etc/opendkim/keys/vbase.co/default.private
    chmod 600 /etc/opendkim/keys/vbase.co/default.private
    print_success "DKIM keys generated"
fi

echo ""
print_info "📋 DKIM Public Key (Add this to your DNS):"
echo "========================================="
cat /etc/opendkim/keys/vbase.co/default.txt
echo "========================================="
echo ""
read -p "Press Enter after you've added the DKIM record to DNS..."

# Step 2: Update OpenDKIM key table
print_info "Step 2: Updating OpenDKIM key table..."
if grep -q "default._domainkey.vbase.co" /etc/opendkim/key.table; then
    print_info "Key table already contains vbase.co entry"
else
    echo "default._domainkey.vbase.co vbase.co:default:/etc/opendkim/keys/vbase.co/default.private" >> /etc/opendkim/key.table
    print_success "Key table updated"
fi

# Step 3: Update OpenDKIM signing table
print_info "Step 3: Updating OpenDKIM signing table..."
if grep -q "@vbase.co" /etc/opendkim/signing.table; then
    print_info "Signing table already contains vbase.co entries"
else
    echo "" >> /etc/opendkim/signing.table
    echo "# vbase.co domain" >> /etc/opendkim/signing.table
    echo "@vbase.co                    default._domainkey.vbase.co" >> /etc/opendkim/signing.table
    echo "noreply@vbase.co            default._domainkey.vbase.co" >> /etc/opendkim/signing.table
    echo "support@vbase.co            default._domainkey.vbase.co" >> /etc/opendkim/signing.table
    print_success "Signing table updated"
fi

# Step 4: Test DKIM configuration
print_info "Step 4: Testing DKIM configuration..."
systemctl restart opendkim
sleep 2

if systemctl is-active --quiet opendkim; then
    print_success "OpenDKIM restarted successfully"
else
    print_error "OpenDKIM failed to start. Check logs with: journalctl -u opendkim"
    exit 1
fi

# Step 5: Test DKIM key
print_info "Step 5: Verifying DKIM key in DNS..."
opendkim-testkey -d vbase.co -s default -vvv

# Step 6: Reload Postfix
print_info "Step 6: Reloading Postfix..."
systemctl reload postfix
print_success "Postfix reloaded"

echo ""
print_success "VPS email setup complete!"
echo ""
print_info "📋 Next Steps:"
echo "1. Ensure these DNS records are configured for vbase.co:"
echo "   - MX record pointing to mail.vbase.co"
echo "   - A record for mail.vbase.co pointing to 5.161.20.187"
echo "   - SPF TXT record: v=spf1 ip4:5.161.20.187 ip6:2a01:4ff:f0:4b95::1 -all"
echo "   - DKIM TXT record (shown above)"
echo "   - DMARC TXT record for _dmarc.vbase.co"
echo ""
echo "2. Test your configuration:"
echo "   dig MX vbase.co"
echo "   dig TXT default._domainkey.vbase.co"
echo "   dig TXT vbase.co"
echo ""
echo "3. Update your Supabase database with:"
echo "   INSERT INTO public.domain_slugs (domain, noreply, support)"
echo "   VALUES ('vbase.co', true, true)"
echo "   ON CONFLICT (domain) DO UPDATE SET noreply = true, support = true;"
echo ""
echo "4. Set the OUTBOUND_SMTP_ENDPOINT secret in your Supabase project:"
echo "   supabase secrets set OUTBOUND_SMTP_ENDPOINT=http://5.161.20.187:5000/send"
echo ""
print_success "Setup completed successfully!"

