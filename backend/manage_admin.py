"""Create an administrator with a password entered privately in a terminal."""
import argparse
from getpass import getpass
from app.core.config import engine, SessionLocal
from app.core.security import hash_password
from app.models.models import Agent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--matricule', required=True)
    parser.add_argument('--email', required=True)
    parser.add_argument('--nom', required=True)
    parser.add_argument('--prenom', required=True)
    args = parser.parse_args()
    password = getpass('Mot de passe (12 caractères minimum) : ')
    if len(password) < 12 or password != getpass('Confirmer : '):
        raise SystemExit('Mot de passe trop court ou confirmation différente')
    from app.schema import require_current
    require_current(engine)
    with SessionLocal() as db:
        if db.query(Agent).filter(Agent.matricule == args.matricule).first():
            raise SystemExit('Matricule déjà utilisé ; aucun compte modifié')
        db.add(Agent(matricule=args.matricule, email=args.email, nom=args.nom,
                     prenom=args.prenom, role='Administrateur', fokontany='Tous',
                     hashed_password=hash_password(password)))
        db.commit()
    print('Administrateur créé')


if __name__ == '__main__':
    main()
