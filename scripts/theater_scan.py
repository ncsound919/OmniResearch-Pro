#!/usr/bin/env python3
import sys
from pathlib import Path

# Add project root to sys.path to allow importing stubscan
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

from stubscan.cli import main

if __name__ == "__main__":
    sys.exit(main())
