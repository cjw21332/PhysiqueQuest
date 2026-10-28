FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libglib2.0-0 libgl1 && rm -rf /var/lib/apt/lists/*
COPY pose-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY pose-service/main.py ./main.py
COPY frontend/public/pose/pose_landmarker_lite.task ./pose_landmarker_lite.task
ENV POSE_MODEL_PATH=/app/pose_landmarker_lite.task
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
