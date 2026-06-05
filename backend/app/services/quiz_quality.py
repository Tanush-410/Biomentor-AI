"""Educator-facing quiz quality analysis before publication."""
from __future__ import annotations

from collections import Counter
from typing import Dict, List

from app.agents.bloom_classifier import BLOOM_TAXONOMY
from app.services.ai_quality import classify_confidence


def build_quiz_quality_review(payload: Dict) -> Dict:
    """Review manual or generated quiz settings and return actionable guidance."""
    quiz_mode = (payload.get("quiz_mode") or "generated").strip().lower()
    issues: List[Dict] = []
    suggestions: List[Dict] = []
    bloom_distribution: List[Dict] = []
    question_health: List[Dict] = []

    if quiz_mode == "manual":
        manual_questions = payload.get("manual_questions") or []
        bloom_distribution = _build_bloom_distribution(
            [int(question.get("bloom_level") or 3) for question in manual_questions]
        )
        issues.extend(_review_manual_questions(manual_questions))
        suggestions.extend(_manual_quiz_suggestions(manual_questions, bloom_distribution))
        question_health = _build_question_health(manual_questions)
    else:
        bloom_level = payload.get("bloom_level")
        bloom_distribution = _build_bloom_distribution(
            [int(bloom_level)] * int(payload.get("num_questions") or 0)
            if bloom_level
            else [1, 2, 3, 4]
        )
        issues.extend(_review_generated_quiz_config(payload))
        suggestions.extend(_generated_quiz_suggestions(payload))

    issues.extend(_review_common_quiz_settings(payload))
    score = _score_quality(issues)
    readiness = "ready" if score >= 82 else "revise"
    evidence_count = len((payload.get("manual_questions") or [])) or int(payload.get("num_questions") or 0)
    has_primary_sources = bool(payload.get("document_id")) or bool(payload.get("manual_questions"))
    confidence_score = min(0.96, score / 100)
    if quiz_mode == "manual" and len(payload.get("manual_questions") or []) < 2:
        confidence_score = min(confidence_score, 0.28)
    confidence_meta = classify_confidence(
        evidence_count=evidence_count,
        average_relevance=confidence_score,
        has_primary_sources=has_primary_sources,
    )
    assessment_focus = _infer_assessment_focus(payload, bloom_distribution)
    release_risk = _infer_release_risk(issues)
    fix_first = _build_fix_first_actions(issues, question_health)
    remediation_plan = _build_remediation_plan(payload, issues, bloom_distribution, question_health)

    summary = (
        "This quiz is ready to publish with only small polish changes."
        if readiness == "ready"
        else "This quiz should be tightened before students see it."
    )

    return {
        "quality_score": score,
        "readiness": readiness,
        "summary": summary,
        "assessment_focus": assessment_focus,
        "release_risk": release_risk,
        "issues": issues,
        "suggestions": suggestions[:5],
        "bloom_distribution": bloom_distribution,
        "question_health": question_health[:6],
        "fix_first": fix_first[:3],
        "remediation_plan": remediation_plan[:4],
        "confidence": confidence_meta["confidence"],
        "confidence_reason": confidence_meta["confidence_reason"],
    }


def _review_manual_questions(questions: List[Dict]) -> List[Dict]:
    issues: List[Dict] = []
    correct_distribution = Counter()

    for index, question in enumerate(questions, start=1):
        prompt = (question.get("prompt") or "").strip()
        options = question.get("options") or []
        explanation = (question.get("explanation") or "").strip()
        correct_option = (question.get("correct_option_id") or "").strip().upper()
        correct_distribution.update([correct_option])

        if len(prompt.split()) < 5:
            issues.append(
                _issue(
                    "medium",
                    f"Question {index} prompt is too short",
                    "Students may guess the intent because the stem is not specific enough.",
                )
            )

        normalized_options = [((option.get("text") or "").strip().lower()) for option in options]
        if len(set(normalized_options)) != len(normalized_options):
            issues.append(
                _issue(
                    "high",
                    f"Question {index} has duplicate-looking options",
                    "At least two answer options say almost the same thing, which weakens the distractors.",
                )
            )

        if any(len(option.split()) < 2 for option in normalized_options):
            issues.append(
                _issue(
                    "medium",
                    f"Question {index} has very weak distractors",
                    "One or more options are too short to feel like believable alternatives.",
                )
            )

        if "all of the above" in prompt.lower() or "none of the above" in prompt.lower():
            issues.append(
                _issue(
                    "medium",
                    f"Question {index} uses a discouraged pattern",
                    "Avoid 'all of the above' or 'none of the above' because they reduce question quality.",
                )
            )

        if not explanation:
            issues.append(
                _issue(
                    "low",
                    f"Question {index} has no explanation",
                    "Add a short explanation so review and remediation feel stronger after grading.",
                )
            )

    if questions:
        dominant_answer, count = correct_distribution.most_common(1)[0]
        if count / len(questions) >= 0.6:
            issues.append(
                _issue(
                    "medium",
                    "Answer key pattern is too repetitive",
                    f"Option {dominant_answer} is correct too often, which makes the quiz easier to game.",
                )
            )

    return issues


