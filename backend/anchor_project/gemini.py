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
    Generate embedding for text using Google Gemini API.
    """
    if not text.strip() or not GEMINI_API_KEY:
        return None
    try:
        response = genai.embed_content(
            model="models/embedding-001",
            content=text,
            task_type="retrieval_document"
        )
        return response['embedding']
    except Exception as e1:
        try:
            response = genai.embed_content(
                model="models/text-embedding-004",
                content=text,
                task_type="retrieval_document"
            )
            return response['embedding']
        except Exception as e2:
            print(f"Error generating embedding: {e1} / {e2}")
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
        gemini_model_names = [
            "gemini-1.5-flash",
            "models/gemini-1.5-flash",
            "gemini-1.5-pro",
            "gemini-pro"
        ]
        for m_name in gemini_model_names:
            try:
                print(f"[Fallback Layer] Attempting call to Google Gemini model: {m_name}...")
                config = genai.types.GenerationConfig(temperature=temperature)
                model = genai.GenerativeModel(
                    model_name=m_name,
                    generation_config=config,
                    system_instruction=system_instruction
                )
                response = model.generate_content(prompt)
                if response.text:
                    return response.text
            except Exception as e:
                print(f"[Fallback Layer] Gemini variant {m_name} failed: {e}. Trying next variant...")

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

def query_multimodal_vision(image_bytes, mime_type, prompt):
    """
    Generate vision/OCR response for an image using sequential fallback across 4 providers:
    1. Google Gemini SDK (trying multiple model tags: gemini-1.5-flash, models/gemini-1.5-flash, gemini-pro-vision)
    2. Groq Llama 3.2 Vision (llama-3.2-11b-vision-preview / llama-3.2-90b-vision-preview)
    3. OpenRouter Vision (google/gemini-flash-1.5 or meta-llama/llama-3.2-11b-vision-instruct)
    4. Fireworks Vision (accounts/fireworks/models/llama-v3p2-11b-instruct)
    """
    import base64
    
    # Try 1: Google Gemini SDK
    if GEMINI_API_KEY:
        # Try multiple model name variants
        gemini_model_names = [
            "gemini-1.5-flash",
            "models/gemini-1.5-flash",
            "gemini-1.5-pro",
            "gemini-pro-vision"
        ]
        for m_name in gemini_model_names:
            try:
                print(f"[Vision Fallback] Attempting Gemini SDK with model: {m_name}...")
                model = genai.GenerativeModel(m_name)
                response = model.generate_content([
                    {
                        "mime_type": mime_type,
                        "data": image_bytes
                    },
                    prompt
                ])
                transcription = ""
                try:
                    transcription = response.text.strip()
                except Exception:
                    if response.candidates and len(response.candidates) > 0:
                        candidate = response.candidates[0]
                        if candidate.content and candidate.content.parts:
                            transcription = "".join([part.text for part in candidate.content.parts if hasattr(part, 'text')]).strip()
                if transcription:
                    return transcription
            except Exception as e:
                print(f"[Vision Fallback] Gemini SDK model {m_name} failed: {e}")

    # Convert image to base64 Data URL for OpenAI-compatible endpoints
    base64_image = base64.b64encode(image_bytes).decode('utf-8')
    data_url = f"data:{mime_type};base64,{base64_image}"

    # Helper function for vision API requests
    def try_openai_vision_api(url, key, model_name, provider_name):
        if not key:
            raise ValueError(f"Key missing for {provider_name}")
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": model_name,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": data_url
                            }
                        }
                    ]
                }
            ],
            "max_tokens": 1024
        }
        res = requests.post(url, json=payload, headers=headers, timeout=20)
        if res.status_code == 200:
            return res.json()['choices'][0]['message']['content'].strip()
        else:
            print(f"[Vision Fallback] {provider_name} returned status code {res.status_code}: {res.text}")
            raise ValueError(f"API Error from {provider_name}: {res.text}")

    # Fallback configuration for other vision models
    vision_fallbacks = [
        # 1. Fireworks Vision
        {
            "name": "Fireworks Vision",
            "url": "https://api.fireworks.ai/inference/v1/chat/completions",
            "key": os.getenv('FIREWORKS_API_KEY'),
            "model": "accounts/fireworks/models/llama-v3p2-11b-vision-instruct"
        },
        # 2. OpenRouter Nvidia Nemotron VL (free)
        {
            "name": "OpenRouter Nvidia Nemotron VL Free",
            "url": "https://openrouter.ai/api/v1/chat/completions",
            "key": os.getenv('OPENROUTER_API_KEY'),
            "model": "nvidia/nemotron-nano-12b-v2-vl:free"
        },
        # 3. OpenRouter Google Gemma 4 Free
        {
            "name": "OpenRouter Google Gemma 4 Free",
            "url": "https://openrouter.ai/api/v1/chat/completions",
            "key": os.getenv('OPENROUTER_API_KEY'),
            "model": "google/gemma-4-26b-a4b-it:free"
        },
        # 4. OpenRouter Gemini 2.5 Flash Image Free
        {
            "name": "OpenRouter Gemini 2.5 Flash Image Free",
            "url": "https://openrouter.ai/api/v1/chat/completions",
            "key": os.getenv('OPENROUTER_API_KEY'),
            "model": "google/gemini-2.5-flash-image:free"
        }
    ]

    for fb in vision_fallbacks:
        try:
            print(f"[Vision Fallback] Attempting call to {fb['name']}...")
            result = try_openai_vision_api(fb['url'], fb['key'], fb['model'], fb['name'])
            if result:
                return result
        except Exception as e:
            print(f"[Vision Fallback] {fb['name']} call failed: {e}. Trying next...")

    # Return error message
    return "Error: All vision/OCR fallback layers failed to transcribe the image."
