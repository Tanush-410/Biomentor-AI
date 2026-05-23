"""PDF and document processing utilities."""
from typing import List, Dict, Tuple
from pathlib import Path
import json


class PDFProcessor:
    """Process PDF documents and extract structured content."""
    
    def __init__(self):
        """Initialize PDF processor."""
        self.supported_formats = [".pdf", ".txt", ".md"]
    
    async def extract_text(self, file_path: str) -> Dict:
        """
        Extract text from PDF.
        
        Args:
            file_path: Path to PDF file
            
        Returns:
            Dict with pages and content
        """
        file_path = Path(file_path)
        
        if not file_path.exists():
            return {"error": "File not found"}
        
        if file_path.suffix.lower() not in self.supported_formats:
            return {"error": "Unsupported file format"}
        
        # In actual implementation, use PyPDF2 for PDFs
        # For now, return structure
        return {
            "file_name": file_path.name,
            "total_pages": 0,
            "pages": [],
            "text": "",
            "metadata": {}
        }
    
    async def chunk_text(
        self,
        text: str,
        chunk_size: int = 500,
        overlap: int = 50
    ) -> List[Dict]:
        """
        Split text into overlapping chunks.
        
        Args:
            text: Full text to chunk
            chunk_size: Characters per chunk
            overlap: Overlap between chunks
            
        Returns:
            List of text chunks with metadata
        """
        chunks = []
        start = 0
        
        while start < len(text):
            end = start + chunk_size
            chunk_text = text[start:end]
            
            chunks.append({
                "chunk_index": len(chunks),
                "text": chunk_text,
                "start_char": start,
                "end_char": end,
                "tokens": len(chunk_text.split())  # Approximate
            })
            
            start = end - overlap
        
        return chunks
    
    @staticmethod
    def estimate_tokens(text: str) -> int:
        """
        Estimate number of tokens in text.
        
        Args:
            text: Text to estimate
            
        Returns:
            Approximate token count
        """
        # Rough estimate: ~4 characters per token
        return len(text) // 4
    
    @staticmethod
    def validate_file(file_path: str, max_size_mb: int = 50) -> Dict:
        """
        Validate file before processing.
        
        Args:
            file_path: Path to file
            max_size_mb: Maximum file size in MB
            
        Returns:
            Validation result dict
        """
        file_path = Path(file_path)
        
        if not file_path.exists():
            return {"valid": False, "error": "File does not exist"}
        
        file_size_mb = file_path.stat().st_size / (1024 * 1024)
        if file_size_mb > max_size_mb:
            return {
                "valid": False,
                "error": f"File size {file_size_mb:.1f}MB exceeds limit of {max_size_mb}MB"
            }
        
        if file_path.suffix.lower() not in [".pdf", ".txt", ".md"]:
            return {"valid": False, "error": "Unsupported file format"}
        
        return {
            "valid": True,
            "file_name": file_path.name,
            "file_size_mb": file_size_mb,
            "file_type": file_path.suffix
        }


class TextPreprocessor:
    """Preprocess text for better embedding and retrieval."""
    
    @staticmethod
    def clean_text(text: str) -> str:
        """
        Clean and normalize text.
        
        Args:
            text: Raw text
            
        Returns:
            Cleaned text
        """
        # Remove extra whitespace
        text = " ".join(text.split())
        
        # Remove special characters but keep alphanumeric and basic punctuation
        import re
        text = re.sub(r'[^\w\s.!?;:,\-\(\)]', '', text)
        
        return text
    
    @staticmethod
    def extract_key_terms(text: str, top_n: int = 10) -> List[str]:
        """
        Extract key terms from text.
        
        Args:
            text: Text to extract from
            top_n: Number of terms to extract
            
        Returns:
            List of key terms
        """
        # Simple implementation: split and filter common words
        common_words = {
            "the", "a", "an", "and", "or", "but", "in", "on", "at",
            "to", "for", "of", "with", "by", "from", "is", "are", "be"
        }
        
        words = text.lower().split()
        terms = [w for w in words if w not in common_words and len(w) > 3]
        
        # Return top N by frequency
        from collections import Counter
        return [term for term, _ in Counter(terms).most_common(top_n)]
    
    @staticmethod
    def create_summary(text: str, max_sentences: int = 3) -> str:
        """
        Create a basic summary of text.
        
        Args:
            text: Text to summarize
            max_sentences: Maximum sentences in summary
            
        Returns:
            Summary text
        """
        sentences = text.split(".")
        return ". ".join(sentences[:max_sentences]) + "."
