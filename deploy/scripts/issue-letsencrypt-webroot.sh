#!/bin/sh
# Run on the VPS after Cloudflare DNS A/AAAA records for admin + client
# point to THIS server (or temporarily set records to "DNS only" / grey cloud
# so HTTP-01 reaches nginx on port 80).
set -e
certbot certonly --webroot -w /var/www/certbot \
  -d admin.emdadsy.com -d client.emdadsy.com \
  --non-interactive --agree-tos --register-unsafely-without-email \
  --preferred-challenges http --keep-until-expiring --expand
# After success, point nginx ssl_certificate* to:
#   /etc/letsencrypt/live/admin.emdadsy.com/fullchain.pem
#   /etc/letsencrypt/live/admin.emdadsy.com/privkey.pem
# and include /etc/letsencrypt/options-ssl-nginx.conf + ssl_dhparams if present.
echo "Certbot finished. Update /etc/nginx/sites-available/emdad-wms-* SSL paths, then: nginx -t && systemctl reload nginx"
