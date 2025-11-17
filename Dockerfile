# Gunakan Python versi 3.10 agar TensorFlow kompatibel
FROM python:3.10

# Set working directory
WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install requirements
RUN pip install --no-cache-dir -r requirements.txt

# Copy semua file project
COPY . .

# Expose port Flask
EXPOSE 5000

# Jalankan app
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:app"]
