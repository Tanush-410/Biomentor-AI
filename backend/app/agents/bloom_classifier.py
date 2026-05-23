"""Bloom's Taxonomy classifier and analyzer."""
from typing import Dict, List, Tuple
from enum import Enum
import json
import re


class BloomLevel(Enum):
    """Bloom's Taxonomy levels."""
    REMEMBER = 1
    UNDERSTAND = 2
    APPLY = 3
    ANALYZE = 4
    EVALUATE = 5
    CREATE = 6


BLOOM_TAXONOMY = {
    1: {
        "name": "Remember",
        "description": "Retrieve relevant knowledge from long-term memory",
        "keywords": ["define", "duplicate", "list", "recall", "repeat", "reproduce", "state", "memorize", "name", "identify", "label", "quote"],
        "verbs": ["what is", "who is", "where is", "when was", "list", "name", "state", "recall", "define", "identify"],
        "examples": ["recall facts", "define terms", "recognize patterns"]
    },
    2: {
        "name": "Understand",
        "description": "Determine the meaning of instructional messages",
        "keywords": ["classify", "convert", "describe", "discuss", "estimate", "explain", "generalize", "illustrate", "interpret", "paraphrase", "represent", "summarize", "translate", "distinguish", "predict"],
        "verbs": ["explain", "describe", "summarize", "classify", "interpret", "illustrate", "discuss", "tell", "recognize", "understand", "infer", "predict how"],
        "examples": ["explain concept", "summarize information", "describe process"]
    },
    3: {
        "name": "Apply",
        "description": "Carry out or use a procedure in a given situation",
        "keywords": ["apply", "demonstrate", "employ", "illustrate", "interpret", "operate", "solve", "use", "calculate", "compute", "implement", "practice", "show how", "modify", "transfer", "choose", "construct"],
        "verbs": ["apply", "demonstrate", "solve", "use", "calculate", "show how to", "determine", "modify", "complete", "construct", "model", "perform", "build", "create using"],
        "examples": ["solve problems", "apply formulas", "use techniques", "construct models"]
    },
    4: {
        "name": "Analyze",
        "description": "Break material into parts and determine how parts relate",
        "keywords": ["analyze", "categorize", "compare", "contrast", "criticize", "differentiate", "discriminate", "distinguish", "examine", "explain", "question", "relate", "separate", "subdivide", "break down", "component"],
        "verbs": ["analyze", "compare", "contrast", "examine", "break down", "distinguish between", "categorize", "relate", "question", "determine", "find"],
        "examples": ["analyze components", "break down structures", "compare elements"]
    },
    5: {
        "name": "Evaluate",
        "description": "Make judgments based on criteria and standards",
        "keywords": ["appraise", "argue", "defend", "judge", "select", "support", "value", "evaluate", "check", "critique", "rank", "rate", "recommend", "justify", "conclude", "optimize"],
        "verbs": ["evaluate", "judge", "defend", "critique", "argue", "justify", "support", "rate", "rank", "recommend", "conclude", "prioritize"],
        "examples": ["judge effectiveness", "critique solutions", "defend positions"]
    },
    6: {
        "name": "Create",
        "description": "Put elements together to form a new whole",
        "keywords": ["assemble", "create", "design", "develop new", "formulate", "hypothesize", "generate new", "plan new", "produce original", "propose new", "synthesize", "write", "invent", "devise"],
        "verbs": ["create", "design", "develop", "propose", "plan", "write", "invent", "devise", "formulate", "compile", "synthesize", "generate"],
        "examples": ["design solutions", "create frameworks", "develop theories", "invent mechanisms"]
    }
}


