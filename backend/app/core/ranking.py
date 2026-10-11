from typing import List, Literal, Tuple, Dict
from ..schemas.model import ModelConfig
from ..schemas.request import ModelEvaluation, TokenMetrics

PreferenceType = Literal["lowest_cost", "lowest_latency", "highest_capability"]

def rank_valid_models(
    valid_models: List[ModelConfig],
    evaluations: List[ModelEvaluation],
    preference: PreferenceType,
    token_metrics: TokenMetrics
) -> Tuple[List[ModelConfig], Dict[str, Tuple[int, str]]]:
    """
    Ranks surviving valid models deterministically.
    Returns:
      - sorted valid models
      - dict mapping model_id -> (rank_number, rationale_string)
    """
    if not valid_models:
        return [], {}

    # Map for easy lookup of evaluation metrics
    eval_map = {e.model_id: e for e in evaluations}

    def sort_key(m: ModelConfig):
        ev = eval_map[m.id]
        if preference == "lowest_cost":
            # Primary: cost ascending; Secondary: latency ascending; Tie-break: id lexicographical
            return (ev.estimated_cost, ev.expected_latency_ms, m.id)
        elif preference == "lowest_latency":
            # Primary: latency ascending; Secondary: cost ascending; Tie-break: id lexicographical
            return (ev.expected_latency_ms, ev.estimated_cost, m.id)
        elif preference == "highest_capability":
            # Primary: capability descending (-cap); Secondary: cost ascending; Tie-break: id lexicographical
            return (-m.capability, ev.estimated_cost, ev.expected_latency_ms, m.id)
        else:
            return (ev.estimated_cost, ev.expected_latency_ms, m.id)

    sorted_models = sorted(valid_models, key=sort_key)
    
    ranking_details: Dict[str, Tuple[int, str]] = {}
    for idx, m in enumerate(sorted_models, start=1):
        ev = eval_map[m.id]
        if idx == 1:
            if preference == "lowest_cost":
                rationale = f"Ranked #1 (Winner): Lowest estimated cost (${ev.estimated_cost:.6f}) with baseline latency of {ev.expected_latency_ms:.0f}ms."
            elif preference == "lowest_latency":
                rationale = f"Ranked #1 (Winner): Fastest response time ({ev.expected_latency_ms:.0f}ms) at ${ev.estimated_cost:.6f} estimated cost."
            else: # highest_capability
                rationale = f"Ranked #1 (Winner): Highest capability score ({m.capability}/5) at ${ev.estimated_cost:.6f} estimated cost."
        else:
            if preference == "lowest_cost":
                rationale = f"Ranked #{idx}: Alternative candidate with cost ${ev.estimated_cost:.6f} (higher than Rank #1)."
            elif preference == "lowest_latency":
                rationale = f"Ranked #{idx}: Alternative candidate with latency {ev.expected_latency_ms:.0f}ms (slower than Rank #1)."
            else:
                rationale = f"Ranked #{idx}: Alternative candidate with capability {m.capability}/5 or higher cost."
                
        ranking_details[m.id] = (idx, rationale)

    # Update evaluations in-place with rank and rationale
    for ev in evaluations:
        if ev.model_id in ranking_details:
            rank_num, rationale_str = ranking_details[ev.model_id]
            ev.rank = rank_num
            ev.ranking_rationale = rationale_str

    return sorted_models, ranking_details
