import json
from pydantic import BaseModel
import os
import dill


class CacheOptions(BaseModel):
    cache_dir_path: str
    load_from_cache: bool = True
    save_to_cache: bool = True


class CacheHelper:
    _cache_options: CacheOptions

    def __init__(self, cache_options: CacheOptions):
        self._cache_options = cache_options

    def unpickle(self, path: str) -> any:
        if not self._cache_options.load_from_cache:
            print(f"[CacheHelper] skipping load {path}, load_from_cache=False")
            return None
        if not os.path.exists(os.path.join(self._cache_options.cache_dir_path, path)):
            print(f"[CacheHelper] skipping load {path} because it does not exist")
            return None
        print(f"[CacheHelper] loading {path}")
        with open(os.path.join(self._cache_options.cache_dir_path, path), "rb") as f:
            return dill.load(f)

    def pickle(self, path: str, data: any) -> bool:
        if not self._cache_options.save_to_cache:
            print(f"[CacheHelper] skipping write {path}, save_to_cache=False")
            return False
        print(f"[CacheHelper] pickling {path}")
        target_path = os.path.join(self._cache_options.cache_dir_path, path)
        target_dir = os.path.dirname(target_path)
        os.makedirs(target_dir, exist_ok=True)
        with open(target_path, "wb") as f:
            dill.dump(data, f)
        return True

    def dump_json(self, path: str, data: any) -> bool:
        if not self._cache_options.save_to_cache:
            print(f"[CacheHelper] skipping dump_json {path}, save_to_cache=False")
            return False
        print(f"[CacheHelper] dumping {path}")
        target_path = os.path.join(self._cache_options.cache_dir_path, path)
        target_dir = os.path.dirname(target_path)
        os.makedirs(target_dir, exist_ok=True)
        with open(target_path, "w") as f:
            json.dump(data, f, indent=2)
        return True
