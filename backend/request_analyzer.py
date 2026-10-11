"""Transparent keyword-based request classification (swap for an LLM classifier later)."""
import re
from dataclasses import dataclass, field

KEYWORDS = {
    "coding": ["code", "function", "c++", "cpp", "python", "java", "javascript", "typescript", "bug", "debug",
               "compile", "algorithm", "sql", "regex", "class ", "pointer", "api", "script", "stack trace",
               "exception", "recursion", "```", "def ", "#include", "react", "html", "css", "rust", "golang"],
    "summarization": ["summarize", "summarise", "summary", "tl;dr", "tldr", "shorten", "key points",
                      "condense", "brief overview", "recap"],
    "reasoning": ["prove", "why does", "why is", "analyze", "analyse", "compare", "trade-off", "tradeoff",
                  "step by step", "derive", "evaluate", "design a", "optimize", "strategy", "calculate",
                  "pros and cons", "implications", "reason about", "puzzle", "logic"],
}
PRIORITY = ["coding", "summarization", "reasoning", "general"]
MIN_CAPABILITY = {"general": 1, "summarization": 2, "coding": 3, "reasoning": 4}


@dataclass
class Analysis:
    category: str
    complexity: int
    min_capability: int
    input_tokens: int
    est_output_tokens: int
    signals: list = field(default_factory=list)

    def to_dict(self):
        return self.__dict__.copy()


def estimate_tokens(text: str) -> int:
    return max(1, round(len(text) / 4))


def _has(text: str, kw: str) -> bool:
    """Whole-word match so 'capital' does not trigger 'api'."""
    return re.search(r"(?<!\w)" + re.escape(kw.strip()) + r"(?!\w)", text) is not None


def analyze(prompt: str) -> Analysis:
    text = prompt.lower()
    scores = {c: sum(1 for k in kws if _has(text, k)) for c, kws in KEYWORDS.items()}
    best = max(scores.values())
    category = "general"
    if best > 0:
        category = next(c for c in PRIORITY if scores.get(c) == best)
    signals = [f"{c}: {n} keyword match(es)" for c, n in scores.items() if n]

    words = len(re.findall(r"\w+", prompt))
    complexity = 1
    if words > 40:
        complexity += 1
    if words > 150:
        complexity += 1
    if category in ("coding", "reasoning"):
        complexity += 1
    if scores["reasoning"] >= 2:
        complexity += 1
    complexity = min(complexity, 5)

    in_tok = estimate_tokens(prompt)
    return Analysis(category, complexity, MIN_CAPABILITY[category], in_tok,
                    300 + 100 * complexity, signals or ["no specialised keywords: default route"])
