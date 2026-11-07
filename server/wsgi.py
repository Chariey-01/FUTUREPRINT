"""WSGI entry point: ``gunicorn wsgi:app`` (production) or ``flask run`` (development)."""

from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name(".env"))

from app import create_app  # noqa: E402

app = create_app()
