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
    console.log("Data:", result.data);
    console.log("is_rain value:", result.data?.is_rain);
    console.log("is_rain type:", typeof result.data?.is_rain);
    console.log("===========================");

    if (result.status === "success") {
      // Tampilkan hasil prediksi
      const isRain = result.data.is_rain;
      const confidence = result.data.confidence;
      const probabilities = result.data.probabilities;

      showResult(isRain, confidence, probabilities);
    } else {
      // Tampilkan error dari backend
      showError(result.message || "Terjadi kesalahan saat prediksi");
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
function showResult(isRain, confidence, probabilities) {
  const resultIcon = document.getElementById("resultIcon");
  const resultTitle = document.getElementById("resultTitle");
  const resultDescription = document.getElementById("resultDescription");
  const confidenceText = document.getElementById("confidenceText");

  // DEBUG: Log nilai yang diterima
  console.log("=== SHOW RESULT ===");
  console.log("isRain:", isRain, "| Type:", typeof isRain);
  console.log("confidence:", confidence);
  console.log("probabilities:", probabilities);
  console.log("==================");

  // Reset classes
  resultSection.classList.remove("rain", "no-rain");

  // Konversi isRain ke boolean dengan berbagai kemungkinan format
  let rainStatus = false;
  
  if (typeof isRain === "boolean") {
    rainStatus = isRain;
  } else if (typeof isRain === "string") {
    // Cek berbagai format string: "true", "True", "1", "hujan", dll
    const lowerIsRain = isRain.toLowerCase();
    rainStatus = lowerIsRain === "true" || lowerIsRain === "1" || lowerIsRain === "hujan";
  } else if (typeof isRain === "number") {
    rainStatus = isRain === 1 || isRain > 0;
  }

  console.log("Converted rainStatus:", rainStatus, "| Type:", typeof rainStatus);

  // Jika confidence > 50% dan probabilities menunjukkan hujan lebih tinggi, itu hujan
  if (probabilities) {
    const probs = Object.entries(probabilities);
    console.log("All probabilities:", probs);
    
    // Cari probabilitas hujan
    let hujanProb = 0;
    let tidakHujanProb = 0;
    
    for (let [className, prob] of probs) {
      const classLower = className.toLowerCase();
      if (classLower.includes("hujan") || classLower.includes("rain")) {
        // Jika nama class adalah "tidak_hujan" atau "no_rain", itu bukan hujan
        if (classLower.includes("tidak") || classLower.includes("no")) {
          tidakHujanProb = prob;
        } else {
          hujanProb = prob;
        }
      }
    }
    
    console.log("Hujan prob:", hujanProb, "| Tidak hujan prob:", tidakHujanProb);
    
    // Override rainStatus berdasarkan probabilitas tertinggi
    if (hujanProb > tidakHujanProb) {
      rainStatus = true;
    } else {
      rainStatus = false;
    }
  }

  console.log("Final rainStatus:", rainStatus);

  if (rainStatus) {
    resultSection.classList.add("rain");
    resultIcon.textContent = "🌧️";
    resultTitle.textContent = "HUJAN";
    resultDescription.textContent =
      "Prediksi menunjukkan kemungkinan besar akan turun hujan satu jam kedepan";
  } else {
    resultSection.classList.add("no-rain");
    resultIcon.textContent = "☀️";
    resultTitle.textContent = "TIDAK HUJAN";
    resultDescription.textContent =
      "Prediksi menunjukkan cuaca cerah tanpa hujan satu jam kedepan";
  }

  // Tampilkan confidence dan probabilitas
  let confidenceHTML = `<strong>Tingkat Kepercayaan: ${confidence.toFixed(
    2
  )}%</strong>`;

  if (probabilities) {
    confidenceHTML +=
      '<br><small style="font-size: 12px; margin-top: 8px; display: block; opacity: 0.9;">';
    confidenceHTML += "<strong>Detail Probabilitas:</strong><br>";
    
    // Pisahkan probabilitas hujan dan tidak hujan
    let hujanProb = null;
    let tidakHujanProb = null;
    
    for (let [className, prob] of Object.entries(probabilities)) {
      const classLower = className.toLowerCase();
      
      // Deteksi class hujan vs tidak hujan
      if (classLower.includes("tidak") || classLower.includes("no") || 
          classLower.includes("cerah") || classLower.includes("clear")) {
        tidakHujanProb = { name: className, prob: prob };
      } else if (classLower.includes("hujan") || classLower.includes("rain")) {
        hujanProb = { name: className, prob: prob };
      }
    }
    
    // Tampilkan dalam urutan: Hujan | Tidak Hujan
    if (hujanProb) {
      confidenceHTML += `Hujan: ${hujanProb.prob.toFixed(2)}%`;
    }
    
    if (hujanProb && tidakHujanProb) {
      confidenceHTML += " | ";
    }
    
    if (tidakHujanProb) {
      confidenceHTML += `Tidak Hujan: ${tidakHujanProb.prob.toFixed(2)}%`;
    }
    
    // Jika tidak ada yang cocok, tampilkan semua
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
 * Show error message
 */
function showError(message) {
  errorMessage.textContent = message;
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
}

// Cek koneksi backend saat halaman dimuat
async function checkBackendConnection() {
  try {
    const response = await fetch("https://prediksi-cuaca.up.railway.app/api/health");
    const result = await response.json();

    if (result.status === "healthy") {
      console.log("✓ Backend connected successfully");
    }
  } catch (error) {
    console.warn(
      "⚠ Backend not connected. Make sure Flask server is running."
    );
  }
}

// Check backend saat halaman dimuat
checkBackendConnection();