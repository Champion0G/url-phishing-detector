#!/usr/bin/env python
# coding: utf-8

# In[1]:


import pandas as pd
import numpy as np
import re
import joblib

from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import accuracy_score, classification_report
from scipy.sparse import hstack

from lightgbm import LGBMClassifier


# In[2]:


# PATH 
df = pd.read_csv(r"C:\Users\ayush\Ai-phishing-website-detection\Dataset\archive\phishing_site_urls.csv")

# Check columns
print(df.columns)


# In[3]:


# Make sure label is numeric
df["Label"] = df["Label"].map({
    "good": 0,
    "bad": 1
})

print(df["Label"].value_counts())
print(df["Label"].dtype)


# In[4]:


# Add URL length feature
df["url_length"] = df["URL"].astype(str).apply(len)
print(df[["URL", "url_length"]].head())


# In[5]:


print(df.head())
print(df.isnull().sum())


# In[6]:


#url pre-processing 
df["URL"] = df["URL"].astype(str).str.lower().str.strip()


# In[7]:


X = df["URL"]
y = df["Label"]
#Train-test split
from sklearn.model_selection import train_test_split

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)


# In[8]:


#TD-IDF Vectorization
from sklearn.feature_extraction.text import TfidfVectorizer

tfidf = TfidfVectorizer(
    analyzer="char",
    ngram_range=(3, 5),
    max_features=50000
)

X_train_tfidf = tfidf.fit_transform(X_train)
X_test_tfidf = tfidf.transform(X_test)


# In[9]:


from scipy.sparse import hstack

def get_lexical_features(url_series):
    features = []
    for url in url_series:
        u_len = len(url)
        d_count = sum(c.isdigit() for c in url)
        s_count = len(re.findall(r'[^a-zA-Z0-9]', url))
        features.append([u_len, d_count, s_count])
    return np.array(features)

X_train_lexical = get_lexical_features(X_train)
X_test_lexical = get_lexical_features(X_test)

# Combine TF-IDF features with all 3 lexical features
X_train_final = hstack([X_train_tfidf, X_train_lexical])
X_test_final = hstack([X_test_tfidf, X_test_lexical])


# In[10]:


from lightgbm import LGBMClassifier

lgbm_model = LGBMClassifier(
    objective="binary",
    boosting_type="gbdt",
    n_estimators=300,
    learning_rate=0.05,
    num_leaves=31,
    random_state=42
)

lgbm_model.fit(X_train_final, y_train)



# In[11]:


from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

y_pred = lgbm_model.predict(X_test_final)

print("Accuracy:", accuracy_score(y_test, y_pred))
print("\nClassification Report:\n", classification_report(y_test, y_pred))
print("\nConfusion Matrix:\n", confusion_matrix(y_test, y_pred))


# In[12]:


import pickle

with open("phishlang_model.pkl", "wb") as f:
    pickle.dump(lgbm_model, f)

with open("tfidf.pkl", "wb") as f:
    pickle.dump(tfidf, f)

print(" Model and TF-IDF saved successfully")


# In[15]:


from scipy.sparse import hstack

def predict_url(url, threshold=0.9):
    url = url.lower().strip()

    vec = tfidf.transform([url])
    u_len = len(url)
    d_count = sum(c.isdigit() for c in url)
    s_count = len(re.findall(r'[^a-zA-Z0-9]', url))
    lexical = [[u_len, d_count, s_count]]
    final_vec = hstack([vec, lexical])

    prob = lgbm_model.predict_proba(final_vec)[0][1]

    if prob >= threshold:
        return f"PHISHING ({prob:.2f})"
    else:
        return f"LEGIT ({prob:.2f})"


print(predict_url("http://secure-paypal-login.verify-user.com"))
print(predict_url("https://www.google.com"))
print(predict_url("https://www.facebook.com"))
print(predict_url("https://www.tryhackme.com"))


