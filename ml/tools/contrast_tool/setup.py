from setuptools import setup, find_packages

setup(
    name="harlus_contrast_tool",
    version="0.1.0",  # DO NOT BUMP THIS VERSION (see python/env/README.md)
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    package_data={"harlus_contrast_tool": ["config.yaml"]},
)
