import os
import requests
import numpy as np
import google.generativeai as genai
from django.db import models
from dotenv import load_dotenv

# Load env variables
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, '.env'))

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', 'AIzaSyC7yjf14lEcLF1IS2AddLYnLL5HMj4XkpU')
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

def get_embedding(text: str):
    """
    Generate embedding for text using Google Gemini API text-embedding-004 model.
    """
    if not text.strip() or not GEMINI_API_KEY:
        return None
    try:
        response = genai.embed_content(
            model="models/text-embedding-004",
            content=text,
            task_type="retrieval_document"
        )
        return response['embedding']
    except Exception as e:
        print(f"Error generating embedding: {e}")
        return None

def cosine_similarity(v1, v2):
    """
    Compute cosine similarity between two lists/arrays of floats.
    """
    if v1 is None or v2 is None:
        return 0.0
    arr1 = np.array(v1)
    arr2 = np.array(v2)
    dot_prod = np.dot(arr1, arr2)
    norm1 = np.linalg.norm(arr1)
    norm2 = np.linalg.norm(arr2)
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return float(dot_prod / (norm1 * norm2))

def query_gemini(prompt: str, system_instruction: str = None, temperature: float = 0.7, enable_search: bool = False):
    """
    Query the active AI LLM model with automatic sequential fallback across 7 providers:
    1. Gemini API (Google SDK)
    2. Groq API (using Grok Key from env 'gsk_')
    3. OpenRouter API
    4. Cerebras API
    5. Mistral API
    6. SambaNova API
    7. Fireworks API
    """
    # Try 1: Gemini (Google SDK)
    if GEMINI_API_KEY:
        try:
            print(f"[Fallback Layer] Attempting call to Google Gemini...")
            config = genai.types.GenerationConfig(temperature=temperature)
            model = genai.GenerativeModel(
                model_name="gemini-1.5-flash",
                generation_config=config,
                system_instruction=system_instruction
            )
            response = model.generate_content(prompt)
            if response.text:
                return response.text
        except Exception as e:
            print(f"[Fallback Layer] Gemini call failed: {e}. Trying next provider...")

    # Helper function for OpenAI compatible endpoints
    def try_openai_api(url, key, model_name, provider_name):
        if not key:
            print(f"[Fallback Layer] {provider_name} key not found in env.")
            raise ValueError(f"Key missing for {provider_name}")
        
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json"
        }
        
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})
        
        payload = {
            "model": model_name,
            "messages": messages,
            "temperature": temperature
        }
        
        res = requests.post(url, json=payload, headers=headers, timeout=15)
        if res.status_code == 200:
            return res.json()['choices'][0]['message']['content']
        else:
            print(f"[Fallback Layer] {provider_name} returned status code {res.status_code}: {res.text}")
            raise ValueError(f"API Error from {provider_name}")

    # Fallback Chain Configuration
    fallbacks = [
        # 2. Groq (Using GROK key which has 'gsk_' Groq prefix)
        {
            "name": "Groq (Grok Key)",
            "url": "https://api.groq.com/openai/v1/chat/completions",
            "key": os.getenv('GROK_API_KEY'),
            "model": "llama-3.1-8b-instant"
        },
        # 3. OpenRouter
        {
            "name": "OpenRouter",
            "url": "https://openrouter.ai/api/v1/chat/completions",
            "key": os.getenv('OPENROUTER_API_KEY'),
            "model": "meta-llama/llama-3-8b-instruct"
        },
        # 4. Cerebras
        {
            "name": "Cerebras",
            "url": "https://api.cerebras.ai/v1/chat/completions",
            "key": os.getenv('CEREBRAS_API_KEY'),
            "model": "llama-3.1-8b"
        },
        # 5. Mistral
        {
            "name": "Mistral",
            "url": "https://api.mistral.ai/v1/chat/completions",
            "key": os.getenv('MISTRAL_API_KEY'),
            "model": "open-mixtral-8x7b"
        },
        # 6. SambaNova
        {
            "name": "SambaNova",
            "url": "https://api.sambanova.ai/v1/chat/completions",
            "key": os.getenv('SAMBANOVA_API_KEY'),
            "model": "Meta-Llama-3-8B-Instruct"
        },
        # 7. Fireworks
        {
            "name": "Fireworks",
            "url": "https://api.fireworks.ai/inference/v1/chat/completions",
            "key": os.getenv('FIREWORKS_API_KEY'),
            "model": "accounts/fireworks/models/llama-v3-8b-instruct"
        }
    ]

    for fb in fallbacks:
        try:
            print(f"[Fallback Layer] Attempting call to {fb['name']}...")
            result = try_openai_api(fb['url'], fb['key'], fb['model'], fb['name'])
            if result:
                return result
        except Exception as e:
            print(f"[Fallback Layer] {fb['name']} call failed: {e}. Trying next...")

    return "Error: All 7 LLM Providers in the Fallback Layer failed to complete the request."
