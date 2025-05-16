FROM nginx:1.25-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY ./tls/ca.crt      /etc/ssl/ca.crt
COPY ./tls/server.crt  /etc/ssl/server.crt
COPY ./tls/server.key  /etc/ssl/server.key