def _review_generated_quiz_config(payload: Dict) -> List[Dict]:
    issues: List[Dict] = []
    document_id = payload.get("document_id")
    num_questions = int(payload.get("num_questions") or 0)
    duration = int(payload.get("duration_minutes") or 0)
    bloom_level = payload.get("bloom_level")

    if not document_id:
        issues.append(
            _issue(
                "high",
                "Generated quiz has no linked material",
                "The generator needs a study source to create grounded questions.",
            )
        )

    if num_questions < 3:
        issues.append(
            _issue(
                "medium",
                "Quiz is very short",
                "With fewer than 3 questions, it may not measure mastery reliably.",
            )
        )

    if duration and num_questions and (duration / max(num_questions, 1)) < 1:
        issues.append(
            _issue(
                "medium",
                "Time window may be too tight",
                "Students have less than a minute per question, which can distort performance.",
            )
        )

    if bloom_level is None:
        issues.append(
            _issue(
                "low",
                "Bloom targeting is mixed",
                "Mixed-level quizzes are fine, but you may want one dominant level if this is a checkpoint.",
            )
        )

    return issues


def _review_common_quiz_settings(payload: Dict) -> List[Dict]:
    issues: List[Dict] = []
    if not payload.get("proctoring_enabled", True):
        issues.append(
            _issue(
                "low",
                "Proctoring is turned off",
                "That is fine for practice, but less suitable for a high-stakes classroom assessment.",
            )
        )

    if not payload.get("available_until"):
        issues.append(
            _issue(
                "low",
                "No closing time is set",
                "Adding an end window keeps classroom pacing and quiz supervision clearer.",
            )
        )

    return issues


def _manual_quiz_suggestions(questions: List[Dict], bloom_distribution: List[Dict]) -> List[Dict]:
    suggestions: List[Dict] = []
    if questions and len(bloom_distribution) == 1:
        suggestions.append(
            _suggestion(
                "Broaden Bloom coverage",
                "Add at least one question at a different Bloom level so the quiz measures more than one thinking skill.",
            )
        )
    if any(not (question.get("explanation") or "").strip() for question in questions):
        suggestions.append(
            _suggestion(
                "Add explanations to weak spots",
                "Short explanations make autograding feedback and remediation much more useful.",
            )
        )
    suggestions.append(
        _suggestion(
            "Check distractor realism",
            "Aim for wrong answers that are plausible misunderstandings, not obviously incorrect throwaways.",
        )
    )
    return suggestions


def _generated_quiz_suggestions(payload: Dict) -> List[Dict]:
    suggestions: List[Dict] = []
    if payload.get("bloom_level") is None:
        suggestions.append(
            _suggestion(
                "Pick a target Bloom level for checkpoints",
                "Choose one dominant level when you want the quiz to diagnose a specific skill gap.",
            )
        )
    suggestions.append(
        _suggestion(
            "Review the first generated set before release",
            "Use the first draft as a quality pass, then regenerate if the distribution feels too narrow.",
        )
    )
    return suggestions


def _build_bloom_distribution(levels: List[int]) -> List[Dict]:
    if not levels:
        return []
    total = len(levels)
    counts = Counter(levels)
    distribution = []
    for level in sorted(counts):
        distribution.append(
            {
                "level": level,
                "label": BLOOM_TAXONOMY.get(level, {}).get("name", f"Level {level}"),
                "count": counts[level],
                "percentage": round((counts[level] / total) * 100),
            }
        )
    return distribution


def _infer_assessment_focus(payload: Dict, bloom_distribution: List[Dict]) -> str:
    quiz_mode = (payload.get("quiz_mode") or "generated").strip().lower()
    duration = int(payload.get("duration_minutes") or 0)
    question_count = len(payload.get("manual_questions") or []) or int(payload.get("num_questions") or 0)
    proctored = bool(payload.get("proctoring_enabled", True))
    dominant_bloom = bloom_distribution[-1]["label"] if bloom_distribution else "Mixed"

    if proctored and question_count >= 8:
        return f"Controlled mastery check with {dominant_bloom.lower()} emphasis."
    if quiz_mode == "manual" and question_count <= 5 and duration <= 20:
        return "Instructor-authored checkpoint for targeted classroom diagnosis."
    if question_count <= 3:
        return "Quick understanding check that should be paired with follow-up review."
    return f"Balanced class assessment focused on {dominant_bloom.lower()} thinking."


