import re
import math
from typing import Dict, List, Any

# Keyword taxonomy calibrated for AI task complexity
LEVEL_1_KEYWORDS = {
    "define", "what is", "who is", "when did", "translate", "spanish", "french", "german",
    "synonym", "antonym", "extract", "classify", "spellcheck", "capital of", "greeting",
    "hello", "hi", "list 5", "short list", "quick summary"
}

LEVEL_2_KEYWORDS = {
    "explain", "how does", "summarize", "convert", "rephrase", "rewrite", "difference between",
    "overview", "compare briefly", "draft email", "format as", "bullet points", "outline",
    "pros and cons", "simple guide"
}

LEVEL_3_KEYWORDS = {
    "implement", "write a program", "write a python", "function", "write code", "sql query",
    "database schema", "json schema", "algorithm", "regular expression", "regex", "unit test",
    "data analysis", "pandas", "rest api", "endpoint", "scrape", "parse html", "structured output",
    "typescript", "react component", "javascript function"
}

LEVEL_4_KEYWORDS = {
    "debug", "fix bug", "troubleshoot", "refactor", "race condition", "memory leak",
    "multithreading", "concurrency", "distributed system", "contract", "legal", "liability",
    "indemnity", "clause", "compliance", "mathematical proof", "calculus", "differential equation",
    "step by step reasoning", "cryptographic", "security vulnerability", "penetration test",
    "audit code", "performance bottleneck", "profiling", "asymptotic analysis"
}

LEVEL_5_KEYWORDS = {
    "formal verification", "zero-knowledge proof", "distributed consensus", "raft protocol",
    "paxos", "np-complete", "kernel exploit", "reverse engineering", "deep mathematical proof",
    "cross-domain synthesis", "comprehensive enterprise migration", "byzantine fault tolerance",
    "quantum computing", "homomorphic encryption"
}

CODE_PATTERNS = [
    r"```[a-zA-Z]*",               # Code fences
    r"\bdef\s+[a-zA-Z_]\w*\(",      # Python function definition
    r"\bclass\s+[a-zA-Z_]\w*",      # Class definition
    r"\bimport\s+[a-zA-Z_]",        # Import statements
    r"\bfunction\s+[a-zA-Z_]",      # JS function
    r"\bconst\s+[a-zA-Z_]\w*\s*=",  # JS const
    r"SELECT\s+.*\s+FROM\s+",       # SQL
    r"[{};]{3,}",                   # Syntax brackets
]

MATH_PATTERNS = [
    r"\\[a-zA-Z]+",                # LaTeX commands like \frac, \sum, \int
    r"\b[a-zA-Z]\s*=\s*[\d\w\+\-\*\/\^\(\)]+", # Equations
    r"O\(n[\s\^\d\w]*\)",           # Big O notation
    r"\b\d+\s*[\+\-\*\/\^]\s*\d+",  # Arithmetic expressions
    r"\b(integral|derivative|matrix|eigenvalue|eigenvector|vector space)\b"
]

def count_tokens(prompt: str) -> int:
    """
    Offline approximate token estimator.
    Rule: max(1, ceil(len(prompt) / 4)).
    Documented in README: Character-based estimation is approximate (~4 chars per token).
    """
    if not prompt:
        return 1
    return max(1, math.ceil(len(prompt) / 4))

def _match_keyword(kw: str, text: str) -> bool:
    # If kw is single word or short, match word boundaries
    pattern = r"\b" + re.escape(kw) + r"\b"
    return bool(re.search(pattern, text, re.IGNORECASE))

def extract_signals(prompt: str) -> Dict[str, Any]:
    """
    Extracts structural, lexical, and semantic signals from prompt text.
    """
    prompt_lower = prompt.lower()
    tokens = count_tokens(prompt)
    
    signals_detected: List[str] = []
    
    # Check keywords in each level
    level_matches = {1: [], 2: [], 3: [], 4: [], 5: []}
    
    for kw in LEVEL_1_KEYWORDS:
        if _match_keyword(kw, prompt_lower):
            level_matches[1].append(kw)
    for kw in LEVEL_2_KEYWORDS:
        if _match_keyword(kw, prompt_lower):
            level_matches[2].append(kw)
    for kw in LEVEL_3_KEYWORDS:
        if _match_keyword(kw, prompt_lower):
            level_matches[3].append(kw)
    for kw in LEVEL_4_KEYWORDS:
        if _match_keyword(kw, prompt_lower):
            level_matches[4].append(kw)
    for kw in LEVEL_5_KEYWORDS:
        if _match_keyword(kw, prompt_lower):
            level_matches[5].append(kw)
            
    for lvl, kw_list in level_matches.items():
        if kw_list:
            signals_detected.append(f"Level {lvl} keywords matched: {', '.join(kw_list[:4])}")

    # Check for code presence
    has_code = any(re.search(pat, prompt, re.IGNORECASE) for pat in CODE_PATTERNS)
    if has_code:
        signals_detected.append("Source code syntax or code blocks detected")
        
    # Check for math / equations
    has_math = any(re.search(pat, prompt, re.IGNORECASE) for pat in MATH_PATTERNS)
    if has_math:
        signals_detected.append("Mathematical notation or equations detected")

    # Check multi-step questions
    question_count = prompt.count("?")
    multi_step = bool(re.search(r"\b(step\s*1|1\.\s+|firstly|secondly)\b", prompt_lower))
    if question_count > 1 or multi_step:
        signals_detected.append(f"Multi-step / composite request ({question_count} questions)")

    # Prompt length signal
    if tokens > 500:
        signals_detected.append(f"Large prompt context ({tokens} tokens)")
    elif tokens > 150:
        signals_detected.append(f"Medium prompt context ({tokens} tokens)")
    else:
        signals_detected.append(f"Concise prompt ({tokens} tokens)")

    return {
        "tokens": tokens,
        "level_matches": level_matches,
        "has_code": has_code,
        "has_math": has_math,
        "question_count": question_count,
        "multi_step": multi_step,
        "signals_detected": signals_detected
    }
