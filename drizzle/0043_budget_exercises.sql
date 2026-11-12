CREATE TABLE qsse_budget_years(year INTEGER PRIMARY KEY,as_of_month INTEGER NOT NULL DEFAULT 12,created_at TEXT NOT NULL);
CREATE TABLE qsse_budget_annual(id TEXT PRIMARY KEY,year INTEGER NOT NULL REFERENCES qsse_budget_years(year),data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL,updated_by TEXT NOT NULL);
CREATE INDEX qsse_budget_annual_year ON qsse_budget_annual(year);
CREATE TABLE qsse_budget_year_import(id INTEGER PRIMARY KEY CHECK(id=1));
