"""
Flask Backend API - Production Ready for Railway Deployment
Weather Prediction System
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import tensorflow as tf
from tensorflow import keras
import numpy as np
from PIL import Image
import io
import json
import os
from datetime import datetime
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# ============================================================================
# CONFIGURATION
# ============================================================================
class Config:
    # Model path - Railway will look for this
    MODEL_PATH = os.getenv('MODEL_PATH', 'models/model_weather_cnn_20251117_202635.h5')
    METADATA_PATH = os.getenv('METADATA_PATH', 'results/model_metadata_20251117_202635.json')
    
    # Image settings
    IMG_SIZE = (224, 224)
    CLASSES = ['tidak_hujan', 'hujan']  # Default, will be overridden by metadata
    
    # Server settings
    PORT = int(os.getenv('PORT', 8080))  # Railway uses dynamic PORT
    DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'
    HOST = os.getenv('HOST', '0.0.0.0')

# ============================================================================
# LOAD MODEL AND METADATA
# ============================================================================
model = None
metadata = None

def load_model_and_metadata():
    """Load model and metadata on startup"""
    global model, metadata, Config
    
    try:
        logger.info("="*70)
        logger.info("LOADING MODEL AND METADATA")
        logger.info("="*70)
        
        # Load model
        if os.path.exists(Config.MODEL_PATH):
            logger.info(f"Loading model from: {Config.MODEL_PATH}")
            model = keras.models.load_model(Config.MODEL_PATH)
            logger.info("✓ Model loaded successfully")
        else:
            logger.error(f"✗ Model not found: {Config.MODEL_PATH}")
            logger.error("Available files:")
            if os.path.exists('models'):
                logger.error(f"  models/: {os.listdir('models')}")
            return False
        
        # Load metadata (optional)
        if os.path.exists(Config.METADATA_PATH):
            logger.info(f"Loading metadata from: {Config.METADATA_PATH}")
            with open(Config.METADATA_PATH, 'r') as f:
                metadata = json.load(f)
            
            # Update classes from metadata
            if 'classes' in metadata:
                Config.CLASSES = metadata['classes']
                logger.info(f"✓ Classes from metadata: {Config.CLASSES}")
            
            logger.info(f"✓ Model accuracy: {metadata['performance']['accuracy']*100:.2f}%")
        else:
            logger.warning(f"⚠ Metadata not found: {Config.METADATA_PATH}")
            logger.warning("Using default class mapping")
        
        logger.info("="*70)
        return True
        
    except Exception as e:
        logger.error(f"✗ Error loading model: {str(e)}")
        return False

# Load on startup
if not load_model_and_metadata():
    logger.error("Failed to load model! Server will start but predictions will fail.")

# ============================================================================
# PREPROCESSING FUNCTION
# ============================================================================
def preprocess_image(image_bytes):
    """
    Preprocess image for model input
    """
    try:
        # Open image
        img = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if needed
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Resize
        img = img.resize(Config.IMG_SIZE)
        
        # Convert to array
        img_array = np.array(img)
        
        # Normalize [0, 1]
        img_array = img_array.astype('float32') / 255.0
        
        # Add batch dimension
        img_array = np.expand_dims(img_array, axis=0)
        
        return img_array
    
    except Exception as e:
        raise Exception(f"Error preprocessing image: {str(e)}")

# ============================================================================
# API ROUTES
# ============================================================================

@app.route('/', methods=['GET'])
def home():
    """Health check endpoint"""
    return jsonify({
        'status': 'online',
        'message': 'Weather Prediction API',
        'model_loaded': model is not None,
        'version': '1.0.0',
        'timestamp': datetime.now().isoformat(),
        'endpoints': {
            'health': 'GET /',
            'model_info': 'GET /api/model-info',
            'predict': 'POST /api/predict'
        }
    })

@app.route('/api/health', methods=['GET'])
def health_check():
    """Detailed health check"""
    return jsonify({
        'status': 'healthy' if model is not None else 'unhealthy',
        'model_loaded': model is not None,
        'metadata_loaded': metadata is not None,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/model-info', methods=['GET'])
def model_info():
    """Get model information"""
    if metadata is None:
        return jsonify({
            'status': 'success',
            'data': {
                'model_loaded': model is not None,
                'classes': Config.CLASSES,
                'message': 'Model loaded but metadata not available'
            }
        })
    
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
    """Predict weather from image"""
    # Check if model is loaded
    if model is None:
        logger.error("Prediction failed: Model not loaded")
        return jsonify({
            'status': 'error',
            'message': 'Model not loaded. Please contact administrator.'
        }), 500
    
    # Check if image is provided
    if 'image' not in request.files:
        return jsonify({
            'status': 'error',
            'message': 'No image provided'
        }), 400
    
    file = request.files['image']
    
    if file.filename == '':
        return jsonify({
            'status': 'error',
            'message': 'Empty filename'
        }), 400
    
    try:
        # Read and preprocess image
        image_bytes = file.read()
        processed_image = preprocess_image(image_bytes)
        
        # Predict
        predictions = model.predict(processed_image, verbose=0)
        predicted_class_idx = np.argmax(predictions[0])
        confidence = float(predictions[0][predicted_class_idx]) * 100
        
        # Get class label
        predicted_class = Config.CLASSES[predicted_class_idx]
        
        # Probabilities for all classes
        class_probabilities = {
            Config.CLASSES[i]: float(predictions[0][i]) * 100 
            for i in range(len(Config.CLASSES))
        }
        
        logger.info(f"Prediction: {predicted_class} ({confidence:.2f}%)")
        
        # Response
        return jsonify({
            'status': 'success',
            'data': {
                'prediction': predicted_class,
                'confidence': round(confidence, 2),
                'probabilities': class_probabilities,
                'is_rain': predicted_class == 'hujan',
                'timestamp': datetime.now().isoformat()
            }
        })
    
    except Exception as e:
        logger.error(f"Prediction error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Prediction failed: {str(e)}'
        }), 500

# ============================================================================
# ERROR HANDLERS
# ============================================================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'status': 'error',
        'message': 'Endpoint not found'
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'status': 'error',
        'message': 'Internal server error'
    }), 500

# ============================================================================
# RUN SERVER
# ============================================================================

if __name__ == '__main__':
    logger.info("="*70)
    logger.info("STARTING FLASK SERVER")
    logger.info("="*70)
    logger.info(f"Port: {Config.PORT}")
    logger.info(f"Debug: {Config.DEBUG}")
    logger.info("="*70)
    
    # Run server
    app.run(
        host='0.0.0.0',  # Listen on all interfaces (required for Railway)
        port=Config.PORT,
        debug=Config.DEBUG
    )