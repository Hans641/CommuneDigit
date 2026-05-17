"""
CommuneDigit — Service de gestion des fichiers
Gère les uploads, stockage et téléchargement des pièces jointes
"""
import os
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple

# Configuration
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "/tmp/commune_uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_MIMES = {
    "application/pdf", "image/jpeg", "image/png", "image/tiff",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # docx
    "application/msword",  # doc
}

ALLOWED_EXTENSIONS = {
    ".pdf", ".jpg", ".jpeg", ".png", ".tiff", ".docx", ".doc"
}


class FileService:
    @staticmethod
    def validate_file(filename: str, size: int, mime_type: str) -> None:
        """Valide un fichier uploadé."""
        if size > MAX_FILE_SIZE:
            raise ValueError(f"Fichier trop volumineux (max {MAX_FILE_SIZE / 1024 / 1024:.0f}MB)")

        ext = Path(filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise ValueError(f"Extension non autorisée: {ext}")

        if mime_type not in ALLOWED_MIMES:
            raise ValueError(f"Type MIME non autorisé: {mime_type}")

    @staticmethod
    def save_upload(
        file_content: bytes,
        original_filename: str,
        demande_id: str,
        user_id: int,
    ) -> Tuple[str, str]:
        """Sauvegarde un fichier uploadé."""
        file_hash = hashlib.sha256(file_content).hexdigest()
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        file_ext = Path(original_filename).suffix
        safe_filename = f"{demande_id}_{timestamp}_{file_hash[:8]}{file_ext}"

        user_dir = UPLOAD_DIR / str(user_id) / demande_id
        user_dir.mkdir(parents=True, exist_ok=True)
        file_path = user_dir / safe_filename

        with open(file_path, "wb") as f:
            f.write(file_content)

        url = f"/uploads/{user_id}/{demande_id}/{safe_filename}"
        return url, file_hash

    @staticmethod
    def get_file_path(url: str) -> Optional[Path]:
        """Récupère le chemin physique d'un fichier uploadé."""
        rel_path = url.lstrip("/uploads/")
        file_path = UPLOAD_DIR / rel_path
        try:
            file_path.resolve().relative_to(UPLOAD_DIR.resolve())
            if file_path.exists():
                return file_path
        except (ValueError, FileNotFoundError):
            pass
        return None

    @staticmethod
    def delete_file(url: str) -> bool:
        """Supprime un fichier uploadé."""
        file_path = FileService.get_file_path(url)
        if file_path:
            try:
                file_path.unlink()
                try:
                    file_path.parent.rmdir()
                    file_path.parent.parent.rmdir()
                except Exception:
                    pass
                return True
            except Exception:
                pass
        return False

    @staticmethod
    def calculate_sha256(content: bytes) -> str:
        """Calcule le hash SHA-256 d'un contenu."""
        return hashlib.sha256(content).hexdigest()

    @staticmethod
    def format_file_size(size_bytes: int) -> str:
        """Formate une taille de fichier en human-readable."""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024:
                return f"{size_bytes:.1f}{unit}"
            size_bytes /= 1024
        return f"{size_bytes:.1f}TB"