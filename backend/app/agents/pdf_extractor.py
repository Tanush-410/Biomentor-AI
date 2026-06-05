"""PDF text extraction and processing."""
import io
from typing import List, Optional, Tuple

from pypdf import PdfReader

class PDFExtractor:
    """Extract text and metadata from PDF files."""

    @staticmethod
    def extract_pages(file_content: bytes, max_pages: Optional[int] = None) -> Tuple[List[dict], int]:
        """Extract per-page text payloads from a PDF file."""
        try:
            pdf_reader = PdfReader(io.BytesIO(file_content))
            page_count = len(pdf_reader.pages)
            pages_to_process = min(page_count, max_pages) if max_pages else page_count
            page_payloads = []

            for page_num in range(pages_to_process):
                page = pdf_reader.pages[page_num]
                text = (page.extract_text() or "").strip()
                if text:
                    page_payloads.append({"page_number": page_num + 1, "text": text})

            return page_payloads, page_count
        except Exception as e:
            raise Exception(f"Error extracting PDF text: {str(e)}")
    
    @staticmethod
    def extract_text(file_content: bytes, max_pages: Optional[int] = None) -> Tuple[str, int]:
        """
        Extract text from PDF file.
        
        Args:
            file_content: PDF file content as bytes
            max_pages: Maximum pages to extract (None for all)
            
        Returns:
            Tuple of (extracted_text, page_count)
        """
        page_payloads, page_count = PDFExtractor.extract_pages(file_content, max_pages=max_pages)
        full_text = "\n\n".join(payload["text"] for payload in page_payloads)
        return full_text, page_count
    
    @staticmethod
    def extract_text_from_file(file_path: str, max_pages: Optional[int] = None) -> Tuple[str, int]:
        """Extract text from PDF file path."""
        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            return PDFExtractor.extract_text(content, max_pages)
        except Exception as e:
            raise Exception(f"Error reading PDF file: {str(e)}")

    @staticmethod
    def extract_pages_from_file(file_path: str, max_pages: Optional[int] = None) -> Tuple[List[dict], int]:
        """Extract per-page payloads from a PDF on disk."""
        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            return PDFExtractor.extract_pages(content, max_pages)
        except Exception as e:
            raise Exception(f"Error reading PDF file: {str(e)}")
    
    @staticmethod
    def chunk_text(text: str, chunk_size: int = 2000) -> list:
        """
        Split text into chunks for processing.
        
        Args:
            text: Text to split
            chunk_size: Target size of each chunk
            
        Returns:
            List of text chunks
        """
        sentences = text.split('. ')
        chunks = []
        current_chunk = ""
        
        for sentence in sentences:
            if len(current_chunk) + len(sentence) > chunk_size:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = sentence + ". "
            else:
                current_chunk += sentence + ". "
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks
