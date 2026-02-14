# Nginx Configuration — webtropia2

## /etc/nginx/nginx.conf

```nginx
user www-data;
worker_processes auto;
worker_cpu_affinity auto;
pid /run/nginx.pid;
error_log /var/log/nginx/error.log;
include /etc/nginx/modules-enabled/*.conf;

events {
    worker_connections 768;
    # multi_accept on;
}

http {

    ##
    # Basic Settings
    ##

    sendfile on;
    tcp_nopush on;
    types_hash_max_size 2048;
    server_tokens off;

    # server_names_hash_bucket_size 64;
    # server_name_in_redirect off;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    ##
    # SSL Settings
    ##

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    ##
    # Logging Settings
    ##

    access_log /var/log/nginx/access.log;

    ##
    # Gzip Settings
    ##

    gzip on;

    # gzip_vary on;
    # gzip_proxied any;
    # gzip_comp_level 6;
    # gzip_buffers 16 8k;
    # gzip_http_version 1.1;
    # gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    ##
    # Virtual Host Configs
    ##

    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}


#mail {
#    # See sample authentication script at:
#    # http://wiki.nginx.org/ImapAuthenticateWithApachePhpScript
#
#    # auth_http localhost/auth.php;
#    # pop3_capabilities "TOP" "USER";
#    # imap_capabilities "IMAP4rev1" "UIDPLUS";
#
#    server {
#        listen     localhost:110;
#        protocol   pop3;
#        proxy      on;
#    }
#
#    server {
#        listen     localhost:143;
#        protocol   imap;
#        proxy      on;
#    }
#}
```

---

## /etc/nginx/sites-enabled/default

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root /var/www/html;

    index index.html index.htm index.nginx-debian.html;

    server_name _;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

---

## /etc/nginx/sites-enabled/backend.tyto-design.de

Multibase Dashboard Backend — Proxy zu `localhost:3001`.
Enthält am Ende ein `include` für die automatisch generierten Instanz-Configs.

```nginx
server {
    server_name backend.tyto-design.de;

    # Main API Proxy
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # Forward Real IP
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/backend.tyto-design.de/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/backend.tyto-design.de/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot

}
server {
    if ($host = backend.tyto-design.de) {
        return 301 https://$host$request_uri;
    } # managed by Certbot


    server_name backend.tyto-design.de;
    listen 80;
    return 404; # managed by Certbot


}

include /opt/multibase/nginx/sites-enabled/*.conf;
```

---

## /opt/multibase/nginx/sites-enabled/ — Instanz-Configs

Automatisch generierte Configs pro Supabase-Instanz. Aktuell vorhanden:

```
auto-test-03.conf
auto-test-04.conf
auto-test-05.conf
auto-test-06.conf
auto-test-07.conf
auto-test-08.conf
auto-test-09.conf
auto-test-10.conf
auto-test-11.conf
auto-test-12.conf
auto-test-13.conf
auto-test-14.conf
autp-test-14.conf   # <-- Typo-Duplikat
```

### Beispiel: auto-test-03.conf

Jede Instanz bekommt 2 Subdomains mit SSL (Certbot) und HTTP→HTTPS Redirect:

- **Studio**: `<name>.backend.tyto-design.de` → Proxy zu Studio-Port
- **API**: `<name>-api.backend.tyto-design.de` → Proxy zu Kong-Port

```nginx
# Auto-generated config for auto-test-03
server {
    server_name auto-test-03.backend.tyto-design.de;

    location / {
        proxy_pass http://127.0.0.1:8960;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/auto-test-03.backend.tyto-design.de/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/auto-test-03.backend.tyto-design.de/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot

}

server {
    server_name auto-test-03-api.backend.tyto-design.de;

    location / {
        proxy_pass http://127.0.0.1:6960;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/auto-test-03.backend.tyto-design.de/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/auto-test-03.backend.tyto-design.de/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot

}

server {
    if ($host = auto-test-03.backend.tyto-design.de) {
        return 301 https://$host$request_uri;
    } # managed by Certbot


    listen 80;
    server_name auto-test-03.backend.tyto-design.de;
    return 404; # managed by Certbot


}

server {
    if ($host = auto-test-03-api.backend.tyto-design.de) {
        return 301 https://$host$request_uri;
    } # managed by Certbot


    listen 80;
    server_name auto-test-03-api.backend.tyto-design.de;
    return 404; # managed by Certbot


}
```
