"""Deterministic fixture; all numerical choices are invented for software tests."""
import csv
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

LABEL = 'SYNTHETIC TEST DATA — NOT NASA DATA'

def generate(path=Path(__file__).with_name('synthetic_mission.csv')):
    rng = random.Random(2026)
    fields = ['subject_id','timestamp','mission_phase','activity','source','provenance','quality','label',
              'heart_rate','sleep_duration','reaction_time','fatigue','cabin_co2','hrv']
    with Path(path).open('w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fields); writer.writeheader()
        for subject in range(6):
            previous_sleep = 8.
            for day in range(42):
                sleep = 8 + subject*.08 - max(0, day-9)*.045 + rng.gauss(0,.15)
                exercise = day % 6 == 3
                hr = 65+subject*2+rng.gauss(0,1.5)+(45 if exercise else 0)
                if subject == 0 and 25 <= day <= 30 and not exercise:
                    hr += 18
                if subject == 1 and day == 23:
                    hr = 280  # Deliberate sensor spike, retained by analysis.
                reaction = 240+subject*5+(8-previous_sleep)*45+rng.gauss(0,4)
                writer.writerow(dict(subject_id=f'S{subject+1:02}',
                    timestamp=(datetime(2026,1,1,tzinfo=timezone.utc)+timedelta(days=day)).isoformat(),
                    mission_phase='preflight' if day < 10 else 'inflight', activity='exercise' if exercise else 'rest',
                    source='synthetic_fixture', provenance='SYNTHETIC', quality='unreviewed', label=LABEL,
                    heart_rate=round(hr,3), sleep_duration='' if day in (16,17) and subject == 2 else round(sleep,3),
                    reaction_time=round(reaction,3), fatigue=round(2+max(0,day-9)*.08+rng.gauss(0,.15),3),
                    cabin_co2=round(600+(400 if day >= 24 else 0)+rng.gauss(0,15),3),
                    hrv='' if subject == 5 and day >= 31 else round(55-subject+rng.gauss(0,2),3)))
                previous_sleep = sleep

if __name__ == '__main__':
    generate()