def _infer_release_risk(issues: List[Dict]) -> str:
    severities = Counter(issue["severity"] for issue in issues)
    if severities.get("high", 0) >= 2:
        return "high"
    if severities.get("high", 0) or severities.get("medium", 0) >= 3:
        return "medium"
    return "low"


def _build_question_health(questions: List[Dict]) -> List[Dict]:
    health: List[Dict] = []
    for index, question in enumerate(questions, start=1):
        options = [((option.get("text") or "").strip().lower()) for option in question.get("options") or []]
        explanation = (question.get("explanation") or "").strip()
        prompt = (question.get("prompt") or "").strip()
        duplicate_options = len(options) != len(set(options))
        short_options = any(len(option.split()) < 2 for option in options if option)
        short_prompt = len(prompt.split()) < 5
        if duplicate_options:
            health.append(
                {
                    "question_number": index,
                    "status": "revise",
                    "title": f"Question {index} needs stronger distractors",
                    "detail": "At least two options overlap too closely, so students can eliminate choices too easily.",
                }
            )
            continue
        if short_prompt or short_options or not explanation:
            detail_parts = []
            if short_prompt:
                detail_parts.append("tighten the stem")
            if short_options:
                detail_parts.append("make distractors more believable")
            if not explanation:
                detail_parts.append("add an explanation for review feedback")
            health.append(
                {
                    "question_number": index,
                    "status": "watch",
                    "title": f"Question {index} is usable but not strong yet",
                    "detail": " and ".join(detail_parts).capitalize() + ".",
                }
            )
            continue
        health.append(
            {
                "question_number": index,
                "status": "strong",
                "title": f"Question {index} is release-ready",
                "detail": "The stem, answer options, and explanation are specific enough for a solid classroom checkpoint.",
            }
        )
    return health


def _build_fix_first_actions(issues: List[Dict], question_health: List[Dict]) -> List[Dict]:
    actions: List[Dict] = []
    high_issue = next((issue for issue in issues if issue["severity"] == "high"), None)
    if high_issue:
        actions.append(
            {
                "title": high_issue["title"],
                "detail": high_issue["detail"],
                "impact": "This is the biggest risk to fair scoring if you publish now.",
            }
        )
    watch_question = next((item for item in question_health if item["status"] in {"revise", "watch"}), None)
    if watch_question:
        actions.append(
            {
                "title": watch_question["title"],
                "detail": watch_question["detail"],
                "impact": "Fixing this question first will improve both quiz reliability and post-quiz remediation.",
            }
        )
    if any(issue["title"] == "No closing time is set" for issue in issues):
        actions.append(
            {
                "title": "Set a closing window",
                "detail": "Add an end time so the quiz behaves like a supervised classroom checkpoint instead of an open practice item.",
                "impact": "This keeps pacing, proctoring, and student expectations aligned.",
            }
        )
    if not actions:
        actions.append(
            {
                "title": "Proceed with a release check",
                "detail": "The draft looks healthy. Run one last human read-through for language clarity before publishing.",
                "impact": "This preserves the current quiz quality without adding unnecessary delay.",
            }
        )
    return actions


def _build_remediation_plan(
    payload: Dict,
    issues: List[Dict],
    bloom_distribution: List[Dict],
    question_health: List[Dict],
) -> List[Dict]:
    steps: List[Dict] = []
    if any(item["status"] == "revise" for item in question_health):
        steps.append(
            {
                "phase": "Before release",
                "action": "Repair the weakest question first, then rerun the AI review so the answer-key and distractor signals settle.",
            }
        )
    if len(bloom_distribution) == 1:
        steps.append(
            {
                "phase": "After grading",
                "action": "Pair results with one short follow-up item at a different Bloom level so you can tell recall gaps from reasoning gaps.",
            }
        )
    if any(issue["title"] == "No closing time is set" for issue in issues):
        steps.append(
            {
                "phase": "Classroom rollout",
                "action": "Publish the quiz with a clear start and end window, then remind students when the monitored attempt will close.",
            }
        )
    steps.append(
        {
            "phase": "Remediation",
            "action": "Use the missed-question patterns to assign one reinforcement task and one reflection prompt after the quiz closes.",
        }
    )
    return steps


def _score_quality(issues: List[Dict]) -> int:
    score = 100
    for issue in issues:
        severity = issue["severity"]
        if severity == "high":
            score -= 18
        elif severity == "medium":
            score -= 10
        else:
            score -= 4
    return max(42, score)


def _issue(severity: str, title: str, detail: str) -> Dict:
    return {"severity": severity, "title": title, "detail": detail}


def _suggestion(title: str, detail: str) -> Dict:
    return {"title": title, "detail": detail}
