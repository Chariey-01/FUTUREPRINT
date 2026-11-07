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


engine_cli = AppGroup("engine", help="Inspect and check the configured scenario engine.")


@engine_cli.command("check")
@click.option("--occupation", "occupation", default=None, help="Check a single occupation slug.")
@click.option("--max-steps", default=50, show_default=True, help="Steps after which a path counts as a loop.")
def engine_check_command(occupation: str | None, max_steps: int) -> None:
    """Walk every simulation path with the configured engine and report contract problems."""
    from app.errors import ApiError
    from app.services import engine_service
    from app.services.content_service import get_engine

    engine = get_engine()
    info = engine.describe()
    click.echo(f"Engine: {info['name']} (version: {info['version'] or 'unset'}; reference stand-in: {info['is_reference']})")
    try:
        reports = engine_service.run_conformance(occupation, max_steps=max_steps)
    except ApiError as exc:
        raise click.ClickException(exc.message) from None
    failed = 0
    for report in reports:
        status = "OK  " if report.ok else "FAIL"
        extra = " (truncated)" if report.truncated else ""
        click.echo(
            f"  {status} {report.occupation_slug}: {report.complete_paths} complete path(s), "
            f"{len(report.scenarios_presented)} scenario(s) presented{extra}"
        )
        for problem in report.problems:
            click.echo(f"       - {problem}")
        failed += 0 if report.ok else 1
    if not reports:
        raise click.ClickException("No occupations with simulations were found.")
    if failed:
        raise click.ClickException(f"{failed} occupation(s) failed the engine contract check.")
    click.echo("Engine conforms to the contract for all checked occupations.")


def register_cli(app: Flask) -> None:
    app.cli.add_command(seed_cli)
    app.cli.add_command(engine_cli)
