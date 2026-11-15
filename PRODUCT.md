# Astro Vital

An offline-capable replay prototype for a Space Apps jury. It explains which observations support an assessment, which inputs are missing, and when a detector reading has become stale. It is not a medical device.

The two working scenarios are a synthetic sleep/vigilance crew scenario and historical RadLab cabin detector data. The backend owns assessments, freshness, evidence, action availability and incidents; the frontend displays them. A browser reaction check records actual device measurements, explicitly incomparable with the synthetic task profile.

The primary task is to select a scenario, move through checkpoints, read the assessment and inspect its evidence. Preserve replay isolation, provenance, retry behavior and measurement timing. No health score, confidence probability, organ diagnosis or invented vital sign is supported.

The user approved the external dashboard redesign brief and its three local image references. It pins a large anatomical illustration, light sage reading panels on deep space, a complementary detector scene, and a slowly spinning galaxy. Assets must be bundled locally. Anatomy controls change the illustration only.
