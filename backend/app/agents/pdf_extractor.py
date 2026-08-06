"""PDF text extraction and processing."""
import io
import logging
from typing import List, Optional, Tuple

import pypdfium2 as pdfium

logger = logging.getLogger(__name__)

try:
    import pytesseract
    _OCR_AVAILABLE = True
except ImportError:
    _OCR_AVAILABLE = False

# A page with fewer extracted characters than this is treated as "no usable
# text layer" (e.g. a scanned/photographed page) and gets an OCR attempt.
OCR_TEXT_THRESHOLD = 20

# OCR is comparatively slow (roughly a second per page), and extraction runs
# synchronously during upload, so it's capped to keep large scanned PDFs from
# stalling the request for minutes. Pages beyond the cap keep whatever native
# text (if any) was found instead of waiting on OCR.
OCR_MAX_PAGES = 40

# Render scale used before handing a page image to OCR. 2.0 corresponds to
# ~144 DPI, a reasonable balance between OCR accuracy and render time.
OCR_RENDER_SCALE = 2.0


class PDFExtractor:
    """Extract text and metadata from PDF files, with an OCR fallback for scanned pages."""

    @staticmethod
    def _ocr_page(page: "pdfium.PdfPage") -> str:
        """Render a page to an image and run OCR on it. Returns "" if OCR isn't available or fails."""
        if not _OCR_AVAILABLE:
            return ""
        try:
            bitmap = page.render(scale=OCR_RENDER_SCALE)
            image = bitmap.to_pil()
            try:
                return pytesseract.image_to_string(image).strip()
            finally:
                image.close()
        except Exception as e:
            logger.warning("OCR failed for a page: %s", e)
            return ""

    @staticmethod
    def extract_pages(file_content: bytes, max_pages: Optional[int] = None) -> Tuple[List[dict], int]:
        """Extract per-page text payloads from a PDF file.

        Each page is processed independently so a single corrupt/unreadable
        page is skipped rather than aborting extraction for the whole
        document. Pages with little or no extractable text layer (typically
        scanned/photographed pages) fall back to OCR when it's available.
        """
        try:
            pdf = pdfium.PdfDocument(io.BytesIO(file_content))
        except Exception as e:
            raise Exception(f"Error opening PDF: {str(e)}")

        try:
            page_count = len(pdf)
            pages_to_process = min(page_count, max_pages) if max_pages else page_count
            page_payloads = []

            for page_num in range(pages_to_process):
                try:
                    page = pdf[page_num]
                except Exception as e:
                    logger.warning("Skipping page %d, could not load it: %s", page_num + 1, e)
                    continue

                try:
                    text = ""
                    try:
                        text_page = page.get_textpage()
                        try:
                            text = (text_page.get_text_range() or "").strip()
                        finally:
                            text_page.close()
                    except Exception as e:
                        logger.warning("Text layer extraction failed on page %d: %s", page_num + 1, e)

                    used_ocr = False
                    if len(text) < OCR_TEXT_THRESHOLD and page_num < OCR_MAX_PAGES:
                        ocr_text = PDFExtractor._ocr_page(page)
                        if len(ocr_text) > len(text):
                            text = ocr_text
                            used_ocr = True

                    if text:
                        page_payloads.append({
                            "page_number": page_num + 1,
                            "text": text,
                            "ocr": used_ocr,
                        })
                except Exception as e:
                    logger.warning("Skipping page %d due to extraction error: %s", page_num + 1, e)
                finally:
                    page.close()

            return page_payloads, page_count
        finally:
            pdf.close()

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
