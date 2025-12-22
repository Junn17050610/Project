// Konfigurasi
const API_URL = "https://prediksi-cuaca.up.railway.app/api/predict";

// Variabel global
let selectedFile = null;

// Element references
const fileInput = document.getElementById("fileInput");
const cameraInput = document.getElementById("cameraInput");
const previewSection = document.getElementById("previewSection");
const imagePreview = document.getElementById("imagePreview");
const predictBtn = document.getElementById("predictBtn");
const resultSection = document.getElementById("resultSection");
const errorMessage = document.getElementById("errorMessage");

// Event listeners
fileInput.addEventListener("change", handleImageSelect);
cameraInput.addEventListener("change", handleImageSelect);
predictBtn.addEventListener("click", handlePredict);

/**
 * Handle image selection from file or camera
 */
function handleImageSelect(e) {
  const file = e.target.files[0];

  if (!file) return;

  // Validasi tipe file
  if (!file.type.startsWith("image/")) {
    showError("File yang dipilih bukan gambar!");
    return;
  }

  // Validasi ukuran file (maksimal 10MB)
  if (file.size > 10 * 1024 * 1024) {
    showError("Ukuran file terlalu besar! Maksimal 10MB");
    return;
  }

  selectedFile = file;

  // Preview gambar
  const reader = new FileReader();
  reader.onload = function (event) {
    imagePreview.src = event.target.result;
    imagePreview.style.display = "block";
    previewSection.querySelector(".placeholder").style.display = "none";
    predictBtn.disabled = false;

    // Hide previous results
    resultSection.classList.remove("show");
    hideError();
  };
  reader.readAsDataURL(file);
}

/**
 * Handle prediction
 */
async function handlePredict() {
  if (!selectedFile) {
    showError("Tidak ada gambar yang dipilih!");
    return;
  }

  // Update button state
  predictBtn.textContent = "Memproses...";
  predictBtn.disabled = true;
  hideError();

  try {
    // Buat FormData
    const formData = new FormData();
    formData.append("image", selectedFile);

    // Kirim request ke backend
    const response = await fetch(API_URL, {
      method: "POST",
      body: formData,
    });

    // Parse response
    const result = await response.json();

    // DEBUG: Log seluruh response dari server
    console.log("=== RESPONSE DARI SERVER ===");
    console.log("Full result:", result);
    console.log("Status:", result.status);
    console.log("===========================");

    if (result.status === "success") {
      // ✅ PREDIKSI BERHASIL
      const isRain = result.data.is_rain;
      const confidence = result.data.confidence;
      const probabilities = result.data.probabilities;
      const validation = result.data.validation || null; // Sky validation info

      showResult(isRain, confidence, probabilities, validation);
      
    } else if (result.status === "error") {
      // ❌ ERROR DARI BACKEND
      
      // CEK APAKAH INI ERROR SKY DETECTOR (Bukan gambar langit)
      if (result.detail && result.detail.is_sky === false) {
        // Gambar BUKAN LANGIT - Tampilkan error khusus
        showNonSkyError(result.message, result.detail);
      } else {
        // Error lainnya
        showError(result.message || "Terjadi kesalahan saat prediksi");
      }
    }
    
  } catch (error) {
    console.error("Error:", error);

    // Handle berbagai jenis error
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      showError(
        "Tidak dapat terhubung ke server. Pastikan backend Flask sudah berjalan."
      );
    } else {
      showError("Error: " + error.message);
    }
  } finally {
    // Reset button state
    predictBtn.textContent = "Prediksi Cuaca";
    predictBtn.disabled = false;
  }
}

/**
 * Show prediction result
 */
