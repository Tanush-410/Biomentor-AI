"""SOLO Taxonomy classifier and analyzer."""
from typing import Dict, List, Tuple
from enum import Enum
import re


class SoloLevel(Enum):
    """SOLO (Structure of Observed Learning Outcomes) Taxonomy levels."""
    PRESTRUCTURAL = 1
    UNISTRUCTURAL = 2
    MULTISTRUCTURAL = 3
    RELATIONAL = 4
    EXTENDED_ABSTRACT = 5


SOLO_TAXONOMY = {
    1: {
        "name": "Prestructural",
        "description": "Little or no relevant understanding is shown; the task is approached through a single unconnected, often surface-level detail",
        "keywords": ["what is", "name", "label", "point out", "identify one", "single fact", "term", "recognize"],
        "verbs": ["what is", "who is", "where is", "when was", "name", "label", "point out", "identify"],
        "examples": ["name a term", "point to a fact", "label a diagram part"]
    },
    2: {
        "name": "Unistructural",
        "description": "One relevant piece of information or a single aspect of the task is identified and used correctly",
        "keywords": ["define", "describe", "state", "recall", "identify", "list one", "match", "recognize"],
        "verbs": ["define", "describe", "state", "recall", "identify", "list one"],
        "examples": ["define a term", "describe a single feature", "state one cause"]
    },
    3: {
        "name": "Multistructural",
        "description": "Several relevant, independent pieces of information are identified, but they are not yet connected to one another",
        "keywords": ["list", "describe several", "enumerate", "outline", "classify", "summarize", "give examples", "distinguish", "categorize"],
        "verbs": ["list", "outline", "summarize", "enumerate", "give examples of", "classify", "describe"],
        "examples": ["list several causes", "describe multiple features", "summarize key points"]
    },
    4: {
        "name": "Relational",
        "description": "Multiple pieces of information are integrated into a coherent whole, with clear relationships understood between the parts",
        "keywords": ["explain", "relate", "compare", "contrast", "analyze", "integrate", "connect", "apply", "relationship between", "cause and effect", "sequence"],
        "verbs": ["explain how", "relate", "compare", "contrast", "analyze", "apply", "connect", "integrate", "show how"],
        "examples": ["explain how factors relate", "apply a concept to a situation", "analyze the relationship between parts"]
    },
    5: {
        "name": "Extended Abstract",
        "description": "Understanding is generalized beyond the given information, transferred to a new context, or used to form an abstract principle",
        "keywords": ["generalize", "hypothesize", "predict", "theorize", "evaluate", "create", "design", "justify", "critique", "propose new", "new context", "synthesize"],
        "verbs": ["evaluate", "hypothesize", "generalize", "predict", "design", "create", "propose", "justify", "critique", "theorize"],
        "examples": ["propose a new theory", "predict outcomes in a new context", "critique and design an improved solution"]
    }
}


