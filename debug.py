"""
Debug script untuk Railway deployment
Check file structure, memory, dependencies
"""

import os
import sys
import psutil

print("="*70)
print("RAILWAY DEBUG INFO")
print("="*70)

# 1. Python info
print(f"\n[Python]")
print(f"Version: {sys.version}")
print(f"Executable: {sys.executable}")

# 2. Environment variables
print(f"\n[Environment Variables]")
print(f"PORT: {os.getenv('PORT', 'Not set')}")
print(f"DEBUG: {os.getenv('DEBUG', 'Not set')}")
print(f"RAILWAY_ENVIRONMENT: {os.getenv('RAILWAY_ENVIRONMENT', 'Not set')}")

# 3. Current directory
print(f"\n[Current Directory]")
print(f"CWD: {os.getcwd()}")
print(f"Files:")
for item in os.listdir('.'):
    print(f"  - {item}")

# 4. Models directory
print(f"\n[Models Directory]")
if os.path.exists('models'):
    print(f"✓ models/ exists")
    for item in os.listdir('models'):
        size = os.path.getsize(os.path.join('models', item))
        print(f"  - {item} ({size/1024/1024:.2f} MB)")
else:
    print(f"✗ models/ NOT FOUND!")

# 5. Results directory
print(f"\n[Results Directory]")
if os.path.exists('results'):
    print(f"✓ results/ exists")
    for item in os.listdir('results'):
        print(f"  - {item}")
else:
    print(f"✗ results/ NOT FOUND!")

# 6. Memory info
print(f"\n[Memory Info]")
try:
    memory = psutil.virtual_memory()
    print(f"Total: {memory.total / 1024 / 1024:.2f} MB")
    print(f"Available: {memory.available / 1024 / 1024:.2f} MB")
    print(f"Used: {memory.percent}%")
except:
    print("psutil not available")

# 7. Try import dependencies
print(f"\n[Dependencies Check]")
deps = ['flask', 'flask_cors', 'tensorflow', 'numpy', 'PIL']
for dep in deps:
    try:
        __import__(dep)
        print(f"✓ {dep}")
    except ImportError as e:
        print(f"✗ {dep}: {e}")

# 8. Try load model
print(f"\n[Model Loading Test]")
try:
    import tensorflow as tf
    from tensorflow import keras
    
    model_path = 'models/model_weather_cnn_20251117_202635.h5'
    if os.path.exists(model_path):
        print(f"✓ Model file exists: {model_path}")
        print(f"  Size: {os.path.getsize(model_path)/1024/1024:.2f} MB")
        
        print(f"  Attempting to load...")
        model = keras.models.load_model(model_path)
        print(f"  ✓ Model loaded successfully!")
        print(f"  Input shape: {model.input_shape}")
        print(f"  Output shape: {model.output_shape}")
    else:
        print(f"✗ Model file NOT FOUND: {model_path}")
except Exception as e:
    print(f"✗ Error: {e}")

print("\n" + "="*70)
print("DEBUG COMPLETE")
print("="*70)