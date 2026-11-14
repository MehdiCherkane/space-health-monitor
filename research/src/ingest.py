from pathlib import Path
from abc import ABC, abstractmethod
import pandas as pd
from .normalize import normalize

class DatasetAdapter(ABC):
    @abstractmethod
    def load(self, path): ...

    def normalize(self, frame, config, metrics):
        return normalize(frame, config, metrics)

class GenericAdapter(DatasetAdapter):
    def load(self, path):
        path = Path(path)
        if path.suffix.lower() == '.csv':
            return pd.read_csv(path, dtype={'subject_id': 'string'})
        if path.suffix.lower() == '.json':
            return pd.read_json(path, dtype={'subject_id': 'string'})
        raise ValueError('Supported formats: CSV, JSON record arrays')

ADAPTERS = {'generic': GenericAdapter}
