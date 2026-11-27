"""Evaluation layer — the golden-set runner for the section-9 checks.

``ml.eval.run_eval`` loads ``ml/eval/golden/cases.jsonl``, applies each
case's declared checks to model outputs (when supplied), and reports
pass / fail / skipped / pending without ever inventing a score.

Run it as a script: ``python3 ml/eval/run_eval.py --help``.
"""
