"""Socratic tutor agents: the model-facing half of the 10-agent pipeline.

These seven agents each own one narrow responsibility in a Socratic
tutoring turn and take no database session -- they operate purely on text
(context, conversation history, student answers) passed in by the caller.
The remaining three agents (retrieval, gap-linking, and the session
orchestrator that sequences all ten) need a database session for lookups
and persistence, so they live in app.services.socratic_tutor instead,
following the same agents/ vs services/ split used everywhere else in this
codebase (e.g. SoloClassifier here vs document_context.py there).
"""
from __future__ import annotations

import logging
from typing import Dict, List, Optional

from app.agents.solo_classifier import SOLO_TAXONOMY, SoloClassifier
from app.services.ai_generation import ai_chat_completion, ai_json_completion, ai_provider_available

logger = logging.getLogger(__name__)

LANGUAGE_NAMES = {
    "en": "English",
    "hi": "Hindi",
    "ta": "Tamil",
    "te": "Telugu",
    "kn": "Kannada",
}


def language_name(code: str) -> str:
    return LANGUAGE_NAMES.get(code, "English")


def _format_history(history: List[Dict], limit: int = 6) -> str:
    if not history:
        return "This is the first exchange of the session."
    lines = []
    for turn in history[-limit:]:
        speaker = "Tutor" if turn.get("role") == "tutor" else "Student"
        lines.append(f"{speaker}: {turn.get('text', '')}")
    return "\n".join(lines)


class QuestionAgent:
    """Agent 1: asks the next Socratic probing question.

    Never states the answer -- it asks a question calibrated to the
    student's current SOLO level, grounded in the retrieved material, that
    nudges them one step further rather than testing recall of a fact
    they've already stated.
    """

    @staticmethod
    def ask(*, context_text: str, topic: str, language: str, solo_level: int, history: List[Dict]) -> str:
        level_info = SOLO_TAXONOMY.get(solo_level, SOLO_TAXONOMY[2])
        lang = language_name(language)
        system_prompt = (
            "You are a Socratic tutor. You never lecture and you never give the answer away -- you ask one "
            "short, focused question at a time that leads the student to discover the answer themselves. "
            f"Calibrate the question to the SOLO Taxonomy '{level_info['name']}' level "
            f"({level_info['description']}). Ground the question in the study material provided. "
            f"Respond ONLY in {lang}, in one or two short sentences, as natural spoken conversation "
            "(this will be read aloud by text-to-speech) -- no markdown, no lists, no LaTeX."
        )
        user_prompt = (
            f"Topic: {topic}\n\n"
            f"Study material:\n{context_text[:4000]}\n\n"
            f"Conversation so far:\n{_format_history(history)}\n\n"
            "Ask the next Socratic question."
        )
        text, _provider = ai_chat_completion(system_prompt=system_prompt, user_prompt=user_prompt, temperature=0.4, timeout=25)
        return text.strip() if text else f"Let's start with the material on {topic}. What do you already know about it?"


class SoloResponseAgent:
    """Agent 2: classifies the structural depth of the student's latest
    answer using the existing SOLO heuristic classifier, to calibrate the
    next question's difficulty."""

    @staticmethod
    def classify(student_text: str) -> Dict:
        return SoloClassifier.analyze(student_text)


class MisconceptionAgent:
    """Agent 3: checks the student's answer against the material for a
    specific, nameable misconception -- not just "right" or "wrong"."""

    @staticmethod
    def detect(*, context_text: str, tutor_question: str, student_answer: str, language: str) -> Optional[str]:
        if not ai_provider_available():
            return None
        lang = language_name(language)
        system_prompt = (
            "You check a student's spoken answer against study material for one specific misconception. "
            "Return JSON only: {\"has_misconception\": boolean, \"misconception\": string or null}. "
            f"If there is a genuine, specific misconception, describe it in one short sentence in {lang}. "
            "If the answer is basically correct or just incomplete (not wrong), has_misconception must be false."
        )
        user_prompt = (
            f"Study material:\n{context_text[:3000]}\n\n"
            f"Tutor's question: {tutor_question}\n\n"
            f"Student's answer: {student_answer}"
        )
        parsed = ai_json_completion(system_prompt=system_prompt, user_prompt=user_prompt, temperature=0.1, timeout=20)
        if not parsed or not parsed.get("has_misconception"):
            return None
        misconception = parsed.get("misconception")
        return str(misconception).strip() if misconception else None


class HintAgent:
    """Agent 4: gives one graduated hint -- never the answer -- when the
    student is stuck or wrong. Each successive hint for the same question
    is more specific than the last."""

    @staticmethod
    def hint(*, context_text: str, tutor_question: str, student_answer: str, hint_level: int, language: str) -> str:
        lang = language_name(language)
        specificity = ["a very gentle nudge pointing at the right area", "a more specific hint narrowing it down", "a strong, almost-there hint"]
        level_desc = specificity[min(hint_level, len(specificity) - 1)]
        system_prompt = (
            "You are a Socratic tutor giving a hint. Never state the final answer directly -- give "
            f"{level_desc}, grounded in the study material, that helps the student get there themselves. "
            f"Respond ONLY in {lang}, in one short sentence, as natural spoken conversation."
        )
        user_prompt = (
            f"Study material:\n{context_text[:3000]}\n\n"
            f"Question: {tutor_question}\n\n"
            f"Student's attempt: {student_answer}\n\n"
            "Give the next hint."
        )
        text, _provider = ai_chat_completion(system_prompt=system_prompt, user_prompt=user_prompt, temperature=0.4, timeout=20)
        return text.strip() if text else "Think about what the material says just before that point -- what leads into it?"


