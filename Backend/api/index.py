import sys
import os

# Add parent directory to path to import main app
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app import app

# Export the FastAPI app for Vercel