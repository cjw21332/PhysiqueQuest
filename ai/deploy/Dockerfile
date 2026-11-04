ARG OLLAMA_IMAGE=ollama/ollama:0.40.11
FROM ${OLLAMA_IMAGE}
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY ai/Modelfile /opt/phiq/Modelfile
COPY ai/deploy/start-inference.sh /opt/phiq/start-inference.sh
RUN sed -i 's/\r$//' /opt/phiq/start-inference.sh && chmod 755 /opt/phiq/start-inference.sh
ENV OLLAMA_HOST=0.0.0.0:11434 OLLAMA_NO_CLOUD=1 OLLAMA_KEEP_ALIVE=30m OLLAMA_CONTEXT_LENGTH=8192 OLLAMA_NUM_PARALLEL=1 OLLAMA_MAX_QUEUE=4
EXPOSE 11434
HEALTHCHECK --interval=30s --timeout=5s --start-period=300s --retries=20 CMD test -f /tmp/phiq-ready && curl -fsS http://127.0.0.1:11434/api/ps > /dev/null || exit 1
ENTRYPOINT ["/opt/phiq/start-inference.sh"]