class SoloClassifier:
    """Classify questions/tasks by SOLO Taxonomy level."""

    @staticmethod
    def analyze(text: str) -> Dict:
        """
        Analyze text to determine SOLO Taxonomy level.
        Improved with semantic analysis and verb detection.

        Args:
            text: Question or task text to analyze

        Returns:
            Dict with level, name, confidence, and detected keywords
        """
        text_lower = text.lower().strip()

        # Score each level based on multiple factors
        scores = {}
        detected_keywords_by_level = {}

        for level, info in SOLO_TAXONOMY.items():
            score = 0
            detected = []

            # Check verb phrases (weighted heavily, but with context awareness)
            for verb_phrase in info["verbs"]:
                if verb_phrase in text_lower:
                    verb_weight = 3

                    # Special handling for ambiguous verbs
                    if verb_phrase == "describe" and level == 3:
                        # Check if it's truly multistructural (several items) or if
                        # there are relational indicators (connecting the parts).
                        if re.search(r"\b(relate|relationship|connect|compare)\b", text_lower):
                            verb_weight = 1
                        else:
                            verb_weight = 2

                    score += verb_weight
                    if verb_phrase not in detected:
                        detected.append(verb_phrase)

            # Check keywords
            for keyword in info["keywords"]:
                if keyword in text_lower:
                    score += 1
                    if keyword not in detected:
                        detected.append(keyword)

            # Check question structure patterns
            structure_score, structure_keywords = SoloClassifier._analyze_structure(text_lower, level)
            score += structure_score
            detected.extend(structure_keywords)

            scores[level] = score
            detected_keywords_by_level[level] = list(set(detected))

        # Penalize Extended Abstract if no clear generalization/transfer indicators present
        has_extended_indicators = re.search(r"\b(generalize|hypothesize|new context|propose new|theorize|synthesize)\b", text_lower)
        if not has_extended_indicators and "evaluate" in text_lower:
            scores[5] = max(0, scores[5] - 2)

        # Find best match (with minimum score threshold)
        best_level = 2  # Default to Unistructural if no clear match
        best_score = scores.get(best_level, 0)

        for level, score in scores.items():
            if score > best_score:
                best_level = level
                best_score = score

        # If all scores are 0, use structure analysis as fallback
        if best_score == 0:
            best_level = SoloClassifier._fallback_level_detection(text_lower)

        # Calculate confidence
        total_score = sum(max(s, 0.1) for s in scores.values())
        confidence = best_score / total_score if total_score > 0 else 0.5

        detected = detected_keywords_by_level.get(best_level, [])

        return {
            "level": best_level,
            "level_name": SOLO_TAXONOMY[best_level]["name"],
            "confidence": min(max(confidence, 0.3), 1.0),  # Between 0.3 and 1.0
            "detected_keywords": detected[:5],  # Top 5
            "description": SOLO_TAXONOMY[best_level]["description"],
            "scores": scores
        }

    @staticmethod
    def _analyze_structure(text: str, level: int) -> Tuple[int, List[str]]:
        """Analyze question structure to determine level."""
        score = 0
        keywords = []

        if level == 1:  # Prestructural
            if re.search(r"\b(what is|who is|where is|name|label|point out)\b", text):
                score += 2
                keywords.append("single-fact question")

        elif level == 2:  # Unistructural
            if re.search(r"\b(define|describe|state|identify|recall)\b", text):
                score += 2
                keywords.append("single-aspect question")

        elif level == 3:  # Multistructural
            if re.search(r"\b(list|outline|summarize|enumerate|give examples|several|multiple)\b", text):
                score += 2
                keywords.append("multiple-aspects question")
            if " and " in text or " or " in text:
                score += 1  # Multiple independent items

        elif level == 4:  # Relational
            if re.search(r"\b(explain how|relate|compare|contrast|analyze|connect|integrate|relationship between)\b", text):
                score += 3
                keywords.append("relational question")
            if re.search(r"\b(how.*different|relationship between|factors affecting)\b", text):
                score += 2

        elif level == 5:  # Extended Abstract
            if re.search(r"\b(evaluate|hypothesize|generalize|predict|design|create|propose|justify|critique|theorize)\b", text):
                score += 3
                keywords.append("extended-abstract question")
            if re.search(r"\b(new context|new situation|in general|beyond)\b", text):
                score += 2

        return score, keywords

    @staticmethod
    def _fallback_level_detection(text: str) -> int:
        """Fallback detection based on question length and complexity."""
        word_count = len(text.split())

        if word_count < 8:
            return 1  # Short questions usually Prestructural
        elif word_count < 15:
            return 2  # Medium questions usually Unistructural
        elif word_count < 20:
            return 3  # Longer questions might be Multistructural
        else:
            return 4  # Complex sentences suggest Relational

    @staticmethod
    def generate_prompts(text: str, target_level: int) -> Dict[str, str]:
        """
        Generate modified versions of question at different difficulty levels.

        Args:
            text: Original question/task
            target_level: Target SOLO level (1-5)

        Returns:
            Dict with prompts for each level
        """
        if target_level < 1 or target_level > 5:
            target_level = 3  # Default to Multistructural

        # Template modifications based on target level
        templates = {
            1: f"Identify: {text}",
            2: f"Define or describe: {text}",
            3: f"List and summarize the key aspects of: {text}",
            4: f"Explain how the parts of {text} relate to each other",
            5: f"Generalize or apply {text} to a new situation"
        }

        return templates

    @staticmethod
    def get_all_levels() -> List[Dict]:
        """Get all SOLO Taxonomy levels with descriptions."""
        return [
            {
                "level": level,
                "name": info["name"],
                "description": info["description"],
                "keywords": info["keywords"],
                "examples": info["examples"]
            }
            for level, info in SOLO_TAXONOMY.items()
        ]


