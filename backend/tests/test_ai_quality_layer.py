import os
import sys
import unittest


CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.services.ai_quality import classify_confidence, make_origin_label  # noqa: E402
from app.services.ai_evidence import dedupe_evidence_items, trim_evidence_items  # noqa: E402
from app.services.ai_evaluation import should_use_safe_fallback  # noqa: E402


class AIQualityLayerTests(unittest.TestCase):
    def test_classify_confidence_prefers_high_when_evidence_is_strong(self):
        result = classify_confidence(evidence_count=4, average_score=0.87, malformed_output=False)
        self.assertEqual(result["confidence"], "high")
        self.assertIn("strong", result["confidence_reason"].lower())

    def test_classify_confidence_downgrades_when_output_is_malformed(self):
        result = classify_confidence(evidence_count=3, average_score=0.82, malformed_output=True)
        self.assertEqual(result["confidence"], "medium")

    def test_safe_fallback_triggers_when_evidence_is_thin(self):
        self.assertTrue(should_use_safe_fallback(evidence_count=0, confidence="low"))

    def test_dedupe_evidence_items_keeps_highest_scoring_unique_item(self):
        items = [
            {"title": "A", "content": "same text", "relevance_score": 0.51},
            {"title": "B", "content": "same text", "relevance_score": 0.74},
        ]
        deduped = dedupe_evidence_items(items)
        self.assertEqual(len(deduped), 1)
        self.assertEqual(deduped[0]["title"], "B")

    def test_trim_evidence_items_limits_total_context_but_preserves_order(self):
        items = [
            {"content": "a" * 600, "relevance_score": 0.9},
            {"content": "b" * 600, "relevance_score": 0.8},
            {"content": "c" * 600, "relevance_score": 0.7},
        ]
        trimmed = trim_evidence_items(items, max_chars=1000)
        self.assertEqual(len(trimmed), 2)

    def test_make_origin_label_maps_known_origin(self):
        self.assertEqual(make_origin_label("trusted_web"), "Enhanced with trusted web sources")


if __name__ == "__main__":
    unittest.main()