_ENCOURAGEMENT = {
    "en": {"streak": "Nice, you're on a roll.", "struggle": "No worries, let's break it down together.", "neutral": "Good effort."},
    "hi": {"streak": "बहुत बढ़िया, आप सही रास्ते पर हैं।", "struggle": "कोई बात नहीं, चलिए इसे साथ में समझते हैं।", "neutral": "अच्छी कोशिश।"},
    "ta": {"streak": "அருமை, நீங்கள் சரியான பாதையில் இருக்கிறீர்கள்.", "struggle": "பரவாயில்லை, இதை ஒன்றாகப் புரிந்துகொள்வோம்.", "neutral": "நல்ல முயற்சி."},
    "te": {"streak": "బాగుంది, మీరు సరైన మార్గంలో ఉన్నారు.", "struggle": "పర్వాలేదు, దీన్ని కలిసి అర్థం చేసుకుందాం.", "neutral": "మంచి ప్రయత్నం."},
    "kn": {"streak": "ಚೆನ್ನಾಗಿದೆ, ನೀವು ಸರಿಯಾದ ಹಾದಿಯಲ್ಲಿದ್ದೀರಿ.", "struggle": "ಪರವಾಗಿಲ್ಲ, ಇದನ್ನು ಒಟ್ಟಿಗೆ ಅರ್ಥಮಾಡಿಕೊಳ್ಳೋಣ.", "neutral": "ಒಳ್ಳೆಯ ಪ್ರಯತ್ನ."},
}


class EncouragementAgent:
    """Agent 5: picks supportive framing based on the student's recent
    streak, deterministically (no AI call needed for tone)."""

    @staticmethod
    def phrase(*, correct_streak: int, struggle_streak: int, language: str) -> str:
        bank = _ENCOURAGEMENT.get(language, _ENCOURAGEMENT["en"])
        if correct_streak >= 2:
            return bank["streak"]
        if struggle_streak >= 2:
            return bank["struggle"]
        return bank["neutral"]


class DiagramAgent:
    """Agent 6: decides whether a visual would help this turn and, if so,
    emits a small set of whiteboard shapes (never an image) that the
    frontend canvas renders alongside the student's own drawing."""

    @staticmethod
    def maybe_diagram(*, topic: str, tutor_message: str, context_text: str) -> Optional[List[Dict]]:
        if not ai_provider_available():
            return None
        system_prompt = (
            "Decide if a simple whiteboard diagram would help the student understand the current tutoring "
            "moment. Return JSON only: {\"needed\": boolean, \"shapes\": [...]}."
            " Only set needed=true if the topic genuinely involves a process, structure, cycle, or "
            "relationship between parts that benefits from a visual -- not for a plain factual question. "
            "Each shape is one of: "
            "{\"type\":\"rect\",\"x\":n,\"y\":n,\"width\":n,\"height\":n,\"text\":str,\"color\":\"#hex\"}, "
            "{\"type\":\"circle\",\"x\":n,\"y\":n,\"width\":n,\"text\":str,\"color\":\"#hex\"}, "
            "{\"type\":\"arrow\",\"x\":n,\"y\":n,\"x2\":n,\"y2\":n,\"color\":\"#hex\"}, "
            "{\"type\":\"text\",\"x\":n,\"y\":n,\"text\":str,\"color\":\"#hex\"}. "
            "Coordinates are on an 800x500 canvas. Use at most 6 shapes. Keep text short (2-4 words per label)."
        )
        user_prompt = f"Topic: {topic}\n\nCurrent tutor message: {tutor_message}\n\nStudy material:\n{context_text[:2000]}"
        parsed = ai_json_completion(system_prompt=system_prompt, user_prompt=user_prompt, temperature=0.3, timeout=20)
        if not parsed or not parsed.get("needed"):
            return None
        shapes = parsed.get("shapes")
        if not isinstance(shapes, list) or not shapes:
            return None
        return shapes[:6]


class RecapAgent:
    """Agent 7: periodically synthesizes what's been covered so far into a
    short recap, rather than making the student re-derive it from the full
    transcript."""

    @staticmethod
    def summarize(*, transcript: List[Dict], topic: str, language: str) -> Optional[str]:
        if not ai_provider_available() or not transcript:
            return None
        lang = language_name(language)
        system_prompt = (
            f"Summarize this Socratic tutoring conversation about '{topic}' into a short recap of what the "
            f"student has established so far, in 2-3 sentences, in {lang}, as natural spoken conversation "
            "(no markdown)."
        )
        user_prompt = _format_history(transcript, limit=12)
        text, _provider = ai_chat_completion(system_prompt=system_prompt, user_prompt=user_prompt, temperature=0.3, timeout=20)
        return text.strip() if text else None