class QuestionDifficultyConverter:
    """Convert questions between different difficulty levels."""

    # Difficulty adjustment templates
    SIMPLIFY_TEMPLATES = {
        "add_definition": "Define: ",
        "add_example": "Provide an example of: ",
        "ask_direct": "What is: ",
    }

    COMPLEXIFY_TEMPLATES = {
        "add_analysis": "Explain how the parts relate in: ",
        "add_comparison": "Compare and contrast: ",
        "ask_generalization": "Generalize and apply: ",
    }

    @staticmethod
    def simplify(question: str, current_level: int, steps: int = 1) -> str:
        """
        Simplify a question by reducing its SOLO level.

        Args:
            question: Original question
            current_level: Current SOLO level
            steps: How many levels to reduce

        Returns:
            Simplified question
        """
        simplifications = {
            1: f"Point to a single relevant fact in: {question}",
            2: f"Name one key term or idea related to: {question}",
            3: f"List a few relevant points about: {question}",
            4: f"Describe the separate parts involved in: {question}",
            5: f"Explain the relationship between the main ideas in: {question}",
        }

        return simplifications.get(current_level, question)

    @staticmethod
    def complexify(question: str, current_level: int, steps: int = 1) -> str:
        """
        Increase question complexity by increasing its SOLO level.

        Args:
            question: Original question
            current_level: Current SOLO level
            steps: How many levels to increase

        Returns:
            More complex question
        """
        complexifications = {
            1: f"Name one key term or idea related to: {question}",
            2: f"List a few relevant points about: {question}",
            3: f"Explain how the parts of {question} relate to each other",
            4: f"Evaluate and generalize the ideas in {question} to a new situation",
            5: f"Propose a new theory or framework building on: {question}",
        }

        return complexifications.get(current_level, question)

    @staticmethod
    def get_variants(question: str, current_level: int) -> Dict:
        """
        Generate three variants: simplified, same, and complex.

        Args:
            question: Original question
            current_level: Current SOLO level

        Returns:
            Dict with three question variants
        """
        return {
            "simplified": {
                "text": QuestionDifficultyConverter.simplify(question, current_level),
                "level": max(1, current_level - 1),
                "level_name": SOLO_TAXONOMY[max(1, current_level - 1)]["name"],
                "adjustment": "Reduced by 1 level"
            },
            "original": {
                "text": question,
                "level": current_level,
                "level_name": SOLO_TAXONOMY[current_level]["name"],
                "adjustment": "Original"
            },
            "complex": {
                "text": QuestionDifficultyConverter.complexify(question, current_level),
                "level": min(5, current_level + 1),
                "level_name": SOLO_TAXONOMY[min(5, current_level + 1)]["name"],
                "adjustment": "Increased by 1 level"
            }
        }

    @staticmethod
    def convert_to_level(question: str, target_level: int) -> str:
        """Convert a question prompt style to a specific SOLO level."""
        clean_q = question.strip().rstrip("?")
        lowered = clean_q.lower()

        if lowered.startswith(("what is ", "what are ")):
            topic = clean_q.split(" ", 2)[-1]
        elif lowered.startswith(("define ", "describe ", "explain ")):
            topic = clean_q.split(" ", 1)[-1]
        else:
            topic = clean_q

        topic = topic.strip().rstrip("?")

        templates = {
            1: lambda q: f"What is {q}?",
            2: lambda q: f"Describe {q} in your own words.",
            3: lambda q: f"List the key aspects of {q}.",
            4: lambda q: f"Explain how the different aspects of {q} relate to one another.",
            5: lambda q: f"How would you generalize or apply {q} to a new situation?",
        }

        target_level = max(1, min(5, target_level))
        return templates[target_level](topic)

    @staticmethod
    def get_all_level_variants(question: str, current_level: int, target_level: int = None) -> Dict:
        """Generate variants for all SOLO levels and include target guidance."""
        variants = {}
        for level in range(1, 6):
            if level == current_level:
                text = question
                adjustment = "Original"
            else:
                text = QuestionDifficultyConverter.convert_to_level(question, level)
                delta = level - current_level
                if delta > 0:
                    adjustment = f"Increased by {delta} level{'s' if delta > 1 else ''}"
                else:
                    adjustment = f"Reduced by {abs(delta)} level{'s' if abs(delta) > 1 else ''}"

            variants[f"level_{level}"] = {
                "text": text,
                "level": level,
                "level_name": SOLO_TAXONOMY[level]["name"],
                "adjustment": adjustment,
                "is_target": (target_level == level)
            }

        return variants
