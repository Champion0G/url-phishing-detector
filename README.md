# PhishShield AI - URL Phishing Detection

PhishShield AI is a machine learning-based tool designed to identify and flag phishing URLs before users can interact with them. It combines a high-performance **LightGBM** classifier with a modern, glassmorphic web dashboard for real-time URL risk assessment.

![PhishShield Preview](web_interface/preview.png) *(Placeholder if you add a screenshot)*

## 🚀 Features
- **AI-Powered Detection**: Uses a Gradient Boosting Decision Tree (LightGBM) model trained on over 500,000 URLs.
- **Advanced Vectorization**: Implements char-level n-gram TF-IDF (3-5 n-grams) for robust structural analysis of URLs.
- **Premium Web Dashboard**: A modern, responsive interface built with FastAPI, providing real-time safety scores and threat indicators.
- **Instant Feedback**: Visual progress bars and badges for clear risk communication.

## 🛠️ Technology Stack
- **Machine Learning**: Python, Scikit-Learn, LightGBM, Pandas, Numpy, Scipy.
- **Backend API**: FastAPI, Uvicorn.
- **Frontend**: HTML5, CSS3 (Glassmorphism), JavaScript (Vanilla).

## 📦 Project Structure
```text
.
├── phishing_detection_model.py  # Model training & testing script
├── phishlang_model.pkl          # Trained LightGBM model
├── tfidf.pkl                    # TF-IDF Vectorizer
├── web_interface/               # Web application directory
│   ├── app.py                   # FastAPI backend
│   ├── index.html               # Main dashboard UI
│   └── static/
│       └── style.css            # Premium glassmorphic styles
└── .gitignore                   # Version control exclusions
```

## ⚙️ Installation & Usage

1. **Clone the repository**:
   ```bash
   git clone [YOUR_REMOTE_URL]
   cd phishing-detection
   ```

2. **Install dependencies**:
   ```bash
   pip install fastapi uvicorn lightgbm scikit-learn pandas numpy scipy
   ```

3. **Run the Web Dashboard**:
   ```bash
   cd web_interface
   python app.py
   ```

4. **Access the UI**:
   Open your browser and navigate to `http://localhost:8000`.

## 🧠 How it Works
The model analyzes the character distribution and structural features of the URL (including length and specific character patterns). It achieves high accuracy by recognizing patterns common in phishing domains, such as look-alike characters and suspicious subdomains.

---
*Developed with a focus on web security and user experience.*
