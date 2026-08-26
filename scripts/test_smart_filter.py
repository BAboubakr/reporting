import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / 'scripts' / 'smart_filter.py'
spec = importlib.util.spec_from_file_location('smart_filter', MODULE_PATH)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

CASES = [
    ('REJECT', {'title': "Outils informatiques", 'summary': '', 'source': 'MASEN e-Tendering'}),
    ('REJECT', {'title': "Spécifications techniques", 'summary': '', 'source': 'MASEN e-Tendering'}),
    ('REJECT', {'title': "Consultations en cours", 'summary': '0 entités publiques inscrites', 'source': 'MASEN e-Tendering'}),
    ('REJECT', {'title': "Tester la configuration de mon poste", 'summary': '', 'source': 'MASEN e-Tendering'}),
    ('REJECT', {'title': "Market Movement signal relevant to Morocco renewable-energy activity", 'summary': '', 'source': 'e-tendering@masen.ma'}),
    ('REJECT', {'title': "Tender signal relevant to Morocco renewable-energy activity", 'summary': '', 'source': 'e-tendering@masen.ma'}),
    ('KEEP', {'title': "CHEC wins turnkey EPC contract for GPM4 PV plant in Fez, including BESS", 'summary': 'Turnkey EPC contract awarded for a solar project in Fez with battery storage.', 'source': 'Green Power Morocco', 'url': 'https://example.com', 'published': '2026-08-13'}),
    ('KEEP', {'title': "ORNX Green Hydrogen selects KBR for Laâyoune green-ammonia Pre-FEED", 'summary': 'Pre-FEED selected for a large-scale green ammonia development in Laâyoune.', 'source': 'Hespress', 'url': 'https://example.com', 'published': '2026-08-16'}),
]

failures = []
print('ATLAS SMART FILTER TEST')
print('=' * 72)
for expected, signal in CASES:
    result = mod.classify_signal(signal)
    decision = result.get('decision')
    ok = decision == expected
    print(f"{'PASS' if ok else 'FAIL'} | expected={expected:<6} got={decision:<6} | score={result.get('quality_score')} | {signal['title']}")
    if not ok:
        failures.append({'expected': expected, 'actual': decision, 'signal': signal, 'result': result})

print('=' * 72)
print(f'{len(CASES)-len(failures)}/{len(CASES)} cases passed')
if failures:
    print(json.dumps(failures, ensure_ascii=False, indent=2))
    raise SystemExit(1)
