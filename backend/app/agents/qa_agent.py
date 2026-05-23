"""Question answering agent using RAG + LLM."""
from typing import List, Dict, Optional
import json
from datetime import datetime


class Answer:
    """Container for generated answer with metadata."""
    
    def __init__(
        self,
        question: str,
        answer_text: str,
        sources: List[Dict] = None,
        confidence: float = 0.8,
        model: str = "groq"
    ):
        self.question = question
        self.answer_text = answer_text
        self.sources = sources or []
        self.confidence = confidence
        self.model = model
        self.generated_at = datetime.utcnow()
    
    def to_dict(self) -> Dict:
        """Convert to dictionary."""
        return {
            "question": self.question,
            "answer": self.answer_text,
            "sources": self.sources,
            "confidence": self.confidence,
            "model": self.model,
            "generated_at": self.generated_at.isoformat()
        }


class QuestionAnsweringAgent:
    """
    Agent that uses RAG + LLM to answer questions based on documents.
    
    Features:
    - Retrieves relevant document chunks
    - Generates answers using Groq API
    - Tracks source references
    - Supports multiple output formats
    """
    
    def __init__(self, groq_client=None, vector_db=None):
        """
        Initialize the agent.
        
        Args:
            groq_client: Groq API client
            vector_db: Vector database for retrieval (Qdrant)
        """
        self.groq_client = groq_client
        self.vector_db = vector_db
    
    async def retrieve_context(
        self,
        query: str,
        top_k: int = 5,
        document_ids: List[str] = None
    ) -> List[Dict]:
        """
        Retrieve relevant context from vector database.
        
        Args:
            query: User's question
            top_k: Number of top results to retrieve
            document_ids: Filter to specific documents
            
        Returns:
            List of relevant document chunks
        """
        if not self.vector_db:
            return []
        
        # In implementation, this calls Qdrant
        # For now, return placeholder
        return [
            {
                "content": "Sample retrieved content",
                "document_id": "doc1",
                "page_number": 1,
                "relevance_score": 0.95
            }
        ]
    
    async def generate_answer(
        self,
        question: str,
        context: List[Dict],
        model: str = "groq"
    ) -> str:
        """
        Generate answer using LLM.
        
        Args:
            question: User's question
            context: Retrieved context chunks
            model: Which model to use
            
        Returns:
            Generated answer text
        """
        if not context:
            return "No relevant information found in your documents."
        
        # Build context string
        context_str = "\n\n".join([
            f"[{chunk.get('document_id', 'Unknown')} - Page {chunk.get('page_number', '?')}]\n{chunk.get('content', '')}"
            for chunk in context
        ])
        
        # Prompt template
        prompt = f"""Based on the provided context, answer the following question clearly and accurately.
        
Context:
{context_str}

Question: {question}

Answer:"""
        
        # In implementation: call actual LLM here
        # For now return template
        return f"Generated answer for: {question}"
    
    async def answer_with_sources(
        self,
        question: str,
        document_ids: List[str] = None,
        top_k: int = 5
    ) -> Answer:
        """
        Main method to answer question with source tracking.
        
        Args:
            question: User's question
            document_ids: Limit to specific documents
            top_k: Number of sources to retrieve
            
        Returns:
            Answer object with sources
        """
        # Retrieve relevant context
        context = await self.retrieve_context(
            question,
            top_k=top_k,
            document_ids=document_ids
        )
        
        # Generate answer
        answer_text = await self.generate_answer(question, context)
        
        # Format sources
        sources = [
            {
                "document_title": chunk.get("document_id"),
                "page_number": chunk.get("page_number"),
                "excerpt": chunk.get("content")[:200] + "..."
            }
            for chunk in context
        ]
        
        return Answer(
            question=question,
            answer_text=answer_text,
            sources=sources,
            confidence=min(len(context) / 5, 1.0)  # Higher confidence with more sources
        )
    
    async def answer_multi_perspective(
        self,
        question: str,
        perspectives: List[str] = None
    ) -> Dict:
        """
        Generate answer from multiple perspectives.
        
        Args:
            question: User's question
            perspectives: Different ways to view the question
            
        Returns:
            Dict with answers from different angles
        """
        perspectives = perspectives or ["Definition", "Application", "Analysis"]
        
        results = {}
        for perspective in perspectives:
            prompt = f"Explain {question} from a {perspective} perspective"
            results[perspective] = await self.answer_with_sources(prompt)
        
        return results
