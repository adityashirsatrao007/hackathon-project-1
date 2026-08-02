import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

url = "postgresql+asyncpg://neondb_owner:npg_tK8Lj1uMOrRI@ep-long-fog-a115bxx6-pooler.ap-southeast-1.aws.neon.tech/neondb"

async def check():
    engine = create_async_engine(url)
    async with engine.connect() as conn:
        print("Checking events table:")
        res = await conn.execute(text("SELECT id, project_id, message, error_type, platform FROM events ORDER BY received_at DESC LIMIT 5"))
        for row in res.fetchall():
            print(row)
            
        print("\nChecking redis queue size:")
        
asyncio.run(check())
