from setuptools import setup, find_packages

setup(
    name="harlus_file_loaders",
    version="0.1.0",  # DO NOT BUMP THIS VERSION (see python/env/README.md)
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    description="Release note: added type checks",
)
