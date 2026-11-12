"""Run from backend: python -m app.email_worker [--once] [--limit 25]."""
import argparse
import json
import time
from app.core.config import SessionLocal, get_settings
from app.schema import require_current
from app.services.email_delivery import process_due


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--once', action='store_true')
    parser.add_argument('--limit', type=int, default=25)
    args = parser.parse_args()
    if not 1 <= args.limit <= 100:
        parser.error('--limit doit être entre 1 et 100')
    settings = get_settings()
    if not settings.notification_email_enabled or settings.email_backend == 'disabled':
        raise SystemExit('Activer NOTIFICATION_EMAIL_ENABLED et configurer EMAIL_BACKEND avant le worker')
    require_current()
    try:
        while True:
            print(json.dumps(process_due(SessionLocal, limit=args.limit)), flush=True)
            if args.once:
                return
            time.sleep(5)
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
