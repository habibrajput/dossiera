"""Dashboard metadata and milestone behavior for the application tracker."""

import sqlite3
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import Database
from app.db_engine import init_models_sync, make_sync_engine
from app.main import app


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


class TestApplicationMetadata:
    async def test_manual_add_persists_deadline(self, isolated_db: Database) -> None:
        async with _client() as client:
            response = await client.post(
                "/api/v1/applications",
                json={
                    "resume_id": "resume-1",
                    "job_description": "Build things.",
                    "company": "Acme",
                    "role": "Engineer",
                    "status": "saved",
                    "deadline_at": "2026-11-15",
                },
            )

        assert response.status_code == 200, response.text
        card = response.json()
        assert card["deadline_at"] == "2026-11-15"
        assert card["heard_back_at"] is None
        assert card["interview_at"] is None
        assert card["offer_at"] is None
        assert card["status_changed_at"] is not None

    async def test_offer_and_declined_are_valid_api_statuses(
        self, isolated_db: Database
    ) -> None:
        card = await isolated_db.create_application(
            job_id="job-offer", resume_id="resume-1", status="offer"
        )
        assert card["status"] == "offer"
        assert card["offer_at"] is not None

        updated = await isolated_db.update_application(
            card["application_id"], {"status": "declined"}
        )
        assert updated is not None
        assert updated["status"] == "declined"
        assert updated["offer_at"] is not None
        assert updated["interview_at"] is not None

    async def test_transitions_record_first_time_milestones(
        self, isolated_db: Database
    ) -> None:
        saved = await isolated_db.create_application(
            job_id="job-1",
            resume_id="resume-1",
            status="saved",
            deadline_at="2026-11-20",
        )
        assert saved["applied_at"] is None
        assert saved["heard_back_at"] is None

        screening = await isolated_db.update_application(
            saved["application_id"], {"status": "response"}
        )
        assert screening is not None
        assert screening["applied_at"] is not None
        assert screening["heard_back_at"] is not None
        assert screening["interview_at"] is None
        assert screening["offer_at"] is None

        offer = await isolated_db.update_application(
            saved["application_id"], {"status": "offer"}
        )
        assert offer is not None
        assert offer["interview_at"] is not None
        assert offer["offer_at"] is not None

        declined = await isolated_db.update_application(
            saved["application_id"], {"status": "declined"}
        )
        assert declined is not None
        assert declined["offer_at"] == offer["offer_at"]
        assert declined["status_changed_at"] is not None

    async def test_bulk_move_records_milestones(self, isolated_db: Database) -> None:
        saved = await isolated_db.create_application(
            job_id="job-1", resume_id="resume-1", status="saved"
        )
        moved = await isolated_db.bulk_update_applications(
            [saved["application_id"]], "rejected"
        )
        assert moved == 1
        rejected = await isolated_db.get_application(saved["application_id"])
        assert rejected is not None
        assert rejected["applied_at"] is not None
        assert rejected["heard_back_at"] is not None
        assert rejected["status_changed_at"] is not None


@pytest.mark.sqlite_only
class TestExistingDatabaseMigration:
    async def test_adds_dashboard_columns_to_existing_sqlite(
        self, backend_test_data_dir: Path
    ) -> None:
        path = backend_test_data_dir / "legacy-dashboard.db"
        with sqlite3.connect(path) as connection:
            connection.execute(
                """
                CREATE TABLE applications (
                    application_id TEXT PRIMARY KEY,
                    job_id TEXT,
                    resume_id TEXT,
                    master_resume_id TEXT,
                    status TEXT,
                    company TEXT,
                    role TEXT,
                    applied_at TEXT,
                    notes TEXT,
                    position INTEGER,
                    created_at TEXT,
                    updated_at TEXT
                )
                """
            )

        init_models_sync(make_sync_engine(path))
        engine = make_sync_engine(path)
        try:
            with engine.connect() as connection:
                names = {
                    row["name"]
                    for row in connection.exec_driver_sql(
                        "PRAGMA table_info(applications)"
                    ).mappings()
                }
        finally:
            engine.dispose()

        assert {
            "deadline_at",
            "heard_back_at",
            "interview_at",
            "offer_at",
            "status_changed_at",
        } <= names
