
        // Konfigurasi
        const API_URL = 'https://prediksi-cuaca.up.railway.app/api/predict'; 

        // Variabel global
        let selectedFile = null;

        // Element references
        const fileInput = document.getElementById('fileInput');
        const cameraInput = document.getElementById('cameraInput');
        const previewSection = document.getElementById('previewSection');
        const imagePreview = document.getElementById('imagePreview');
        const predictBtn = document.getElementById('predictBtn');
        const resultSection = document.getElementById('resultSection');
        const errorMessage = document.getElementById('errorMessage');

        // Event listeners
        fileInput.addEventListener('change', handleImageSelect);
        cameraInput.addEventListener('change', handleImageSelect);
        predictBtn.addEventListener('click', handlePredict);

        /**
         * Handle image selection from file or camera
         */
        function handleImageSelect(e) {
            const file = e.target.files[0];
            
            if (!file) return;

            // Validasi tipe file
            if (!file.type.startsWith('image/')) {
                showError('File yang dipilih bukan gambar!');
                return;
            }

            // Validasi ukuran file (maksimal 10MB)
            if (file.size > 10 * 1024 * 1024) {
                showError('Ukuran file terlalu besar! Maksimal 10MB');
                return;
            }

            selectedFile = file;

            // Preview gambar
            const reader = new FileReader();
            reader.onload = function(event) {
                imagePreview.src = event.target.result;
                imagePreview.style.display = 'block';
                previewSection.querySelector('.placeholder').style.display = 'none';
                predictBtn.disabled = false;
                
                // Hide previous results
                resultSection.classList.remove('show');
                hideError();
            };
            reader.readAsDataURL(file);
        }

        /**
         * Handle prediction
         */
        async function handlePredict() {
            if (!selectedFile) {
                showError('Tidak ada gambar yang dipilih!');
                return;
            }

            // Update button state
            predictBtn.textContent = 'Memproses...';
            predictBtn.disabled = true;
            hideError();

            try {
                // Buat FormData
                const formData = new FormData();
                formData.append('image', selectedFile);

                // Kirim request ke backend
                const response = await fetch(API_URL, {
                    method: 'POST',
                    body: formData
                });

                // Parse response
                const result = await response.json();

                if (result.status === 'success') {
                    // Tampilkan hasil prediksi
                    const isRain = result.data.is_rain;
                    const confidence = result.data.confidence;
                    const probabilities = result.data.probabilities;
                    
                    showResult(isRain, confidence, probabilities);
                } else {
                    // Tampilkan error dari backend
                    showError(result.message || 'Terjadi kesalahan saat prediksi');
                }
            } catch (error) {
                console.error('Error:', error);
                
                // Handle berbagai jenis error
                if (error.name === 'TypeError' && error.message.includes('fetch')) {
                    showError('Tidak dapat terhubung ke server. Pastikan backend Flask sudah berjalan di http://localhost:5000');
                } else {
                    showError('Error: ' + error.message);
                }
            } finally {
                // Reset button state
                predictBtn.textContent = 'Prediksi Cuaca';
                predictBtn.disabled = false;
            }
        }

        /**
         * Show prediction result
         */
        function showResult(isRain, confidence, probabilities) {
            const resultIcon = document.getElementById('resultIcon');
            const resultTitle = document.getElementById('resultTitle');
            const resultDescription = document.getElementById('resultDescription');
            const confidenceText = document.getElementById('confidenceText');

            // Reset classes
            resultSection.classList.remove('rain', 'no-rain');
            
            if (isRain) {
                resultSection.classList.add('rain');
                resultIcon.textContent = '🌧️';
                resultTitle.textContent = 'HUJAN';
                resultDescription.textContent = 'Prediksi menunjukkan kemungkinan besar akan turun hujan';
            } else {
                resultSection.classList.add('no-rain');
                resultIcon.textContent = '☀️';
                resultTitle.textContent = 'TIDAK HUJAN';
                resultDescription.textContent = 'Prediksi menunjukkan cuaca cerah tanpa hujan';
            }

            // Tampilkan confidence dan probabilitas
            let confidenceHTML = `<strong>Tingkat Kepercayaan: ${confidence.toFixed(2)}%</strong>`;
            
            if (probabilities) {
                confidenceHTML += '<br><small style="font-size: 12px; margin-top: 8px; display: block; opacity: 0.9;">';
                confidenceHTML += '<strong>Detail Probabilitas:</strong><br>';
                for (let [className, prob] of Object.entries(probabilities)) {
                    const classLabel = className === 'hujan' ? 'Hujan' : 'Hujan';
                    confidenceHTML += `${classLabel}: ${prob.toFixed(2)}% | `;
                }
                confidenceHTML = confidenceHTML.slice(0, -3); // Hapus " | " terakhir
                confidenceHTML += '</small>';
            }
            
            confidenceText.innerHTML = confidenceHTML;
            resultSection.classList.add('show');
        }

        /**
         * Show error message
         */
        function showError(message) {
            errorMessage.textContent = message;
            errorMessage.classList.add('show');
            
            // Auto hide after 5 seconds
            setTimeout(() => {
                hideError();
            }, 5000);
        }

        /**
         * Hide error message
         */
        function hideError() {
            errorMessage.classList.remove('show');
        }

        // Cek koneksi backend saat halaman dimuat
        async function checkBackendConnection() {
            try {
                const response = await fetch('http://localhost:5000/api/health');
                const result = await response.json();
                
                if (result.status === 'healthy') {
                    console.log('✓ Backend connected successfully');
                }
            } catch (error) {
                console.warn('⚠ Backend not connected. Make sure Flask server is running at http://localhost:5000');
            }
        }

        // Check backend saat halaman dimuat
        checkBackendConnection();