"""
Flask Backend API - Production Ready for Railway Deployment
Weather Prediction System
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask import render_template
import tensorflow as tf
from tensorflow import keras
import numpy as np
from PIL import Image
import io
import json
import os
from datetime import datetime
import logging
app = Flask(__name__)
CORS(app)  # Enable CORS untuk akses dari frontend

# ============================================================================
# KONFIGURASI
# ============================================================================
class Config:
    # Path models
    SKY_DETECTOR_PATH = 'models/sky_detector_20240101_120000.h5'  # Model langit vs bukan langit
    WEATHER_MODEL_PATH = 'models/model_weather_cnn_20240101_120000.h5'  # Model hujan vs tidak hujan
    WEATHER_METADATA_PATH = 'results/model_metadata_20240101_120000.json'
    
    IMG_SIZE = (224, 224)
    
    # Threshold confidence
    SKY_CONFIDENCE_THRESHOLD = 0.7  # Minimal 70% yakin ini gambar langit

# ============================================================================
# LOAD MODELS
# ============================================================================
print("="*70)
print("BACKEND API - PREDIKSI CUACA 2-STAGE")
print("="*70)

# Load Sky Detector Model
sky_detector = None
if os.path.exists(Config.SKY_DETECTOR_PATH):
    try:
        print(f"Loading Sky Detector dari: {Config.SKY_DETECTOR_PATH}")
        sky_detector = keras.models.load_model(Config.SKY_DETECTOR_PATH)
        print("✓ Sky Detector berhasil dimuat")
    except Exception as e:
        print(f"⚠ Sky Detector gagal dimuat: {str(e)}")
        print("  System akan skip validasi langit")
else:
    print(f"⚠ Sky Detector tidak ditemukan: {Config.SKY_DETECTOR_PATH}")
    print("  System akan skip validasi langit")

# Load Weather Prediction Model
weather_model = None
try:
    print(f"\nLoading Weather Model dari: {Config.WEATHER_MODEL_PATH}")
    weather_model = keras.models.load_model(Config.WEATHER_MODEL_PATH)
    print("✓ Weather Model berhasil dimuat")
    
    # Load metadata
    if os.path.exists(Config.WEATHER_METADATA_PATH):
        with open(Config.WEATHER_METADATA_PATH, 'r') as f:
            metadata = json.load(f)
        print(f"✓ Metadata berhasil dimuat")
        print(f"  - Akurasi Model: {metadata['performance']['accuracy']*100:.2f}%")
        
        # Ambil class mapping dari metadata
        if 'classes' in metadata:
            Config.CLASSES = metadata['classes']
            print(f"  - Classes: {Config.CLASSES}")
    else:
        metadata = None
        Config.CLASSES = ['tidak_hujan', 'hujan']
        print("⚠ Metadata tidak ditemukan, menggunakan default class order")
        
except Exception as e:
    print(f"✗ Error loading Weather Model: {str(e)}")
    weather_model = None
    metadata = None
    Config.CLASSES = ['tidak_hujan', 'hujan']

print("="*70)

# ============================================================================
# FUNGSI PREPROCESSING
# ============================================================================
def preprocess_image(image_bytes):
    """
    Preprocessing gambar sesuai dengan training
    """
    try:
        # Buka gambar dari bytes
        img = Image.open(io.BytesIO(image_bytes))
        
        # Convert ke RGB jika perlu
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Resize ke ukuran input model
        img = img.resize(Config.IMG_SIZE)
        
        # Convert ke array numpy
        img_array = np.array(img)
        
        # Normalisasi ke [0,1]
        img_array = img_array.astype('float32') / 255.0
        
        # Tambah batch dimension
        img_array = np.expand_dims(img_array, axis=0)
        
        return img_array
    
    except Exception as e:
        raise Exception(f"Error preprocessing image: {str(e)}")

# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.route('/')
def home():
    """
    Endpoint untuk cek status API
    """
    return jsonify({
        'status': 'online',
        'message': 'Weather Prediction API is running',
        'model_loaded': model is not None,
        'version': '1.0.0',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/model-info', methods=['GET'])
def model_info():
    """
    Endpoint untuk mendapatkan informasi model
    """
    if metadata is None:
        return jsonify({
            'status': 'error',
            'message': 'Metadata tidak tersedia'
        }), 404
    
    return jsonify({
        'status': 'success',
        'data': {
            'architecture': metadata.get('architecture'),
            'classes': metadata.get('classes'),
            'accuracy': metadata['performance']['accuracy'],
            'precision': metadata['performance']['precision'],
            'recall': metadata['performance']['recall'],
            'f1_score': metadata['performance']['f1_score'],
            'training_date': metadata.get('timestamp')
        }
    })

@app.route('/api/predict', methods=['POST'])
def predict():
    """
    Endpoint untuk prediksi cuaca dari gambar (2-STAGE)
    Stage 1: Validasi apakah gambar langit
    Stage 2: Prediksi cuaca (hujan/tidak hujan)
    """
    # Cek apakah weather model sudah dimuat
    if weather_model is None:
        return jsonify({
            'status': 'error',
            'message': 'Weather model belum dimuat'
        }), 500
    
    # Cek apakah ada file gambar
    if 'image' not in request.files:
        return jsonify({
            'status': 'error',
            'message': 'Tidak ada file gambar yang diupload'
        }), 400
    
    file = request.files['image']
    
    # Cek apakah file kosong
    if file.filename == '':
        return jsonify({
            'status': 'error',
            'message': 'File gambar kosong'
        }), 400
    
    try:
        # Baca file gambar
        image_bytes = file.read()
        
        # Preprocessing gambar
        processed_image = preprocess_image(image_bytes)
        
        # ====================================================================
        # STAGE 1: SKY DETECTION (Validasi gambar langit)
        # ====================================================================
        is_sky = True  # Default jika sky detector tidak ada
        sky_confidence = 1.0
        
        if sky_detector is not None:
            sky_predictions = sky_detector.predict(processed_image, verbose=0)
            
            # Asumsi: index 0 = bukan_langit, index 1 = langit
            # Atau sebaliknya, tergantung urutan folder saat training
            # Cek class_indices dari metadata sky detector
            sky_class_idx = np.argmax(sky_predictions[0])
            sky_confidence = float(sky_predictions[0][sky_class_idx])
            
            # Jika confidence untuk "langit" < threshold, reject
            if sky_class_idx == 0:  # Index 0 = bukan_langit
                is_sky = False
            elif sky_confidence < Config.SKY_CONFIDENCE_THRESHOLD:
                is_sky = False
        
        # Jika bukan gambar langit, return error
        if not is_sky:
            return jsonify({
                'status': 'error',
                'message': 'Gambar yang diupload bukan gambar langit',
                'detail': {
                    'is_sky': False,
                    'sky_confidence': round(sky_confidence * 100, 2),
                    'suggestion': 'Silakan upload gambar langit/awan untuk prediksi cuaca'
                }
            }), 400
        
        # ====================================================================
        # STAGE 2: WEATHER PREDICTION (Prediksi cuaca)
        # ====================================================================
        predictions = weather_model.predict(processed_image, verbose=0)
        predicted_class_idx = np.argmax(predictions[0])
        confidence = float(predictions[0][predicted_class_idx]) * 100
        
        # Dapatkan label kelas
        predicted_class = Config.CLASSES[predicted_class_idx]
        
        # Probabilitas untuk setiap kelas
        class_probabilities = {
            Config.CLASSES[i]: float(predictions[0][i]) * 100 
            for i in range(len(Config.CLASSES))
        }
        
        # Response
        return jsonify({
            'status': 'success',
            'data': {
                'prediction': predicted_class,
                'confidence': round(confidence, 2),
                'probabilities': class_probabilities,
                'is_rain': predicted_class == 'hujan',
                'validation': {
                    'is_sky_image': True,
                    'sky_confidence': round(sky_confidence * 100, 2)
                },
                'timestamp': datetime.now().isoformat()
            }
        })
    
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Error saat prediksi: {str(e)}'
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """
    Endpoint untuk health check
    """
    return jsonify({
        'status': 'healthy',
        'model_status': 'loaded' if model is not None else 'not_loaded',
        'timestamp': datetime.now().isoformat()
    })

# ============================================================================
# ERROR HANDLERS
# ============================================================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'status': 'error',
        'message': 'Endpoint tidak ditemukan'
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'status': 'error',
        'message': 'Internal server error'
    }), 500
@app.route('/web')
def web_ui():
    return render_template("index.html")
# ============================================================================
# RUN APP
# ============================================================================

if __name__ == '__main__':
    print("\n" + "="*70)
    print("Memulai Flask API Server...")
    print("="*70)
    print(f"API tersedia di: http://localhost:5000")
    print(f"Endpoints:")
    print(f"  - GET  / (Status API)")
    print(f"  - GET  /api/model-info (Info model)")
    print(f"  - POST /api/predict (Prediksi cuaca)")
    print(f"  - GET  /api/health (Health check)")
    print("="*70 + "\n")
    
    app.run(debug=True, host='0.0.0.0', port=5000)