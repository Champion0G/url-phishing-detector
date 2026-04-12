import os
import pickle
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel
from scipy.sparse import hstack

app = FastAPI(title="Phishing Detection API")

# Load models
MODEL_PATH = "phishlang_model.pkl"
TFIDF_PATH = "tfidf.pkl"

if not os.path.exists(MODEL_PATH) or not os.path.exists(TFIDF_PATH):
    raise RuntimeError("Model or TFIDF files not found in web_interface directory.")

with open(MODEL_PATH, "rb") as f:
    lgbm_model = pickle.load(f)

with open(TFIDF_PATH, "rb") as f:
    tfidf = pickle.load(f)

class URLRequest(BaseModel):
    url: str

@app.post("/predict")
async def predict(request: URLRequest):
    try:
        url = request.url.lower().strip()
        
        # Preprocessing matching training script
        vec = tfidf.transform([url])
        url_len = [[len(url)]]
        
        # Combine TF-IDF features with URL length
        final_vec = hstack([vec, url_len])
        
        # Get probability from LightGBM
        # prob = lgbm_model.predict_proba(final_vec)[0][1]
        # Wait, lgbm_model is LightGBM, it should have predict_proba
        prob = lgbm_model.predict_proba(final_vec)[0][1]
        
        # Define status based on threshold (0.9 as in the original script)
        threshold = 0.9
        is_phishing = bool(prob >= threshold)
        status = "PHISHING" if is_phishing else "LEGIT"
        
        return {
            "url": url,
            "status": status,
            "probability": float(prob),
            "is_phishing": is_phishing
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Serve index.html
@app.get("/", response_class=HTMLResponse)
async def read_index():
    return FileResponse("index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
