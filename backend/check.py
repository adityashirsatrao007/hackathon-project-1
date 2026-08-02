import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

url = "postgresql+asyncpg://neondb_owner:npg_tK8Lj1uMOrRI@ep-long-fog-a115bxx6-pooler.ap-southeast-1.aws.neon.tech/neondb"

async def check():
    engine = create_async_engine(url)
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT id, message, error_type, platform, sdk_name FROM issues WHERE project_id = '60bc3cfc-23c1-467e-89fa-5c0b7a0dd51d'"))
        for row in res.fetchall():
            print(row)

asyncio.run(check())
