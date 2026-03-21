VAMOS CAPS DNS-FIX

The subdomain caps.ftable.co.il resolves correctly on Google DNS (8.8.8.8) but not on the user's local DNS.

Check what DNS server ftable.co.il uses:
1. curl -s "https://dns.google/resolve?name=caps.ftable.co.il&type=A" 2>&1
2. Check if the subdomain A record was actually added to the DNS zone (not just cPanel subdomain config)
3. Use cPanel API to check the DNS zone:
   curl -s -u "ftableco:Sb9k46-l)WI2Gq" "https://ftable.co.il:2083/json-api/cpanel?cpanel_jsonapi_user=ftableco&cpanel_jsonapi_apiversion=2&cpanel_jsonapi_module=ZoneEdit&cpanel_jsonapi_func=fetchzone&domain=ftable.co.il" 2>&1 | grep -i caps

4. If the A record is missing from the DNS zone — add it:
   The IP is 195.225.46.105

5. Verify after fix:
   curl -s "https://dns.google/resolve?name=caps.ftable.co.il&type=A" 2>&1

Never give the user commands to run. Fix everything autonomously.

VAMOS CAPS DNS-FIX — END