function showResult(isRain, confidence, probabilities, validation = null) {
  const resultIcon = document.getElementById("resultIcon");
  const resultTitle = document.getElementById("resultTitle");
  const resultDescription = document.getElementById("resultDescription");
  const confidenceText = document.getElementById("confidenceText");

  // DEBUG: Log nilai yang diterima
  console.log("=== SHOW RESULT ===");
  console.log("isRain:", isRain, "| Type:", typeof isRain);
  console.log("confidence:", confidence);
  console.log("probabilities:", probabilities);
  console.log("validation:", validation);
  console.log("==================");

  // Reset classes
  resultSection.classList.remove("rain", "no-rain");

  // Konversi isRain ke boolean
  let rainStatus = false;
  
  if (typeof isRain === "boolean") {
    rainStatus = isRain;
  } else if (typeof isRain === "string") {
    const lowerIsRain = isRain.toLowerCase();
    rainStatus = lowerIsRain === "true" || lowerIsRain === "1" || lowerIsRain === "hujan";
  } else if (typeof isRain === "number") {
    rainStatus = isRain === 1 || isRain > 0;
  }

  // Fallback: Cek dari probabilitas jika isRain tidak jelas
  if (probabilities && !isRain) {
    let hujanProb = 0;
    let tidakHujanProb = 0;
    
    for (let [className, prob] of Object.entries(probabilities)) {
      const classLower = className.toLowerCase();
      if (classLower.includes("tidak") || classLower.includes("no")) {
        tidakHujanProb = prob;
      } else if (classLower.includes("hujan") || classLower.includes("rain")) {
        hujanProb = prob;
      }
    }
    
    if (hujanProb > tidakHujanProb) {
      rainStatus = true;
    }
  }

  console.log("Final rainStatus:", rainStatus);

  // Tampilkan hasil
  if (rainStatus) {
    resultSection.classList.add("rain");
    resultIcon.textContent = "🌧️";
    resultTitle.textContent = "HUJAN";
    resultDescription.textContent =
      "Prediksi menunjukkan kemungkinan besar akan turun hujan dalam kurun waktu 1-2 jam";
  } else {
    resultSection.classList.add("no-rain");
    resultIcon.textContent = "☀️";
    resultTitle.textContent = "TIDAK HUJAN";
    resultDescription.textContent =
      "Prediksi menunjukkan cuaca cerah tanpa hujan dalam kurun waktu 1-2 jam";
  }

  // Tampilkan confidence dan probabilitas
  let confidenceHTML = `<strong>Tingkat Kepercayaan: ${confidence.toFixed(2)}%</strong>`;

  // ✅ TAMBAHAN: Tampilkan badge validasi sky detector (jika ada)
  if (validation && validation.is_sky_image) {
    confidenceHTML += `<br><small style="color: #2ecc71; font-size: 11px; margin-top: 5px; display: block;">
      ✓ Gambar langit tervalidasi (${validation.sky_confidence.toFixed(1)}% confidence)
    </small>`;
  }

  // Detail probabilitas
  if (probabilities) {
    confidenceHTML +=
      '<br><small style="font-size: 12px; margin-top: 8px; display: block; opacity: 0.9;">';
    confidenceHTML += "<strong>Detail Probabilitas:</strong><br>";
    
    let hujanProb = null;
    let tidakHujanProb = null;
    
    for (let [className, prob] of Object.entries(probabilities)) {
      const classLower = className.toLowerCase();
      
      if (classLower.includes("tidak") || classLower.includes("no") || 
          classLower.includes("cerah") || classLower.includes("clear")) {
        tidakHujanProb = { name: "Tidak Hujan", prob: prob };
      } else if (classLower.includes("hujan") || classLower.includes("rain")) {
        hujanProb = { name: "Hujan", prob: prob };
      }
    }
    
    if (hujanProb) {
      confidenceHTML += `${hujanProb.name}: ${hujanProb.prob.toFixed(2)}%`;
    }
    
    if (hujanProb && tidakHujanProb) {
      confidenceHTML += " | ";
    }
    
    if (tidakHujanProb) {
      confidenceHTML += `${tidakHujanProb.name}: ${tidakHujanProb.prob.toFixed(2)}%`;
    }
    
    if (!hujanProb && !tidakHujanProb) {
      for (let [className, prob] of Object.entries(probabilities)) {
        confidenceHTML += `${className}: ${prob.toFixed(2)}% | `;
      }
      confidenceHTML = confidenceHTML.slice(0, -3);
    }
    
    confidenceHTML += "</small>";
  }

  confidenceText.innerHTML = confidenceHTML;
  resultSection.classList.add("show");
}

/**
 * ✨ NEW: Show error untuk gambar bukan langit
 */
function showNonSkyError(message, detail) {
  // Buat error message yang lebih informatif
  let errorHTML = `
    <div style="text-align: center;">
      <div style="font-size: 48px; margin-bottom: 10px;">🚫</div>
      <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">
        ${message}
      </div>
      <div style="font-size: 14px; opacity: 0.9; margin-bottom: 15px;">
        ${detail.suggestion || 'Silakan upload gambar langit/awan untuk prediksi cuaca'}
      </div>
      <div style="font-size: 12px; padding: 10px; background: rgba(255,255,255,0.2); border-radius: 5px;">
        <em>Sistem mendeteksi gambar ini bukan gambar langit</em>
      </div>
    </div>
  `;
  
  errorMessage.innerHTML = errorHTML;
  errorMessage.classList.add("show");
  
  // Auto hide after 10 seconds
  setTimeout(() => {
    hideError();
  }, 10000);
}

/**
 * Show error message
 */
function showError(message) {
  errorMessage.innerHTML = `
    <div style="text-align: center;">
      <div style="font-size: 18px; font-weight: bold;">❌ Error</div>
      <div style="margin-top: 8px;">${message}</div>
    </div>
  `;
  errorMessage.classList.add("show");

  // Auto hide after 5 seconds
  setTimeout(() => {
    hideError();
  }, 5000);
}

/**
 * Hide error message
 */
function hideError() {
  errorMessage.classList.remove("show");
  errorMessage.innerHTML = ""; // Clear content
}

// Cek koneksi backend saat halaman dimuat
async function checkBackendConnection() {
  try {
    const response = await fetch("https://prediksi-cuaca.up.railway.app/api/health");
    const result = await response.json();

    if (result.status === "healthy") {
      console.log("✓ Backend connected successfully");
      console.log("✓ Sky Detector:", result.sky_detector_loaded ? "ACTIVE" : "INACTIVE");
    }
  } catch (error) {
    console.warn(
      "⚠ Backend not connected. Make sure Flask server is running."
    );
  }
}

// Check backend saat halaman dimuat
checkBackendConnection();