FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt ./requirements.txt

RUN pip install --no-cache-dir -r requirements.txt

RUN mkdir -p /app/src /app/data /app/model /app/datasets /mnt/models

COPY src/ /app/src/
COPY model/ /app/model/
COPY data/ /app/data/

ENV MODEL_DIR '/mnt/models/'
ENV DATA_DIR '/app/data/'
ENV MODEL_OUT_DIR '/app/model/'

EXPOSE 9001

CMD ["python3", "/app/src/serve.py"]