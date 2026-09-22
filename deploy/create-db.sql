SELECT format('CREATE ROLE grani LOGIN PASSWORD %L', :'pw')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grani') \gexec

SELECT 'CREATE DATABASE grani OWNER grani'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'grani') \gexec

SELECT datname FROM pg_database WHERE datname = 'grani';
