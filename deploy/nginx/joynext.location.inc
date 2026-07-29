# Managed by Joynext_Robot_Part_Store/deploy/server/deploy.sh.
location = /joynext {
    return 308 /joynext/;
}

# Vinext's standalone server does not serve basePath-prefixed static files.
# These directories are copied from the release image during deployment and
# served directly by the existing Nginx container.
location ^~ /joynext/assets/ {
    alias /var/www/html/__STATIC_DIR__/assets/;
    access_log off;
    expires 7d;
    add_header Cache-Control "public";
}

location ^~ /joynext/products/ {
    alias /var/www/html/__STATIC_DIR__/products/;
    access_log off;
    expires 7d;
    add_header Cache-Control "public";
}

location ^~ /joynext/scenes/ {
    alias /var/www/html/__STATIC_DIR__/scenes/;
    access_log off;
    expires 7d;
    add_header Cache-Control "public";
}

location = /joynext/favicon.svg {
    alias /var/www/html/__STATIC_DIR__/favicon.svg;
    access_log off;
    expires 7d;
    add_header Cache-Control "public";
}

location ^~ /joynext/ {
    proxy_pass http://__UPSTREAM__:3000;
    proxy_http_version 1.1;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Prefix /joynext;

    proxy_connect_timeout 10s;
    proxy_send_timeout 90s;
    proxy_read_timeout 90s;
    proxy_redirect off;
}
