# ai/base.py  (SoT: Layer Rules — exact contract)
class AIClient:
    def complete(self, prompt: str) -> str:
        raise NotImplementedError
