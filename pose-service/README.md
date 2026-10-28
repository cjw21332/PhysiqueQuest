# Recorded-video pose service

This optional service implements the existing `POST /analyze` provider contract with the repository's MediaPipe Pose Landmarker Lite model. It reports pose detection coverage in sampled frames. It does not identify exercises, count reps, or grade form. No video, frames, or pose landmarks are intentionally retained. The service processes one request at a time and returns 503 while busy.

## Local development

From the repository root, create a Python 3.12 environment and install `pose-service/requirements.txt`. Generate a unique random secret with `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Set `POSE_ANALYSIS_API_KEY` to that secret in the service process and run `python -m uvicorn main:app --host 127.0.0.1 --port 8000 --no-access-log` from `pose-service`. Set the same secret and `POSE_ANALYSIS_URL=http://127.0.0.1:8000/analyze` in the NestJS backend's private environment, then restart the backend. Do not commit the secret or put it in a `NEXT_PUBLIC_` or `EXPO_PUBLIC_` variable.

On Windows, `start-local.ps1` reads `POSE_ANALYSIS_API_KEY` from an ignored `pose-service/.env`; run `powershell -ExecutionPolicy Bypass -File pose-service/start-local.ps1` from the repository root. Restart the backend after changing its environment. This local provider is bound to loopback; a backend running on another machine or in a container needs a reachable HTTPS service address instead.

Run `python pose-service/test_service.py` with the environment's Python to test authentication, invalid input, and actual MP4 inference with a temporary test key. The request returns `{ "analysis": { "observations": ["..."] } }`, which the Prepare page displays. The model is loaded from `frontend/public/pose/pose_landmarker_lite.task`; override `POSE_MODEL_PATH` if needed.

## Deployment

Build from the repository root with `docker build -f pose-service/Dockerfile -t physiquequest-pose .`. The Dockerfile-specific ignore file keeps unrelated project files and local secrets out of the build context. Set a separate, cryptographically random `POSE_ANALYSIS_API_KEY` in the service's secret configuration and use the same value for the backend. Set `POSE_ANALYSIS_URL` to the service's HTTPS `/analyze` URL. Prefer private networking, restrict ingress to the backend, and terminate TLS at a trusted proxy. Configure the proxy to accept at most 28,000,500 bytes and avoid request-body and authorization logging. Do not expose this development server directly to the public Internet.

The service verifies its bearer key before reading the body, limits decoded clips to 20 MiB and two minutes, rejects unsupported types and excessive frame rate, dimensions, or frame count, and deletes its temporary file in a `finally` block. A process crash can leave a temporary file; deploy with ephemeral storage and appropriate cleanup. It accepts recorded workouts only, not the optional image/readiness provider contract. The backend remains responsible for authenticating the app user. This implementation has a 45-second processing deadline and the backend has a 60-second provider deadline; benchmark real videos on your target hardware before choosing capacity. Concurrent users may receive a retryable busy error. Remote service availability, privacy controls, and accuracy depend on deployment and testing.