class BloomClassifier:
    """Classify questions/tasks by Bloom's Taxonomy level."""
    
    @staticmethod
    def analyze(text: str) -> Dict:
        """
        Analyze text to determine Bloom's Taxonomy level.
        Improved with semantic analysis and verb detection.
        
        Args:
            text: Question or task text to analyze
            
        Returns:
            Dict with level, name, confidence, and detected keywords
        """
        text_lower = text.lower().strip()
        
        # Extract primary verb/action
        primary_verb = BloomClassifier._extract_primary_verb(text_lower)
        
        # Score each level based on multiple factors
        scores = {}
        detected_keywords_by_level = {}
        
        for level, info in BLOOM_TAXONOMY.items():
            score = 0
            detected = []
            
            # Check verb phrases (weighted heavily, but with context awareness)
            for verb_phrase in info["verbs"]:
                if verb_phrase in text_lower:
                    # Context-aware weighting: reduce score if conflicting verbs exist
                    verb_weight = 3
                    
                    # Special handling for ambiguous verbs
                    if verb_phrase == "construct" and level == 3:
                        # Check if it's truly just construction (Level 3) or if there are Level 6 indicators
                        if re.search(r"\b(design|new|original|invent)\b", text_lower):
                            verb_weight = 1  # Reduce if there are Create-level indicators
                        else:
                            verb_weight = 2  # Normal weight for straightforward construction
                    
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
            structure_score, structure_keywords = BloomClassifier._analyze_structure(text_lower, level)
            score += structure_score
            detected.extend(structure_keywords)
            
            scores[level] = score
            detected_keywords_by_level[level] = list(set(detected))
        
        # Penalize Level 6 if no clear creation indicators present
        has_create_indicators = re.search(r"\b(design new|create|invent|propose new|formulate|synthesize)\b", text_lower)
        if not has_create_indicators and "construct" in text_lower:
            scores[6] = max(0, scores[6] - 2)  # Reduce Level 6 score
        
        # Find best match (with minimum score threshold)
        best_level = 2  # Default to Understand if no clear match
        best_score = scores.get(best_level, 0)
        
        for level, score in scores.items():
            if score > best_score:
                best_level = level
                best_score = score
        
        # If all scores are 0, use structure analysis as fallback
        if best_score == 0:
            best_level = BloomClassifier._fallback_level_detection(text_lower)
        
        # Calculate confidence
        total_score = sum(max(s, 0.1) for s in scores.values())
        confidence = best_score / total_score if total_score > 0 else 0.5
        
        detected = detected_keywords_by_level.get(best_level, [])
        
        return {
            "level": best_level,
            "level_name": BLOOM_TAXONOMY[best_level]["name"],
            "confidence": min(max(confidence, 0.3), 1.0),  # Between 0.3 and 1.0
            "detected_keywords": detected[:5],  # Top 5
            "description": BLOOM_TAXONOMY[best_level]["description"],
            "scores": scores
        }
    
    @staticmethod
    def _extract_primary_verb(text: str) -> str:
        """Extract the primary verb from the text."""
        # Look for common question starters
        question_verbs = [
            "what", "why", "how", "when", "where", "which", "who", "whose"
        ]
        
        words = text.split()
        for i, word in enumerate(words):
            if word in question_verbs and i + 1 < len(words):
                return words[i + 1].rstrip("?,.")
        
        return ""
    
    @staticmethod
    def _analyze_structure(text: str, level: int) -> Tuple[int, List[str]]:
        """Analyze question structure to determine level."""
        score = 0
        keywords = []
        
        # Pattern detection for each level
        if level == 1:  # Remember
            if re.search(r"\b(list|name|state|identify|what is|who is|where is)\b", text):
                score += 2
                keywords.append("fact-based question")
        
        elif level == 2:  # Understand
            if re.search(r"\b(explain|describe|summarize|tell|discuss|why does)\b", text):
                score += 2
                keywords.append("explanation-based question")
            if " and " in text or " or " in text:
                score += 1  # Multiple concepts
        
        elif level == 3:  # Apply
            if re.search(r"\b(how would|apply|solve|demonstrate|show how|using|calculate)\b", text):
                score += 2
                keywords.append("application-based question")
            # Look for conditional/scenario patterns
            if re.search(r"\b(given|if|assume|suppose|scenario)\b", text):
                score += 1
        
        elif level == 4:  # Analyze
            if re.search(r"\b(analyze|compare|contrast|distinguish|examine|component|break down)\b", text):
                score += 3
                keywords.append("analysis question")
            if re.search(r"\b(how.*different|relationship between|factors affecting)\b", text):
                score += 2
        
        elif level == 5:  # Evaluate
            if re.search(r"\b(evaluate|judge|defend|critique|argue|justify|which.*best|assess)\b", text):
                score += 3
                keywords.append("evaluation question")
            if re.search(r"\b(should|pros and cons|effectiveness|compare value)\b", text):
                score += 2
        
        elif level == 6:  # Create
            if re.search(r"\b(create|design|develop|propose|plan|invent|devise|write|generate)\b", text):
                score += 3
                keywords.append("creation question")
            if re.search(r"\b(how would you|develop|formulate|new|original)\b", text):
                score += 2
        
        return score, keywords
    
    @staticmethod
    def _fallback_level_detection(text: str) -> int:
        """Fallback detection based on question length and complexity."""
        word_count = len(text.split())
        
        # Simple heuristics as fallback
        if word_count < 8:
            return 1  # Short questions usually Remember level
        elif word_count < 15:
            return 2  # Medium questions usually Understand
        elif word_count < 20:
            return 3  # Longer questions might be Apply
        else:
            return 4  # Complex sentences suggest higher levels
    
    @staticmethod
    def generate_prompts(text: str, target_level: int) -> Dict[str, str]:
        """
        Generate modified versions of question at different difficulty levels.
        
        Args:
            text: Original question/task
            target_level: Target Bloom's level (1-6)
            
        Returns:
            Dict with prompts for each level
        """
        if target_level < 1 or target_level > 6:
            target_level = 3  # Default to Apply
        
        prompts = {}
        
        # Template modifications based on target level
        templates = {
            1: f"Recall: {text}",
            2: f"Explain the concept of: {text}",
            3: f"How would you apply: {text}",
            4: f"Analyze and compare: {text}",
            5: f"Critically evaluate: {text}",
            6: f"Design and propose a solution for: {text}"
        }
        
        return templates
    
    @staticmethod
    def get_all_levels() -> List[Dict]:
        """Get all Bloom's Taxonomy levels with descriptions."""
        return [
            {
                "level": level,
                "name": info["name"],
                "description": info["description"],
                "keywords": info["keywords"],
                "examples": info["examples"]
            }
            for level, info in BLOOM_TAXONOMY.items()
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
        "add_analysis": "Analyze why and how in: ",
        "add_comparison": "Compare and contrast: ",
        "ask_synthesis": "Synthesize and propose: ",
    }
    
    @staticmethod
    def simplify(question: str, current_level: int, steps: int = 1) -> str:
        """
        Simplify a question by reducing Bloom's level.
        
        Args:
            question: Original question
            current_level: Current Bloom's level
            steps: How many levels to reduce
            
        Returns:
            Simplified question
        """
        new_level = max(1, current_level - steps)
        
        simplifications = {
            1: f"Recall and state: {question}",
            2: f"Explain the meaning: {question}",
            3: f"Apply this concept: {question}",
            4: f"Analyze the components: {question}",
            5: f"Evaluate the following: {question}",
        }
        
        return simplifications.get(current_level, question)
    
    @staticmethod
    def complexify(question: str, current_level: int, steps: int = 1) -> str:
        """
        Increase question complexity by increasing Bloom's level.
        
        Args:
            question: Original question
            current_level: Current Bloom's level
            steps: How many levels to increase
            
        Returns:
            More complex question
        """
        new_level = min(6, current_level + steps)
        
        complexifications = {
            1: f"Explain what you recall: {question}",
            2: f"Apply this understanding: {question}",
            3: f"Analyze why this applies: {question}",
            4: f"Evaluate the implications: {question}",
            5: f"Create a new framework: {question}",
        }
        
        return complexifications.get(current_level, question)
    
    @staticmethod
    def get_variants(question: str, current_level: int) -> Dict:
        """
        Generate three variants: simplified, same, and complex.
        
        Args:
            question: Original question
            current_level: Current Bloom's level
            
        Returns:
            Dict with three question variants
        """
        return {
            "simplified": {
                "text": QuestionDifficultyConverter.simplify(question, current_level),
                "level": max(1, current_level - 1),
                "level_name": BLOOM_TAXONOMY[max(1, current_level - 1)]["name"],
                "adjustment": "Reduced by 1 level"
            },
            "original": {
                "text": question,
                "level": current_level,
                "level_name": BLOOM_TAXONOMY[current_level]["name"],
                "adjustment": "Original"
            },
            "complex": {
                "text": QuestionDifficultyConverter.complexify(question, current_level),
                "level": min(6, current_level + 1),
                "level_name": BLOOM_TAXONOMY[min(6, current_level + 1)]["name"],
                "adjustment": "Increased by 1 level"
            }
        }

    @staticmethod
    def convert_to_level(question: str, target_level: int) -> str:
        """Convert a question prompt style to a specific Bloom's level."""
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
            2: lambda q: f"Explain {q} in your own words.",
            3: lambda q: f"How would you apply {q} in a real situation?",
            4: lambda q: f"What parts or relationships should be analyzed in {q}?",
            5: lambda q: f"How would you evaluate the effectiveness or importance of {q}?",
            6: lambda q: f"How would you create or design something new using {q}?",
        }

        target_level = max(1, min(6, target_level))
        return templates[target_level](topic)

    @staticmethod
    def get_all_level_variants(question: str, current_level: int, target_level: int = None) -> Dict:
        """Generate variants for all Bloom levels and include target guidance."""
        variants = {}
        for level in range(1, 7):
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
                "level_name": BLOOM_TAXONOMY[level]["name"],
                "adjustment": adjustment,
                "is_target": (target_level == level)
            }

        return variants
