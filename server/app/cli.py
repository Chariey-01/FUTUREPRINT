"""Flask CLI commands: ``flask seed validate`` and ``flask seed load``."""

from __future__ import annotations

from pathlib import Path

import click
from flask import Flask
from flask.cli import AppGroup

from app.seed.loader import DEFAULT_SEED_DIR, SeedValidationError, load_dataset, read_dataset

seed_cli = AppGroup("seed", help="Validate and load curated seed data.")


@seed_cli.command("validate")
@click.option("--path", "path", type=click.Path(file_okay=False, path_type=Path), default=DEFAULT_SEED_DIR)
def validate_command(path: Path) -> None:
    """Validate seed files without touching the database."""
    try:
        ds = read_dataset(path)
    except SeedValidationError as exc:
        raise click.ClickException(str(exc)) from None
    click.echo(f"Seed data is valid: version {ds.version} ({len(ds.occupations.occupations)} occupations)")


@seed_cli.command("load")
@click.option("--path", "path", type=click.Path(file_okay=False, path_type=Path), default=DEFAULT_SEED_DIR)
def load_command(path: Path) -> None:
    """Validate and load seed data idempotently in one transaction."""
    from app.repositories.seed_repository import SeedConflictError

    try:
        result = load_dataset(path)
    except (SeedValidationError, SeedConflictError) as exc:
        raise click.ClickException(str(exc)) from None
    state = "new version created" if result.created_version else "content already at this version (updated in place)"
    click.echo(f"Loaded content version {result.version}: {state}")
    for table, count in sorted(result.counts.items()):
        click.echo(f"  {table}: {count}")
    for table, count in sorted(result.pruned.items()):
        click.echo(f"  pruned {table}: {count}")


def register_cli(app: Flask) -> None:
    app.cli.add_command(seed_cli)
