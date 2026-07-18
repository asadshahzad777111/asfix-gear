#!/bin/sh
set -e
# Render injects PORT; n8n reads N8N_PORT
export N8N_PORT="${PORT:-5678}"
export N8N_PROTOCOL="${N8N_PROTOCOL:-https}"
export N8N_LISTEN_ADDRESS="${N8N_LISTEN_ADDRESS:-0.0.0.0}"
exec n8n start
