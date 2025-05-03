from setuptools import setup, find_packages
with open("requirements.txt") as f:
    requirements = f.read().splitlines()

    
setup(
    name="harlus_chat",
    version="0.1.0",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=requirements,
    description="Release note: initial release",
)