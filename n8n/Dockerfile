# Free community n8n for Render.com (Docker).
# Pair with Render PostgreSQL — see n8n/RENDER-FREE-SETUP.md

FROM n8nio/n8n:1.82.1

USER root
COPY render-start.sh /render-start.sh
RUN chmod +x /render-start.sh
USER node

ENV N8N_LISTEN_ADDRESS=0.0.0.0 \
    GENERIC_TIMEZONE=Asia/Karachi \
    TZ=Asia/Karachi \
    N8N_DIAGNOSTICS_ENABLED=false \
    N8N_PERSONALIZATION_ENABLED=false

EXPOSE 5678

ENTRYPOINT ["tini", "--", "/render-start.sh"]
