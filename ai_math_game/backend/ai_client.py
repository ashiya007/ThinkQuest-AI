"""
Unified AI Client Wrapper
Tries Groq (fast, free) first, falls back to Gemini.
Provides a single interface so the rest of the codebase doesn't care which provider is active.
"""

import os


# --- Response wrapper to unify the API ---
class AIResponse:
    """Mimics the Gemini response object so callers don't need to change."""
    def __init__(self, text):
        self.text = text


class AIModels:
    """Namespace that mirrors client.models.generate_content(...)"""
    def __init__(self, parent):
        self._parent = parent

    def generate_content(self, model=None, contents=None):
        return self._parent._generate(contents, model)


class UnifiedAIClient:
    """
    Drop-in replacement for genai.Client.
    Usage:  client = UnifiedAIClient()
            resp = client.models.generate_content(model="...", contents="prompt")
            print(resp.text)
    """

    def __init__(self):
        self.models = AIModels(self)
        self._provider = None
        self._groq_client = None
        self._gemini_client = None
        self._groq_model = "llama-3.3-70b-versatile"  # fast & free on Groq

        # Try Groq first
        groq_key = os.getenv("GROQ_API_KEY", "").strip()
        if groq_key:
            try:
                from groq import Groq
                self._groq_client = Groq(api_key=groq_key)
                self._provider = "groq"
                print(f"[AI Client] Using Groq ({self._groq_model})")
            except Exception as e:
                print(f"[AI Client] Groq init failed: {e}")

        # Fallback to Gemini
        if not self._provider:
            gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
            if gemini_key:
                try:
                    from google import genai
                    self._gemini_client = genai.Client(api_key=gemini_key)
                    self._provider = "gemini"
                    print("[AI Client] Using Gemini")
                except Exception as e:
                    print(f"[AI Client] Gemini init failed: {e}")

        if not self._provider:
            print("[AI Client] No AI provider available - using local fallbacks")

    def _generate(self, prompt, model=None):
        """Generate text using the active provider."""
        if self._provider == "groq":
            return self._groq_generate(prompt)
        elif self._provider == "gemini":
            return self._gemini_generate(prompt, model)
        else:
            raise RuntimeError("No AI provider configured")

    def _groq_generate(self, prompt):
        """Call Groq API (Llama 3.3 70B)."""
        response = self._groq_client.chat.completions.create(
            model=self._groq_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=1024,
        )
        return AIResponse(response.choices[0].message.content)

    def _gemini_generate(self, prompt, model=None):
        """Call Gemini API."""
        model = model or "gemini-3-flash-preview"
        response = self._gemini_client.models.generate_content(
            model=model,
            contents=prompt
        )
        return AIResponse(response.text)

    @property
    def provider_name(self):
        return self._provider or "none"
