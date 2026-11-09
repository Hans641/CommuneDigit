"""Compatibility entry point for the private administrator bootstrap CLI.

Usage: python init_db.py --matricule ADMIN-0001 --email admin@example.mg --nom Admin --prenom Commune
"""
from manage_admin import main


if __name__ == '__main__':
    main()
