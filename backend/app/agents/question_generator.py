"""Quiz question generation from uploaded study material."""
import json
import random
import re
import uuid
from typing import Dict, List, Optional

import requests

from app.agents.bloom_classifier import BLOOM_TAXONOMY
from app.core import settings


class QuestionGenerator:
    """Generate grounded quiz questions from PDF/text content."""

    GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
    GROQ_MODELS = [
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "mixtral-8x7b-32768",
    ]

    STOPWORDS = {
        "a", "an", "and", "are", "as", "at", "be", "been", "by", "for", "from",
        "has", "have", "in", "is", "it", "its", "of", "on", "or", "that", "the",
        "their", "this", "to", "was", "were", "which", "with",
    }

    NOISE_PATTERNS = [
        r"\[(?:page|pg)\s*\d+[^\]]*\]",
        r"\b(?:page|pg)\s*\d+\b",
        r"\b(?:figure|table|chapter|unit|section|example)\s*[-:]?\s*\d+[a-z-]*\b",
        r"https?://\S+",
        r"www\.\S+",
        r"\s+",
    ]

    @staticmethod
    def generate_questions(
        content: str,
        num_questions: int = 5,
        bloom_levels: Optional[List[int]] = None,
        source_contexts: Optional[List[Dict]] = None,
    ) -> List[Dict]:
        """Generate quiz questions from cleaned source content."""
        if not bloom_levels:
            bloom_levels = [1, 2, 3, 4]

        cleaned_content = QuestionGenerator._normalize_content(content)
        target_levels = QuestionGenerator._expand_levels(num_questions, bloom_levels)
        selected_contexts = QuestionGenerator.select_source_contexts(
            source_contexts,
            max_items=max(num_questions * 2, 6),
        )
        prompt_context = QuestionGenerator._format_source_contexts(selected_contexts) if selected_contexts else cleaned_content

        questions = QuestionGenerator._generate_with_llm(
            prompt_context,
            num_questions=num_questions,
            target_levels=target_levels
        )
        if questions:
            return questions[:num_questions]

        return QuestionGenerator._generate_with_fallback(
            cleaned_content,
            num_questions=num_questions,
            target_levels=target_levels,
            source_contexts=selected_contexts,
        )

    @staticmethod
    def select_source_contexts(source_contexts: Optional[List[Dict]], max_items: int = 8) -> List[Dict]:
        """Pick diverse, high-signal contexts so questions do not overfit one page."""
        if not source_contexts:
            return []

        ranked = sorted(
            (dict(item) for item in source_contexts if QuestionGenerator._normalize_content(item.get("content", ""))),
            key=lambda item: (
                float(item.get("relevance_score") or 0.0),
                len(QuestionGenerator._extract_keywords(item.get("content", ""))),
                len(item.get("content", "")),
            ),
            reverse=True,
        )

        selected: List[Dict] = []
        seen_pages = set()
        seen_signatures = set()
        covered_keywords = set()

        for item in ranked:
            page_key = (item.get("document_id"), item.get("page_number"))
            signature = (
                item.get("document_id"),
                item.get("page_number"),
                QuestionGenerator._clean_text(item.get("content", ""))[:180].lower(),
            )
            if page_key in seen_pages or signature in seen_signatures:
                continue

            keywords = QuestionGenerator._extract_keywords(item.get("content", ""))
            novelty = len([keyword for keyword in keywords if keyword not in covered_keywords])
            if selected and novelty == 0 and len(selected) >= max(2, max_items // 2):
                continue

            selected.append(item)
            seen_pages.add(page_key)
            seen_signatures.add(signature)
            covered_keywords.update(keywords[:6])
            if len(selected) >= max_items:
                return selected

        for item in ranked:
            signature = (
                item.get("document_id"),
                item.get("page_number"),
                QuestionGenerator._clean_text(item.get("content", ""))[:180].lower(),
            )
            if signature in seen_signatures:
                continue
            selected.append(item)
            seen_signatures.add(signature)
            if len(selected) >= max_items:
                break

        return selected[:max_items]

    @staticmethod
    def _generate_with_llm(content: str, num_questions: int, target_levels: List[int]) -> List[Dict]:
        if not QuestionGenerator._groq_available():
            return []

        context = QuestionGenerator._select_context(content)
        if not context:
            return []

        prompt = QuestionGenerator._build_prompt(context, num_questions, target_levels)
        headers = {
            "Authorization": f"Bearer {settings.groq_api_key}",
            "Content-Type": "application/json",
        }

        for model in QuestionGenerator.GROQ_MODELS:
            payload = {
                "model": model,
                "temperature": 0.3,
                "response_format": {"type": "json_object"},
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "You create high-quality multiple-choice quizzes from study material. "
                            "Only use facts supported by the provided text. Ignore page headers, table labels, "
                            "example markers, and formatting noise."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
            }

            try:
                response = requests.post(
                    QuestionGenerator.GROQ_URL,
                    headers=headers,
                    json=payload,
                    timeout=45,
                )
                response.raise_for_status()
                data = response.json()
                content_text = data["choices"][0]["message"]["content"]
                parsed = QuestionGenerator._extract_json(content_text)
                questions = QuestionGenerator._normalize_llm_questions(
                    parsed.get("questions", []),
                    target_levels,
                )
                if len(questions) >= max(1, min(num_questions, 2)):
                    return questions
            except Exception:
                continue

        return []

    @staticmethod
    def _build_prompt(context: str, num_questions: int, target_levels: List[int]) -> str:
        return f"""
Create exactly {num_questions} multiple-choice questions from the study material below.

Target Bloom levels in order: {target_levels}

Rules:
- Use only information grounded in the material.
- Write natural, student-friendly question wording.
- Each question must have exactly 4 answer options.
- Exactly 1 option must have "is_correct": true.
- Do not use "All of the above" or "None of the above".
- Do not mention page numbers, tables, figures, or raw extraction artifacts.
- Make distractors plausible but clearly wrong based on the material.
- Keep explanations short and factual.
- Include the source document title and page number that best support the question.

Return strict JSON with this shape:
{{
  "questions": [
    {{
      "text": "Question text",
      "bloom_level": 2,
      "source_document": "Document title",
      "page_number": 3,
      "source_excerpt": "Short supporting excerpt from the material",
      "options": [
        {{"id": "A", "text": "Option text", "is_correct": false}},
        {{"id": "B", "text": "Option text", "is_correct": true}},
        {{"id": "C", "text": "Option text", "is_correct": false}},
        {{"id": "D", "text": "Option text", "is_correct": false}}
      ],
      "explanation": "Short explanation"
    }}
  ]
}}

Study material:
\"\"\"
{context}
\"\"\"
""".strip()

    @staticmethod
    def _normalize_llm_questions(items: List[Dict], target_levels: List[int]) -> List[Dict]:
        questions = []
        for index, item in enumerate(items):
            normalized = QuestionGenerator._normalize_single_question(
                item,
                target_levels[index] if index < len(target_levels) else target_levels[-1]
            )
            if normalized:
                questions.append(normalized)
        return questions

    @staticmethod
    def _normalize_single_question(item: Dict, fallback_level: int) -> Optional[Dict]:
        text = QuestionGenerator._clean_text(item.get("text", ""))
        explanation = QuestionGenerator._clean_text(item.get("explanation", ""))
        if not text or len(text.split()) < 5:
            return None
        if QuestionGenerator._looks_noisy(text):
            return None

        raw_options = item.get("options", [])
        options = QuestionGenerator._normalize_options(raw_options)
        if len(options) != 4:
            return None

        correct_count = sum(1 for option in options if option["is_correct"])
        if correct_count != 1:
            return None

        bloom_level = item.get("bloom_level", fallback_level)
        if not isinstance(bloom_level, int) or bloom_level not in BLOOM_TAXONOMY:
            bloom_level = fallback_level

        return {
            "id": str(uuid.uuid4()),
            "text": text,
            "document_id": QuestionGenerator._clean_text(item.get("source_document_id", "")) or None,
            "document_reference": QuestionGenerator._clean_text(item.get("source_document", "")) or None,
            "page_number": QuestionGenerator._safe_int(item.get("page_number")),
            "bloom_level": bloom_level,
            "bloom_level_name": BLOOM_TAXONOMY[bloom_level]["name"],
            "options": options,
            "explanation": explanation or None,
            "source_excerpt": QuestionGenerator._clean_text(item.get("source_excerpt", "")) or None,
            "source": QuestionGenerator._clean_text(item.get("source_excerpt", "")) or None,
        }

    @staticmethod
    def _normalize_options(raw_options: List[Dict]) -> List[Dict]:
        if not isinstance(raw_options, list):
            return []

        labels = ["A", "B", "C", "D"]
        normalized = []
        seen_text = set()

        for index, option in enumerate(raw_options[:4]):
            text = QuestionGenerator._clean_text(option.get("text", ""))
            if not text or QuestionGenerator._looks_noisy(text):
                return []

            text_key = text.lower()
            if text_key in seen_text:
                return []
            seen_text.add(text_key)

            normalized.append(
                {
                    "id": labels[index],
                    "text": text,
                    "is_correct": bool(option.get("is_correct", False)),
                }
            )

        return normalized if len(normalized) == 4 else []

    @staticmethod
    def _generate_with_fallback(
        content: str,
        num_questions: int,
        target_levels: List[int],
        source_contexts: Optional[List[Dict]] = None,
    ) -> List[Dict]:
        facts = QuestionGenerator._extract_facts(content, source_contexts=source_contexts)
        if not facts:
            return []

        questions = []
        used_subjects = set()
        for fact in facts:
            if len(questions) >= num_questions:
                break
            subject_key = fact["subject"].lower()
            if subject_key in used_subjects:
                continue

            level = target_levels[len(questions) % len(target_levels)]
            question = QuestionGenerator._build_fallback_question(fact, facts, level)
            if question:
                questions.append(question)
                used_subjects.add(subject_key)

        return questions

    @staticmethod
    def _build_fallback_question(fact: Dict, facts: List[Dict], bloom_level: int) -> Optional[Dict]:
        options = QuestionGenerator._build_fallback_options(fact, facts)
        if len(options) != 4:
            return None

        subject = fact["subject"]
        stems = {
            1: f"What best defines {subject}?",
            2: f"Which option best explains {subject}?",
            3: f"Which example best shows how {subject} is used?",
            4: f"Which option best distinguishes {subject}?",
            5: f"Which statement about {subject} is best supported by the material?",
            6: f"Which new task could be designed using the concept of {subject}?",
        }

        return {
            "id": str(uuid.uuid4()),
            "text": stems.get(bloom_level, stems[2]),
            "document_id": fact.get("document_id"),
            "document_reference": fact.get("document_title"),
            "page_number": fact.get("page_number"),
            "bloom_level": bloom_level,
            "bloom_level_name": BLOOM_TAXONOMY[bloom_level]["name"],
            "options": options,
            "explanation": f"{fact['subject']} is {fact['object']}.",
            "source_excerpt": fact.get("source_excerpt"),
            "source": fact.get("source_excerpt"),
        }

    @staticmethod
    def _build_fallback_options(fact: Dict, facts: List[Dict]) -> List[Dict]:
        correct = QuestionGenerator._clean_text(fact["object"])
        distractors = []

        for other in facts:
            if other["subject"] == fact["subject"]:
                continue
            candidate = QuestionGenerator._clean_text(other["object"])
            if candidate and candidate.lower() != correct.lower() and candidate not in distractors:
                distractors.append(candidate)
            if len(distractors) >= 3:
                break

        if len(distractors) < 3:
            keywords = fact.get("keywords", [])
            first = keywords[0] if keywords else "one detail"
            second = keywords[1] if len(keywords) > 1 else "another idea"
            fallback = [
                f"It focuses only on {first} instead of the full concept",
                f"It combines {first} and {second} without defining the idea",
                f"It describes something unrelated to the concept",
            ]
            for item in fallback:
                if item not in distractors:
                    distractors.append(item)
                if len(distractors) >= 3:
                    break

        if len(distractors) < 3:
            return []

        pool = [(correct, True)] + [(text, False) for text in distractors[:3]]
        random.shuffle(pool)
        labels = ["A", "B", "C", "D"]
        return [
            {"id": labels[index], "text": text, "is_correct": is_correct}
            for index, (text, is_correct) in enumerate(pool)
        ]

    @staticmethod
    def _extract_facts(content: str, source_contexts: Optional[List[Dict]] = None) -> List[Dict]:
        if source_contexts:
            facts = []
            for item in source_contexts:
                facts.extend(
                    QuestionGenerator._extract_facts_from_text(
                        item.get("content", ""),
                        item.get("document_id"),
                        item.get("document_title"),
                        item.get("page_number"),
                    )
                )
            return facts

        return QuestionGenerator._extract_facts_from_text(content, None, None, None)

    @staticmethod
    def _extract_facts_from_text(
        content: str,
        document_id: Optional[str],
        document_title: Optional[str],
        page_number: Optional[int],
    ) -> List[Dict]:
        sentences = re.split(r"(?<=[.!?])\s+", content)
        facts = []
        patterns = [
            r"^(?P<subject>[A-Z][A-Za-z0-9(),\-/\s]{3,90}?)\s+is\s+(?P<object>[^.?!]{15,220})$",
            r"^(?P<subject>[A-Z][A-Za-z0-9(),\-/\s]{3,90}?)\s+are\s+(?P<object>[^.?!]{15,220})$",
            r"^(?P<subject>[A-Z][A-Za-z0-9(),\-/\s]{3,90}?)\s+refers to\s+(?P<object>[^.?!]{15,220})$",
            r"^(?P<subject>[A-Z][A-Za-z0-9(),\-/\s]{3,90}?)\s+means\s+(?P<object>[^.?!]{15,220})$",
        ]

        for raw_sentence in sentences:
            sentence = QuestionGenerator._clean_text(raw_sentence)
            if not QuestionGenerator._sentence_is_usable(sentence):
                continue

            for pattern in patterns:
                match = re.match(pattern, sentence)
                if not match:
                    continue

                subject = QuestionGenerator._clean_text(match.group("subject"))
                obj = QuestionGenerator._clean_text(match.group("object"))
                if not subject or not obj:
                    continue
                if QuestionGenerator._looks_noisy(subject) or QuestionGenerator._looks_noisy(obj):
                    continue

                facts.append(
                    {
                        "subject": subject,
                        "object": obj,
                        "keywords": QuestionGenerator._extract_keywords(f"{subject} {obj}"),
                        "document_id": document_id,
                        "document_title": document_title,
                        "page_number": page_number,
                        "source_excerpt": sentence[:220],
                    }
                )
                break

        return facts

    @staticmethod
    def _extract_keywords(text: str) -> List[str]:
        tokens = re.findall(r"[A-Za-z][A-Za-z'-]+", text.lower())
        keywords = []
        for token in tokens:
            if len(token) < 4 or token in QuestionGenerator.STOPWORDS:
                continue
            if token not in keywords:
                keywords.append(token)
        return keywords[:8]

    @staticmethod
    def _expand_levels(num_questions: int, bloom_levels: List[int]) -> List[int]:
        levels = []
        valid = [level for level in bloom_levels if level in BLOOM_TAXONOMY] or [2, 3, 4]
        for index in range(num_questions):
            levels.append(valid[index % len(valid)])
        return levels

    @staticmethod
    def _select_context(content: str, max_chars: int = 12000) -> str:
        paragraphs = re.split(r"\n{2,}", content)
        usable = []
        for paragraph in paragraphs:
            cleaned = QuestionGenerator._clean_text(paragraph)
            if not QuestionGenerator._sentence_is_usable(cleaned):
                continue
            score = len(cleaned.split()) + len(QuestionGenerator._extract_keywords(cleaned)) * 3
            usable.append((score, cleaned))

        usable.sort(key=lambda item: item[0], reverse=True)
        selected = []
        total = 0
        for _, paragraph in usable:
            if total + len(paragraph) > max_chars:
                continue
            selected.append(paragraph)
            total += len(paragraph)
            if total >= max_chars * 0.85:
                break

        if not selected:
            return content[:max_chars]

        return "\n\n".join(selected)

    @staticmethod
    def _normalize_content(content: str) -> str:
        text = content or ""
        text = text.replace("\r", "\n")
        text = re.sub(r"\n\s*\n+", "\n\n", text)
        text = re.sub(r"[ \t]+", " ", text)
        for pattern in QuestionGenerator.NOISE_PATTERNS[:-1]:
            text = re.sub(pattern, " ", text, flags=re.IGNORECASE)
        text = re.sub(QuestionGenerator.NOISE_PATTERNS[-1], " ", text)
        text = re.sub(r"\s+\.", ".", text)
        return text.strip()

    @staticmethod
    def _extract_json(text: str) -> Dict:
        cleaned = text.strip()
        fenced = re.search(r"```json\s*(\{.*\})\s*```", cleaned, re.DOTALL)
        if fenced:
            cleaned = fenced.group(1)
        return json.loads(cleaned)

    @staticmethod
    def _clean_text(text: str) -> str:
        cleaned = re.sub(r"\s+", " ", str(text or "")).strip(" \n\t\"'.,:;")
        return cleaned

    @staticmethod
    def _safe_int(value) -> Optional[int]:
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            return None
        return parsed if parsed > 0 else None

    @staticmethod
    def _format_source_contexts(source_contexts: Optional[List[Dict]]) -> str:
        if not source_contexts:
            return ""
        return "\n\n".join(
            (
                f"[Source: {item.get('document_title', 'Document')} | Page {item.get('page_number', 1)}]\n"
                f"{QuestionGenerator._normalize_content(item.get('content', ''))}"
            )
            for item in source_contexts
            if QuestionGenerator._normalize_content(item.get('content', ''))
        )

    @staticmethod
    def _sentence_is_usable(sentence: str) -> bool:
        words = sentence.split()
        if len(words) < 8 or len(words) > 40:
            return False
        if QuestionGenerator._looks_noisy(sentence):
            return False
        return True

    @staticmethod
    def _looks_noisy(text: str) -> bool:
        lowered = text.lower()
        if any(token in lowered for token in ["page ", "figure ", "table ", "chapter ", "section "]):
            return True
        digit_ratio = sum(char.isdigit() for char in text) / max(len(text), 1)
        if digit_ratio > 0.12:
            return True
        if re.search(r"\b[pP]\d+\b", text):
            return True
        return False

    @staticmethod
    def _groq_available() -> bool:
        key = (settings.groq_api_key or "").strip()
        return bool(key and not key.lower().startswith("your_"))
