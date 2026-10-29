# ScheduleGod AI — backend (FastAPI + OR-Tools CP-SAT + scipy intelligence)
FROM python:3.12-slim

# OR-Tools needs a glibc-based image; Debian slim is fine. Keeps the layer
# cached when only app code changes.
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]